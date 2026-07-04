<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { fetchHealth, type HealthResponse } from "@/api/health";
import AppSidebar from "@/components/layout/AppSidebar.vue";
import AppTitlebar from "@/components/layout/AppTitlebar.vue";
import StatusBar from "@/components/layout/StatusBar.vue";
import InspectorPanel from "@/components/workbench/InspectorPanel.vue";
import { defaultConversations, defaultProjects, homeSuggestions, navItems } from "@/data/mockWorkbench";
import HomePage from "@/pages/HomePage.vue";
import PlaceholderPage from "@/pages/PlaceholderPage.vue";
import WorkbenchPage from "@/pages/WorkbenchPage.vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ActiveView, ComposerMode, ConversationMock, InspectorTab, ProjectMock, SessionState } from "@/types/workbench";

const apiBaseUrl = ref("http://127.0.0.1:8765");
const health = ref<HealthResponse | null>(null);
const error = ref("");
const loading = ref(false);
const inspectorTab = ref<InspectorTab>("result");
const composerMode = ref<ComposerMode>("agent");
const activeView = ref<ActiveView>("home");
const toolOpen = ref(true);
const sidebarCollapsed = ref(false);
const windowMaximized = ref(false);
const prompt = ref("");
const appWindow = getCurrentWindow();

const homeProjects = reactive<ProjectMock[]>([...defaultProjects]);
const selectedHomeProjectId = ref<string | null>(null);
const expandedProjectIds = ref<string[]>(homeProjects.map((project) => project.id));
const renameProjectDialogOpen = ref(false);
const renamingProjectId = ref<string | null>(null);
const renameProjectName = ref("");

function projectRegistryPayload() {
  return homeProjects.map((project) => ({
    id: project.id,
    name: project.name,
    meta: project.meta,
    folderPath: project.folderPath,
  }));
}

function replaceProjects(projects: ProjectMock[]) {
  homeProjects.splice(0, homeProjects.length, ...projects);
  if (selectedHomeProjectId.value && !homeProjects.some((project) => project.id === selectedHomeProjectId.value)) {
    selectedHomeProjectId.value = null;
  }
  expandedProjectIds.value = expandedProjectIds.value.filter((projectId) =>
    homeProjects.some((project) => project.id === projectId),
  );
  if (expandedProjectIds.value.length === 0) {
    expandedProjectIds.value = homeProjects.map((project) => project.id);
  }
}

async function loadProjectRegistry() {
  try {
    const projects = await invoke<ProjectMock[]>("load_project_registry", {
      defaultProjects: projectRegistryPayload(),
    });
    replaceProjects(projects);
  } catch (err) {
    console.warn("Using mock projects because project registry could not be loaded", err);
  }
}

async function saveProjectRegistry() {
  try {
    await invoke("save_project_registry", { projects: projectRegistryPayload() });
  } catch (err) {
    console.error("Failed to save project registry", err);
  }
}

const conversations = reactive<ConversationMock[]>([...defaultConversations]);
const activeConversationId = ref<string | null>(null);

function conversationStorePayload() {
  return conversations.map((conversation) => ({
    id: conversation.id,
    projectId: conversation.projectId,
    title: conversation.title,
    updatedAt: conversation.updatedAt,
    taskId: conversation.taskId,
    state: conversation.state,
    statusLabel: conversation.statusLabel,
    user: conversation.user,
    prompt: conversation.prompt,
    metrics: conversation.metrics,
    plan: conversation.plan,
    agentMessage: conversation.agentMessage,
    toolName: conversation.toolName,
    toolArgs: conversation.toolArgs,
    reviewRows: conversation.reviewRows,
    approval: conversation.approval,
    contextChips: conversation.contextChips,
    items: conversation.items,
  }));
}

function replaceConversations(nextConversations: ConversationMock[]) {
  conversations.splice(0, conversations.length, ...nextConversations);
  if (!conversations.some((conversation) => conversation.id === activeConversationId.value)) {
    activeConversationId.value = null;
  }
}

async function loadConversationStore() {
  try {
    const storedConversations = await invoke<ConversationMock[]>("load_conversation_store", {
      defaultConversations: conversationStorePayload(),
    });
    replaceConversations(storedConversations);
  } catch (err) {
    console.warn("Using mock conversations because conversation store could not be loaded", err);
  }
}

