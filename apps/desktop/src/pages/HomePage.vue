<script setup lang="ts">
import { ChevronRight, FileText, Plus, Send } from "lucide-vue-next";
import ProjectMenubar from "@/components/ProjectMenubar.vue";
import type { ProjectMock } from "@/types/workbench";

defineProps<{
  prompt: string;
  projects: ProjectMock[];
  selectedProjectName: string | null;
  suggestions: string[];
}>();

const emit = defineEmits<{
  "update:prompt": [value: string];
  openWorkbench: [];
  selectHomeProjectName: [projectName: string | null];
}>();

function updatePrompt(event: Event) {
  emit("update:prompt", (event.target as HTMLTextAreaElement).value);
}
</script>

<template>
  <main class="main home-main">
    <section class="home-hero">
      <div class="home-brand">
        <div class="home-mark">M</div>
        <span>Mousika</span>
      </div>
      <h1>今天该做些什么呢？</h1>
      <div class="home-composer">
        <textarea
          :value="prompt"
          rows="3"
          placeholder="随便输入，例如：帮我审查一份可研报告，检查术语、参数表和规范引用"
          @keydown.ctrl.enter.prevent="emit('openWorkbench')"
          @input="updatePrompt"
        />
        <div class="home-tools">
          <button type="button" aria-label="添加文件" title="添加文件">
            <Plus class="tiny-icon" />
          </button>
          <button type="button" @click="emit('openWorkbench')">
            <FileText class="tiny-icon" />
            请求批准
            <ChevronRight class="tiny-icon" />
          </button>
          <div class="home-tool-space" />
          <button class="home-send" type="button" aria-label="进入工作台" title="进入工作台" @click="emit('openWorkbench')">
            <Send class="tiny-icon" />
          </button>
        </div>
        <div class="home-context">
          <ProjectMenubar
            :projects="projects"
            :selected-project-name="selectedProjectName"
            @select-project-name="emit('selectHomeProjectName', $event)"
          />
        </div>
      </div>

      <div class="home-suggestions">
        <button
          v-for="suggestion in suggestions"
          :key="suggestion"
          type="button"
          @click="emit('update:prompt', suggestion)"
        >
          {{ suggestion }}
        </button>
      </div>
    </section>
  </main>
</template>
