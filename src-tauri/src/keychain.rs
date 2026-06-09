use crate::models::{JiraCredentials, McpServerConfig};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Once;

/// Matches `identifier` in tauri.conf.json, same folder Tauri uses for app data / SQLite.
pub const APP_DATA_FOLDER: &str = "com.betternotes.desktop";

const SERVICE: &str = "betternotes";
const JIRA_ACCOUNT: &str = "jira-credentials";
const JIRA_CREDS_FILE: &str = "jira-credentials.json";
const MCP_CONFIG_FILE: &str = "mcp-config.json";
const LEGACY_DATA_FOLDER: &str = "betternotes";

static LEGACY_MIGRATED: Once = Once::new();

fn app_storage_dir() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(APP_DATA_FOLDER)
}

fn legacy_storage_dir() -> Option<PathBuf> {
    dirs::data_local_dir().map(|d| d.join(LEGACY_DATA_FOLDER))
}

fn migrate_legacy_storage() {
    let Some(legacy) = legacy_storage_dir() else {
        return;
    };
    let target = app_storage_dir();
    if legacy == target || !legacy.exists() {
        return;
    }
    if let Err(e) = fs::create_dir_all(&target) {
        eprintln!("Failed to create app storage dir: {e}");
        return;
    }
    for file in [JIRA_CREDS_FILE, MCP_CONFIG_FILE] {
        let from = legacy.join(file);
        let to = target.join(file);
        if from.exists() && !to.exists() {
            if let Err(e) = fs::copy(&from, &to) {
                eprintln!("Failed to migrate {file}: {e}");
            }
        }
    }
}

fn config_dir() -> PathBuf {
    LEGACY_MIGRATED.call_once(migrate_legacy_storage);
    app_storage_dir()
}

#[cfg(unix)]
fn restrict_file_permissions(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o600)).map_err(|e| e.to_string())
}

#[cfg(not(unix))]
fn restrict_file_permissions(_path: &Path) -> Result<(), String> {
    Ok(())
}

fn read_jira_from_keychain() -> Result<Option<JiraCredentials>, String> {
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

pub fn save_jira_credentials(creds: &JiraCredentials) -> Result<(), String> {
    let dir = config_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(JIRA_CREDS_FILE);
    let data = serde_json::to_string_pretty(creds).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| e.to_string())?;
    restrict_file_permissions(&path)?;
    Ok(())
}

pub fn get_jira_credentials() -> Result<Option<JiraCredentials>, String> {
    let path = config_dir().join(JIRA_CREDS_FILE);
    if path.exists() {
        let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let creds: JiraCredentials = serde_json::from_str(&data).map_err(|e| e.to_string())?;
        return Ok(Some(creds));
    }

    // Migrate legacy keychain storage into the local config file.
    if let Some(creds) = read_jira_from_keychain()? {
        let _ = save_jira_credentials(&creds);
        return Ok(Some(creds));
    }

    Ok(None)
}

pub fn delete_jira_credentials() -> Result<(), String> {
    let path = config_dir().join(JIRA_CREDS_FILE);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }

    let entry = keyring::Entry::new(SERVICE, JIRA_ACCOUNT).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

pub fn get_mcp_config() -> Result<McpServerConfig, String> {
    let path = config_dir().join(MCP_CONFIG_FILE);
    if path.exists() {
        let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&data).map_err(|e| e.to_string())
    } else {
        Ok(empty_mcp_config())
    }
}

pub fn save_mcp_config(config: &McpServerConfig) -> Result<(), String> {
    let dir = config_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(MCP_CONFIG_FILE);
    let data = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(path, data).map_err(|e| e.to_string())
}

fn empty_mcp_config() -> McpServerConfig {
    McpServerConfig {
        command: String::new(),
        args: vec![],
        env: std::collections::HashMap::new(),
    }
}

pub fn config_directory() -> PathBuf {
    config_dir()
}

pub fn mcp_env_with_jira(config: &McpServerConfig) -> std::collections::HashMap<String, String> {
    let mut env = config.env.clone();
    if let Ok(Some(creds)) = get_jira_credentials() {
        env.insert("JIRA_BASE_URL".into(), creds.site_url.clone());
        env.insert("JIRA_URL".into(), creds.site_url);
        env.insert("JIRA_EMAIL".into(), creds.email);
        env.insert("JIRA_API_TOKEN".into(), creds.api_token);
    }
    env
}
