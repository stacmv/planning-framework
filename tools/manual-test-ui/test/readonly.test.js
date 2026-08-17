// TC-012 — strictly read-only: an exhaustive inventory of every mutating
// action.
//
// The whole promise of this tool is "it reads everything, it changes exactly
// five things": checklist marks/notes, a branch checkout on confirmation,
// preparing a test case's data, completing a human task (an append-only
// marker line in the issue's own session-log.md), and reassigning a human
// task's write actor (a single-substring point-edit of the issue's own
// prompt.md, plus the same append-only session-log.md marker). This suite
// verifies that promise from two directions:
//
//  1. Source inventory (no server involved): every `req.method === "..."`
//     check inside `handleApi` in server.js is read straight from the file,
//     not copied into this suite, so a seventh mutating route added anywhere
//     in that function is caught even if nobody updates this test. Likewise
//     `lib/git.js` is scanned for the literal argument arrays it passes to
//     `git`, so a `commit`/`push`/`merge`/`reset`/`clean` slipping in (or a
//     `checkout -f`) fails loudly.
//  2. Behaviour (a real server, a real git repository): every existing
//     non-GET route is fired at every pipeline document — project-level and
//     per-issue — with the document's own name in the body, and the whole
//     repository tree is fingerprinted before and after. Then the five
//     permitted actions are exercised for real and each is shown to touch
//     only what it is supposed to: the checklist file, the checked-out
//     issue's own directory, nothing in the repository at all (prepare
//     writes outside it, in the OS temp dir), or — for reassign — exactly
//     its own issue's prompt.md and session-log.md (its one deliberate
//     exception to "no route writes a pipeline document", scoped by this
//     same whole-tree fingerprint). Human-task completion and reassignment
//     also have their own dedicated coverage in
//     test/human-task-complete.test.js and test/human-tasks.test.js
//     respectively — this file adds only the whole-tree scoping check.
//
// Run: node --test tools/manual-test-ui/test/readonly.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const fixtures = require("./helpers/fixtures");

// Before anything reads os.tmpdir(): the prepare positive-control writes to
// `<tmpdir>/pf-test-data/<ISSUE-ID>`, so this suite gets its own root like
// every other suite that exercises prepare for real.
const isolated = fixtures.isolateTempRoot("pf-readonly-tc012-");

const { startServerFor } = require("./helpers/server");
const { SERVER_PATH, TOOL_DIR } = require("./helpers/server");
const { snapshotWorkingTree, snapshot, diffSnapshots, formatDiff, assertSameSnapshot } = require("./helpers/snapshot");
const { preparedWorkdir, preparedIssueRoot } = require("../lib/prepare");

test.after(() => {
  fixtures.cleanupAll();
  isolated.restore();
});

const GIT_LIB_PATH = path.join(TOOL_DIR, "lib", "git.js");

const FULL = "20260101-feat-fixture-full";
const ONBRANCH = "20260104-feat-fixture-onbranch";
const DECLARED = "20260109-feat-fixture-declared";

// ---------------------------------------------------------------------------
// Step 1 — the route inventory, read from the source
// ---------------------------------------------------------------------------

