import { ref } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function useWindowControls() {
  const appWindow = getCurrentWindow();
  const sidebarCollapsed = ref(false);
  const windowMaximized = ref(false);

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }

  async function refreshWindowState() {
    try {
      windowMaximized.value = await appWindow.isMaximized();
    } catch (err) {
      console.warn("Unable to read window state", err);
    }
  }

  async function minimizeWindow() {
    try {
      await appWindow.minimize();
    } catch (err) {
      console.warn("Unable to minimize window", err);
    }
  }

  async function toggleMaximizeWindow() {
    try {
      await appWindow.toggleMaximize();
      await refreshWindowState();
    } catch (err) {
      console.warn("Unable to toggle window maximized state", err);
    }
  }

  async function closeWindow() {
    try {
      await appWindow.close();
    } catch (err) {
      console.warn("Unable to close window", err);
    }
  }

  return {
    sidebarCollapsed,
    windowMaximized,
    toggleSidebar,
    refreshWindowState,
    minimizeWindow,
    toggleMaximizeWindow,
    closeWindow,
  };
}
