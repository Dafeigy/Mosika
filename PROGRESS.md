# Mousika Progress

## Current Status

- Minimal desktop demo is running with Tauri 2, Vue 3, and FastAPI.
- Development flow is available through `npm run dev`.
- Portable release flow is available through `npm run build:portable`.
- The portable output is assembled at `release/Mousika`.
- In release mode, `Mousika.exe` starts `mousika-server.exe` from the same folder.
- The Vue client validates the local API through `GET http://127.0.0.1:8765/health`.

## Development Conventions

### Conversation Item Model

- Use two top-level conversation item types as the primary storage and rendering boundary:
  - `message`
  - `tool_call`
- `message` is for user, assistant, and system text/content blocks.
- `tool_call` is for agent tool execution, approval gates, file parsing, OCR, export, review, and other structured operations.
- Avoid adding top-level item types for every UI card, such as approval cards, issue lists, execution plans, or summary widgets.
- Render specialized UI from structured content blocks or tool results instead:
  - issue lists can come from `tool_call.result` with a render hint such as `issue_list`.
  - approval UI can come from `tool_call.status = approval_required` or `tool_call.result.requiresApproval`.
  - execution plans can live in a tool result or structured assistant message block.
- The message stream should be the source of truth. Workbench panels, status chips, and inspector content should be derived views.
- Keep the UI conversation flow close to Codex-style message and tool-call rhythm. Avoid dashboard-like top metric strips unless they are explicitly part of a tool result view.

Suggested TypeScript shape:

```ts
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
```

## Completed

- Split FastAPI code into a small `api` and `core` structure.
- Added a production server entry at `server/run.py`.
- Added a frontend API layer under `apps/desktop/src/api`.
- Added a no-extra-dependency development launcher at `scripts/dev.mjs`.
- Added PyInstaller-based server packaging at `scripts/build-server.mjs`.
- Added portable folder assembly at `scripts/build-portable.mjs`.
- Set Tauri `bundle.active` to `false` for direct executable output.
- Replaced the broken Tauri icon file with a valid ICO.
- Allowed `apps/desktop/src-tauri/Cargo.lock` to be tracked.
- Added frontend health-check retries so packaged server cold starts do not fail immediately.
- Added packaged Tauri origins to FastAPI CORS settings.
- Packaged server now runs without a console window and writes logs to `logs/server.log`.
- Packaged Tauri app now uses the Windows GUI subsystem in release builds to avoid a console window.
- Reworked the desktop sidebar toward a Codex-like structure:
  - Top-level actions for new task, search, and scheduled work.
  - Project tree with project-scoped conversations.
  - Separate unscoped conversation list for chats started without a project.
  - Conversation status dots for running, pending approval, and completed states.
  - Project hover actions for more options and new conversation.
- Added project mock data with stable project IDs, mutable display names, and folder paths.
- Added conversation mock data keyed by stable project IDs rather than project names.
- Added a Tauri command to open a project folder in the system file explorer.
- Added mock project folders under `mock-projects/` for local UI testing.
- Added runtime project rename support for the current mock project list.
- Added a Tauri-backed project registry at `%APPDATA%/Mousika/projects.json`.
- Project rename now persists to the local project registry and survives app reloads.
- Project registry records no longer store UI activation state; app startup begins from the new-conversation home page.
- Global new-task entry clears the selected conversation and project context, while project-scoped new conversation keeps only the selected workspace project.
- Removed the dashboard-like top metric strip from the workbench conversation prototype.
- Added local conversation storage under `%APPDATA%/Mousika/conversations/`.
  - `index.json` stores conversation metadata for fast project/no-project association.
  - `{conversationId}.jsonl` stores the conversation item stream using `message` and `tool_call` records.
  - Existing mock conversations initialize the local store on first launch.
