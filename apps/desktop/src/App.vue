<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Database,
  Download,
  FilePlus2,
  FileText,
  FolderOpen,
  History,
  ListChecks,
  MoreHorizontal,
  Pause,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  SlidersHorizontal,
  SquarePen,
  TerminalSquare,
  Workflow,
} from "lucide-vue-next";
import { fetchHealth, type HealthResponse } from "@/api/health";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ProjectMenubar from "@/components/ProjectMenubar.vue";

type SessionState = "running" | "waiting" | "done" | "failed" | "idle";
type InspectorTab = "result" | "source" | "context";
type ComposerMode = "agent" | "chat";
type ActiveView = "home" | "workbench" | "documents" | "knowledge" | "history" | "settings";

const apiBaseUrl = ref("http://127.0.0.1:8765");
const health = ref<HealthResponse | null>(null);
const error = ref("");
const loading = ref(false);
const inspectorTab = ref<InspectorTab>("result");
const composerMode = ref<ComposerMode>("agent");
const activeView = ref<ActiveView>("home");
const toolOpen = ref(true);
const prompt = ref("");
const composerInput = ref<HTMLTextAreaElement | null>(null);

const navItems = [
  { id: "workbench", label: "工作台", icon: Workflow, description: "工程资料任务编排与 Agent 执行工作区" },
  { id: "documents", label: "文档", icon: FileText, description: "Word、PDF、图纸和表格资料管理" },
  { id: "knowledge", label: "知识库", icon: Database, description: "企业规范、典设、项目术语和审查依据" },
  { id: "history", label: "任务历史", icon: History, description: "历史任务、执行记录、导出结果和审计追踪" },
  { id: "settings", label: "设置", icon: Settings, description: "模型、服务、路径、日志和开发者选项" },
] as const;

const homeProjects = [
  { name: "华东院数字化项目", meta: "6 个任务 / 3 个知识库", active: true },
  { name: "变电一所资料工作区", meta: "12 份文档 / 4 份图纸 / 内网资料", active: false },
  { name: "示例工程审查项目", meta: "演示数据 / 可研报告 / 参数表", active: false },
];
const selectedHomeProjectName = ref<string | null>(homeProjects.find((project) => project.active)?.name ?? null);

const homeSuggestions = [
  "校审一份 Word 可研报告",
  "提取图纸图签文字",
  "检查 Excel 参数表",
  "查询企业规范库",
];

const sessions: Array<{
  title: string;
  meta: string;
  state: SessionState;
  active?: boolean;
}> = [
  { title: "220kV 变电站可研报告校审", meta: "执行中 / 步骤 4/6", state: "running", active: true },
  { title: "主变参数表公式核验", meta: "等待确认 / Excel", state: "waiting" },
  { title: "总平面图图签文字提取", meta: "已完成 / 1 小时前", state: "done" },
  { title: "继电保护章节规范问答", meta: "已完成 / 3 小时前", state: "done" },
  { title: "电缆清册重复项检查", meta: "已中止 / 用户取消", state: "failed" },
  { title: "初设说明书摘要生成", meta: "已归档 / Word", state: "idle" },
];

const planSteps = [
  { title: "复制原文件到受控工作区，计算文件指纹", tag: "import", state: "done" },
  { title: "解析 Word 结构、标题层级、表格与图纸编号", tag: "parse", state: "done" },
  { title: "检索企业知识库中的典设、国标和审查要点", tag: "rag", state: "done" },
  { title: "核对主变容量、接线方式、术语和引用条款", tag: "review", state: "current" },
  { title: "生成问题清单与建议修改稿", tag: "draft", state: "pending" },
  { title: "等待人工确认后导出校审报告", tag: "approve", state: "pending" },
];

const reviewRows = [
  { level: "high", label: "高风险", text: "第 3.2 节主变容量为 2x180MVA，但设备参数表为 2x240MVA。", ref: "P12 / 表 3-1" },
  { level: "high", label: "高风险", text: "第 5.1 节使用“单母线分段”，图纸图签标注为“双母线接线”。", ref: "P26 / A-02" },
  { level: "mid", label: "需确认", text: "“站用变”与“所用变”混用，建议统一为项目术语库指定写法。", ref: "全文 8 处" },
  { level: "low", label: "建议", text: "图 4-3 在正文中首次引用早于图号定义，建议调整引用顺序。", ref: "P18" },
];

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

const activeNavItem = computed(() => {
  if (activeView.value === "home") {
    return {
      id: "home",
      label: "Mousika",
      icon: Workflow,
      description: "桌面 AI 工作台主页",
    };
  }

  return navItems.find((item) => item.id === activeView.value) ?? navItems[0];
});

const composerModeLabel = computed(() => (composerMode.value === "agent" ? "任务模式" : "问答模式"));

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

async function growComposer() {
  await nextTick();
  const input = composerInput.value;
  if (!input) return;
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
}

function selectMode(mode: ComposerMode) {
  composerMode.value = mode;
}

function openWorkbenchFromHome() {
  activeView.value = "workbench";
}

