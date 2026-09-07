// TC-031 — final regression pass over US-08 (specs.md §7): the redesign
// (Tasks 1-27 of this issue) must not have grown a new runtime dependency,
// must still start with one command, must still classify and now render the
// checklist's three states inside the new `.doc-panel` (Tasks 24/26), and
// the two guarantees this tool made before the redesign — confirmed checkout
// and single-line point-writes — must still hold.
//
// Steps 4 and 5 are deliberately not re-implemented here: `test/checklist-
// git.test.js` (TC-014) and `test/checklist-patch.test.js` (TC-013) already
// cover them in full, end to end, against a real server. Duplicating those
// assertions would only create a second place to update when the underlying
// behaviour is intentionally changed. Instead, this file re-runs them as a
// regression net — the same pattern `test/checklist-patch.test.js` step 1
// already uses for `checklist-ru.test.js` — so a failure surfaces here too,
// under this issue's own TC.
//
// Run: node --test test/regression-us08.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");

const { TOOL_DIR, makeTempRepo, makeConfig, autoCleanup } = require("./helpers/fixtures");
const { startServerFor } = require("./helpers/server");

const REPO_ROOT = path.resolve(TOOL_DIR, "..", "..");
const MODULE_PATH = path.join(TOOL_DIR, "public", "workspace.js");

async function loadModule() {
  return import(pathToFileURL(MODULE_PATH).href);
}

const FULL = "20260101-feat-fixture-full"; // manual_test_checklist.md on disk -> "here"
const ONBRANCH = "20260104-feat-fixture-onbranch"; // manual_test_checklist.md only on issue/<id> -> "on_branch"
const NOQA = "20260106-feat-fixture-noqa"; // no manual_test_checklist.md anywhere -> "missing"
const NOSPEC = "20260102-improve-fixture-nospec"; // specs.md not applicable to an improve issue

// ---------------------------------------------------------------------------
// Minimal DOM stand-in — same shape test/workspace.test.js and
// test/workspace-ui.test.js use.
// ---------------------------------------------------------------------------

class FakeElement {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.className = "";
    this._text = "";
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this._listeners = {};
  }
  get textContent() {
    return this._text;
  }
  set textContent(v) {
    this._text = v;
    this.children = [];
  }
  set innerHTML(v) {
    if (v === "") this.children = [];
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
  addEventListener(type, fn) {
    (this._listeners[type] || (this._listeners[type] = [])).push(fn);
  }
  findAll(predicate) {
    const out = [];
    for (const child of this.children) {
      if (predicate(child)) out.push(child);
      out.push(...child.findAll(predicate));
    }
    return out;
  }
}

function installFakeDocument() {
  global.document = {
    createElement: (tag) => new FakeElement(tag),
  };
}

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ---------------------------------------------------------------------------
// Steps 1-2: no new dependency, one-command start.
// ---------------------------------------------------------------------------

test("TC-031 step 1: tools/manual-test-ui has not grown a package.json with external dependencies", () => {
  const pkgPath = path.join(TOOL_DIR, "package.json");
  if (!fs.existsSync(pkgPath)) return; // never existed — trivially zero dependencies

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const depKeys = Object.keys(pkg.dependencies || {});
  assert.deepStrictEqual(
    depKeys,
    [],
    `package.json must declare no external runtime dependencies, found: ${depKeys.join(", ")}`
  );

  // A "dependencies": {} with an actually-populated node_modules would still
  // be a lie the redesign told itself — every module this issue added
  // (lib/contrast.js, lib/roles-resolve.js, public/launcher.js,
  // public/workspace.js, public/inbox.js, ...) is zero-dependency by this
  // codebase's convention (specs.md §7), so nothing should be installed.
  const nodeModules = path.join(TOOL_DIR, "node_modules");
  if (fs.existsSync(nodeModules)) {
    const installed = fs.readdirSync(nodeModules).filter((n) => !n.startsWith("."));
    assert.deepStrictEqual(installed, [], `node_modules must be empty, found: ${installed.join(", ")}`);
  }
});

