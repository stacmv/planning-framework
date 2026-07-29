"use strict";

// Accumulated project memory: what Claude Code has remembered about a
// project, kept outside the repository in
// `<memoryRoot>/projects/<slug>/memory/` (implementation_plan.md, Task 6).
//
// Two things this module is careful about:
//
//  * "there is no memory" is a *statement*, not an empty list. A developer
//    looking at an empty panel cannot tell "nothing was ever remembered"
//    from "the tool failed to find it", so the three situations — files,
//    no `memory/` directory at all, an empty `memory/` directory — are
//    distinct states, each with its own message.
//  * session transcripts (`*.jsonl`, `sessions-index.json`) sit next to
//    `memory/`, not inside it, and are excluded here as well as at read
//    time. They are raw conversation logs; this tool never shows them.

const fs = require("node:fs");
const path = require("node:path");

const paths = require("./paths");

const MAX_ENTRIES = 500;
const MAX_DEPTH = 8;

/**
 * List the memory files recorded for a project.
 *
 * @param {string} projectRoot Absolute path of the project.
 * @param {object} [env]       Environment (for PLANNING_TEST_UI_MEMORY_ROOT).
 * @returns {{slug: string, memoryRoot: string, memoryDir: string,
 *            state: "present"|"absent"|"empty", files: Array<object>,
 *            message: string}}
 */
function listProjectMemory(projectRoot, env = process.env) {
  const slug = paths.slugForProjectPath(projectRoot);
  const memoryDir = paths.memoryDirForProject(projectRoot, env);
  const base = {
    slug,
    memoryRoot: paths.memoryRoot(env),
    memoryDir,
    files: [],
  };

  let stat = null;
  try {
    stat = fs.statSync(memoryDir);
  } catch {
    stat = null;
  }
  if (!stat || !stat.isDirectory()) {
    return {
      ...base,
      state: "absent",
      message: "No memory has been recorded for this project yet — there is no memory directory for it.",
    };
  }

  const files = collectFiles(memoryDir, "", 0);
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  if (files.length === 0) {
    return {
      ...base,
      state: "empty",
      message: "A memory directory exists for this project, but it holds no files.",
    };
  }
  return {
    ...base,
    state: "present",
    files,
    message: `${files.length} memory file${files.length === 1 ? "" : "s"} recorded for this project.`,
  };
}

function collectFiles(dir, relPrefix, depth) {
  if (depth > MAX_DEPTH) return [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const found = [];
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      // Symlinked directories are not followed: the listing must describe
      // what is inside `memory/`, not wherever a link happens to point.
      if (entry.isSymbolicLink()) continue;
      found.push(...collectFiles(abs, rel, depth + 1));
    } else if (entry.isFile()) {
      if (paths.isSessionTranscript(entry.name)) continue;
      let size = 0;
      let modified = null;
      try {
        const st = fs.statSync(abs);
        size = st.size;
        modified = st.mtime.toISOString();
      } catch {
        /* a file that vanished mid-listing is simply reported without stats */
      }
      found.push({ name: entry.name, relativePath: rel, path: abs, bytes: size, modified });
    }
    if (found.length >= MAX_ENTRIES) break;
  }
  return found;
}

module.exports = {
  MAX_ENTRIES,
  listProjectMemory,
};
