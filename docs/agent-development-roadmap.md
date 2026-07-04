# Mousika Agent Development Roadmap

## 背景判断

Mousika 需要 Agent 能力，但它不应该从第一天就实现一个完整的通用 Agent 平台。对电力设计院员工来说，核心价值不是“让 Agent 会写代码”，而是让它稳定完成工程文件相关任务：

- 审阅 Word 设计说明书。
- 检查 Excel 设备清册、参数表、计算书。
- 分析 CAD/PDF 图纸目录、标题栏、编号和版本信息。
- 检索规范、典设、历史项目资料，并在结果中给出引用。
- 生成可复核、可编辑、可归档的成果文件。

因此，Mousika 的 Agent 应该从“领域任务执行器”开始，而不是从“万能自主智能体”开始。

## 推荐总体策略

采用三层设计：

```text
Mousika Task API
  -> Agent Orchestrator
    -> Runtime Adapter
      -> Native Runtime
      -> OpenCode Runtime
      -> Codex CLI Runtime
    -> Mousika Domain Tools
      -> Word / Excel / CAD / PDF / Knowledge / Artifact
```

关键原则：

- FastAPI 定义 Mousika 自己的任务、事件、工具、artifact 协议。
- 早期先实现一个轻量 `Native Runtime`，用于固定工作流和简单工具调用。
- OpenCode、Codex CLI 等开源 Agent 作为可选 `Runtime Adapter` 接入，而不是核心依赖。
- Mousika 的 Word、Excel、CAD、PDF、知识库能力应沉淀在自己的 Domain Tools 中。
- 外部 Agent 可以调用 Mousika Tools，但不应直接无限制访问用户项目目录。

## 为什么不直接绑定一个开源 Coding Agent

OpenCode、Codex CLI 等工具很有价值，但它们默认服务的是代码开发场景：

- 工作对象通常是代码仓库。
- 核心工具通常是 shell、git、文件编辑、测试命令。
- 用户通常具备开发背景，能理解命令执行和文件修改风险。

Mousika 的场景不同：

- 工作对象是工程项目资料，而不是代码仓库。
- 核心工具是 Office、CAD、PDF、规范库、模板库。
- 用户关注审查依据、修改痕迹、成果文件和可复核性。
- 文件写入要非常谨慎，最好默认生成副本或 artifact。

因此，开源 Coding Agent 更适合作为执行 runtime 或参考实现，而不是 Mousika 的业务核心。

## Agent 最小可用定义

Mousika 第一版 Agent 不需要具备完全自主规划能力。只要满足以下能力，就可以称为可用：

1. 接收结构化任务。
2. 读取任务上下文，包括项目、文件、用户指令和输出要求。
3. 按固定或半固定步骤调用工具。
4. 将进度以事件流返回给前端。
5. 生成结构化结果和 artifact。
6. 记录工具调用、错误、审批和最终状态。

第一版 Agent 可以更像“可观察的工作流执行器”，后续再逐渐增强规划能力。

## 核心模块

### 1. Agent Orchestrator

职责：

- 接收 `Task`。
- 构造 `AgentContext`。
- 选择合适的 runtime。
- 控制运行状态。
- 分发工具调用。
- 发送事件流。
- 保存最终结果。

需要实现：

- `start_task(task_request)`
- `cancel_task(task_id)`
- `get_task_status(task_id)`
- `stream_task_events(task_id)`
- `record_tool_call(tool_call)`
- `record_artifact(artifact)`

### 2. AgentContext

每次 Agent 执行都应该有结构化上下文。

建议字段：

```text
task_id
run_id
conversation_id
project_id
project_root
selected_files
user_instruction
workflow_type
allowed_tools
write_policy
model_profile
output_contract
knowledge_scope
```

其中 `write_policy` 很重要，建议至少支持：

- `read_only`: 只读，不允许写入用户项目。
- `artifact_only`: 可生成 artifact，但不修改原文件。
- `with_approval`: 修改原文件前必须请求用户确认。

### 3. Runtime Adapter

Runtime Adapter 用来屏蔽不同 Agent 实现。

统一接口建议：

```text
prepare(context)
run(context) -> event stream
submit_approval(approval_id, decision)
cancel(run_id)
cleanup(run_id)
```

早期 runtime：

- `native`: Mousika 自己的轻量执行器。
- `mock`: 用于前端和后端联调。

后期 runtime：

- `opencode`: 通过子进程或服务模式接入 OpenCode。
- `codex_cli`: 通过子进程或服务模式接入 Codex CLI。
- `remote`: 接入局域网服务器上的专用 Agent 服务。

### 4. Tool Registry

Tool Registry 管理 Mousika 可调用工具。

每个工具需要声明：

```text
name
description
input_schema
output_schema
permissions
side_effects
timeout
implementation
```

工具分类：

- `filesystem.*`
- `word.*`
- `excel.*`
- `pdf.*`
- `cad.*`
- `knowledge.*`
- `artifact.*`
- `model.*`

示例工具：

