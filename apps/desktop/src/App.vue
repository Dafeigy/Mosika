<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Activity, Database, FileText, MonitorCheck, RefreshCw, ShieldCheck } from "lucide-vue-next";
import { fetchHealth, type HealthResponse } from "@/api/health";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const apiBaseUrl = ref("http://127.0.0.1:8765");
const health = ref<HealthResponse | null>(null);
const error = ref("");
const loading = ref(false);

const statusText = computed(() => {
  if (loading.value) return "连接中";
  if (health.value?.status === "ok") return "已连接";
  if (error.value) return "连接失败";
  return "未验证";
});

const statusClass = computed(() => {
  if (health.value?.status === "ok") return "bg-emerald-500";
  if (error.value) return "bg-destructive";
  return "bg-slate-400";
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

onMounted(checkServer);
</script>

<template>
  <main class="min-h-screen bg-background">
    <div class="grid min-h-screen grid-cols-[64px_280px_1fr]">
      <aside class="flex flex-col items-center gap-2 bg-[#0f2744] py-4 text-slate-300">
        <div class="mb-4 grid h-9 w-9 place-items-center rounded-md bg-primary text-lg font-bold text-white">
          M
        </div>
        <Button size="icon" class="bg-primary text-white hover:bg-primary/90" aria-label="工作台">
          <MonitorCheck class="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" class="text-slate-300 hover:bg-white/10 hover:text-white" aria-label="文档">
          <FileText class="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" class="text-slate-300 hover:bg-white/10 hover:text-white" aria-label="知识库">
          <Database class="h-4 w-4" />
        </Button>
        <div class="flex-1" />
        <Button variant="ghost" size="icon" class="text-slate-300 hover:bg-white/10 hover:text-white" aria-label="安全">
          <ShieldCheck class="h-4 w-4" />
        </Button>
      </aside>

      <aside class="border-r bg-card">
        <div class="border-b p-4">
          <p class="font-mono text-xs uppercase tracking-wider text-muted-foreground">Mousika</p>
          <h1 class="mt-1 text-lg font-semibold">工程资料工作台</h1>
        </div>
        <div class="space-y-2 p-3">
          <button class="w-full rounded-md bg-primary/10 px-3 py-2 text-left text-sm font-medium text-primary">
            本地服务通信验证
          </button>
          <button class="w-full rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted">
            Word 文档校审
          </button>
          <button class="w-full rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted">
            Excel 表格处理
          </button>
          <button class="w-full rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted">
            CAD 图纸识别
          </button>
        </div>
      </aside>

      <section class="flex flex-col">
        <header class="flex h-14 items-center gap-3 border-b bg-card px-6">
          <span :class="['h-2 w-2 rounded-full', statusClass]" />
          <span class="text-sm text-muted-foreground">FastAPI Server</span>
          <span class="font-medium">{{ statusText }}</span>
          <span class="ml-auto font-mono text-xs text-muted-foreground">{{ apiBaseUrl }}</span>
        </header>

        <div class="flex flex-1 items-center justify-center p-8">
          <Card class="w-full max-w-2xl">
            <CardHeader>
              <CardTitle class="flex items-center gap-2">
                <Activity class="h-5 w-5 text-primary" />
                Client / Server 通信验证
              </CardTitle>
              <CardDescription>
                Vue 3 前端会请求 FastAPI 的 <span class="font-mono">/health</span> 接口，用于确认本地工作台通信链路已跑通。
              </CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
              <div class="rounded-md border bg-muted/40 p-4">
                <div class="grid gap-2 text-sm">
                  <div class="flex justify-between gap-4">
                    <span class="text-muted-foreground">状态</span>
                    <span class="font-medium">{{ statusText }}</span>
                  </div>
                  <div class="flex justify-between gap-4">
                    <span class="text-muted-foreground">服务</span>
                    <span class="font-mono">{{ health?.service ?? "-" }}</span>
                  </div>
                  <div class="flex justify-between gap-4">
                    <span class="text-muted-foreground">时间</span>
                    <span class="font-mono">{{ health?.time ?? "-" }}</span>
                  </div>
                  <div v-if="error" class="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive">
                    {{ error }}
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-3">
                <Button :disabled="loading" @click="checkServer">
                  <RefreshCw :class="['h-4 w-4', loading ? 'animate-spin' : '']" />
                  重新验证
                </Button>
                <p class="text-sm text-muted-foreground">
                  后续可把这里替换成任务创建、SSE 进度流和文件工作区状态。
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  </main>
</template>
