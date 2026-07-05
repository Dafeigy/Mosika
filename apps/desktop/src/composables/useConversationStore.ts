import { computed, reactive, ref, type MaybeRefOrGetter, toValue } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { defaultConversations } from "@/data/mockWorkbench";
import type { ConversationItem, ConversationMock, ProjectMock, SessionState } from "@/types/workbench";

type DeleteConversationOptions = {
  beforeDelete?: (conversation: ConversationMock) => void;
  afterDelete?: (conversation: ConversationMock) => void;
};

export function useConversationStore(projects: MaybeRefOrGetter<ProjectMock[]>) {
  const conversations = reactive<ConversationMock[]>([...defaultConversations].map(normalizeConversationMarkdown));
  const activeConversationId = ref<string | null>(null);
  const renameConversationDialogOpen = ref(false);
  const renamingConversationId = ref<string | null>(null);
  const renameConversationTitle = ref("");
  const deleteConversationDialogOpen = ref(false);
  const deletingConversationId = ref<string | null>(null);

  const activeConversation = computed(() => {
    if (!activeConversationId.value) return null;
    return conversations.find((conversation) => conversation.id === activeConversationId.value) ?? null;
  });

  const currentConversation = computed<ConversationMock | null>(() => activeConversation.value ?? conversations[0] ?? null);

  const projectConversations = computed(() => {
    return toValue(projects).reduce<Record<string, ConversationMock[]>>((groups, project) => {
      groups[project.id] = conversations.filter((conversation) => conversation.projectId === project.id);
      return groups;
    }, {});
  });

  const directConversations = computed(() => conversations.filter((conversation) => conversation.projectId === null));

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
      items: conversationItemsForStore(conversation),
    }));
  }

  function replaceConversations(nextConversations: ConversationMock[]) {
    conversations.splice(0, conversations.length, ...nextConversations.map(normalizeConversationMarkdown));
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

  function replaceConversation(conversation: ConversationMock) {
    const index = conversations.findIndex((item) => item.id === conversation.id);
    if (index >= 0) {
      conversations.splice(index, 1, conversation);
    }
  }

  function openRenameConversationDialog(conversationId: string) {
    const conversation = conversations.find((item) => item.id === conversationId);
    if (!conversation) return;

    renamingConversationId.value = conversationId;
    renameConversationTitle.value = conversation.title;
    renameConversationDialogOpen.value = true;
  }

  async function renameConversation() {
    const nextTitle = renameConversationTitle.value.trim();
    if (!nextTitle || !renamingConversationId.value) return;

    const conversation = conversations.find((item) => item.id === renamingConversationId.value);
    if (!conversation) return;

    conversation.title = nextTitle;
    renameConversationDialogOpen.value = false;
    renamingConversationId.value = null;
    renameConversationTitle.value = "";
    await saveConversationStore();
  }

  function openDeleteConversationDialog(conversationId: string) {
    if (!conversations.some((item) => item.id === conversationId)) return;

    deletingConversationId.value = conversationId;
    deleteConversationDialogOpen.value = true;
  }

  async function deleteConversation(options: DeleteConversationOptions = {}) {
    if (!deletingConversationId.value) return;

    const conversationId = deletingConversationId.value;
    const conversation = conversations.find((item) => item.id === conversationId);
    if (!conversation) return;

    options.beforeDelete?.(conversation);

    const index = conversations.findIndex((item) => item.id === conversationId);
    if (index >= 0) {
      conversations.splice(index, 1);
    }

    if (activeConversationId.value === conversationId) {
      activeConversationId.value = null;
    }

    deleteConversationDialogOpen.value = false;
    deletingConversationId.value = null;
    options.afterDelete?.(conversation);
    await saveConversationStore();
  }

  return {
    conversations,
    activeConversationId,
    activeConversation,
    currentConversation,
    projectConversations,
    directConversations,
    renameConversationDialogOpen,
    renamingConversationId,
    renameConversationTitle,
    deleteConversationDialogOpen,
    deletingConversationId,
    loadConversationStore,
    saveConversationStore,
    replaceConversation,
    openRenameConversationDialog,
    renameConversation,
    openDeleteConversationDialog,
    deleteConversation,
  };
}

export function conversationStateLabel(state: SessionState) {
  if (state === "running") return "执行中";
  if (state === "approval") return "待审批";
  if (state === "done") return "已完成";
  if (state === "failed") return "已中止";
  return "未开始";
}

function legacyHtmlToMarkdown(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n\n")
    .replace(/<code>(.*?)<\/code>/gis, "`$1`")
    .replace(/<strong>(.*?)<\/strong>/gis, "**$1**");
}

function normalizeConversationMarkdown(conversation: ConversationMock): ConversationMock {
  return {
    ...conversation,
    prompt: legacyHtmlToMarkdown(conversation.prompt),
    agentMessage: legacyHtmlToMarkdown(conversation.agentMessage),
    approval: conversation.approval
      ? {
          ...conversation.approval,
          body: legacyHtmlToMarkdown(conversation.approval.body),
        }
      : undefined,
    items: conversation.items.map((item) => {
      if (item.type !== "message") {
        return item;
      }

      return {
        ...item,
        content: item.content.map((content) => ({
          type: content.type === "text" ? "text" : "markdown",
          text: legacyHtmlToMarkdown(content.text),
        })),
      };
    }),
  };
}

function conversationItemsForStore(conversation: ConversationMock): ConversationItem[] {
  const toolStatus =
    conversation.state === "running"
      ? "running"
      : conversation.state === "approval"
        ? "approval_required"
        : conversation.state === "failed"
          ? "error"
          : "done";

  return [
    {
      type: "message",
      id: `${conversation.id}-user`,
      role: "user",
      content: [{ type: "markdown", text: conversation.prompt }],
      createdAt: conversation.updatedAt,
      status: "done",
    },
    {
      type: "tool_call",
      id: `${conversation.id}-tool`,
      toolName: conversation.toolName,
      title: conversation.toolArgs,
      status: toolStatus,
      args: { contextChips: conversation.contextChips },
      result: {
        plan: conversation.plan,
        reviewRows: conversation.reviewRows,
        approval: conversation.approval,
      },
      renderHint: "workbench_review",
      createdAt: conversation.updatedAt,
      updatedAt: conversation.updatedAt,
    },
    {
      type: "message",
      id: `${conversation.id}-assistant`,
      role: "assistant",
      content: [{ type: "markdown", text: conversation.agentMessage }],
      createdAt: conversation.updatedAt,
      status: conversation.state === "running" ? "streaming" : conversation.state === "failed" ? "error" : "done",
    },
  ];
}
