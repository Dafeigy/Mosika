# Mousika FastAPI Backend Requirements

## Purpose

Mousika is a Windows-first local AI workbench for power design institute workflows. Its backend is not a generic chat server. It is the local application service that connects desktop UI, local engineering files, domain tools, agent execution, and LAN-hosted model services.

The first backend goal is to support practical work around Word, Excel, CAD/PDF drawings, and enterprise knowledge materials used by power design institute staff.

## Architecture Positioning

Recommended backend role:

```text
Tauri / Vue Desktop UI
  -> FastAPI Local Application Service
  -> Agent Orchestrator
  -> Domain Tool Layer
  -> Local Files / Office / CAD / PDF / Knowledge / LAN Model Services
```

FastAPI should provide:

- Local API endpoints for the desktop app.
- Project, conversation, task, artifact, and tool-call state management.
- Agent run entry points and streaming task progress.
- Local tool services for reading, checking, transforming, and writing engineering files.
- A controlled gateway to LAN model services.
- Audit-friendly records of agent reasoning steps, tool calls, outputs, and user approvals.

FastAPI should not become:

- A thin proxy that only forwards prompts to a model.
- A fully generic agent platform disconnected from Mousika's engineering workflows.
- A public network service. The local desktop workflow should continue to bind to `127.0.0.1` unless a deliberate deployment mode is introduced later.

## Product Context

Target users:

- Employees of power design institutes.
- Users who work with engineering deliverables rather than source code.
- Users who need review, compilation, checking, comparison, and report generation across Word, Excel, CAD, PDF, and project folders.

Primary workflow types:

- Review Word design documents and produce structured comments.
- Check Excel equipment lists, calculation sheets, and parameter tables.
- Extract and compare drawing information from CAD/PDF files.
- Search and cite enterprise standards, templates, typical designs, and previous project materials.
- Generate editable deliverables such as Word review reports, Excel issue lists, and annotated source files.

## Core Design Principles

1. Business tasks first, generic tools second.

   Public API endpoints should initially expose meaningful business workflows such as document review or spreadsheet checking. Fine-grained tools can exist internally, but the UI should not have to orchestrate low-level file parsing steps.

2. Local files remain under local control.

   The backend owns local file access, project indexing, temporary files, generated artifacts, and safety checks. Model services should receive only the data required for the task.

3. Every agent run should be traceable.

   The backend should record task status, inputs, tool calls, approvals, generated artifacts, errors, and timestamps. This matters because engineering review work must be explainable and repeatable.

4. Outputs should be editable and reusable.

   The goal is not only to answer questions. The backend should help produce Word, Excel, PDF, and structured issue-list artifacts that users can continue editing.

5. Keep the first implementation small.

   Start with a focused vertical slice. Avoid building a large plugin platform before one or two domain workflows are proven end to end.

## Core Domain Objects

The backend should gradually converge on these objects:

| Object | Purpose |
| --- | --- |
| `Project` | A user-selected engineering project folder and its metadata. |
| `Document` | A Word, Excel, CAD, PDF, or other project file known to Mousika. |
| `Conversation` | The user-visible message stream associated with a project or unscoped task. |
| `Task` | A user-requested business workflow, such as reviewing a Word file. |
| `Run` | One execution attempt of a task or agent workflow. |
| `ToolCall` | One structured tool invocation with args, status, result, and error details. |
| `Artifact` | A generated output file, report, annotation, export, or structured result. |
| `KnowledgeSource` | A local or enterprise knowledge source such as standards, templates, and previous projects. |
| `Approval` | A user confirmation required before sensitive operations such as modifying files. |

These names are conceptual. They do not all need database tables in the first sprint.

## Initial API Surface

Keep the existing health endpoint:

```text
GET /health
```

Recommended MVP endpoint groups:

```text
GET  /projects
POST /projects
GET  /projects/{project_id}
POST /projects/{project_id}/index

GET  /conversations
POST /conversations
GET  /conversations/{conversation_id}/items
POST /conversations/{conversation_id}/items

POST /tasks
GET  /tasks/{task_id}
GET  /tasks/{task_id}/events
GET  /tasks/{task_id}/artifacts
POST /tasks/{task_id}/cancel

POST /workflows/review-word
POST /workflows/check-excel
POST /workflows/analyze-drawing
POST /workflows/search-knowledge
```

Fine-grained internal tool endpoints may be useful during development, but they should be treated as implementation details:

```text
POST /internal/tools/read-docx
POST /internal/tools/read-xlsx
POST /internal/tools/extract-pdf
POST /internal/tools/call-model
```

If exposed, internal endpoints should be clearly marked as unstable and local-only.

## Agent And Tool Model

The agent layer should receive a task context instead of a raw prompt only.

Recommended task context:

- User instruction.
- Project ID and project folder.
- Selected files.
- Conversation ID.
- Allowed tools.
- Output expectations.
- Safety policy for read-only or write-enabled execution.
- Model profile and timeout settings.

Recommended tool categories:

- File system tools: list, inspect, read metadata, copy to workspace, create artifacts.
- Word tools: extract structure, read paragraphs/tables, add comments, create reports.
- Excel tools: extract sheets/tables/formulas, validate rules, generate issue workbooks.
- CAD/PDF tools: extract text, drawing list, title blocks, layers, annotations, and comparison data.
- Knowledge tools: search standards, templates, previous projects, and cited references.
- Model tools: call LAN-hosted LLM, embedding service, reranker, OCR, or vision model.

Write-capable tools should require explicit policy checks and, where appropriate, user approval.

## Persistence Requirements

MVP persistence can start simple but should be designed for migration.

Short term:

