use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub due_date: Option<String>,
    pub priority: i32,
    pub completed: bool,
    pub source: String,
    pub jira_key: Option<String>,
    pub jira_url: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Folder {
    pub id: String,
    pub name: String,
    pub created_at: String,
    #[serde(default)]
    pub note_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub folder_id: Option<String>,
    pub title: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub pinned: bool,
    #[serde(default)]
    pub favorite: bool,
    #[serde(default)]
    pub archived: bool,
    #[serde(default)]
    pub locked: bool,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub reminder_at: Option<String>,
    #[serde(default)]
    pub reminder_repeat: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub created_at: String,
    #[serde(default)]
    pub note_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JiraIssue {
    pub key: String,
    pub summary: String,
    pub status: String,
    pub status_category: String,
    pub assignee: Option<String>,
    pub priority: Option<String>,
    pub url: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub issue_type: Option<String>,
    #[serde(default)]
    pub reporter: Option<String>,
    #[serde(default)]
    pub story_points: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JiraUser {
    pub account_id: String,
    pub display_name: String,
    pub email: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JiraSprint {
    pub id: i64,
    pub name: String,
    pub state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct JiraSearchIntent {
    #[serde(default)]
    pub issue_key: Option<String>,
    #[serde(default)]
    pub assignee: Option<String>,
    #[serde(default)]
    pub reporter: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub keywords: Option<String>,
    #[serde(default)]
    pub project: Option<String>,
    #[serde(default)]
    pub only_mine: bool,
    #[serde(default)]
    pub include_done: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JiraSearchResponse {
    pub issues: Vec<JiraIssue>,
    pub used_ai: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JiraCreateRequest {
    pub project_key: String,
    pub summary: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub issue_type: Option<String>,
    #[serde(default)]
    pub assignee_account_id: Option<String>,
    #[serde(default)]
    pub reporter_account_id: Option<String>,
    #[serde(default)]
    pub sprint_id: Option<i64>,
    #[serde(default)]
    pub story_points: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JiraCredentials {
    pub site_url: String,
    pub email: String,
    pub api_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerConfig {
    pub command: String,
    pub args: Vec<String>,
    #[serde(default)]
    pub env: std::collections::HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub theme: String,
    pub ollama_endpoint: String,
    pub ollama_model: String,
    #[serde(default)]
    pub sidebar_collapsed: bool,
    #[serde(default = "default_true")]
    pub local_only_mode: bool,
    #[serde(default)]
    pub local_ai_enabled: bool,
    #[serde(default)]
    pub mcp_enabled: bool,
    #[serde(default)]
    pub jira_enabled: bool,
    #[serde(default)]
    pub github_enabled: bool,
    #[serde(default)]
    pub linear_enabled: bool,
    #[serde(default)]
    pub default_jira_project_key: String,
    #[serde(default = "default_jira_section_title")]
    pub jira_section_title: String,
    #[serde(default)]
    pub jira_my_issues_jql: String,
}

fn default_true() -> bool {
    true
}

fn default_jira_section_title() -> String {
    "My issues".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaStatus {
    pub available: bool,
    pub models: Vec<String>,
}
