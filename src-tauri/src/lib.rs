mod agent;
mod db;
mod integrations;
mod jira;
mod jira_nlp;
mod keychain;
mod mcp;
mod models;
mod note_crypto;

use models::*;
use serde_json::json;
use std::collections::HashSet;
use tauri::Manager;

#[tauri::command]
async fn list_tasks(app: tauri::AppHandle) -> Result<Vec<Task>, String> {
    db::list_tasks(&app).await
}

#[tauri::command]
async fn create_task(app: tauri::AppHandle, task: serde_json::Value) -> Result<Task, String> {
    let now = chrono::Utc::now().to_rfc3339();
    let t = Task {
        id: uuid::Uuid::new_v4().to_string(),
        title: task["title"].as_str().unwrap_or("").to_string(),
        description: task.get("description").and_then(|v| v.as_str()).map(String::from),
        due_date: task.get("due_date").and_then(|v| v.as_str()).map(String::from),
        priority: task["priority"].as_i64().unwrap_or(4) as i32,
        completed: task["completed"].as_bool().unwrap_or(false),
        source: task["source"].as_str().unwrap_or("manual").to_string(),
        jira_key: task.get("jira_key").and_then(|v| v.as_str()).map(String::from),
        jira_url: task.get("jira_url").and_then(|v| v.as_str()).map(String::from),
        created_at: now.clone(),
        updated_at: now,
    };
    db::create_task(&app, t).await
}

#[tauri::command]
async fn update_task(
    app: tauri::AppHandle,
    id: String,
    updates: serde_json::Value,
) -> Result<Task, String> {
    db::update_task(&app, &id, updates).await
}

#[tauri::command]
async fn delete_task(app: tauri::AppHandle, id: String) -> Result<(), String> {
    db::delete_task(&app, &id).await
}

#[tauri::command]
async fn list_folders(app: tauri::AppHandle) -> Result<Vec<Folder>, String> {
    db::list_folders(&app).await
}

#[tauri::command]
async fn create_folder(app: tauri::AppHandle, name: String) -> Result<Folder, String> {
    db::create_folder(&app, &name).await
}

#[tauri::command]
async fn update_folder(app: tauri::AppHandle, id: String, name: String) -> Result<Folder, String> {
    db::update_folder(&app, &id, &name).await
}

#[tauri::command]
async fn delete_folder(app: tauri::AppHandle, id: String) -> Result<(), String> {
    db::delete_folder(&app, &id).await
}

#[tauri::command]
async fn list_notes(
    app: tauri::AppHandle,
    folder_id: Option<String>,
    favorite_only: Option<bool>,
    reminder_only: Option<bool>,
    tag_id: Option<String>,
) -> Result<Vec<Note>, String> {
    db::list_notes(
        &app,
        folder_id.as_deref(),
        favorite_only.unwrap_or(false),
        reminder_only.unwrap_or(false),
        tag_id.as_deref(),
    )
    .await
}

#[tauri::command]
async fn list_tags(app: tauri::AppHandle) -> Result<Vec<Tag>, String> {
    db::list_tags(&app).await
}

#[tauri::command]
async fn get_note(app: tauri::AppHandle, id: String) -> Result<Note, String> {
    db::get_note(&app, &id).await
}

#[tauri::command]
async fn create_note(
    app: tauri::AppHandle,
    title: String,
    folder_id: Option<String>,
) -> Result<Note, String> {
    db::create_note(&app, &title, folder_id.as_deref()).await
}

#[tauri::command]
async fn update_note(
    app: tauri::AppHandle,
    id: String,
    title: String,
    content: String,
) -> Result<Note, String> {
    db::update_note(&app, &id, &title, &content).await
}

#[tauri::command]
async fn delete_note(app: tauri::AppHandle, id: String) -> Result<(), String> {
    db::delete_note(&app, &id).await
}

#[tauri::command]
async fn duplicate_note(
    app: tauri::AppHandle,
    id: String,
    folder_id: Option<String>,
) -> Result<Note, String> {
    db::duplicate_note(&app, &id, folder_id.as_deref()).await
}

#[tauri::command]
async fn move_note(app: tauri::AppHandle, id: String, folder_id: String) -> Result<Note, String> {
    db::move_note(&app, &id, &folder_id).await
}

