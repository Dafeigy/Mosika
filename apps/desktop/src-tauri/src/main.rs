#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    fs,
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
    active: Option<bool>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectRegistry {
    projects: Vec<ProjectRecord>,
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
    Ok(registry.projects)
}

#[tauri::command]
fn save_project_registry(projects: Vec<ProjectRecord>) -> Result<(), String> {
    write_project_registry(&projects)
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
            open_path_in_explorer
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Mousika desktop app");
}
