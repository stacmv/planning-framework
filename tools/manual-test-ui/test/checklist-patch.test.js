"use strict";

// TC-013 — regression: writing into a manual test checklist stays surgical.
//
// This is the most fragile piece of existing behaviour in the tool.
// `patchStepResult` does not edit a cell in place: it splits the row it is
// patching, replaces one cell and re-joins the whole row, then re-joins the
// whole *file* with a single detected line ending. So every write is one
// chance to quietly reformat a document a human is in the middle of filling
// in. The point of this suite is that the blast radius is exactly one line —
// and that the two places where it is knowingly larger stay knowingly larger
// rather than drifting:
//
//   * the patched row loses whatever column padding it had, because it is
//     rebuilt as `| a | b | c |`;
//   * `detectEol` declares CRLF for the *entire file* as soon as it finds one
//     "\r\n" anywhere, so a mixed-ending file comes back all-CRLF.
//
// Both are pinned below as reference behaviour. They are not defects to be
// fixed here: the checklist format's own tooling has always behaved this way,
// and a change would show up as a diff in someone's half-filled checklist.
//
// Run: node --test tools/manual-test-ui/test/checklist-patch.test.js

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { patchStepResult, patchNotes, parseChecklist } = require("../lib/checklist");
const fixtures = require("./helpers/fixtures");
const { startServerFor } = require("./helpers/server");
const { snapshotWorkingTree, diffSnapshots, formatDiff } = require("./helpers/snapshot");

const TOOL_DIR = path.resolve(__dirname, "..");
const ISSUE_ID = "20260101-feat-fixture-full";

// ---------------------------------------------------------------------------
// Byte-level line comparison
// ---------------------------------------------------------------------------

// Splits on the same pattern lib/checklist.js uses, so indices here are the
// parser's line indices — but keeps each line's terminator, which the parser
// discards. "Every other line is unchanged" has to mean the endings too:
// step 6 exists precisely because a patch can rewrite a line ending without
// touching a single visible character.
function splitLinesWithEol(text) {
  const out = [];
  const re = /\r\n|\n/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({ text: text.slice(last, m.index), eol: m[0] });
    last = re.lastIndex;
  }
  out.push({ text: text.slice(last), eol: "" });
  return out;
}

// Indices of every line that differs in text or in terminator.
function changedLineIndices(before, after) {
  const a = splitLinesWithEol(before);
  const b = splitLinesWithEol(after);
  assert.strictEqual(b.length, a.length, `line count changed: ${a.length} -> ${b.length}`);
  const changed = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i].text !== b[i].text || a[i].eol !== b[i].eol) changed.push(i);
  }
  return changed;
}

function lineAt(text, index) {
  return splitLinesWithEol(text)[index];
}

function describeChanges(before, after, indices) {
  const a = splitLinesWithEol(before);
  const b = splitLinesWithEol(after);
  return indices
    .map((i) => `  [${i}] ${JSON.stringify(a[i].text + a[i].eol)} -> ${JSON.stringify(b[i].text + b[i].eol)}`)
    .join("\n");
}

function assertOnlyLineChanged(before, after, index, message) {
  const changed = changedLineIndices(before, after);
  assert.deepStrictEqual(
    changed,
    [index],
    `${message}: expected only line ${index} to change, got [${changed.join(", ")}]\n` +
      describeChanges(before, after, changed)
  );
}

function findLineIndex(text, predicate) {
  const lines = splitLinesWithEol(text);
  const idx = lines.findIndex((l) => predicate(l.text));
  assert.notStrictEqual(idx, -1, "expected line not found in the fixture");
  return idx;
}

// ---------------------------------------------------------------------------
// Step 1 — the existing suite still passes, unmodified
// ---------------------------------------------------------------------------

test("TC-013 step 1: the existing checklist-ru.test.js passes unmodified", () => {
  const target = path.join(__dirname, "checklist-ru.test.js");

  // Run it the way its own header documents...
  const direct = spawnSync(process.execPath, [target], { cwd: TOOL_DIR, encoding: "utf8" });
  assert.strictEqual(direct.status, 0, `node checklist-ru.test.js failed:\n${direct.stdout}\n${direct.stderr}`);
  assert.match(direct.stdout, /^OK: checklist-ru\.test\.js/m, "expected the RU regression to report success");

  // ...and the way `make test` runs it, since that is the contract that
  // actually gates a commit.
  const viaRunner = spawnSync(process.execPath, ["--test", target], { cwd: TOOL_DIR, encoding: "utf8" });
  assert.strictEqual(
    viaRunner.status,
    0,
    `node --test checklist-ru.test.js failed:\n${viaRunner.stdout}\n${viaRunner.stderr}`
  );
});

// ---------------------------------------------------------------------------
// Steps 2-4 — the real HTTP write path
// ---------------------------------------------------------------------------

