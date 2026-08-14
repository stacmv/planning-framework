#!/usr/bin/env node

/* curl | node installer. It uses git and then delegates skill installation to pf-cli.mjs. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import readline from "node:readline/promises";

const repoUrl = process.env.PF_REPO_URL || "https://github.com/stacmv/planning-framework.git";
const branch = process.env.PF_REPO_BRANCH || "develop-v4.0";
const installDir = process.env.PF_INSTALL_DIR || path.join(os.homedir(), ".planning-framework");

function option(name, fallback) {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const requestedAgents = option("--agents", process.env.PF_AGENTS || "auto");
const target = path.resolve(option("--target", process.env.PF_TARGET || process.cwd()));
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("Usage: curl -fsSL <installer-url> | node -- [--agents auto|codex|claude|both] [--target <project>]");
  console.log("Default: auto-detect Claude Code and Codex. If both are available, choose interactively.");
  process.exit(0);
}
if (!["auto", "claude", "codex", "both"].includes(requestedAgents)) throw new Error(`Invalid --agents value: ${requestedAgents}`);

function run(args) {
  const result = spawnSync("git", args, { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed with exit code ${result.status}`);
}

if (spawnSync("git", ["--version"], { stdio: "ignore" }).status !== 0) throw new Error("git is required");
if (spawnSync(process.execPath, ["--version"], { stdio: "ignore" }).status !== 0) throw new Error("Node.js is required");

function available(command) {
  const result = spawnSync(command, ["--version"], { stdio: "ignore" });
  if (!result.error && result.status === 0) return true;
  if (process.platform !== "win32") return false;
  const check = spawnSync("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    `if (Get-Command ${command} -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }`
  ], { stdio: "ignore" });
  return !check.error && check.status === 0;
}

function terminalIo() {
  if (process.stdin.isTTY) return { input: process.stdin, output: process.stdout };
  const inputPath = process.platform === "win32" ? "CONIN$" : "/dev/tty";
  const outputPath = process.platform === "win32" ? "CONOUT$" : "/dev/tty";
  try {
    const input = fs.openSync(inputPath, "r");
    const output = fs.openSync(outputPath, "w");
    return {
      input: fs.createReadStream(inputPath, { fd: input, autoClose: true }),
      output: fs.createWriteStream(outputPath, { fd: output, autoClose: true })
    };
  } catch {
    return null;
  }
}

async function chooseAgents() {
  const claude = available("claude");
  const codex = available("codex");
  const installed = [claude && "claude", codex && "codex"].filter(Boolean);
  if (!installed.length) throw new Error("Neither Claude Code ('claude') nor Codex ('codex') was found on PATH. Install one, then re-run the installer.");
  if (requestedAgents !== "auto") {
    if (requestedAgents === "claude" && !claude) throw new Error("Claude Code ('claude') was not found on PATH.");
    if (requestedAgents === "codex" && !codex) throw new Error("Codex ('codex') was not found on PATH.");
    if (requestedAgents === "both" && (!claude || !codex)) throw new Error("--agents both requires both 'claude' and 'codex' on PATH.");
    return requestedAgents;
  }
  if (installed.length === 1) return installed[0];
  const io = terminalIo();
  if (!io) throw new Error("Both Claude Code and Codex were found. Re-run with --agents claude, --agents codex, or --agents both.");
  const prompt = readline.createInterface(io);
  const answer = (await prompt.question("Install PF4 for [c]laude, [o]dex, or [b]oth? ")).trim().toLowerCase();
  prompt.close();
  if (["c", "claude"].includes(answer)) return "claude";
  if (["o", "codex"].includes(answer)) return "codex";
  if (["b", "both"].includes(answer)) return "both";
  throw new Error("Choose claude, codex, or both.");
}

const agents = await chooseAgents();

console.log(`Planning Framework v4.0 installer (${branch}, agents: ${agents})`);
if (fs.existsSync(path.join(installDir, ".git"))) {
  run(["-C", installDir, "fetch", "origin", branch]);
  run(["-C", installDir, "reset", "--hard", `origin/${branch}`]);
} else {
  if (fs.existsSync(installDir)) fs.rmSync(installDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(installDir), { recursive: true });
  run(["clone", "-b", branch, repoUrl, installDir]);
}

const cli = path.join(installDir, "scripts", "pf-cli.mjs");
const command = agents === "claude" ? "update-skills" : "converge";
const args = [cli, command, "--agents", agents, "--source", installDir];
if (command === "converge") args.push("--target", target, "--yes");
const result = spawnSync(process.execPath, args, { stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Installed Planning Framework at ${installDir}`);
if (agents === "claude") console.log(`Run: ${path.join(os.homedir(), ".claude", "bin", process.platform === "win32" ? "pf.js" : "pf")}`);
else console.log(`Codex skills: ${path.join(target, ".agents", "skills")}`);
