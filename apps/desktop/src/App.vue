<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
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
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  SlidersHorizontal,
  SquarePen,
  TerminalSquare,
  Trash2,
  Workflow,
} from "lucide-vue-next";
import { fetchHealth, type HealthResponse } from "@/api/health";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ProjectMenubar from "@/components/ProjectMenubar.vue";

type SessionState = "running" | "approval" | "done" | "failed" | "idle";
type InspectorTab = "result" | "source" | "context";
type ComposerMode = "agent" | "chat";
type ActiveView = "home" | "workbench" | "documents" | "knowledge" | "history" | "settings";

type PlanStepState = "done" | "current" | "pending";
type RiskLevel = "high" | "mid" | "low";
type MessageContent = {
  type: "text" | "html";
  text: string;
};

type ConversationItem =
  | {
      type: "message";
      id: string;
      role: "user" | "assistant" | "system";
      content: MessageContent[];
      createdAt: string;
      status?: "streaming" | "done" | "error";
    }
  | {
      type: "tool_call";
      id: string;
      toolName: string;
      title?: string;
      status: "pending" | "running" | "approval_required" | "done" | "error";
      args?: unknown;
      result?: unknown;
      renderHint?: string;
      createdAt: string;
      updatedAt: string;
    };

type ProjectMock = {
  id: string;
  name: string;
  meta: string;
  folderPath: string;
};

type ConversationMock = {
  id: string;
  projectId: string | null;
  title: string;
  updatedAt: string;
  taskId: string;
  state: SessionState;
  statusLabel: string;
  user: string;
  prompt: string;
  metrics: Array<{ label: string; value: string; tone?: "danger" | "warn" | "success" }>;
  plan: Array<{ title: string; tag: string; state: PlanStepState }>;
  agentMessage: string;
  toolName: string;
  toolArgs: string;
  reviewRows: Array<{ level: RiskLevel; label: string; text: string; ref: string }>;
  approval?: {
    title: string;
    body: string;
  };
  contextChips: string[];
  items: ConversationItem[];
};

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

const homeProjects = reactive<ProjectMock[]>([
  { id: "huadong-digital", name: "华东院数字化项目", meta: "6 个任务 / 3 个知识库", folderPath: "E:\\Prog\\Mosika\\mock-projects\\huadong-digital-project" },
  { id: "substation-office", name: "变电一所资料工作区", meta: "12 份文档 / 4 份图纸 / 内网资料", folderPath: "E:\\Prog\\Mosika\\mock-projects\\substation-office-workspace" },
  { id: "demo-review", name: "示例工程审查项目", meta: "演示数据 / 可研报告 / 参数表", folderPath: "E:\\Prog\\Mosika\\mock-projects\\demo-engineering-review" },
]);
const selectedHomeProjectId = ref<string | null>(null);
const expandedProjectIds = ref<string[]>(homeProjects.map((project) => project.id));
const renameProjectDialogOpen = ref(false);
const renamingProjectId = ref<string | null>(null);
const renameProjectName = ref("");

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

function conversationItems(conversation: Omit<ConversationMock, "items">): ConversationItem[] {
  const toolStatus = conversation.state === "running"
    ? "running"
    : conversation.state === "approval"
      ? "approval_required"
      : conversation.state === "failed"
        ? "error"
        : "done";

  return [
    {
      type: "message",
      id: `${conversation.id}-user`,
      role: "user",
      content: [{ type: "html", text: conversation.prompt }],
      createdAt: conversation.updatedAt,
      status: "done",
    },
    {
      type: "tool_call",
      id: `${conversation.id}-tool`,
      toolName: conversation.toolName,
      title: conversation.toolArgs,
      status: toolStatus,
      args: { contextChips: conversation.contextChips },
      result: {
        plan: conversation.plan,
        reviewRows: conversation.reviewRows,
        approval: conversation.approval,
      },
      renderHint: "workbench_review",
      createdAt: conversation.updatedAt,
      updatedAt: conversation.updatedAt,
    },
    {
      type: "message",
      id: `${conversation.id}-assistant`,
      role: "assistant",
      content: [{ type: "html", text: conversation.agentMessage }],
      createdAt: conversation.updatedAt,
      status: "done",
    },
  ];
}

function withConversationItems(conversation: Omit<ConversationMock, "items">): ConversationMock {
  return {
    ...conversation,
    items: conversationItems(conversation),
  };
}

const homeSuggestions = [
  "校审一份 Word 可研报告",
  "提取图纸图签文字",
  "检查 Excel 参数表",
  "查询企业规范库",
];

const reviewPlan = [
  { title: "复制原文件到受控工作区，计算文件指纹", tag: "import", state: "done" },
  { title: "解析 Word 结构、标题层级、表格与图纸编号", tag: "parse", state: "done" },
  { title: "检索企业知识库中的典设、国标和审查要点", tag: "rag", state: "done" },
  { title: "核对主变容量、接线方式、术语和引用条款", tag: "review", state: "current" },
  { title: "生成问题清单与建议修改稿", tag: "draft", state: "pending" },
  { title: "等待人工确认后导出校审报告", tag: "approve", state: "pending" },
].map((step) => ({ ...step, state: step.state as PlanStepState }));

