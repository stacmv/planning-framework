"use strict";

// public/workspace.js — level-2 workspace screen (this issue's tech spec
// §2.2, AC-01b/AC-01c/AC-01d/AC-01e, implementation_plan.md Task 24).
//
// Native ES module (`export`/`import`) — the same client-side convention
// `public/inbox.js`/`public/launcher.js` already use (tech spec §2.3), not
// the UMD wrapper `lib/*.js` uses for dual Node/browser loading. This file
// only ever runs in a browser, or is exercised from Node's test runner via
// dynamic `import()` (the pattern test_plan.md TC-003 documents for this
// exact file).
//
// Scope of this task (test_plan.md TC-002/TC-003):
//   * `.workspace-header` — "← Проекты" back link (level 1), an `[Issue ▾]`
//     dropdown of the current project's issues (replaces the old
//     `#issue-list` sidebar list), and a `[Роль ▾]` dropdown — the same role
//     switcher level 1 has. There is no persistent `.sidebar` container at
//     all (AC-01b) — everything here lives in one header row.
//   * `.doc-tabs` — built from the current role's own `GET .../roles/:role`
//     response (`buildRoleContents`, server.js) for the *current* role only.
//     No document name is ever written down in this file as a literal list
//     — the tab set is always whatever the server just answered, plus one
//     client-added "Дела" tab (see below). `lib/roles.js` needs no changes:
//     the data source is unchanged, only the visual container is (tabs
//     instead of three sidebar lists).
//   * `resolveActiveTab(prevTabId, docsOfNewIssue)` — the pure function that
//     keeps the active document tab when `[Issue ▾]` changes, even into a
//     `missing` document (fixes a P0 `/pf-check` finding: switching issue
//     must never silently switch documents). This rule is scoped to one
//     role — switching `[Роль ▾]` always takes a fresh tab set instead, and
//     never goes through this function.
//
// "Дела" (human tasks) is a new tab in every role's tab set, present from
// Task 24 onward so later tasks have somewhere to attach to: its counter
// logic (`countProjectTodos`, exported below) is Task 25's job, and the
// richer content of `manual_test_checklist.md`'s `looseSections` block
// (`renderChecklistPanel`, exported below) is Task 26's — both done in this
// file. This file's tab-set model already has room for both — it is not a
// fixed list of document tabs only.

// Same storage key `public/launcher.js` writes on level 1 (tech spec §2.1:
// "role switch on the launcher stores its choice in localStorage (`pf.role`),
// passed to level 2 as the default"). Not imported from launcher.js — that
// module is written by a separate, concurrently-running task and this one
// has to stay mountable/testable on its own either way — so the key is
// simply the same well-known string, not a shared implementation.
export const ROLE_STORAGE_KEY = "pf.role";

function lastIssueStorageKey(project) {
  return `pf.lastIssue.${project}`;
}

// The client-added tab id for "Дела" — deliberately the same string
// `public/inbox.js`'s `humanTaskItemView()` already uses for `where.tab`
// (its click target), so a human-task item landing on this screen and this
// screen's own tab selection agree on one id for the same place.
export const HUMAN_TASKS_TAB_ID = "human-tasks";

// ---------------------------------------------------------------------------
// Pure functions — tab-set construction and the "keep the tab" rule. Kept
// free of DOM/fetch/localStorage so they're callable and assertable from a
// plain Node test via dynamic `import()` (test_plan.md TC-003's Preconditions).
// ---------------------------------------------------------------------------

// A doc tab's id AND label: the server's own `item.name`/`item.id` with a
// trailing ".md" dropped (tech spec §2.2's wireframe shows
// "test_plan │ manual_test_checklist │ qa_report", not the ".md"-suffixed
// form) — computed from whatever the response says, never from a name
// written down here. This stripped form is the tab's one canonical id
// (`resolveActiveTab`'s `prevTabId`/`selectTab`'s `tabId` are always this
// shape, e.g. "brd", never "brd.md") — one identity, not a raw-id/label pair
// that could disagree.
function tabIdFor(item) {
  const name = String(item.name || item.id || "");
  return name.endsWith(".md") ? name.slice(0, -3) : name;
}

/**
 * The full `.doc-tabs` tab set for one role's contents: one tab per entry of
 * `roleContents.items` (in the order the server sent them), plus exactly one
 * client-added "Дела" tab at the end. Never reads a document name from a
 * constant in this file — every doc tab's id/label/state comes straight from
 * `roleContents.items` (test_plan.md TC-002 step 4).
 *
 * @param {{items?: Array<{id: string, name?: string, label?: string}>}|null} roleContents
 *   A `GET .../issues/:id/roles/:role` response (`buildRoleContents`), or
 *   anything shaped like one.
 * @returns {Array<{id: string, kind: "doc"|"human-tasks", label: string, item: object|null}>}
 */
export function buildTabSet(roleContents) {
  const items = roleContents && Array.isArray(roleContents.items) ? roleContents.items : [];
  const tabs = items.map((item) => ({
    id: tabIdFor(item),
    kind: "doc",
    label: tabIdFor(item),
    item,
  }));
  tabs.push({
    id: HUMAN_TASKS_TAB_ID,
    kind: "human-tasks",
    // Counter suffix (tech spec §2.2's "Дела ③") is Task 25's job
    // (`countProjectTodos`) — this task only reserves the tab itself.
    label: "Дела",
    item: null,
  });
  return tabs;
}

/**
 * Which tab stays active when `[Issue ▾]` switches to a different issue,
 * *within the same role* (tech spec §2.2, the P0 fix). The rule is the same
 * whether the document exists for the new issue or not: a document tab that
 * was active stays active — a `missing`/`not_applicable` document renders in
 * that state rather than silently switching the reader to a different
 * document. Only when `prevTabId` names a tab that the new tab set does not
 * have at all (not supposed to happen switching issue within one role, since
 * `lib/roles.js` partitions items by role, not by issue) does this fall back
 * to the first tab — never to nothing.
 *
 * Switching `[Роль ▾]` does **not** go through this function at all: a role
 * switch takes a wholly fresh tab set (`buildTabSet` of the new role's own
 * response), because a role's tab set is a different set of documents by
 * construction, not a continuation of the previous one.
 *
 * @param {string|null} prevTabId — the tab id that was active before the issue changed.
 * @param {object|null} docsOfNewIssue — the new issue's `GET .../roles/:role`
 *   response, for the *same* role the reader was already on.
 * @returns {string|null}
 */
export function resolveActiveTab(prevTabId, docsOfNewIssue) {
  const tabs = buildTabSet(docsOfNewIssue);
  if (prevTabId && tabs.some((t) => t.id === prevTabId)) return prevTabId;
  return tabs.length ? tabs[0].id : null;
}

/**
 * The "Дела" tab's counter (specs.md §3.4, US-06, AC-06a/AC-06b, TC-029):
 * the sum of unclosed todos across ALL roles and ALL open issues of one
 * project — never scoped to the currently-selected issue/role. An earlier
 * draft of specs.md §2.2 scoped this to "all roles of *this* issue"; §3.4
 * corrected that to project-wide during `/pf-check`, and this function is
 * that corrected computation.
 *
 * Deliberately takes NO role parameter — that absence is the structural
 * half of AC-06b (TC-029 step 2): a function that cannot see the role
 * cannot make the counter depend on it, so switching `[Роль ▾]` is
 * physically incapable of changing the result. Neither `manualTests[]` nor
 * `humanTasks[]` carries a "role" field at all (a manual TC is always the
 * tester's business by construction; a human task is tied to `stageKey`,
 * not to a viewing role) — filtering by project alone already yields the
 * "across all roles" sum, no separate role-union step needed.
 *
 * @param {{manualTests?: Array<{project?: string}>, humanTasks?: Array<{project?: string}>}|null} inboxResponse
 *   A `GET /api/inbox` response (`server.js`, `lib/inbox.js`'s
 *   `collectManualTests`/`collectHumanTasks`) — the same one
 *   `public/inbox.js`'s global inbox screen fetches, reused here rather
 *   than refetched (see `fetchInbox`/`mount()` below).
 * @param {string} projectName
 * @returns {number}
 */
export function countProjectTodos(inboxResponse, projectName) {
  if (!inboxResponse || !projectName) return 0;
  const manualTests = Array.isArray(inboxResponse.manualTests) ? inboxResponse.manualTests : [];
  const humanTasks = Array.isArray(inboxResponse.humanTasks) ? inboxResponse.humanTasks : [];
  const countOf = (items) => items.filter((item) => item && item.project === projectName).length;
  return countOf(manualTests) + countOf(humanTasks);
}

