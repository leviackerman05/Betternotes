use crate::models::{AppSettings, Folder, Note, Task};
use serde_json::Value;
use tauri::{AppHandle, Manager};
use tauri_plugin_sql::{Migration, MigrationKind};

pub fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "create_initial_tables",
        sql: r#"
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                due_date TEXT,
                priority INTEGER NOT NULL DEFAULT 4,
                completed INTEGER NOT NULL DEFAULT 0,
                source TEXT NOT NULL DEFAULT 'manual',
                jira_key TEXT,
                jira_url TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS folders (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY,
                folder_id TEXT,
                title TEXT NOT NULL DEFAULT 'Untitled',
                content TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
        "#,
        kind: MigrationKind::Up,
    }]
}

fn now() -> String {
    chrono::Utc::now().to_rfc3339()
}

const DB_URL: &str = "sqlite:betternotes.db";

async fn sqlite_pool(app: &AppHandle) -> Result<sqlx::Pool<sqlx::Sqlite>, String> {
    use tauri_plugin_sql::{DbInstances, DbPool};
    let instances = app.state::<DbInstances>();
    let guard = instances.0.read().await;
    match guard.get(DB_URL) {
        Some(DbPool::Sqlite(pool)) => Ok(pool.clone()),
        None => Err(format!("Database {DB_URL} is not loaded")),
    }
}

fn bind_params<'q>(
    mut query: sqlx::query::Query<'q, sqlx::Sqlite, sqlx::sqlite::SqliteArguments<'q>>,
    params: Vec<Value>,
) -> sqlx::query::Query<'q, sqlx::Sqlite, sqlx::sqlite::SqliteArguments<'q>> {
    for value in params {
        query = if value.is_null() {
            query.bind(None::<Value>)
        } else if let Some(s) = value.as_str() {
            query.bind(s.to_owned())
        } else if let Some(n) = value.as_number() {
            query.bind(n.as_f64().unwrap_or_default())
        } else {
            query.bind(value)
        };
    }
    query
}

fn row_to_json(row: &sqlx::sqlite::SqliteRow) -> Value {
    use serde_json::Map;
    use sqlx::Row;
    use sqlx::Column;
    let mut map = Map::new();
    for (i, col) in row.columns().iter().enumerate() {
        let v = if let Ok(v) = row.try_get::<Option<i64>, _>(i) {
            v.map(|n| Value::Number(n.into())).unwrap_or(Value::Null)
        } else if let Ok(v) = row.try_get::<Option<f64>, _>(i) {
            serde_json::Number::from_f64(v.unwrap_or(0.0))
                .map(Value::Number)
                .unwrap_or(Value::Null)
        } else if let Ok(v) = row.try_get::<Option<String>, _>(i) {
            v.map(Value::String).unwrap_or(Value::Null)
        } else {
            Value::Null
        };
        map.insert(col.name().to_string(), v);
    }
    Value::Object(map)
}

async fn query_rows(app: &AppHandle, sql: &str, params: Vec<Value>) -> Result<Vec<Value>, String> {
    let pool = sqlite_pool(app).await?;
    let query = bind_params(sqlx::query(sql), params);
    let rows = query.fetch_all(&pool).await.map_err(|e| e.to_string())?;
    Ok(rows.iter().map(row_to_json).collect())
}

