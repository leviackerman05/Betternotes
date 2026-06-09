mod agent;
mod db;
mod keychain;
mod mcp;
mod models;

use models::*;

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
async fn delete_folder(app: tauri::AppHandle, id: String) -> Result<(), String> {
    db::delete_folder(&app, &id).await
}

#[tauri::command]
async fn list_notes(app: tauri::AppHandle, folder_id: Option<String>) -> Result<Vec<Note>, String> {
    db::list_notes(&app, folder_id.as_deref()).await
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
fn get_mcp_config() -> Result<McpServerConfig, String> {
    keychain::get_mcp_config()
}

#[tauri::command]
fn save_mcp_config(config: McpServerConfig) -> Result<(), String> {
    keychain::save_mcp_config(&config)
}

#[tauri::command]
async fn check_ollama(app: tauri::AppHandle) -> Result<OllamaStatus, String> {
    let settings = db::get_settings(&app).await?;
    let (available, models) = agent::check_ollama(&settings.ollama_endpoint).await?;
    Ok(OllamaStatus { available, models })
}

#[tauri::command]
async fn run_agent(
    app: tauri::AppHandle,
    prompt: String,
    history: Vec<AgentMessage>,
) -> Result<Vec<AgentMessage>, String> {
    agent::run_agent(&app, &prompt, history).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
            delete_folder,
            list_notes,
            get_note,
            create_note,
            update_note,
            delete_note,
            get_settings,
            save_settings,
            save_jira_credentials,
            get_jira_credentials,
            delete_jira_credentials,
            get_mcp_config,
            save_mcp_config,
            check_ollama,
            run_agent,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
