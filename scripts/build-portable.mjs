import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const serverExeName = isWindows ? "mousika-server.exe" : "mousika-server";
const desktopExeName = isWindows ? "mousika-desktop.exe" : "mousika-desktop";
const appExeName = isWindows ? "Mousika.exe" : "Mousika";

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: isWindows && command.endsWith(".cmd"),
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(npmCommand, ["run", "build:server"]);
run(npmCommand, ["run", "build:desktop"]);

const portableDir = path.resolve("release", "Mousika");
const serverExe = path.resolve("release", "server", serverExeName);
const desktopExe = path.resolve(
  "apps",
  "desktop",
  "src-tauri",
  "target",
  "release",
  desktopExeName,
);

if (!existsSync(serverExe)) {
  throw new Error(`Server executable not found: ${serverExe}`);
}

if (!existsSync(desktopExe)) {
  throw new Error(`Desktop executable not found: ${desktopExe}`);
}

rmSync(portableDir, { recursive: true, force: true });
mkdirSync(portableDir, { recursive: true });
mkdirSync(path.join(portableDir, "data"), { recursive: true });
mkdirSync(path.join(portableDir, "logs"), { recursive: true });

copyFileSync(desktopExe, path.join(portableDir, appExeName));
copyFileSync(serverExe, path.join(portableDir, serverExeName));

console.log(`Portable build created: ${portableDir}`);
