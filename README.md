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

The first validation flow calls `GET http://127.0.0.1:8765/health` from the frontend.
