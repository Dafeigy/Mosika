<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { fetchHealth, type HealthResponse } from "@/api/health";
import {
  cancelTask,
  createTask,
  fetchTask,
  streamTaskEvents,
  type AgentIssue,
  type AgentToolCall,
  type TaskEventStream,
  type TaskRecord,
  type TaskEvent,
} from "@/api/tasks";
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
import type { ActiveView, ComposerMode, ConversationMock, InspectorTab, PlanStepState, ProjectMock, RiskLevel, SessionState } from "@/types/workbench";

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
const taskStreams = new Map<string, TaskEventStream>();
const taskSnapshotTimers = new Map<string, number>();

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

async function openWorkbenchFromHome() {
  activeView.value = "workbench";
  if (prompt.value.trim()) {
    await submitAgentTask();
  }
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function makePlanStep(title: string, tag: string, state: PlanStepState = "pending") {
  return { title, tag, state };
}

function cloneConversation(conversation: ConversationMock): ConversationMock {
  return {
    ...conversation,
    metrics: conversation.metrics.map((metric) => ({ ...metric })),
    plan: conversation.plan.map((step) => ({ ...step })),
    reviewRows: conversation.reviewRows.map((row) => ({ ...row })),
    contextChips: [...conversation.contextChips],
    items: [...conversation.items],
    approval: conversation.approval ? { ...conversation.approval } : undefined,
  };
}

function replaceConversation(conversation: ConversationMock) {
  const index = conversations.findIndex((item) => item.id === conversation.id);
  if (index >= 0) {
    conversations.splice(index, 1, conversation);
  }
}

function riskFromSeverity(severity: string | undefined): RiskLevel {
  if (severity === "high") return "high";
  if (severity === "mid" || severity === "medium") return "mid";
  return "low";
}

function labelFromRisk(level: RiskLevel) {
  if (level === "high") return "高风险";
  if (level === "mid") return "需确认";
  return "建议";
}

function createLocalConversation(userInstruction: string): ConversationMock {
  const id = `conv-${crypto.randomUUID()}`;
  const project = activeProject.value;
  const createdAt = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });

  return {
    id,
    projectId: project?.id ?? selectedHomeProjectId.value,
    title: userInstruction.slice(0, 28) || "Mock Agent 任务",
    updatedAt: createdAt,
    taskId: "TASK-PENDING",
    state: "running",
    statusLabel: "正在创建任务",
    user: "我",
    prompt: escapeHtml(userInstruction),
    metrics: [
      { label: "事件", value: "0" },
      { label: "工具调用", value: "0" },
      { label: "Artifacts", value: "0" },
      { label: "问题", value: "0" },
    ],
    plan: [
      makePlanStep("等待后端接收任务", "queued", "current"),
      makePlanStep("构建 AgentContext", "context"),
      makePlanStep("模拟工具调用", "tool"),
      makePlanStep("生成结构化结果", "result"),
    ],
    agentMessage: "任务已提交，正在等待 Mock Runtime 返回事件。",
    toolName: "mock.runtime",
    toolArgs: "等待事件流",
    reviewRows: [],
    contextChips: [project?.name ?? "无项目", "Mock Runtime", "artifact_only"],
    items: [],
  };
}

function markCurrentPlanDone(conversation: ConversationMock) {
  const current = conversation.plan.find((step) => step.state === "current");
  if (current) {
    current.state = "done";
  }
}

function applyStepStarted(conversation: ConversationMock, event: TaskEvent) {
  const title = typeof event.data.title === "string" ? event.data.title : "执行步骤";
  const tag = typeof event.data.tag === "string" ? event.data.tag : "step";
  markCurrentPlanDone(conversation);
  const existing = conversation.plan.find((step) => step.tag === tag && step.title === title);
  if (existing) {
    existing.state = "current";
  } else {
    conversation.plan.push(makePlanStep(title, tag, "current"));
  }
}

function issuesToRows(issues: AgentIssue[]) {
  return issues.map((issue) => {
    const level = riskFromSeverity(issue.severity);
    return {
      level,
      label: labelFromRisk(level),
      text: issue.description,
      ref: issue.location ?? issue.source_file ?? issue.id,
    };
  });
}

function toolCallFromEvent(event: TaskEvent): AgentToolCall | null {
  const toolCall = event.data.tool_call;
  if (!toolCall || typeof toolCall !== "object") return null;
  return toolCall as AgentToolCall;
}

function updateConversationMetrics(conversation: ConversationMock, eventCount: number) {
  const issueCount = conversation.reviewRows.length;
  const artifactCount = Number(conversation.metrics.find((metric) => metric.label === "Artifacts")?.value ?? 0);
  const toolCount = conversation.toolName === "mock.runtime" ? 0 : 1;
  conversation.metrics = [
    { label: "事件", value: String(eventCount) },
    { label: "工具调用", value: String(toolCount) },
    { label: "Artifacts", value: String(artifactCount) },
    { label: "问题", value: String(issueCount), tone: issueCount > 0 ? "warn" : "success" },
  ];
}

