import { spawn, spawnSync } from "node:child_process";
import net from "node:net";

const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const pythonCommand = isWindows ? "python" : "python3";
const serverHost = "127.0.0.1";

let shuttingDown = false;
const children = [];

function isPortAvailable(port, host = serverHost) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

function reserveLocalPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", reject);
    server.listen(0, serverHost, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close(() => {
        if (port) {
          resolve(port);
        } else {
          reject(new Error("Unable to reserve a local port"));
        }
      });
    });
  });
}

function killProcessTree(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  if (isWindows) {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }

  child.kill("SIGTERM");
}

function stopAll(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of [...children].reverse()) {
    killProcessTree(child);
  }

  process.exit(exitCode);
}

async function preflight() {
  const checks = [
    { port: 1420, label: "Vite dev server" },
  ];

  for (const check of checks) {
    const available = await isPortAvailable(check.port);
    if (!available) {
      console.error(
        `[dev] ${serverHost}:${check.port} is already in use (${check.label}). ` +
          "Stop the existing process, then run npm run dev again.",
      );
      process.exit(1);
    }
  }
}

function startProcess(processConfig, extraEnv = {}) {
  let child;

  try {
    child = spawn(processConfig.command, processConfig.args, {
      cwd: process.cwd(),
      env: { ...process.env, ...extraEnv },
      shell: processConfig.shell ?? false,
      stdio: "inherit",
      windowsHide: true,
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
process.on("SIGHUP", () => stopAll(0));

await preflight();
const serverPort = await reserveLocalPort();
const serverUrl = `http://${serverHost}:${serverPort}`;
console.log(`[dev] FastAPI server URL: ${serverUrl}`);

const processes = [
  {
    name: "server",
    command: pythonCommand,
    args: [
      "-m",
      "uvicorn",
      "server.app.main:app",
      "--host",
      serverHost,
      "--port",
      String(serverPort),
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

const devEnv = {
  MOUSIKA_SERVER_URL: serverUrl,
  VITE_API_BASE_URL: serverUrl,
};

for (const processConfig of processes) {
  startProcess(processConfig, devEnv);
}
