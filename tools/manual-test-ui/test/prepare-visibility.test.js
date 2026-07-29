// TC-018 — classify the data need first, then apply the priority rule.
//
// Step 1: the checklist parser must classify a TC's data need into exactly
// three states before any visibility rule is applied:
//   declared — data is needed and its paths are listed
//   none     — explicitly marked as needing no data
//   unknown  — legacy TC written before the feature existed
// "unknown" must be a distinct string, never undefined and never "none":
// legacy issues must not look like "we know this needs nothing".
//
// Steps 2-7: the rule built on that classification, asserted through the
// three surfaces that must agree — the tester role (what the UI offers), the
// checklist payload (what it offers per case) and the prepare route (what the
// server accepts). Five fixture issues cover the five configurations, and
// none of them may answer with a 500 or with silence.
//
// Run: node --test test/prepare-visibility.test.js
"use strict";
const test = require("node:test");
const { before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { parseChecklist } = require("../lib/checklist");
const docstate = require("../lib/docstate");
const fixtures = require("./helpers/fixtures");

// Before anything reads os.tmpdir(): the working copies setup.mjs unpacks,
// and the fixture repository itself, all land under a root this suite owns
// and deletes whole.
const isolated = fixtures.isolateTempRoot("pf-prepare-tc018-");

const { startServer } = require("./helpers/server");
const { preparedWorkdir } = require("../lib/prepare");

const FIXTURE = fs.readFileSync(
  path.join(__dirname, "fixtures", "checklist-declared-data.md"),
  "utf8"
);
const parsed = parseChecklist(FIXTURE);
const byId = (id) => {
  const tc = parsed.tcs.find((t) => t.id === id);
  assert.ok(tc, `${id} not parsed`);
  return tc;
};

test("TC-018/1: all fixture TCs parse without warnings", () => {
  assert.strictEqual(parsed.tcs.length, 5, `expected 5 TCs, got ${parsed.tcs.length}`);
  for (const tc of parsed.tcs) {
    assert.deepStrictEqual(tc.parseWarnings, [], `${tc.id}: ${tc.parseWarnings.join("; ")}`);
  }
});

test("TC-018/1: declared data yields a non-empty list and dataStatus 'declared'", () => {
  const tc = byId("TC-001");
  assert.strictEqual(tc.dataStatus, "declared");
  assert.deepStrictEqual(tc.requiredData, ["prelude/common.json", "case-a/input.txt"]);
});

test("TC-018/1: 'не требуются' yields dataStatus 'none', not undefined", () => {
  const tc = byId("TC-002");
  assert.strictEqual(tc.dataStatus, "none");
  assert.notStrictEqual(tc.dataStatus, undefined);
  assert.deepStrictEqual(tc.requiredData, []);
});

test("TC-018/1: a legacy TC with prose-only prerequisites is 'unknown', not 'none'", () => {
  const tc = byId("TC-003");
  assert.strictEqual(tc.dataStatus, "unknown");
  assert.notStrictEqual(tc.dataStatus, "none");
  assert.notStrictEqual(tc.dataStatus, undefined);
  assert.deepStrictEqual(tc.requiredData, []);
  assert.strictEqual(tc.preparedPath, null);
});

test("TC-018/1: prose prerequisites stay in prerequisites and never leak into requiredData", () => {
  const tc = byId("TC-003");
  assert.deepStrictEqual(tc.prerequisites, [
    "Поднять сервис X на порту 8080.",
    "Завести пользователя с ролью «тестировщик».",
  ]);
  assert.deepStrictEqual(tc.requiredData, []);

  // Same border in a TC that *does* declare data: the prose prerequisite is
  // not promoted, and the declared paths are not demoted.
  const declared = byId("TC-001");
  assert.ok(declared.prerequisites.includes("Приложение запущено."));
  assert.ok(!declared.requiredData.includes("Приложение запущено."));
});

test("TC-018/1: English labels classify the same way", () => {
  const en = byId("TC-004");
  assert.strictEqual(en.dataStatus, "declared");
  assert.deepStrictEqual(en.requiredData, ["fixtures/users.csv"]);
  assert.strictEqual(byId("TC-005").dataStatus, "none");
});

test("TC-018/1: prepared-data bullet is lifted out and also kept as a prerequisite", () => {
  const ru = byId("TC-001");
  assert.strictEqual(ru.preparedPath, "/tmp/pf-manual-test/20260109/TC-001");
  assert.ok(
    ru.prerequisites.some((p) => p.startsWith("Подготовленные данные:")),
    "prepared-data bullet must survive in prerequisites"
  );
  assert.strictEqual(byId("TC-004").preparedPath, "/tmp/pf-manual-test/20260109/TC-004");
  assert.strictEqual(byId("TC-002").preparedPath, null);
});

test("TC-018/1: an empty data label does not claim the data is not needed", () => {
  const empty = parseChecklist(
    ["## TC-100: Empty label", "", "**Test Data:**", "", "**Notes:**", ""].join("\n")
  );
  const tc = empty.tcs[0];
  assert.strictEqual(tc.dataStatus, "unknown");
  assert.deepStrictEqual(tc.requiredData, []);
  assert.strictEqual(tc.parseWarnings.length, 1, tc.parseWarnings.join("; "));
});

test("TC-018/1: parsing a TC's data need leaves steps and notes untouched", () => {
  const tc = byId("TC-001");
  assert.strictEqual(tc.steps.length, 1);
  assert.strictEqual(tc.steps[0].step, 1);
  assert.strictEqual(tc.steps[0].checked, false);
  assert.ok(tc.notesLineIndex !== null, "Notes line must still be located");
});

// ---------------------------------------------------------------------------
// Steps 2-7 — the priority rule
// ---------------------------------------------------------------------------

const NODATA = "20260108-feat-fixture-nodata";
const DECLARED = "20260109-feat-fixture-declared";
const LEGACY = "20260110-improve-fixture-legacy";
const NOSCRIPT = "20260111-feat-fixture-noscript";
const CLOSED = "20260112-feat-fixture-closed";
const ALL_FIXTURES = [NODATA, DECLARED, LEGACY, NOSCRIPT, CLOSED];

const PROJECT = "main";
const TC = "TC-001";

const repo = fixtures.makeTempRepo({ issues: ALL_FIXTURES, name: "prepare-visibility" });
const config = fixtures.makeConfig({
  projects: [{ name: PROJECT, path: repo.root, defaultBranch: repo.defaultBranch }],
});

let server = null;

before(async () => {
  server = await startServer({ configPath: config.configPath });
});

after(async () => {
  if (server) await server.stop();
  fixtures.cleanupAll();
  isolated.restore();
});

// --- the three surfaces ----------------------------------------------------

async function checklistOf(issueId) {
  const res = await server.get(`/api/projects/${PROJECT}/issues/${issueId}/checklist`);
  assert.strictEqual(res.status, 200, `GET checklist of ${issueId} → ${res.status}: ${res.text}`);
  return res.json;
}

async function caseAction(issueId, tcId = TC) {
  const doc = await checklistOf(issueId);
  const tc = doc.tcs.find((t) => t.id === tcId);
  assert.ok(tc, `${issueId} has no ${tcId}`);
  assert.ok(tc.prepare, `${issueId}/${tcId} carries no prepare state at all`);
  return tc.prepare;
}

async function issueAction(issueId) {
  const doc = await checklistOf(issueId);
  assert.ok(doc.prepare, `${issueId} carries no issue-level prepare state`);
  return doc.prepare;
}

async function roleAction(issueId) {
  const res = await server.get(`/api/projects/${PROJECT}/issues/${issueId}/roles/tester`);
  assert.strictEqual(res.status, 200, `GET tester role of ${issueId} → ${res.status}: ${res.text}`);
  const item = res.json.items.find((i) => i.name === "prepare");
  assert.ok(item, `the tester role of ${issueId} lists no prepare action`);
  return item;
}

function postPrepare(issueId, body) {
  return server.post(`/api/projects/${PROJECT}/issues/${issueId}/prepare`, body);
}

// Every refusal this suite provokes has to look the same way: a 4xx, a JSON
// body, an error code, and a sentence. Never a 500, never an empty answer.
function assertClearRefusal(res, expectedError, what) {
  assert.ok(res.status >= 400 && res.status < 500, `${what}: expected a 4xx refusal, got ${res.status}: ${res.text}`);
  assert.ok(res.json, `${what}: the refusal must be JSON, not silence: ${JSON.stringify(res.text)}`);
  assert.strictEqual(res.json.ok, false, `${what}: a refusal must not report success`);
  assert.strictEqual(res.json.ran, false, `${what}: nothing may have been started`);
  assert.strictEqual(res.json.error, expectedError, `${what}: ${res.text}`);
  assert.strictEqual(res.json.reason, expectedError, `${what}: reason and error must be the same code`);
  assert.ok(
    typeof res.json.message === "string" && res.json.message.trim() !== "",
    `${what}: the refusal must explain itself`
  );
}

// --- step 2 ----------------------------------------------------------------

test("TC-018/2: a case that needs no data is not offered the action at all", async () => {
  const action = await caseAction(NODATA);

  assert.strictEqual(action.dataStatus, "none", "the fixture case must be the explicit no-data one");
  assert.strictEqual(action.offered, false, "a case that needs nothing must not be offered a prepare action");
  assert.strictEqual(action.enabled, false);
  assert.strictEqual(action.code, "data_not_required");

  // Not offered, but not an error either: the case is in a perfectly good
  // state and the payload must not read as a failure.
  assert.strictEqual(action.error, undefined, "a case that needs no data must not carry an error");
  assert.ok(action.message.includes(TC), `the explanation must name the case: ${action.message}`);

  // And the same answer when the action is demanded outright.
  const res = await postPrepare(NODATA, { confirm: true, tcId: TC });
  assertClearRefusal(res, "data_not_required", "prepare of a no-data case");
  assert.strictEqual(res.json.offered, false);
});

// --- step 3 ----------------------------------------------------------------

test("TC-018/3: a case with declared data is offered and can actually be run", async () => {
  const action = await caseAction(DECLARED);

  assert.strictEqual(action.dataStatus, "declared");
  assert.strictEqual(action.offered, true, "a case with declared data must never be silently hidden");
  assert.strictEqual(action.enabled, true, "declared data plus a setup script means the action is available");
  assert.strictEqual(action.requiresCheckout, false);
  assert.strictEqual(action.code, null, "an available action has nothing to explain away");
  assert.match(action.endpoint, new RegExp(`${DECLARED}/prepare$`));
  assert.strictEqual(action.method, "POST");

  // The tester role says exactly the same about the issue as a whole.
  const role = await roleAction(DECLARED);
  assert.strictEqual(role.offered, true);
  assert.strictEqual(role.enabled, true);
  assert.strictEqual(role.status, "present");

  // "Available" means available: the offered action runs and prepares the
  // data the checklist declared.
  const res = await postPrepare(DECLARED, { confirm: true, tcId: TC });
  assert.strictEqual(res.status, 200, `the offered action must run: ${res.text}`);
  assert.strictEqual(res.json.ok, true, `${res.json.reason} — ${res.json.message}`);
  const workdir = preparedWorkdir(DECLARED, TC);
  assert.strictEqual(res.json.workdir, workdir);
  for (const rel of ["case-a/input.txt", "case-a/second.txt"]) {
    assert.ok(fs.existsSync(path.join(workdir, ...rel.split("/"))), `${rel} was not prepared`);
  }
});

// --- step 4 ----------------------------------------------------------------

test("TC-018/4: a legacy case is visible, unavailable and explained — and its checklist still works", async () => {
  const action = await caseAction(LEGACY);

  assert.strictEqual(action.dataStatus, "unknown", "a legacy case must not be classified as needing nothing");
  assert.notStrictEqual(action.dataStatus, "none");
  assert.strictEqual(action.offered, true, "a legacy issue must not look like an issue with no action");
  assert.strictEqual(action.enabled, false, "nothing can be prepared for a case whose data need is unrecorded");
  assert.ok(action.reason && action.reason.trim() !== "", "the unavailability must be explained");
  assert.ok(action.message && action.message.trim() !== "");

  // The same verdict at the issue level and through the role.
  const role = await roleAction(LEGACY);
  assert.strictEqual(role.offered, true);
  assert.strictEqual(role.enabled, false);
  assert.ok(role.reason && role.reason.trim() !== "");

  // And the point of the whole case: everything else about a legacy
  // checklist keeps working. Ticking a step and writing notes are unaffected
  // by the fact that the tool cannot prepare data for it.
  const tick = await server.patch(`/api/projects/${PROJECT}/issues/${LEGACY}/checklist/steps`, {
    tcId: TC,
    step: 1,
    checked: true,
    note: "легаси-кейс отмечается как обычно",
  });
  assert.strictEqual(tick.status, 200, `ticking a step of a legacy checklist failed: ${tick.text}`);

  const notes = await server.patch(`/api/projects/${PROJECT}/issues/${LEGACY}/checklist/notes`, {
    tcId: TC,
    notesText: "Заметка тестировщика.",
  });
  assert.strictEqual(notes.status, 200, `writing notes on a legacy checklist failed: ${notes.text}`);

  const after = await checklistOf(LEGACY);
  const tc = after.tcs.find((t) => t.id === TC);
  assert.strictEqual(tc.steps[0].checked, true, "the tick did not survive");
  assert.match(tc.steps[0].note, /легаси-кейс/, "the note did not survive");
  assert.match(tc.notesText, /Заметка тестировщика/, "the notes did not survive");
  assert.strictEqual(tc.prepare.enabled, false, "editing the checklist must not change the prepare verdict");
});

// --- step 5 ----------------------------------------------------------------

test("TC-018/5: knowing the case needs nothing beats the issue having a test-data directory", async () => {
  // The fixture is built precisely for this collision.
  const testData = path.join(repo.issuePath(NODATA), "test-data");
  assert.ok(fs.existsSync(testData), "the fixture must have a test-data directory for the collision to exist");

  const action = await caseAction(NODATA);
  assert.strictEqual(action.offered, false, "the directory must not override what the case says about itself");
  assert.strictEqual(action.code, "data_not_required");

  // The control: a case that declares data in an issue with a directory *is*
  // offered — so the answer above comes from the case, not from the tool
  // refusing everything.
  const declared = await caseAction(DECLARED);
  assert.strictEqual(declared.offered, true);
});

// --- step 6 ----------------------------------------------------------------

test("TC-018/6: declared data with no setup script is visible, unavailable, and says which script is missing", async () => {
  const script = path.join(repo.issuePath(NOSCRIPT), "test-data", "setup.mjs");
  assert.ok(!fs.existsSync(script), "the fixture must be the one without a setup script");

  for (const [what, action] of [
    ["case", await caseAction(NOSCRIPT)],
    ["issue", await issueAction(NOSCRIPT)],
    ["role", await roleAction(NOSCRIPT)],
  ]) {
    assert.strictEqual(action.offered, true, `${what}: it must be visible, not silently hidden`);
    assert.strictEqual(action.enabled, false, `${what}: there is no script to run`);
    assert.strictEqual(action.code, "no-setup-script", `${what}: ${JSON.stringify(action.reason)}`);
    assert.match(action.reason, /setup\.mjs/, `${what}: the reason must name the missing script`);
    assert.match(action.message, /setup\.mjs/, `${what}: the message must name the missing script`);
    assert.strictEqual(action.status, "present", `${what}: the checklist itself is there`);
  }

  // Both requests are refused the same way — no 500, no empty body.
  for (const body of [{ confirm: true }, { confirm: true, tcId: TC }]) {
    const res = await postPrepare(NOSCRIPT, body);
    assertClearRefusal(res, "no-setup-script", `prepare ${JSON.stringify(body)}`);
    assert.strictEqual(res.status, 404, `prepare ${JSON.stringify(body)}: ${res.text}`);
    assert.ok(res.json.message.includes(NOSCRIPT), `the message must name the issue: ${res.json.message}`);
  }
});

// --- step 7 ----------------------------------------------------------------

test("TC-018/7: a closed issue is offered the action neither per issue nor per case", async () => {
  for (const [what, action] of [
    ["case", await caseAction(CLOSED)],
    ["issue", await issueAction(CLOSED)],
    ["role", await roleAction(CLOSED)],
  ]) {
    assert.strictEqual(action.offered, false, `${what}: an archive is read, never re-run`);
    assert.strictEqual(action.enabled, false, `${what}`);
    assert.strictEqual(action.code, "issue_closed", `${what}`);
    assert.ok(action.reason && action.reason.trim() !== "", `${what}: the refusal must explain itself`);
  }

  for (const body of [{ confirm: true }, { confirm: true, tcId: TC }]) {
    const res = await postPrepare(CLOSED, body);
    assertClearRefusal(res, "issue_closed", `prepare ${JSON.stringify(body)} on a closed issue`);
  }
});

// --- none of the five is silent --------------------------------------------

test("TC-018: no configuration answers with a 500 or with an empty body", async () => {
  for (const issueId of ALL_FIXTURES) {
    const role = await roleAction(issueId);
    assert.ok(["present", "not_applicable", "missing"].includes(role.status), `${issueId}: status ${role.status}`);
    assert.ok(role.message && role.message.trim() !== "", `${issueId}: the role entry has no message`);
    assert.strictEqual(typeof role.offered, "boolean", `${issueId}: offered is not a decision`);
    assert.strictEqual(typeof role.enabled, "boolean", `${issueId}: enabled is not a decision`);
    if (!role.enabled) {
      assert.ok(role.reason && role.reason.trim() !== "", `${issueId}: unavailable without a reason`);
    }

    const doc = await checklistOf(issueId);
    for (const tc of doc.tcs) {
      assert.ok(tc.prepare, `${issueId}/${tc.id}: no prepare verdict`);
      assert.ok(tc.prepare.message.trim() !== "", `${issueId}/${tc.id}: an empty verdict`);
    }

    const res = await postPrepare(issueId, { confirm: true, tcId: TC });
    assert.ok(res.status < 500, `${issueId}: prepare answered ${res.status}: ${res.text}`);
    assert.ok(res.json, `${issueId}: prepare answered with a non-JSON body: ${JSON.stringify(res.text)}`);
    assert.ok(
      typeof res.json.message === "string" && res.json.message.trim() !== "",
      `${issueId}: prepare answered without a sentence`
    );
  }
});

// --- the rule itself, without a server -------------------------------------

test("TC-018: the priority rule is one function, and its order is the point", () => {
  const facts = {
    issueId: "20260101-feat-fixture-full",
    issueStatus: "open",
    checklistStatus: "here",
    hasSetupScript: true,
    tcId: TC,
  };
  const rule = (extra) => docstate.prepareVisibility({ ...facts, ...extra });

  // The three cases of AC-06c, in the letter of the rule.
  const none = rule({ dataStatus: "none" });
  assert.deepStrictEqual(
    { offered: none.offered, enabled: none.enabled },
    { offered: false, enabled: false },
    "known to need nothing → not offered at all"
  );
  assert.strictEqual(none.code, "data_not_required");

  const declared = rule({ dataStatus: "declared" });
  assert.deepStrictEqual({ offered: declared.offered, enabled: declared.enabled }, { offered: true, enabled: true });
  assert.strictEqual(declared.reason, null);

  const unprepared = rule({ dataStatus: "declared", hasSetupScript: false });
  assert.deepStrictEqual(
    { offered: unprepared.offered, enabled: unprepared.enabled },
    { offered: true, enabled: false },
    "known to need data but not preparable → visible and unavailable"
  );
  assert.match(unprepared.reason, /setup\.mjs/);

  const unknown = rule({ dataStatus: "unknown" });
  assert.deepStrictEqual(
    { offered: unknown.offered, enabled: unknown.enabled },
    { offered: true, enabled: false },
    "not known → treated as the second case, never as the first"
  );
  assert.ok(unknown.reason && unknown.reason.trim() !== "", "the unknown case must be explained");
  assert.notStrictEqual(unknown.code, "data_not_required", "unknown must never collapse into none");

  // An absent field is unknown, not none — the legacy trap in one assertion.
  assert.strictEqual(rule({ dataStatus: undefined }).offered, true);
  assert.strictEqual(rule({ dataStatus: null }).offered, true);
  assert.strictEqual(rule({}).dataStatus, "unknown");

  // Precedence: a closed issue beats everything, "needs nothing" beats a
  // pending checkout, and a pending checkout beats a missing script.
  assert.strictEqual(rule({ dataStatus: "declared", issueStatus: "closed" }).code, "issue_closed");
  assert.strictEqual(rule({ dataStatus: "none", issueStatus: "closed" }).code, "issue_closed");
  assert.strictEqual(rule({ dataStatus: "none", checklistStatus: "on_branch" }).code, "data_not_required");
  assert.strictEqual(
    rule({ dataStatus: "declared", checklistStatus: "on_branch", hasSetupScript: false }).code,
    "not_checked_out"
  );
  assert.strictEqual(rule({ dataStatus: "unknown", checklistStatus: "missing" }).code, "checklist_not_found");
});

test("TC-018: two cases of one issue get two verdicts, not the issue's", async () => {
  // Every fixture issue is uniform, so the mixed checklist — one case that
  // declares data, one that declares it needs none — is made here, in the
  // throwaway repository, and taken back afterwards. Without it, a rule that
  // quietly answered per issue and ignored the case would pass everything
  // above.
  const checklistPath = repo.checklistPath(DECLARED);
  const original = fs.readFileSync(checklistPath, "utf8");
  const extraCase = (id, name, dataLines) =>
    [
      "",
      `## ${id}: ${name}`,
      "",
      ...dataLines,
      "",
      "**Steps:**",
      "",
      "| Step | Action | Expected Result | Result |",
      "| --- | --- | --- | --- |",
      "| 1 | Do nothing | Nothing happens | [ ] |",
      "",
      "**Notes:**",
      "",
    ].join("\n");
  const mixed =
    original +
    extraCase("TC-002", "Needs nothing", ["**Test Data:** none"]) +
    // No data label at all: the legacy shape, in an issue that *does* have a
    // setup script. This is the only configuration in which "offered but not
    // runnable" and "runnable" differ by the rule alone.
    extraCase("TC-003", "Says nothing", ["**Prerequisites:**", "- Поднять сервис X."]);

  try {
    fs.writeFileSync(checklistPath, mixed, "utf8");

    const declared = await caseAction(DECLARED, "TC-001");
    const none = await caseAction(DECLARED, "TC-002");
    assert.strictEqual(declared.offered, true, "the case that declares data is still offered");
    assert.strictEqual(declared.enabled, true);
    assert.strictEqual(none.offered, false, "the case in the same issue that needs nothing is not");
    assert.strictEqual(none.code, "data_not_required");

    // The issue as a whole still has data to prepare — the strongest claim
    // among its cases wins there, and it does not overwrite either case.
    const issue = await issueAction(DECLARED);
    assert.strictEqual(issue.dataStatus, "declared");
    assert.strictEqual(issue.enabled, true);

    // The case that says nothing: visible, unavailable, explained — even
    // though this issue can prepare data for its sibling.
    const unknown = await caseAction(DECLARED, "TC-003");
    assert.strictEqual(unknown.dataStatus, "unknown");
    assert.strictEqual(unknown.offered, true, "an unrecorded data need is not a hidden action");
    assert.strictEqual(unknown.enabled, false, "an unrecorded data need is not a runnable one either");
    assert.strictEqual(unknown.code, "data_need_unknown");
    assert.ok(unknown.reason.includes("TC-003"), `the reason must name the case: ${unknown.reason}`);

    // And the route decides per case too.
    const refused = await postPrepare(DECLARED, { confirm: true, tcId: "TC-002" });
    assertClearRefusal(refused, "data_not_required", "prepare of the no-data case of a mixed issue");
    assert.strictEqual(refused.json.tcId, "TC-002", "the refusal must name the case it is about");

    // What the UI greys out, the route refuses — with the script sitting
    // right there, unrun. This is the one configuration where the two could
    // silently disagree.
    const held = await postPrepare(DECLARED, { confirm: true, tcId: "TC-003" });
    assertClearRefusal(held, "data_need_unknown", "prepare of the unrecorded case of a mixed issue");
    assert.ok(
      !fs.existsSync(preparedWorkdir(DECLARED, "TC-003")),
      "the setup script ran for a case the tool said it would not prepare"
    );

    const accepted = await postPrepare(DECLARED, { confirm: true, tcId: "TC-001" });
    assert.strictEqual(accepted.status, 200, `the sibling case must still run: ${accepted.text}`);
  } finally {
    fs.writeFileSync(checklistPath, original, "utf8");
  }
});

test("TC-018: an issue's data need is folded from its cases, and 'no cases' is not 'no data'", () => {
  const tcs = (...statuses) => statuses.map((dataStatus, i) => ({ id: `TC-00${i + 1}`, dataStatus }));

  assert.strictEqual(docstate.aggregateDataStatus(tcs("none", "declared")), "declared");
  assert.strictEqual(docstate.aggregateDataStatus(tcs("none", "unknown")), "unknown");
  assert.strictEqual(docstate.aggregateDataStatus(tcs("none", "none")), "none");
  assert.strictEqual(docstate.aggregateDataStatus(tcs("unknown", "declared")), "declared");
  // An empty or unreadable checklist knows nothing; it does not know that
  // nothing is needed.
  assert.strictEqual(docstate.aggregateDataStatus([]), "unknown");
  assert.strictEqual(docstate.aggregateDataStatus(undefined), "unknown");
  assert.strictEqual(docstate.normalizeDataStatus("NONE"), "unknown");
});