test("TC-031 step 2: `make test-ui` starts the tool with one command, no npm install first", () => {
  const lines = fs.readFileSync(path.join(REPO_ROOT, "Makefile"), "utf8").split("\n");
  const startIndex = lines.findIndex((l) => l.startsWith("test-ui:"));
  assert.notStrictEqual(startIndex, -1, "expected a `test-ui:` target in the repo Makefile");
  const recipeLines = [];
  for (let i = startIndex + 1; i < lines.length; i++) {
    if (lines[i].startsWith("\t")) recipeLines.push(lines[i]);
    else if (lines[i].trim() === "") continue;
    else break; // the next target (or EOF-adjacent blank run) ends this recipe
  }
  const body = recipeLines.join("\n");

  assert.doesNotMatch(
    body,
    /\bnpm\s+(install|ci)\b|\byarn\b|\bpnpm\b/,
    "the test-ui target must not run any package manager install step before launching the tool"
  );
  assert.match(
    body,
    /node\s+tools\/manual-test-ui\/server\.js/,
    "the test-ui target must launch the tool with a single `node server.js` invocation"
  );
});

// ---------------------------------------------------------------------------
// Step 3: the checklist's three states, classified as before, now rendered
// inside the new `.doc-panel`.
// ---------------------------------------------------------------------------

test("TC-031 step 3: the checklist tab's missing/branch-only/on-disk states render inside the new .doc-panel with the right badge", async (t) => {
  autoCleanup(t);
  const repo = makeTempRepo({ name: "main", issues: [FULL, ONBRANCH, NOQA] });
  const config = makeConfig({ projects: [{ name: "main", path: repo.root }] });
  const server = await startServerFor(t, { configPath: config.configPath });
  const mod = await loadModule();

  installFakeDocument();
  const container = new FakeElement("div");
  const checklistFetches = [];
  const fetchImpl = (pathname) => {
    if (pathname.endsWith("/checklist")) checklistFetches.push(pathname);
    return fetch(server.baseUrl + pathname);
  };

  const handle = mod.mount(container, { project: "main", issueId: FULL, initialRole: "tester", fetchImpl });
  await handle.ready;
  handle.selectTab(mod.CHECKLIST_DOC_ID);
  await settle();

  function activePanel() {
    const panels = container.findAll((n) => n.className === "doc-panel");
    assert.strictEqual(panels.length, 1, "exactly one .doc-panel must be mounted at a time");
    assert.strictEqual(panels[0].dataset.tabId, mod.CHECKLIST_DOC_ID);
    return panels[0];
  }
  function badgesOf(panel) {
    return panel.findAll((n) => n.className === "badge").map((b) => b.textContent);
  }
  // The DOM stand-in's `innerHTML` setter is a no-op for non-empty strings
  // (see FakeElement above), so the checklist body's actual markup is not
  // observable here — TC-030 already covers that HTML in full against a real
  // response. What this suite can and does observe is that the structured
  // render path was actually taken *inside this panel*: a `.checklist-body`
  // container exists (present states) or does not (missing, where only the
  // badge + `.notice` message stand in for a body).
  function checklistBodyCountOf(panel) {
    return panel.findAll((n) => n.className === "checklist-body").length;
  }

  // on-disk ("here"): status "present", location "disk" -> statusBadgeText
  // returns null, so no badge; the structured checklist endpoint is fetched
  // and its `.checklist-body` mounted (renderChecklistPanel needs the parsed
  // document, TC-030).
  let panel = activePanel();
  assert.deepStrictEqual(badgesOf(panel), [], "an on-disk checklist must carry no status badge");
  assert.strictEqual(checklistBodyCountOf(panel), 1, "an on-disk checklist must render its structured .checklist-body");
  assert.ok(
    checklistFetches.some((u) => u.includes(FULL)),
    "the on-disk checklist must be fetched through the structured .../checklist endpoint"
  );

  // branch-only ("on_branch"): status "present", location "branch" ->
  // statusBadgeText returns "on branch"; the same structured endpoint still
  // resolves it (server.js reads it via `git show`, TC-014) and still mounts
  // a `.checklist-body` — a read-only preview, not a different render path.
  await handle.selectIssue(ONBRANCH);
  await settle();
  panel = activePanel();
  assert.deepStrictEqual(badgesOf(panel), ["on branch"], "a branch-only checklist must say so on its badge");
  assert.strictEqual(checklistBodyCountOf(panel), 1, "a branch-only checklist must still render its structured .checklist-body");
  assert.ok(
    checklistFetches.some((u) => u.includes(ONBRANCH)),
    "the branch-only checklist must also be fetched through the structured endpoint"
  );
  assert.strictEqual(repo.currentBranch(), "develop", "merely viewing a branch-only checklist must never switch branches");

  // missing: status "missing" -> statusBadgeText returns "missing", and no
  // `.checklist-body` at all — only the badge and the `.notice` message that
  // names /pf-test as the stage that creates it.
  //
  // FINDING (not fixed here — out of this task's scope, see completion
  // summary): `selectIssue()` repaints synchronously with the *previous*
  // issue's still-cached tab/item before `loadRoleContents()` resolves
  // (its own comment says as much: "reflect the dropdown's new value
  // immediately, tabs catch up async"). When that previous item's status was
  // "present", this stale paint's `.checklist-body` branch fires a fetch of
  // the *new* issue's checklist endpoint using the old item's "present"
  // guard — observed below as an extra `checklistFetches` entry for NOQA.
  // `fetchDoc()`'s `docCache` memoizes the *promise*, including a rejection
  // (`fetchJson` throws on a non-2xx response, e.g. this 404), keyed only by
  // endpoint — so if NOQA's checklist later comes to exist within this same
  // mount's lifetime (e.g. after /pf-test, then a `refresh()`/re-render),
  // the cached rejected promise would be replayed instead of the real
  // document being fetched again. Confirmed via source read, not exercised
  // as a failure here.
  await handle.selectIssue(NOQA);
  await settle();
  panel = activePanel();
  assert.deepStrictEqual(badgesOf(panel), ["missing"]);
  assert.strictEqual(checklistBodyCountOf(panel), 0, "a missing checklist must not render a .checklist-body");
  assert.strictEqual(panel.findAll((n) => n.className === "notice").length, 1, "a missing checklist must show its one notice message");
  assert.ok(
    checklistFetches.some((u) => u.includes(NOQA)),
    "the transitional stale paint is expected to have requested NOQA's endpoint once (see FINDING above)"
  );
});

