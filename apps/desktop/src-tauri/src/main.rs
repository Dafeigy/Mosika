#[tauri::command]
fn get_server_url() -> &'static str {
    "http://127.0.0.1:8765"
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_server_url])
        .run(tauri::generate_context!())
        .expect("failed to run Mousika desktop app");
}
