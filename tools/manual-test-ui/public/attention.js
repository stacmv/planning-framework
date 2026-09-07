"use strict";

// public/attention.js — "does issue X need something from role Y right
// now" (dogfooding feedback on 20260806-feat-project-explorer-redesign:
// switching role on the launcher did nothing to the inbox/project cards —
// manualTests[]/humanTasks[] deliberately carry no role field at all,
// specs.md §3.4, so there was nothing to filter by).
//
// Native ES module, pure functions only — same convention as
// `public/launcher.js`/`public/inbox.js`. Imported by the launcher (project
// card counts), the new per-project issue-list screen, and anywhere else
// that needs "what does role R still owe on issue I / project P."
//
// manualTests[] is always the tester's business by construction (a manual
// TC has no role field either, for the same reason — specs.md §3.4). Every
// other role's business is humanTasks[], matched by `stageKey` against the
// role whose own `GET .../roles/:role` item list would show that stage's
// document as a tab. `code`/`tests`/`dev_docs`/`user_docs` never appear in
// any of the three roles' item lists in `lib/roles.js` (they're pipeline
// stage keys, not documents a "Тестировщик"/"Разработчик"/"Analyst" tab
// set names) — those four are a deliberate, explicit supplement, not
// derived: code/tests/dev_docs -> developer (implementation-adjacent),
// user_docs -> analyst (requirements/documentation-adjacent).
export const STAGE_KEY_ROLE = {
  brd: "analyst",
  analysis: "analyst",
  notes: "analyst",
  user_docs: "analyst",
  specs: "developer",
  implementation_plan: "developer",
  code: "developer",
  tests: "developer",
  dev_docs: "developer",
  test_plan: "tester",
};

/**
 * @param {string} stageKey
 * @returns {string|null} the role id this stageKey's human-tasks belong to,
 *   or `null` for an unrecognized stageKey (counted toward no role, rather
 *   than guessed at).
 */
export function roleForStageKey(stageKey) {
  return Object.prototype.hasOwnProperty.call(STAGE_KEY_ROLE, stageKey) ? STAGE_KEY_ROLE[stageKey] : null;
}

/**
 * Per-issue and per-project "needs attention from these roles" counts, for
 * one already-fetched `GET /api/inbox` response.
 *
 * `roleIds` is the multi-select role filter's current selection (dogfooding
 * round 2: role became a filter, not a switch). **Empty (`[]`/`null`/
 * `undefined`) means unfiltered** — the same "nothing selected = show
 * everything" rule the filter uses everywhere else — so every manual test
 * and human task for the project counts, regardless of which role it would
 * otherwise map to. A non-empty selection counts a manual test if
 * `"tester"` is among the selected roles, and a human task if
 * `roleForStageKey(item.stageKey)` is among them.
 *
 * `missingDocsByIssue` is optional: `{ [issueId]: count }`, the number of
 * documents (across the selected roles, or all roles if unfiltered)
 * `status: "missing"` for that issue — folded into the same per-issue count
 * when supplied. The launcher's project cards do not have this data
 * cheaply available (it would mean fetching every issue's full role
 * contents up front) and omit it; the per-project issue-list screen, which
 * already fetches per-issue detail for its status column, supplies it.
 *
 * @param {{manualTests?: object[], humanTasks?: object[]}} inboxResponse
 * @param {string} projectName
 * @param {string[]} roleIds
 * @param {Object<string, number>} [missingDocsByIssue]
 * @returns {{total: number, byIssue: Object<string, number>}}
 */
export function attentionForRoles(inboxResponse, projectName, roleIds, missingDocsByIssue) {
  const byIssue = {};
  const bump = (issueId, n) => {
    if (!issueId) return;
    byIssue[issueId] = (byIssue[issueId] || 0) + n;
  };

  const selected = Array.isArray(roleIds) ? roleIds.filter(Boolean) : [];
  const unfiltered = selected.length === 0;

  if (inboxResponse && projectName) {
    const manualTests = Array.isArray(inboxResponse.manualTests) ? inboxResponse.manualTests : [];
    const humanTasks = Array.isArray(inboxResponse.humanTasks) ? inboxResponse.humanTasks : [];

    if (unfiltered || selected.includes("tester")) {
      for (const item of manualTests) {
        if (item && item.project === projectName) bump(item.issueId, 1);
      }
    }
    for (const item of humanTasks) {
      if (!item || item.project !== projectName) continue;
      if (unfiltered || selected.includes(roleForStageKey(item.stageKey))) bump(item.issueId, 1);
    }
  }

  if (missingDocsByIssue) {
    for (const issueId of Object.keys(missingDocsByIssue)) bump(issueId, missingDocsByIssue[issueId] || 0);
  }

  let total = 0;
  for (const issueId of Object.keys(byIssue)) total += byIssue[issueId];
  return { total, byIssue };
}

/**
 * Same role-matching rule as `attentionForRoles`, but across **every**
 * project at once — the global inbox card's own count (dogfooding round 2:
 * the card showed the raw, unfiltered total regardless of the role filter,
 * the same "role does nothing" bug the project grid had).
 *
 * @param {{manualTests?: object[], humanTasks?: object[]}} inboxResponse
 * @param {string[]} roleIds — empty/null/undefined = unfiltered.
 * @returns {number}
 */
export function totalAttentionForRoles(inboxResponse, roleIds) {
  const selected = Array.isArray(roleIds) ? roleIds.filter(Boolean) : [];
  const unfiltered = selected.length === 0;
  if (!inboxResponse) return 0;

  const manualTests = Array.isArray(inboxResponse.manualTests) ? inboxResponse.manualTests : [];
  const humanTasks = Array.isArray(inboxResponse.humanTasks) ? inboxResponse.humanTasks : [];

  let total = 0;
  if (unfiltered || selected.includes("tester")) total += manualTests.length;
  for (const item of humanTasks) {
    if (unfiltered || selected.includes(roleForStageKey(item && item.stageKey))) total += 1;
  }
  return total;
}