function selectHomeProjectName(projectName: string | null) {
  selectedHomeProjectName.value = projectName;
}

onMounted(() => {
  checkServer();
  growComposer();
});
</script>

<template>
  <div class="workbench">
    <aside class="activity" aria-label="主导航">
      <button class="brand-mark" type="button" aria-label="Mousika 主页" title="Mousika 主页" @click="activeView = 'home'">
        M
      </button>
      <button
        v-for="item in navItems.slice(0, 4)"
        :key="item.id"
        :class="['nav-btn', activeView === item.id ? 'active' : '']"
        type="button"
        :aria-label="item.label"
        :title="item.label"
        @click="activeView = item.id"
      >
        <component :is="item.icon" class="icon" />
      </button>
      <div class="activity-spacer" />
      <button
        v-for="item in navItems.slice(4)"
        :key="item.id"
        :class="['nav-btn', activeView === item.id ? 'active' : '']"
        type="button"
        :aria-label="item.label"
        :title="item.label"
        @click="activeView = item.id"
      >
        <component :is="item.icon" class="icon" />
      </button>
    </aside>

    <header class="titlebar">
      <nav class="crumb" aria-label="当前位置">
        <button type="button" @click="activeView = 'home'">Mousika</button>
        <template v-if="activeView !== 'home'">
          <ChevronRight class="crumb-icon" />
          <button type="button" @click="activeView = 'workbench'">华东院数字化项目</button>
          <ChevronRight class="crumb-icon" />
          <strong>{{ activeNavItem.label }}</strong>
        </template>
      </nav>
      <div class="server-chip" :class="serverStateClass" :title="serverDetail">
        <span class="server-dot" />
        <span>Local Server {{ serverStatusText }}</span>
      </div>
      <button class="kbd-btn" type="button" @click="checkServer">
        <RefreshCw :class="['tiny-icon', loading ? 'spin' : '']" />
        重试
      </button>
      <span class="kbd">Ctrl K</span>
      <span class="kbd">Ctrl Enter</span>
    </header>

    <aside v-if="activeView === 'workbench'" class="sessions" aria-label="任务列表">
      <div class="side-head">
        <h2>任务</h2>
        <button class="new-btn" type="button" aria-label="新建任务" title="新建任务">
          <Plus class="tiny-icon" />
        </button>
      </div>

      <label class="side-search">
        <Search class="tiny-icon" />
        <input type="text" placeholder="搜索任务、文件或项目" />
      </label>

      <div class="quick-actions">
        <button type="button">文档校审</button>
        <button type="button">图纸提取</button>
        <button type="button">表格检查</button>
        <button type="button">知识问答</button>
      </div>

      <div class="sess-list">
        <div class="sess-group">今天</div>
        <button
          v-for="session in sessions.slice(0, 4)"
          :key="session.title"
          :class="['sess-item', session.active ? 'active' : '']"
          type="button"
        >
          <span class="s-title">{{ session.title }}</span>
          <span class="s-meta">
            <span :class="['s-dot', session.state]" />
            {{ session.meta }}
          </span>
        </button>

        <div class="sess-group">昨天</div>
        <button
          v-for="session in sessions.slice(4)"
          :key="session.title"
          class="sess-item"
          type="button"
        >
          <span class="s-title">{{ session.title }}</span>
          <span class="s-meta">
            <span :class="['s-dot', session.state]" />
            {{ session.meta }}
          </span>
        </button>
      </div>

      <div class="side-foot">
        <span class="proj-ico">
          <FolderOpen class="tiny-icon" />
        </span>
        <span class="proj-name">华东院 / 变电一所</span>
        <span class="net">内网</span>
      </div>
    </aside>

    <main v-if="activeView === 'home'" class="main home-main">
      <section class="home-hero">
        <div class="home-brand">
          <div class="home-mark">M</div>
          <span>Mousika</span>
        </div>
        <h1>今天该做些什么呢？</h1>
        <div class="home-composer">
          <textarea
            v-model="prompt"
            rows="3"
            placeholder="随便输入，例如：帮我校审一份可研报告，检查术语、参数表和规范引用"
            @input="growComposer"
          />
          <div class="home-tools">
            <button type="button" aria-label="添加文件" title="添加文件">
              <Plus class="tiny-icon" />
            </button>
            <button type="button" @click="activeView = 'workbench'">
              <FileText class="tiny-icon" />
              请求批准
              <ChevronRight class="tiny-icon" />
            </button>
            <div class="home-tool-space" />
            <button class="home-send" type="button" aria-label="进入工作台" title="进入工作台" @click="activeView = 'workbench'">
              <Send class="tiny-icon" />
            </button>
          </div>
          <div class="home-context">
            <ProjectMenubar
              :projects="homeProjects"
              :selected-project-name="selectedHomeProjectName"
              @select-project-name="selectHomeProjectName"
            />

          </div>
        </div>

        <div class="home-suggestions">
          <button
            v-for="suggestion in homeSuggestions"
            :key="suggestion"
            type="button"
            @click="prompt = suggestion"
          >
            {{ suggestion }}
          </button>
        </div>
      </section>
    </main>

    <main v-else-if="activeView === 'workbench'" class="main">
      <div class="main-head">
        <span class="task-id">TASK-20260703-0148</span>
        <h1>220kV 变电站可研报告校审</h1>
        <span class="stat-pill"><span />执行中 / 规范核对 4/6</span>
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
          <div class="avatar">林</div>
          <div class="bubble">
            请校审 <code>220kV 城南变电站可研报告.docx</code>，重点检查术语一致性、章节编号、设备参数表引用，以及是否存在与公司典设和现行规范冲突的表述。先生成问题清单，不要直接覆盖原文件。
          </div>
        </div>

        <div class="turn agent-turn">
          <div class="summary-strip">
            <div class="metric danger"><span>高风险</span><strong>3</strong></div>
            <div class="metric warn"><span>需确认</span><strong>12</strong></div>
            <div class="metric success"><span>自动修复建议</span><strong>18</strong></div>
            <div class="metric"><span>引用依据</span><strong>7</strong></div>
          </div>

          <section class="plan">
            <div class="panel-head">
              <span class="panel-kicker">执行计划</span>
              <span class="panel-title">已拆解为 6 个步骤，当前正在核对规范和典设依据</span>
              <span class="panel-count">4/6</span>
            </div>
            <div
              v-for="step in planSteps"
              :key="step.title"
              :class="['plan-step', step.state]"
            >
              <span class="checkmark">
                <Check v-if="step.state === 'done'" class="tiny-icon" />
              </span>
              <span class="step-title">{{ step.title }}</span>
              <span class="step-tag">{{ step.tag }}</span>
            </div>
          </section>

          <p class="agent-message">
            已完成文档结构解析和知识库检索。当前发现 <strong>3 个高风险项</strong>，主要集中在主变容量表述、接线方式术语和图纸编号引用；原始 Word 文件保持只读，所有修改建议都写入任务工作区副本。
          </p>

          <section :class="['toolcall', toolOpen ? 'open' : '']">
            <button class="tc-head" type="button" @click="toolOpen = !toolOpen">
              <span class="tc-ico">
                <ClipboardCheck class="tiny-icon" />
              </span>
              <span class="tc-name">word.review</span>
              <span class="tc-arg">术语一致性 / 规范条款 / 编号引用</span>
              <ChevronRight class="tc-chev tiny-icon" />
            </button>
            <div v-show="toolOpen" class="tc-body">
              <div class="tc-label">问题清单预览</div>
              <div class="review-list">
                <div v-for="row in reviewRows" :key="row.text" class="review-row">
                  <span :class="['badge', row.level]">{{ row.label }}</span>
                  <span>{{ row.text }}</span>
                  <span class="ref">{{ row.ref }}</span>
                </div>
              </div>
              <div class="tc-label boundary">执行边界</div>
              <p class="tc-note">
                当前任务仅处理工作区副本，不写回原文件；涉及规范解释和覆盖原文件的动作需要人工确认。
              </p>
            </div>
          </section>

          <section class="approval">
            <div class="approval-title">
              <span class="approval-icon">
                <AlertTriangle class="tiny-icon" />
              </span>
              <strong>需要确认：是否生成带批注的校审稿</strong>
            </div>
            <p>
              即将基于工作区副本生成 <code>220kV 城南变电站可研报告.reviewed.docx</code> 和 <code>校审问题清单.xlsx</code>。不会覆盖原文件。
            </p>
            <div class="approval-actions">
              <button class="btn primary" type="button">确认生成</button>
              <button class="btn ghost" type="button">查看全部问题</button>
              <button class="btn danger" type="button">停止任务</button>
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
                <DropdownMenuItem class="mode-menu-item" @click="selectMode('agent')">
                  <span class="mode-dot" />
                  任务模式
                  <Check v-if="composerMode === 'agent'" class="mode-check" />
                </DropdownMenuItem>
                <DropdownMenuItem class="mode-menu-item" @click="selectMode('chat')">
                  <span class="mode-dot" />
                  问答模式
                  <Check v-if="composerMode === 'chat'" class="mode-check" />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div class="mode-space" />
            <span class="ctx-chip">可研报告.docx</span>
            <span class="ctx-chip">企业规范库</span>
            <span class="ctx-chip">本地工作区</span>
          </div>
          <textarea
            ref="composerInput"
            v-model="prompt"
            rows="1"
            placeholder="描述目标，或追加指令。例如：把高风险项单独导出为审查意见回复表"
            @input="growComposer"
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
            <button class="comp-tool" type="button" aria-label="中断执行" title="中断执行">
              <Pause class="tiny-icon" />
            </button>
            <span class="comp-hint">Ctrl Enter 发送 / Shift Enter 换行</span>
            <button class="send-btn" type="button">
              <Send class="tiny-icon" />
              发送
            </button>
          </div>
        </div>
      </section>
    </main>

    <main v-else class="main under-dev-main">
      <section class="under-dev">
        <div class="under-dev-icon">
          <component :is="activeNavItem.icon" class="under-dev-main-icon" />
        </div>
        <div class="under-dev-copy">
          <span class="under-dev-kicker">In development</span>
          <h1>{{ activeNavItem.label }} 功能正在开发中</h1>
          <p>{{ activeNavItem.description }}。当前版本先开放主工作台流程，后续会逐步接入该模块的真实数据与操作能力。</p>
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
        <button class="btn primary" type="button" @click="activeView = 'workbench'">
          返回工作台
        </button>
      </section>
    </main>

    <aside v-if="activeView === 'workbench'" class="inspector" aria-label="检查器">
      <div class="insp-head">
        <button :class="['insp-tab', inspectorTab === 'result' ? 'active' : '']" type="button" @click="inspectorTab = 'result'">结果</button>
        <button :class="['insp-tab', inspectorTab === 'source' ? 'active' : '']" type="button" @click="inspectorTab = 'source'">依据</button>
        <button :class="['insp-tab', inspectorTab === 'context' ? 'active' : '']" type="button" @click="inspectorTab = 'context'">上下文</button>
      </div>

      <div class="insp-body">
        <section v-if="inspectorTab === 'result'">
          <div class="panel-title-line">
            <CheckCircle2 class="tiny-icon accent" />
            <strong>校审结果</strong>
            <span class="badge high">3 高风险</span>
          </div>
          <article class="issue high">
            <div><span class="badge high">高风险</span><span class="loc">P12 / 表 3-1</span></div>
            <h3>主变容量前后不一致</h3>
            <p>正文写作 2x180MVA，设备参数表写作 2x240MVA。建议确认设计输入后统一。</p>
            <blockquote>建议：将第 3.2 节容量描述与表 3-1 统一，并在修订说明中记录依据来源。</blockquote>
          </article>
          <article class="issue high">
            <div><span class="badge high">高风险</span><span class="loc">P26 / 图 A-02</span></div>
            <h3>接线方式与图纸标注冲突</h3>
            <p>说明书为单母线分段，图签识别结果为双母线接线，需人工确认。</p>
          </article>
          <article class="issue">
            <div><span class="badge mid">需确认</span><span class="loc">全文 8 处</span></div>
            <h3>术语写法不一致</h3>
            <p>“站用变”和“所用变”混用。项目术语库建议使用“站用变”。</p>
          </article>
        </section>

        <section v-else-if="inspectorTab === 'source'">
          <div class="ctx-card">
            <span>引用依据</span>
            <strong>GB 50059-2011</strong>
            <p>35kV-110kV 变电站设计规范 / 第 3.1.2 条</p>
          </div>
          <div class="ctx-card">
            <span>企业资料</span>
            <strong>220kV 变电站典型设计</strong>
            <p>2024 版 / 主接线与设备配置章节</p>
          </div>
          <div class="ctx-card">
            <span>项目术语库</span>
            <strong>变电一次专业术语表</strong>
            <p>命中 12 条 / 发现 8 处不一致</p>
          </div>
        </section>

        <section v-else>
          <div class="ctx-card">
            <span>当前模型</span>
            <strong>企业内网模型 / 文档校审 Agent</strong>
            <p>外部 API 调用：关闭</p>
          </div>
          <div class="ctx-card">
            <span>任务工作区</span>
            <strong>只读原文件 + 副本处理</strong>
            <p>原文件不会被覆盖，导出需要人工确认。</p>
          </div>
          <div class="ctx-card">
            <span>上下文占用</span>
            <strong>42,800 / 200k token</strong>
            <div class="token-bar"><span /></div>
            <p>21% / 剩余约 157k</p>
          </div>
          <div class="ctx-card">
            <span>工具调用</span>
            <strong>9 次</strong>
            <p>docx.parse 1 / rag.search 4 / word.review 3 / file.export 1</p>
          </div>
        </section>
      </div>
    </aside>

    <footer class="statusbar">
      <span :class="['s-dot', health?.status === 'ok' ? 'done' : 'waiting']" />
      <span>任务执行中</span>
      <span class="sep">|</span>
      <span>步骤 4/6 / 规范核对</span>
      <span class="sep">|</span>
      <span>本地 FastAPI: {{ apiBaseUrl }}</span>
      <span class="sep">|</span>
      <div class="status-right">
        <span>知识库 7 条命中</span>
        <span class="sep">|</span>
        <span>3 高风险</span>
        <span class="sep">|</span>
        <span>42k/200k token</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.workbench {
  display: grid;
  grid-template-columns: 64px 280px minmax(520px, 1fr) 400px;
  grid-template-rows: 44px minmax(0, 1fr) 28px;
  grid-template-areas:
    "activity title title title"
    "activity sessions main inspector"
    "activity status status status";
  height: 100vh;
  overflow: hidden;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}