#[tauri::command]
async fn update_note_meta(
    app: tauri::AppHandle,
    id: String,
    updates: serde_json::Value,
) -> Result<Note, String> {
    db::update_note_meta(&app, &id, updates).await
}

#[tauri::command]
async fn lock_note(
    app: tauri::AppHandle,
    id: String,
    password: String,
) -> Result<Note, String> {
    db::lock_note(&app, &id, &password).await
}

#[tauri::command]
async fn unlock_note(
    app: tauri::AppHandle,
    id: String,
    password: String,
) -> Result<Note, String> {
    db::unlock_note(&app, &id, &password).await
}

#[tauri::command]
async fn get_settings(app: tauri::AppHandle) -> Result<AppSettings, String> {
    db::get_settings(&app).await
}

#[tauri::command]
async fn save_settings(app: tauri::AppHandle, settings: AppSettings) -> Result<(), String> {
    db::save_settings(&app, &settings).await
}

#[tauri::command]
fn save_jira_credentials(creds: JiraCredentials) -> Result<(), String> {
    keychain::save_jira_credentials(&creds)
}

#[tauri::command]
fn get_jira_credentials() -> Result<Option<JiraCredentials>, String> {
    keychain::get_jira_credentials()
}

#[tauri::command]
fn delete_jira_credentials() -> Result<(), String> {
    keychain::delete_jira_credentials()
}

#[tauri::command]
async fn get_mcp_config(app: tauri::AppHandle) -> Result<McpServerConfig, String> {
    let settings = db::get_settings(&app).await?;
    if !integrations::is_mcp_enabled(&settings) {
        return Ok(McpServerConfig {
            command: String::new(),
            args: vec![],
            env: std::collections::HashMap::new(),
        });
    }
    keychain::get_mcp_config()
}

#[tauri::command]
async fn save_mcp_config(app: tauri::AppHandle, config: McpServerConfig) -> Result<(), String> {
    let settings = db::get_settings(&app).await?;
    integrations::require_mcp(&settings)?;
    keychain::save_mcp_config(&config)
}

fn shorten_home_path(path: std::path::PathBuf) -> String {
    let path_str = path.to_string_lossy().to_string();
    if let Some(home) = dirs::home_dir() {
        let home = home.to_string_lossy();
        if let Some(rest) = path_str.strip_prefix(home.as_ref()) {
            return format!("~{rest}");
        }
    }
    path_str
}

#[tauri::command]
fn get_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(shorten_home_path(dir))
}

#[tauri::command]
async fn check_ollama(app: tauri::AppHandle) -> Result<OllamaStatus, String> {
    let settings = db::get_settings(&app).await?;
    if !integrations::is_local_ai_enabled(&settings) {
        return Ok(OllamaStatus {
            available: false,
            models: vec![],
        });
    }
    let (available, models) = agent::check_ollama(&settings.ollama_endpoint).await?;
    Ok(OllamaStatus { available, models })
}

#[tauri::command]
async fn run_local_ai(
    app: tauri::AppHandle,
    action: String,
    text: String,
) -> Result<String, String> {
    agent::run_local_ai_action(&app, &action, &text).await
}

#[tauri::command]
async fn run_agent(
    app: tauri::AppHandle,
    prompt: String,
    history: Vec<AgentMessage>,
) -> Result<Vec<AgentMessage>, String> {
    agent::run_agent(&app, &prompt, history).await
}

#[tauri::command]
async fn run_setup_assistant(
    app: tauri::AppHandle,
    integration_title: String,
    guide_context: String,
    prompt: String,
    history: Vec<AgentMessage>,
) -> Result<String, String> {
    agent::run_setup_assistant(
        &app,
        &integration_title,
        &guide_context,
        &prompt,
        history,
    )
    .await
}

#[tauri::command]
async fn jira_get_issue(app: tauri::AppHandle, key: String) -> Result<JiraIssue, String> {
    let settings = db::get_settings(&app).await?;
    integrations::require_jira(&settings)?;
    jira::get_issue(&key).await
}

#[tauri::command]
async fn jira_my_issues(app: tauri::AppHandle) -> Result<Vec<JiraIssue>, String> {
    let settings = db::get_settings(&app).await?;
    integrations::require_jira(&settings)?;
    let jql = jira::resolve_my_issues_jql(
        &settings.jira_my_issues_jql,
        &settings.default_jira_project_key,
    );
    jira::my_sidebar_issues(&jql, false).await
}