// The "Дела" tab's "Отдать агенту" dropdown (AC-05g/AC-05j, Task 30, CR-002
// fix) is built from `docs/planning/agents.yml`'s `actors:` block — a
// project-specific, runtime-fetched list, never a literal name written down
// here (the same "never hardcode what the server/config can answer" rule
// `buildTabSet` follows for role documents). This is a minimal, independent
// reimplementation of just enough of `lib/roles-resolve.js`'s flow-mapping
// parse to list the `actors:` block's own top-level keys — NOT a reuse of
// that module, which is UMD-wrapped for Node and not on `BROWSER_MODULES`'
// allowlist (`server.js`) for browser `<script>`/import loading, and pulling
// it in for one name list would be disproportionate. Pure (no DOM, no
// fetch) so it's directly testable against a raw YAML string, the same way
// `renderChecklistPanel` above is pure over a parsed-JSON input.
//
// Only reads flow-style entries (`  name: { ... }`, the one shape
// `docs/planning/agents.yml` ships with — see `server.js`'s own
// `DEFAULT_AGENTS_YAML`/`replacePromptRolesWrite` comments for why this
// project standardizes on that style) at the `actors:` block's own
// indentation level; a block-style or deeper-nested entry simply isn't
// picked up (an empty/short list is a safe degradation — the dropdown just
// offers fewer names — never a thrown error or a wrong name).
export function parseActorNames(agentsYamlText) {
  if (!agentsYamlText) return [];
  const lines = String(agentsYamlText).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^actors:\s*$/.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) return [];

  const names = [];
  const entryRe = /^(\s+)([^\s:]+):\s*\{/;
  let baseIndent = null;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue; // blank line inside the block — keep scanning
    const m = entryRe.exec(line);
    if (!m) break; // dedent (block ended) or a shape this parser doesn't read
    const indent = m[1].length;
    if (baseIndent === null) baseIndent = indent;
    if (indent < baseIndent) break; // dedented past the block's own entries
    if (indent === baseIndent) names.push(m[2]);
  }
  return names;
}

// The checklist document's own tab id (`tabIdFor("manual_test_checklist.md")`
// — ".md" stripped, same rule every tab id follows). This is the one doc tab
// `renderDocPanel` routes through the structured `GET .../checklist` fetch
// and `renderChecklistPanel` below, instead of the generic raw-markdown path
// every other doc tab uses (specs.md §2.4).
//
// This one name IS written down as a literal — the single, explicit
// carve-out specs.md §2.4 asks for, not a violation of the "no hardcoded
// document list" rule above `buildTabSet` states: that rule is about never
// writing down the *set* of documents a role shows (still true — the tab
// set itself always comes from the server), not about a single document
// this file is allowed to know by name because it renders it differently.
export const CHECKLIST_DOC_ID = "manual_test_checklist";

// Minimal HTML escaping — this module's own copy rather than
// `window.PFMarkdown.escapeHtml` (`lib/markdown.js`, loaded as a classic
// script in the browser, tech spec §2.3): `renderChecklistPanel` below is a
// *pure* function (test_plan.md TC-030's Preconditions — no DOM, no
// `window`), and under `node --test`'s dynamic `import()` of this file
// there is no `window` at all, so a dependency on `window.PFMarkdown` here
// would make the function untestable rather than merely undesirable.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Prerequisites / Test Data, as a read-only `<ul>` under a small label — the
// same shape both blocks take in the source markdown (a label line plus
// bullets), reused for either.
function renderBulletBlockHtml(label, items) {
  if (!items || !items.length) return "";
  const itemsHtml = items.map((item) => `<li class="loose-item">${escapeHtml(item)}</li>`).join("");
  return `<div class="doc-description"><strong>${escapeHtml(label)}:</strong><ul class="loose-items">${itemsHtml}</ul></div>`;
}

// `tc.dataStatus`/`tc.requiredData` (`lib/checklist.js`): "declared" (a real
// list), "none" (explicitly marked as not needed) or "unknown" (the label is
// absent or empty — silence, not a claim of "not needed"). Rendering all
// three distinctly matters here for the same reason it matters to
// `prepareActionState` server-side — "unknown" and "none" are not the same
// fact, and collapsing them would misinform the reader.
function renderTestDataHtml(tc) {
  if (tc.dataStatus === "declared") return renderBulletBlockHtml("Test Data", tc.requiredData);
  if (tc.dataStatus === "none") return `<p class="doc-description"><strong>Test Data:</strong> none</p>`;
  return "";
}

// One TC's own body as a `.panel` block — the same panel convention every
// other document uses (implementation_plan.md Task 20's `.panel`/
// `.panel-table`). Otherwise carries the same information the generic
// raw-markdown render this tab used before this task would have shown —
// prerequisites, declared test data, parse warnings, notes — not only the
// steps table, so switching to the structured render (needed for
// `.loose-sections` below to have a real "after the last TC `.panel`" to
// come after, TC-030 step 2) does not narrow what the reader can see.
//
// Task 29 (CR-001 fix): the steps table used to render here too, as static
// ☑/☐ text with zero interactive elements — the finding this task fixes.
// It has moved OUT of this function: this function stays a pure string
// builder (TC-030's Preconditions, still asserted by test/workspace-ui.test.js
// and test/workspace.test.js), but a real `<input>`/`<textarea>`/click
// handler cannot be embedded in a string — an event listener is not
// serializable HTML. `buildStepsTableNode` below builds the steps table as
// real, interactive DOM nodes instead, appended alongside this function's
// output by `renderChecklistBody` (mount()'s own DOM-building code, not a
// pure function, and not asserted on by TC-030 — see that function's own
// comment). The TC-level free-text Notes line below is left exactly as it
// was (still asserted on, e.g. "Nothing unusual observed." in
// test/workspace-ui.test.js) — `buildNotesEditorNode` adds an editable
// control alongside it, not in place of it.
function renderTcPanelHtml(tc) {
  const prerequisites = renderBulletBlockHtml("Prerequisites", tc.prerequisites);
  const testData = renderTestDataHtml(tc);
  const notes = tc.notesText ? `<p class="doc-description"><strong>Notes:</strong> ${escapeHtml(tc.notesText)}</p>` : "";
  const warnings =
    Array.isArray(tc.parseWarnings) && tc.parseWarnings.length
      ? `<p class="notice warn">${escapeHtml(tc.parseWarnings.join("; "))}</p>`
      : "";
  return (
    `<div class="panel" data-tc-id="${escapeHtml(tc.id)}">` +
    `<h2 class="panel-header">${escapeHtml(tc.id)}: ${escapeHtml(tc.name || "")}</h2>` +
    `${prerequisites}${testData}${notes}${warnings}</div>`
  );
}

// The checklist's own header metadata (`parsed.meta` — `lib/checklist.js`,
// everything before the first TC heading, e.g. "Feature Name"/"Issue ID"/
// "Date"): whatever labels the document actually declares, never a
// hardcoded list of expected keys, mirroring `buildTabSet`'s own rule of
// never writing down a document's structure as a constant in this file.
function renderChecklistMetaHtml(meta) {
  if (!meta || typeof meta !== "object") return "";
  const entries = Object.entries(meta);
  if (!entries.length) return "";
  const rows = entries
    .map(([key, value]) => `<p class="doc-description"><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value)}</p>`)
    .join("");
  return `<div class="checklist-meta">${rows}</div>`;
}

// Groups a (already lineIndex-sorted) list of loose-section items by
// `afterTc`, preserving the order each distinct `afterTc` first appears in
// (which is file order, since the input is sorted). Used twice by
// `renderLooseSectionsHtml` below: once for items that name a TC actually
// rendered above, once for orphans (specs.md §2.4's defensive case) — kept
// as two separate group lists rather than one, in different groups, so the
// caller can render all "real" groups before all orphan groups.
function groupByAfterTc(items) {
  const groups = [];
  const indexOf = new Map();
  for (const item of items) {
    if (!indexOf.has(item.afterTc)) {
      indexOf.set(item.afterTc, groups.length);
      groups.push({ afterTc: item.afterTc, items: [] });
    }
    groups[indexOf.get(item.afterTc)].items.push(item);
  }
  return groups;
}

// `parsed.looseSections` (`lib/checklist.js`'s `{ afterTc, lineIndex, text }`)
// rendered as `.loose-sections` — visually distinct from `.panel` (AC-07b):
// a dashed border and a `--warn`-tinted background, never `.panel`'s own
// class, so it never reads as an accented header of a normal TC panel.
// Grouped by `afterTc`, each group's items in ascending `lineIndex` order
// (file order); an item whose `afterTc` matches no rendered TC still
// renders, in its own group appended after every real group — never
// dropped (`lib/checklist.js`'s own "don't let it vanish silently"
// principle, carried into the UI per specs.md §2.4). Each `text` line is
// escaped but not markdown-parsed — read-only, like the rest of `.doc-panel`.
function renderLooseSectionsHtml(looseSections, tcs) {
  if (!Array.isArray(looseSections) || !looseSections.length) return "";

  const knownIds = new Set((tcs || []).map((tc) => tc.id));
  const sorted = [...looseSections].sort((a, b) => (a.lineIndex ?? 0) - (b.lineIndex ?? 0));
  const known = sorted.filter((item) => knownIds.has(item.afterTc));
  const orphan = sorted.filter((item) => !knownIds.has(item.afterTc));

  const groups = [
    ...groupByAfterTc(known),
    ...groupByAfterTc(orphan).map((group) => ({ ...group, orphan: true })),
  ];

  const groupsHtml = groups
    .map((group) => {
      const heading = group.orphan
        ? `Не найдено соответствие TC (${escapeHtml(group.afterTc)})`
        : `После ${escapeHtml(group.afterTc)}`;
      const itemsHtml = group.items.map((item) => `<li class="loose-item">${escapeHtml(item.text)}</li>`).join("");
      return (
        `<div class="loose-group"${group.orphan ? ' data-orphan="true"' : ""}>` +
        `<p class="loose-group-heading">${heading}</p>` +
        `<ul class="loose-items">${itemsHtml}</ul></div>`
      );
    })
    .join("");

  return (
    `<div class="loose-sections">` +
    `<h2 class="loose-sections-title">Дополнительные заметки</h2>` +
    `<p class="loose-sections-caption">нераспознанный текст между блоками чек-листа — не тест-кейс</p>` +
    `${groupsHtml}</div>`
  );
}