// Driven through the server rather than by calling lib/checklist.js
// directly: the surgical-write promise is made to whoever clicks a checkbox
// in the UI, and it covers the read-patch-write round trip, not just the
// pure function in the middle of it.
test("TC-013 steps 2-4: writing through the server touches one line and nothing else", async (t) => {
  t.after(() => fixtures.cleanupAll());

  const repo = fixtures.makeTempRepo({ issues: [ISSUE_ID], name: "patch" });
  const config = fixtures.makeConfig({ projects: [{ name: "main", path: repo.root, defaultBranch: "develop" }] });
  const server = await startServerFor(t, { configPath: config.configPath });

  const checklistPath = repo.checklistPath(ISSUE_ID);
  const base = `/api/projects/main/issues/${ISSUE_ID}/checklist`;
  const read = () => fs.readFileSync(checklistPath, "utf8");

  await t.test("step 2: checking one step rewrites only that row", async () => {
    const before = read();
    const treeBefore = snapshotWorkingTree(repo.root);
    const rowIndex = findLineIndex(before, (l) => l.startsWith("| 2 | Fixture action 2 of TC-002 |"));

    const res = await server.patch(`${base}/steps`, { tcId: "TC-002", step: 2, checked: true, note: "проверено" });
    assert.strictEqual(res.status, 200, `PATCH steps failed: ${res.text}`);

    const after = read();
    assertOnlyLineChanged(before, after, rowIndex, "step 2");
    assert.strictEqual(
      lineAt(after, rowIndex).text,
      "| 2 | Fixture action 2 of TC-002 | Fixture expectation 2 | [x] проверено |",
      "the patched row must differ from the original in its Result cell only"
    );

    // And nothing outside the checklist file moved: no stray lock file, no
    // backup copy, no touched sibling document.
    const treeDiff = diffSnapshots(treeBefore, snapshotWorkingTree(repo.root));
    assert.deepStrictEqual(treeDiff.added, [], `unexpected new files: ${formatDiff(treeDiff)}`);
    assert.deepStrictEqual(treeDiff.removed, [], `unexpected deletions: ${formatDiff(treeDiff)}`);
    assert.deepStrictEqual(
      treeDiff.changed,
      [`docs/issues/open/${ISSUE_ID}/manual_test_checklist.md`],
      `only the checklist should have changed: ${formatDiff(treeDiff)}`
    );
  });

  await t.test("step 3: writing a note rewrites only the **Notes:** line of that TC", async () => {
    const before = read();
    // Two TCs, so two "**Notes:**" lines — the one that must change is the
    // one inside TC-001. If patchNotes ever picked the wrong section this
    // assertion is what catches it.
    const notesIndices = splitLinesWithEol(before)
      .map((l, i) => (l.text.startsWith("**Notes:**") ? i : -1))
      .filter((i) => i !== -1);
    assert.strictEqual(notesIndices.length, 2, "fixture should have one **Notes:** line per TC");

    const res = await server.patch(`${base}/notes`, { tcId: "TC-001", notesText: "прошло на второй попытке" });
    assert.strictEqual(res.status, 200, `PATCH notes failed: ${res.text}`);

    const after = read();
    assertOnlyLineChanged(before, after, notesIndices[0], "step 3");
    assert.strictEqual(lineAt(after, notesIndices[0]).text, "**Notes:** прошло на второй попытке");
  });

  await t.test("step 4: a pipe in a note becomes a slash and the table stays intact", async () => {
    const before = read();
    const rowIndex = findLineIndex(before, (l) => l.startsWith("| 1 | Fixture action 1 of TC-001 |"));
    const columnsBefore = before.split(/\r\n|\n/)[rowIndex].split("|").length;

    const res = await server.patch(`${base}/steps`, {
      tcId: "TC-001",
      step: 1,
      checked: false,
      note: "падает на a | b и на c|d",
    });
    assert.strictEqual(res.status, 200, `PATCH steps failed: ${res.text}`);

    const after = read();
    assertOnlyLineChanged(before, after, rowIndex, "step 4");
    const row = lineAt(after, rowIndex).text;
    assert.strictEqual(row, "| 1 | Fixture action 1 of TC-001 | Fixture expectation 1 | [ ] падает на a / b и на c/d |");
    assert.strictEqual(
      row.split("|").length,
      columnsBefore,
      "the row must still have exactly as many pipes as before — a leaked '|' would split the cell"
    );

    // The parser has to agree, or the UI would render a shifted table.
    const tc = parseChecklist(after).tcs.find((t2) => t2.id === "TC-001");
    assert.strictEqual(tc.steps.length, 3, "TC-001 must still parse as three steps");
    assert.strictEqual(tc.steps[0].note, "падает на a / b и на c/d");
    assert.deepStrictEqual(tc.parseWarnings, [], "the patched table must parse without warnings");
  });
});