#[tauri::command]
async fn jira_search(app: tauri::AppHandle, query: String) -> Result<JiraSearchResponse, String> {
    let settings = db::get_settings(&app).await?;
    integrations::require_jira(&settings)?;
    jira::search_issues(&query, &settings).await
}

#[tauri::command]
async fn jira_search_users(app: tauri::AppHandle, query: String) -> Result<Vec<JiraUser>, String> {
    let settings = db::get_settings(&app).await?;
    integrations::require_jira(&settings)?;
    jira::search_users(&query).await
}

#[tauri::command]
async fn jira_list_sprints(
    app: tauri::AppHandle,
    project_key: String,
) -> Result<Vec<JiraSprint>, String> {
    let settings = db::get_settings(&app).await?;
    integrations::require_jira(&settings)?;
    jira::list_sprints(&project_key).await
}

#[tauri::command]
async fn jira_create_issue(
    app: tauri::AppHandle,
    req: JiraCreateRequest,
) -> Result<JiraIssue, String> {
    let settings = db::get_settings(&app).await?;
    integrations::require_jira(&settings)?;
    jira::create_issue(&req).await
}

fn jira_priority_to_int(name: Option<&str>) -> i32 {
    match name.map(|s| s.to_lowercase()).as_deref() {
        Some("highest") | Some("blocker") => 1,
        Some("high") => 2,
        Some("medium") => 3,
        _ => 4,
    }
}

#[tauri::command]
async fn jira_sync_tasks(app: tauri::AppHandle) -> Result<Vec<Task>, String> {
    let settings = db::get_settings(&app).await?;
    integrations::require_jira(&settings)?;
    let jql = jira::resolve_my_issues_jql(
        &settings.jira_my_issues_jql,
        &settings.default_jira_project_key,
    );
    let issues = jira::my_sidebar_issues(&jql, true).await?;
    let synced_keys: HashSet<String> = issues.iter().map(|i| i.key.clone()).collect();
    let existing = db::list_tasks(&app).await?;
    let mut synced = Vec::new();

    for issue in issues {
        let description = match &issue.issue_type {
            Some(t) => format!("{} · {}", issue.status, t),
            None => issue.status.clone(),
        };
        let priority = jira_priority_to_int(issue.priority.as_deref());

        if let Some(task) = existing.iter().find(|t| t.jira_key.as_deref() == Some(&issue.key)) {
            let updated = db::update_task(
                &app,
                &task.id,
                json!({
                    "title": issue.summary,
                    "description": description,
                    "priority": priority,
                    "jira_key": issue.key,
                    "jira_url": issue.url,
                }),
            )
            .await?;
            synced.push(updated);
        } else {
            let now = chrono::Utc::now().to_rfc3339();
            let task = Task {
                id: uuid::Uuid::new_v4().to_string(),
                title: issue.summary,
                description: Some(description),
                due_date: None,
                priority,
                completed: false,
                source: "jira".into(),
                jira_key: Some(issue.key),
                jira_url: Some(issue.url),
                created_at: now.clone(),
                updated_at: now,
            };
            synced.push(db::create_task(&app, task).await?);
        }
    }

    for task in &existing {
        if task.source != "jira" || task.completed {
            continue;
        }
        if let Some(key) = &task.jira_key {
            if !synced_keys.contains(key) {
                db::delete_task(&app, &task.id).await?;
            }
        }
    }

    Ok(synced)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:betternotes.db", db::migrations())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            list_tasks,
            create_task,
            update_task,
            delete_task,
            list_folders,
            create_folder,
            update_folder,
            delete_folder,
            list_notes,
            list_tags,
            get_note,
            create_note,
            update_note,
            delete_note,
            duplicate_note,
            move_note,
            update_note_meta,
            lock_note,
            unlock_note,
            get_settings,
            save_settings,
            get_data_dir,
            save_jira_credentials,
            get_jira_credentials,
            delete_jira_credentials,
            get_mcp_config,
            save_mcp_config,
            check_ollama,
            run_local_ai,
            run_agent,
            run_setup_assistant,
            jira_get_issue,
            jira_my_issues,
            jira_search,
            jira_search_users,
            jira_list_sprints,
            jira_create_issue,
            jira_sync_tasks,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