button,
input,
textarea {
  font: inherit;
}

button {
  cursor: pointer;
}

button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(31, 101, 179, 0.22);
}

input:focus-visible,
textarea:focus-visible {
  outline: none;
  box-shadow: none;
}

.icon {
  width: 20px;
  height: 20px;
}

.tiny-icon {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
}

.activity {
  grid-area: activity;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 0;
  background: #0f2744;
  color: #a7b9ce;
}

.brand-mark {
  display: grid;
  width: 36px;
  height: 36px;
  margin-bottom: 16px;
  place-items: center;
  border-radius: 8px;
  background: var(--accent);
  color: #fff;
  font-size: 18px;
  font-weight: 800;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12);
}

.nav-btn {
  position: relative;
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 6px;
  color: #a7b9ce;
  transition: background 150ms ease, color 150ms ease;
}

.nav-btn:hover,
.nav-btn.active {
  background: rgba(31, 101, 179, 0.34);
  color: #fff;
}

.nav-btn.active::before {
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: -8px;
  width: 3px;
  border-radius: 999px;
  background: #fff;
  content: "";
}

.activity-spacer {
  flex: 1;
}

.titlebar {
  grid-area: title;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--card));
  padding: 0 20px;
}

.crumb {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
}

.crumb button {
  border-radius: 4px;
  color: inherit;
  padding: 2px 4px;
}

