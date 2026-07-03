# Mousika

Mousika is a Windows-first AI workbench prototype for engineering document, spreadsheet, drawing, and knowledge-base workflows.

## Stack

- Desktop shell: Tauri 2
- Frontend: Vue 3 + Vite + shadcn-vue style components
- Local server: FastAPI

## Development

Install dependencies:

```powershell
npm.cmd install
python -m pip install -r server/requirements-dev.txt
```

Run the local API server:

```powershell
npm.cmd run dev:server
```

Run the Vue web client:

```powershell
npm.cmd run dev:web
```

Run the Tauri desktop client:

```powershell
npm.cmd run dev:desktop
```

Or start the MVP desktop flow with one command:

```powershell
npm.cmd run dev
```

The first validation flow calls `GET http://127.0.0.1:8765/health` from the frontend.

## Project layout

- `server/app`: FastAPI application code.
- `server/tests`: server-side tests.
- `apps/desktop/src`: Vue client code.
- `apps/desktop/src-tauri`: Tauri 2 desktop shell.
- `design-reference`: static design reference artifacts.

During development, the FastAPI server runs as a separate local process. The Tauri shell exposes the server URL to the Vue client through `get_server_url`; production bundling and server process management are intentionally left as the next integration step.
