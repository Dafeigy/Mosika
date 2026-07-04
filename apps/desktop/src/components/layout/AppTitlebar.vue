<script setup lang="ts">
import { Maximize2, Minus, PanelLeft, RefreshCw, X } from "lucide-vue-next";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";
import type { ActiveView } from "@/types/workbench";

defineProps<{
  sidebarCollapsed: boolean;
  serverStateClass: string;
  serverDetail: string;
  serverStatusText: string;
  loading: boolean;
  windowMaximized: boolean;
}>();

const emit = defineEmits<{
  toggleSidebar: [];
  startNewConversation: [];
  selectView: [view: ActiveView];
  checkServer: [];
  minimizeWindow: [];
  toggleMaximizeWindow: [];
  closeWindow: [];
}>();
</script>

<template>
  <header class="app-titlebar">
    <div class="titlebar-left">
      <button
        class="titlebar-icon-btn"
        type="button"
        :aria-label="sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'"
        :title="sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'"
        @click="emit('toggleSidebar')"
      >
        <PanelLeft class="titlebar-icon" />
      </button>

      <Menubar class="window-menubar">
        <MenubarMenu>
          <MenubarTrigger class="window-menu-trigger">文件</MenubarTrigger>
          <MenubarContent class="window-menu-content" align="start" :side-offset="8">
            <MenubarItem class="window-menu-item" @select="emit('startNewConversation')">
              新建任务
              <MenubarShortcut>Ctrl+N</MenubarShortcut>
            </MenubarItem>
            <MenubarItem class="window-menu-item">打开项目文件夹</MenubarItem>
            <MenubarSeparator class="window-menu-separator" />
            <MenubarItem class="window-menu-item">导出结果</MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger class="window-menu-trigger">编辑</MenubarTrigger>
          <MenubarContent class="window-menu-content" align="start" :side-offset="8">
            <MenubarItem class="window-menu-item">撤销</MenubarItem>
            <MenubarItem class="window-menu-item">重做</MenubarItem>
            <MenubarSeparator class="window-menu-separator" />
            <MenubarItem class="window-menu-item">查找</MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger class="window-menu-trigger">视图</MenubarTrigger>
          <MenubarContent class="window-menu-content" align="start" :side-offset="8">
            <MenubarItem class="window-menu-item" @select="emit('toggleSidebar')">
              {{ sidebarCollapsed ? "展开侧边栏" : "收起侧边栏" }}
            </MenubarItem>
            <MenubarItem class="window-menu-item" @select="emit('selectView', 'workbench')">工作台</MenubarItem>
            <MenubarItem class="window-menu-item" @select="emit('selectView', 'history')">任务历史</MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger class="window-menu-trigger">帮助</MenubarTrigger>
          <MenubarContent class="window-menu-content" align="start" :side-offset="8">
            <MenubarItem class="window-menu-item">Mousika 文档</MenubarItem>
            <MenubarItem class="window-menu-item">键盘快捷键</MenubarItem>
            <MenubarSeparator class="window-menu-separator" />
            <MenubarItem class="window-menu-item">关于 Mousika</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>

    <div class="titlebar-drag-space" data-tauri-drag-region aria-hidden="true" @dblclick="emit('toggleMaximizeWindow')" />

    <div class="titlebar-status">
      <span class="server-chip" :class="serverStateClass" :title="serverDetail">
        <span class="server-dot" />
        <span>{{ serverStatusText }}</span>
      </span>
      <button class="titlebar-icon-btn" type="button" aria-label="重试本地服务" title="重试本地服务" @click="emit('checkServer')">
        <RefreshCw :class="['titlebar-icon', loading ? 'spin' : '']" />
      </button>
    </div>

    <div class="window-controls">
      <button class="window-control" type="button" aria-label="最小化" title="最小化" @click="emit('minimizeWindow')">
        <Minus class="titlebar-icon" />
      </button>
      <button
        class="window-control"
        type="button"
        :aria-label="windowMaximized ? '还原' : '最大化'"
        :title="windowMaximized ? '还原' : '最大化'"
        @click="emit('toggleMaximizeWindow')"
      >
        <Maximize2 class="titlebar-icon small" />
      </button>
      <button class="window-control close" type="button" aria-label="关闭" title="关闭" @click="emit('closeWindow')">
        <X class="titlebar-icon" />
      </button>
    </div>
  </header>
</template>
