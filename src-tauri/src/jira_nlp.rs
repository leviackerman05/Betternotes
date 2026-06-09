use crate::agent;
use crate::models::{AppSettings, JiraSearchIntent};
use serde_json::{json, Value};

const SYSTEM_PROMPT: &str = r#"You convert natural-language Jira search requests into JSON.

Output ONLY a JSON object with these optional fields:
- issue_key: string (e.g. "PROJ-1") if a specific ticket key is mentioned
- assignee: display name of the person tickets are assigned to
- reporter: display name of the reporter
- status: Jira status name (e.g. "To Do", "In Progress", "Code Review", "Done")
- keywords: short phrase to search in ticket title/body (not the assignee name)
- project: project key (e.g. "PROJ")
- only_mine: true if the user wants their own tickets ("my tickets", "assigned to me")
- include_done: true if closed/done tickets should be included

Rules:
- Fix typos in names (assiged → assigned)
- "tickets assigned to X" → assignee: "X"
- "in progress tickets" → status: "In Progress"
- If both assignee and status are mentioned, include both
- keywords should be 1-5 words max, omit filler words
- Do not invent ticket keys"#;

pub async fn parse_query_with_ollama(
    settings: &AppSettings,
    query: &str,
) -> Result<JiraSearchIntent, String> {
    let (available, _) = agent::check_ollama(&settings.ollama_endpoint).await?;
    if !available {
        return Err(
            "Ollama is not running. Start Ollama or use a ticket key like PROJ-1.".into(),
        );
    }

    let url = format!("{}/api/chat", settings.ollama_endpoint);
    let body = json!({
        "model": settings.ollama_model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": query}
        ],
        "stream": false,
        "format": "json"
    });

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(90))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {e}"))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Ollama error: {text}"));
    }

    let result: Value = resp.json().await.map_err(|e| e.to_string())?;
    let content = result
        .pointer("/message/content")
        .and_then(|v| v.as_str())
        .ok_or("Ollama returned empty response")?;

    let parsed: JiraSearchIntent = serde_json::from_str(content)
        .map_err(|e| format!("Could not parse Ollama JSON: {e}"))?;

    Ok(parsed)
}