const reportReviewRows = [
  { level: "high", label: "高风险", text: "第 3.2 节主变容量为 2x180MVA，但设备参数表为 2x240MVA。", ref: "P12 / 表 3-1" },
  { level: "high", label: "高风险", text: "第 5.1 节使用“单母线分段”，图纸图签标注为“双母线接线”。", ref: "P26 / A-02" },
  { level: "mid", label: "需确认", text: "“站用变”与“所用变”混用，建议统一为项目术语库指定写法。", ref: "全文 8 处" },
  { level: "low", label: "建议", text: "图 4-3 在正文中首次引用早于图号定义，建议调整引用顺序。", ref: "P18" },
].map((row) => ({ ...row, level: row.level as RiskLevel }));

const conversations = reactive<ConversationMock[]>([
  {
    id: "review-220kv-report",
    projectId: "huadong-digital",
    title: "220kV 变电站可研报告校审",
    updatedAt: "4 分",
    taskId: "TASK-20260703-0148",
    state: "running",
    statusLabel: "执行中 / 规范核对 4/6",
    user: "林",
    prompt: "请校审 <code>220kV 城南变电站可研报告.docx</code>，重点检查术语一致性、章节编号、设备参数表引用，以及是否存在与公司典设和现行规范冲突的表述。先生成问题清单，不要直接覆盖原文件。",
    metrics: [
      { label: "高风险", value: "3", tone: "danger" },
      { label: "需确认", value: "12", tone: "warn" },
      { label: "自动修复建议", value: "18", tone: "success" },
      { label: "引用依据", value: "7" },
    ],
    plan: reviewPlan,
    agentMessage: "已完成文档结构解析和知识库检索。当前发现 <strong>3 个高风险项</strong>，主要集中在主变容量表述、接线方式术语和图纸编号引用；原始 Word 文件保持只读，所有修改建议都写入任务工作区副本。",
    toolName: "word.review",
    toolArgs: "术语一致性 / 规范条款 / 编号引用",
    reviewRows: reportReviewRows,
    approval: {
      title: "需要确认：是否生成带批注的校审稿",
      body: "即将基于工作区副本生成 <code>220kV 城南变电站可研报告.reviewed.docx</code> 和 <code>校审问题清单.xlsx</code>。不会覆盖原文件。",
    },
    contextChips: ["可研报告.docx", "企业规范库", "本地工作区"],
  },
  {
    id: "main-transformer-params",
    projectId: "huadong-digital",
    title: "主变参数表公式核验",
    updatedAt: "9 分",
    taskId: "TASK-20260703-0152",
    state: "approval",
    statusLabel: "待审批 / Excel 修正稿",
    user: "林",
    prompt: "请检查 <code>主变设备参数表.xlsx</code> 中容量、阻抗、电压等级和损耗字段的公式引用，重点确认与可研报告正文是否一致。",
    metrics: [
      { label: "待确认公式", value: "5", tone: "warn" },
      { label: "可自动修正", value: "9", tone: "success" },
      { label: "跨表引用", value: "14" },
      { label: "高风险", value: "1", tone: "danger" },
    ],
    plan: [
      { title: "读取工作簿结构和命名区域", tag: "xlsx", state: "done" },
      { title: "追踪主变容量、阻抗和电压等级公式链路", tag: "formula", state: "done" },
      { title: "对照可研报告正文和设备清册字段", tag: "cross-check", state: "done" },
      { title: "等待人工审批后写入修正稿", tag: "approve", state: "current" },
    ],
    agentMessage: "公式链路已经核验完成。当前有 <strong>5 个单元格等待审批</strong>，其中 1 处会影响主变容量一致性，建议审批后生成修正稿并保留原表。",
    toolName: "excel.audit",
    toolArgs: "公式追踪 / 跨表引用 / 设备参数一致性",
    reviewRows: [
      { level: "high", label: "高风险", text: "B12 主变容量引用旧方案 180MVA，正文方案已调整为 240MVA。", ref: "Sheet 参数表 / B12" },
      { level: "mid", label: "待审批", text: "D18 阻抗百分比引用单元格为空，建议补齐设计输入来源。", ref: "Sheet 计算 / D18" },
      { level: "low", label: "建议", text: "损耗字段单位建议统一为 kW，避免与说明书 MW 表述混用。", ref: "Sheet 汇总 / F8" },
    ],
    approval: {
      title: "待审批：是否生成 Excel 修正稿",
      body: "审批后将生成 <code>主变设备参数表.checked.xlsx</code>，并附带公式差异说明，不会覆盖原始工作簿。",
    },
    contextChips: ["主变参数表.xlsx", "可研报告.docx", "公式审计"],
  },
  {
    id: "drawing-titleblock-ocr",
    projectId: "huadong-digital",
    title: "总平面图图签文字提取",
    updatedAt: "1 小时",
    taskId: "TASK-20260702-0109",
    state: "done",
    statusLabel: "已完成 / OCR 结果",
    user: "林",
    prompt: "从 <code>A-02 总平面布置图.pdf</code> 中提取图签文字、图号、版本号和专业信息，并和说明书引用列表做一次匹配。",
    metrics: [
      { label: "识别字段", value: "32", tone: "success" },
      { label: "低置信度", value: "3", tone: "warn" },
      { label: "引用匹配", value: "11" },
      { label: "冲突", value: "1", tone: "danger" },
    ],
    plan: [
      { title: "渲染 PDF 图纸并定位图签区域", tag: "render", state: "done" },
      { title: "提取图号、版本、专业和日期字段", tag: "ocr", state: "done" },
      { title: "匹配说明书图纸引用列表", tag: "match", state: "done" },
      { title: "导出结构化识别结果", tag: "export", state: "done" },
    ],
    agentMessage: "图签文字提取已完成。识别到图纸接线方式与说明书第 5.1 节存在一处冲突，已写入结果清单。",
    toolName: "drawing.ocr",
    toolArgs: "图签定位 / OCR / 引用匹配",
    reviewRows: [
      { level: "high", label: "冲突", text: "图签接线方式为“双母线接线”，说明书正文写作“单母线分段”。", ref: "A-02 / P26" },
      { level: "mid", label: "低置信度", text: "设计阶段字段识别置信度 0.71，建议人工复核。", ref: "图签右下角" },
      { level: "low", label: "完成", text: "图号、版本号和日期字段已导出为结构化 JSON。", ref: "A-02" },
    ],
    contextChips: ["A-02 总平面布置图.pdf", "OCR 结果", "说明书引用"],
  },
  {
    id: "relay-protection-qa",
    projectId: "huadong-digital",
    title: "继电保护章节规范问答",
    updatedAt: "3 小时",
    taskId: "TASK-20260702-0116",
    state: "done",
    statusLabel: "已完成 / 规范问答",
    user: "林",
    prompt: "请根据企业规范库，回答说明书继电保护章节是否需要补充自动化系统接口说明，并列出依据。",
    metrics: [
      { label: "命中条款", value: "7", tone: "success" },
      { label: "建议补充", value: "4", tone: "warn" },
      { label: "冲突", value: "0", tone: "success" },
      { label: "引用资料", value: "3" },
    ],
    plan: [
      { title: "检索企业规范库和典设条款", tag: "rag", state: "done" },
      { title: "定位说明书继电保护章节", tag: "locate", state: "done" },
      { title: "生成问答依据和补充建议", tag: "answer", state: "done" },
    ],
    agentMessage: "规范问答已完成。建议在继电保护章节补充自动化系统接口、通信规约和告警联动描述，但未发现与现行规范直接冲突的表述。",
    toolName: "rag.answer",
    toolArgs: "企业规范 / 典设条款 / 章节建议",
    reviewRows: [
      { level: "mid", label: "建议补充", text: "自动化系统接口说明缺少通信规约和告警联动范围。", ref: "第 8.3 节" },
      { level: "low", label: "依据", text: "企业典设要求保护与自动化接口边界在说明书中明确。", ref: "典设 2024 / 8.2.1" },
      { level: "low", label: "通过", text: "保护配置原则未发现与规范冲突。", ref: "第 8 章" },
    ],
    contextChips: ["继电保护章节", "企业规范库", "RAG 问答"],
  },
  {
    id: "cable-duplicate-check",
    projectId: "substation-office",
    title: "电缆清册重复项检查",
    updatedAt: "昨天",
    taskId: "TASK-20260701-0188",
    state: "done",
    statusLabel: "已完成 / 重复项清单",
    user: "周",
    prompt: "检查 <code>电缆清册.xlsx</code> 中编号、起点、终点和规格型号是否存在重复或疑似重复。",
    metrics: [
      { label: "重复项", value: "8", tone: "warn" },
      { label: "疑似重复", value: "13" },
      { label: "已导出", value: "1", tone: "success" },
      { label: "高风险", value: "0", tone: "success" },
    ],
    plan: [
      { title: "读取清册字段并标准化编号", tag: "parse", state: "done" },
      { title: "按起点、终点和型号生成相似度索引", tag: "match", state: "done" },
      { title: "导出重复项审查清单", tag: "export", state: "done" },
    ],
    agentMessage: "重复项检查已完成。共发现 8 条明确重复和 13 条疑似重复，已按专业审查格式导出。",
    toolName: "excel.dedupe",
    toolArgs: "编号标准化 / 相似度匹配 / 清单导出",
    reviewRows: [
      { level: "mid", label: "重复", text: "DL-0107 与 DL-0170 起终点、型号和长度完全一致。", ref: "Row 107 / 170" },
      { level: "mid", label: "疑似", text: "DL-0204 与 DL-0205 起终点一致，规格型号仅截面不同。", ref: "Row 204 / 205" },
      { level: "low", label: "完成", text: "重复项清单已导出为 Excel。", ref: "dedupe.xlsx" },
    ],
    contextChips: ["电缆清册.xlsx", "重复项检查", "导出清单"],
  },
  {
    id: "design-summary-draft",
    projectId: "substation-office",
    title: "初设说明书摘要生成",
    updatedAt: "4 天",
    taskId: "TASK-20260630-0094",
    state: "done",
    statusLabel: "已完成 / Word 摘要",
    user: "周",
    prompt: "基于初设说明书生成一页摘要，突出建设规模、主设备、投资变化和待确认事项。",
    metrics: [
      { label: "摘要段落", value: "6", tone: "success" },
      { label: "待确认", value: "4", tone: "warn" },
      { label: "引用章节", value: "9" },
      { label: "导出文件", value: "1", tone: "success" },
    ],
    plan: [
      { title: "解析初设说明书章节结构", tag: "parse", state: "done" },
      { title: "抽取建设规模和主设备信息", tag: "extract", state: "done" },
      { title: "生成摘要并导出 Word", tag: "draft", state: "done" },
    ],
    agentMessage: "摘要生成已完成，内容覆盖建设规模、主设备配置、投资变化和 4 个待确认事项。",
    toolName: "word.summary",
    toolArgs: "章节抽取 / 摘要生成 / Word 导出",
    reviewRows: [
      { level: "mid", label: "待确认", text: "投资变化原因需要补充设计输入来源。", ref: "投资章节" },
      { level: "low", label: "建议", text: "建设规模摘要可补充远景扩建条件。", ref: "第 2 章" },
      { level: "low", label: "完成", text: "摘要已导出为 Word 文档。", ref: "summary.docx" },
    ],
    contextChips: ["初设说明书.docx", "摘要生成", "Word 导出"],
  },
  {
    id: "direct-standard-query",
    projectId: null,
    title: "查询现行国标条文",
    updatedAt: "昨天",
    taskId: "CHAT-20260703-0031",
    state: "done",
    statusLabel: "已完成 / 规范查询",
    user: "林",
    prompt: "帮我查询 220kV 变电站主变容量选择相关的现行国标条文，重点看是否有强制性约束。",
    metrics: [
      { label: "命中条款", value: "5", tone: "success" },
      { label: "强制条文", value: "0", tone: "success" },
      { label: "建议引用", value: "3" },
      { label: "待确认", value: "1", tone: "warn" },
    ],
    plan: [
      { title: "检索本地规范索引", tag: "search", state: "done" },
      { title: "筛选主变容量和负荷预测相关条款", tag: "filter", state: "done" },
      { title: "生成可引用回答", tag: "answer", state: "done" },
    ],
    agentMessage: "已完成规范查询。当前未检索到直接限定主变容量的强制性条文，但建议在报告中引用负荷预测、远景规模和主变经济运行相关依据。",
    toolName: "standards.search",
    toolArgs: "国标条文 / 主变容量 / 引用建议",
    reviewRows: [
      { level: "low", label: "依据", text: "主变容量宜结合负荷预测、运行方式和远景扩建条件综合确定。", ref: "GB 50059 / 3.1.2" },
      { level: "mid", label: "待确认", text: "企业典设对主变容量档位有内部推荐，需要结合项目类型确认。", ref: "企业典设 / 主设备" },
      { level: "low", label: "建议", text: "报告中建议补充容量选择计算依据和经济运行说明。", ref: "可研正文" },
    ],
    contextChips: ["国标库", "企业典设", "规范查询"],
  },
  {
    id: "direct-review-opinions",
    projectId: null,
    title: "帮我整理审查意见",
    updatedAt: "4 天",
    taskId: "CHAT-20260630-0020",
    state: "done",
    statusLabel: "已完成 / 审查意见整理",
    user: "林",
    prompt: "把这些零散审查意见整理成正式回复表格式，语气保持专业克制，分为设计回复和处理状态两列。",
    metrics: [
      { label: "意见条目", value: "18", tone: "success" },
      { label: "需补资料", value: "4", tone: "warn" },
      { label: "已归类", value: "6" },
      { label: "高风险", value: "0", tone: "success" },
    ],
    plan: [
      { title: "清洗审查意见文本", tag: "clean", state: "done" },
      { title: "按专业和风险等级归类", tag: "classify", state: "done" },
      { title: "生成回复表措辞", tag: "draft", state: "done" },
    ],
    agentMessage: "审查意见已经整理为正式回复表口径，保留了 4 条需要补充资料的事项，并将措辞统一为设计回复格式。",
    toolName: "review.reply",
    toolArgs: "意见归类 / 回复措辞 / 表格生成",
    reviewRows: [
      { level: "mid", label: "需补资料", text: "主变容量调整依据需补充负荷预测附件。", ref: "意见 03" },
      { level: "low", label: "已整理", text: "图纸编号和正文引用问题已归为图纸一致性类。", ref: "意见 07-11" },
      { level: "low", label: "完成", text: "回复表已按专业、意见、设计回复、处理状态组织。", ref: "回复表" },
    ],
    contextChips: ["审查意见", "回复表", "无项目对话"],
  },
  {
    id: "direct-install-illustrations",
    projectId: null,
    title: "安装 ian-xiaohei-illustrations",
    updatedAt: "4 天",
    taskId: "CHAT-20260630-0016",
    state: "done",
    statusLabel: "已完成 / 技能安装记录",
    user: "林",
    prompt: "帮我安装 ian-xiaohei-illustrations 技能，并确认后续可以用于中文文章正文配图。",
    metrics: [
      { label: "安装步骤", value: "3", tone: "success" },
      { label: "校验项", value: "2", tone: "success" },
      { label: "失败", value: "0", tone: "success" },
      { label: "备注", value: "1" },
    ],
    plan: [
      { title: "检查技能目录和配置", tag: "inspect", state: "done" },
      { title: "安装并刷新可用技能", tag: "install", state: "done" },
      { title: "确认触发条件和风格说明", tag: "verify", state: "done" },
    ],
    agentMessage: "技能安装记录已完成。后续当任务涉及中文文章配图、小黑风格插图或正文视觉隐喻时，可以触发该技能。",
    toolName: "skill.install",
    toolArgs: "技能安装 / 配置刷新 / 触发说明",
    reviewRows: [
      { level: "low", label: "完成", text: "技能目录已识别并可用于后续任务。", ref: "skills" },
      { level: "low", label: "说明", text: "适用于中文正文配图、工作流文档和方法论插图。", ref: "SKILL.md" },
      { level: "low", label: "建议", text: "生成前应明确配图数量和文章语境。", ref: "使用建议" },
    ],
    contextChips: ["技能安装", "中文配图", "无项目对话"],
  },
].map(withConversationItems));