// ---------------------------------------------------------------------------
// Steps 5-6 — line endings
// ---------------------------------------------------------------------------

test("TC-013 steps 5-6: line endings", async (t) => {
  t.after(() => fixtures.cleanupAll());

  const repo = fixtures.makeTempRepo({ issues: [ISSUE_ID], name: "eol" });
  const config = fixtures.makeConfig({ projects: [{ name: "main", path: repo.root, defaultBranch: "develop" }] });
  const server = await startServerFor(t, { configPath: config.configPath });

  const checklistPath = repo.checklistPath(ISSUE_ID);
  const base = `/api/projects/main/issues/${ISSUE_ID}/checklist`;
  const read = () => fs.readFileSync(checklistPath, "utf8");

  await t.test("step 5: an all-CRLF checklist is written back as all-CRLF", async () => {
    const { content: before } = fixtures.installChecklistFixture(repo, ISSUE_ID, "checklist-crlf");
    const rowIndex = findLineIndex(before, (l) => l.startsWith("| 2 | Check the first step |"));

    const res = await server.patch(`${base}/steps`, { tcId: "TC-001", step: 2, checked: true, note: "done" });
    assert.strictEqual(res.status, 200, `PATCH steps failed: ${res.text}`);

    const after = read();
    assertOnlyLineChanged(before, after, rowIndex, "step 5");
    assert.strictEqual(lineAt(after, rowIndex).text, "| 2 | Check the first step | The box is checked | [x] done |");
    assert.ok(!/(^|[^\r])\n/.test(after), "the file must not have been rewritten to LF anywhere");
    assert.strictEqual(parseChecklist(after).eol, "\r\n");
  });

  await t.test("step 6: a mixed-ending checklist comes back all-CRLF (detectEol reference behaviour)", async () => {
    const { content: before } = fixtures.installChecklistFixture(repo, ISSUE_ID, "checklist-mixed-eol");
    const beforeLines = splitLinesWithEol(before);
    assert.strictEqual(beforeLines[0].eol, "\n", "fixture precondition: the first line ends with a bare LF");
    assert.strictEqual(beforeLines[1].eol, "\r\n", "fixture precondition: the rest of the file is CRLF");

    const rowIndex = findLineIndex(before, (l) => l.startsWith("| 3 | Reload the page |"));
    // note is non-empty: a checked:true PATCH with an empty note is now
    // rejected with 422 (empty_result) before any write happens, which
    // would defeat this step's whole point (asserting what a *successful*
    // write does to line endings). The EOL behaviour under test doesn't
    // depend on the note's content.
    const res = await server.patch(`${base}/steps`, { tcId: "TC-001", step: 3, checked: true, note: "ok" });
    assert.strictEqual(res.status, 200, `PATCH steps failed: ${res.text}`);

    const after = read();

    // Two lines change, not one — and the second one is the point of this
    // step. detectEol scans for the first "\r\n" in the file and then
    // declares that ending for the whole document, so re-joining converts
    // the lone LF on line 0. Expected, pinned, not a defect: normalising a
    // file that was already inconsistent is the lesser evil, and the
    // alternative (per-line endings) has never been implemented.
    const changed = changedLineIndices(before, after);
    assert.deepStrictEqual(
      changed,
      [0, rowIndex],
      `expected the patched row plus the normalised first line ending, got [${changed.join(", ")}]\n` +
        describeChanges(before, after, changed)
    );
    assert.strictEqual(lineAt(after, 0).text, beforeLines[0].text, "line 0's text must be untouched");
    assert.strictEqual(lineAt(after, 0).eol, "\r\n", "line 0's ending is normalised to CRLF");
    assert.ok(!/(^|[^\r])\n/.test(after), "after the patch the whole file is CRLF");
    assert.strictEqual(lineAt(after, rowIndex).text, "| 3 | Reload the page | The state survives the reload | [x] ok |");
  });
});

// ---------------------------------------------------------------------------
// Step 7 — content the parser does not understand
// ---------------------------------------------------------------------------

