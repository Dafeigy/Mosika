# Mousika Progress

## Current Status

- Minimal desktop demo is running with Tauri 2, Vue 3, and FastAPI.
- Development flow is available through `npm run dev`.
- Portable release flow is available through `npm run build:portable`.
- The portable output is assembled at `release/Mousika`.
- In release mode, `Mousika.exe` starts `mousika-server.exe` from the same folder.
- The Vue client validates the local API through `GET http://127.0.0.1:8765/health`.

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

## Known Issues

- FastAPI shutdown is currently forceful. Tauri calls `child.kill()` and then `child.wait()` during window close.
- The packaged `mousika-server.exe` can occasionally remain alive after closing the portable app, which keeps `127.0.0.1:8765` occupied.
- The server port is fixed at `127.0.0.1:8765`, so a port conflict can prevent the packaged server from starting.
- The client has health-check retries, but it does not yet expose richer diagnostics if the server fails to start.
- The portable folder is not signed, zipped, checksummed, or versioned yet.
- No installer, updater, or migration strategy exists yet.
- Conversation and task data are still frontend mock data.
- Project registry persistence currently uses `%APPDATA%/Mousika/projects.json`; it is not migrated, validated with a schema version, or backed by SQLite yet.
- Project rename updates the app-data project registry, but it does not write `.mousika` metadata inside the project folder yet.
- Project removal menu items are visual placeholders and do not remove project records yet.
- New project-scoped conversation currently routes to the home composer with the project selected; it does not create a persisted empty conversation record yet.
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
   - Persist conversation creation and recent-update timestamps.
   - Add migration handling before replacing mock data completely.

9. Strengthen validation.
   - Keep `npm run verify:web`.
   - Keep `npm run verify:server`.
   - Add a smoke test for `mousika-server.exe`.
   - Add a release build check that verifies `release/Mousika` contains both executables.