function applyTaskEvent(baseConversation: ConversationMock, event: TaskEvent) {
  const conversation = cloneConversation(baseConversation);
  const eventCount = Number(conversation.metrics.find((metric) => metric.label === "事件")?.value ?? 0) + 1;
  let shouldPersist = false;
  conversation.updatedAt = "刚刚";

  if (event.type === "task_started") {
    conversation.state = "running";
    conversation.statusLabel = "Mock Runtime 执行中";
    conversation.taskId = event.task_id;
    conversation.agentMessage = "Mock Runtime 已启动，正在构建任务上下文。";
  }

  if (event.type === "step_started") {
    applyStepStarted(conversation, event);
  }

  if (event.type === "assistant_message_delta" && typeof event.data.text === "string") {
    conversation.agentMessage = `${conversation.agentMessage}<br>${escapeHtml(event.data.text)}`;
  }

  if (event.type === "tool_call_started") {
    const toolCall = toolCallFromEvent(event);
    conversation.toolName = toolCall?.name ?? "mock.tool";
    conversation.toolArgs = toolCall?.title ?? "运行中";
  }

  if (event.type === "tool_call_progress" && typeof event.data.message === "string") {
    conversation.toolArgs = event.data.message;
  }

  if (event.type === "tool_call_completed") {
    const toolCall = toolCallFromEvent(event);
    conversation.toolName = toolCall?.name ?? conversation.toolName;
    conversation.toolArgs = "工具调用完成";
    const issues = toolCall?.output?.issues;
    if (Array.isArray(issues)) {
      conversation.reviewRows = issuesToRows(issues as AgentIssue[]);
    }
  }

  if (event.type === "artifact_created") {
    const artifact = event.data.artifact as { name?: string } | undefined;
    conversation.contextChips = [...conversation.contextChips.filter((chip) => !chip.startsWith("artifact:")), `artifact:${artifact?.name ?? "created"}`];
    const artifactMetric = conversation.metrics.find((metric) => metric.label === "Artifacts");
    const nextArtifactCount = Number(artifactMetric?.value ?? 0) + 1;
    conversation.metrics = conversation.metrics.map((metric) =>
      metric.label === "Artifacts" ? { ...metric, value: String(nextArtifactCount) } : metric,
    );
  }

  if (event.type === "task_completed") {
    markCurrentPlanDone(conversation);
    conversation.plan.forEach((step) => {
      step.state = "done";
    });
    conversation.state = "done";
    conversation.statusLabel = "已完成";
    const result = event.data.result as { summary?: string; issues?: AgentIssue[] } | undefined;
    if (result?.summary) {
      conversation.agentMessage = escapeHtml(result.summary);
    }
    if (Array.isArray(result?.issues)) {
      conversation.reviewRows = issuesToRows(result.issues);
    }
    taskStreams.get(event.task_id)?.close();
    taskStreams.delete(event.task_id);
    stopTaskSnapshotPolling(event.task_id);
    shouldPersist = true;
  }

  if (event.type === "task_failed" || event.type === "task_cancelled") {
    conversation.state = event.type === "task_cancelled" ? "idle" : "failed";
    conversation.statusLabel = event.type === "task_cancelled" ? "已取消" : "失败";
    conversation.agentMessage = event.type === "task_cancelled" ? "任务已取消。" : `任务失败：${escapeHtml(String(event.data.error ?? "unknown error"))}`;
    taskStreams.get(event.task_id)?.close();
    taskStreams.delete(event.task_id);
    stopTaskSnapshotPolling(event.task_id);
    shouldPersist = true;
  }

  updateConversationMetrics(conversation, eventCount);
  replaceConversation(conversation);
  if (shouldPersist) {
    saveConversationStore();
  }
}

