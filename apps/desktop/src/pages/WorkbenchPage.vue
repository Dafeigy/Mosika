<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronRight,
  ClipboardCheck,
  Download,
  FilePlus2,
  ListChecks,
  MoreHorizontal,
  Pause,
  Send,
  SlidersHorizontal,
} from "lucide-vue-next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ComposerMode, ConversationMock } from "@/types/workbench";

const props = defineProps<{
  conversation: ConversationMock;
  stateLabel: string;
  prompt: string;
  composerMode: ComposerMode;
  composerModeLabel: string;
  toolOpen: boolean;
}>();

const emit = defineEmits<{
  "update:prompt": [value: string];
  "update:toolOpen": [value: boolean];
  selectMode: [mode: ComposerMode];
  submitTask: [];
  cancelTask: [];
}>();

const composerInput = ref<HTMLTextAreaElement | null>(null);

const doneStepCount = computed(() => props.conversation.plan.filter((step) => step.state === "done").length);

async function growComposer() {
  await nextTick();
  const input = composerInput.value;
  if (!input) return;
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
}

function updatePrompt(event: Event) {
  emit("update:prompt", (event.target as HTMLTextAreaElement).value);
  growComposer();
}
</script>

<template>
  <main class="main">
    <div class="main-head">
      <span class="task-id">{{ conversation.taskId }}</span>
      <h1>{{ conversation.title }}</h1>
      <span :class="['stat-pill', conversation.state]"><span />{{ stateLabel }}</span>
      <div class="head-actions">
        <button class="icon-btn" type="button" aria-label="打开任务轨迹" title="打开任务轨迹">
          <ListChecks class="tiny-icon" />
        </button>
        <button class="icon-btn" type="button" aria-label="导出结果" title="导出结果">
          <Download class="tiny-icon" />
        </button>
        <button class="icon-btn" type="button" aria-label="更多" title="更多">
          <MoreHorizontal class="tiny-icon" />
        </button>
      </div>
    </div>

    <section class="thread" aria-label="任务线程">
      <div class="turn user-turn">
        <div class="avatar">{{ conversation.user }}</div>
        <div class="bubble" v-html="conversation.prompt" />
      </div>

      <div class="turn agent-turn">
        <section class="plan">
          <div class="panel-head">
            <span class="panel-kicker">执行计划</span>
            <span class="panel-title">当前状态：{{ stateLabel }}</span>
            <span class="panel-count">{{ doneStepCount }}/{{ conversation.plan.length }}</span>
          </div>
          <div
            v-for="step in conversation.plan"
            :key="`${step.tag}-${step.title}`"
            :class="['plan-step', step.state]"
          >
            <span class="checkmark">
              <Check v-if="step.state === 'done'" class="tiny-icon" />
            </span>
            <span class="step-title">{{ step.title }}</span>
            <span class="step-tag">{{ step.tag }}</span>
          </div>
        </section>

        <p class="agent-message" v-html="conversation.agentMessage" />

        <section :class="['toolcall', toolOpen ? 'open' : '']">
          <button class="tc-head" type="button" @click="emit('update:toolOpen', !toolOpen)">
            <span class="tc-ico">
              <ClipboardCheck class="tiny-icon" />
            </span>
            <span class="tc-name">{{ conversation.toolName }}</span>
            <span class="tc-arg">{{ conversation.toolArgs }}</span>
            <ChevronRight class="tc-chev tiny-icon" />
          </button>
          <div v-show="toolOpen" class="tc-body">
            <div class="tc-label">问题清单预览</div>
            <div class="review-list">
              <div v-for="row in conversation.reviewRows" :key="`${row.ref}-${row.text}`" class="review-row">
                <span :class="['badge', row.level]">{{ row.label }}</span>
                <span>{{ row.text }}</span>
                <span class="ref">{{ row.ref }}</span>
              </div>
            </div>
            <div class="tc-label boundary">执行边界</div>
            <p class="tc-note">
              当前 Phase 0 使用 Mock Runtime，只生成任务记录、工具调用记录、事件流和 artifact，不修改用户原始文件。
            </p>
          </div>
        </section>

        <section v-if="conversation.approval" class="approval-card">
          <div class="approval-title">
            <span class="approval-icon">
              <AlertTriangle class="tiny-icon" />
            </span>
            <strong>{{ conversation.approval.title }}</strong>
          </div>
          <p v-html="conversation.approval.body" />
          <div class="approval-actions">
            <button class="btn primary" type="button">确认生成</button>
            <button class="btn ghost" type="button">查看全部问题</button>
            <button class="btn danger" type="button" @click="emit('cancelTask')">停止任务</button>
          </div>
        </section>
      </div>
    </section>

    <section class="composer" aria-label="任务输入">
      <div class="composer-inner">
        <div class="composer-modes">
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <button class="mode-select" type="button">
                <span class="mode-dot" />
                {{ composerModeLabel }}
                <ChevronRight class="tiny-icon mode-chevron" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent class="mode-menu" align="start" :side-offset="8">
              <DropdownMenuItem class="mode-menu-item" @click="emit('selectMode', 'agent')">
                <span class="mode-dot" />
                任务模式
                <Check v-if="composerMode === 'agent'" class="mode-check" />
              </DropdownMenuItem>
              <DropdownMenuItem class="mode-menu-item" @click="emit('selectMode', 'chat')">
                <span class="mode-dot" />
                问答模式
                <Check v-if="composerMode === 'chat'" class="mode-check" />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div class="mode-space" />
          <span v-for="chip in conversation.contextChips" :key="chip" class="ctx-chip">{{ chip }}</span>
        </div>
        <textarea
          ref="composerInput"
          :value="prompt"
          rows="1"
          placeholder="描述目标，或追加指令。例如：检查当前工程资料并生成审查问题清单"
          @keydown.ctrl.enter.prevent="emit('submitTask')"
          @input="updatePrompt"
        />
        <div class="composer-foot">
          <button class="comp-tool" type="button" aria-label="添加文件" title="添加文件">
            <FilePlus2 class="tiny-icon" />
          </button>
          <button class="comp-tool" type="button" aria-label="选择知识库" title="选择知识库">
            <BookOpen class="tiny-icon" />
          </button>
          <button class="comp-tool" type="button" aria-label="任务设置" title="任务设置">
            <SlidersHorizontal class="tiny-icon" />
          </button>
          <button class="comp-tool" type="button" aria-label="中断执行" title="中断执行" @click="emit('cancelTask')">
            <Pause class="tiny-icon" />
          </button>
          <span class="comp-hint">Ctrl Enter 发送 / Shift Enter 换行</span>
          <button class="send-btn" type="button" :disabled="!prompt.trim() || conversation.state === 'running'" @click="emit('submitTask')">
            <Send class="tiny-icon" />
            发送
          </button>
        </div>
      </div>
    </section>
  </main>
</template>