test("TC-012 step 1: server.js has exactly five non-GET route families, nowhere else", () => {
  const src = fs.readFileSync(SERVER_PATH, "utf8");

  const startMarker = "async function handleApi(";
  const startIdx = src.indexOf(startMarker);
  assert.notStrictEqual(startIdx, -1, "server.js no longer defines handleApi — this suite must be updated together with it");

  const endMarker = "\nfunction createServer(";
  const endIdx = src.indexOf(endMarker, startIdx);
  assert.notStrictEqual(endIdx, -1, "could not find the end of handleApi (createServer) — this suite must be updated together with it");

  const handleApiSrc = src.slice(startIdx, endIdx);

  // Nothing outside handleApi ever inspects req.method. serveStatic() and
  // serveLibModule() (reached for anything not under /api/) always just read
  // a file regardless of verb, so if a method check ever appears out there
  // it is either dead code or a brand-new dispatch path — either way this
  // suite wants to know.
  const totalMentions = (src.match(/req\.method/g) || []).length;
  const mentionsInsideHandleApi = (handleApiSrc.match(/req\.method/g) || []).length;
  assert.strictEqual(
    totalMentions,
    mentionsInsideHandleApi,
    "req.method is referenced outside handleApi — a route may be dispatching on method somewhere this suite doesn't scan"
  );

  // Every method check in handleApi has the shape `req.method === "X"`. If
  // this assertion ever fails on a count mismatch, a check using some other
  // form (`!==`, a variable, a list) has been introduced and is invisible to
  // the regex below — which would defeat the whole inventory.
  const strictForm = (handleApiSrc.match(/req\.method\s*===\s*"[A-Z]+"/g) || []).length;
  assert.strictEqual(
    mentionsInsideHandleApi,
    strictForm,
    "a req.method check uses a form other than `req.method === \"X\"` — the inventory below cannot see it"
  );

  const methods = [...handleApiSrc.matchAll(/req\.method\s*===\s*"([A-Z]+)"/g)].map((m) => m[1]);
  const nonGet = methods.filter((m) => m !== "GET");

  // The six route checks this tool is allowed to mutate anything through,
  // grouped into the five families the implementation plan and TC-012 name
  // (checklist marks/notes count as one family, two route checks). Matched
  // by the exact path-segment conditions they sit behind, not just by verb,
  // so a same-verb same-count route added under a different name still fails
  // an assertion below (its own regex simply won't be found, or the total
  // count of non-GET checks will exceed 6).
  const expectedRoutes = [
    {
      family: "checklist marks (PATCH .../checklist/steps)",
      re: /parts\[6\]\s*===\s*"steps"\s*&&\s*req\.method\s*===\s*"PATCH"/,
    },
    {
      family: "checklist notes (PATCH .../checklist/notes)",
      re: /parts\[6\]\s*===\s*"notes"\s*&&\s*req\.method\s*===\s*"PATCH"/,
    },
    {
      family: "branch checkout (POST .../checklist/checkout)",
      re: /parts\[6\]\s*===\s*"checkout"\s*&&\s*req\.method\s*===\s*"POST"/,
    },
    {
      family: "prepare a test case (POST .../issues/:id/prepare)",
      re: /parts\[5\]\s*===\s*"prepare"\s*&&\s*req\.method\s*===\s*"POST"/,
    },
    {
      family: "human-task completion (POST .../human-tasks/:key/complete)",
      re: /parts\[5\]\s*===\s*"human-tasks"\s*&&\s*parts\[7\]\s*===\s*"complete"\s*&&\s*req\.method\s*===\s*"POST"/,
    },
    {
      family: "human-task reassignment (POST .../human-tasks/:key/reassign)",
      re: /parts\[5\]\s*===\s*"human-tasks"\s*&&\s*parts\[7\]\s*===\s*"reassign"\s*&&\s*req\.method\s*===\s*"POST"/,
    },
  ];

  for (const route of expectedRoutes) {
    assert.ok(route.re.test(handleApiSrc), `expected mutating route not found in server.js: ${route.family}`);
  }

  assert.strictEqual(
    nonGet.length,
    expectedRoutes.length,
    `expected exactly ${expectedRoutes.length} non-GET route checks (five families: checklist marks/notes, ` +
      `branch checkout, prepare, human-task completion, human-task reassignment), found ${nonGet.length}: ` +
      `[${nonGet.join(", ")}]. A new one has appeared, or one of the expected ones changed verb.`
  );
  assert.deepStrictEqual(
    [...nonGet].sort(),
    ["PATCH", "PATCH", "POST", "POST", "POST", "POST"],
    `unexpected verb mix among the non-GET routes: [${nonGet.join(", ")}]`
  );
});

// ---------------------------------------------------------------------------
// Step 4 — git operations available to the server
// ---------------------------------------------------------------------------