/**
 * The full render of `manual_test_checklist.md` inside the Tester role's
 * `.doc-panel` (specs.md §2.4, test_plan.md TC-030): every TC as a
 * `.panel` block, then — after the last one, never inside any TC block —
 * `.loose-sections` ("Дополнительные заметки") built from
 * `parsedChecklist.looseSections`, the field `GET .../issues/:id/checklist`
 * (`parseChecklist()`, `lib/checklist.js`) already returns today but this
 * screen previously never read.
 *
 * Pure by contract (TC-030's Preconditions): returns an HTML **string**
 * (or, for a falsy/malformed input, still a string) and only that — never
 * DOM nodes. Under `node --test` in this zero-dependency project there is
 * no `document.createElement`/DOM API at all, so a contract requiring built
 * nodes would be untestable here in principle; order within the returned
 * string is asserted by substring index of occurrence, not via DOM.
 *
 * @param {{meta?: Record<string, string>,
 *   tcs?: Array<{id: string, name?: string, prerequisites?: string[], requiredData?: string[],
 *     dataStatus?: string, steps?: Array, notesText?: string, parseWarnings?: string[]}>,
 *   looseSections?: Array<{afterTc: string, lineIndex: number, text: string}>}|null} parsedChecklist
 *   A `GET .../issues/:id/checklist` response.
 * @returns {string}
 */
export function renderChecklistPanel(parsedChecklist) {
  const tcs = Array.isArray(parsedChecklist && parsedChecklist.tcs) ? parsedChecklist.tcs : [];
  const looseSections = Array.isArray(parsedChecklist && parsedChecklist.looseSections) ? parsedChecklist.looseSections : [];
  const metaHtml = renderChecklistMetaHtml(parsedChecklist && parsedChecklist.meta);
  const tcPanelsHtml = tcs.map(renderTcPanelHtml).join("");
  const looseSectionsHtml = renderLooseSectionsHtml(looseSections, tcs);
  return metaHtml + tcPanelsHtml + looseSectionsHtml;
}

// ---------------------------------------------------------------------------
// localStorage helpers — best effort, mirroring the pattern this issue's
// other new screens already use: storage unavailable or full just means a
// choice doesn't persist across reloads, navigation still works either way.
// ---------------------------------------------------------------------------

