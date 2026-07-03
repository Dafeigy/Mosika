import { invoke } from "@tauri-apps/api/core";

const fallbackApiBaseUrl = "http://127.0.0.1:8765";

export async function getApiBaseUrl(): Promise<string> {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  try {
    return await invoke<string>("get_server_url");
  } catch {
    return fallbackApiBaseUrl;
  }
}
