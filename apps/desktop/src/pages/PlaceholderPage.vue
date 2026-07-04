<script setup lang="ts">
import { Clock3, SquarePen, TerminalSquare } from "lucide-vue-next";
import type { NavItem } from "@/types/workbench";

defineProps<{
  navItem: NavItem;
}>();

const emit = defineEmits<{
  openWorkbench: [];
}>();
</script>

<template>
  <main class="main under-dev-main">
    <section class="under-dev">
      <div class="under-dev-icon">
        <component :is="navItem.icon" class="under-dev-main-icon" />
      </div>
      <div class="under-dev-copy">
        <span class="under-dev-kicker">In development</span>
        <h1>{{ navItem.label }} 功能正在开发中</h1>
        <p>{{ navItem.description }}。当前版本先开放主工作台流程，后续会逐步接入该模块的真实数据与操作能力。</p>
      </div>
      <div class="under-dev-grid">
        <div class="under-dev-card">
          <SquarePen class="tiny-icon" />
          <strong>信息架构</strong>
          <span>梳理模块入口、主要列表、详情页和操作边界。</span>
        </div>
        <div class="under-dev-card">
          <TerminalSquare class="tiny-icon" />
          <strong>接口契约</strong>
          <span>对齐 FastAPI 路由、状态模型和前端 API client。</span>
        </div>
        <div class="under-dev-card">
          <Clock3 class="tiny-icon" />
          <strong>迭代计划</strong>
          <span>按敏捷任务拆分，优先实现最短可用闭环。</span>
        </div>
      </div>
      <button class="btn primary" type="button" @click="emit('openWorkbench')">
        返回工作台
      </button>
    </section>
  </main>
</template>