function safeStorage(storage) {
  if (storage) return storage;
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export function readStoredRole(storage) {
  const store = safeStorage(storage);
  if (!store) return null;
  try {
    return store.getItem(ROLE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeRole(roleId, storage) {
  const store = safeStorage(storage);
  if (!store) return;
  try {
    store.setItem(ROLE_STORAGE_KEY, roleId);
  } catch {
    /* storage unavailable or full — role choice just won't persist */
  }
}

function storeLastIssue(project, issueId, storage) {
  const store = safeStorage(storage);
  if (!store || !project || !issueId) return;
  try {
    store.setItem(lastIssueStorageKey(project), issueId);
  } catch {
    /* storage unavailable or full — last-issue memory just won't persist */
  }
}

// ---------------------------------------------------------------------------
// Data — one call site per endpoint, each independently overridable for tests.
// ---------------------------------------------------------------------------

async function fetchJson(pathname, fetchImpl) {
  const doFetch = fetchImpl || fetch;
  const res = await doFetch(pathname);
  if (!res.ok) {
    throw new Error(`GET ${pathname} failed: ${res.status}${res.statusText ? " " + res.statusText : ""}`);
  }
  return res.json();
}

// Some of `server.js`'s error bodies are machine codes with no prose at all
// (`PATCH .../checklist/steps`'s 422 is just `{ error: "empty_result" }` —
// AC-05c's whole point is a check that previously did not exist, so there
// was never a message to write). Others already carry a human `message`
// (`requireCheckedOut`'s 409/404) and some encode the message directly as
// `error` text (the 400 "tcId (string) and step (number) are required").
// This map only overrides the codes known to be bare — everything else
// falls through to whatever the server actually said, so a future server
// error this map does not know about still reaches the reader as text
// instead of vanishing.
const CHECKLIST_PATCH_ERROR_MESSAGES = {
  empty_result: "Result notes can't be empty when marking a step as passed.",
  invalid_json_body: "The request body was not valid JSON.",
};

// PATCH counterpart of `fetchJson` — same "one call site per verb" shape,
// independently overridable via `fetchImpl` for tests. Unlike `fetchJson`
// this always tries to read a JSON body even on failure (`server.js`'s error
// responses are themselves JSON), so a rejected write can surface the
// server's own reason rather than just an HTTP status code (CR-001: the
// server-side validation added earlier must "surface as a clear, visible
// error in the UI — not silently swallowed").
async function patchJson(pathname, body, fetchImpl) {
  const doFetch = fetchImpl || fetch;
  const res = await doFetch(pathname, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no/invalid JSON body — data stays null, message falls back below */
  }
  if (!res.ok) {
    const message =
      (data && data.message) ||
      (data && CHECKLIST_PATCH_ERROR_MESSAGES[data.error]) ||
      (data && data.error) ||
      `PATCH ${pathname} failed: ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

// POST counterpart of `patchJson` — same shape and same reasoning (one call
// site per verb, `fetchImpl`-overridable, always tries to read a JSON error
// body, surfaces `data.message`/`data.error` rather than swallowing a
// rejection). Used by the "Дела" tab's complete/reassign actions below
// (`POST .../human-tasks/:key/complete`, `POST .../human-tasks/:key/reassign`
// — server.js, unchanged by this task): every error branch of both handlers
// already sets a human `message` in its JSON body, so — unlike
// `patchJson`'s `CHECKLIST_PATCH_ERROR_MESSAGES` map for a couple of bare
// checklist codes — there is no bare-code case here to override.
async function postJson(pathname, body, fetchImpl) {
  const doFetch = fetchImpl || fetch;
  const res = await doFetch(pathname, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no/invalid JSON body — data stays null, message falls back below */
  }
  if (!res.ok) {
    const message = (data && data.message) || (data && data.error) || `POST ${pathname} failed: ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

function projectBase(project) {
  return `/api/projects/${encodeURIComponent(project)}`;
}

function issueBase(project, issueId) {
  return `${projectBase(project)}/issues/${encodeURIComponent(issueId)}`;
}

// `GET .../issues/:id/checklist` — the structured `parseChecklist()` result
// (`server.js`), including `looseSections`, fed to `renderChecklistPanel`
// for the `manual_test_checklist` tab specifically (specs.md §2.4).
function checklistEndpointFor(project, issueId) {
  return `${issueBase(project, issueId)}/checklist`;
}

// `PATCH .../checklist/steps` / `PATCH .../checklist/notes` (server.js) —
// the two existing write routes this task wires the UI up to. Neither
// route/request shape changes here (implementation notes: `lib/checklist.js`
// and the server handlers are untouched); these are just the two matching
// client-side URLs, built the same way `checklistEndpointFor` already is.
function checklistStepsEndpoint(project, issueId) {
  return `${checklistEndpointFor(project, issueId)}/steps`;
}
function checklistNotesEndpoint(project, issueId) {
  return `${checklistEndpointFor(project, issueId)}/notes`;
}

// `GET .../issues/:id/human-tasks` (server.js, Task 10) — every `roles.<key>`
// pair of this issue resolving to a human actor, `queued` or `stale`
// (`lib/inbox.js`'s `collectHumanTasksForIssue`). The "Дела" tab's one list
// endpoint (Task 30, CR-002 fix); also this module's own identity for that
// tab in `activeEndpoint()` below, so a late response after the reader has
// switched away is never painted into a panel that's no longer live.
function humanTasksListEndpoint(project, issueId) {
  return `${issueBase(project, issueId)}/human-tasks`;
}

// `POST .../human-tasks/:key/complete` / `POST .../human-tasks/:key/reassign`
// (server.js, Tasks 11/12 — untouched by this task): the two writes the
// "Дела" tab's own actions call. `key` is always one of `roles:`'s pipeline
// keys (`stageKey` on a fetched task), never client-composed from anything
// else.
function humanTaskCompleteEndpoint(project, issueId, key) {
  return `${humanTasksListEndpoint(project, issueId)}/${encodeURIComponent(key)}/complete`;
}
function humanTaskReassignEndpoint(project, issueId, key) {
  return `${humanTasksListEndpoint(project, issueId)}/${encodeURIComponent(key)}/reassign`;
}

// `GET .../docs?path=docs/planning/agents.yml` — the one generic
// project-document read route (`server.js`'s `parts.length === 4 &&
// parts[3] === "docs"`) this module reuses rather than adding a
// project-explorer-specific "list actors" endpoint for one dropdown.
// `parseActorNames` above turns the raw YAML text this returns into the
// "Отдать агенту" dropdown's option list.
function agentsYamlEndpoint(project) {
  return `${projectBase(project)}/docs?path=${encodeURIComponent("docs/planning/agents.yml")}`;
}

async function fetchRoles(fetchImpl) {
  const data = await fetchJson("/api/roles", fetchImpl);
  return data.roles || [];
}

async function fetchIssues(project, fetchImpl) {
  const data = await fetchJson(`${projectBase(project)}/issues`, fetchImpl);
  return (data && data.issues) || [];
}

// The single call site of `GET .../issues/:id/roles/:role` in this module
// (test_plan.md TC-002 step 2/3) — every doc tab and its state comes from
// this one response, for whichever (issue, role) pair is currently selected.
async function fetchRoleContents(project, issueId, roleId, fetchImpl) {
  return fetchJson(`${issueBase(project, issueId)}/roles/${encodeURIComponent(roleId)}`, fetchImpl);
}

// GET /api/inbox — the same project-independent endpoint
// `public/inbox.js`'s global inbox screen calls (specs.md §3.4). Its own
// URL carries no project/issue/role — `mount()` below fetches it exactly
// once per mount (`fetchInboxOnce`) and reuses the response for
// `countProjectTodos` across every `[Роль ▾]`/`[Issue ▾]` switch (AC-06b,
// TC-029 step 4).
async function fetchInbox(fetchImpl) {
  return fetchJson("/api/inbox", fetchImpl);
}

// ---------------------------------------------------------------------------
// DOM rendering
// ---------------------------------------------------------------------------

function h(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function renderHeader(state, handlers) {
  const header = h("header", "workspace-header");

  const back = h("a", "workspace-back", "← Проекты");
  back.href = "#/";
  back.addEventListener("click", (event) => {
    event.preventDefault();
    handlers.onBack();
  });
  header.appendChild(back);

  header.appendChild(h("span", "workspace-project", state.project || ""));

  const issueField = h("label", "workspace-field workspace-field--issue");
  issueField.appendChild(h("span", "field-label", "Issue"));
  const issueSelect = document.createElement("select");
  issueSelect.className = "issue-select";
  issueSelect.setAttribute("aria-label", "Issue ▾");
  for (const issue of state.issues) {
    const opt = document.createElement("option");
    opt.value = issue.issueId;
    opt.textContent = issue.issueId;
    if (issue.issueId === state.issueId) opt.selected = true;
    issueSelect.appendChild(opt);
  }
  issueSelect.disabled = state.issues.length === 0;
  issueSelect.addEventListener("change", () => handlers.onSelectIssue(issueSelect.value));
  issueField.appendChild(issueSelect);
  header.appendChild(issueField);

  const roleField = h("label", "workspace-field workspace-field--role");
  roleField.appendChild(h("span", "field-label", "Роль"));
  const roleSelect = document.createElement("select");
  roleSelect.className = "role-select";
  roleSelect.setAttribute("aria-label", "Роль ▾");
  for (const role of state.roles) {
    const opt = document.createElement("option");
    opt.value = role.id;
    opt.textContent = role.title;
    if (role.id === state.roleId) opt.selected = true;
    roleSelect.appendChild(opt);
  }
  roleSelect.disabled = state.roles.length === 0;
  roleSelect.addEventListener("change", () => handlers.onSelectRole(roleSelect.value));
  roleField.appendChild(roleSelect);
  header.appendChild(roleField);

  return header;
}

function renderTabs(state, handlers) {
  const tabs = h("nav", "doc-tabs");
  tabs.setAttribute("aria-label", "Документы роли");
  for (const tab of state.tabs) {
    const active = tab.id === state.activeTabId;
    const btn = h("button", `doc-tab${active ? " doc-tab--active" : ""}`, tab.label);
    btn.type = "button";
    btn.dataset.tabId = tab.id;
    btn.dataset.tabKind = tab.kind;
    btn.setAttribute("aria-pressed", String(active));
    btn.addEventListener("click", () => handlers.onSelectTab(tab.id));
    tabs.appendChild(btn);
  }
  return tabs;
}

// The short status word next to a doc tab's title, straight from what the
// server already decided (`buildRoleContents`) — this module picks how to
// say it, not whether it is true.
function statusBadgeText(item) {
  if (!item) return null;
  if (item.status === "present") return item.location === "branch" ? "on branch" : null;
  if (item.status === "not_applicable") return "n/a";
  if (item.status === "missing") return "missing";
  return null;
}

// ---------------------------------------------------------------------------
// Checklist write UI (Task 29, CR-001 fix) — real, interactive DOM nodes.
//
// Deliberately NOT part of `renderChecklistPanel`/`renderTcPanelHtml` above:
// those stay pure functions returning an HTML **string** (TC-030's
// Preconditions, asserted by test/workspace-ui.test.js and
// test/workspace.test.js), and a `click`/`change` handler cannot be
// serialized into a string — it is a closure, not markup. These functions
// build real nodes with `document.createElement`/`addEventListener`
// instead, the same convention `renderHeader`/`renderTabs` above already use
// for their own interactive controls (the `[Issue ▾]`/`[Роль ▾]` selects),
// and are testable the same way those are — via a fake `document` and
// `dispatchClick`/`dispatchChange`, not by parsing an HTML string.
// ---------------------------------------------------------------------------

// One step's Result cell: a checkbox (`checked`), a note `<textarea>`, a
// Save button and a status/error span — the fix for CR-001's literal
// complaint ("zero interactive elements — no `<input>`, no click/change
// handler"). A per-row Save button, not a `change` listener firing on every
// keystroke/tick: `checked: true` with an empty note is rejected server-side
// (AC-05c) — firing a PATCH per keystroke would mean a 422 on every
// intermediate state while the tester is still typing the note, not just the
// deliberate save this button represents. This also maps 1:1 onto
// test_plan.md TC-023 steps 5 (empty note, checked, rejected) and 6 (same
// call with a note, accepted).
function buildStepRow(tc, step, handlers) {
  const row = h("tr", "checklist-step-row");
  row.dataset.tcId = tc.id;
  row.dataset.step = String(step.step);
  row.appendChild(h("td", null, String(step.step)));
  row.appendChild(h("td", null, step.action || ""));
  row.appendChild(h("td", null, step.expected || ""));

  const resultCell = h("td", "step-result-cell");

  const checkLabel = h("label", "step-check-label");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "step-checkbox";
  checkbox.checked = !!step.checked;
  checkbox.dataset.tcId = tc.id;
  checkbox.dataset.step = String(step.step);
  checkLabel.appendChild(checkbox);
  checkLabel.appendChild(h("span", null, " Passed"));
  resultCell.appendChild(checkLabel);

  const noteInput = document.createElement("textarea");
  noteInput.className = "step-note-input";
  noteInput.rows = 2;
  noteInput.placeholder = "Result notes";
  noteInput.value = step.note || "";
  noteInput.dataset.tcId = tc.id;
  noteInput.dataset.step = String(step.step);
  resultCell.appendChild(noteInput);

  const statusEl = h("span", "step-save-status");
  statusEl.setAttribute("aria-live", "polite");

  const saveBtn = h("button", "step-save-btn", "Save");
  saveBtn.type = "button";
  saveBtn.dataset.tcId = tc.id;
  saveBtn.dataset.step = String(step.step);
  saveBtn.addEventListener("click", () => {
    handlers.onSaveStep({ tc, step, checkbox, noteInput, statusEl, saveBtn });
  });
  resultCell.appendChild(saveBtn);
  resultCell.appendChild(statusEl);

  row.appendChild(resultCell);
  return row;
}

// The full interactive steps table for one TC — `null` when the TC has no
// steps at all (mirrors `renderTcPanelHtml`'s own pre-Task-29
// `steps.length ? table : ""` guard, just returning a node-or-null instead
// of a string-or-"").
function buildStepsTableNode(tc, handlers) {
  const steps = Array.isArray(tc.steps) ? tc.steps : [];
  if (!steps.length) return null;

  const table = h("table", "panel-table checklist-steps-table");
  table.dataset.tcId = tc.id;
  const thead = h("thead");
  const headRow = h("tr");
  for (const label of ["Step", "Action", "Expected", "Result"]) headRow.appendChild(h("th", null, label));
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = h("tbody");
  for (const step of steps) tbody.appendChild(buildStepRow(tc, step, handlers));
  table.appendChild(tbody);
  return table;
}

// The TC-level free-text Notes editor (`patchNotes`/`PATCH .../checklist/notes`
// — distinct from a step's own Result note, which goes through
// `PATCH .../checklist/steps` above). Gated on `tc.notesLineIndex` rather
// than on `tc.notesText`: `patchNotes` (`lib/checklist.js`) throws
// `"<tcId> has no **Notes:** line to patch"` when a TC's source markdown
// never had a `**Notes:**` line at all, and `server.js`'s route turns that
// into a 400 with the raw exception text — offering an editor that can only
// ever fail like that would be worse than not offering one. `notesLineIndex`
// is `null` in exactly that case (present-but-empty is a real line with an
// empty value, still patchable) — the same "unknown"-vs-"none" distinction
// `renderTestDataHtml` already draws for a different field, applied here.
function buildNotesEditorNode(tc, handlers) {
  if (tc.notesLineIndex === null || tc.notesLineIndex === undefined) return null;

  const wrap = h("div", "tc-notes-editor");
  wrap.dataset.tcId = tc.id;
  wrap.appendChild(h("strong", null, "Notes (edit):"));

  const textarea = document.createElement("textarea");
  textarea.className = "tc-notes-input";
  textarea.rows = 2;
  textarea.placeholder = "Notes";
  textarea.value = tc.notesText || "";
  textarea.dataset.tcId = tc.id;
  wrap.appendChild(textarea);

  const statusEl = h("span", "tc-notes-status");
  statusEl.setAttribute("aria-live", "polite");

  const saveBtn = h("button", "tc-notes-save-btn", "Save notes");
  saveBtn.type = "button";
  saveBtn.dataset.tcId = tc.id;
  saveBtn.addEventListener("click", () => {
    handlers.onSaveNotes({ tc, textarea, statusEl, saveBtn });
  });
  wrap.appendChild(saveBtn);
  wrap.appendChild(statusEl);
  return wrap;
}

// Shared by the checklist write UI below AND the "Дела" tab's human-task
// actions (`buildHumanTasksHandlers`) — both are "click Save/Завершить,
// see Saving…/Saved/a visible error in the same status span" flows, so one
// function, not two drifting copies. Not renamed to something checklist-
// specific: the name predates the human-tasks UI, kept generic on purpose.
function setActionStatus(el, text, isError) {
  el.textContent = text;
  el.className = `${el.className.split(" ")[0]}${isError ? " error" : ""}`;
}

// The two write handlers `buildStepRow`/`buildNotesEditorNode`'s Save
// buttons call. `runtime` carries exactly what a write needs: `project`/
// `issueId` (to build the PATCH URL, `checklistStepsEndpoint`/
// `checklistNotesEndpoint` above), `fetchImpl` (test override, same as every
// other fetch in this module) and `invalidateDoc` (targeted cache
// invalidation — see `mount()`'s `docCache`/`invalidateDoc` below).
//
// On success: mutates the in-memory `tc`/`step` object the caller already
// holds (so a later re-render of *this* mount from that same object reflects
// the write) and updates the two DOM controls directly from the values just
// sent — not from a re-fetch, which is the "without a full document reload"
// half of this task. `invalidateDoc` still runs, so a *later* fresh fetch of
// this same document (a tab revisit, `refresh()`, another mount) is not
// served the pre-write cached response.
//
// On failure: the server's own message (`patchJson`'s error-mapping above)
// lands in the status span as visible text — never a silently swallowed
// rejection (CR-001's "not silently swallowed"). The checkbox/textarea are
// left exactly as the tester set them, so fixing an empty Result and
// clicking Save again (TC-023 step 6, right after step 5's rejection) does
// not require re-entering anything.
function buildChecklistWriteHandlers(runtime) {
  return {
    async onSaveStep({ tc, step, checkbox, noteInput, statusEl, saveBtn }) {
      const checked = !!checkbox.checked;
      const note = noteInput.value || "";
      setActionStatus(statusEl, "Saving…", false);
      saveBtn.disabled = true;
      try {
        await patchJson(
          checklistStepsEndpoint(runtime.project, runtime.issueId),
          { tcId: tc.id, step: step.step, checked, note },
          runtime.fetchImpl
        );
        step.checked = checked;
        step.note = note;
        runtime.invalidateDoc(runtime.checklistEndpoint);
        setActionStatus(statusEl, "Saved", false);
      } catch (err) {
        setActionStatus(statusEl, err.message, true);
      } finally {
        saveBtn.disabled = false;
      }
    },
    async onSaveNotes({ tc, textarea, statusEl, saveBtn }) {
      const notesText = textarea.value || "";
      setActionStatus(statusEl, "Saving…", false);
      saveBtn.disabled = true;
      try {
        await patchJson(
          checklistNotesEndpoint(runtime.project, runtime.issueId),
          { tcId: tc.id, notesText },
          runtime.fetchImpl
        );
        tc.notesText = notesText;
        runtime.invalidateDoc(runtime.checklistEndpoint);
        setActionStatus(statusEl, "Saved", false);
      } catch (err) {
        setActionStatus(statusEl, err.message, true);
      } finally {
        saveBtn.disabled = false;
      }
    },
  };
}

// The checklist tab's full body: reuses the exact same pure sub-pieces
// `renderChecklistPanel` itself composes (`renderChecklistMetaHtml`,
// `renderTcPanelHtml`, `renderLooseSectionsHtml`) — not a second, drifting
// implementation of the same rendering — but interleaves each TC's real
// interactive steps table/notes editor right after that TC's own read-only
// `.panel`, instead of `renderChecklistPanel`'s single concatenated string
// (which has no seam to interleave nodes into after the fact — see the
// comment above `buildStepRow`). `container` is cleared and rebuilt from
// scratch each call; call sites use `runtime.invalidateDoc` + a fresh
// `fetchDoc` when they actually need a full reload, not this function.
function renderChecklistBody(container, parsedChecklist, runtime) {
  container.innerHTML = "";
  const tcs = Array.isArray(parsedChecklist && parsedChecklist.tcs) ? parsedChecklist.tcs : [];
  const looseSections = Array.isArray(parsedChecklist && parsedChecklist.looseSections) ? parsedChecklist.looseSections : [];

  const metaWrap = h("div", "checklist-meta-wrap");
  metaWrap.innerHTML = renderChecklistMetaHtml(parsedChecklist && parsedChecklist.meta);
  container.appendChild(metaWrap);

  const handlers = buildChecklistWriteHandlers(runtime);

  for (const tc of tcs) {
    const tcWrap = h("div", "tc-wrap");
    tcWrap.dataset.tcId = tc.id;

    const infoWrap = h("div", "tc-info-wrap");
    infoWrap.innerHTML = renderTcPanelHtml(tc);
    tcWrap.appendChild(infoWrap);

    const stepsTable = buildStepsTableNode(tc, handlers);
    if (stepsTable) tcWrap.appendChild(stepsTable);

    const notesEditor = buildNotesEditorNode(tc, handlers);
    if (notesEditor) tcWrap.appendChild(notesEditor);

    container.appendChild(tcWrap);
  }

  const looseWrap = h("div", "loose-sections-wrap");
  looseWrap.innerHTML = renderLooseSectionsHtml(looseSections, tcs);
  container.appendChild(looseWrap);
}

// ---------------------------------------------------------------------------
// "Дела" (human-tasks) tab UI (Task 30, CR-002 fix — code_review.md).
//
// Round-1 `/pf-codereview` found this tab was a pure stub, even though its
// server-side API is fully implemented and tested: `GET .../human-tasks`
// (Task 10), `POST .../human-tasks/:key/complete` (Task 11), `POST
// .../human-tasks/:key/reassign` (Task 12). This section is the real UI:
// the task queue itself, a "Завершить" action per task (a `verdict` input
// for `operation: "review"` items, a plain confirmation button for
// `operation: "write"` items — document keys and code/tests alike, per
// AC-05c/AC-05d/AC-05e's three verification paths server-side), and the one
// "Отдать агенту" hand-off action (AC-05g/AC-05j) this whole UI offers an
// actor picker for — `test/readonly.test.js`'s AC-05j grep check verifies no
// second one exists anywhere in `public/*.js`.
//
// Real, interactive DOM nodes — the same convention the checklist write UI
// above (`buildStepRow`/`buildNotesEditorNode`) already established for
// this file's non-pure, click/change-driven pieces.
// ---------------------------------------------------------------------------

// One task row: stageKey/operation/instruction/status, a "Завершить" action,
// and the "Отдать агенту" hand-off action. `actorNames` is already resolved
// (`parseActorNames` of `docs/planning/agents.yml`'s `actors:` block) by the
// caller — this function only builds the `<select>` from it.
function buildHumanTaskRow(task, actorNames, handlers) {
  const row = h("div", "human-task-row");
  row.dataset.stageKey = task.stageKey;

  const header = h("div", "human-task-header");
  header.appendChild(h("span", "human-task-key", task.stageKey));
  header.appendChild(h("span", "human-task-operation", `(${task.operation})`));
  // `queued` is the default, unremarkable state — only `stale` (specs.md
  // §4.2/AC-05f/M5: the artifact changed since it was last marked done) gets
  // a badge, the same `.badge` class doc tabs already use for their own
  // status word (`statusBadgeText`), not a second status-badge class.
  if (task.status === "stale") header.appendChild(h("span", "badge", "stale"));
  row.appendChild(header);

  if (task.instruction) row.appendChild(h("p", "human-task-instruction", task.instruction));

  const actions = h("div", "human-task-actions");

  // "Завершить" (complete) — a `verdict` text input for `operation: "review"`
  // (AC-05c: any non-empty text after trim, e.g. "замечаний нет", is valid —
  // this UI does not further judge the content, `handleHumanTaskComplete`
  // server-side is the one authority on what counts as done), a plain
  // confirmation button with no extra input for `operation: "write"` (both
  // the six document keys and `code`/`tests` — server.js's three
  // verification paths decide the rest; this UI only has to send the right
  // request body shape for each).
  const completeWrap = h("div", "human-task-complete-wrap");
  let verdictInput = null;
  if (task.operation === "review") {
    verdictInput = document.createElement("input");
    verdictInput.type = "text";
    verdictInput.className = "human-task-verdict-input";
    verdictInput.placeholder = "Verdict";
    completeWrap.appendChild(verdictInput);
  }
  const completeStatus = h("span", "human-task-complete-status");
  completeStatus.setAttribute("aria-live", "polite");
  const completeBtn = h("button", "human-task-complete-btn", "Завершить");
  completeBtn.type = "button";
  completeBtn.addEventListener("click", () => {
    handlers.onComplete({ task, verdictInput, statusEl: completeStatus, button: completeBtn });
  });
  completeWrap.appendChild(completeBtn);
  completeWrap.appendChild(completeStatus);
  actions.appendChild(completeWrap);

  // "Отдать агенту" (hand-off) — AC-05g/AC-05j: the ONLY actor-picker
  // control anywhere in this UI, not a general actor/role-assignment
  // wizard — one dropdown, built from `agents.yml`'s own `actors:` list,
  // scoped to this one already-queued human task. Calls
  // `POST .../human-tasks/:key/reassign` (server.js, Task 12, unchanged).
  const reassignWrap = h("div", "human-task-reassign-wrap");
  const actorSelect = document.createElement("select");
  actorSelect.className = "human-task-actor-select";
  actorSelect.setAttribute("aria-label", "Актор");
  for (const name of actorNames) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    actorSelect.appendChild(opt);
  }
  // No known actor to hand off to (e.g. a project whose agents.yml hasn't
  // been created yet) disables the control rather than offering an empty
  // selection that would 422 (`unknown_actor`) on every click.
  actorSelect.disabled = actorNames.length === 0;
  reassignWrap.appendChild(actorSelect);
  const reassignStatus = h("span", "human-task-reassign-status");
  reassignStatus.setAttribute("aria-live", "polite");
  const reassignBtn = h("button", "human-task-reassign-btn", "Отдать агенту");
  reassignBtn.type = "button";
  reassignBtn.disabled = actorNames.length === 0;
  reassignBtn.addEventListener("click", () => {
    handlers.onReassign({ task, actorSelect, statusEl: reassignStatus, button: reassignBtn });
  });
  reassignWrap.appendChild(reassignBtn);
  reassignWrap.appendChild(reassignStatus);
  actions.appendChild(reassignWrap);

  row.appendChild(actions);
  return row;
}

// The two write handlers `buildHumanTaskRow`'s buttons call — same shape as
// `buildChecklistWriteHandlers` above (Saving…/success/visible-error status
// text via `setActionStatus`, button disabled while in flight, the server's
// own error message surfaced verbatim rather than swallowed, CR-001's
// pattern applied here too). `reload` re-fetches and re-renders the whole
// task list after a successful action (this tab's own "fresh GET .../
// human-tasks" refresh, per this task's implementation notes) — simpler and
// more robust than an optimistic single-row removal, since a `complete` can
// also flip a *different* task's status (none today, but nothing here
// assumes otherwise) and a `reassign` does not remove a task from the queue
// at all (only complete does).
function buildHumanTasksHandlers(runtime, reload) {
  return {
    async onComplete({ task, verdictInput, statusEl, button }) {
      const body = task.operation === "review" ? { verdict: verdictInput ? verdictInput.value || "" : "" } : {};
      setActionStatus(statusEl, "Saving…", false);
      button.disabled = true;
      try {
        await postJson(humanTaskCompleteEndpoint(runtime.project, runtime.issueId, task.stageKey), body, runtime.fetchImpl);
        setActionStatus(statusEl, "Done", false);
        await reload();
      } catch (err) {
        setActionStatus(statusEl, err.message, true);
        button.disabled = false;
      }
    },
    async onReassign({ task, actorSelect, statusEl, button }) {
      const actor = actorSelect.value || "";
      setActionStatus(statusEl, "Saving…", false);
      button.disabled = true;
      try {
        await postJson(humanTaskReassignEndpoint(runtime.project, runtime.issueId, task.stageKey), { actor }, runtime.fetchImpl);
        setActionStatus(statusEl, "Reassigned", false);
        await reload();
      } catch (err) {
        setActionStatus(statusEl, err.message, true);
        button.disabled = false;
      }
    },
  };
}

// `body`'s full contents for the current (tasks, actorNames) pair — cleared
// and rebuilt from scratch each call, same convention `renderChecklistBody`
// above uses. An empty queue renders a plain message, never a blank pane
// indistinguishable from "still loading".
function renderHumanTasksBody(body, tasks, actorNames, runtime, reload) {
  body.innerHTML = "";
  if (!tasks.length) {
    body.appendChild(h("p", "muted human-tasks-empty", "Нет задач для этой issue."));
    return;
  }
  const handlers = buildHumanTasksHandlers(runtime, reload);
  const list = h("div", "human-tasks-list");
  for (const task of tasks) list.appendChild(buildHumanTaskRow(task, actorNames, handlers));
  body.appendChild(list);
}

// The "Дела" tab's async load + (re)render — the counterpart of the doc-tab
// `fetchDoc().then(...)` pattern below, but fetching TWO things in parallel
// (the task list itself, and `agents.yml`'s raw text for the hand-off
// dropdown) via `Promise.allSettled`: a project that has no `agents.yml` yet
// must still show the task queue (with hand-off degraded to a disabled,
// empty dropdown), not fail the whole tab over one missing config file.
//
// Guarded by `runtime.getActiveEndpoint()` exactly like every other async
// render in this file (`humanTasksListEndpoint` is this tab's own identity
// there — see `activeEndpoint()` in `mount()`) — a reader who switched away
// from "Дела" (or to a different issue) while this was in flight must never
// have a late response painted into a panel that's no longer live.
//
// `reload` (passed to `renderHumanTasksBody`/`buildHumanTasksHandlers`)
// invalidates the cached list fetch and calls this function again — a
// *fresh* `GET .../human-tasks` after a successful complete/reassign, not a
// full document/page reload, matching this task's implementation notes.
function loadAndRenderHumanTasks(body, runtime) {
  const tasksEndpoint = humanTasksListEndpoint(runtime.project, runtime.issueId);
  const agentsEndpoint = agentsYamlEndpoint(runtime.project);

  const reload = () => {
    runtime.invalidateDoc(tasksEndpoint);
    return loadAndRenderHumanTasks(body, runtime);
  };

  return Promise.allSettled([runtime.fetchDoc(tasksEndpoint), runtime.fetchDoc(agentsEndpoint)]).then(
    ([tasksResult, agentsResult]) => {
      if (runtime.getActiveEndpoint() !== tasksEndpoint) return; // reader moved on while it loaded

      if (tasksResult.status === "rejected") {
        body.innerHTML = "";
        body.appendChild(h("p", "notice error", tasksResult.reason.message));
        return;
      }

      const tasks = Array.isArray(tasksResult.value) ? tasksResult.value : [];
      const actorNames =
        agentsResult.status === "fulfilled" ? parseActorNames(agentsResult.value && agentsResult.value.content) : [];
      renderHumanTasksBody(body, tasks, actorNames, runtime, reload);
    }
  );
}

// The active tab's content pane. A doc tab shows the server's own header
// fields plus, when the document is actually `present`, its fetched
// content; the "Дела" tab's counter is real as of Task 25 (`tab.label`
// already carries it — see `decorateHumanTasksTab` in `mount()`) and its
// content is the full human-task queue UI above (Task 30, CR-002 fix — the
// tab used to stop here with a placeholder). Kinds this screen does not yet
// have a dedicated pane for (`instructions`/`memory`/`action`) still show
// the server's own header fields, just without a richer body — none of that
// is in TC-002/TC-003's scope.
function renderDocPanel(tab, runtime) {
  const panel = h("div", "doc-panel");
  panel.dataset.tabId = tab.id;

  if (tab.kind === "human-tasks") {
    panel.appendChild(h("h2", null, tab.label));
    const body = h("div", "human-tasks-body");
    body.appendChild(h("p", "muted", "Загрузка…"));
    panel.appendChild(body);
    loadAndRenderHumanTasks(body, runtime);
    return panel;
  }

  const item = tab.item;
  if (!item) {
    panel.appendChild(h("p", "muted", "Нет данных."));
    return panel;
  }

  const titleRow = h("div", "doc-title-row");
  titleRow.appendChild(h("h2", null, item.label || item.name || item.id));
  const badgeText = statusBadgeText(item);
  if (badgeText) titleRow.appendChild(h("span", "badge", badgeText));
  panel.appendChild(titleRow);

  if (item.name) panel.appendChild(h("code", "doc-path", item.name));
  if (item.description) panel.appendChild(h("p", "doc-description", item.description));
  if (item.message) panel.appendChild(h("p", "notice", item.message));

  // manual_test_checklist.md gets the structured render (`renderChecklistPanel`
  // above), not the generic raw-markdown path below: `GET .../checklist`
  // instead of `item.endpoint`, so `looseSections` — a field that endpoint
  // already returns but this screen never read before this task — actually
  // reaches the reader (specs.md §2.4).
  if (tab.id === CHECKLIST_DOC_ID && item.status === "present" && runtime.checklistEndpoint) {
    const body = h("div", "checklist-body");
    body.appendChild(h("p", "muted", "Загрузка…"));
    panel.appendChild(body);

    const endpoint = runtime.checklistEndpoint;
    runtime
      .fetchDoc(endpoint)
      .then((data) => {
        if (runtime.getActiveEndpoint() !== endpoint) return; // reader moved on while it loaded
        renderChecklistBody(body, data, runtime);
        // CR-005 fix: an inbox manual-TC click's `ptcId` (Task 33) — scroll
        // the corresponding `.panel[data-tc-id="..."]` into view once the
        // checklist has actually rendered. `runtime.tryScrollToInitialPtcId`
        // is one-shot and self-guarding (see `mount()`) — safe to call on
        // every checklist render, including a later tab revisit, since it is
        // a no-op after the first landing.
        if (typeof runtime.tryScrollToInitialPtcId === "function") {
          runtime.tryScrollToInitialPtcId(body);
        }
      })
      .catch((err) => {
        if (runtime.getActiveEndpoint() !== endpoint) return;
        body.innerHTML = "";
        body.appendChild(h("p", "notice error", err.message));
      });
    return panel;
  }

  const readableKind = item.kind === "issue_doc" || item.kind === "project_doc";
  if (readableKind && item.status === "present" && item.endpoint) {
    const body = h("div", "md-body");
    body.appendChild(h("p", "muted", "Загрузка…"));
    panel.appendChild(body);

    // Guarded by the *endpoint*, not `tab.id`: tab ids are the role's
    // document names stripped of ".md" (`tabIdFor`), which are the same
    // string across different issues within one role by design (that is
    // what makes `resolveActiveTab` able to "keep the tab" across an issue
    // switch) — so `tab.id` alone cannot tell issue A's in-flight fetch from
    // issue B's. `item.endpoint` encodes project+issue+path, so it always
    // can. `runtime.fetchDoc` also dedupes repeat renders of the same
    // endpoint (an issue switch calls `render()` twice — see `selectIssue`).
    const endpoint = item.endpoint;
    runtime
      .fetchDoc(endpoint)
      .then((data) => {
        if (runtime.getActiveEndpoint() !== endpoint) return; // reader moved on while it loaded
        body.innerHTML = "";
        const text = data && typeof data.content === "string" ? data.content : "";
        if (!text.trim()) {
          body.appendChild(h("p", "muted", "This document is empty."));
        } else if (typeof window !== "undefined" && window.PFMarkdown) {
          body.innerHTML = window.PFMarkdown.render(text);
        } else {
          body.textContent = text;
        }
      })
      .catch((err) => {
        if (runtime.getActiveEndpoint() !== endpoint) return;
        body.innerHTML = "";
        body.appendChild(h("p", "notice error", err.message));
      });
  }

  return panel;
}

// One-shot, best-effort scroll to a checklist TC panel (CR-005 fix, Task 33:
// an inbox manual-TC click's `ptcId` reaching the checklist tab). `container`
// is the checklist tab's own `.checklist-body` node — real in a browser,
// a `querySelector`-less stand-in under `node --test`'s fake DOM
// (test/workspace-ui.test.js's `FakeElement`), so both `querySelector` and
// `scrollIntoView` are feature-detected rather than assumed: landing on the
// right TAB is this task's primary fix (see the module-level Task 33 comment
// group), this scroll is strictly a nice-to-have on top of it and must never
// throw if the DOM doesn't support it.
function maybeScrollToPtcId(container, ptcId) {
  if (!ptcId || !container || typeof container.querySelector !== "function") return;
  let el = null;
  try {
    el = container.querySelector(`[data-tc-id="${String(ptcId).replace(/"/g, '\\"')}"]`);
  } catch {
    return; // malformed selector (e.g. an id containing characters the query can't express) — skip, don't throw
  }
  if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "start" });
}

/**
 * Mount the level-2 workspace screen into `container` (an already-attached
 * DOM node — this module never inserts itself into `document.body`, matching
 * every other screen in this tool).
 *
 * `options.roleId` is intentionally not required: `public/app.js`'s router
 * only ever hands this screen `{project, issueId, onNavigate}` plus,
 * starting with the CR-005 fix (Task 33), the initial-landing extras below —
 * so the initial role comes from `options.initialRole`, then `localStorage`'s
 * `pf.role`, then the first role the server lists — the same fallback chain
 * `public/launcher.js` uses. `options.initialTab`/`options.initialPtcId`
 * come from an inbox item's `where` (`public/inbox.js`), forwarded through
 * `app.js`'s hash query string: `initialTab` is applied once the FIRST
 * `buildTabSet()` of this mount resolves (a manual-TC click's `where.doc` or
 * a human-task click's `where.tab`, normalized through the same `tabIdFor`
 * rule every doc tab id already follows), `initialPtcId` scrolls the
 * checklist tab's matching `.panel[data-tc-id]` into view once that tab has
 * actually rendered (`maybeScrollToPtcId` above) — both apply ONLY on this
 * mount's initial landing, never on a later role/issue switch within the
 * same mount (`selectRole`/`selectIssue` never re-consult them).
 *
 * @param {Element} container
 * @param {{project: string, issueId?: string|null, initialRole?: string,
 *   initialTab?: string, initialPtcId?: string,
 *   fetchImpl?: typeof fetch, storage?: Storage,
 *   onNavigate?: (hash: string) => void}} options
 * @returns {{selectIssue: (issueId: string) => Promise<void>,
 *   selectRole: (roleId: string) => Promise<void>,
 *   selectTab: (tabId: string) => void,
 *   refresh: () => Promise<void>, getState: () => object, ready: Promise<void>}}
 */
export function mount(container, options = {}) {
  const state = {
    project: options.project || null,
    issueId: options.issueId || null,
    roleId: options.initialRole || readStoredRole(options.storage) || null,
    roles: [],
    issues: [],
    tabs: [],
    activeTabId: null,
    error: null,
    // The "Дела" tab's project-wide counter (`countProjectTodos`, AC-06a) —
    // `null` until `/api/inbox` first resolves, then a number for the rest
    // of this mount's lifetime (a project never changes within one mount).
    projectTodoCount: null,
  };

  // CR-005 fix (Task 33) — both one-shot, applied only on this mount's
  // initial landing (never on a later `selectRole`/`selectIssue`):
  //   * `initialTabApplied` flips true the first time `loadRoleContents()`
  //     actually resolves a tab set (its success path only — see
  //     `loadRoleContents` below), so a first-load fetch failure does not
  //     burn `options.initialTab` before it ever had a tab set to apply to.
  //   * `initialPtcIdConsumed` starts already-true when there is no
  //     `options.initialPtcId` to begin with (nothing to consume), so
  //     `tryScrollToInitialPtcId` is a guaranteed no-op for every mount that
  //     didn't ask for one, at negligible cost.
  let initialTabApplied = false;
  let initialPtcIdConsumed = !options.initialPtcId;
  function tryScrollToInitialPtcId(checklistContainer) {
    if (initialPtcIdConsumed) return;
    initialPtcIdConsumed = true; // one-shot regardless of whether the panel was actually found
    maybeScrollToPtcId(checklistContainer, options.initialPtcId);
  }

  function navigate(hash) {
    if (typeof options.onNavigate === "function") {
      options.onNavigate(hash);
      return;
    }
    if (typeof location !== "undefined") location.hash = hash;
  }

  function onBack() {
    navigate("#/");
  }

  // Endpoint -> in-flight/resolved fetch, so re-rendering the same document
  // (an issue switch renders twice — see `selectIssue`) never issues a
  // second request for it, and so a document's own endpoint — not `tab.id`,
  // which is intentionally shared across issues — is what decides whether a
  // response arriving late is still the one the panel wants to paint.
  const docCache = new Map();
  function fetchDoc(endpoint) {
    if (!docCache.has(endpoint)) docCache.set(endpoint, fetchJson(endpoint, options.fetchImpl));
    return docCache.get(endpoint);
  }
  // Targeted invalidation for exactly one document's cached fetch, after a
  // successful checklist write (`buildChecklistWriteHandlers` above) — not
  // a full `docCache.clear()`, which would also throw away every other doc
  // tab's already-resolved fetch for no reason. The write itself already
  // updated the in-memory object the currently-rendered panel is showing
  // (no full document reload needed for *this* render); this only makes
  // sure a *later* fetch of the same endpoint — a tab revisit, `refresh()`,
  // another mount — is not served the pre-write cached promise.
  function invalidateDoc(endpoint) {
    if (endpoint) docCache.delete(endpoint);
  }
  function activeEndpoint() {
    const tab = state.tabs.find((t) => t.id === state.activeTabId);
    if (!tab) return null;
    // The "Дела" tab has no `tab.item` at all (it's client-added, not a
    // server-listed document — see `buildTabSet`), so it needs its own
    // identity here rather than falling into the `!tab.item` guard below,
    // which would make `loadAndRenderHumanTasks`'s staleness check compare
    // against `null` on every render and always treat its own response as
    // stale.
    if (tab.kind === "human-tasks") return humanTasksListEndpoint(state.project, state.issueId);
    if (!tab.item) return null;
    // manual_test_checklist's "endpoint" is the structured checklist route,
    // not `item.endpoint` (the raw-markdown fetch every other doc tab uses)
    // — see the checklist branch in `renderDocPanel`.
    if (tab.id === CHECKLIST_DOC_ID) return checklistEndpointFor(state.project, state.issueId);
    return tab.item.endpoint;
  }

  // `/api/inbox` has exactly one call site in this whole module: this
  // memoized promise (AC-06b, TC-029 step 4). It is created at most once per
  // mount and never invalidated by `selectRole`/`selectIssue` — a project
  // never changes within one mount, and the endpoint carries no project/
  // issue/role of its own, so the first response is valid for the rest of
  // this mount's lifetime.
  let inboxPromise = null;
  function fetchInboxOnce() {
    if (!inboxPromise) inboxPromise = fetchInbox(options.fetchImpl);
    return inboxPromise;
  }

  // Bakes `state.projectTodoCount` into the "Дела" tab's own label (kept out
  // of `buildTabSet` itself, which stays a pure function of one role's
  // response and knows nothing of `/api/inbox`). Called every time
  // `state.tabs` is rebuilt, so a role/issue switch's fresh tab set still
  // carries the already-known count instead of losing it.
  function decorateHumanTasksTab() {
    const tab = state.tabs.find((t) => t.id === HUMAN_TASKS_TAB_ID);
    if (!tab) return;
    tab.label = state.projectTodoCount === null ? "Дела" : `Дела (${state.projectTodoCount})`;
  }

  // Fetches (once) and computes the project-wide "Дела" counter, independent
  // of `loadShell()`/`loadRoleContents()` — it does not need roles, issues
  // or role contents to resolve, only `state.project` (AC-06a/AC-06b).
  async function loadProjectTodoCount() {
    if (!state.project) return;
    try {
      const inboxResponse = await fetchInboxOnce();
      state.projectTodoCount = countProjectTodos(inboxResponse, state.project);
    } catch {
      state.projectTodoCount = null; // Дела tab just renders without a count
    }
    decorateHumanTasksTab();
    render();
  }

  function render() {
    container.innerHTML = "";

    if (state.error) {
      container.appendChild(h("p", "notice error", `Не удалось загрузить рабочее пространство: ${state.error.message}`));
      return;
    }

    const root = h("div", "workspace");
    root.appendChild(renderHeader(state, { onBack, onSelectIssue: selectIssue, onSelectRole: selectRole }));
    root.appendChild(renderTabs(state, { onSelectTab: selectTab }));

    const activeTab = state.tabs.find((t) => t.id === state.activeTabId) || null;
    if (activeTab) {
      const checklistEndpoint =
        activeTab.id === CHECKLIST_DOC_ID ? checklistEndpointFor(state.project, state.issueId) : null;
      root.appendChild(
        renderDocPanel(activeTab, {
          fetchDoc,
          getActiveEndpoint: activeEndpoint,
          checklistEndpoint,
          project: state.project,
          issueId: state.issueId,
          fetchImpl: options.fetchImpl,
          invalidateDoc,
          tryScrollToInitialPtcId,
        })
      );
    } else {
      root.appendChild(h("p", "muted", state.project ? "Загрузка…" : "Проект не выбран."));
    }

    container.appendChild(root);
  }

  // Re-fetches `.../roles/:role` for the current (project, issue, role) and
  // rebuilds `.doc-tabs` from that one response. `preserveActiveTab` decides
  // whether the previous tab id is carried through `resolveActiveTab()`
  // (an issue switch, within the same role) or dropped for a fresh first tab
  // (a role switch, or the very first load — no previous tab to keep).
  async function loadRoleContents(preserveActiveTab) {
    if (!state.project || !state.issueId || !state.roleId) {
      state.tabs = [];
      state.activeTabId = null;
      render();
      return;
    }
    const prevTabId = state.activeTabId;
    try {
      const contents = await fetchRoleContents(state.project, state.issueId, state.roleId, options.fetchImpl);
      state.tabs = buildTabSet(contents);
      decorateHumanTasksTab(); // carry the already-known project-wide count into the fresh tab set
      if (preserveActiveTab) {
        state.activeTabId = resolveActiveTab(prevTabId, contents);
      } else if (!initialTabApplied && options.initialTab) {
        // CR-005 fix (Task 33): an inbox item's `where.doc`/`where.tab`,
        // forwarded through `app.js` as `options.initialTab`, applied to
        // this mount's very first tab set only — normalized through the
        // same `tabIdFor` rule every doc tab id already follows, so a
        // ".md"-suffixed `where.doc` (a manual TC) and an already-bare
        // `where.tab` (a human task, "human-tasks") both resolve the same
        // way. A tab id that doesn't exist in this tab set (stale/garbled
        // hash) falls back to the first tab, same as the no-`initialTab`
        // case, rather than leaving `activeTabId` unset.
        const wantedTabId = tabIdFor({ name: options.initialTab });
        const match = state.tabs.find((t) => t.id === wantedTabId);
        state.activeTabId = match ? match.id : state.tabs[0]?.id ?? null;
        initialTabApplied = true; // only ever consulted on this, the initial landing
      } else {
        state.activeTabId = state.tabs[0]?.id ?? null;
      }
      state.error = null;
    } catch (err) {
      state.error = err;
    }
    render();
  }

  // [Issue ▾] — does NOT change the active document tab (test_plan.md
  // TC-003, tech spec §2.2's P0 fix): the fetch below carries the previous
  // `state.activeTabId` through `resolveActiveTab()`.
  //
  // Deliberately does not write `location.hash` (unlike `onBack`/`.doc-tabs`
  // clicks navigating elsewhere): `app.js`'s router remounts this whole
  // screen from scratch on every `hashchange`, which would drop
  // `state.activeTabId` and reopen this exact P0 this function fixes. An
  // issue switch is local component state, the same way `public/inbox.js`'s
  // section switch is — not a route change.
  async function selectIssue(issueId) {
    if (!issueId || issueId === state.issueId) return;
    state.issueId = issueId;
    storeLastIssue(state.project, issueId, options.storage);
    render(); // reflect the dropdown's new value immediately, tabs catch up async
    await loadRoleContents(true);
  }

  // [Роль ▾] — replaces the ENTIRE tab set (test_plan.md TC-002 step 3): a
  // fresh `GET .../roles/:newRole` call, never routed through
  // `resolveActiveTab()`. Documents of different roles are never shown at
  // the same time.
  async function selectRole(roleId) {
    if (!roleId || roleId === state.roleId) return;
    state.roleId = roleId;
    storeRole(roleId, options.storage);
    state.activeTabId = null;
    state.tabs = [];
    render();
    await loadRoleContents(false);
  }

  function selectTab(tabId) {
    if (tabId === state.activeTabId) return;
    if (!state.tabs.some((t) => t.id === tabId)) return;
    state.activeTabId = tabId;
    render();
  }

  async function loadShell() {
    try {
      const [roles, issues] = await Promise.all([
        fetchRoles(options.fetchImpl),
        state.project ? fetchIssues(state.project, options.fetchImpl) : Promise.resolve([]),
      ]);
      state.roles = roles;
      state.issues = issues;
      // CR-005 fix (Task 33): `state.roleId` may already be set here from
      // `options.initialRole` — an inbox click's `where.roleId`, reachable
      // via a bookmarkable/garbled hash a user can edit by hand. A role id
      // that doesn't actually exist in this project's own role list must not
      // stick (it would 404 `fetchRoleContents` into `state.error` and leave
      // `[Роль ▾]` with no selected option — the exact "garbled hash leaves
      // the page blank" failure `app.js`'s own routing comment promises
      // never happens) — fall back the same way an absent `roleId` already
      // does: stored role, then the server's first role.
      if (state.roleId && roles.length && !roles.some((r) => r.id === state.roleId)) {
        state.roleId = readStoredRole(options.storage) || roles[0].id;
      }
      if (!state.roleId && roles.length) state.roleId = roles[0].id;
      if (!state.issueId && issues.length) state.issueId = issues[0].issueId;
    } catch (err) {
      state.error = err;
      render();
      return;
    }
    await loadRoleContents(false);
  }

  render(); // paint immediately (role/issue may already be known)
  const ready = loadShell();
  // Independent of `loadShell()`/`loadRoleContents()`: the "Дела" counter
  // needs only `state.project` (AC-06a/AC-06b), not roles/issues/role
  // contents, so it starts in parallel rather than waiting its turn — and is
  // not folded into `ready`, so a test/caller awaiting `ready` is not made
  // to depend on `/api/inbox` succeeding.
  loadProjectTodoCount();

  return {
    selectIssue,
    selectRole,
    selectTab,
    refresh: () => loadRoleContents(true),
    getState: () => ({ ...state, tabs: [...state.tabs], roles: [...state.roles], issues: [...state.issues] }),
    ready,
  };
}