test("TC-012 step 4: lib/git.js only ever runs read-only git commands, plus a plain checkout", () => {
  const src = fs.readFileSync(GIT_LIB_PATH, "utf8");

  const callRe = /tryGit\(cwd,\s*\[([^\]]*)\]\)/g;
  const calls = [...src.matchAll(callRe)].map((m) => m[1]);
  assert.ok(calls.length > 0, "no tryGit(cwd, [...]) call sites found — has lib/git.js been refactored?");

  // Every argument that is a string literal, per call — a variable like
  // `branch` is deliberately not captured: it is the destination that comes
  // from the server's own resolved issue, never a literal command word.
  const literalArgsPerCall = calls.map((argsStr) => [...argsStr.matchAll(/"([^"]*)"/g)].map((m) => m[1]));

  const subcommands = new Set(literalArgsPerCall.map((args) => args[0]));
  assert.deepStrictEqual(
    [...subcommands].sort(),
    ["checkout", "config", "diff", "ls-tree", "rev-list", "rev-parse", "show", "status"].sort(),
    `lib/git.js invokes a different set of git subcommands than expected: [${[...subcommands].sort().join(", ")}]`
  );

  const forbidden = ["commit", "push", "merge", "reset", "clean"];
  const flatLiteralArgs = literalArgsPerCall.flat();
  for (const bad of forbidden) {
    assert.ok(
      !flatLiteralArgs.includes(bad),
      `forbidden git subcommand "${bad}" found among lib/git.js's own call arguments`
    );
  }

  // The one call whose first argument is "checkout": exactly one branch
  // argument, nothing that looks like a force flag.
  const checkoutCalls = literalArgsPerCall.filter((args) => args[0] === "checkout");
  assert.strictEqual(checkoutCalls.length, 1, "expected exactly one `checkout` call site in lib/git.js");
  for (const flag of ["-f", "--force", "-B"]) {
    assert.ok(!checkoutCalls[0].includes(flag), `checkout call carries a forbidden flag: ${flag}`);
  }

  // server.js must call checkoutBranch exactly once, and only with the
  // resolved issue's own branch — never with a client-supplied value.
  const serverSrc = fs.readFileSync(SERVER_PATH, "utf8");
  const checkoutCallSites = [...serverSrc.matchAll(/git\.checkoutBranch\(/g)];
  assert.strictEqual(checkoutCallSites.length, 1, "expected exactly one call to git.checkoutBranch in server.js");
  assert.ok(
    /git\.checkoutBranch\(projectRoot,\s*entry\.branch\)/.test(serverSrc),
    "git.checkoutBranch must be called with the resolved issue's own branch (entry.branch), not a request-supplied value"
  );
});

// ---------------------------------------------------------------------------
// Steps 2, 3, 5 — negative: nothing writes a pipeline document
// ---------------------------------------------------------------------------

function buildDocInventory(repo, memRoot) {
  const projectDocs = [
    "PLANNING.md",
    "CLAUDE.md",
    ".qa-workflow.md",
    "docs/planning/decisions.md",
    "docs/planning/session-log.md",
    "docs/planning/implementation-plan.md",
  ];
  const issueDocs = [
    "prompt.md",
    "brd.md",
    "analysis.md",
    "notes.md",
    "specs.md",
    "implementation_plan.md",
    "test_plan.md",
    "manual_test_checklist.md",
    "qa_report.md",
  ];
  const memoryFiles = ["notes.md", "decisions.md"];

  return {
    project: projectDocs.map((rel) => ({
      kind: "project",
      rel,
      url: (p) => `/api/projects/main/docs?path=${encodeURIComponent(rel)}`,
    })),
    issue: issueDocs.map((rel) => ({
      kind: "issue",
      rel,
      url: (p) => `/api/projects/main/issues/${FULL}/docs?path=${encodeURIComponent(rel)}`,
    })),
    memory: memoryFiles.map((rel) => ({
      kind: "memory",
      rel,
      url: (p) => `/api/projects/main/memory/file?path=${encodeURIComponent(rel)}`,
    })),
  };
}

test("TC-012 steps 2-3, 5: no existing route can write a pipeline document, and the whole tree proves it", async (t) => {
  const repo = fixtures.makeTempRepo({ issues: [FULL], name: "readonly-negative" });
  const memRoot = fixtures.makeMemoryRoot();
  memRoot.addProject({ projectPath: repo.root });
  const config = fixtures.makeConfig({ projects: [{ name: "main", path: repo.root, defaultBranch: repo.defaultBranch }] });
  const server = await startServerFor(t, {
    configPath: config.configPath,
    env: { PLANNING_TEST_UI_MEMORY_ROOT: memRoot.root },
  });

  const repoBefore = snapshotWorkingTree(repo.root);
  const memBefore = snapshot(memRoot.root);

  const inventory = buildDocInventory(repo, memRoot);
  const allTargets = [...inventory.project, ...inventory.issue, ...inventory.memory];

  // --- attack A: hit each document's own (GET-only) endpoint with every
  // other verb. None of them has a non-GET branch at all, so every one of
  // these must fall through to the generic 404.
  for (const target of allTargets) {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      const res = await server.request({ method, path: target.url(), body: { evil: true, content: "PWNED" } });
      assert.ok(
        [403, 404, 405].includes(res.status),
        `${method} ${target.url()} (${target.kind} doc ${target.rel}) should be refused with 403/404/405, got ${res.status}: ${res.text}`
      );
    }
  }

  // --- attack B: use the four *real* mutating routes that can never touch a
  // pipeline document by construction, but aim their bodies at the pipeline
  // documents by name anyway. Structurally these routes never read a path
  // from the request (checklist writes always target the resolved issue's
  // own manual_test_checklist.md, checkout's branch is server-resolved,
  // prepare's script location is assembled from validated ids) — this proves
  // that holds by trying anyway. Human-task reassignment is deliberately
  // NOT exercised here: it is the one route that legitimately writes a
  // pipeline document (its own issue's prompt.md) by design (AC-05g) — a
  // successful call would correctly fail this test's whole-tree
  // `assertSameSnapshot` below, so its scoping (prompt.md + session-log.md,
  // nothing else) gets its own dedicated positive-control check instead
  // (TC-012 step 6e, further down).
  const base = `/api/projects/main/issues/${FULL}/checklist`;
  for (const evilId of ["brd.md", "PLANNING.md", "../../../etc/passwd", "../brd.md"]) {
    const stepsRes = await server.patch(`${base}/steps`, { tcId: evilId, step: 1, checked: true, note: "PWNED" });
    assert.ok(stepsRes.status >= 400, `PATCH steps with tcId=${JSON.stringify(evilId)} should be refused, got ${stepsRes.status}`);

    const notesRes = await server.patch(`${base}/notes`, { tcId: evilId, notesText: "PWNED" });
    assert.ok(notesRes.status >= 400, `PATCH notes with tcId=${JSON.stringify(evilId)} should be refused, got ${notesRes.status}`);
  }

  // Checkout: FULL is already checked out ("here"), so this is a no-op
  // regardless of body — but it must stay a no-op even with a hostile body.
  const checkoutRes = await server.post(`${base}/checkout`, { branch: "main", force: true });
  assert.strictEqual(checkoutRes.status, 200);
  assert.strictEqual(checkoutRes.json.alreadyCheckedOut, true);

  // Prepare: FULL declares no test-data/setup.mjs, and a path-shaped tcId is
  // not a valid test case id in the first place.
  for (const evilTcId of ["../../../etc/passwd", "brd.md", "TC-999"]) {
    const prepareRes = await server.post(
      `/api/projects/main/issues/${FULL}/prepare`,
      { confirm: true, tcId: evilTcId }
    );
    assert.ok(prepareRes.status >= 400, `POST prepare with tcId=${JSON.stringify(evilTcId)} should be refused, got ${prepareRes.status}`);
  }

  // --- the whole tree, and the whole memory root, must be byte-for-byte
  // where they started. This is the assertion that actually matters: it
  // does not depend on every attack above being enumerated correctly, only
  // on nothing having moved.
  assertSameSnapshot(repoBefore, snapshotWorkingTree(repo.root), "repository tree changed after read-only attempts");
  assertSameSnapshot(memBefore, snapshot(memRoot.root), "memory root changed after read-only attempts");
});

