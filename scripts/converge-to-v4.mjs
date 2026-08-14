#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const result = spawnSync(process.execPath, [path.join(dir, "pf-cli.mjs"), "converge", ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(result.status ?? 1);
