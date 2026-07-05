<script setup lang="ts">
import { CalendarClock, ChevronRight, FolderOpen, MoreHorizontal, Pencil, Search, Settings, SquarePen, Trash2 } from "lucide-vue-next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ConversationMock, ProjectMock } from "@/types/workbench";

defineProps<{
  projects: ProjectMock[];
  selectedProjectId: string | null;
  expandedProjectIds: string[];
  projectConversations: Record<string, ConversationMock[]>;
  directConversations: ConversationMock[];
  activeConversationId: string | null;
  activeProject: ProjectMock | null;
}>();

const emit = defineEmits<{
  startNewConversation: [];
  selectHistory: [];
  toggleProject: [projectId: string];
  openProjectFolder: [projectId: string];
  openRenameProjectDialog: [projectId: string];
  startProjectConversation: [projectId: string];
  openConversation: [conversationId: string];
  openRenameConversationDialog: [conversationId: string];
  deleteConversation: [conversationId: string];
  selectSettings: [];
}>();
</script>

<template>
  <aside class="sessions app-sidebar" aria-label="项目与对话列表">
    <div class="sidebar-brand">
      <button class="brand-mark" type="button" aria-label="Mousika 主页" title="Mousika 主页" @click="emit('startNewConversation')">
        M
      </button>
      <button class="brand-home" type="button" @click="emit('startNewConversation')">
        <span>Mousika</span>
        <small>桌面 AI 工作台</small>
      </button>
    </div>

    <div class="primary-actions" aria-label="常用操作">
      <button type="button" @click="emit('startNewConversation')">
        <SquarePen class="tiny-icon" />
        <span>新任务</span>
      </button>
      <button type="button">
        <Search class="tiny-icon" />
        <span>搜索</span>
      </button>
      <button type="button" @click="emit('selectHistory')">
        <CalendarClock class="tiny-icon" />
        <span>已安排</span>
      </button>
    </div>

    <div class="sidebar-section">
      <div class="side-head compact">
        <h2>项目</h2>
      </div>

      <div v-for="project in projects" :key="project.id" class="project-node">
        <button
          :class="[
            'project-row',
            selectedProjectId === project.id ? 'active' : '',
            expandedProjectIds.includes(project.id) ? 'expanded' : '',
          ]"
          type="button"
          @click="emit('toggleProject', project.id)"
        >
          <ChevronRight class="tree-chevron tiny-icon" />
          <FolderOpen class="tiny-icon" />
          <strong>{{ project.name }}</strong>
        </button>

        <div class="project-actions">
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <button class="project-action-btn" type="button" aria-label="更多项目操作" title="更多" @click.stop>
                <MoreHorizontal class="tiny-icon" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent class="project-action-menu" align="start" :side-offset="6">
              <DropdownMenuItem class="project-action-item" @select="emit('openProjectFolder', project.id)">
                <FolderOpen class="project-action-icon" />
                在资源管理器中打开
              </DropdownMenuItem>
              <DropdownMenuItem class="project-action-item" @select="emit('openRenameProjectDialog', project.id)">
                <Pencil class="project-action-icon" />
                重命名项目
              </DropdownMenuItem>
              <DropdownMenuItem class="project-action-item danger">
                <Trash2 class="project-action-icon" />
                移除项目
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            class="project-action-btn"
            type="button"
            aria-label="新建对话"
            title="新建对话"
            @click.stop="emit('startProjectConversation', project.id)"
          >
            <SquarePen class="tiny-icon" />
          </button>
        </div>

        <div v-if="expandedProjectIds.includes(project.id)" class="tree-children">
          <div v-for="conversation in projectConversations[project.id]" :key="conversation.id" class="conversation-node">
            <button
              :class="['tree-chat', activeConversationId === conversation.id ? 'active' : '']"
              type="button"
              @click="emit('openConversation', conversation.id)"
            >
              <span :class="['chat-dot', conversation.state]" />
              <span>{{ conversation.title }}</span>
              <span class="tree-chat-time">{{ conversation.updatedAt }}</span>
            </button>

            <div class="project-actions conversation-actions">
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <button class="project-action-btn" type="button" aria-label="更多对话操作" title="更多" @click.stop>
                    <MoreHorizontal class="tiny-icon" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent class="project-action-menu" align="start" :side-offset="6">
                  <DropdownMenuItem class="project-action-item" @select="emit('openRenameConversationDialog', conversation.id)">
                    <Pencil class="project-action-icon" />
                    重命名对话
                  </DropdownMenuItem>
                  <DropdownMenuItem class="project-action-item danger" @select="emit('deleteConversation', conversation.id)">
                    <Trash2 class="project-action-icon" />
                    删除对话
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <span v-if="!projectConversations[project.id]?.length" class="empty-tree">暂无对话</span>
        </div>
      </div>
    </div>

    <div class="direct-chat-list">
      <div class="sess-group">对话</div>
      <div v-for="chat in directConversations" :key="chat.id" class="conversation-node">
        <button
          :class="['sess-item', 'compact-chat', activeConversationId === chat.id ? 'active' : '']"
          type="button"
          @click="emit('openConversation', chat.id)"
        >
          <span class="s-title">{{ chat.title }}</span>
          <span class="s-time">{{ chat.updatedAt }}</span>
        </button>

        <div class="project-actions conversation-actions">
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <button class="project-action-btn" type="button" aria-label="更多对话操作" title="更多" @click.stop>
                <MoreHorizontal class="tiny-icon" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent class="project-action-menu" align="start" :side-offset="6">
              <DropdownMenuItem class="project-action-item" @select="emit('openRenameConversationDialog', chat.id)">
                <Pencil class="project-action-icon" />
                重命名对话
              </DropdownMenuItem>
              <DropdownMenuItem class="project-action-item danger" @select="emit('deleteConversation', chat.id)">
                <Trash2 class="project-action-icon" />
                删除对话
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>

    <div class="side-foot">
      <span class="proj-ico">
        <FolderOpen class="tiny-icon" />
      </span>
      <span class="proj-name">{{ activeProject?.name ?? "无项目对话" }}</span>
      <span class="net">{{ activeProject ? "内网" : "本地" }}</span>
      <button class="settings-link" type="button" aria-label="设置" title="设置" @click="emit('selectSettings')">
        <Settings class="tiny-icon" />
      </button>
    </div>
  </aside>
</template>