- Keep current app-data JSON/JSONL storage for project and conversation data if it remains sufficient.
- Add backend-side schemas for task, tool-call, and artifact records.
- Store generated artifacts in a deterministic app-data folder.
- Include schema versions in persisted records.

Recommended medium-term direction:

- Move backend state to SQLite when task state, conversations, artifact indexes, and migrations become nontrivial.
- Keep user project folders explicit and user-controlled.
- Consider writing portable project metadata under each project folder, such as `.mousika/project.json`.

Suggested SQLite tables later:

- `projects`
- `documents`
- `conversations`
- `conversation_items`
- `tasks`
- `runs`
- `tool_calls`
- `artifacts`
- `knowledge_sources`
- `approvals`

## Security And Data Boundary

The local backend should default to:

- Bind to `127.0.0.1`.
- Reject public-interface binding for normal desktop workflows.
- Validate project paths before file access.
- Prevent path traversal outside approved project or app-data roots.
- Treat write operations as sensitive.
- Avoid sending full documents to model services when extracted snippets are enough.
- Log operational metadata without leaking excessive document content.

For LAN model services:

- Keep service base URLs configurable.
- Add request timeout and retry policy.
- Record model provider/profile used by each run.
- Preserve enough metadata to explain outputs without storing unnecessary sensitive text.

## Streaming And Status

The frontend needs a Codex-like stream of messages and tool calls. Backend tasks should therefore expose events such as:

- `task_started`
- `assistant_message_delta`
- `tool_call_started`
- `tool_call_progress`
- `tool_call_completed`
- `approval_required`
- `artifact_created`
- `task_completed`
- `task_failed`
- `task_cancelled`

Server-Sent Events are likely sufficient for the first version. WebSocket can be considered later if bidirectional streaming becomes necessary.

## Recommended Development Route

### Phase 0: Backend foundation

Goal: Make the local server reliable enough to host real workflows.

- Add structured settings for app data paths, artifact paths, model service URL, and timeouts.
- Add common response and error models.
- Add request logging with stable request IDs.
- Add graceful shutdown and improve startup diagnostics.
- Decide whether task state initially lives in JSON files or SQLite.

Verification:

- `npm run verify:server`
- Health and config smoke tests.

### Phase 1: Task and event skeleton

Goal: Let the UI start a long-running backend task and receive progress.

- Implement `Task`, `Run`, `ToolCall`, and `Artifact` schemas.
- Add a simple in-process task runner.
- Add `POST /tasks`, `GET /tasks/{id}`, and `GET /tasks/{id}/events`.
- Emit mock tool-call events before connecting real tools.
- Persist task records enough to inspect recent runs.

Verification:

- Tests for task creation, status transitions, and event stream behavior.

### Phase 2: File and project service

Goal: Give the backend controlled access to selected project folders.

- Add project registry APIs or move existing Tauri-side project persistence behind FastAPI.
- Add file listing, metadata, and safe path validation.
- Add document records for known Word, Excel, CAD, and PDF files.
- Add artifact storage and download/open metadata.

Verification:

- Tests for safe paths, rejected traversal, and artifact creation.

### Phase 3: First vertical workflow: Word review

Goal: Complete one useful end-to-end business workflow.

- Implement `.docx` extraction for headings, paragraphs, tables, and comments.
- Create a `review-word` workflow endpoint.
- Call the LAN model service with a controlled prompt and extracted document context.
- Return a structured issue list.
- Generate a Word or Markdown review report artifact.
- Display tool-call and artifact events in the existing conversation model.

Verification:

- Fixture `.docx` tests.
- Golden structured issue-list tests.
- Manual desktop smoke test.

### Phase 4: Excel checking workflow

Goal: Support equipment lists, parameter tables, and calculation workbook checks.

- Implement workbook/sheet/table extraction.
- Add configurable checking rules.
- Generate structured issues and optional annotated workbook artifacts.
- Add `check-excel` workflow endpoint.

Verification:

- Fixture `.xlsx` tests with formulas, merged cells, and multi-sheet workbooks.

### Phase 5: CAD/PDF drawing analysis

Goal: Start with extractable drawing metadata before deep CAD intelligence.

- Add PDF text and drawing catalog extraction.
- Add CAD metadata extraction strategy after confirming the target file types and available libraries.
- Extract title blocks, drawing names, drawing numbers, revision info, and simple consistency checks.
- Add `analyze-drawing` workflow endpoint.

Verification:

- Fixture PDF/CAD sample tests.
- Manual comparison against known drawing metadata.

### Phase 6: Knowledge source integration

Goal: Support standards, templates, typical designs, and previous project search.

- Add knowledge source registry.
- Add local indexing pipeline.
- Add retrieval API usable by agent workflows.
- Record citations in task outputs.

Verification:

- Retrieval quality smoke tests.
- Citation presence tests for generated review outputs.

### Phase 7: Hardening and packaging

Goal: Make workflows stable in the portable desktop app.

- Move to SQLite if JSON persistence starts to strain.
- Add migrations.
- Add task cancellation robustness.
- Add packaged server smoke tests.
- Improve logs and expose diagnostics in the UI.
- Revisit dynamic ports and graceful server shutdown.

Verification:

- `npm run verify:server`
- `npm run verify:web`
- Portable build smoke test.

## Suggested First Milestone

The strongest first milestone is:

```text
Select a Word document -> run review-word workflow -> stream tool progress ->
generate structured issues -> save a review report artifact -> show it in the conversation.
```

This milestone proves the important backend shape without overbuilding:

- Project/file access.
- Long-running task state.
- Agent orchestration.
- Tool-call event stream.
- LAN model call.
- Artifact generation.
- UI integration with real work output.

After this milestone works, Excel and drawing workflows can reuse the same task, event, artifact, and tool-call infrastructure.
