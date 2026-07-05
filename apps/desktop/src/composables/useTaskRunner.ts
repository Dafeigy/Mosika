import type { ComputedRef, Ref } from "vue";
import {
  cancelTask,
  createTask,
  fetchTask,
  streamTaskEvents,
  type AgentIssue,
  type AgentToolCall,
  type TaskEvent,
  type TaskEventStream,
  type TaskRecord,
} from "@/api/tasks";
import type { ActiveView, ConversationMock, PlanStepState, ProjectMock, RiskLevel } from "@/types/workbench";

type TaskRunnerOptions = {
  conversations: ConversationMock[];
  activeConversation: ComputedRef<ConversationMock | null>;
  activeProject: ComputedRef<ProjectMock | null>;
  selectedHomeProjectId: Ref<string | null>;
  activeConversationId: Ref<string | null>;
  activeView: Ref<ActiveView>;
  prompt: Ref<string>;
  apiBaseUrl: Ref<string>;
  replaceConversation: (conversation: ConversationMock) => void;
  saveConversationStore: () => Promise<void>;
};

export function useTaskRunner(options: TaskRunnerOptions) {
  const taskStreams = new Map<string, TaskEventStream>();
  const taskSnapshotTimers = new Map<string, number>();

  function closeTaskRuntime(taskId: string) {
    taskStreams.get(taskId)?.close();
    taskStreams.delete(taskId);
    stopTaskSnapshotPolling(taskId);
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
    const project = options.activeProject.value;
    const createdAt = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });

    return {
      id,
      projectId: project?.id ?? options.selectedHomeProjectId.value,
      title: userInstruction.slice(0, 28) || "Mock Agent 任务",
      updatedAt: createdAt,
      taskId: "TASK-PENDING",
      state: "running",
      statusLabel: "正在创建任务",
      user: "我",
      prompt: userInstruction,
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
      conversation.agentMessage = `${conversation.agentMessage}\n\n${event.data.text}`;
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
      conversation.contextChips = [
        ...conversation.contextChips.filter((chip) => !chip.startsWith("artifact:")),
        `artifact:${artifact?.name ?? "created"}`,
      ];
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
        conversation.agentMessage = result.summary;
      }
      if (Array.isArray(result?.issues)) {
        conversation.reviewRows = issuesToRows(result.issues);
      }
      closeTaskRuntime(event.task_id);
      shouldPersist = true;
    }

    if (event.type === "task_failed" || event.type === "task_cancelled") {
      conversation.state = event.type === "task_cancelled" ? "idle" : "failed";
      conversation.statusLabel = event.type === "task_cancelled" ? "已取消" : "失败";
      conversation.agentMessage = event.type === "task_cancelled" ? "任务已取消。" : `任务失败：${String(event.data.error ?? "unknown error")}`;
      closeTaskRuntime(event.task_id);
      shouldPersist = true;
    }

    updateConversationMetrics(conversation, eventCount);
    options.replaceConversation(conversation);
    if (shouldPersist) {
      void options.saveConversationStore();
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
      conversation.agentMessage = task.result.summary;
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
      closeTaskRuntime(task.id);
      shouldPersist = true;
    }

    if (task.status === "failed" || task.status === "cancelled") {
      conversation.state = task.status === "failed" ? "failed" : "idle";
      conversation.statusLabel = task.status === "failed" ? "失败" : "已取消";
      if (task.error) {
        conversation.agentMessage = task.error;
      }
      closeTaskRuntime(task.id);
      shouldPersist = true;
    }

    updateConversationMetrics(conversation, Number(conversation.metrics.find((metric) => metric.label === "事件")?.value ?? 0));
    options.replaceConversation(conversation);
    if (shouldPersist) {
      void options.saveConversationStore();
    }
  }

  async function syncTaskSnapshot(conversationId: string, taskId: string) {
    const conversation = options.conversations.find((item) => item.id === conversationId);
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
    const userInstruction = options.prompt.value.trim();
    if (!userInstruction) return;

    const conversation = createLocalConversation(userInstruction);
    options.conversations.unshift(conversation);
    options.activeConversationId.value = conversation.id;
    options.selectedHomeProjectId.value = conversation.projectId;
    options.activeView.value = "workbench";
    options.prompt.value = "";
    await options.saveConversationStore();

    try {
      const { apiBaseUrl: nextApiBaseUrl, task } = await createTask({
        conversation_id: conversation.id,
        project_id: conversation.projectId,
        project_root: options.activeProject.value?.folderPath ?? null,
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
      options.apiBaseUrl.value = nextApiBaseUrl;
      conversation.taskId = task.id;
      conversation.statusLabel = "事件流连接中";
      options.replaceConversation(conversation);
      startTaskSnapshotPolling(conversation.id, task.id);
      const source = streamTaskEvents(
        nextApiBaseUrl,
        task.id,
        (event) => {
          const latestConversation = options.conversations.find((item) => item.id === conversation.id);
          if (latestConversation) {
            applyTaskEvent(latestConversation, event);
          }
        },
        (streamError) => {
          const latestConversation = options.conversations.find((item) => item.id === conversation.id);
          if (latestConversation?.state === "running") {
            const nextConversation = cloneConversation(latestConversation);
            nextConversation.statusLabel = "事件流断开，正在读取任务快照";
            nextConversation.agentMessage = `事件流连接失败，已切换到快照轮询：${String(streamError instanceof Error ? streamError.message : streamError)}`;
            options.replaceConversation(nextConversation);
            void syncTaskSnapshot(conversation.id, task.id);
          }
          taskStreams.delete(task.id);
        },
      );
      taskStreams.set(task.id, source);
    } catch (err) {
      conversation.state = "failed";
      conversation.statusLabel = "创建失败";
      conversation.agentMessage = err instanceof Error ? err.message : "任务创建失败";
      await options.saveConversationStore();
    }
  }

  async function cancelActiveTask() {
    const conversation = options.activeConversation.value;
    if (!conversation || conversation.state !== "running" || conversation.taskId === "TASK-PENDING") return;

    try {
      await cancelTask(conversation.taskId);
    } catch (err) {
      conversation.agentMessage = err instanceof Error ? err.message : "取消任务失败";
    }
  }

  return {
    submitAgentTask,
    cancelActiveTask,
    closeTaskRuntime,
  };
}
