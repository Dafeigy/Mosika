import { computed, reactive, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { defaultProjects } from "@/data/mockWorkbench";
import type { ProjectMock } from "@/types/workbench";

export function useProjectRegistry() {
  const homeProjects = reactive<ProjectMock[]>([...defaultProjects]);
  const selectedHomeProjectId = ref<string | null>(null);
  const expandedProjectIds = ref<string[]>(homeProjects.map((project) => project.id));
  const renameProjectDialogOpen = ref(false);
  const renamingProjectId = ref<string | null>(null);
  const renameProjectName = ref("");

  const selectedHomeProjectName = computed(() => {
    return homeProjects.find((project) => project.id === selectedHomeProjectId.value)?.name ?? null;
  });

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

  function ensureProjectExpanded(projectId: string) {
    if (!expandedProjectIds.value.includes(projectId)) {
      expandedProjectIds.value = [...expandedProjectIds.value, projectId];
    }
  }

  return {
    homeProjects,
    selectedHomeProjectId,
    expandedProjectIds,
    renameProjectDialogOpen,
    renamingProjectId,
    renameProjectName,
    selectedHomeProjectName,
    loadProjectRegistry,
    saveProjectRegistry,
    selectHomeProjectName,
    toggleProject,
    openProjectFolder,
    openRenameProjectDialog,
    renameProject,
    ensureProjectExpanded,
  };
}
