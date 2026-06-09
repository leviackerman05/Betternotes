use crate::db;
use crate::integrations::{require_local_ai, require_mcp};
use crate::keychain;
use crate::mcp::{run_with_client, McpTool};
use crate::models::{AgentMessage, AppSettings};
use serde_json::{json, Value};
use tauri::AppHandle;

const MAX_TOOL_ROUNDS: usize = 5;
const AGENT_TIMEOUT_SECS: u64 = 120;

fn format_tool_list(tools: &[McpTool]) -> String {
    if tools.is_empty() {
        return "No MCP tools are connected.".to_string();
    }
    tools
        .iter()
        .map(|t| {
            let desc = t.description.as_deref().unwrap_or("No description");
            format!("• **{}**: {desc}", t.name)
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn is_tool_list_query(prompt: &str) -> bool {
    let p = prompt.to_lowercase();
    (p.contains("tool") || p.contains("mcp"))
        && (p.contains("list")
            || p.contains("what")
            || p.contains("name")
            || p.contains("available")
            || p.contains("have"))
}

fn prefers_no_tool_calls(prompt: &str) -> bool {
    let p = prompt.to_lowercase();
    p.contains("do not call") || p.contains("don't call") || p.contains("without calling")
}

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

pub async fn run_setup_assistant(
    app: &AppHandle,
    integration_title: &str,
    guide_context: &str,
    prompt: &str,
    history: Vec<AgentMessage>,
) -> Result<String, String> {
    let settings = db::get_settings(app).await?;
    let (available, _) = check_ollama(&settings.ollama_endpoint).await?;
    if !available {
        return Err("OLLAMA_UNAVAILABLE".into());
    }

    let system_prompt = format!(
        "You are Betternote's setup assistant helping the user connect {integration_title}.\n\
         Answer step-by-step using only the guide below. Reference exact Settings fields in Betternote.\n\
         Be concise and practical. Do not invent features. If the user is stuck, ask one clarifying question.\n\n\
         {guide_context}"
    );

    let mut ollama_messages: Vec<Value> = vec![json!({
        "role": "system",
        "content": system_prompt
    })];

    for msg in &history {
        if msg.role == "user" || msg.role == "assistant" {
            ollama_messages.push(json!({
                "role": msg.role,
                "content": msg.content
            }));
        }
    }
    ollama_messages.push(json!({
        "role": "user",
        "content": prompt
    }));

    let message = ollama_chat(&settings, &ollama_messages, &[]).await?;
    Ok(message
        .get("content")
        .and_then(|c| c.as_str())
        .unwrap_or("I could not generate a response. Try one of the suggested questions.")
        .to_string())
}

pub async fn run_local_ai_action(
    app: &AppHandle,
    action: &str,
    text: &str,
) -> Result<String, String> {
    let settings = db::get_settings(app).await?;
    require_local_ai(&settings)?;

    let (available, _) = check_ollama(&settings.ollama_endpoint).await?;
    if !available {
        return Err(
            "Ollama is not running. Install from https://ollama.com and run: ollama pull qwen2.5:7b"
                .into(),
        );
    }

    let prompt = match action {
        "summarize" => format!("Summarize the following text concisely:\n\n{text}"),
        "rewrite" => format!("Rewrite the following text for clarity and brevity:\n\n{text}"),
        "extract_tasks" => {
            format!("Extract actionable tasks from the following text as a markdown bullet list:\n\n{text}")
        }
        "explain" => format!("Explain the following code or text for a developer:\n\n{text}"),
        _ => return Err(format!("Unknown local AI action: {action}")),
    };

    let messages = vec![
        json!({"role": "system", "content": "You are a helpful writing assistant for developers. Be concise."}),
        json!({"role": "user", "content": prompt}),
    ];

    let message = ollama_chat(&settings, &messages, &[]).await?;
    Ok(message
        .get("content")
        .and_then(|c| c.as_str())
        .unwrap_or("")
        .to_string())
}

pub async fn run_agent(
    app: &AppHandle,
    prompt: &str,
    history: Vec<AgentMessage>,
) -> Result<Vec<AgentMessage>, String> {
    let settings = db::get_settings(app).await?;
    require_mcp(&settings)?;
    require_local_ai(&settings)?;

    let (available, _) = check_ollama(&settings.ollama_endpoint).await?;
    if !available {
        return Err(
            "Ollama is not running. Install from https://ollama.com and run: ollama pull qwen2.5:7b"
                .into(),
        );
    }

    let settings = settings.clone();
    let work = tokio::task::spawn_blocking({
        let prompt = prompt.to_string();
        let history = history.clone();
        let settings = settings.clone();
        move || -> Result<Vec<AgentMessage>, String> {
            run_with_client(|mcp| {
                let tools = mcp.list_tools()?;
                let mut new_messages: Vec<AgentMessage> = Vec::new();

                if is_tool_list_query(&prompt) || prefers_no_tool_calls(&prompt) {
                    let content = format!(
                        "Connected MCP tools ({}):\n\n{}",
                        tools.len(),
                        format_tool_list(&tools)
                    );
                    new_messages.push(AgentMessage {
                        role: "assistant".into(),
                        content,
                    });
                    return Ok(new_messages);
                }

                let ollama_tools = tools_to_ollama_format(&tools);

                let jira_tools = tools.iter().any(|t| {
                    let n = t.name.to_lowercase();
                    n.contains("jira") || n.contains("issue")
                });
                let jira_configured = keychain::get_jira_credentials()
                    .ok()
                    .flatten()
                    .is_some();
                let tool_list = tools
                    .iter()
                    .map(|t| {
                        let desc = t.description.as_deref().unwrap_or("No description");
                        format!("- {}: {desc}", t.name)
                    })
                    .collect::<Vec<_>>()
                    .join("\n");
                let tool_section = if tool_list.is_empty() {
                    "No MCP tools are available.".to_string()
                } else {
                    format!("Available MCP tools:\n{tool_list}")
                };

                let base_prompt = if jira_tools && jira_configured {
                    "You are a helpful Jira assistant. Use the available tools to fetch and manage Jira tickets. Be concise and helpful."
                } else {
                    "You are a helpful assistant with MCP tools. Use tools when they help answer the user. When asked what tools you have, list them from the available tools section. Be concise and helpful."
                };
                let system_prompt = format!("{base_prompt}\n\n{tool_section}");

                let mut ollama_messages: Vec<Value> = vec![json!({
                    "role": "system",
                    "content": system_prompt
                })];

                for msg in &history {
                    match msg.role.as_str() {
                        "user" | "assistant" => {
                            ollama_messages.push(json!({
                                "role": msg.role,
                                "content": msg.content
                            }));
                        }
                        "tool" => {
                            ollama_messages.push(json!({
                                "role": "assistant",
                                "content": format!("Tool output: {}", msg.content)
                            }));
                        }
                        _ => {}
                    }
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
                        return Ok(new_messages);
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
                Ok(new_messages)
            })
        }
    });

    let messages = tokio::time::timeout(
        std::time::Duration::from_secs(AGENT_TIMEOUT_SECS),
        work,
    )
    .await
    .map_err(|_| {
        format!(
            "Agent timed out after {AGENT_TIMEOUT_SECS}s. Try a shorter question or use the echo tool."
        )
    })?
    .map_err(|e| e.to_string())??;

    Ok(messages)
}
