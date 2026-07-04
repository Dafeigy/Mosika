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

## Known Issues

- FastAPI shutdown is currently forceful. Tauri calls `child.kill()` and then `child.wait()` during window close.
- The packaged `mousika-server.exe` can occasionally remain alive after closing the portable app, which keeps `127.0.0.1:8765` occupied.
- The server port is fixed at `127.0.0.1:8765`, so a port conflict can prevent the packaged server from starting.
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

1. Add graceful FastAPI shutdown.
   - Add an internal shutdown endpoint or another local-only shutdown mechanism.
   - Let Tauri request graceful shutdown first.
   - Fall back to `kill()` only after a timeout.
   - Make shutdown cleanup app-level, not only window-event-level, so packaged server processes cannot remain orphaned.

2. Move from fixed port to dynamic port.
   - Let Tauri choose an available localhost port.
   - Pass the port to `mousika-server.exe` on startup.
   - Return the actual API URL from `get_server_url`.

3. Add Tauri-side server startup readiness checks.
   - After spawning the server, poll `/health` until it responds or times out.
   - Show a useful client-side error if startup fails.

4. Improve packaged server logs.
   - Add log rotation later if needed.
   - Consider exposing a "show logs" action in the desktop UI.

5. Improve portable release output.
   - Add a versioned folder or zip name such as `Mousika-0.1.0-windows-x64`.
   - Generate a checksum file.
   - Add a short release note.

6. Add installer and updater later.
   - Keep portable builds for internal testing.
   - Add NSIS or MSI when the app needs a user-friendly installation flow.
   - Add code signing before wider distribution.

7. Add application data path strategy.
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

8. Persist project and conversation runtime data.
   - Add schema versioning and validation for the app-data project registry.
   - Persist remove and create-project operations.
   - Persist conversation creation, message appends, tool-call updates, and recent-update timestamps.
   - Add migration handling before replacing mock data completely.

9. Strengthen validation.
   - Keep `npm run verify:web`.
   - Keep `npm run verify:server`.
   - Add a smoke test for `mousika-server.exe`.
   - Add a release build check that verifies `release/Mousika` contains both executables.
