// TC-008 — project instructions and accumulated memory.
//
// The two sources a developer cannot get from the issue documents alone:
// what rules are in force for the project (every CLAUDE.md that applies,
// including the ones inherited from parent directories) and what the agent
// has already remembered about it (memory, which lives outside the
// repository entirely).
//
// Both are read through the running server, over HTTP, because that is the
// only way a client will ever see them; the fixture hierarchy is built in a
// temp directory, and the memory root is redirected with
// PLANNING_TEST_UI_MEMORY_ROOT so the developer's real ~/.claude is never
// read.
//
// Run: node --test test/dev-sources.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const {
  TOOL_DIR,
  makeTempDir,
  writeFileTree,
  makeMemoryRoot,
  makeConfig,
  slugForProjectPath,
  autoCleanup,
} = require("./helpers/fixtures");
const { startServerFor } = require("./helpers/server");

const REPO_ROOT = path.resolve(TOOL_DIR, "..", "..");

// Copies of the real files, not lookalikes: what makes a template or a
// fixture recognisable must keep working against the files the repository
// actually ships (test_plan.md, TC-008 Test Data).
function readRepoFile(relPath) {
  const abs = path.join(REPO_ROOT, ...relPath.split("/"));
  assert.ok(fs.existsSync(abs), `the repository no longer has ${relPath} — TC-008 needs the real file to copy`);
  return fs.readFileSync(abs, "utf8");
}

function buildFixture() {
  const tmp = makeTempDir("pf-ui-dev-sources-");
  const parent = path.join(tmp, "parent");
  const projectDir = path.join(parent, "project");
  const nodocsDir = path.join(parent, "project-nodocs");
  const emptyMemoryDir = path.join(parent, "project-empty");
  // Dashes and non-ASCII characters in the same path: the slug rule maps
  // both onto "-", and the tool must still find the right directory (step 7).
  const unicodeDir = path.join(parent, "проект-с-дефисом");

  writeFileTree(tmp, {
    "parent/CLAUDE.md": "# Parent instructions\n\nEverything under ~/dev obeys this file.\n",
    "parent/project/CLAUDE.md": "# Project instructions\n\nThe project's own rules.\n",
    "parent/project/sub/CLAUDE.md": "# Sub-directory instructions\n",
    "parent/project/test/fixtures/no-pf-claude/CLAUDE.md": readRepoFile("test/fixtures/no-pf-claude/CLAUDE.md"),
    "parent/project/docs/planning/templates/config/CLAUDE.md": readRepoFile("docs/planning/templates/config/CLAUDE.md"),
    "parent/project/docs/issues/open/.gitkeep": "",
    "parent/project-nodocs/README.md": "A project with no CLAUDE.md of its own.\n",
    "parent/project-empty/README.md": "A project whose memory directory exists but is empty.\n",
    "parent/проект-с-дефисом/README.md": "Путь с дефисами и не-ASCII символами.\n",
  });

  const memRoot = makeMemoryRoot({ root: path.join(tmp, "claude-home") });
  memRoot.addProject({
    projectPath: projectDir,
    memory: {
      "notes.md": "# Accumulated notes\n\nFirst remembered fact.\nSecond remembered fact.\n",
      "MEMORY.md": "# MEMORY\n\nThe long-lived summary.\n",
      // A transcript that has strayed *into* memory/ — excluded by name, not
      // only by living next to the directory.
      "stray-session.jsonl": '{"type":"user","text":"secret transcript content"}\n',
      "sessions-index.json": '{"sessions":[]}\n',
    },
  });
  memRoot.addProject({
    projectPath: unicodeDir,
    memory: { "notes.md": "# Заметки\n\nПамять по проекту с не-ASCII путём.\n" },
  });
  // The empty case: the directory exists, nothing is in it.
  fs.mkdirSync(path.join(memRoot.projectsDir, slugForProjectPath(emptyMemoryDir), "memory"), { recursive: true });
  // project-nodocs deliberately gets no entry at all.

  const config = makeConfig({
    projects: [
      { name: "project", path: projectDir },
      { name: "nodocs", path: nodocsDir },
      { name: "empty", path: emptyMemoryDir },
      { name: "unicode", path: unicodeDir },
    ],
  });

  return { tmp, parent, projectDir, nodocsDir, emptyMemoryDir, unicodeDir, memRoot, config };
}

function byRelative(list, relativePath) {
  return list.find((e) => e.relativePath === relativePath) || null;
}