- Added dynamic local server ports for the full desktop flow.
  - `npm run dev` now chooses an available localhost port for FastAPI and passes it to the desktop runtime.
  - Packaged Tauri startup now chooses an available localhost port, starts `mousika-server.exe` with that port, waits for `/health`, and exposes the actual URL through `get_server_url`.
  - FastAPI CORS now allows dynamic `localhost` and `127.0.0.1` origins.
- Added graceful packaged server shutdown.
  - FastAPI exposes a local-only, token-protected internal shutdown endpoint.
  - Packaged Tauri shutdown requests graceful server exit first, waits briefly, and falls back to killing the child only if needed.

## Known Issues

- Packaged server shutdown still falls back to force-kill if the internal graceful shutdown request fails or times out.
- `npm run dev:server` still defaults to `127.0.0.1:8765` for standalone server debugging.
- The client has health-check retries, but it does not yet expose richer diagnostics if the server fails to start.
- The portable folder is not signed, zipped, checksummed, or versioned yet.
- No installer, updater, or migration strategy exists yet.
- Conversation data is initialized from frontend mock data, then loaded from the local JSON/JSONL store.
- Conversation updates are not yet fully wired to runtime actions such as creating a new conversation, appending streamed messages, or updating tool-call status.
- Project registry persistence currently uses `%APPDATA%/Mousika/projects.json`; it is not migrated, validated with a schema version, or backed by SQLite yet.
- Project rename updates the app-data project registry, but it does not write `.mousika` metadata inside the project folder yet.
- Project removal menu items are visual placeholders and do not remove project records yet.
- New project-scoped conversation currently routes to the home composer with the project selected; it does not create a persisted empty conversation record yet.
- New global conversations currently start as an unpersisted composer state until the first message/create action is wired.
- Search and scheduled-work sidebar actions are visual placeholders.
- The "open in explorer" action depends on mock folder paths in this development workspace.

## Next Optimizations

1. Add richer server startup diagnostics.
   - Surface packaged server readiness failures in the desktop UI.
   - Consider exposing the selected local API URL and log path in a diagnostics panel.

2. Improve packaged server logs.
   - Add log rotation later if needed.
   - Consider exposing a "show logs" action in the desktop UI.

3. Improve portable release output.
   - Add a versioned folder or zip name such as `Mousika-0.1.0-windows-x64`.
   - Generate a checksum file.
   - Add a short release note.

4. Add installer and updater later.
   - Keep portable builds for internal testing.
   - Add NSIS or MSI when the app needs a user-friendly installation flow.
   - Add code signing before wider distribution.

5. Add application data path strategy.
   - Decide which data belongs beside the portable exe.
   - Decide which data belongs in the OS app data directory.
   - Keep user workspaces explicit and user-controlled.
   - Recommended MVP persistence path:
     - Store the local project registry in `%APPDATA%/Mousika/projects.json` on Windows.
     - Keep project identity stable through a project ID rather than a mutable display name.
     - Store records shaped like `id`, `name`, `folderPath`, `createdAt`, `updatedAt`, and optional `archivedAt`.
     - Continue using the frontend as a runtime cache, but treat the app-data registry as the source of truth.
   - Recommended longer-term persistence path:
     - Move from `projects.json` to SQLite when conversations, messages, task state, artifacts, and migrations become nontrivial.
     - Use tables such as `projects`, `conversations`, `messages`, and `tasks`.
     - Consider writing portable project metadata under each workspace, such as `.mousika/project.json`, so folders can be recognized after moving machines.
     - Keep app-data SQLite as the user's recent/open project registry and UI-state store.

6. Persist project and conversation runtime data.
   - Add schema versioning and validation for the app-data project registry.
   - Persist remove and create-project operations.
   - Persist conversation creation, message appends, tool-call updates, and recent-update timestamps.
   - Add migration handling before replacing mock data completely.

7. Strengthen validation.
   - Keep `npm run verify:web`.
   - Keep `npm run verify:server`.
   - Add a smoke test for `mousika-server.exe`.
   - Add a release build check that verifies `release/Mousika` contains both executables.