.crumb button:hover {
  background: var(--surface-soft);
  color: var(--accent);
}

.crumb strong {
  color: hsl(var(--foreground));
  font-weight: 700;
}

.crumb-icon {
  width: 14px;
  height: 14px;
  color: var(--meta);
}

.server-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  white-space: nowrap;
}

.server-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--meta);
  box-shadow: 0 0 0 3px hsl(var(--muted));
}

.server-chip.ok .server-dot {
  background: var(--success);
  box-shadow: 0 0 0 3px var(--success-soft);
}

.server-chip.error .server-dot {
  background: var(--danger);
  box-shadow: 0 0 0 3px var(--danger-soft);
}

.kbd,
.kbd-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  border: 1px solid var(--border-soft);
  border-radius: 6px;
  background: hsl(var(--background));
  color: hsl(var(--muted-foreground));
  padding: 0 7px;
  font-family: var(--font-mono);
  font-size: 11px;
  white-space: nowrap;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.sessions,
.inspector {
  display: flex;
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
  background: hsl(var(--card));
}

.sessions {
  grid-area: sessions;
  border-right: 1px solid hsl(var(--border));
}

.side-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
}

.side-head h2,
.sess-group,
.panel-kicker,
.tc-label,
.ctx-card span {
  color: var(--meta);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.new-btn,
.icon-btn,
.comp-tool {
  display: grid;
  place-items: center;
  border-radius: 6px;
  color: hsl(var(--muted-foreground));
  transition: background 150ms ease, color 150ms ease;
}

.new-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border-soft);
  color: var(--accent);
}

