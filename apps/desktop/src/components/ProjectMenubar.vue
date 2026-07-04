<script setup lang="ts">
import { computed, ref } from "vue";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Check, ChevronRight, FolderOpen, Plus, Search, X } from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ProjectItem = {
  name: string;
  meta?: string;
  active?: boolean;
};

defineProps<{
  projects: ProjectItem[];
  selectedProjectName: string | null;
}>();

const emit = defineEmits<{
  selectProjectName: [name: string | null];
}>();

const createDialogOpen = ref(false);
const newProjectName = ref("");
const newProjectFolder = ref("");

const trimmedProjectName = computed(() => newProjectName.value.trim());

function pathToFolderName(path: string) {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

async function chooseFolder() {
  const selected = await openDialog({
    directory: true,
    multiple: false,
    title: "选择项目文件夹",
  });

  if (typeof selected === "string") {
    newProjectFolder.value = selected;
  }
}

function openCreateProjectDialog() {
  newProjectName.value = "";
  newProjectFolder.value = "";
  createDialogOpen.value = true;
}

function createEmptyProject() {
  if (!trimmedProjectName.value) return;
  emit("selectProjectName", trimmedProjectName.value);
  createDialogOpen.value = false;
}

async function openExistingFolder() {
  const selected = await openDialog({
    directory: true,
    multiple: false,
    title: "选择现有项目文件夹",
  });

  if (typeof selected === "string") {
    emit("selectProjectName", pathToFolderName(selected));
  }
}
</script>

<template>
  <TooltipProvider>
    <Menubar class="project-menubar">
      <Tooltip v-if="selectedProjectName">
        <TooltipTrigger as-child>
          <button class="clear-project-btn" type="button" aria-label="不使用项目" @click.stop="emit('selectProjectName', null)">
            <X class="tiny-icon" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" class="project-tooltip">
          不使用项目
        </TooltipContent>
      </Tooltip>

      <MenubarMenu>
        <MenubarTrigger class="project-trigger">
          <FolderOpen class="tiny-icon" />
          <span>{{ selectedProjectName ?? "不使用项目" }}</span>
          <ChevronRight class="tiny-icon chevron-icon" />
        </MenubarTrigger>

        <MenubarContent class="project-menu" align="start" :side-offset="10">
          <label class="project-search">
            <Search class="project-search-icon" />
            <Input class="project-search-input" placeholder="搜索项目" />
          </label>

          <MenubarItem
            v-for="project in projects"
            :key="project.name"
            :class="['project-option', selectedProjectName === project.name ? 'active' : '']"
            @select="emit('selectProjectName', project.name)"
          >
            <FolderOpen class="project-menu-icon" />
            <span>{{ project.name }}</span>
            <Check v-if="selectedProjectName === project.name" class="check-icon" />
          </MenubarItem>

          <MenubarSeparator class="project-menu-divider" />

          <MenubarSub>
            <MenubarSubTrigger class="project-option new-project">
              <Plus class="project-menu-icon" />
              <span>新建项目</span>
            </MenubarSubTrigger>
            <MenubarSubContent class="project-submenu">
              <MenubarItem class="project-submenu-item" @select="openCreateProjectDialog">
                <Plus class="project-menu-icon" />
                新建空白项目
              </MenubarItem>
              <MenubarItem class="project-submenu-item" @select="openExistingFolder">
                <FolderOpen class="project-menu-icon" />
                使用现有文件夹
              </MenubarItem>
            </MenubarSubContent>
          </MenubarSub>

          <MenubarItem
            :class="['project-option', 'no-project', selectedProjectName === null ? 'active' : '']"
            @select="emit('selectProjectName', null)"
          >
            <X class="project-menu-icon" />
            <span>不使用项目</span>
            <Check v-if="selectedProjectName === null" class="check-icon" />
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>

    <Dialog v-model:open="createDialogOpen">
      <DialogContent class="create-project-dialog">
        <DialogHeader>
          <DialogTitle>新建空白项目</DialogTitle>
          <DialogDescription>输入项目名称，并选择项目创建位置。</DialogDescription>
        </DialogHeader>

        <form class="create-project-form" @submit.prevent="createEmptyProject">
          <div class="form-field">
            <Label for="new-project-name">项目名称</Label>
            <Input
              id="new-project-name"
              v-model="newProjectName"
              autocomplete="off"
              placeholder="例如：华东院数字化项目"
            />
          </div>

          <div class="form-field">
            <Label for="new-project-folder">项目文件夹</Label>
            <div class="folder-picker-row">
              <Input
                id="new-project-folder"
                :model-value="newProjectFolder"
                readonly
                placeholder="选择项目创建位置"
              />
              <button class="secondary-btn" type="button" @click="chooseFolder">选择文件夹</button>
            </div>
          </div>

          <DialogFooter class="create-project-footer">
            <button class="secondary-btn" type="button" @click="createDialogOpen = false">取消</button>
            <button class="primary-btn" type="submit" :disabled="!trimmedProjectName">创建项目</button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </TooltipProvider>
</template>

<style scoped>
.project-menubar {
  height: 28px;
  gap: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  box-shadow: none;
  padding: 0;
}

.clear-project-btn {
  display: inline-flex;
  width: 18px;
  height: 28px;
  align-items: center;
  justify-content: flex-end;
  border-radius: 999px 0 0 999px;
  color: var(--accent);
  padding: 0 2px 0 6px;
}

.clear-project-btn:hover,
.clear-project-btn:focus-visible {
  background: var(--surface-blue);
  color: var(--accent-hover);
}

.project-trigger {
  height: 28px;
  max-width: 220px;
  gap: 5px;
  border-radius: 999px;
  color: var(--accent);
  padding: 0 8px;
  font-size: 12px;
}

.clear-project-btn + :deep([data-radix-menubar-menu]) .project-trigger,
.clear-project-btn + * .project-trigger {
  border-radius: 0 999px 999px 0;
  padding-left: 5px;
}

.project-trigger span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-trigger:hover,
.project-trigger:focus-visible,
.project-trigger[data-state="open"] {
  background: var(--surface-blue);
  color: var(--accent);
}

.project-trigger[data-state="open"] .chevron-icon {
  transform: rotate(90deg);
}

.project-menu {
  width: 262px;
  border-color: var(--border-soft);
  border-radius: 8px;
  box-shadow: 0 18px 52px rgba(15, 39, 68, 0.16);
}

.project-search {
  position: relative;
  display: block;
  color: var(--meta);
  margin-bottom: 5px;
}

.project-search-icon {
  position: absolute;
  top: 50%;
  left: 10px;
  z-index: 1;
  width: 10px;
  height: 10px;
  color: var(--meta);
  stroke-width: 1.8;
  opacity: 0.72;
  transform: translateY(-50%);
}

.project-search-input {
  height: 27px;
  border: 0;
  border-radius: 6px;
  background: hsl(var(--background));
  padding-left: 26px;
  font-size: 12px;
}

.project-option {
  display: grid;
  grid-template-columns: 12px minmax(0, 1fr) 12px;
  align-items: center;
  min-height: 28px;
  column-gap: 10px;
  border-radius: 6px;
  color: var(--fg-2);
  padding: 0 9px;
  font-size: 12px;
}

.project-option:hover,
.project-option:focus,
.project-option.active,
.project-option[data-highlighted],
.project-option[data-state="open"] {
  background: var(--surface-blue);
  color: var(--accent);
}

.project-option span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-menu-divider {
  background: hsl(var(--border));
  margin: 5px 0;
}

.project-submenu {
  width: 174px;
  border-color: var(--border-soft);
  border-radius: 8px;
  box-shadow: 0 18px 52px rgba(15, 39, 68, 0.14);
}

.project-submenu-item {
  display: flex;
  min-height: 28px;
  align-items: center;
  gap: 10px;
  border-radius: 6px;
  color: var(--fg-2);
  padding: 0 9px;
  font-size: 12px;
}

.project-submenu-item:hover,
.project-submenu-item:focus,
.project-submenu-item[data-highlighted] {
  background: var(--surface-blue);
  color: var(--accent);
}

.project-tooltip {
  border-radius: 6px;
  font-size: 12px;
}

.project-trigger :deep(.tiny-icon),
.clear-project-btn :deep(.tiny-icon) {
  width: 14px;
  height: 14px;
  flex: none;
  stroke-width: 2;
}

.project-menu-icon {
  width: 12px;
  height: 12px;
  flex: none;
  stroke-width: 1.9;
  opacity: 0.82;
}

.check-icon {
  width: 10px;
  height: 10px;
  justify-self: end;
  stroke-width: 2.1;
}

.create-project-dialog {
  width: min(460px, calc(100vw - 32px));
  gap: 18px;
  border-color: var(--border-soft);
  border-radius: 10px;
  background: hsl(var(--card));
}

.create-project-form {
  display: grid;
  gap: 16px;
}

.create-project-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 2px;
}

.form-field {
  display: grid;
  gap: 8px;
}

.folder-picker-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.primary-btn,
.secondary-btn {
  display: inline-flex;
  min-width: 74px;
  min-height: 32px;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 700;
}

.primary-btn {
  background: var(--accent);
  color: #fff;
}

.primary-btn:hover {
  background: var(--accent-hover);
}

.primary-btn:disabled {
  cursor: not-allowed;
  border: 1px solid hsl(var(--border));
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  opacity: 1;
}

.secondary-btn {
  border: 1px solid hsl(var(--border));
  background: hsl(var(--card));
  color: var(--fg-2);
}

.secondary-btn:hover {
  background: var(--surface-blue);
  color: var(--accent);
}
</style>
