"use strict";

// The project instructions that actually apply — every `CLAUDE.md` in force
// for a project (implementation_plan.md, Task 6).
//
// "In force" is the whole point of the module. Three kinds of file are all
// named `CLAUDE.md` and all sit in or above a project directory:
//
//   * the project's own root file and any nested ones — active;
//   * files inherited from parent directories (`~/dev/CLAUDE.md` above
//     `~/dev/planning-framework`) — active, and easy to forget, which is why
//     they are listed rather than left to memory;
//   * framework templates (`docs/planning/templates/**`) and test fixtures
//     (`test/fixtures/**`) — *not* active. They are skeletons and samples;
//     shown as if they were rules, a developer would follow a template.
//
// Same-named files are told apart by their full path — never by basename.

const fs = require("node:fs");
const path = require("node:path");

const INSTRUCTION_FILENAME = "CLAUDE.md";
const MAX_CONTENT_BYTES = 256 * 1024;
const MAX_ENTRIES = 200;
const MAX_DEPTH = 8;

// Directory names never descended into: version control internals, installed
// dependencies and agent state hold no instruction that applies to the
// project, and walking them is slow enough to be noticeable.
const SKIPPED_DIRS = new Set(["node_modules", ".git", ".claude"]);

// A path is *not* an active instruction when it lies under one of these
// segment runs, anywhere in the tree.
const INACTIVE_RULES = [
  {
    segments: ["test", "fixtures"],
    reason: "test fixture — a sample project used by the test suite, not an instruction that applies here",
  },
  {
    segments: ["docs", "planning", "templates"],
    reason: "framework template — a document skeleton, not an instruction that applies here",
  },
];

/**
 * Collect every `CLAUDE.md` that bears on a project.
 *
 * @param {string} projectRoot Absolute path of the project.
 * @returns {{projectRoot: string, instructions: Array<object>, ownCount: number,
 *            activeOwnCount: number, inheritedCount: number, activeCount: number,
 *            message: string|null}}
 */
function collectInstructions(projectRoot) {
  const root = path.resolve(projectRoot);
  const own = collectOwn(root);
  const inherited = collectInherited(root);
  const instructions = [...own, ...inherited];

  const activeOwnCount = own.filter((e) => e.active).length;
  const activeCount = instructions.filter((e) => e.active).length;

  return {
    projectRoot: root,
    instructions,
    ownCount: own.length,
    activeOwnCount,
    inheritedCount: inherited.length,
    activeCount,
    message: describe(own.length, activeOwnCount, inherited.length),
  };
}

// "Nothing here" always gets said in words: an empty panel cannot be told
// apart from a failure to look (TC-008, step 5).
function describe(ownCount, activeOwnCount, inheritedCount) {
  if (ownCount === 0 && inheritedCount === 0) {
    return `No ${INSTRUCTION_FILENAME} applies to this project — neither in the project itself nor in any parent directory.`;
  }
  if (activeOwnCount === 0 && ownCount === 0) {
    return (
      `This project has no ${INSTRUCTION_FILENAME} of its own; ` +
      `only ${inheritedCount} inherited file${inheritedCount === 1 ? "" : "s"} from parent directories applies.`
    );
  }
  if (activeOwnCount === 0) {
    return (
      `This project has no active ${INSTRUCTION_FILENAME} of its own — ` +
      `every one found in it is a template or a test fixture.`
    );
  }
  return null;
}

function collectOwn(root) {
  const found = [];
  walk(root, root, 0, found);
  found.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return found;
}

function walk(root, dir, depth, found) {
  if (depth > MAX_DEPTH || found.length >= MAX_ENTRIES) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (found.length >= MAX_ENTRIES) return;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIPPED_DIRS.has(entry.name)) continue;
      // Not followed: a symlinked directory can point anywhere, including
      // back up the tree.
      if (entry.isSymbolicLink()) continue;
      walk(root, abs, depth + 1, found);
    } else if (entry.isFile() && entry.name === INSTRUCTION_FILENAME) {
      found.push(makeEntry(root, abs, dir === root ? "project" : "nested"));
    }
  }
}

// Parent directories, nearest first — the order in which a reader asks
// "and what else applies to this?".
function collectInherited(root) {
  const found = [];
  let dir = path.dirname(root);
  for (;;) {
    const candidate = path.join(dir, INSTRUCTION_FILENAME);
    if (isFile(candidate)) found.push(makeEntry(root, candidate, "inherited"));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return found;
}

function isFile(candidate) {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function makeEntry(root, absPath, scope) {
  const inherited = scope === "inherited";
  const relative = inherited ? null : toPosix(path.relative(root, absPath));
  const inactiveReason = inherited ? null : inactiveReasonFor(relative);
  const active = inactiveReason === null;

  const entry = {
    path: absPath,
    relativePath: relative,
    // The directory the file governs — what makes two files named
    // `CLAUDE.md` distinguishable at a glance in the UI.
    directory: path.dirname(absPath),
    scope,
    inherited,
    active,
    inactiveReason,
    bytes: 0,
    lines: 0,
    truncated: false,
    content: null,
  };

  let stat = null;
  try {
    stat = fs.statSync(absPath);
  } catch {
    return entry;
  }
  entry.bytes = stat.size;

  // Only what is in force is handed over with its text. An inactive file is
  // named and explained, never quoted — quoting it is exactly how a template
  // gets mistaken for a rule.
  if (!active) return entry;
  try {
    const raw = fs.readFileSync(absPath, "utf8");
    entry.truncated = Buffer.byteLength(raw, "utf8") > MAX_CONTENT_BYTES;
    entry.content = entry.truncated ? raw.slice(0, MAX_CONTENT_BYTES) : raw;
    entry.lines = entry.content.replace(/\r\n/g, "\n").split("\n").filter((l, i, arr) => i < arr.length - 1 || l !== "").length;
  } catch {
    /* unreadable: it is still listed, just without its text */
  }
  return entry;
}

function inactiveReasonFor(relativePosixPath) {
  const segments = relativePosixPath.split("/");
  for (const rule of INACTIVE_RULES) {
    if (hasSegmentRun(segments, rule.segments)) return rule.reason;
  }
  return null;
}

function hasSegmentRun(segments, run) {
  for (let i = 0; i + run.length <= segments.length; i++) {
    let match = true;
    for (let j = 0; j < run.length; j++) {
      if (segments[i + j] !== run[j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

module.exports = {
  INSTRUCTION_FILENAME,
  INACTIVE_RULES,
  MAX_CONTENT_BYTES,
  collectInstructions,
};
