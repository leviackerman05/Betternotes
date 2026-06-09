use crate::models::{AppSettings, Folder, Note, Tag, Task};
use crate::note_crypto;
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
    },
    Migration {
        version: 2,
        description: "default_workspace_and_orphan_notes",
        sql: r#"
            INSERT INTO folders (id, name, created_at)
            SELECT 'ws-default', 'My Notes', strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
            WHERE NOT EXISTS (SELECT 1 FROM folders);

            UPDATE notes
            SET folder_id = (SELECT id FROM folders ORDER BY created_at ASC LIMIT 1)
            WHERE folder_id IS NULL;
        "#,
        kind: MigrationKind::Up,
    },
    Migration {
        version: 3,
        description: "note_metadata_columns",
        sql: r#"
            ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
            ALTER TABLE notes ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;
            ALTER TABLE notes ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
            ALTER TABLE notes ADD COLUMN locked INTEGER NOT NULL DEFAULT 0;
        "#,
        kind: MigrationKind::Up,
    },
    Migration {
        version: 4,
        description: "note_password_lock_columns",
        sql: r#"
            ALTER TABLE notes ADD COLUMN lock_salt TEXT;
            ALTER TABLE notes ADD COLUMN lock_hash TEXT;
        "#,
        kind: MigrationKind::Up,
    },
    Migration {
        version: 5,
        description: "note_colors_reminders_tags",
        sql: r#"
            ALTER TABLE notes ADD COLUMN color TEXT;
            ALTER TABLE notes ADD COLUMN reminder_at TEXT;
            ALTER TABLE notes ADD COLUMN reminder_repeat TEXT DEFAULT 'never';
            CREATE TABLE IF NOT EXISTS tags (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE COLLATE NOCASE,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS note_tags (
                note_id TEXT NOT NULL,
                tag_id TEXT NOT NULL,
                PRIMARY KEY (note_id, tag_id),
                FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            );
        "#,
        kind: MigrationKind::Up,
    }]
}

fn parse_tags(obj: &serde_json::Map<String, Value>) -> Vec<String> {
    obj.get("tag_list")
        .and_then(|v| v.as_str())
        .map(|s| {
            s.split(',')
                .map(|t| t.trim().to_string())
                .filter(|t| !t.is_empty())
                .collect()
        })
        .unwrap_or_default()
}

fn row_to_note(obj: &serde_json::Map<String, Value>) -> Note {
    let locked = obj["locked"].as_i64().unwrap_or(0) != 0;
    let content = if locked {
        String::new()
    } else {
        obj["content"].as_str().unwrap_or("").to_string()
    };
    Note {
        id: obj["id"].as_str().unwrap().to_string(),
        folder_id: obj.get("folder_id").and_then(|v| v.as_str()).map(String::from),
        title: obj["title"].as_str().unwrap().to_string(),
        content,
        created_at: obj["created_at"].as_str().unwrap().to_string(),
        updated_at: obj["updated_at"].as_str().unwrap().to_string(),
        pinned: obj["pinned"].as_i64().unwrap_or(0) != 0,
        favorite: obj["favorite"].as_i64().unwrap_or(0) != 0,
        archived: obj["archived"].as_i64().unwrap_or(0) != 0,
        locked,
        color: obj.get("color").and_then(|v| v.as_str()).map(String::from),
        reminder_at: obj.get("reminder_at").and_then(|v| v.as_str()).map(String::from),
        reminder_repeat: obj
            .get("reminder_repeat")
            .and_then(|v| v.as_str())
            .map(String::from),
        tags: parse_tags(obj),
    }
}

const NOTE_SELECT: &str = r#"
    SELECT n.*, GROUP_CONCAT(t.name) AS tag_list
    FROM notes n
    LEFT JOIN note_tags nt ON n.id = nt.note_id
    LEFT JOIN tags t ON t.id = nt.tag_id
"#;

