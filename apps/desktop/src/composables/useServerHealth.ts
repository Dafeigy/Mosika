import { computed, ref } from "vue";
import { fetchHealth, type HealthResponse } from "@/api/health";

export function useServerHealth() {
  const apiBaseUrl = ref("http://127.0.0.1:8765");
  const health = ref<HealthResponse | null>(null);
  const error = ref("");
  const loading = ref(false);

  const serverStatusText = computed(() => {
    if (loading.value) return "连接中";
    if (health.value?.status === "ok") return "已连接";
    if (error.value) return "连接失败";
    return "未验证";
  });

  const serverStateClass = computed(() => {
    if (health.value?.status === "ok") return "ok";
    if (error.value) return "error";
    return "pending";
  });

  const serverDetail = computed(() => {
    if (health.value?.status === "ok") return `${health.value.service} / ${apiBaseUrl.value}`;
    if (error.value) return error.value;
    return apiBaseUrl.value;
  });

  async function checkServer() {
    loading.value = true;
    error.value = "";

    try {
      const result = await fetchHealth({ attempts: 20, intervalMs: 500 });
      apiBaseUrl.value = result.apiBaseUrl;
      health.value = result.health;
    } catch (err) {
      health.value = null;
      error.value = err instanceof Error ? err.message : "无法连接本地服务";
    } finally {
      loading.value = false;
    }
  }

  return {
    apiBaseUrl,
    health,
    error,
    loading,
    serverStatusText,
    serverStateClass,
    serverDetail,
    checkServer,
  };
}
