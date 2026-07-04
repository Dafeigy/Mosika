#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    fs,
    io::{BufRead, BufReader, Write},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
};
use tauri::Manager;
use serde::{Deserialize, Serialize};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const SERVER_URL: &str = "http://127.0.0.1:8765";

struct ServerProcess(Mutex<Option<Child>>);

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectRecord {
    id: String,
    name: String,
    meta: String,
    folder_path: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectRegistry {
    projects: Vec<ProjectRecord>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConversationRecord {
    id: String,
    project_id: Option<String>,
    title: String,
    updated_at: String,
    task_id: String,
    state: String,
    status_label: String,
    user: String,
    prompt: String,
    metrics: Option<serde_json::Value>,
    plan: serde_json::Value,
    agent_message: String,
    tool_name: String,
    tool_args: String,
    review_rows: serde_json::Value,
    approval: Option<serde_json::Value>,
    context_chips: Vec<String>,
    items: Vec<serde_json::Value>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConversationIndex {
    conversations: Vec<serde_json::Value>,
}

#[tauri::command]
fn get_server_url() -> &'static str {
    SERVER_URL
}

fn mousika_app_data_dir() -> Result<PathBuf, String> {
    #[cfg(windows)]
    {
        let app_data = std::env::var_os("APPDATA").ok_or("APPDATA is not set")?;
        return Ok(PathBuf::from(app_data).join("Mousika"));
    }

    #[cfg(not(windows))]
    {
        let home = std::env::var_os("HOME").ok_or("HOME is not set")?;
        Ok(PathBuf::from(home).join(".mousika"))
    }
}

fn project_registry_path() -> Result<PathBuf, String> {
    Ok(mousika_app_data_dir()?.join("projects.json"))
}

fn conversations_dir() -> Result<PathBuf, String> {
    Ok(mousika_app_data_dir()?.join("conversations"))
}

fn conversation_index_path() -> Result<PathBuf, String> {
    Ok(conversations_dir()?.join("index.json"))
}

fn conversation_items_path(conversation_id: &str) -> Result<PathBuf, String> {
    Ok(conversations_dir()?.join(format!("{conversation_id}.jsonl")))
}

fn write_project_registry(projects: &[ProjectRecord]) -> Result<(), String> {
    let registry_path = project_registry_path()?;
    let registry_dir = registry_path
        .parent()
        .ok_or("project registry path has no parent")?;

    fs::create_dir_all(registry_dir).map_err(|err| err.to_string())?;

    let registry = ProjectRegistry {
        projects: projects.to_vec(),
    };
    let json = serde_json::to_string_pretty(&registry).map_err(|err| err.to_string())?;
    fs::write(registry_path, json).map_err(|err| err.to_string())
}

#[tauri::command]
fn load_project_registry(default_projects: Vec<ProjectRecord>) -> Result<Vec<ProjectRecord>, String> {
    let registry_path = project_registry_path()?;

    if !registry_path.exists() {
        write_project_registry(&default_projects)?;
        return Ok(default_projects);
    }

    let json = fs::read_to_string(registry_path).map_err(|err| err.to_string())?;
    let registry: ProjectRegistry = serde_json::from_str(&json).map_err(|err| err.to_string())?;
    write_project_registry(&registry.projects)?;
    Ok(registry.projects)
}

#[tauri::command]
fn save_project_registry(projects: Vec<ProjectRecord>) -> Result<(), String> {
    write_project_registry(&projects)
}

fn conversation_index_entry(conversation: &ConversationRecord) -> Result<serde_json::Value, String> {
    let mut value = serde_json::to_value(conversation).map_err(|err| err.to_string())?;
    if let Some(object) = value.as_object_mut() {
        object.remove("items");
    }
    Ok(value)
}

fn write_conversation_items(conversation: &ConversationRecord) -> Result<(), String> {
    let items_path = conversation_items_path(&conversation.id)?;
    let mut file = fs::File::create(items_path).map_err(|err| err.to_string())?;

    for item in &conversation.items {
        let line = serde_json::to_string(item).map_err(|err| err.to_string())?;
        writeln!(file, "{line}").map_err(|err| err.to_string())?;
    }

    Ok(())
}

fn read_conversation_items(conversation_id: &str) -> Result<Vec<serde_json::Value>, String> {
    let items_path = conversation_items_path(conversation_id)?;
    if !items_path.exists() {
        return Ok(Vec::new());
    }

    let file = fs::File::open(items_path).map_err(|err| err.to_string())?;
    let reader = BufReader::new(file);
    let mut items = Vec::new();

    for line in reader.lines() {
        let line = line.map_err(|err| err.to_string())?;
        if line.trim().is_empty() {
            continue;
        }
        let item = serde_json::from_str(&line).map_err(|err| err.to_string())?;
        items.push(item);
    }

    Ok(items)
}

fn write_conversation_store(conversations: &[ConversationRecord]) -> Result<(), String> {
    let dir = conversations_dir()?;
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;

    let mut index_entries = Vec::with_capacity(conversations.len());
    for conversation in conversations {
        write_conversation_items(conversation)?;
        index_entries.push(conversation_index_entry(conversation)?);
    }

    let index = ConversationIndex {
        conversations: index_entries,
    };
    let json = serde_json::to_string_pretty(&index).map_err(|err| err.to_string())?;
    fs::write(conversation_index_path()?, json).map_err(|err| err.to_string())
}

#[tauri::command]
fn load_conversation_store(
    default_conversations: Vec<ConversationRecord>,
) -> Result<Vec<ConversationRecord>, String> {
    let index_path = conversation_index_path()?;

    if !index_path.exists() {
        write_conversation_store(&default_conversations)?;
        return Ok(default_conversations);
    }

    let json = fs::read_to_string(index_path).map_err(|err| err.to_string())?;
    let index: ConversationIndex = serde_json::from_str(&json).map_err(|err| err.to_string())?;
    let mut conversations = Vec::with_capacity(index.conversations.len());

    for mut value in index.conversations {
        let conversation_id = value
            .get("id")
            .and_then(|id| id.as_str())
            .ok_or("conversation index entry missing id")?
            .to_string();
        let items = read_conversation_items(&conversation_id)?;

        if let Some(object) = value.as_object_mut() {
            object.insert("items".to_string(), serde_json::Value::Array(items));
        }

        let conversation = serde_json::from_value(value).map_err(|err| err.to_string())?;
        conversations.push(conversation);
    }

    Ok(conversations)
}

#[tauri::command]
fn save_conversation_store(conversations: Vec<ConversationRecord>) -> Result<(), String> {
    write_conversation_store(&conversations)
}

#[tauri::command]
fn open_path_in_explorer(path: String) -> Result<(), String> {
    let target = PathBuf::from(path);

    if !target.exists() {
        return Err(format!("path does not exist: {}", target.display()));
    }

    #[cfg(windows)]
    {
        let mut command = Command::new("explorer.exe");
        command.arg(target);
        command.creation_flags(0x08000000);
        command.spawn().map_err(|err| err.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(target)
            .spawn()
            .map_err(|err| err.to_string())?;
        return Ok(());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(target)
            .spawn()
            .map_err(|err| err.to_string())?;
        Ok(())
    }
}

fn packaged_server_path() -> Option<PathBuf> {
    if cfg!(debug_assertions) {
        return None;
    }

    let exe_path = std::env::current_exe().ok()?;
    let exe_dir = exe_path.parent()?;

    Some(exe_dir.join("mousika-server.exe"))
}

fn spawn_packaged_server() -> std::io::Result<Option<Child>> {
    let Some(server_path) = packaged_server_path() else {
        return Ok(None);
    };

    if !server_path.exists() {
        eprintln!("packaged server not found: {}", server_path.display());
        return Ok(None);
    }

    let mut command = Command::new(server_path);
    command.stdout(Stdio::null()).stderr(Stdio::null());

    #[cfg(windows)]
    command.creation_flags(0x08000000);

    command.spawn().map(Some)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(ServerProcess(Mutex::new(None)))
        .setup(|app| {
            if let Some(child) = spawn_packaged_server()? {
                let state = app.state::<ServerProcess>();
                *state.0.lock().expect("server process lock poisoned") = Some(child);
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let state = window.state::<ServerProcess>();
                let child = state
                    .0
                    .lock()
                    .expect("server process lock poisoned")
                    .take();

                if let Some(mut child) = child {
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_server_url,
            load_project_registry,
            save_project_registry,
            load_conversation_store,
            save_conversation_store,
            open_path_in_explorer
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Mousika desktop app");
}