const activeConversationId = ref<string | null>(null);

function conversationStorePayload() {
  return conversations.map((conversation) => ({
    id: conversation.id,
    projectId: conversation.projectId,
    title: conversation.title,
    updatedAt: conversation.updatedAt,
    taskId: conversation.taskId,
    state: conversation.state,
    statusLabel: conversation.statusLabel,
    user: conversation.user,
    prompt: conversation.prompt,
    metrics: conversation.metrics,
    plan: conversation.plan,
    agentMessage: conversation.agentMessage,
    toolName: conversation.toolName,
    toolArgs: conversation.toolArgs,
    reviewRows: conversation.reviewRows,
    approval: conversation.approval,
    contextChips: conversation.contextChips,
    items: conversation.items,
  }));
}

function replaceConversations(nextConversations: ConversationMock[]) {
  conversations.splice(0, conversations.length, ...nextConversations);
  if (!conversations.some((conversation) => conversation.id === activeConversationId.value)) {
    activeConversationId.value = null;
  }
}

async function loadConversationStore() {
  try {
    const storedConversations = await invoke<ConversationMock[]>("load_conversation_store", {
      defaultConversations: conversationStorePayload(),
    });
    replaceConversations(storedConversations);
  } catch (err) {
    console.warn("Using mock conversations because conversation store could not be loaded", err);
  }
}

