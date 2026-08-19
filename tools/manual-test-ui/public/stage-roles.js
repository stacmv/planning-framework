"use strict";

// public/stage-roles.js — which viewer role (analyst/developer/tester) is
// responsible for *creating* each pipeline-stage document (dogfooding
// round 2, second correction: "responsible" means who creates it, not who
// merely reads/uses it — a tester works with test_plan.md/
// manual_test_checklist.md/qa_report.md but does not author them; that's
// the developer's job).
//
// Deliberately its own small config, not reused from and not reusing:
//   - `lib/roles.js` (server) — which role's *tab set* shows a document.
//     That is a viewing-access question ("who reads this"), a different
//     axis from authorship — tester's own tabs include test_plan.md, but
//     this file says "developer" for it anyway, on purpose.
//   - `public/attention.js`'s `STAGE_KEY_ROLE` — maps `roles.<key>.write`
//     pipeline stage keys (brd/specs/code/tests/...) to a role, for
//     human-task filtering. Overlaps in a few key names (brd, specs) but
//     is a different mapping for a different purpose (an *assigned*
//     human-task's owner, not "who authors this stage's document" as a
//     general rule) — kept separate rather than merged, so a future change
//     to one doesn't silently change the other's meaning.
//
// Keys match `public/status.js`'s `STAGE_LABELS` exactly.
export const STAGE_ROLES = {
  brd: "analyst",
  specs: "developer",
  test_plan: "developer",
  implementation_plan: "developer",
  code_review: "developer",
  testing: "developer",
  user_docs: "analyst",
  dev_docs: "developer",
  qa: "developer",
};

/**
 * @param {string} stageKey — a `STAGE_LABELS` key.
 * @returns {string|null}
 */
export function roleForStage(stageKey) {
  return Object.prototype.hasOwnProperty.call(STAGE_ROLES, stageKey) ? STAGE_ROLES[stageKey] : null;
}