.new-btn:hover,
.icon-btn:hover,
.comp-tool:hover {
  background: var(--surface-soft);
  color: var(--accent);
}

.side-search {
  position: relative;
  margin: 0 16px 12px;
  color: var(--meta);
}

.side-search .tiny-icon {
  position: absolute;
  top: 50%;
  left: 9px;
  transform: translateY(-50%);
}

.side-search input {
  width: 100%;
  height: 34px;
  border: 1px solid var(--border-soft);
  border-radius: 6px;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  padding: 0 12px 0 30px;
}

.quick-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 0 16px 12px;
}

.quick-actions button {
  height: 32px;
  border: 1px solid var(--border-soft);
  border-radius: 6px;
  background: hsl(var(--card));
  color: var(--fg-2);
  font-size: 13px;
}

.quick-actions button:hover {
  border-color: #cfe1f6;
  background: var(--surface-blue);
  color: var(--accent);
}

.sess-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 16px;
}

.sess-group {
  padding: 12px 12px 8px;
}

.sess-item {
  position: relative;
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 3px;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 8px 12px;
  text-align: left;
}

.sess-item:hover {
  background: var(--surface-soft);
}

.sess-item.active {
  border-color: #cfe1f6;
  background: var(--surface-blue);
}

.sess-item.active::before {
  position: absolute;
  top: 7px;
  bottom: 7px;
  left: 0;
  width: 3px;
  border-radius: 999px;
  background: var(--accent);
  content: "";
}

.s-title {
  overflow: hidden;
  color: var(--fg-2);
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.s-meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--meta);
  font-size: 11px;
}

.s-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--border-soft);
}

.s-dot.running {
  background: var(--accent);
  animation: pulse 1.6s ease infinite;
}

.s-dot.done {
  background: var(--success);
}

.s-dot.waiting {
  background: var(--warn);
}

.s-dot.failed {
  background: var(--danger);
}

@keyframes pulse {
  50% { opacity: 0.36; }
}

.side-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  border-top: 1px solid hsl(var(--border));
  padding: 12px 16px;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
}

.proj-ico {
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  border-radius: 6px;
  background: var(--surface-blue);
  color: var(--accent);
}