test("TC-013 step 7: sections the parser does not understand survive a patch", async (t) => {
  t.after(() => fixtures.cleanupAll());

  const repo = fixtures.makeTempRepo({ issues: [ISSUE_ID], name: "unknown" });
  const config = fixtures.makeConfig({ projects: [{ name: "main", path: repo.root, defaultBranch: "develop" }] });
  const server = await startServerFor(t, { configPath: config.configPath });

  const { content: before } = fixtures.installChecklistFixture(repo, ISSUE_ID, "checklist-unknown-sections");

  // Precondition worth asserting: the parser really does ignore this
  // content. If a future change taught it to parse the stray table, the
  // fixture would stop testing what it claims to test.
  const parsedBefore = parseChecklist(before);
  assert.strictEqual(parsedBefore.tcs.length, 2, "fixture has two TCs");
  assert.strictEqual(parsedBefore.tcs[0].steps.length, 2, "TC-001 has two steps, not the stray table's rows");
  assert.strictEqual(parsedBefore.tcs[1].steps.length, 1, "TC-002 has one step");

  const rowIndex = findLineIndex(before, (l) => l.startsWith("| 2 | Do the second thing |"));
  const res = await server.patch(`/api/projects/main/issues/${ISSUE_ID}/checklist/steps`, {
    tcId: "TC-001",
    step: 2,
    checked: true,
    note: "ok",
  });
  assert.strictEqual(res.status, 200, `PATCH steps failed: ${res.text}`);

  const after = fs.readFileSync(repo.checklistPath(ISSUE_ID), "utf8");
  assertOnlyLineChanged(before, after, rowIndex, "step 7");

  // Spelled out as well as counted: the prose keeps its irregular internal
  // spacing and the foreign table keeps every one of its rows.
  for (const literal of [
    "Свободная проза между тест-кейсами. Парсер её не разбирает и не",
    "изменённого байта, включая это выравнивание   и   двойные  пробелы.",
    "| Параметр | Значение |",
    "| timeout | 30s |",
    "| retries | 3 |",
  ]) {
    assert.ok(after.includes(literal), `unknown content was altered — missing: ${literal}`);
  }
});

// ---------------------------------------------------------------------------
// Pinned reference behaviour
// ---------------------------------------------------------------------------

test("TC-013 reference: the patched row loses its column padding, other rows keep theirs", () => {
  // An aligned table is what a human writing markdown by hand produces, and
  // it is what `patchStepResult` cannot preserve: the row is rebuilt from
  // trimmed cells as `| a | b | c |`. Recorded here so the loss is a known,
  // asserted property rather than a surprise in someone's diff — and so the
  // rest of the test plan knows to write its fixtures single-spaced.
  const aligned = [
    "# Manual Test Checklist",
    "",
    "## TC-001: Aligned table",
    "",
    "**Steps:**",
    "",
    "| Step | Action        | Expected Result | Result |",
    "|------|---------------|-----------------|--------|",
    "| 1    | Do the thing  | It happens      | [ ]    |",
    "| 2    | Do it again   | It happens too  | [ ]    |",
    "",
    "**Notes:**",
    "",
  ].join("\n");

  const after = patchStepResult(aligned, "TC-001", 1, { checked: true, note: "" });
  const changed = changedLineIndices(aligned, after);
  assert.deepStrictEqual(changed, [8], "only the patched row is rebuilt");
  assert.strictEqual(lineAt(after, 8).text, "| 1 | Do the thing | It happens | [x] |", "padding is not preserved");
  assert.strictEqual(lineAt(after, 9).text, "| 2    | Do it again   | It happens too  | [ ]    |", "row 2 keeps its padding");
});

test("TC-013 reference: patchNotes normalises a localized label to **Notes:**", () => {
  // pf-test writes the checklist in the issue's doc_language, so a Russian
  // checklist carries "**Заметки:**". The parser reads both labels, but
  // patchNotes only ever writes the English one. That rewrites the label
  // itself — still a single line, still the right line, but worth pinning:
  // a reader seeing the label flip should find it documented here rather
  // than assume the file was corrupted.
  const before = fixtures.readChecklistFixture("checklist-mixed-lang");
  const notesIndex = findLineIndex(before, (l) => l === "**Заметки:**");

  const after = patchNotes(before, "TC-002", "заметка тестировщика");
  assertOnlyLineChanged(before, after, notesIndex, "localized notes label");
  assert.strictEqual(lineAt(after, notesIndex).text, "**Notes:** заметка тестировщика");
});

test("TC-013 reference: a Russian Result column is patched like an English one", () => {
  const before = fixtures.readChecklistFixture("checklist-mixed-lang");
  const rowIndex = findLineIndex(before, (l) => l.startsWith("| 2 | Отметить шаг |"));

  const after = patchStepResult(before, "TC-001", 2, { checked: true, note: "прошло" });
  assertOnlyLineChanged(before, after, rowIndex, "russian result column");
  assert.strictEqual(lineAt(after, rowIndex).text, "| 2 | Отметить шаг | Отметка сохранена | [x] прошло |");
});

test("TC-013 reference: patching an unknown TC or step throws and writes nothing", () => {
  const before = fixtures.readChecklistFixture("checklist-unknown-sections");
  assert.throws(() => patchStepResult(before, "TC-404", 1, { checked: true }), /TC-404 not found/);
  assert.throws(() => patchStepResult(before, "TC-001", 99, { checked: true }), /step 99 not found/);
  assert.throws(() => patchNotes(before, "TC-404", "x"), /TC-404 not found/);
});
