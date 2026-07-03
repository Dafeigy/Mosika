import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const pythonCommand = isWindows ? "python" : "python3";

const processes = [
  {
    name: "server",
    command: pythonCommand,
    args: [
      "-m",
      "uvicorn",
      "server.app.main:app",
      "--host",
      "127.0.0.1",
      "--port",
      "8765",
      "--reload",
    ],
  },
  {
    name: "desktop",
    command: npmCommand,
    args: ["run", "tauri:dev", "--workspace", "apps/desktop"],
    shell: isWindows,
  },
];

let shuttingDown = false;
const children = [];

function stopAll(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }

  process.exit(exitCode);
}

for (const processConfig of processes) {
  let child;

  try {
    child = spawn(processConfig.command, processConfig.args, {
      cwd: process.cwd(),
      env: process.env,
      shell: processConfig.shell ?? false,
      stdio: "inherit",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${processConfig.name}] failed to start: ${message}`);
    stopAll(1);
  }

  children.push(child);

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;

    const reason = signal ? signal : `exit ${code ?? 0}`;
    console.log(`[${processConfig.name}] stopped: ${reason}`);
    stopAll(code ?? 0);
  });

  child.on("error", (error) => {
    console.error(`[${processConfig.name}] failed to start: ${error.message}`);
    stopAll(1);
  });
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