.proj-name {
  color: var(--fg-2);
  font-weight: 700;
}

.net {
  margin-left: auto;
}

.main {
  grid-area: main;
  display: flex;
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
  background: hsl(var(--background));
}

.main-head {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 50px;
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--card));
  padding: 0 24px;
}

.task-id,
.step-tag,
.panel-count,
.ref,
.loc,
.comp-hint {
  color: var(--meta);
  font-family: var(--font-mono);
  font-size: 11px;
}

.main-head h1 {
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 15px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stat-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  background: var(--surface-blue);
  color: var(--accent);
  padding: 3px 10px;
  font-family: var(--font-mono);
  font-size: 11px;
}

.stat-pill span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse 1.6s ease infinite;
}

.head-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.icon-btn {
  width: 30px;
  height: 30px;
}

.thread {
  flex: 1;
  overflow-y: auto;
  padding: 24px 0 16px;
}

.turn {
  max-width: 900px;
  margin: 0 auto;
  padding: 16px 24px;
}

.user-turn {
  display: flex;
  gap: 12px;
}

.avatar {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid #cfe1f6;
  border-radius: 50%;
  background: var(--surface-blue);
  color: var(--accent);
  font-size: 12px;
  font-weight: 800;
}

.bubble,
.plan,
.toolcall,
.metric {
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--card));
  box-shadow: 0 8px 24px rgba(31, 101, 179, 0.08);
}

.bubble {
  padding: 12px 16px;
  color: var(--fg-2);
  line-height: 1.7;
}

code {
  border-radius: 6px;
  background: var(--surface-blue);
  color: var(--accent);
  padding: 1px 6px;
  font-family: var(--font-mono);
  font-size: 13px;
}

.summary-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.metric {
  padding: 12px;
}

.metric span {
  display: block;
  margin-bottom: 4px;
  color: var(--meta);
  font-size: 11px;
}

.metric strong {
  color: hsl(var(--foreground));
  font-size: 18px;
  font-weight: 900;
}

.metric.danger strong {
  color: var(--danger);
}

.metric.warn strong {
  color: var(--warn);
}

.metric.success strong {
  color: var(--success);
}

.panel-head,
.tc-head {
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid hsl(var(--border));
  background: var(--surface-soft);
  padding: 12px 16px;
}

.panel-title {
  color: hsl(var(--muted-foreground));
  font-size: 13px;
}

.panel-count {
  margin-left: auto;
}

.plan-step {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  border-top: 1px solid hsl(var(--border));
  padding: 8px 16px;
  font-size: 13px;
}

.plan-step:first-of-type {
  border-top: none;
}

.checkmark {
  display: grid;
  width: 16px;
  height: 16px;
  place-items: center;
  border: 1.5px solid var(--border-soft);
  border-radius: 50%;
  color: transparent;
}

.plan-step.done .checkmark {
  border-color: var(--success);
  background: var(--success);
  color: #fff;
}

.plan-step.done .step-title {
  color: var(--meta);
  text-decoration: line-through;
  text-decoration-color: var(--border-soft);
}

.plan-step.current .checkmark {
  border-color: var(--accent);
  background: var(--surface-blue);
}

.plan-step.current .checkmark::after {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse 1.4s ease infinite;
  content: "";
}

.plan-step.current .step-title {
  color: hsl(var(--foreground));
  font-weight: 700;
}

.agent-message {
  margin: 16px 0;
  border-left: 3px solid var(--accent);
  padding: 8px 16px;
  color: var(--fg-2);
  line-height: 1.7;
}

.toolcall {
  overflow: hidden;
  margin: 12px 0;
}

.tc-head {
  width: 100%;
  text-align: left;
}

.tc-ico {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border-radius: 6px;
  background: var(--surface-blue);
  color: var(--accent);
}

.tc-name {
  color: hsl(var(--foreground));
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 800;
}

.tc-arg {
  color: hsl(var(--muted-foreground));
  font-size: 13px;
}

.tc-chev {
  margin-left: auto;
  color: var(--meta);
  transition: transform 150ms ease;
}

.toolcall.open .tc-chev {
  transform: rotate(90deg);
}

.tc-body {
  padding: 12px;
}

.boundary {
  margin-top: 12px;
}

.tc-note {
  color: var(--fg-2);
  font-size: 13px;
  line-height: 1.7;
}

.review-list {
  overflow: hidden;
  border: 1px solid var(--border-soft);
  border-radius: 6px;
}

.review-row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  border-top: 1px solid var(--border-soft);
  padding: 8px 12px;
  font-size: 13px;
}

.review-row:first-child {
  border-top: none;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 52px;
  height: 22px;
  border-radius: 999px;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 800;
}

.badge.high {
  background: var(--danger-soft);
  color: var(--danger);
}

.badge.mid {
  background: var(--warn-soft);
  color: var(--warn);
}

.badge.low {
  background: var(--surface-blue);
  color: var(--accent);
}