test("TC-012: each mutating action requires either an explicit body or (for checkout) a precondition it cannot fake", async (t) => {
  const repo = fixtures.makeTempRepo({ issues: [FULL, ONBRANCH], name: "readonly-gating" });
  const config = fixtures.makeConfig({ projects: [{ name: "main", path: repo.root, defaultBranch: repo.defaultBranch }] });
  const server = await startServerFor(t, { configPath: config.configPath });

  const base = `/api/projects/main/issues/${FULL}/checklist`;

  // steps: tcId (string) and step (number) are mandatory.
  const stepsNoBody = await server.patch(`${base}/steps`, {});
  assert.strictEqual(stepsNoBody.status, 400, `PATCH steps with an empty body should be refused, got ${stepsNoBody.status}`);
  const stepsNoStep = await server.patch(`${base}/steps`, { tcId: "TC-001" });
  assert.strictEqual(stepsNoStep.status, 400, `PATCH steps without "step" should be refused, got ${stepsNoStep.status}`);

  // notes: tcId (string) is mandatory.
  const notesNoBody = await server.patch(`${base}/notes`, {});
  assert.strictEqual(notesNoBody.status, 400, `PATCH notes with an empty body should be refused, got ${notesNoBody.status}`);

  // prepare: explicit {confirm: true} is mandatory, checked before anything
  // else is looked up or started.
  const prepareNoConfirm = await server.post(`/api/projects/main/issues/${FULL}/prepare`, {});
  assert.strictEqual(prepareNoConfirm.status, 400, `POST prepare without confirm should be refused, got ${prepareNoConfirm.status}`);
  assert.strictEqual(prepareNoConfirm.json.error, "confirmation_required");
  const prepareFalseConfirm = await server.post(`/api/projects/main/issues/${FULL}/prepare`, { confirm: false });
  assert.strictEqual(prepareFalseConfirm.status, 400, `POST prepare with confirm:false should be refused, got ${prepareFalseConfirm.status}`);

  // checkout: pinned reference behaviour — the server takes no body at all
  // for this route (see public/app.js requestCheckout, which sends none);
  // the browser's confirm() dialog is the only gate on the client, and on
  // the server the only gate is the precondition that the issue's own
  // checklist actually lives on an un-checked-out branch with a clean tree.
  // A request cannot supply or fake that state, so "no body required" does
  // not make the route unsafe to call.
  const checkoutRes = await server.post(`/api/projects/main/issues/${ONBRANCH}/checklist/checkout`, undefined);
  assert.strictEqual(checkoutRes.status, 200, `checkout without a body should still succeed, got ${checkoutRes.status}`);
});

