<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AppSidebar from "@/components/layout/AppSidebar.vue";
import AppTitlebar from "@/components/layout/AppTitlebar.vue";
import StatusBar from "@/components/layout/StatusBar.vue";
import InspectorPanel from "@/components/workbench/InspectorPanel.vue";
import { useConversationStore, conversationStateLabel } from "@/composables/useConversationStore";
import { useProjectRegistry } from "@/composables/useProjectRegistry";
import { useServerHealth } from "@/composables/useServerHealth";
import { useTaskRunner } from "@/composables/useTaskRunner";
import { useWindowControls } from "@/composables/useWindowControls";
import { homeSuggestions, navItems } from "@/data/mockWorkbench";
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
import type { ActiveView, ComposerMode, InspectorTab } from "@/types/workbench";

const inspectorTab = ref<InspectorTab>("result");
const composerMode = ref<ComposerMode>("agent");
const activeView = ref<ActiveView>("home");
const toolOpen = ref(true);
const prompt = ref("");

const {
  apiBaseUrl,
  loading,
  serverStatusText,
  serverStateClass,
  serverDetail,
  checkServer,
} = useServerHealth();

const {
  sidebarCollapsed,
  windowMaximized,
  toggleSidebar,
  refreshWindowState,
  minimizeWindow,
  toggleMaximizeWindow,
  closeWindow,
} = useWindowControls();

const {
  homeProjects,
  selectedHomeProjectId,
  expandedProjectIds,
  renameProjectDialogOpen,
  renameProjectName,
  selectedHomeProjectName,
  loadProjectRegistry,
  selectHomeProjectName,
  toggleProject,
  openProjectFolder,
  openRenameProjectDialog,
  renameProject,
  ensureProjectExpanded,
} = useProjectRegistry();

const {
  conversations,
  activeConversationId,
  activeConversation,
  currentConversation,
  projectConversations,
  directConversations,
  renameConversationDialogOpen,
  renameConversationTitle,
  deleteConversationDialogOpen,
  loadConversationStore,
  saveConversationStore,
  replaceConversation,
  openRenameConversationDialog,
  renameConversation,
  openDeleteConversationDialog,
  deleteConversation: deleteConversationFromStore,
} = useConversationStore(() => homeProjects);

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

const activeProject = computed(() => {
  const projectId = activeConversation.value?.projectId ?? selectedHomeProjectId.value;
  if (!projectId) return null;
  return homeProjects.find((project) => project.id === projectId) ?? null;
});

const activeConversationStateLabel = computed(() => {
  return currentConversation.value ? conversationStateLabel(currentConversation.value.state) : "新对话";
});

const { submitAgentTask, cancelActiveTask, closeTaskRuntime } = useTaskRunner({
  conversations,
  activeConversation,
  activeProject,
  selectedHomeProjectId,
  activeConversationId,
  activeView,
  prompt,
  apiBaseUrl,
  replaceConversation,
  saveConversationStore,
});

function selectMode(mode: ComposerMode) {
  composerMode.value = mode;
}

async function openWorkbenchFromHome() {
  activeView.value = "workbench";
  if (prompt.value.trim()) {
    await submitAgentTask();
  }
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
  ensureProjectExpanded(projectId);
  prompt.value = "";
  activeView.value = "home";
}

function openConversation(conversationId: string) {
  const conversation = conversations.find((item) => item.id === conversationId);
  if (!conversation) return;

  activeConversationId.value = conversationId;
  selectedHomeProjectId.value = conversation.projectId;
  if (conversation.projectId) {
    ensureProjectExpanded(conversation.projectId);
  }
  activeView.value = "workbench";
}

async function deleteConversation() {
  const activeIdBeforeDelete = activeConversationId.value;

  await deleteConversationFromStore({
    beforeDelete(conversation) {
      if (conversation.taskId !== "TASK-PENDING") {
        closeTaskRuntime(conversation.taskId);
      }
    },
    afterDelete(conversation) {
      if (activeIdBeforeDelete === conversation.id || !currentConversation.value) {
        selectedHomeProjectId.value = null;
        activeView.value = "home";
      }
    },
  });
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
      @open-rename-conversation-dialog="openRenameConversationDialog"
      @delete-conversation="openDeleteConversationDialog"
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

    <Dialog v-model:open="renameConversationDialogOpen">
      <DialogContent class="rename-project-dialog">
        <DialogHeader>
          <DialogTitle>重命名对话</DialogTitle>
          <DialogDescription>修改侧边栏和对话页显示的标题。</DialogDescription>
        </DialogHeader>

        <form class="rename-project-form" @submit.prevent="renameConversation">
          <label class="rename-project-field">
            <span>对话标题</span>
            <input v-model="renameConversationTitle" type="text" autocomplete="off" />
          </label>

          <DialogFooter class="rename-project-footer">
            <button class="btn ghost" type="button" @click="renameConversationDialogOpen = false">取消</button>
            <button class="btn primary" type="submit" :disabled="!renameConversationTitle.trim()">保存</button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="deleteConversationDialogOpen">
      <DialogContent class="rename-project-dialog">
        <DialogHeader>
          <DialogTitle>删除对话</DialogTitle>
          <DialogDescription>此操作会从本地对话列表中删除该对话。</DialogDescription>
        </DialogHeader>

        <DialogFooter class="rename-project-footer">
          <button class="btn ghost" type="button" @click="deleteConversationDialogOpen = false">取消</button>
          <button class="btn danger" type="button" @click="deleteConversation">删除</button>
        </DialogFooter>
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
      @submit-task="submitAgentTask"
      @cancel-task="cancelActiveTask"
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

