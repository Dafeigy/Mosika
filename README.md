# Mousika

Mousika is a Windows-first desktop AI workbench prototype for engineering document, spreadsheet, drawing, and knowledge-base workflows.

The current demo uses:

- Desktop shell: Tauri 2
- Frontend: Vue 3 + Vite + shadcn-vue style components
- Local server: FastAPI
- Release prototype: portable folder with `Mousika.exe` and `mousika-server.exe`

## Prerequisites

Install these tools before starting:

- Node.js 22 or newer
- npm 10 or newer
- Python 3.12
- Rust stable toolchain
- Microsoft WebView2 Runtime
- Tauri 2 build prerequisites for Windows

Optional but recommended:

- PyInstaller, required for `npm run build:portable`

Install Python dependencies with:

```powershell
python -m pip install -r server/requirements-dev.txt
```

If PyInstaller is missing:

```powershell
python -m pip install pyinstaller
```

## Quick Start

Install frontend dependencies:

```powershell
npm install
```

Start the full desktop development flow:

```powershell
npm run dev
```

This starts both:

- FastAPI server at `http://127.0.0.1:8765`
- Tauri desktop client backed by the Vite dev server at `http://127.0.0.1:1420`

The first validation flow calls:

```text
GET http://127.0.0.1:8765/health
```

## Development Commands

Run only the local API server:

```powershell
npm run dev:server
```

Run only the Vue web client:

```powershell
npm run dev:web
```

Run only the Tauri desktop client:

```powershell
npm run dev:desktop
```

Validate the server:

```powershell
npm run verify:server
```

Validate the frontend build:

```powershell
npm run verify:web
```

## Portable Build

Build a Windows portable folder:

```powershell
npm run build:portable
```

The output is written to:

```text
release/Mousika
```

Expected output:

```text
Mousika/
|-- Mousika.exe
|-- mousika-server.exe
|-- data/
`-- logs/
```

Double-click `Mousika.exe` to run the packaged demo.

In release mode, `Mousika.exe` starts `mousika-server.exe` from the same folder. The server binds to `127.0.0.1:8765`, and the Vue client gets that URL from the Tauri `get_server_url` command.

## Project Layout

```text
.
|-- apps/
|   `-- desktop/
|       |-- src/              Vue client
|       `-- src-tauri/        Tauri 2 desktop shell
|-- design-reference/         Static design reference artifacts
|-- scripts/                  Development and build helpers
|-- server/
|   |-- app/                  FastAPI application code
|   |-- tests/                Server-side tests
|   `-- run.py                Packaged server entry point
|-- PROGRESS.md               Progress, known issues, and roadmap notes
|-- package.json              Workspace scripts
`-- README.md
```

## Architecture Notes

During development, the FastAPI server runs as a separate local process. The desktop client gets the API URL through the Tauri `get_server_url` command.

During portable release builds:

1. PyInstaller builds `mousika-server.exe` from `server/run.py`.
2. Tauri builds `mousika-desktop.exe`.
3. `scripts/build-portable.mjs` copies both executables into `release/Mousika`.
4. `Mousika.exe` starts `mousika-server.exe` on launch and stops it when the window closes.

Current process ownership:

- Tauri/Rust: desktop window, local process management, packaged app lifecycle
- Vue: user interface and API calls
- FastAPI/Python: local API and future document/spreadsheet/AI workflows

## Known Limitations

- The packaged server currently uses the fixed port `127.0.0.1:8765`.
- Server shutdown is currently forceful: Tauri calls `kill()` and then waits for the child process.
- Packaged server logs are not persisted yet.
- The portable folder is not signed, zipped, checksummed, or installer-backed yet.

See `PROGRESS.md` for the current roadmap and technical debt list.

## Troubleshooting

If `npm run dev` fails with a port conflict, check whether another process is using:

```text
127.0.0.1:8765
127.0.0.1:1420
```

If Tauri build fails while decoding the icon, regenerate or replace:

```text
apps/desktop/src-tauri/icons/icon.ico
```

If `build:portable` fails because PyInstaller is missing, install it with:

```powershell
python -m pip install pyinstaller
```