```text
filesystem.list_project_files
filesystem.read_text_preview
word.extract_docx_structure
word.extract_docx_tables
word.create_review_report
excel.extract_workbook_summary
excel.validate_equipment_list
pdf.extract_text
cad.extract_title_blocks
knowledge.search
artifact.save_json
artifact.save_markdown
artifact.save_docx
model.chat
```

### 5. Event Stream

Agent 的执行过程应该以事件形式暴露给 UI。

建议事件：

```text
task_started
step_started
assistant_message_delta
tool_call_started
tool_call_progress
tool_call_completed
tool_call_failed
approval_required
artifact_created
task_completed
task_failed
task_cancelled
```

事件应该能映射到前端当前的 `message` / `tool_call` conversation item 模型。

### 6. Output Contract

为了让结果稳定可用，Agent 不应只返回自然语言。

每个 workflow 都应该定义输出契约。例如 Word 审阅：

```text
summary: string
issues: Issue[]
artifacts: Artifact[]
citations: Citation[]
next_actions: string[]
```

`Issue` 建议字段：

```text
id
severity
category
location
description
evidence
suggestion
source_file
confidence
citations
```

这样前端可以渲染问题清单，后端可以生成报告，用户也可以复核。

## Roadmap

### Phase 0: 任务协议和事件协议

目标：先把 Agent 外壳搭起来，不急着做智能。

实现内容：

- 定义 `TaskRequest`、`TaskStatus`、`TaskEvent`、`ToolCall`、`Artifact` schema。
- 实现 `POST /tasks`、`GET /tasks/{id}`、`GET /tasks/{id}/events`。
- 实现 `mock runtime`，模拟工具调用和流式进度。
- 前端可以看到 Agent 正在执行、调用工具、生成结果。

验收标准：

- 用户提交一个任务后，UI 能看到持续事件。
- 后端能保存 task、tool call、artifact 记录。
- 任务能成功、失败、取消。

### Phase 1: Native Runtime 最小版

目标：实现 Mousika 自己的轻量 Agent 执行器。

实现内容：

- 实现 `native runtime`。
- 支持固定步骤 workflow。
- 支持工具调用和异常捕获。
- 支持输出结构化 JSON。
- 支持 artifact 生成。

第一批 workflow：

```text
review_word_mock
check_excel_mock
analyze_pdf_mock
```

这些 workflow 可以先用假工具或简单工具，重点验证框架。

验收标准：

- 不依赖 OpenCode/Codex，也能跑通一个端到端任务。
- 工具调用都能被记录。
- 输出能被前端消费。

### Phase 2: Word 审阅垂直闭环

目标：完成第一个真实业务 Agent。

实现内容：

- `word.extract_docx_structure`
- `word.extract_docx_tables`
- `model.chat`
- `artifact.save_review_report`
- `review_word` workflow

建议执行步骤：

```text
读取 docx 结构
提取章节和表格
构造审阅 prompt
调用局域网模型服务
解析结构化问题清单
生成 Markdown 或 Word 审阅报告
返回 artifact
```

验收标准：

- 选择一个 Word 文件后能生成审阅意见。
- 每条意见有位置、问题、建议、置信度。
- 结果保存为 artifact。
- 原始文件默认不被修改。

### Phase 3: Tool Registry 正式化

目标：让工具体系可扩展、可控制、可审计。

实现内容：

- 工具注册机制。
- 工具输入输出 schema 校验。
- 工具权限声明。
- 工具超时和错误封装。
- 工具调用日志。
- 写入类工具审批策略。

验收标准：

- 新增工具不需要改 orchestrator 主流程。
- 任一工具调用都能记录参数摘要、状态、耗时和错误。
- 写入用户项目目录的工具默认会触发审批。

### Phase 4: Excel 检查 Agent

目标：复用 Agent 框架做第二个真实业务闭环。

实现内容：

- `excel.extract_workbook_summary`
- `excel.extract_tables`
- `excel.extract_formulas`
- `excel.validate_equipment_list`
- `check_excel` workflow

建议先支持：

- 设备清册字段完整性检查。
- 数值范围检查。
- 表间一致性检查。
- 公式存在性和明显异常检查。

验收标准：

- 能输出结构化 Excel 问题清单。
- 能定位到 sheet、行列、单元格或表格区域。
- 能生成 Markdown/Excel artifact。

### Phase 5: Knowledge Retrieval

目标：让 Agent 的审阅意见有依据。

实现内容：

- 知识源注册。
- 本地文档切分和索引。
- `knowledge.search` 工具。
- citation 数据结构。
- 在 Word/Excel workflow 中加入检索步骤。

知识源类型：

- 国家和行业标准。
- 企业标准。
- 典型设计。
- 历史项目审查意见。
- 常用模板。

验收标准：

- Agent 能引用知识来源。
- 输出意见中包含依据或参考条目。
- 用户能从结果跳转或定位到引用来源。

### Phase 6: OpenCode / Codex CLI Adapter 实验

目标：验证开源 Agent runtime 是否适合被 Mousika 调度。

实验内容：