// ---------------------------------------------------------------------------
// Step 6 — positive control: the three permitted actions, each scoped
// ---------------------------------------------------------------------------

test("TC-012 step 6a: checklist marks and notes change only manual_test_checklist.md", async (t) => {
  const repo = fixtures.makeTempRepo({ issues: [FULL], name: "readonly-positive-checklist" });
  const config = fixtures.makeConfig({ projects: [{ name: "main", path: repo.root, defaultBranch: repo.defaultBranch }] });
  const server = await startServerFor(t, { configPath: config.configPath });

  const before = snapshotWorkingTree(repo.root);
  const base = `/api/projects/main/issues/${FULL}/checklist`;

  const stepsRes = await server.patch(`${base}/steps`, { tcId: "TC-001", step: 1, checked: true, note: "ok" });
  assert.strictEqual(stepsRes.status, 200, `PATCH steps failed: ${stepsRes.text}`);

  const notesRes = await server.patch(`${base}/notes`, { tcId: "TC-002", notesText: "noted" });
  assert.strictEqual(notesRes.status, 200, `PATCH notes failed: ${notesRes.text}`);

  const after = snapshotWorkingTree(repo.root);
  const diff = diffSnapshots(before, after);
  assert.deepStrictEqual(diff.added, [], `unexpected new files: ${formatDiff(diff)}`);
  assert.deepStrictEqual(diff.removed, [], `unexpected deletions: ${formatDiff(diff)}`);
  assert.deepStrictEqual(
    diff.changed,
    [`docs/issues/open/${FULL}/manual_test_checklist.md`],
    `expected only the checklist to change: ${formatDiff(diff)}`
  );
});

test("TC-012 step 6b: checkout on confirmation only ever brings in that issue's own branch content", async (t) => {
  const repo = fixtures.makeTempRepo({ issues: [ONBRANCH], name: "readonly-positive-checkout" });
  const config = fixtures.makeConfig({ projects: [{ name: "main", path: repo.root, defaultBranch: repo.defaultBranch }] });
  const server = await startServerFor(t, { configPath: config.configPath });

  assert.strictEqual(repo.currentBranch(), repo.defaultBranch, "precondition: still on the default branch");
  const before = snapshotWorkingTree(repo.root);

  // The client never sends a body for this route (see public/app.js
  // requestCheckout — confirmation is the browser's confirm() dialog); an
  // empty POST must be enough, and it must be exactly this issue's branch.
  const res = await server.post(`/api/projects/main/issues/${ONBRANCH}/checklist/checkout`, undefined);
  assert.strictEqual(res.status, 200, `checkout failed: ${res.text}`);
  assert.strictEqual(res.json.branch, `issue/${ONBRANCH}`);

  assert.strictEqual(repo.currentBranch(), `issue/${ONBRANCH}`, "the working tree must now be on the issue's branch");

  const after = snapshotWorkingTree(repo.root);
  const diff = diffSnapshots(before, after);
  assert.deepStrictEqual(diff.removed, [], `checkout must not delete anything: ${formatDiff(diff)}`);
  assert.deepStrictEqual(diff.changed, [], `checkout must not rewrite existing files: ${formatDiff(diff)}`);
  assert.deepStrictEqual(
    [...diff.added].sort(),
    [`docs/issues/open/${ONBRANCH}/brd.md`, `docs/issues/open/${ONBRANCH}/manual_test_checklist.md`].sort(),
    `expected only this issue's own branch-only documents to appear: ${formatDiff(diff)}`
  );
});