async fn execute(app: &AppHandle, sql: &str, params: Vec<Value>) -> Result<(), String> {
    let pool = sqlite_pool(app).await?;
    let query = bind_params(sqlx::query(sql), params);
    query.execute(&pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

fn row_to_task(row: &Value) -> Task {
    let obj = row.as_object().unwrap();
    Task {
        id: obj["id"].as_str().unwrap().to_string(),
        title: obj["title"].as_str().unwrap().to_string(),
        description: obj.get("description").and_then(|v| v.as_str()).map(String::from),
        due_date: obj.get("due_date").and_then(|v| v.as_str()).map(String::from),
        priority: obj["priority"].as_i64().unwrap_or(4) as i32,
        completed: obj["completed"].as_i64().unwrap_or(0) != 0,
        source: obj["source"].as_str().unwrap_or("manual").to_string(),
        jira_key: obj.get("jira_key").and_then(|v| v.as_str()).map(String::from),
        jira_url: obj.get("jira_url").and_then(|v| v.as_str()).map(String::from),
        created_at: obj["created_at"].as_str().unwrap().to_string(),
        updated_at: obj["updated_at"].as_str().unwrap().to_string(),
    }
}

pub async fn list_tasks(app: &AppHandle) -> Result<Vec<Task>, String> {
    let rows = query_rows(
        app,
        "SELECT * FROM tasks ORDER BY completed ASC, priority ASC, created_at DESC",
        vec![],
    )
    .await?;
    Ok(rows.iter().map(row_to_task).collect())
}

pub async fn create_task(app: &AppHandle, task: Task) -> Result<Task, String> {
    execute(
        app,
        "INSERT INTO tasks (id, title, description, due_date, priority, completed, source, jira_key, jira_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        vec![
            Value::String(task.id.clone()),
            Value::String(task.title.clone()),
            task.description.as_ref().map(|s| Value::String(s.clone())).unwrap_or(Value::Null),
            task.due_date.as_ref().map(|s| Value::String(s.clone())).unwrap_or(Value::Null),
            Value::Number(task.priority.into()),
            Value::Number((task.completed as i64).into()),
            Value::String(task.source.clone()),
            task.jira_key.as_ref().map(|s| Value::String(s.clone())).unwrap_or(Value::Null),
            task.jira_url.as_ref().map(|s| Value::String(s.clone())).unwrap_or(Value::Null),
            Value::String(task.created_at.clone()),
            Value::String(task.updated_at.clone()),
        ],
    )
    .await?;
    Ok(task)
}

pub async fn update_task(app: &AppHandle, id: &str, updates: serde_json::Value) -> Result<Task, String> {
    let rows = query_rows(app, "SELECT * FROM tasks WHERE id = ?", vec![Value::String(id.to_string())]).await?;
    if rows.is_empty() {
        return Err("Task not found".into());
    }
    let mut task = row_to_task(&rows[0]);
    if let Some(title) = updates.get("title").and_then(|v| v.as_str()) {
        task.title = title.to_string();
    }
    if let Some(completed) = updates.get("completed").and_then(|v| v.as_bool()) {
        task.completed = completed;
    }
    if let Some(priority) = updates.get("priority").and_then(|v| v.as_i64()) {
        task.priority = priority as i32;
    }
    if let Some(due) = updates.get("due_date") {
        task.due_date = due.as_str().map(String::from);
    }
    task.updated_at = now();
    execute(
        app,
        "UPDATE tasks SET title=?, completed=?, priority=?, due_date=?, updated_at=? WHERE id=?",
        vec![
            Value::String(task.title.clone()),
            Value::Number((task.completed as i64).into()),
            Value::Number(task.priority.into()),
            task.due_date.as_ref().map(|s| Value::String(s.clone())).unwrap_or(Value::Null),
            Value::String(task.updated_at.clone()),
            Value::String(id.to_string()),
        ],
    )
    .await?;
    Ok(task)
}

pub async fn delete_task(app: &AppHandle, id: &str) -> Result<(), String> {
    execute(app, "DELETE FROM tasks WHERE id = ?", vec![Value::String(id.to_string())]).await
}

pub async fn list_folders(app: &AppHandle) -> Result<Vec<Folder>, String> {
    let rows = query_rows(app, "SELECT * FROM folders ORDER BY name ASC", vec![]).await?;
    Ok(rows
        .iter()
        .map(|row| {
            let obj = row.as_object().unwrap();
            Folder {
                id: obj["id"].as_str().unwrap().to_string(),
                name: obj["name"].as_str().unwrap().to_string(),
                created_at: obj["created_at"].as_str().unwrap().to_string(),
            }
        })
        .collect())
}

pub async fn create_folder(app: &AppHandle, name: &str) -> Result<Folder, String> {
    let folder = Folder {
        id: uuid::Uuid::new_v4().to_string(),
        name: name.to_string(),
        created_at: now(),
    };
    execute(
        app,
        "INSERT INTO folders (id, name, created_at) VALUES (?, ?, ?)",
        vec![
            Value::String(folder.id.clone()),
            Value::String(folder.name.clone()),
            Value::String(folder.created_at.clone()),
        ],
    )
    .await?;
    Ok(folder)
}

pub async fn delete_folder(app: &AppHandle, id: &str) -> Result<(), String> {
    execute(app, "UPDATE notes SET folder_id = NULL WHERE folder_id = ?", vec![Value::String(id.to_string())]).await?;
    execute(app, "DELETE FROM folders WHERE id = ?", vec![Value::String(id.to_string())]).await
}

pub async fn list_notes(app: &AppHandle, folder_id: Option<&str>) -> Result<Vec<Note>, String> {
    let (sql, params) = match folder_id {
        Some(fid) => (
            "SELECT * FROM notes WHERE folder_id = ? ORDER BY updated_at DESC",
            vec![Value::String(fid.to_string())],
        ),
        None => ("SELECT * FROM notes ORDER BY updated_at DESC", vec![]),
    };
    let rows = query_rows(app, sql, params).await?;
    Ok(rows
        .iter()
        .map(|row| {
            let obj = row.as_object().unwrap();
            Note {
                id: obj["id"].as_str().unwrap().to_string(),
                folder_id: obj.get("folder_id").and_then(|v| v.as_str()).map(String::from),
                title: obj["title"].as_str().unwrap().to_string(),
                content: obj["content"].as_str().unwrap_or("").to_string(),
                created_at: obj["created_at"].as_str().unwrap().to_string(),
                updated_at: obj["updated_at"].as_str().unwrap().to_string(),
            }
        })
        .collect())
}

pub async fn get_note(app: &AppHandle, id: &str) -> Result<Note, String> {
    let rows = query_rows(app, "SELECT * FROM notes WHERE id = ?", vec![Value::String(id.to_string())]).await?;
    if rows.is_empty() {
        return Err("Note not found".into());
    }
    let obj = rows[0].as_object().unwrap();
    Ok(Note {
        id: obj["id"].as_str().unwrap().to_string(),
        folder_id: obj.get("folder_id").and_then(|v| v.as_str()).map(String::from),
        title: obj["title"].as_str().unwrap().to_string(),
        content: obj["content"].as_str().unwrap_or("").to_string(),
        created_at: obj["created_at"].as_str().unwrap().to_string(),
        updated_at: obj["updated_at"].as_str().unwrap().to_string(),
    })
}

pub async fn create_note(app: &AppHandle, title: &str, folder_id: Option<&str>) -> Result<Note, String> {
    let ts = now();
    let note = Note {
        id: uuid::Uuid::new_v4().to_string(),
        folder_id: folder_id.map(String::from),
        title: title.to_string(),
        content: String::new(),
        created_at: ts.clone(),
        updated_at: ts,
    };
    execute(
        app,
        "INSERT INTO notes (id, folder_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        vec![
            Value::String(note.id.clone()),
            note.folder_id.as_ref().map(|s| Value::String(s.clone())).unwrap_or(Value::Null),
            Value::String(note.title.clone()),
            Value::String(note.content.clone()),
            Value::String(note.created_at.clone()),
            Value::String(note.updated_at.clone()),
        ],
    )
    .await?;
    Ok(note)
}