async function saveConversationStore() {
  try {
    await invoke("save_conversation_store", { conversations: conversationStorePayload() });
  } catch (err) {
    console.error("Failed to save conversation store", err);
  }
}

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

const activeConversation = computed(() => {
  if (!activeConversationId.value) return null;
  return conversations.find((conversation) => conversation.id === activeConversationId.value) ?? null;
});

const currentConversation = computed(() => activeConversation.value ?? conversations[0]);

function conversationStateLabel(state: SessionState) {
  if (state === "running") return "执行中";
  if (state === "approval") return "待审批";
  if (state === "done") return "已完成";
  if (state === "failed") return "已中止";
  return "未开始";
}

const activeProject = computed(() => {
  const projectId = activeConversation.value?.projectId ?? selectedHomeProjectId.value;
  if (!projectId) return null;
  return homeProjects.find((project) => project.id === projectId) ?? null;
});

const activeConversationStateLabel = computed(() => {
  return conversationStateLabel(currentConversation.value.state);
});

const projectConversations = computed(() => {
  return homeProjects.reduce<Record<string, ConversationMock[]>>((groups, project) => {
    groups[project.id] = conversations.filter((conversation) => conversation.projectId === project.id);
    return groups;
  }, {});
});

const directConversations = computed(() => conversations.filter((conversation) => conversation.projectId === null));