test("TC-008: project instructions and accumulated memory", async (t) => {
  autoCleanup(t);
  const fx = buildFixture();
  const server = await startServerFor(t, {
    configPath: fx.config.configPath,
    env: { PLANNING_TEST_UI_MEMORY_ROOT: fx.memRoot.root },
  });

  const instructionsOf = async (project) => {
    const res = await server.get(`/api/projects/${project}/instructions`);
    assert.strictEqual(res.status, 200, res.text);
    return res.json;
  };
  const memoryOf = async (project) => {
    const res = await server.get(`/api/projects/${project}/memory`);
    assert.strictEqual(res.status, 200, res.text);
    return res.json;
  };

  await t.test("step 1: the project's own CLAUDE.md files are listed, each by its own path", async () => {
    const body = await instructionsOf("project");
    const root = byRelative(body.instructions, "CLAUDE.md");
    const nested = byRelative(body.instructions, "sub/CLAUDE.md");

    assert.ok(root, "the project's root CLAUDE.md is missing from the listing");
    assert.ok(nested, "the nested sub/CLAUDE.md is missing from the listing");
    assert.strictEqual(root.active, true);
    assert.strictEqual(nested.active, true);
    assert.strictEqual(root.path, path.join(fx.projectDir, "CLAUDE.md"));
    assert.strictEqual(nested.path, path.join(fx.projectDir, "sub", "CLAUDE.md"));
    // Same basename, different files: they must be distinguishable.
    assert.notStrictEqual(root.path, nested.path);
    assert.ok(root.content.includes("The project's own rules"), "the root file's text was not returned");
    assert.ok(nested.content.includes("Sub-directory instructions"), "the nested file's text was not returned");
    assert.strictEqual(body.message, null, "a project with active instructions needs no message");
  });

  await t.test("step 2: a parent directory's CLAUDE.md is listed and marked inherited", async () => {
    const body = await instructionsOf("project");
    const inherited = body.instructions.find((e) => e.path === path.join(fx.parent, "CLAUDE.md"));
    assert.ok(inherited, "the parent directory's CLAUDE.md is not listed");
    assert.strictEqual(inherited.inherited, true);
    assert.strictEqual(inherited.scope, "inherited");
    assert.strictEqual(inherited.active, true);
    assert.strictEqual(inherited.relativePath, null, "an inherited file is not inside the project");
    assert.ok(inherited.content.includes("Everything under ~/dev obeys this file"));
    assert.ok(body.inheritedCount >= 1);
    // Every own entry is flagged the other way, so the two can never be
    // confused in the UI.
    for (const entry of body.instructions.filter((e) => e.relativePath !== null)) {
      assert.strictEqual(entry.inherited, false, `${entry.path} claims to be inherited`);
    }
  });

  await t.test("step 3: a CLAUDE.md under test/fixtures/ is not an active instruction", async () => {
    const body = await instructionsOf("project");
    const entry = byRelative(body.instructions, "test/fixtures/no-pf-claude/CLAUDE.md");
    if (entry !== null) {
      assert.strictEqual(entry.active, false, "a test fixture must not read as an active instruction");
      assert.ok(entry.inactiveReason && entry.inactiveReason.length > 0, "an inactive entry must say why");
      assert.strictEqual(entry.content, null, "an inactive file must not be quoted as if it were a rule");
    }
    assert.ok(
      !body.instructions.some((e) => e.active && /test\/fixtures\//.test(e.relativePath || "")),
      "a fixture CLAUDE.md is listed as active"
    );
  });

  await t.test("step 4: a CLAUDE.md from the framework template directory is not an active instruction", async () => {
    const body = await instructionsOf("project");
    const entry = byRelative(body.instructions, "docs/planning/templates/config/CLAUDE.md");
    if (entry !== null) {
      assert.strictEqual(entry.active, false, "a template must not read as an active instruction");
      assert.ok(entry.inactiveReason && entry.inactiveReason.length > 0, "an inactive entry must say why");
      assert.strictEqual(entry.content, null, "an inactive file must not be quoted as if it were a rule");
    }
    assert.ok(
      !body.instructions.some((e) => e.active && /docs\/planning\/templates\//.test(e.relativePath || "")),
      "a template CLAUDE.md is listed as active"
    );
  });

  await t.test("step 5: a project without any CLAUDE.md of its own says so in words", async () => {
    const body = await instructionsOf("nodocs");
    assert.strictEqual(body.ownCount, 0);
    assert.strictEqual(body.activeOwnCount, 0);
    assert.strictEqual(typeof body.message, "string");
    assert.ok(body.message.length > 0, "the absence of instructions must be stated, not left as an empty list");
    assert.ok(body.message.includes("CLAUDE.md"), `unhelpful message: ${body.message}`);
    for (const entry of body.instructions) {
      assert.strictEqual(entry.inherited, true, `${entry.path} is not inherited, so the project does own a file`);
    }
  });

  await t.test("step 6: memory has three distinguishable states, each with a message", async () => {
    const present = await memoryOf("project");
    assert.strictEqual(present.state, "present");
    assert.deepStrictEqual(
      present.files.map((f) => f.relativePath),
      ["MEMORY.md", "notes.md"],
      "memory listing must contain the memory files and nothing else"
    );
    assert.ok(present.message.length > 0);
    // Session transcripts are excluded whether they sit next to memory/ or
    // have strayed into it.
    for (const f of present.files) {
      assert.ok(!f.name.endsWith(".jsonl"), `transcript ${f.name} leaked into the memory listing`);
      assert.notStrictEqual(f.name, "sessions-index.json", "the sessions index leaked into the memory listing");
    }

    const absent = await memoryOf("nodocs");
    assert.strictEqual(absent.state, "absent");
    assert.deepStrictEqual(absent.files, []);
    assert.ok(absent.message.length > 0, "'no memory for this project' must be said out loud");
    assert.ok(/memory/i.test(absent.message), `unhelpful message: ${absent.message}`);

    const empty = await memoryOf("empty");
    assert.strictEqual(empty.state, "empty");
    assert.deepStrictEqual(empty.files, []);
    assert.ok(empty.message.length > 0, "an empty memory directory must be described, not passed over in silence");
    assert.notStrictEqual(empty.state, absent.state, "'no directory' and 'empty directory' must not collapse");
  });

  await t.test("step 7: a project path with dashes and non-ASCII characters resolves to the right memory", async () => {
    const body = await memoryOf("unicode");
    assert.strictEqual(body.slug, slugForProjectPath(fx.unicodeDir));
    assert.strictEqual(body.memoryDir, path.join(fx.memRoot.projectsDir, body.slug, "memory"));
    assert.strictEqual(body.state, "present", `memory not found for ${fx.unicodeDir} (slug ${body.slug})`);
    assert.deepStrictEqual(
      body.files.map((f) => f.relativePath),
      ["notes.md"]
    );
    // And it is a *different* directory from the plain project's, i.e. the
    // slug did not silently collapse two projects into one.
    const other = await memoryOf("project");
    assert.notStrictEqual(body.slug, other.slug);
  });
});