test("TC-012 step 6c: preparing a test case never touches the repository at all", async (t) => {
  const repo = fixtures.makeTempRepo({ issues: [DECLARED], name: "readonly-positive-prepare" });
  const config = fixtures.makeConfig({ projects: [{ name: "main", path: repo.root, defaultBranch: repo.defaultBranch }] });
  const server = await startServerFor(t, {
    configPath: config.configPath,
    env: { PLANNING_TEST_UI_PREPARE_TIMEOUT_MS: "5000" },
  });

  fs.rmSync(preparedIssueRoot(DECLARED), { recursive: true, force: true });
  t.after(() => fs.rmSync(preparedIssueRoot(DECLARED), { recursive: true, force: true }));

  const before = snapshotWorkingTree(repo.root);

  const res = await server.post(`/api/projects/main/issues/${DECLARED}/prepare`, { confirm: true, tcId: "TC-001" });
  assert.strictEqual(res.status, 200, `prepare failed: ${res.text}`);
  assert.strictEqual(res.json.ok, true);

  // It really did run — just not anywhere inside the repository.
  const workdir = preparedWorkdir(DECLARED, "TC-001");
  assert.ok(fs.existsSync(path.join(workdir, "case-a", "input.txt")), "expected prepared data outside the repo");

  assertSameSnapshot(before, snapshotWorkingTree(repo.root), "the repository changed after a prepare run");
});

// The agents.yml every fixture below needs to resolve "human" and "claude" as
// known actors — the same shape human-task-complete.test.js and
// human-tasks.test.js already use.
const HUMAN_TASK_AGENTS_YML = ["actors:", "  human: { kind: human }", ""].join("\n");

test("TC-012 step 6d: completing a human task (write/doc path) changes only session-log.md", async (t) => {
  const issueId = "20260115-feat-fixture-complete";
  const brdContent = "# BRD — complete fixture\n\nReal body beyond the heading, not a stub.\n";
  const promptMd = [
    "---",
    "doc_language: English",
    "size_tier: medium",
    "roles:",
    "  brd: { write: human }",
    "---",
    "",
    `# ${issueId}`,
    "",
    "Type: feat. Fixture for TC-012 step 6d.",
    "",
  ].join("\n");

  const repo = fixtures.makeTempRepo({
    name: "readonly-positive-complete",
    issues: [],
    extraFiles: {
      [`docs/issues/open/${issueId}/prompt.md`]: promptMd,
      [`docs/issues/open/${issueId}/brd.md`]: brdContent,
      "docs/planning/agents.yml": HUMAN_TASK_AGENTS_YML,
    },
  });
  const config = fixtures.makeConfig({ projects: [{ name: "main", path: repo.root, defaultBranch: repo.defaultBranch }] });
  const server = await startServerFor(t, { configPath: config.configPath });

  // brd.md is already committed by makeTempRepo's initial commit, so the
  // route's own write (an append-only session-log.md marker — it never
  // rewrites the artifact, only reads and hashes it) is the only thing this
  // snapshot window can see.
  const before = snapshotWorkingTree(repo.root);

  const res = await server.post(`/api/projects/main/issues/${issueId}/human-tasks/brd/complete`, {});
  assert.strictEqual(res.status, 200, `complete failed: ${res.text}`);
  assert.strictEqual(res.json.status, "done");

  const after = snapshotWorkingTree(repo.root);
  const diff = diffSnapshots(before, after);
  assert.deepStrictEqual(diff.removed, [], `complete must not delete anything: ${formatDiff(diff)}`);
  assert.deepStrictEqual(diff.changed, [], `complete must not rewrite existing files: ${formatDiff(diff)}`);
  assert.deepStrictEqual(
    diff.added,
    [`docs/issues/open/${issueId}/session-log.md`],
    `expected only session-log.md to appear: ${formatDiff(diff)}`
  );
});

