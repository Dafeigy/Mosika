#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
};
use tauri::Manager;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const SERVER_URL: &str = "http://127.0.0.1:8765";

struct ServerProcess(Mutex<Option<Child>>);

#[tauri::command]
fn get_server_url() -> &'static str {
    SERVER_URL
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
        .invoke_handler(tauri::generate_handler![get_server_url])
        .run(tauri::generate_context!())
        .expect("failed to run Mousika desktop app");
}