- 将 OpenCode 或 Codex CLI 作为 sidecar binary 放入开发环境。
- FastAPI 通过子进程启动 runtime。
- 设置独立临时工作目录。
- 注入 Mousika 任务说明和工具使用说明。
- 捕获 stdout/stderr 或 JSON/event 输出。
- 验证是否支持非交互模式、审批、取消、超时、模型配置。

重点验证问题：

- 是否能连接局域网模型服务。
- 是否能稳定 headless 运行。
- 是否能调用 Mousika 暴露的 tools。
- 是否能限制文件访问范围。
- 输出是否足够结构化。
- 打包体积和许可证是否可接受。

验收标准：

- 至少一个外部 runtime 能跑通只读任务。
- 外部 runtime 不能绕过 Mousika 的文件和工具权限。
- 外部 runtime 失败时不影响 native runtime。

### Phase 7: CAD/PDF 图纸 Agent

目标：从图纸元数据和目录检查开始，逐步扩展图纸理解能力。

实现内容：

- `pdf.extract_text`
- `pdf.extract_pages`
- `cad.extract_metadata`
- `cad.extract_title_blocks`
- `analyze_drawing` workflow

建议先支持：

- 图纸目录抽取。
- 图号、图名、版本、专业识别。
- 标题栏一致性检查。
- Word/Excel 清册与图纸目录的一致性检查。

验收标准：

- 能输出图纸问题清单。
- 能定位到文件、页码、图号或标题栏字段。
- 对 CAD 深度解析依赖可用库和真实样本逐步推进。

### Phase 8: Planner 能力增强

目标：从固定 workflow 走向半自主任务规划。

实现内容：

- 根据用户指令选择 workflow。
- 根据文件类型选择工具。
- 生成执行计划。
- 支持用户确认计划后执行。
- 支持任务中途根据工具结果调整下一步。

注意：

Planner 不应一开始就拥有所有权限。它只能从允许的 workflow 和 tools 中组合。

验收标准：

- 用户说“帮我审查这个项目的说明书和设备清册”，Agent 能拆成 Word 审阅和 Excel 检查。
- 执行前能展示计划。
- 用户能批准、取消或修改计划。

### Phase 9: 打包和 Runtime 管理

目标：让 Agent 能力稳定进入 portable 版本。

实现内容：

- `release/Mousika/agents/` 目录规划。
- 内置 runtime 版本管理。
- license 和 notice 文件收集。
- runtime 健康检查。
- runtime 崩溃恢复。
- 禁用运行时在线安装。
- 生成依赖清单和 hash。

验收标准：

- portable 包离线可运行 native runtime。
- 可选外部 runtime 有明确版本和来源。
- 启动时能报告 runtime 是否可用。

## 需要实现的功能清单

### 必须实现

- Task schema。
- Event stream。
- Native runtime。
- Tool registry。
- Tool call recording。
- Artifact storage。
- File access policy。
- Model service client。
- Word extraction tool。
- Review Word workflow。
- Structured issue output。
- Basic cancellation and timeout。

### 应该实现

- Excel extraction tool。
- Excel checking workflow。
- Knowledge search tool。
- Citation model。
- Approval model。
- SQLite persistence。
- Runtime adapter interface。
- Runtime health check。
- Packaged runtime directory.

### 可以后置

- OpenCode adapter。
- Codex CLI adapter。
- CAD deep parsing。
- Multi-agent collaboration。
- Autonomous planner。
- Visual model and OCR pipeline。
- Enterprise permission system。
- Installer and updater integration。

## 推荐第一里程碑

第一里程碑不要追求“像 OpenCode/Codex 一样强”。建议目标是：

```text
用户选择一个 Word 文件
  -> 后端创建 review_word task
  -> native runtime 执行固定步骤
  -> 调用 docx 提取工具
  -> 调用局域网模型服务
  -> 生成结构化审阅意见
  -> 保存 review report artifact
  -> 前端以 message/tool_call 流展示过程和结果
```

这个里程碑一旦完成，Mousika 就有了自己的 Agent 骨架。之后无论是接入 OpenCode、Codex CLI，还是继续增强自研 Agent，都有一个稳定的业务协议和产品闭环。

## 开发顺序建议

推荐实际编码顺序：

1. `server/app/schemas/agent.py`: 定义 Task、Event、ToolCall、Artifact。
2. `server/app/services/task_store.py`: 先用内存或 JSON 保存任务状态。
3. `server/app/services/event_bus.py`: 实现任务事件队列。
4. `server/app/agents/runtime.py`: 定义 Runtime Adapter 接口。
5. `server/app/agents/native.py`: 实现 Native Runtime。
6. `server/app/tools/registry.py`: 实现 Tool Registry。
7. `server/app/api/tasks.py`: 暴露任务 API。
8. `server/app/workflows/review_word.py`: 实现第一个固定 workflow。
9. `server/app/tools/word.py`: 实现 docx 提取。
10. `server/app/services/model_client.py`: 接入局域网模型服务。

这样做的好处是，前 7 步完成后，哪怕还没有真正的 Word/Excel 能力，前后端也能开始联调 Agent 运行体验。
