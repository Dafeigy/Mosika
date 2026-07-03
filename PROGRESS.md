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

## Known Issues

- FastAPI shutdown is currently forceful. Tauri calls `child.kill()` and then `child.wait()` during window close.
- The server port is fixed at `127.0.0.1:8765`, so a port conflict can prevent the packaged server from starting.
- The client has health-check retries, but it does not yet expose richer diagnostics if the server fails to start.
- The portable folder is not signed, zipped, checksummed, or versioned yet.
- No installer, updater, or migration strategy exists yet.

## Next Optimizations

1. Add graceful FastAPI shutdown.
   - Add an internal shutdown endpoint or another local-only shutdown mechanism.
   - Let Tauri request graceful shutdown first.
   - Fall back to `kill()` only after a timeout.

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

8. Strengthen validation.
   - Keep `npm run verify:web`.
   - Keep `npm run verify:server`.
   - Add a smoke test for `mousika-server.exe`.
   - Add a release build check that verifies `release/Mousika` contains both executables.