function applyTaskSnapshot(baseConversation: ConversationMock, task: TaskRecord) {
  const conversation = cloneConversation(baseConversation);
  let shouldPersist = false;
  conversation.taskId = task.id;
  conversation.updatedAt = "刚刚";

  if (task.status === "running" || task.status === "queued") {
    conversation.state = "running";
    conversation.statusLabel = task.status === "queued" ? "排队中" : "Mock Runtime 执行中";
  }

  if (task.tool_calls.length > 0) {
    const latestTool = task.tool_calls[task.tool_calls.length - 1];
    conversation.toolName = latestTool.name;
    conversation.toolArgs = latestTool.title ?? latestTool.status;
    const issues = latestTool.output?.issues;
    if (Array.isArray(issues)) {
      conversation.reviewRows = issuesToRows(issues as AgentIssue[]);
    }
  }

  if (task.artifacts.length > 0) {
    const chips = task.artifacts.map((artifact) => `artifact:${artifact.name}`);
    conversation.contextChips = [...conversation.contextChips.filter((chip) => !chip.startsWith("artifact:")), ...chips];
  }

  if (task.result?.summary) {
    conversation.agentMessage = escapeHtml(task.result.summary);
  }

  if (Array.isArray(task.result?.issues)) {
    conversation.reviewRows = issuesToRows(task.result.issues);
  }

  if (task.status === "succeeded") {
    conversation.state = "done";
    conversation.statusLabel = "已完成";
    conversation.plan.forEach((step) => {
      step.state = "done";
    });
    taskStreams.get(task.id)?.close();
    taskStreams.delete(task.id);
    stopTaskSnapshotPolling(task.id);
    shouldPersist = true;
  }

  if (task.status === "failed" || task.status === "cancelled") {
    conversation.state = task.status === "failed" ? "failed" : "idle";
    conversation.statusLabel = task.status === "failed" ? "失败" : "已取消";
    if (task.error) {
      conversation.agentMessage = escapeHtml(task.error);
    }
    taskStreams.get(task.id)?.close();
    taskStreams.delete(task.id);
    stopTaskSnapshotPolling(task.id);
    shouldPersist = true;
  }

  updateConversationMetrics(conversation, Number(conversation.metrics.find((metric) => metric.label === "事件")?.value ?? 0));
  replaceConversation(conversation);
  if (shouldPersist) {
    saveConversationStore();
  }
}

async function syncTaskSnapshot(conversationId: string, taskId: string) {
  const conversation = conversations.find((item) => item.id === conversationId);
  if (!conversation) return;
  try {
    const task = await fetchTask(taskId);
    applyTaskSnapshot(conversation, task);
  } catch (err) {
    console.warn("Unable to sync task snapshot", err);
  }
}

function startTaskSnapshotPolling(conversationId: string, taskId: string) {
  stopTaskSnapshotPolling(taskId);
  const timer = window.setInterval(() => {
    void syncTaskSnapshot(conversationId, taskId);
  }, 700);
  taskSnapshotTimers.set(taskId, timer);
}

function stopTaskSnapshotPolling(taskId: string) {
  const timer = taskSnapshotTimers.get(taskId);
  if (timer !== undefined) {
    window.clearInterval(timer);
    taskSnapshotTimers.delete(taskId);
  }
}

async function submitAgentTask() {
  const userInstruction = prompt.value.trim();
  if (!userInstruction) return;

  const conversation = createLocalConversation(userInstruction);
  conversations.unshift(conversation);
  activeConversationId.value = conversation.id;
  selectedHomeProjectId.value = conversation.projectId;
  activeView.value = "workbench";
  prompt.value = "";
  await saveConversationStore();

  try {
    const { apiBaseUrl: nextApiBaseUrl, task } = await createTask({
      conversation_id: conversation.id,
      project_id: conversation.projectId,
      project_root: activeProject.value?.folderPath ?? null,
      selected_files: [],
      user_instruction: userInstruction,
      workflow_type: "mock_review",
      runtime: "mock",
      write_policy: "artifact_only",
      allowed_tools: ["filesystem.read_text_preview", "mock.review_engineering_package", "artifact.save_markdown"],
      output_contract: {
        summary: "string",
        issues: "Issue[]",
        artifacts: "Artifact[]",
      },
    });
    apiBaseUrl.value = nextApiBaseUrl;
    conversation.taskId = task.id;
    conversation.statusLabel = "事件流连接中";
    replaceConversation(conversation);
    startTaskSnapshotPolling(conversation.id, task.id);
    const source = streamTaskEvents(
      nextApiBaseUrl,
      task.id,
      (event) => {
        const latestConversation = conversations.find((item) => item.id === conversation.id);
        if (latestConversation) {
          applyTaskEvent(latestConversation, event);
        }
      },
      (streamError) => {
        const latestConversation = conversations.find((item) => item.id === conversation.id);
        if (latestConversation?.state === "running") {
          const nextConversation = cloneConversation(latestConversation);
          nextConversation.statusLabel = "事件流断开，正在读取任务快照";
          nextConversation.agentMessage = `事件流连接失败，已切换到快照轮询：${escapeHtml(String(streamError instanceof Error ? streamError.message : streamError))}`;
          replaceConversation(nextConversation);
          void syncTaskSnapshot(conversation.id, task.id);
        }
        taskStreams.delete(task.id);
      }
    );
    taskStreams.set(task.id, source);
  } catch (err) {
    conversation.state = "failed";
    conversation.statusLabel = "创建失败";
    conversation.agentMessage = err instanceof Error ? escapeHtml(err.message) : "任务创建失败";
    await saveConversationStore();
  }
}

async function cancelActiveTask() {
  const conversation = activeConversation.value;
  if (!conversation || conversation.state !== "running" || conversation.taskId === "TASK-PENDING") return;

  try {
    await cancelTask(conversation.taskId);
  } catch (err) {
    conversation.agentMessage = err instanceof Error ? escapeHtml(err.message) : "取消任务失败";
  }
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