.approval {
  margin-top: 12px;
  border: 1px solid #f1d496;
  border-radius: 8px;
  background: var(--warn-soft);
  padding: 16px;
}

.approval-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.approval-icon {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 50%;
  background: #ffe7b4;
  color: var(--warn);
}

.approval p {
  color: var(--fg-2);
  font-size: 13px;
  line-height: 1.7;
}

.approval-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 800;
}

.btn.primary,
.send-btn {
  background: var(--accent);
  color: #fff;
}

.btn.primary:hover,
.send-btn:hover {
  background: var(--accent-hover);
}

.btn.ghost {
  border-color: var(--border-soft);
  background: hsl(var(--card));
  color: var(--fg-2);
}

.btn.danger {
  border-color: rgba(228, 35, 32, 0.34);
  background: #fff;
  color: var(--danger);
}

.composer {
  border-top: 1px solid hsl(var(--border));
  background: hsl(var(--card));
  padding: 12px 24px 16px;
}

.composer-inner {
  max-width: 900px;
  margin: 0 auto;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
  background: hsl(var(--background));
  box-shadow: 0 8px 24px rgba(31, 101, 179, 0.08);
}

.composer-inner:focus-within {
  border-color: hsl(var(--border));
  box-shadow: 0 8px 24px rgba(31, 101, 179, 0.08);
}

.composer-modes,
.composer-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
}

.mode-select {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 28px;
  border-radius: 6px;
  color: var(--fg-2);
  padding: 0 9px;
  font-family: var(--font-mono);
  font-size: 12px;
}

.mode-select:hover,
.mode-select:focus-visible {
  background: var(--surface-blue);
  color: var(--accent);
}

.mode-dot {
  width: 6px;
  height: 6px;
  flex: none;
  border-radius: 50%;
  background: var(--accent);
}

.mode-chevron {
  width: 12px;
  height: 12px;
  transform: rotate(90deg);
}

.mode-menu {
  min-width: 132px;
  border-color: var(--border-soft);
  border-radius: 8px;
  box-shadow: 0 14px 40px rgba(15, 39, 68, 0.14);
}

.mode-menu-item {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) 14px;
  min-height: 30px;
  align-items: center;
  column-gap: 9px;
  border-radius: 6px;
  color: var(--fg-2);
  padding: 0 8px;
  font-size: 12px;
}

.mode-menu-item:hover,
.mode-menu-item:focus,
.mode-menu-item[data-highlighted] {
  background: var(--surface-blue);
  color: var(--accent);
}

.mode-check {
  width: 12px;
  height: 12px;
  justify-self: end;
}

.mode-space {
  flex: 1;
}

.ctx-chip {
  display: inline-flex;
  align-items: center;
  height: 22px;
  border: 1px solid var(--border-soft);
  border-radius: 999px;
  background: hsl(var(--card));
  color: hsl(var(--muted-foreground));
  padding: 0 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  white-space: nowrap;
}

textarea {
  width: 100%;
  min-height: 48px;
  max-height: 180px;
  resize: none;
  border: 0;
  background: transparent;
  color: hsl(var(--foreground));
  padding: 12px 16px;
  font-size: 15px;
  line-height: 1.6;
}

textarea::placeholder {
  color: var(--meta);
}

.composer-foot {
  border-bottom: 0;
}

.comp-tool {
  width: 30px;
  height: 30px;
}

.comp-hint {
  margin-left: auto;
}

.send-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  border-radius: 6px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 800;
}

.home-main {
  grid-column: 2 / -1;
  grid-row: 2 / 3;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 50% 34%, rgba(31, 101, 179, 0.08), transparent 34%),
    linear-gradient(180deg, #f8fbff 0%, hsl(var(--background)) 100%);
  padding: 40px 32px;
}

.home-hero {
  width: min(760px, 100%);
  transform: translateY(-4vh);
}

.home-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 22px;
  color: hsl(var(--muted-foreground));
  font-family: var(--font-mono);
  font-size: 12px;
}

.home-mark {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 7px;
  background: var(--accent);
  color: #fff;
  font-family: "Microsoft YaHei UI", "Microsoft YaHei", sans-serif;
  font-weight: 900;
}

.home-hero h1 {
  margin-bottom: 32px;
  color: hsl(var(--foreground));
  font-size: 30px;
  font-weight: 900;
  text-align: center;
}

.home-composer {
  position: relative;
  overflow: visible;
  border: 1px solid #cfe1f6;
  border-radius: 18px;
  background: hsl(var(--card));
  box-shadow: 0 18px 52px rgba(31, 101, 179, 0.12);
}

.home-composer textarea {
  min-height: 86px;
  color: hsl(var(--foreground));
  padding: 18px 20px 10px;
}

.home-composer textarea::placeholder {
  color: var(--meta);
}

.home-tools,
.home-context {
  display: flex;
  align-items: center;
  gap: 8px;
}

.home-tools {
  padding: 2px 12px 10px;
}

.home-tools button,
.home-context button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 30px;
  border-radius: 8px;
  color: hsl(var(--muted-foreground));
  padding: 0 9px;
  font-size: 12px;
}