test("TC-012 step 6e: reassigning a human task's write actor changes only prompt.md (write: substring) and session-log.md", async (t) => {
  const issueId = "20260116-feat-fixture-reassign";
  const promptMd = [
    "---",
    "doc_language: English",
    "size_tier: medium",
    "roles:",
    "  specs: { write: human, review: [claude] }",
    "---",
    "",
    `# ${issueId}`,
    "",
    "Type: feat. Fixture for TC-012 step 6e.",
    "",
  ].join("\n");

  const repo = fixtures.makeTempRepo({
    name: "readonly-positive-reassign",
    issues: [],
    extraFiles: {
      [`docs/issues/open/${issueId}/prompt.md`]: promptMd,
      "docs/planning/agents.yml": HUMAN_TASK_AGENTS_YML,
    },
  });
  const config = fixtures.makeConfig({ projects: [{ name: "main", path: repo.root, defaultBranch: repo.defaultBranch }] });
  const server = await startServerFor(t, { configPath: config.configPath });

  const promptAbs = path.join(repo.root, "docs", "issues", "open", issueId, "prompt.md");
  const promptBefore = fs.readFileSync(promptAbs, "utf8");
  const before = snapshotWorkingTree(repo.root);

  const res = await server.post(`/api/projects/main/issues/${issueId}/human-tasks/specs/reassign`, { actor: "claude" });
  assert.strictEqual(res.status, 200, `reassign failed: ${res.text}`);
  assert.deepStrictEqual(res.json, { status: "reassigned", actor: "claude" });

  // The point-edit changes exactly the write: substring — everything else on
  // the line, and the rest of the file, is byte-identical.
  assert.strictEqual(
    fs.readFileSync(promptAbs, "utf8"),
    promptBefore.replace("write: human", "write: claude"),
    "reassign must change only the write: substring of roles.specs"
  );

  const after = snapshotWorkingTree(repo.root);
  const diff = diffSnapshots(before, after);
  assert.deepStrictEqual(diff.removed, [], `reassign must not delete anything: ${formatDiff(diff)}`);
  assert.deepStrictEqual(
    diff.changed,
    [`docs/issues/open/${issueId}/prompt.md`],
    `expected only prompt.md to change: ${formatDiff(diff)}`
  );
  assert.deepStrictEqual(
    diff.added,
    [`docs/issues/open/${issueId}/session-log.md`],
    `expected only session-log.md to appear: ${formatDiff(diff)}`
  );
});

// ---------------------------------------------------------------------------
// Client-side note — no actor-picker wizard outside the one hand-off action
// ---------------------------------------------------------------------------

test("TC-012 note: public/*.js carries no actor-picker wizard outside the single hand-off action (AC-05j)", () => {
  const publicDir = path.join(TOOL_DIR, "public");
  const files = fs.readdirSync(publicDir).filter((f) => f.endsWith(".js"));
  assert.ok(files.length > 0, "no public/*.js files found — has the client moved?");

  // Reassignment stays a manual prompt.md edit everywhere except the single
  // "hand off to agent" action (AC-05j) — the client is never supposed to
  // offer a general-purpose actor-selection wizard standing in for it. The
  // human-tasks/reassign UI itself (Tasks 15/23/24) doesn't exist yet when
  // this check is written, so today it can only confirm the absence holds;
  // it stays in place so a future actor-picker is caught if it isn't scoped
  // to that one action.
  const wizardRe = /actor[-\s]?picker|pick[-\s]?an?[-\s]?actor|select[-\s]?an?[-\s]?actor|choose[-\s]?an?[-\s]?actor/i;
  const handOffRe = /hand[-\s]?off/i;

  for (const file of files) {
    const src = fs.readFileSync(path.join(publicDir, file), "utf8");
    const wizardMatch = wizardRe.exec(src);
    if (!wizardMatch) continue;
    assert.ok(
      handOffRe.test(src),
      `${file} appears to contain an actor-picker wizard ("${wizardMatch[0]}") outside the single hand-off action (AC-05j) it is supposed to be scoped to`
    );
  }
});