pub async fn set_note_tags(app: &AppHandle, note_id: &str, tag_names: &[String]) -> Result<(), String> {
    execute(
        app,
        "DELETE FROM note_tags WHERE note_id = ?",
        vec![Value::String(note_id.to_string())],
    )
    .await?;
    for name in tag_names {
        let trimmed = name.trim();
        if trimmed.is_empty() {
            continue;
        }
        let existing = query_rows(
            app,
            "SELECT id FROM tags WHERE name = ? COLLATE NOCASE",
            vec![Value::String(trimmed.to_string())],
        )
        .await?;
        let tag_id = if let Some(row) = existing.first() {
            row.as_object().unwrap()["id"].as_str().unwrap().to_string()
        } else {
            let id = uuid::Uuid::new_v4().to_string();
            let ts = now();
            execute(
                app,
                "INSERT INTO tags (id, name, created_at) VALUES (?, ?, ?)",
                vec![
                    Value::String(id.clone()),
                    Value::String(trimmed.to_string()),
                    Value::String(ts),
                ],
            )
            .await?;
            id
        };
        execute(
            app,
            "INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)",
            vec![Value::String(note_id.to_string()), Value::String(tag_id)],
        )
        .await?;
    }
    Ok(())
}

pub async fn list_tags(app: &AppHandle) -> Result<Vec<Tag>, String> {
    let rows = query_rows(
        app,
        r#"SELECT t.id, t.name, t.created_at,
           (SELECT COUNT(*) FROM note_tags nt WHERE nt.tag_id = t.id) AS note_count
           FROM tags t ORDER BY t.name"#,
        vec![],
    )
    .await?;
    Ok(rows
        .iter()
        .map(|row| {
            let obj = row.as_object().unwrap();
            Tag {
                id: obj["id"].as_str().unwrap().to_string(),
                name: obj["name"].as_str().unwrap().to_string(),
                created_at: obj["created_at"].as_str().unwrap().to_string(),
                note_count: obj["note_count"].as_i64().unwrap_or(0) as i32,
            }
        })
        .collect())
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
    if updates.get("due_date").is_some() {
        task.due_date = updates
            .get("due_date")
            .and_then(|v| v.as_str())
            .map(String::from);
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
    let rows = query_rows(
        app,
        r#"
            SELECT f.id, f.name, f.created_at, COUNT(n.id) AS note_count
            FROM folders f
            LEFT JOIN notes n ON n.folder_id = f.id
            GROUP BY f.id
            ORDER BY f.created_at ASC
        "#,
        vec![],
    )
    .await?;
    Ok(rows
        .iter()
        .map(|row| {
            let obj = row.as_object().unwrap();
            Folder {
                id: obj["id"].as_str().unwrap().to_string(),
                name: obj["name"].as_str().unwrap().to_string(),
                created_at: obj["created_at"].as_str().unwrap().to_string(),
                note_count: obj["note_count"].as_i64().unwrap_or(0) as i32,
            }
        })
        .collect())
}

pub async fn create_folder(app: &AppHandle, name: &str) -> Result<Folder, String> {
    let folder = Folder {
        id: uuid::Uuid::new_v4().to_string(),
        name: name.to_string(),
        created_at: now(),
        note_count: 0,
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

pub async fn update_folder(app: &AppHandle, id: &str, name: &str) -> Result<Folder, String> {
    execute(
        app,
        "UPDATE folders SET name = ? WHERE id = ?",
        vec![Value::String(name.to_string()), Value::String(id.to_string())],
    )
    .await?;
    let rows = query_rows(app, "SELECT * FROM folders WHERE id = ?", vec![Value::String(id.to_string())]).await?;
    if rows.is_empty() {
        return Err("Folder not found".into());
    }
    let obj = rows[0].as_object().unwrap();
    Ok(Folder {
        id: obj["id"].as_str().unwrap().to_string(),
        name: obj["name"].as_str().unwrap().to_string(),
        created_at: obj["created_at"].as_str().unwrap().to_string(),
        note_count: 0,
    })
}

pub async fn delete_folder(app: &AppHandle, id: &str) -> Result<(), String> {
    let folders = list_folders(app).await?;
    if folders.len() <= 1 {
        return Err("Cannot delete the last workspace".into());
    }
    let target = folders
        .iter()
        .find(|f| f.id != id)
        .map(|f| f.id.clone())
        .ok_or("No target workspace found")?;
    execute(
        app,
        "UPDATE notes SET folder_id = ? WHERE folder_id = ?",
        vec![Value::String(target), Value::String(id.to_string())],
    )
    .await?;
    execute(app, "DELETE FROM folders WHERE id = ?", vec![Value::String(id.to_string())]).await
}

pub async fn list_notes(
    app: &AppHandle,
    folder_id: Option<&str>,
    favorite_only: bool,
    reminder_only: bool,
    tag_id: Option<&str>,
) -> Result<Vec<Note>, String> {
    let mut sql = format!("{NOTE_SELECT} WHERE 1=1");
    let mut params: Vec<Value> = vec![];

    if let Some(fid) = folder_id {
        sql.push_str(" AND n.folder_id = ?");
        params.push(Value::String(fid.to_string()));
    }
    if favorite_only {
        sql.push_str(" AND n.favorite = 1");
    }
    if reminder_only {
        sql.push_str(" AND n.reminder_at IS NOT NULL AND n.reminder_at != ''");
    }
    if let Some(tid) = tag_id {
        sql.push_str(" AND n.id IN (SELECT note_id FROM note_tags WHERE tag_id = ?)");
        params.push(Value::String(tid.to_string()));
    }

    sql.push_str(" GROUP BY n.id ORDER BY n.pinned DESC, n.favorite DESC, n.updated_at DESC");

    let rows = query_rows(app, &sql, params).await?;
    Ok(rows
        .iter()
        .map(|row| row_to_note(row.as_object().unwrap()))
        .collect())
}

pub async fn get_note(app: &AppHandle, id: &str) -> Result<Note, String> {
    let sql = format!("{NOTE_SELECT} WHERE n.id = ? GROUP BY n.id");
    let rows = query_rows(app, &sql, vec![Value::String(id.to_string())]).await?;
    if rows.is_empty() {
        return Err("Note not found".into());
    }
    Ok(row_to_note(rows[0].as_object().unwrap()))
}

pub async fn create_note(app: &AppHandle, title: &str, folder_id: Option<&str>) -> Result<Note, String> {
    let ts = now();
    let id = uuid::Uuid::new_v4().to_string();
    execute(
        app,
        "INSERT INTO notes (id, folder_id, title, content, created_at, updated_at, pinned, favorite, archived, locked, reminder_repeat) VALUES (?, ?, ?, '', ?, ?, 0, 0, 0, 0, 'never')",
        vec![
            Value::String(id.clone()),
            folder_id.map(|s| Value::String(s.to_string())).unwrap_or(Value::Null),
            Value::String(title.to_string()),
            Value::String(ts.clone()),
            Value::String(ts),
        ],
    )
    .await?;
    get_note(app, &id).await
}

pub async fn duplicate_note(app: &AppHandle, id: &str, folder_id: Option<&str>) -> Result<Note, String> {
    let rows = query_rows(app, "SELECT locked, content FROM notes WHERE id = ?", vec![Value::String(id.to_string())]).await?;
    if rows.is_empty() {
        return Err("Note not found".into());
    }
    let obj = rows[0].as_object().unwrap();
    if obj["locked"].as_i64().unwrap_or(0) != 0 {
        return Err("Unlock the note before duplicating".into());
    }
    let source = get_note(app, id).await?;
    let full_content = obj["content"].as_str().unwrap_or("").to_string();
    let ts = now();
    let title = if source.title.ends_with(" copy") || source.title.contains(" copy ") {
        format!("{} (copy)", source.title)
    } else {
        format!("{} copy", source.title)
    };
    let target_folder = folder_id
        .map(String::from)
        .or(source.folder_id.clone());
    let note = Note {
        id: uuid::Uuid::new_v4().to_string(),
        folder_id: target_folder,
        title,
        content: full_content,
        created_at: ts.clone(),
        updated_at: ts,
        pinned: false,
        favorite: false,
        archived: false,
        locked: false,
        color: source.color.clone(),
        reminder_at: None,
        reminder_repeat: Some("never".into()),
        tags: source.tags.clone(),
    };
    execute(
        app,
        "INSERT INTO notes (id, folder_id, title, content, created_at, updated_at, pinned, favorite, archived, locked, color, reminder_repeat) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?, 'never')",
        vec![
            Value::String(note.id.clone()),
            note.folder_id.as_ref().map(|s| Value::String(s.clone())).unwrap_or(Value::Null),
            Value::String(note.title.clone()),
            Value::String(note.content.clone()),
            Value::String(note.created_at.clone()),
            Value::String(note.updated_at.clone()),
            note.color.as_ref().map(|s| Value::String(s.clone())).unwrap_or(Value::Null),
        ],
    )
    .await?;
    if !source.tags.is_empty() {
        set_note_tags(app, &note.id, &source.tags).await?;
    }
    get_note(app, &note.id).await
}

pub async fn move_note(app: &AppHandle, id: &str, folder_id: &str) -> Result<Note, String> {
    execute(
        app,
        "UPDATE notes SET folder_id = ?, updated_at = ? WHERE id = ?",
        vec![
            Value::String(folder_id.to_string()),
            Value::String(now()),
            Value::String(id.to_string()),
        ],
    )
    .await?;
    get_note(app, id).await
}

pub async fn update_note_meta(app: &AppHandle, id: &str, updates: Value) -> Result<Note, String> {
    let note = get_note(app, id).await?;
    let obj = updates.as_object().ok_or("Invalid updates")?;

    let title = obj.get("title").and_then(|v| v.as_str()).unwrap_or(&note.title);
    let pinned = obj
        .get("pinned")
        .and_then(|v| v.as_bool())
        .unwrap_or(note.pinned);
    let favorite = obj
        .get("favorite")
        .and_then(|v| v.as_bool())
        .unwrap_or(note.favorite);
    let archived = obj
        .get("archived")
        .and_then(|v| v.as_bool())
        .unwrap_or(note.archived);
    let locked = note.locked;
    let folder_id = if let Some(fid) = obj.get("folder_id") {
        fid.as_str().map(String::from)
    } else {
        note.folder_id.clone()
    };
    let color = if obj.contains_key("color") {
        obj.get("color").and_then(|v| v.as_str()).map(String::from)
    } else {
        note.color.clone()
    };
    let reminder_at = if obj.contains_key("reminder_at") {
        obj.get("reminder_at").and_then(|v| v.as_str()).map(String::from)
    } else {
        note.reminder_at.clone()
    };
    let reminder_repeat = if obj.contains_key("reminder_repeat") {
        obj
            .get("reminder_repeat")
            .and_then(|v| v.as_str())
            .map(String::from)
    } else {
        note.reminder_repeat.clone()
    };

    execute(
        app,
        "UPDATE notes SET title = ?, pinned = ?, favorite = ?, archived = ?, locked = ?, folder_id = ?, color = ?, reminder_at = ?, reminder_repeat = ?, updated_at = ? WHERE id = ?",
        vec![
            Value::String(title.to_string()),
            Value::Number((pinned as i64).into()),
            Value::Number((favorite as i64).into()),
            Value::Number((archived as i64).into()),
            Value::Number((locked as i64).into()),
            folder_id.as_ref().map(|s| Value::String(s.clone())).unwrap_or(Value::Null),
            color.as_ref().map(|s| Value::String(s.clone())).unwrap_or(Value::Null),
            reminder_at.as_ref().map(|s| Value::String(s.clone())).unwrap_or(Value::Null),
            reminder_repeat
                .as_ref()
                .map(|s| Value::String(s.clone()))
                .unwrap_or(Value::String("never".into())),
            Value::String(now()),
            Value::String(id.to_string()),
        ],
    )
    .await?;

    if let Some(tags_val) = obj.get("tags") {
        if let Some(arr) = tags_val.as_array() {
            let names: Vec<String> = arr
                .iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect();
            set_note_tags(app, id, &names).await?;
        }
    }

    get_note(app, id).await
}

pub async fn lock_note(app: &AppHandle, id: &str, password: &str) -> Result<Note, String> {
    if password.len() < 4 {
        return Err("Password must be at least 4 characters".into());
    }
    let rows = query_rows(app, "SELECT * FROM notes WHERE id = ?", vec![Value::String(id.to_string())]).await?;
    if rows.is_empty() {
        return Err("Note not found".into());
    }
    let obj = rows[0].as_object().unwrap();
    if obj["locked"].as_i64().unwrap_or(0) != 0 {
        return Err("Note is already locked".into());
    }
    let plaintext = obj["content"].as_str().unwrap_or("").to_string();
    let salt = note_crypto::generate_salt();
    let hash = note_crypto::hash_password(password, &salt);
    let encrypted = note_crypto::encrypt_content(&plaintext, password, &salt)?;
    execute(
        app,
        "UPDATE notes SET content = ?, locked = 1, lock_salt = ?, lock_hash = ?, updated_at = ? WHERE id = ?",
        vec![
            Value::String(encrypted),
            Value::String(note_crypto::base64_salt(&salt)),
            Value::String(hash),
            Value::String(now()),
            Value::String(id.to_string()),
        ],
    )
    .await?;
    get_note(app, id).await
}

pub async fn unlock_note(app: &AppHandle, id: &str, password: &str) -> Result<Note, String> {
    let rows = query_rows(app, "SELECT * FROM notes WHERE id = ?", vec![Value::String(id.to_string())]).await?;
    if rows.is_empty() {
        return Err("Note not found".into());
    }
    let obj = rows[0].as_object().unwrap();
    if obj["locked"].as_i64().unwrap_or(0) == 0 {
        return Err("Note is not locked".into());
    }
    let salt_b64 = obj
        .get("lock_salt")
        .and_then(|v| v.as_str())
        .ok_or("Missing lock salt")?;
    let hash = obj
        .get("lock_hash")
        .and_then(|v| v.as_str())
        .ok_or("Missing lock hash")?;
    let encrypted = obj["content"].as_str().unwrap_or("");
    let salt = note_crypto::decode_salt(salt_b64)?;
    if !note_crypto::verify_password(password, &salt, hash) {
        return Err("Incorrect password".into());
    }
    let plaintext = note_crypto::decrypt_content(encrypted, password, &salt)?;
    execute(
        app,
        "UPDATE notes SET content = ?, locked = 0, lock_salt = NULL, lock_hash = NULL, updated_at = ? WHERE id = ?",
        vec![
            Value::String(plaintext),
            Value::String(now()),
            Value::String(id.to_string()),
        ],
    )
    .await?;
    get_note(app, id).await
}

pub async fn update_note(app: &AppHandle, id: &str, title: &str, content: &str) -> Result<Note, String> {
    let rows = query_rows(app, "SELECT locked FROM notes WHERE id = ?", vec![Value::String(id.to_string())]).await?;
    if rows.is_empty() {
        return Err("Note not found".into());
    }
    if rows[0].as_object().unwrap()["locked"].as_i64().unwrap_or(0) != 0 {
        return Err("Note is locked".into());
    }
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
            sidebar_collapsed: false,
            local_only_mode: true,
            local_ai_enabled: false,
            mcp_enabled: false,
            jira_enabled: false,
            github_enabled: false,
            linear_enabled: false,
            default_jira_project_key: String::new(),
            jira_section_title: "My issues".into(),
            jira_my_issues_jql: String::new(),
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
