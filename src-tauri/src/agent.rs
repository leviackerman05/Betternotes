use crate::db;
use crate::mcp::{run_with_client, McpTool};
use crate::models::{AgentMessage, AppSettings};
use serde_json::{json, Value};
use tauri::AppHandle;

const MAX_TOOL_ROUNDS: usize = 5;

pub async fn check_ollama(endpoint: &str) -> Result<(bool, Vec<String>), String> {
    let url = format!("{endpoint}/api/tags");
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .map_err(|e| e.to_string())?;
    match client.get(&url).send().await {
        Ok(resp) if resp.status().is_success() => {
            let body: Value = resp.json().await.map_err(|e| e.to_string())?;
            let models: Vec<String> = body
                .get("models")
                .and_then(|m| m.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|m| m.get("name").and_then(|n| n.as_str()).map(String::from))
                        .collect()
                })
                .unwrap_or_default();
            Ok((true, models))
        }
        _ => Ok((false, vec![])),
    }
}

fn tools_to_ollama_format(tools: &[McpTool]) -> Vec<Value> {
    tools
        .iter()
        .map(|t| {
            json!({
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description.clone().unwrap_or_default(),
                    "parameters": t.input_schema
                }
            })
        })
        .collect()
}

async fn ollama_chat(
    settings: &AppSettings,
    messages: &[Value],
    tools: &[Value],
) -> Result<Value, String> {
    let url = format!("{}/api/chat", settings.ollama_endpoint);
    let body = json!({
        "model": settings.ollama_model,
        "messages": messages,
        "tools": tools,
        "stream": false
    });
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            format!(
                "Ollama request failed: {e}. Is Ollama running? Try: ollama pull {}",
                settings.ollama_model
            )
        })?;
    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Ollama error: {text}"));
    }
    let result: Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(result.get("message").cloned().unwrap_or(Value::Null))
}

pub async fn run_agent(
    app: &AppHandle,
    prompt: &str,
    history: Vec<AgentMessage>,
) -> Result<Vec<AgentMessage>, String> {
    let settings = db::get_settings(app).await?;
    let (available, _) = check_ollama(&settings.ollama_endpoint).await?;
    if !available {
        return Err(
            "Ollama is not running. Install from https://ollama.com and run: ollama pull qwen2.5:7b"
                .into(),
        );
    }

    let settings = settings.clone();
    let tools_and_messages = tokio::task::spawn_blocking({
        let prompt = prompt.to_string();
        let history = history.clone();
        let settings = settings.clone();
        move || -> Result<(Vec<McpTool>, Vec<AgentMessage>), String> {
            run_with_client(|mcp| {
                let tools = mcp.list_tools()?;
                let mut new_messages: Vec<AgentMessage> = Vec::new();
                let ollama_tools = tools_to_ollama_format(&tools);

                let mut ollama_messages: Vec<Value> = vec![json!({
                    "role": "system",
                    "content": "You are a helpful Jira assistant. Use the available tools to fetch and manage Jira tickets. Be concise and helpful."
                })];

                for msg in &history {
                    ollama_messages.push(json!({
                        "role": msg.role,
                        "content": msg.content
                    }));
                }
                ollama_messages.push(json!({
                    "role": "user",
                    "content": prompt
                }));

                let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;

                for _round in 0..MAX_TOOL_ROUNDS {
                    let message = rt.block_on(ollama_chat(&settings, &ollama_messages, &ollama_tools))?;

                    let tool_calls = message
                        .get("tool_calls")
                        .and_then(|tc| tc.as_array())
                        .cloned()
                        .unwrap_or_default();

                    if tool_calls.is_empty() {
                        let content = message
                            .get("content")
                            .and_then(|c| c.as_str())
                            .unwrap_or("")
                            .to_string();
                        new_messages.push(AgentMessage {
                            role: "assistant".into(),
                            content,
                        });
                        return Ok((tools, new_messages));
                    }

                    ollama_messages.push(message.clone());

                    for tc in &tool_calls {
                        let func = tc.get("function").unwrap_or(tc);
                        let name = func.get("name").and_then(|n| n.as_str()).unwrap_or("");
                        let args: Value = func
                            .get("arguments")
                            .and_then(|a| {
                                if a.is_string() {
                                    serde_json::from_str(a.as_str().unwrap()).ok()
                                } else {
                                    Some(a.clone())
                                }
                            })
                            .unwrap_or(json!({}));

                        let result = mcp.call_tool(name, args)?;
                        new_messages.push(AgentMessage {
                            role: "tool".into(),
                            content: format!("{name}: {result}"),
                        });
                        ollama_messages.push(json!({
                            "role": "tool",
                            "content": result
                        }));
                    }
                }

                new_messages.push(AgentMessage {
                    role: "assistant".into(),
                    content: "Reached maximum tool call rounds. Please try a simpler query.".into(),
                });
                Ok((tools, new_messages))
            })
        }
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(tools_and_messages.1)
}
