import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";
const pythonCommand = isWindows ? "python" : "python3";

mkdirSync("release", { recursive: true });

const result = spawnSync(
  pythonCommand,
  [
    "-m",
    "PyInstaller",
    "--clean",
    "--noconfirm",
    "--noconsole",
    "--onefile",
    "--name",
    "mousika-server",
    "--distpath",
    "release/server",
    "--workpath",
    "server/build",
    "--specpath",
    "server/build",
    "server/run.py",
  ],
  {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: false,
  },
);

process.exit(result.status ?? 1);