async function saveConversationStore() {
  try {
    await invoke("save_conversation_store", { conversations: conversationStorePayload() });
  } catch (err) {
    console.error("Failed to save conversation store", err);
  }
}

const serverStatusText = computed(() => {
  if (loading.value) return "连接中";
  if (health.value?.status === "ok") return "已连接";
  if (error.value) return "连接失败";
  return "未验证";
});

const serverStateClass = computed(() => {
  if (health.value?.status === "ok") return "ok";
  if (error.value) return "error";
  return "pending";
});

const serverDetail = computed(() => {
  if (health.value?.status === "ok") return `${health.value.service} / ${apiBaseUrl.value}`;
  if (error.value) return error.value;
  return apiBaseUrl.value;
});

const activeNavItem = computed(() => {
  if (activeView.value === "home") {
    return {
      id: "home",
      label: "Mousika",
      icon: navItems[0].icon,
      description: "桌面 AI 工作台主页",
    };
  }

  return navItems.find((item) => item.id === activeView.value) ?? navItems[0];
});

const composerModeLabel = computed(() => (composerMode.value === "agent" ? "任务模式" : "问答模式"));

const activeConversation = computed(() => {
  if (!activeConversationId.value) return null;
  return conversations.find((conversation) => conversation.id === activeConversationId.value) ?? null;
});

const currentConversation = computed(() => activeConversation.value ?? conversations[0]);

function conversationStateLabel(state: SessionState) {
  if (state === "running") return "执行中";
  if (state === "approval") return "待审批";
  if (state === "done") return "已完成";
  if (state === "failed") return "已中止";
  return "未开始";
}

const activeProject = computed(() => {
  const projectId = activeConversation.value?.projectId ?? selectedHomeProjectId.value;
  if (!projectId) return null;
  return homeProjects.find((project) => project.id === projectId) ?? null;
});

const activeConversationStateLabel = computed(() => {
  return conversationStateLabel(currentConversation.value.state);
});

const projectConversations = computed(() => {
  return homeProjects.reduce<Record<string, ConversationMock[]>>((groups, project) => {
    groups[project.id] = conversations.filter((conversation) => conversation.projectId === project.id);
    return groups;
  }, {});
});

const directConversations = computed(() => conversations.filter((conversation) => conversation.projectId === null));

const selectedHomeProjectName = computed(() => {
  return homeProjects.find((project) => project.id === selectedHomeProjectId.value)?.name ?? null;
});

async function checkServer() {
  loading.value = true;
  error.value = "";

  try {
    const result = await fetchHealth({ attempts: 20, intervalMs: 500 });
    apiBaseUrl.value = result.apiBaseUrl;
    health.value = result.health;
  } catch (err) {
    health.value = null;
    error.value = err instanceof Error ? err.message : "无法连接本地服务";
  } finally {
    loading.value = false;
  }
}

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

function selectMode(mode: ComposerMode) {
  composerMode.value = mode;
}

function openWorkbenchFromHome() {
  activeView.value = "workbench";
}

function selectHomeProjectName(projectName: string | null) {
  selectedHomeProjectId.value = homeProjects.find((project) => project.name === projectName)?.id ?? null;
}

function toggleProject(projectId: string) {
  const expanded = expandedProjectIds.value.includes(projectId);
  expandedProjectIds.value = expanded
    ? expandedProjectIds.value.filter((id) => id !== projectId)
    : [...expandedProjectIds.value, projectId];

  if (!expanded) {
    selectedHomeProjectId.value = projectId;
  }
}

async function openProjectFolder(projectId: string) {
  const project = homeProjects.find((item) => item.id === projectId);
  if (!project) return;

  try {
    await invoke("open_path_in_explorer", { path: project.folderPath });
  } catch (err) {
    console.error("Failed to open project folder", err);
  }
}

function openRenameProjectDialog(projectId: string) {
  const project = homeProjects.find((item) => item.id === projectId);
  if (!project) return;

  renamingProjectId.value = projectId;
  renameProjectName.value = project.name;
  renameProjectDialogOpen.value = true;
}

async function renameProject() {
  const nextName = renameProjectName.value.trim();
  if (!nextName || !renamingProjectId.value) return;

  const project = homeProjects.find((item) => item.id === renamingProjectId.value);
  if (!project) return;

  project.name = nextName;
  renameProjectDialogOpen.value = false;
  renamingProjectId.value = null;
  renameProjectName.value = "";
  await saveProjectRegistry();
}

