"use strict";

// public/project-picker.js — the sectioned project list shared by two
// places (dogfooding round 2): the launcher's own `.project-grid` and the
// project-selector dropdown every other screen's unified header opens
// (`public/inbox.js`/`public/project-inbox.js`/`public/workspace.js`).
// One rendering, two call sites — not a screen module itself (no `mount()`,
// no fetching), just the DOM-building half of `public/status.js`'s pure
// `projectCategory()` classifier, native ES module, no DOM/fetch of its
// own beyond `document.createElement`.

import { attentionForRoles } from "./attention.js";
import { STAGE_LABELS, projectCategory } from "./status.js";

function h(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

export const SECTION_TITLES = {
  open: "Есть открытые issue",
  problems: "Есть проблемы с документами",
  clear: "Не требующие внимания",
};
export const SECTION_ORDER = ["open", "problems", "clear"];

/**
 * One project's card body, given its already-computed `projectCategory()`
 * result.
 *
 * `attentionByIssue`, when given, is `attentionForRoles(...).byIssue` for
 * this project and the current role filter — the "open" list's per-issue
 * stage progress gets an extra "(N для вас)" when the filter found
 * something for that issue. `projectCategory` itself stays role-
 * independent (an open issue, a missing doc or a FAIL verdict are
 * objective facts about the project, not about who's looking) — this is
 * the filter's real, visible effect, not a no-op.
 */
export function renderProjectCardBody(card, project, category, attentionByIssue) {
  card.appendChild(h("div", "project-card-name", project.name));
  if (category.category === "open") {
    const list = h("ul", "project-card-issues");
    for (const issue of category.detail) {
      const li = document.createElement("li");
      const doneCount = (issue.stages || []).filter((s) => s.done).length;
      li.appendChild(h("span", "project-card-issue-id", issue.issueId));
      let text = ` — ${doneCount}/${STAGE_LABELS.length}`;
      const attention = attentionByIssue && attentionByIssue[issue.issueId];
      if (attention) text += ` (${attention} для вас)`;
      li.appendChild(h("span", "project-card-issue-meta", text));
      list.appendChild(li);
    }
    card.appendChild(list);
  } else if (category.category === "problems") {
    card.appendChild(h("div", "project-card-problem", `${category.detail.issueId}: ${category.detail.message}`));
  }
}

/**
 * The full three-section list.
 *
 * @param {object} options
 * @param {Array<{name: string, currentBranch?: string}>|null} options.projects
 * @param {Object<string, object[]>} options.projectIssuesByName — `{[project]: issues[]}`,
 *   whatever has already loaded (a project not yet in here renders under
 *   "open" as a bare, unclassified card rather than being mis-sorted into
 *   "clear" while its own fetch is still in flight).
 * @param {string[]} options.roleIds — the current role filter selection.
 * @param {object|null} options.inbox — the already-fetched `GET /api/inbox` response.
 * @param {(projectName: string) => string} options.hrefFor — the href/hash
 *   for a project's card (callers differ: the launcher sends the reader to
 *   that project's last-active issue when known, the header dropdown on
 *   other screens just goes to `#/p/<project>`).
 * @param {(projectName: string) => void} options.onOpenProject
 * @returns {Element}
 */
export function renderProjectSections({ projects, projectIssuesByName, roleIds, inbox, hrefFor, onOpenProject }) {
  const root = h("div", "project-sections");
  if (!projects || projects.length === 0) {
    root.appendChild(h("p", "muted", projects === null ? "Загрузка…" : "Нет настроенных проектов."));
    return root;
  }

  const bySection = { open: [], problems: [], clear: [] };
  for (const project of projects) {
    const issues = (projectIssuesByName && projectIssuesByName[project.name]) || null;
    // Computed *before* classification, not just for the "для вас"
    // annotation afterward — `projectCategory` itself needs this to filter
    // "open" down to issues actually relevant to the role filter (pending
    // manual tests/human tasks aren't visible in `issues[]`, only here).
    const byIssue = roleIds && roleIds.length ? attentionForRoles(inbox, project.name, roleIds).byIssue : null;
    const category = issues ? projectCategory(issues, roleIds, byIssue) : { category: "loading", detail: null };
    bySection[category.category === "loading" ? "open" : category.category].push({ project, category, byIssue });
  }

  for (const key of SECTION_ORDER) {
    const items = bySection[key];
    if (items.length === 0) continue;
    const section = h("div", "project-section");
    section.appendChild(h("h2", "project-section-title", SECTION_TITLES[key]));
    const grid = h("div", "project-grid");
    for (const { project, category, byIssue } of items) {
      const card = h("a", "project-card");
      card.href = hrefFor(project.name);
      card.dataset.project = project.name;
      renderProjectCardBody(card, project, category, byIssue);
      if (project.currentBranch) card.title = `checked out: ${project.currentBranch}`;
      card.addEventListener("click", (event) => {
        event.preventDefault();
        onOpenProject(project.name);
      });
      grid.appendChild(card);
    }
    section.appendChild(grid);
    root.appendChild(section);
  }
  return root;
}

/**
 * The header's project-selector control (dogfooding round 2's "unified
 * header"): a button naming the current context, opening a dropdown panel
 * over the current screen — not a navigation — with the exact same
 * three-section list `renderProjectSections` builds for the launcher.
 * `isOpen`/`onToggle` are owned by the caller's own local state (each
 * screen module keeps its own, same "no shared mutable state between
 * screen modules" convention as everything else here); this function just
 * renders whichever state it's handed.
 *
 * @param {object} options
 * @param {string} options.triggerLabel — current project name, or
 *   "Все проекты" (the global inbox has no "current" project).
 * @param {boolean} options.isOpen
 * @param {() => void} options.onToggle
 * @param {Array|null} options.projects
 * @param {Object<string, object[]>} options.projectIssuesByName
 * @param {string[]} options.roleIds
 * @param {object|null} options.inbox
 * @param {(projectName: string) => string} options.hrefFor
 * @param {(projectName: string) => void} options.onOpenProject
 * @returns {Element}
 */
export function renderProjectSelector(options) {
  const wrap = h("div", "project-selector");
  const trigger = h("button", "project-selector-trigger", options.triggerLabel);
  trigger.type = "button";
  trigger.setAttribute("aria-expanded", String(!!options.isOpen));
  trigger.addEventListener("click", options.onToggle);
  wrap.appendChild(trigger);

  if (options.isOpen) {
    const panel = h("div", "project-selector-panel");
    panel.appendChild(
      renderProjectSections({
        projects: options.projects,
        projectIssuesByName: options.projectIssuesByName,
        roleIds: options.roleIds,
        inbox: options.inbox,
        hrefFor: options.hrefFor,
        onOpenProject: options.onOpenProject,
      })
    );
    wrap.appendChild(panel);
  }
  return wrap;
}
