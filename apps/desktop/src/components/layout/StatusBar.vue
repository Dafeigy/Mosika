<script setup lang="ts">
import type { ConversationMock, SessionState } from "@/types/workbench";

defineProps<{
  activeConversation: ConversationMock | null;
  apiBaseUrl: string;
  conversationStateLabel: (state: SessionState) => string;
}>();
</script>

<template>
  <footer class="statusbar">
    <template v-if="activeConversation">
      <span :class="['s-dot', activeConversation.state]" />
      <span>{{ conversationStateLabel(activeConversation.state) }}</span>
      <span class="sep">|</span>
      <span>{{ activeConversation.taskId }}</span>
      <span class="sep">|</span>
    </template>
    <template v-else>
      <span class="s-dot idle" />
      <span>新对话</span>
      <span class="sep">|</span>
      <span>未创建任务</span>
      <span class="sep">|</span>
    </template>
    <span>本地 FastAPI: {{ apiBaseUrl }}</span>
    <span class="sep">|</span>
    <div class="status-right">
      <span>{{ activeConversation?.contextChips.length ?? 0 }} 个上下文</span>
      <span class="sep">|</span>
      <span>{{ activeConversation?.reviewRows.length ?? 0 }} 条结果</span>
      <span class="sep">|</span>
      <span>{{ activeConversation ? "42k" : "0" }}/200k token</span>
    </div>
  </footer>
</template>