const selectedHomeProjectName = computed(() => {
  return homeProjects.find((project) => project.id === selectedHomeProjectId.value)?.name ?? null;
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

function startNewConversation() {
  activeConversationId.value = null;
  selectedHomeProjectId.value = null;
  prompt.value = "";
  activeView.value = "home";
  growComposer();
}

function startProjectConversation(projectId: string) {
  activeConversationId.value = null;
  selectedHomeProjectId.value = projectId;
  if (!expandedProjectIds.value.includes(projectId)) {
    expandedProjectIds.value = [...expandedProjectIds.value, projectId];
  }
  prompt.value = "";
  activeView.value = "home";
  growComposer();
}

function openConversation(conversationId: string) {
  const conversation = conversations.find((item) => item.id === conversationId);
  if (!conversation) return;

  activeConversationId.value = conversationId;
  selectedHomeProjectId.value = conversation.projectId;
  if (conversation.projectId && !expandedProjectIds.value.includes(conversation.projectId)) {
    expandedProjectIds.value = [...expandedProjectIds.value, conversation.projectId];
  }
  activeView.value = "workbench";
}

onMounted(async () => {
  await loadProjectRegistry();
  await loadConversationStore();
  checkServer();
  growComposer();
});
</script>

<template>
  <div :class="['workbench', activeView === 'workbench' ? 'with-inspector' : '']">
    <aside class="sessions app-sidebar" aria-label="项目与对话列表">
      <div class="sidebar-brand">
        <button class="brand-mark" type="button" aria-label="Mousika 主页" title="Mousika 主页" @click="startNewConversation">
          M
        </button>
        <button class="brand-home" type="button" @click="startNewConversation">
          <span>Mousika</span>
          <small>桌面 AI 工作台</small>
        </button>
      </div>

      <div class="primary-actions" aria-label="常用操作">
        <button type="button" @click="startNewConversation">
          <SquarePen class="tiny-icon" />
          <span>新任务</span>
        </button>
        <button type="button">
          <Search class="tiny-icon" />
          <span>搜索</span>
        </button>
        <button type="button" @click="activeView = 'history'">
          <CalendarClock class="tiny-icon" />
          <span>已安排</span>
        </button>
      </div>

      <div class="sidebar-section">
        <div class="side-head compact">
          <h2>项目</h2>
        </div>

        <div v-for="project in homeProjects" :key="project.id" class="project-node">
          <button
            :class="[
              'project-row',
              selectedHomeProjectId === project.id ? 'active' : '',
              expandedProjectIds.includes(project.id) ? 'expanded' : '',
            ]"
            type="button"
            @click="toggleProject(project.id)"
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
                <DropdownMenuItem class="project-action-item" @select="openProjectFolder(project.id)">
                  <FolderOpen class="project-action-icon" />
                  在资源管理器中打开
                </DropdownMenuItem>
                <DropdownMenuItem class="project-action-item" @select="openRenameProjectDialog(project.id)">
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
              @click.stop="startProjectConversation(project.id)"
            >
              <SquarePen class="tiny-icon" />
            </button>
          </div>

          <div v-if="expandedProjectIds.includes(project.id)" class="tree-children">
            <button
              v-for="conversation in projectConversations[project.id]"
              :key="conversation.title"
              :class="['tree-chat', activeConversationId === conversation.id ? 'active' : '']"
              type="button"
              @click="openConversation(conversation.id)"
            >
              <span :class="['chat-dot', conversation.state]" />
              <span>{{ conversation.title }}</span>
              <span class="tree-chat-time">{{ conversation.updatedAt }}</span>
            </button>
            <span v-if="!projectConversations[project.id]?.length" class="empty-tree">暂无对话</span>
          </div>
        </div>
      </div>

      <div class="direct-chat-list">
        <div class="sess-group">对话</div>
        <button
          v-for="chat in directConversations"
          :key="chat.id"
          class="sess-item compact-chat"
          type="button"
          @click="openConversation(chat.id)"
        >
          <span class="s-title">{{ chat.title }}</span>
          <span class="s-time">{{ chat.updatedAt }}</span>
        </button>
      </div>

      <div class="side-foot">
        <span class="proj-ico">
          <FolderOpen class="tiny-icon" />
        </span>
        <span class="proj-name">{{ activeProject?.name ?? "无项目对话" }}</span>
        <span class="net">{{ activeProject ? "内网" : "本地" }}</span>
        <button class="settings-link" type="button" aria-label="设置" title="设置" @click="activeView = 'settings'">
          <Settings class="tiny-icon" />
        </button>
      </div>
    </aside>

    <Dialog v-model:open="renameProjectDialogOpen">
      <DialogContent class="rename-project-dialog">
        <DialogHeader>
          <DialogTitle>重命名项目</DialogTitle>
          <DialogDescription>修改项目显示名称，不会改变项目 ID 或文件夹路径。</DialogDescription>
        </DialogHeader>

        <form class="rename-project-form" @submit.prevent="renameProject">
          <label class="rename-project-field">
            <span>项目名称</span>
            <input v-model="renameProjectName" type="text" autocomplete="off" />
          </label>

          <DialogFooter class="rename-project-footer">
            <button class="btn ghost" type="button" @click="renameProjectDialogOpen = false">取消</button>
            <button class="btn primary" type="submit" :disabled="!renameProjectName.trim()">保存</button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <header class="titlebar">
      <nav class="crumb" aria-label="当前位置">
        <button type="button" @click="startNewConversation">Mousika</button>
        <template v-if="activeView !== 'home'">
          <ChevronRight class="crumb-icon" />
          <button v-if="activeProject" type="button" @click="activeView = 'workbench'">{{ activeProject.name }}</button>
          <strong v-else>对话</strong>
          <ChevronRight v-if="activeProject" class="crumb-icon" />
          <strong v-if="activeProject">{{ activeNavItem.label }}</strong>
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
        <span class="task-id">{{ currentConversation.taskId }}</span>
        <h1>{{ currentConversation.title }}</h1>
        <span :class="['stat-pill', currentConversation.state]"><span />{{ activeConversationStateLabel }}</span>
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
          <div class="avatar">{{ currentConversation.user }}</div>
          <div class="bubble" v-html="currentConversation.prompt" />
        </div>

        <div class="turn agent-turn">
          <section class="plan">
            <div class="panel-head">
              <span class="panel-kicker">执行计划</span>
              <span class="panel-title">当前状态：{{ activeConversationStateLabel }}</span>
              <span class="panel-count">{{ currentConversation.plan.filter((step) => step.state === 'done').length }}/{{ currentConversation.plan.length }}</span>
            </div>
            <div
              v-for="step in currentConversation.plan"
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

          <p class="agent-message" v-html="currentConversation.agentMessage" />

          <section :class="['toolcall', toolOpen ? 'open' : '']">
            <button class="tc-head" type="button" @click="toolOpen = !toolOpen">
              <span class="tc-ico">
                <ClipboardCheck class="tiny-icon" />
              </span>
              <span class="tc-name">{{ currentConversation.toolName }}</span>
              <span class="tc-arg">{{ currentConversation.toolArgs }}</span>
              <ChevronRight class="tc-chev tiny-icon" />
            </button>
            <div v-show="toolOpen" class="tc-body">
              <div class="tc-label">问题清单预览</div>
              <div class="review-list">
                <div v-for="row in currentConversation.reviewRows" :key="row.text" class="review-row">
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

          <section v-if="currentConversation.approval" class="approval-card">
            <div class="approval-title">
              <span class="approval-icon">
                <AlertTriangle class="tiny-icon" />
              </span>
              <strong>{{ currentConversation.approval.title }}</strong>
            </div>
            <p v-html="currentConversation.approval.body" />
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
            <span v-for="chip in currentConversation.contextChips" :key="chip" class="ctx-chip">{{ chip }}</span>
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
      <template v-if="activeConversation">
        <span :class="['s-dot', activeConversation.state]" />
        <span>{{ conversationStateLabel(activeConversation.state) }}</span>
        <span class="sep">|</span>
        <span>{{ activeConversation.taskId }}</span>
        <span class="sep">|</span>
      </template>
      <template v-else>
        <span class="s-dot idle" />
        <span>新对话</span>
        <span class="sep">|</span>
        <span>未创建任务</span>
        <span class="sep">|</span>
      </template>
      <span>本地 FastAPI: {{ apiBaseUrl }}</span>
      <span class="sep">|</span>
      <div class="status-right">
        <span>{{ activeConversation?.contextChips.length ?? 0 }} 个上下文</span>
        <span class="sep">|</span>
        <span>{{ activeConversation?.reviewRows.length ?? 0 }} 条结果</span>
        <span class="sep">|</span>
        <span>{{ activeConversation ? "42k" : "0" }}/200k token</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.workbench {
  display: grid;
  grid-template-columns: 300px minmax(520px, 1fr);
  grid-template-rows: 44px minmax(0, 1fr) 28px;
  grid-template-areas:
    "sessions title"
    "sessions main"
    "sessions status";
  height: 100vh;
  overflow: hidden;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}

.workbench.with-inspector {
  grid-template-columns: 300px minmax(520px, 1fr) 400px;
  grid-template-areas:
    "sessions title title"
    "sessions main inspector"
    "sessions status status";
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

.brand-mark {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 9px;
  background: var(--accent);
  color: #fff;
  font-size: 17px;
  font-weight: 800;
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

.app-sidebar {
  gap: 10px;
  padding-top: 10px;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 14px 6px;
}

.brand-home {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  border-radius: 6px;
  padding: 2px 4px;
  text-align: left;
}

.brand-home:hover {
  background: var(--surface-soft);
}

.brand-home span,
.project-row strong {
  overflow: hidden;
  min-width: 0;
  max-width: 100%;
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brand-home small {
  overflow: hidden;
  max-width: 100%;
  color: var(--meta);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.primary-actions,
.sidebar-section {
  padding: 7px 8px;
}

.primary-actions {
  display: grid;
  gap: 2px;
}

.primary-actions button,
.project-row {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 10px;
  border-radius: 7px;
  color: var(--fg-2);
  text-align: left;
  transition: background 150ms ease, color 150ms ease;
}

.primary-actions button {
  min-height: 30px;
  padding: 0 10px;
  font-size: 13px;
}

.primary-actions button:hover,
.project-row:hover,
.project-row.active {
  background: var(--surface-blue);
  color: var(--accent);
}

.project-row.active {
  font-weight: 800;
}

.project-node {
  position: relative;
  min-width: 0;
}

.project-row {
  min-height: 30px;
  padding: 0 64px 0 8px;
}

.project-row.active strong {
  color: var(--accent);
}

.project-actions {
  position: absolute;
  top: 2px;
  right: 6px;
  display: flex;
  gap: 2px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease;
}

.project-node:hover .project-actions,
.project-node:focus-within .project-actions {
  opacity: 1;
  pointer-events: auto;
}

.project-action-btn {
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border-radius: 6px;
  color: hsl(var(--muted-foreground));
}

.project-action-btn:hover,
.project-action-btn:focus-visible,
.project-action-btn[data-state="open"] {
  background: hsl(var(--card));
  color: var(--accent);
}

.project-action-menu {
  width: 190px;
  border-color: var(--border-soft);
  border-radius: 8px;
  box-shadow: 0 18px 52px rgba(15, 39, 68, 0.16);
}

.project-action-item {
  display: flex;
  min-height: 30px;
  align-items: center;
  gap: 10px;
  border-radius: 6px;
  color: var(--fg-2);
  font-size: 12px;
}

.project-action-item:hover,
.project-action-item:focus,
.project-action-item[data-highlighted] {
  background: var(--surface-blue);
  color: var(--accent);
}

.project-action-item.danger {
  color: var(--danger);
}

.project-action-icon {
  width: 13px;
  height: 13px;
  flex: none;
}

.rename-project-dialog {
  width: min(420px, calc(100vw - 32px));
  gap: 18px;
  border-color: var(--border-soft);
  border-radius: 10px;
  background: hsl(var(--card));
}

.rename-project-form {
  display: grid;
  gap: 16px;
}

.rename-project-field {
  display: grid;
  gap: 8px;
}

.rename-project-field span {
  color: var(--fg-2);
  font-size: 13px;
  font-weight: 700;
}

.rename-project-field input {
  height: 34px;
  border: 1px solid var(--border-soft);
  border-radius: 7px;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  padding: 0 10px;
}

.rename-project-field input:focus-visible {
  border-color: #cfe1f6;
  box-shadow: 0 0 0 3px rgba(31, 101, 179, 0.12);
}

.rename-project-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.tree-chevron {
  width: 13px;
  height: 13px;
  color: var(--meta);
  transition: transform 150ms ease;
}

.project-row.expanded .tree-chevron {
  transform: rotate(90deg);
}

.tree-children {
  display: grid;
  gap: 2px;
  margin: 1px 0 8px 0;
  padding-left: 31px;
}

.tree-chat {
  display: grid;
  grid-template-columns: 12px minmax(0, 1fr) auto;
  min-height: 28px;
  align-items: center;
  gap: 7px;
  border-radius: 6px;
  color: var(--fg-2);
  padding: 0 8px;
  text-align: left;
  font-size: 13px;
}

.tree-chat:hover,
.tree-chat.active {
  background: var(--surface-blue);
  color: var(--accent);
}

.tree-chat span:last-child {
  color: var(--meta);
  font-size: 11px;
  white-space: nowrap;
}

.tree-chat span:nth-child(2) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-dot {
  display: block;
  width: 6px;
  height: 6px;
  min-width: 6px;
  max-width: 6px;
  align-self: center;
  justify-self: center;
  border-radius: 50%;
  background: transparent;
  line-height: 0;
  overflow: hidden;
}

.chat-dot.running {
  background: var(--accent);
  animation: pulse 1.6s ease infinite;
}

.chat-dot.approval {
  background: var(--warn);
}

.chat-dot.done {
  background: var(--success);
}

.empty-tree {
  color: var(--meta);
  padding: 4px 8px;
  font-size: 12px;
}

.side-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
}

.side-head.compact {
  padding: 3px 8px 6px;
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

.icon-btn,
.comp-tool {
  display: grid;
  place-items: center;
  border-radius: 6px;
  color: hsl(var(--muted-foreground));
  transition: background 150ms ease, color 150ms ease;
}

.icon-btn:hover,
.comp-tool:hover {
  background: var(--surface-soft);
  color: var(--accent);
}

.direct-chat-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 12px;
}

.sess-group {
  padding: 8px 12px 6px;
}

.sess-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  width: 100%;
  align-items: center;
  column-gap: 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 7px 10px;
  text-align: left;
}

.sess-item:hover {
  background: var(--surface-soft);
}

.s-title {
  overflow: hidden;
  color: var(--fg-2);
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.s-time {
  color: var(--meta);
  font-size: 11px;
  white-space: nowrap;
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

.s-dot.approval {
  background: var(--warn);
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

.settings-link {
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border-radius: 6px;
  color: hsl(var(--muted-foreground));
}

.settings-link:hover {
  background: var(--surface-blue);
  color: var(--accent);
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

.stat-pill.approval {
  background: var(--warn-soft);
  color: var(--warn);
}

.stat-pill.approval span {
  background: var(--warn);
  animation: none;
}

.stat-pill.done {
  background: var(--success-soft);
  color: var(--success);
}

.stat-pill.done span {
  background: var(--success);
  animation: none;
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
  flex-direction: row-reverse;
  gap: 12px;
  justify-content: flex-start;
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
.toolcall {
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--card));
  box-shadow: 0 8px 24px rgba(31, 101, 179, 0.08);
}

.bubble {
  max-width: min(720px, calc(100% - 42px));
  padding: 12px 16px;
  color: var(--fg-2);
  line-height: 1.7;
}

.user-turn .bubble {
  background: hsl(var(--card));
  text-align: left;
}

code {
  border-radius: 6px;
  background: var(--surface-blue);
  color: var(--accent);
  padding: 1px 6px;
  font-family: var(--font-mono);
  font-size: 13px;
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

.approval-card {
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

.approval-card p {
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
    grid-template-columns: 270px minmax(520px, 1fr);
    grid-template-areas:
      "sessions title"
      "sessions main"
      "sessions status";
  }

  .workbench.with-inspector {
    grid-template-columns: 270px minmax(520px, 1fr);
    grid-template-areas:
      "sessions title"
      "sessions main"
      "sessions status";
  }

  .inspector {
    display: none;
  }
}
</style>
