"use strict";

// public/status.js — "what does this issue/project need right now,
// concretely" (dogfooding round 2: a bare "N требует внимания" count told
// nobody what to actually go do, and was wrong besides — see
// public/attention.js's own history). Native ES module, pure functions
// only, no DOM/fetch — same convention as attention.js. Shared (not
// duplicated per screen, unlike the screen modules themselves) because two
// different screens render the exact same classification: the launcher's
// project grid and the project-selector dropdown both list projects by the
// same three categories; the project screen's issue cards and (indirectly)
// those same categories both use the same per-issue status message.
//
// Role-aware throughout (dogfooding round 2, second pass — the first cut
// left `projectCategory` role-independent and only annotated counts, which
// the user found unconvincing: "neither inbox nor projects lists react on
// roles toggle"). `roleIds` is the multi-select filter's current
// selection, same "empty = unfiltered" rule as `attention.js`'s
// `attentionForRoles`.

import { roleForStage } from "./stage-roles.js";

// Pipeline order server.js's `STAGE_DOCS` produces `stages[]` in — kept in
// lockstep with that array (server.js is the source of truth for which
// docs exist per stage; this is only the display label).
export const STAGE_LABELS = [
  ["brd", "BRD"],
  ["specs", "Spec"],
  ["test_plan", "Test plan"],
  ["implementation_plan", "Impl plan"],
  ["code_review", "Code review"],
  ["testing", "Manual checklist"],
  ["user_docs", "User docs"],
  ["dev_docs", "Dev docs"],
  ["qa", "QA report"],
];

function pluralize(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function relevantToRoles(stageKey, roleIds) {
  return !roleIds || roleIds.length === 0 || roleIds.includes(roleForStage(stageKey));
}

/**
 * Is this stage entry a genuinely *missing* document — as opposed to one
 * that legitimately does not apply to this issue (`not_applicable`)?
 *
 * `status` (CR-016) is the real `classifyIssueDoc` verdict and is checked
 * first when present. A stage entry with no `status` field at all — a
 * hand-built fixture from before this fix, or any future caller that only
 * ever sends `{key, done}` — falls back to the old `!done` reading, so
 * existing behaviour is unchanged wherever `status` is absent. Where
 * `status` *is* present, `not_applicable` must contribute nothing here: a
 * trivial-tier issue with no `specs.md`, or `roles.user_docs: skip`, is not
 * a defect and must not render as "Нет Spec"/"Нет User docs".
 *
 * @param {{key: string, done: boolean, status?: string}} stage
 * @returns {boolean}
 */
function isMissingStage(stage) {
  return stage.status ? stage.status === "missing" : !stage.done;
}

/**
 * Priority 1-3 of the status message: a missing pipeline doc, or a FAIL
 * verdict on one that exists — filtered to `roleIds` (empty/omitted =
 * unfiltered) via `stage-roles.js`'s "who creates this document" table.
 * `null` if neither applies (no doc problem at all, or none owned by the
 * selected roles) — this issue may still have pending tests/tasks, checked
 * separately by `issueStatusMessage` below.
 *
 * @param {{stages?: Array<{key: string, done: boolean, status?: string}>, codeReviewVerdict?: string|null, qaVerdict?: string|null}} issue
 * @param {string[]} [roleIds]
 * @returns {string|null}
 */
export function issueDocProblem(issue, roleIds) {
  const stages = Array.isArray(issue && issue.stages) ? issue.stages : [];
  const stageByKey = new Map(stages.map((s) => [s.key, s]));
  for (const [key, label] of STAGE_LABELS) {
    const stage = stageByKey.get(key);
    if (stage && isMissingStage(stage) && relevantToRoles(key, roleIds)) return `Нет ${label}`;
  }
  if (issue && issue.codeReviewVerdict === "FAIL" && relevantToRoles("code_review", roleIds)) return "Code review: FAIL";
  if (issue && issue.qaVerdict === "FAIL" && relevantToRoles("qa", roleIds)) return "QA: FAIL";
  return null;
}

/**
 * The full 6-branch priority chain for one issue's card (dogfooding round
 * 2's agreed taxonomy): a doc problem beats a pending-work count, which
 * beats "nothing to show".
 *
 * @param {object} issue — same shape `issueDocProblem` takes.
 * @param {number} manualCount — this issue's pending manual tests (already
 *   role-filtered by the caller, via `attentionForRoles`).
 * @param {number} humanCount — this issue's pending human tasks (same).
 * @param {string[]} [roleIds] — forwarded to `issueDocProblem`.
 * @returns {string|null}
 */
export function issueStatusMessage(issue, manualCount, humanCount, roleIds) {
  const docProblem = issueDocProblem(issue, roleIds);
  if (docProblem) return docProblem;
  if (manualCount > 0) return `${manualCount} ${pluralize(manualCount, "ручной тест", "ручных теста", "ручных тестов")}`;
  if (humanCount > 0) return `${humanCount} ${pluralize(humanCount, "human-задача", "human-задачи", "human-задач")}`;
  return null;
}

/**
 * The launcher project grid's / project-selector dropdown's shared
 * classification — one project into exactly one of three categories,
 * first match wins:
 *
 *   "open"     — has >=1 open issue **relevant to the role filter**: when
 *                `roleIds` is non-empty, an open issue only counts if it
 *                has a role-owned doc problem (`issueDocProblem`) or
 *                `attentionByIssue` shows pending work for it — an open
 *                issue with nothing for the selected role(s) doesn't keep
 *                the whole project in this section. `detail` lists the
 *                (filtered) open issues (`{issueId, stages}, ...`) for the
 *                caller to render with a stage strip + link — not a count.
 *   "problems" — no *relevant* open issues, but some issue (open or
 *                closed) has a role-owned `issueDocProblem`. `detail` is
 *                that first offending `{issueId, message}`.
 *   "clear"    — neither. `detail` is `null`.
 *
 * @param {Array<object>} issues — this project's own `GET .../issues` list
 *   (each carrying `status`/`stages`/`codeReviewVerdict`/`qaVerdict`).
 * @param {string[]} [roleIds] — the role filter; empty/omitted = unfiltered
 *   (every open issue counts, same as before this became role-aware).
 * @param {Object<string, number>} [attentionByIssue] — `attentionForRoles(...).byIssue`
 *   for this project and the same `roleIds`, when role-filtered — pending
 *   manual tests/human tasks aren't visible in `issues[]` itself.
 * @returns {{category: "open"|"problems"|"clear", detail: object|null}}
 */
export function projectCategory(issues, roleIds, attentionByIssue) {
  const list = Array.isArray(issues) ? issues : [];
  const filtered = roleIds && roleIds.length > 0;
  const isRelevant = (issue) =>
    !filtered || Boolean(issueDocProblem(issue, roleIds)) || Boolean(attentionByIssue && attentionByIssue[issue.issueId]);

  const openIssues = list.filter((i) => i.status === "open" && isRelevant(i));
  if (openIssues.length > 0) {
    return { category: "open", detail: openIssues.map((i) => ({ issueId: i.issueId, stages: i.stages })) };
  }
  for (const issue of list) {
    const message = issueDocProblem(issue, roleIds);
    if (message) return { category: "problems", detail: { issueId: issue.issueId, message } };
  }
  return { category: "clear", detail: null };
}
