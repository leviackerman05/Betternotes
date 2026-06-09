use crate::models::AppSettings;

pub fn with_defaults(mut settings: AppSettings) -> AppSettings {
    // serde defaults handle missing fields on load
    settings
}

pub fn is_local_only(settings: &AppSettings) -> bool {
    settings.local_only_mode
}

pub fn is_local_ai_enabled(settings: &AppSettings) -> bool {
    settings.local_ai_enabled && !settings.local_only_mode
}

pub fn is_mcp_enabled(settings: &AppSettings) -> bool {
    settings.mcp_enabled && !settings.local_only_mode
}

pub fn is_jira_enabled(settings: &AppSettings) -> bool {
    settings.jira_enabled && !settings.local_only_mode
}

pub fn is_github_enabled(settings: &AppSettings) -> bool {
    settings.github_enabled && !settings.local_only_mode
}

pub fn is_linear_enabled(settings: &AppSettings) -> bool {
    settings.linear_enabled && !settings.local_only_mode
}

pub fn require_local_ai(settings: &AppSettings) -> Result<(), String> {
    if !is_local_ai_enabled(settings) {
        return Err(
            "Local AI is disabled. Enable it in Settings → Privacy & Integrations.".into(),
        );
    }
    Ok(())
}

pub fn require_jira(settings: &AppSettings) -> Result<(), String> {
    if !is_jira_enabled(settings) {
        return Err(
            "Jira integration is disabled. Enable it in Settings → Privacy & Integrations.".into(),
        );
    }
    Ok(())
}

pub fn require_mcp(settings: &AppSettings) -> Result<(), String> {
    if !is_mcp_enabled(settings) {
        return Err(
            "MCP is disabled. Enable it in Settings → Privacy & Integrations.".into(),
        );
    }
    Ok(())
}
