use crate::models::{JiraCredentials, McpServerConfig};
use std::fs;
use std::path::PathBuf;

const SERVICE: &str = "betternotes";
const JIRA_ACCOUNT: &str = "jira-credentials";
const MCP_CONFIG_FILE: &str = "mcp-config.json";

fn config_dir() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("betternotes")
}

pub fn save_jira_credentials(creds: &JiraCredentials) -> Result<(), String> {
    let json = serde_json::to_string(creds).map_err(|e| e.to_string())?;
    let entry = keyring::Entry::new(SERVICE, JIRA_ACCOUNT).map_err(|e| e.to_string())?;
    entry.set_password(&json).map_err(|e| e.to_string())
}

pub fn get_jira_credentials() -> Result<Option<JiraCredentials>, String> {
    let entry = keyring::Entry::new(SERVICE, JIRA_ACCOUNT).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(json) => {
            let creds: JiraCredentials = serde_json::from_str(&json).map_err(|e| e.to_string())?;
            Ok(Some(creds))
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub fn delete_jira_credentials() -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE, JIRA_ACCOUNT).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

pub fn get_mcp_config() -> Result<McpServerConfig, String> {
    let path = config_dir().join(MCP_CONFIG_FILE);
    if path.exists() {
        let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&data).map_err(|e| e.to_string())
    } else {
        Ok(default_mcp_config())
    }
}

pub fn save_mcp_config(config: &McpServerConfig) -> Result<(), String> {
    let dir = config_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(MCP_CONFIG_FILE);
    let data = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(path, data).map_err(|e| e.to_string())
}

fn default_mcp_config() -> McpServerConfig {
    McpServerConfig {
        command: "npx".into(),
        args: vec!["-y".to_string(), "@anthropic/mcp-server-jira".to_string()],
        env: std::collections::HashMap::new(),
    }
}

pub fn mcp_env_with_jira(config: &McpServerConfig) -> std::collections::HashMap<String, String> {
    let mut env = config.env.clone();
    if let Ok(Some(creds)) = get_jira_credentials() {
        env.insert("JIRA_URL".into(), creds.site_url);
        env.insert("JIRA_EMAIL".into(), creds.email);
        env.insert("JIRA_API_TOKEN".into(), creds.api_token);
    }
    env
}
