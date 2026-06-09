use crate::keychain::{get_mcp_config, mcp_env_with_jira};
use crate::models::McpServerConfig;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicI64, Ordering};

static REQUEST_ID: AtomicI64 = AtomicI64::new(1);

pub struct McpClient {
    child: Child,
    stdin: ChildStdin,
    reader: BufReader<std::process::ChildStdout>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpTool {
    pub name: String,
    pub description: Option<String>,
    pub input_schema: Value,
}

impl McpClient {
    pub fn spawn(config: &McpServerConfig) -> Result<Self, String> {
        let env_vars = mcp_env_with_jira(config);
        let mut cmd = Command::new(&config.command);
        cmd.args(&config.args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());

        for (k, v) in &env_vars {
            cmd.env(k, v);
        }

        let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn MCP server: {e}"))?;
        let stdin = child.stdin.take().ok_or("No stdin")?;
        let stdout = child.stdout.take().ok_or("No stdout")?;
        let reader = BufReader::new(stdout);

        let mut client = McpClient { child, stdin, reader };
        client.initialize()?;
        Ok(client)
    }

    fn next_id() -> i64 {
        REQUEST_ID.fetch_add(1, Ordering::SeqCst)
    }

    fn send_request(&mut self, method: &str, params: Value) -> Result<Value, String> {
        let id = Self::next_id();
        let request = json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params
        });
        let line = serde_json::to_string(&request).map_err(|e| e.to_string())?;
        writeln!(self.stdin, "{line}").map_err(|e| e.to_string())?;
        self.stdin.flush().map_err(|e| e.to_string())?;
        self.read_response(id)
    }

    fn read_response(&mut self, expected_id: i64) -> Result<Value, String> {
        let mut line = String::new();
        for _ in 0..30 {
            line.clear();
            match self.reader.read_line(&mut line) {
                Ok(0) => return Err("MCP server closed connection".into()),
                Ok(_) => {
                    let trimmed = line.trim();
                    if trimmed.is_empty() {
                        continue;
                    }
                    let resp: Value = serde_json::from_str(trimmed)
                        .map_err(|e| format!("Invalid MCP response: {e}"))?;
                    if resp.get("id").and_then(|v| v.as_i64()) == Some(expected_id) {
                        if let Some(err) = resp.get("error") {
                            return Err(err.to_string());
                        }
                        return Ok(resp.get("result").cloned().unwrap_or(Value::Null));
                    }
                }
                Err(e) => return Err(e.to_string()),
            }
        }
        Err("MCP response timeout".into())
    }

    fn initialize(&mut self) -> Result<(), String> {
        self.send_request(
            "initialize",
            json!({
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": { "name": "betternotes", "version": "0.1.0" }
            }),
        )?;
        self.send_request("notifications/initialized", json!({}))?;
        Ok(())
    }

    pub fn list_tools(&mut self) -> Result<Vec<McpTool>, String> {
        let result = self.send_request("tools/list", json!({}))?;
        let tools = result
            .get("tools")
            .and_then(|t| t.as_array())
            .cloned()
            .unwrap_or_default();
        Ok(tools
            .into_iter()
            .filter_map(|t| {
                Some(McpTool {
                    name: t.get("name")?.as_str()?.to_string(),
                    description: t.get("description").and_then(|d| d.as_str()).map(String::from),
                    input_schema: t.get("inputSchema").cloned().unwrap_or(json!({})),
                })
            })
            .collect())
    }

    pub fn call_tool(&mut self, name: &str, arguments: Value) -> Result<String, String> {
        let result = self.send_request(
            "tools/call",
            json!({ "name": name, "arguments": arguments }),
        )?;
        if let Some(content) = result.get("content").and_then(|c| c.as_array()) {
            let texts: Vec<String> = content
                .iter()
                .filter_map(|item| item.get("text").and_then(|t| t.as_str()).map(String::from))
                .collect();
            return Ok(texts.join("\n"));
        }
        Ok(result.to_string())
    }
}

impl Drop for McpClient {
    fn drop(&mut self) {
        let _ = self.child.kill();
    }
}

pub fn run_with_client<F, T>(f: F) -> Result<T, String>
where
    F: FnOnce(&mut McpClient) -> Result<T, String>,
{
    let config = get_mcp_config()?;
    let mut client = McpClient::spawn(&config)?;
    f(&mut client)
}
