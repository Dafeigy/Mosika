# AGENTS.md

This file gives coding agents the local context needed to work on Mousika without rediscovering the project shape.

## Project Summary

Mousika is a Windows-first desktop AI workbench prototype.

- Frontend: Vue 3 + Vite, under `apps/desktop/src`
- Desktop shell: Tauri 2, under `apps/desktop/src-tauri`
- UI components: shadcn-vue style components, under `apps/desktop/src/components/ui`
- Local server: FastAPI, under `server/app`
- Portable release: `release/Mousika/Mousika.exe` plus `mousika-server.exe`

The current demo validates the local API through:

```text
GET http://127.0.0.1:8765/health
```

## Common Commands

Install dependencies:

```powershell
npm install
python -m pip install -r server/requirements-dev.txt
```

Run the full desktop development flow:

```powershell
npm run dev
```

Run parts separately:

```powershell
npm run dev:server
npm run dev:web
npm run dev:desktop
```

Verify changes:

```powershell
npm run verify:web
npm run verify:server
```

Check Tauri/Rust changes:

```powershell
cargo check
```

Run this from:

```text
apps/desktop/src-tauri
```

Build the portable demo:

```powershell
npm run build:portable
```

## Repository Map

```text
.
|-- apps/
|   `-- desktop/
|       |-- src/
|       |   |-- api/                 Frontend API helpers
|       |   |-- components/          Vue components
|       |   |   `-- ui/              shadcn-vue generated components
|       |   |-- lib/                 Frontend utilities
|       |   |-- App.vue              Current main UI shell and workbench
|       |   `-- styles.css           Tailwind and theme tokens
|       `-- src-tauri/
|           |-- capabilities/         Tauri 2 permissions
|           |-- src/main.rs           Tauri entry and packaged server lifecycle
|           |-- Cargo.toml
|           `-- tauri.conf.json
|-- design-reference/                 HTML design references
|-- scripts/                          Dev and build scripts
|-- server/
|   |-- app/                          FastAPI app
|   |-- tests/                        Pytest tests
|   `-- run.py                        PyInstaller packaged server entry
|-- README.md                         Developer guide
|-- PROGRESS.md                       Roadmap and known issues
`-- package.json                      Workspace scripts
```

## Frontend Notes

- The main UI is currently concentrated in `apps/desktop/src/App.vue`.
- The project selector is extracted to `apps/desktop/src/components/ProjectMenubar.vue`.
- shadcn-vue generated components live in `apps/desktop/src/components/ui`.
- Use generated shadcn-vue components when adding common primitives such as dialog, tooltip, menubar, input, label, badge, separator, and textarea.
- Keep UI density close to the current workbench style: compact controls, restrained color, stable dimensions, and no marketing-style landing sections.
- Use `lucide-vue-next` for icons.
- Avoid changing global `.tiny-icon` rules for local menu tuning. Prefer component-scoped classes such as `project-menu-icon`.
- Do not make project menu selections navigate unless the user explicitly asks for navigation. Current behavior is:
  - Selecting an existing project updates the menu display name.
  - The "create empty project" action opens a dialog and then updates the menu display name.
  - The "use existing folder" action opens the system folder picker and then uses the selected folder name.
  - The "no project" action clears the current project selection.

## Tauri Notes

- Tauri 2 lives in `apps/desktop/src-tauri`.
- Release builds use the Windows GUI subsystem to avoid an extra console window.
- In release mode, Tauri starts `mousika-server.exe` from the same folder as `Mousika.exe`.
- The local API URL is exposed through the `get_server_url` Tauri command.
- The dialog plugin is installed and registered:
  - Frontend package: `@tauri-apps/plugin-dialog`
  - Rust crate: `tauri-plugin-dialog`
  - Permission: `dialog:default` in `src-tauri/capabilities/default.json`
- If adding another Tauri plugin, update both the frontend/Rust dependencies and capability permissions as needed, then run `cargo check`.

## FastAPI Notes

- FastAPI app entry: `server/app/main.py`
- Health route: `server/app/api/health.py`
- Settings/CORS: `server/app/core/config.py`
- Packaged server entry: `server/run.py`
- The packaged server should keep using `127.0.0.1` only. Do not bind to public interfaces for local desktop workflows.

## Packaging Notes

- `scripts/build-server.mjs` builds `mousika-server.exe` with PyInstaller.
- `scripts/build-portable.mjs` assembles the portable folder.
- `apps/desktop/src-tauri/tauri.conf.json` currently has `bundle.active` set to `false`.
- Portable output is expected at:

```text
release/Mousika
```

- Do not commit generated release artifacts from `release/`.
- Do not commit PyInstaller build folders from `server/build/`.

## Known Issues To Preserve In Mind

See `PROGRESS.md` before making architecture changes. Current important items:

- FastAPI shutdown is forceful.
- Packaged `mousika-server.exe` may occasionally remain alive after app close.
- The server port is fixed at `127.0.0.1:8765`.
- There is no installer/updater/signing flow yet.
- Server startup diagnostics are still minimal.

## Coding Guidelines

- Prefer small, scoped edits.
- Follow existing patterns before introducing new abstractions.
- Use `rg` for search.
- Use `apply_patch` for manual edits.
- Do not revert user changes or unrelated dirty files.
- Keep generated shadcn-vue files close to their generated style unless there is a clear local reason to customize.
- When editing UI, run `npm run verify:web`.
- When editing FastAPI, run `npm run verify:server`.
- When editing Tauri/Rust, run `cargo check` from `apps/desktop/src-tauri`.

## Windows Development Notes

- `npm run dev` preflights ports `8765` and `1420`.
- If `127.0.0.1:8765` is occupied, check for stale `Mousika.exe`, `mousika-server.exe`, `python`, or `node` processes.
- Folder picking in the project menu uses the Tauri dialog plugin and works in the Tauri desktop runtime.
- Plain browser/Vite-only mode may not support native folder picking.
