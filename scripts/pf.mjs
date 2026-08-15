#!/usr/bin/env node

import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lifecycleCommands = new Set(["activate", "deactivate", "uninstall", "converge", "update-skills", "issue-status"]);
const args = process.argv.slice(2);
const script = lifecycleCommands.has(args[0])
  ? path.join(root, "scripts", "pf-cli.mjs")
  : path.join(root, "tools", "onboarding-tui", "cli.js");

const result = spawnSync(process.execPath, [script, ...args], { stdio: "inherit" });
process.exit(result.status ?? 1);