.home-tools button:hover,
.home-context button:hover {
  background: var(--surface-blue);
  color: var(--accent);
}

.home-tool-space {
  flex: 1;
}

.home-tools span {
  color: hsl(var(--muted-foreground));
  font-family: var(--font-mono);
  font-size: 12px;
}

.home-send {
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff !important;
  padding: 0 !important;
}

.home-send:hover {
  background: var(--accent-hover) !important;
}

.home-context {
  border-top: 1px solid var(--border-soft);
  border-radius: 0 0 18px 18px;
  background: linear-gradient(180deg, #f8fbff, var(--surface-soft));
  padding: 10px 14px 12px;
}

.home-context button.active {
  background: var(--surface-blue);
  color: var(--accent);
}

.home-suggestions {
  display: grid;
  gap: 10px;
}

.home-suggestions {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 18px;
}

.home-suggestions button {
  min-height: 38px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--card));
  color: var(--fg-2);
  padding: 0 10px;
  font-size: 13px;
}

.home-suggestions button:hover {
  border-color: #cfe1f6;
  background: var(--surface-blue);
  color: var(--accent);
}

.under-dev-main {
  grid-column: 2 / -1;
  grid-row: 2 / 3;
  align-items: center;
  justify-content: center;
  padding: 32px;
}

.under-dev {
  width: min(720px, 100%);
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
  background: hsl(var(--card));
  box-shadow: 0 8px 24px rgba(31, 101, 179, 0.08);
  padding: 28px;
}

.under-dev-icon {
  display: grid;
  width: 52px;
  height: 52px;
  place-items: center;
  border: 1px solid #cfe1f6;
  border-radius: 10px;
  background: var(--surface-blue);
  color: var(--accent);
  margin-bottom: 18px;
}

.under-dev-main-icon {
  width: 26px;
  height: 26px;
}

.under-dev-kicker {
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.under-dev h1 {
  margin: 6px 0 8px;
  color: hsl(var(--foreground));
  font-size: 22px;
  font-weight: 900;
}

.under-dev p {
  max-width: 620px;
  color: var(--fg-2);
  font-size: 14px;
  line-height: 1.75;
}

.under-dev-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 22px 0;
}

.under-dev-card {
  min-height: 118px;
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  background: hsl(var(--background));
  padding: 14px;
}

.under-dev-card .tiny-icon {
  color: var(--accent);
}

.under-dev-card strong {
  display: block;
  margin: 10px 0 4px;
  color: hsl(var(--foreground));
  font-size: 13px;
}

.under-dev-card span {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 1.55;
}

.inspector {
  grid-area: inspector;
  border-left: 1px solid hsl(var(--border));
}

.insp-head {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 50px;
  border-bottom: 1px solid hsl(var(--border));
  padding: 0 16px;
}

.insp-tab {
  height: 30px;
  border-radius: 6px;
  color: hsl(var(--muted-foreground));
  padding: 0 12px;
  font-size: 13px;
  font-weight: 800;
}

.insp-tab.active {
  background: var(--surface-blue);
  color: var(--accent);
}

.insp-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.panel-title-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.accent {
  color: var(--accent);
}

.panel-title-line .badge {
  margin-left: auto;
}

.issue,
.ctx-card {
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  background: hsl(var(--background));
  padding: 12px;
  margin-bottom: 12px;
}

.issue.high {
  border-color: rgba(228, 35, 32, 0.35);
  background: #fffafa;
}

.issue > div {
  display: flex;
  align-items: center;
  gap: 8px;
}

.issue .loc {
  margin-left: auto;
}

.issue h3 {
  margin: 8px 0 4px;
  color: hsl(var(--foreground));
  font-size: 14px;
  font-weight: 800;
}

.issue p,
.ctx-card p {
  color: var(--fg-2);
  font-size: 13px;
  line-height: 1.65;
}

blockquote {
  margin-top: 8px;
  border-left: 3px solid var(--accent);
  background: hsl(var(--card));
  padding: 8px;
  color: var(--fg-2);
  font-size: 13px;
  line-height: 1.65;
}

.ctx-card strong {
  display: block;
  margin: 4px 0;
  color: hsl(var(--foreground));
  font-size: 14px;
}

.token-bar {
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--surface-soft);
  margin: 10px 0 6px;
}

.token-bar span {
  display: block;
  width: 21%;
  height: 100%;
  background: var(--accent);
}

.statusbar {
  grid-area: status;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  border-top: 1px solid hsl(var(--border));
  background: hsl(var(--card));
  color: hsl(var(--muted-foreground));
  padding: 0 16px;
  font-size: 11px;
}

.sep {
  color: var(--border-soft);
}

.status-right {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

@media (max-width: 1180px) {
  .workbench {
    grid-template-columns: 64px 250px minmax(520px, 1fr);
    grid-template-areas:
      "activity title title"
      "activity sessions main"
      "activity status status";
  }

  .inspector {
    display: none;
  }
}
</style>