function startNewConversation() {
  activeConversationId.value = null;
  selectedHomeProjectId.value = null;
  prompt.value = "";
  activeView.value = "home";
}

function startProjectConversation(projectId: string) {
  activeConversationId.value = null;
  selectedHomeProjectId.value = projectId;
  if (!expandedProjectIds.value.includes(projectId)) {
    expandedProjectIds.value = [...expandedProjectIds.value, projectId];
  }
  prompt.value = "";
  activeView.value = "home";
}

function openConversation(conversationId: string) {
  const conversation = conversations.find((item) => item.id === conversationId);
  if (!conversation) return;

  activeConversationId.value = conversationId;
  selectedHomeProjectId.value = conversation.projectId;
  if (conversation.projectId && !expandedProjectIds.value.includes(conversation.projectId)) {
    expandedProjectIds.value = [...expandedProjectIds.value, conversation.projectId];
  }
  activeView.value = "workbench";
}

onMounted(async () => {
  await loadProjectRegistry();
  await loadConversationStore();
  checkServer();
  refreshWindowState();
});
</script>

<template>
  <div :class="['workbench', activeView === 'workbench' ? 'with-inspector' : '', sidebarCollapsed ? 'sidebar-collapsed' : '']">
    <AppTitlebar
      :sidebar-collapsed="sidebarCollapsed"
      :server-state-class="serverStateClass"
      :server-detail="serverDetail"
      :server-status-text="serverStatusText"
      :loading="loading"
      :window-maximized="windowMaximized"
      @toggle-sidebar="toggleSidebar"
      @start-new-conversation="startNewConversation"
      @select-view="activeView = $event"
      @check-server="checkServer"
      @minimize-window="minimizeWindow"
      @toggle-maximize-window="toggleMaximizeWindow"
      @close-window="closeWindow"
    />

    <AppSidebar
      :projects="homeProjects"
      :selected-project-id="selectedHomeProjectId"
      :expanded-project-ids="expandedProjectIds"
      :project-conversations="projectConversations"
      :direct-conversations="directConversations"
      :active-conversation-id="activeConversationId"
      :active-project="activeProject"
      @start-new-conversation="startNewConversation"
      @select-history="activeView = 'history'"
      @toggle-project="toggleProject"
      @open-project-folder="openProjectFolder"
      @open-rename-project-dialog="openRenameProjectDialog"
      @start-project-conversation="startProjectConversation"
      @open-conversation="openConversation"
      @select-settings="activeView = 'settings'"
    />

    <Dialog v-model:open="renameProjectDialogOpen">
      <DialogContent class="rename-project-dialog">
        <DialogHeader>
          <DialogTitle>重命名项目</DialogTitle>
          <DialogDescription>修改项目显示名称，不会改变项目 ID 或文件夹路径。</DialogDescription>
        </DialogHeader>

        <form class="rename-project-form" @submit.prevent="renameProject">
          <label class="rename-project-field">
            <span>项目名称</span>
            <input v-model="renameProjectName" type="text" autocomplete="off" />
          </label>

          <DialogFooter class="rename-project-footer">
            <button class="btn ghost" type="button" @click="renameProjectDialogOpen = false">取消</button>
            <button class="btn primary" type="submit" :disabled="!renameProjectName.trim()">保存</button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <HomePage
      v-if="activeView === 'home'"
      v-model:prompt="prompt"
      :projects="homeProjects"
      :selected-project-name="selectedHomeProjectName"
      :suggestions="homeSuggestions"
      @open-workbench="openWorkbenchFromHome"
      @select-home-project-name="selectHomeProjectName"
    />

    <WorkbenchPage
      v-else-if="activeView === 'workbench' && currentConversation"
      v-model:prompt="prompt"
      v-model:tool-open="toolOpen"
      :conversation="currentConversation"
      :state-label="activeConversationStateLabel"
      :composer-mode="composerMode"
      :composer-mode-label="composerModeLabel"
      @select-mode="selectMode"
    />

    <PlaceholderPage
      v-else
      :nav-item="activeNavItem"
      @open-workbench="activeView = 'workbench'"
    />

    <InspectorPanel
      v-if="activeView === 'workbench'"
      v-model:tab="inspectorTab"
    />

    <StatusBar
      :active-conversation="activeConversation"
      :api-base-url="apiBaseUrl"
      :conversation-state-label="conversationStateLabel"
    />
  </div>
</template>