test("TC-031 step 3 (supplement): the fourth docstate.js status, not_applicable, also renders correctly as an \"n/a\" badge", async (t) => {
  // TC-031 names three checklist states, but lib/docstate.js actually has a
  // fourth status a doc tab can carry — not_applicable, for a document the
  // pipeline never produces for this issue type (TC-007 step 1). Nothing in
  // this suite exercised its badge inside the real .doc-panel before this
  // task; statusBadgeText's own not_applicable branch was source-read-only
  // coverage until now.
  autoCleanup(t);
  const repo = makeTempRepo({ name: "main", issues: [NOSPEC] });
  const config = makeConfig({ projects: [{ name: "main", path: repo.root }] });
  const server = await startServerFor(t, { configPath: config.configPath });
  const mod = await loadModule();

  installFakeDocument();
  const container = new FakeElement("div");
  const fetchImpl = (pathname) => fetch(server.baseUrl + pathname);

  const handle = mod.mount(container, { project: "main", issueId: NOSPEC, initialRole: "developer", fetchImpl });
  await handle.ready;
  handle.selectTab("specs");
  await settle();

  const panels = container.findAll((n) => n.className === "doc-panel");
  assert.strictEqual(panels.length, 1);
  assert.strictEqual(panels[0].dataset.tabId, "specs");
  const badges = panels[0].findAll((n) => n.className === "badge").map((b) => b.textContent);
  assert.deepStrictEqual(badges, ["n/a"]);
});

// ---------------------------------------------------------------------------
// Steps 4-5: confirmed checkout and point-writes — regression net over the
// suites that already cover them end to end.
// ---------------------------------------------------------------------------

function runSuite(relFile) {
  const target = path.join(__dirname, relFile);
  const result = spawnSync(process.execPath, ["--test", target], { cwd: TOOL_DIR, encoding: "utf8" });
  assert.strictEqual(result.status, 0, `node --test ${relFile} failed:\n${result.stdout}\n${result.stderr}`);
}

test("TC-031 step 4: confirmed checkout still works as before (test/checklist-git.test.js, lib/git.js untouched)", () => {
  runSuite("checklist-git.test.js");
});

test("TC-031 step 5: patchStepResult/patchNotes still touch exactly one line (test/checklist-patch.test.js)", () => {
  runSuite("checklist-patch.test.js");
});