pub async fn update_note(app: &AppHandle, id: &str, title: &str, content: &str) -> Result<Note, String> {
    let ts = now();
    execute(
        app,
        "UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ?",
        vec![
            Value::String(title.to_string()),
            Value::String(content.to_string()),
            Value::String(ts.clone()),
            Value::String(id.to_string()),
        ],
    )
    .await?;
    get_note(app, id).await
}

pub async fn delete_note(app: &AppHandle, id: &str) -> Result<(), String> {
    execute(app, "DELETE FROM notes WHERE id = ?", vec![Value::String(id.to_string())]).await
}

pub async fn get_settings(app: &AppHandle) -> Result<AppSettings, String> {
    let rows = query_rows(app, "SELECT value FROM settings WHERE key = 'app'", vec![]).await?;
    if rows.is_empty() {
        return Ok(AppSettings {
            theme: "light".into(),
            ollama_endpoint: "http://localhost:11434".into(),
            ollama_model: "qwen2.5:7b".into(),
        });
    }
    serde_json::from_str(rows[0].as_object().unwrap()["value"].as_str().unwrap())
        .map_err(|e| e.to_string())
}

pub async fn save_settings(app: &AppHandle, settings: &AppSettings) -> Result<(), String> {
    let json = serde_json::to_string(settings).map_err(|e| e.to_string())?;
    execute(
        app,
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('app', ?)",
        vec![Value::String(json)],
    )
    .await
}
