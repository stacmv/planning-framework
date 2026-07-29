"use strict";

// Manual Test UI — role-first client.
//
// Two rules shape this file, and both are checked elsewhere:
//
//  1. **The client owns no list of documents.** Which roles exist, what each
//     role shows, where every entry lives and what state it is in all arrive
//     from the API (`/api/roles`, `.../issues/:id/roles/:role`). The single
//     document name written down below is the checklist's, because the
//     checklist screen — which predates the role explorer — names its own
//     subject; every other name is whatever the server sent (TC-006 step 7).
//  2. **Read-only, with exactly three exceptions.** Marks and notes on the
//     checklist, checking out a branch on confirmation, and preparing a
//     case's test data on confirmation. Nothing else in this UI writes
//     anywhere, and no other screen carries an input or a save button.
//
// Navigation is one chain — project → issue → the current role's entries →
// the entry itself. Roles sit above all of it: the tab strip is always live,
// switching never loses the selected project or issue, and it works with a
// document open.

// The one document this client may name: the checklist screen's own subject.
const CHECKLIST_DOC = "manual_test_checklist.md";

const state = {
  project: null,
  currentBranch: null,
  issueId: null,
  roles: [],
  roleId: null,
  contents: null, // last GET .../roles/:role — the role's entries and their state
  itemId: null, // id of the open entry, so a refresh can reopen it
  checklist: null, // last GET .../checklist, kept for local summary math
};

// Where the reader was, remembered across a reload. Without this the page
// always reopened on the first project and the first role, losing the place of
// anyone who reloads mid-checklist — which is most of a manual test run.
// Storage is best-effort: a browser with it disabled just gets the defaults.
const NAV_KEY = "pf-manual-test-ui:nav";

// Filled once at boot from the previous visit, then consumed as each level of
// the selection is restored. Never read after boot, so ordinary navigation
// cannot be pulled backwards by a stale value.
let pendingNav = null;

function saveNav() {
  try {
    localStorage.setItem(
      NAV_KEY,
      JSON.stringify({
        project: state.project,
        issueId: state.issueId,
        roleId: state.roleId,
        itemId: state.itemId,
      })
    );
  } catch (e) {
    /* storage unavailable or full — navigation still works, it just won't persist */
  }
}

function readNav() {
  try {
    const raw = localStorage.getItem(NAV_KEY);
    if (!raw) return null;
    const nav = JSON.parse(raw);
    return nav && typeof nav === "object" ? nav : null;
  } catch (e) {
    return null;
  }
}

const el = {
  roleTabs: document.getElementById("role-tabs"),
  contextLabel: document.getElementById("context-label"),
  projectList: document.getElementById("project-list"),
  issueList: document.getElementById("issue-list"),
  rolePanel: document.getElementById("role-panel"),
  rolePanelTitle: document.getElementById("role-panel-title"),
  roleItems: document.getElementById("role-item-list"),
  content: document.getElementById("content"),
  toast: document.getElementById("toast"),
};

// Live parts of the checklist screen, rebuilt every time it is opened.
const checklistEl = { progress: null, container: null };

const STATUS_LABEL = { here: null, on_branch: "on branch", missing: "no checklist" };

// ---------------------------------------------------------------- utilities

function showToast(message, kind) {
  el.toast.textContent = message;
  el.toast.className = "toast" + (kind ? " " + kind : "");
  el.toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => (el.toast.hidden = true), 2200);
}

async function api(pathname, options) {
  const res = await fetch(pathname, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options && options.headers) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`);
  return data;
}

// Like api(), but hands back the body of a refusal too. Preparing test data
// reports an exit code and a script's output whether it succeeded or not, and
// throwing that away would leave the tester with nothing to read.
async function apiRaw(pathname, options) {
  const res = await fetch(pathname, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options && options.headers) },
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = { error: `HTTP ${res.status}`, message: "The server sent no readable answer." };
  }
  return { ok: res.ok, status: res.status, data: data || {} };
}

function projectBase() {
  return `/api/projects/${encodeURIComponent(state.project)}`;
}

function issueBase() {
  return `${projectBase()}/issues/${encodeURIComponent(state.issueId)}`;
}

function elem(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function badge(text, className) {
  return elem("span", "badge" + (className ? " " + className : ""), text);
}

function bytesLabel(bytes) {
  if (typeof bytes !== "number") return null;
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

// ------------------------------------------------------------ markdown area

// Wide content scrolls inside its own box; the page itself never moves
// sideways. Code blocks get that from CSS, tables need a wrapper because a
// <table> cannot both size to its content and clip it.
function wrapWideBlocks(root) {
  const tables = root.querySelectorAll("table");
  for (const table of tables) {
    if (table.parentElement && table.parentElement.classList.contains("scroll-x")) continue;
    const wrap = elem("div", "scroll-x");
    table.parentNode.insertBefore(wrap, table);
    wrap.appendChild(table);
  }
}

function renderMarkdownInto(node, text) {
  node.innerHTML = "";
  if (text === null || text === undefined || String(text).trim() === "") {
    node.appendChild(elem("p", "muted", "This document is empty."));
    return;
  }
  node.innerHTML = PFMarkdown.render(text);
  wrapWideBlocks(node);
}

// -------------------------------------------------------------------- roles

async function loadRoles() {
  const data = await api("/api/roles");
  state.roles = data.roles || [];
  if (!state.roleId && pendingNav && state.roles.some((r) => r.id === pendingNav.roleId)) {
    state.roleId = pendingNav.roleId;
  }
  if (!state.roleId && state.roles.length) state.roleId = state.roles[0].id;
  renderRoleTabs();
}

function renderRoleTabs() {
  el.roleTabs.innerHTML = "";
  for (const role of state.roles) {
    const tab = elem("button", "role-tab", role.title);
    tab.type = "button";
    tab.dataset.roleId = role.id;
    tab.title = role.description || "";
    if (role.id === state.roleId) tab.classList.add("active");
    // Always enabled: switching roles is free at any moment, including with a
    // document open and before a project has been picked.
    tab.addEventListener("click", () => selectRole(role.id));
    el.roleTabs.appendChild(tab);
  }
}

function currentRole() {
  return state.roles.find((r) => r.id === state.roleId) || null;
}

async function selectRole(roleId) {
  if (state.roleId === roleId) return;
  state.roleId = roleId;
  state.itemId = null; // entries are per-role; nothing carries over
  saveNav();
  renderRoleTabs();
  await refreshRoleContents();
}

// ----------------------------------------------------------------- projects

async function loadProjects() {
  const projects = await api("/api/projects");
  el.projectList.innerHTML = "";
  for (const p of projects) {
    const li = elem("li");
    li.dataset.projectName = p.name;
    li.appendChild(elem("span", null, p.name));
    li.title = p.currentBranch ? `checked out: ${p.currentBranch}` : "";
    const meta = elem("span", "meta", String(p.issueCount));
    li.appendChild(meta);
    li.addEventListener("click", () => selectProject(p.name));
    el.projectList.appendChild(li);
  }
  if (!projects.length) return;
  const remembered = pendingNav && projects.some((p) => p.name === pendingNav.project) ? pendingNav.project : null;
  await selectProject(remembered || projects[0].name);
}

async function selectProject(name) {
  state.project = name;
  state.issueId = null;
  state.itemId = null;
  state.contents = null;
  state.checklist = null;
  markActive(el.projectList, "projectName", name);
  saveNav();
  updateContextLabel();
  await loadIssues();
  await refreshRoleContents();
}

// Re-reads the issue list of the current project without touching the rest of
// the selection — used after a checkout, which moves branch-dependent state.
async function loadIssues() {
  const { currentBranch, issues } = await api(`${projectBase()}/issues`);
  state.currentBranch = currentBranch;
  el.issueList.innerHTML = "";
  if (!issues.length) {
    const li = elem("li", "note", `No issues found under docs/issues/ on the checked-out branch (${currentBranch}).`);
    el.issueList.appendChild(li);
    return;
  }
  for (const issue of issues) {
    // Every issue is selectable: the roles above the checklist have documents
    // to show whether or not a checklist exists yet.
    const li = elem("li");
    li.dataset.issueId = issue.issueId;
    li.appendChild(elem("span", null, issue.issueId));

    const right = elem("span", "meta");
    right.appendChild(badge(issue.status, issue.status === "closed" ? "closed" : null));

    const statusLabel = STATUS_LABEL[issue.checklistStatus];
    if (statusLabel) right.appendChild(badge(statusLabel, issue.checklistStatus.replace("_", "-")));

    const progress = elem("span", null, ` ${issue.summary.passedSteps}/${issue.summary.totalSteps}`);
    right.appendChild(progress);
    li.appendChild(right);

    li.title = issue.feature || "";
    li.addEventListener("click", () => selectIssue(issue.issueId));
    el.issueList.appendChild(li);
  }
  if (state.issueId) markActive(el.issueList, "issueId", state.issueId);
}

async function selectIssue(issueId) {
  if (state.issueId === issueId) return;
  state.issueId = issueId;
  state.itemId = null;
  state.checklist = null;
  markActive(el.issueList, "issueId", issueId);
  saveNav();
  updateContextLabel();
  await refreshRoleContents();
}

function markActive(list, datasetKey, value) {
  for (const li of list.children) {
    li.classList.toggle("active", li.dataset[datasetKey] === value);
  }
}

function updateContextLabel() {
  const parts = [];
  if (state.project) parts.push(state.project);
  if (state.issueId) parts.push(state.issueId);
  el.contextLabel.textContent = parts.join("  ·  ");
}

// --------------------------------------------------------- role entry panel

// Ask the server what this role holds for this issue and redraw. The answer
// depends on nothing but (project, issue, role) — no order of requests, no
// remembered role — so this is safe to call at any point.
async function refreshRoleContents() {
  if (!state.project || !state.issueId || !state.roleId) {
    state.contents = null;
    el.rolePanel.hidden = true;
    el.roleItems.innerHTML = "";
    renderPlaceholder();
    return;
  }
  try {
    state.contents = await api(`${issueBase()}/roles/${encodeURIComponent(state.roleId)}`);
  } catch (e) {
    state.contents = null;
    el.rolePanel.hidden = true;
    el.roleItems.innerHTML = "";
    renderError(e.message);
    return;
  }
  renderRoleItems();
  const open = state.itemId ? state.contents.items.find((i) => i.id === state.itemId) : null;
  if (open) openItem(open);
  else renderRoleIntro();
}

function renderRoleItems() {
  const contents = state.contents;
  el.rolePanel.hidden = false;
  el.rolePanelTitle.textContent = contents.role.title;
  el.roleItems.innerHTML = "";
  for (const item of contents.items) {
    const li = elem("li");
    li.dataset.itemId = item.id;
    if (item.id === state.itemId) li.classList.add("active");

    const label = elem("span", "item-label", item.label || item.name);
    li.appendChild(label);

    const mark = entryBadge(item);
    if (mark) {
      const right = elem("span", "meta");
      right.appendChild(badge(mark.text, mark.cls));
      li.appendChild(right);
    }

    li.title = [item.name, item.description].filter(Boolean).join(" — ");
    li.addEventListener("click", () => {
      state.itemId = item.id;
      saveNav();
      markActive(el.roleItems, "itemId", item.id);
      openItem(item);
    });
    el.roleItems.appendChild(li);
  }
}

// The short mark next to an entry. Every word of it comes from the state the
// server sent; the client only picks how to say it in one badge's worth of
// space, with the full sentence shown once the entry is opened.
function entryBadge(item) {
  if (item.kind === "action") {
    if (!item.offered) return { text: item.status === "not_applicable" ? "n/a" : "unavailable", cls: "missing" };
    return item.enabled ? { text: "ready", cls: "ok" } : { text: "on branch", cls: "on-branch" };
  }
  if (item.status === "present") {
    if (item.location === "branch") return { text: "on branch", cls: "on-branch" };
    return null;
  }
  if (item.status === "not_applicable") return { text: "n/a", cls: "na" };
  return { text: "missing", cls: "missing" };
}

// ------------------------------------------------------------ content panes

function clearContent() {
  el.content.innerHTML = "";
  el.content.scrollTop = 0;
  return el.content;
}

function renderPlaceholder() {
  const wrap = clearContent();
  const role = currentRole();
  const card = elem("div", "intro");
  card.appendChild(elem("h2", null, role ? role.title : "Manual Test UI"));
  if (role) card.appendChild(elem("p", "intro-description", role.description || ""));
  card.appendChild(
    elem("p", "muted", state.project ? "Pick an issue on the left." : "Pick a project on the left.")
  );
  wrap.appendChild(card);
}

function renderError(message) {
  const wrap = clearContent();
  const box = elem("div", "notice error");
  box.appendChild(elem("p", null, message));
  wrap.appendChild(box);
}

// Shown whenever a role is open but no entry of it is: what this role is for,
// and the facts about the issue that decide what its entries contain.
function renderRoleIntro() {
  const wrap = clearContent();
  const c = state.contents;
  const card = elem("div", "intro");
  card.appendChild(elem("h2", null, c.role.title));
  card.appendChild(elem("p", "intro-description", c.role.description || ""));

  const dl = elem("dl", "facts");
  const facts = [
    ["Issue", `${c.issueId} (${c.issueStatus})`],
    ["Type", c.type],
    ["Size tier", c.sizeTier],
    ["Checked-out branch", c.currentBranch || "—"],
    ["Issue branch", c.issueBranch || "—"],
  ];
  for (const [key, value] of facts) {
    dl.appendChild(elem("dt", null, key));
    dl.appendChild(elem("dd", null, value === null || value === undefined ? "—" : String(value)));
  }
  card.appendChild(dl);
  card.appendChild(elem("p", "muted", `Pick an entry of ${c.role.title} on the left.`));
  wrap.appendChild(card);
}

function openItem(item) {
  switch (item.kind) {
    case "issue_doc":
      if (item.name === CHECKLIST_DOC) return openChecklist(item);
      return openDocument(item);
    case "project_doc":
      return openDocument(item);
    case "instructions":
      return openInstructions(item);
    case "memory":
      return openMemory(item);
    case "action":
      return openAction(item);
    default:
      return openUnknown(item);
  }
}

// Header of every entry pane: what it is, where it lives, and — when it is
// not simply there — the server's own sentence about why.
function entryHeader(item) {
  const header = elem("header", "doc-header");

  const titleRow = elem("div", "doc-title-row");
  titleRow.appendChild(elem("h2", null, item.label || item.name));
  const mark = entryBadge(item);
  if (mark) titleRow.appendChild(badge(mark.text, mark.cls));
  header.appendChild(titleRow);

  if (item.name) header.appendChild(elem("code", "doc-path", item.name));
  if (item.description) header.appendChild(elem("p", "doc-description", item.description));

  const notice = stateNotice(item);
  if (notice) header.appendChild(notice);

  if (item.checkout && item.checkout.branch) header.appendChild(checkoutBanner(item.checkout));

  return header;
}

function stateNotice(item) {
  const lines = [];
  const message = item.message || "";
  if (message) lines.push(message);
  // Most messages already end in their own reason; repeating it word for word
  // reads as two different explanations of the same state.
  if (item.reason && !message.toLowerCase().includes(item.reason.toLowerCase())) {
    lines.push(`Why: ${item.reason}`);
  }
  if (item.stage && item.status !== "present") lines.push(`Created by: ${item.stage}`);
  if (item.status === "present" && item.location === "branch" && item.branch) {
    lines.push(`Read-only preview taken from ${item.branch}.`);
  }
  const size = bytesLabel(item.bytes);
  if (item.status === "present" && size) lines.push(size);
  if (!lines.length) return null;

  const kind =
    item.status === "present" ? (item.location === "branch" ? "warn" : "info") : item.status === "not_applicable" ? "muted-notice" : "warn";
  const box = elem("div", "notice " + kind);
  for (const line of lines) box.appendChild(elem("p", null, line));
  return box;
}

// One of the three actions that change anything, and the confirmation in
// front of it is the same one the checklist screen has always shown.
function checkoutBanner(checkout) {
  const banner = elem("div", "checkout-banner");
  banner.appendChild(
    elem(
      "span",
      null,
      checkout.message || `${checkout.branch} isn't checked out — switching to it is offered on your confirmation.`
    )
  );
  const btn = elem("button", "btn", `Checkout ${checkout.branch}`);
  btn.type = "button";
  btn.addEventListener("click", () => requestCheckout(checkout.branch, checkout.endpoint, btn));
  banner.appendChild(btn);
  return banner;
}

async function requestCheckout(branch, endpoint, btn) {
  const ok = confirm(
    `Checkout "${branch}" in ${state.project}?\n\n` +
      `This runs "git checkout ${branch}" in that project's working directory. ` +
      `It will be refused if there are uncommitted changes.`
  );
  if (!ok) return;

  btn.disabled = true;
  btn.textContent = "Checking out…";
  try {
    await api(endpoint || `${issueBase()}/checklist/checkout`, { method: "POST" });
    showToast(`Checked out ${branch}`, "ok");
    await loadIssues(); // branch label and per-issue checklist states moved
    await refreshRoleContents(); // reopens the entry that was on screen
  } catch (e) {
    showToast("Checkout failed: " + e.message, "error");
    btn.disabled = false;
    btn.textContent = `Checkout ${branch}`;
  }
}

function openUnknown(item) {
  const wrap = clearContent();
  wrap.appendChild(entryHeader(item));
}

// ------------------------------------------------------------ document pane

async function openDocument(item) {
  const wrap = clearContent();
  wrap.appendChild(entryHeader(item));
  // Absent, not applicable, or on a branch that is gone: the header already
  // carries the explanation and there is nothing to fetch.
  if (item.status !== "present" || !item.endpoint) return;

  const body = elem("div", "md-body");
  body.appendChild(elem("p", "muted", "Loading…"));
  wrap.appendChild(body);

  const openedFor = item.id;
  try {
    const data = await api(item.endpoint);
    if (state.itemId !== openedFor) return; // the user moved on while it loaded
    renderMarkdownInto(body, data.content);
  } catch (e) {
    body.innerHTML = "";
    const box = elem("div", "notice error");
    box.appendChild(elem("p", null, e.message));
    body.appendChild(box);
  }
}

// -------------------------------------------------------- instructions pane

async function openInstructions(item) {
  const wrap = clearContent();
  wrap.appendChild(entryHeader(item));
  if (!item.endpoint) return;

  const body = elem("div", "stack");
  body.appendChild(elem("p", "muted", "Loading…"));
  wrap.appendChild(body);

  let data;
  try {
    data = await api(item.endpoint);
  } catch (e) {
    body.innerHTML = "";
    body.appendChild(elem("p", "muted", e.message));
    return;
  }
  body.innerHTML = "";

  if (data.message) {
    const note = elem("div", "notice muted-notice");
    note.appendChild(elem("p", null, data.message));
    body.appendChild(note);
  }
  const entries = data.instructions || [];
  if (!entries.length) return;

  for (const entry of entries) {
    const card = elem("section", "sub-card" + (entry.active ? "" : " inactive"));
    const head = elem("div", "sub-card-head");
    head.appendChild(elem("code", "doc-path", entry.relativePath || entry.path));
    head.appendChild(badge(entry.scope, entry.inherited ? "on-branch" : null));
    if (!entry.active) head.appendChild(badge("not in force", "na"));
    card.appendChild(head);

    if (!entry.active) {
      card.appendChild(elem("p", "muted", entry.inactiveReason || "Not in force for this project."));
    } else if (entry.content === null) {
      card.appendChild(elem("p", "muted", "This file could not be read."));
    } else {
      if (entry.truncated) card.appendChild(elem("p", "muted", "Shown truncated — the file is larger than this tool reads."));
      const md = elem("div", "md-body");
      renderMarkdownInto(md, entry.content);
      card.appendChild(md);
    }
    body.appendChild(card);
  }
}

// --------------------------------------------------------------- memory pane

async function openMemory(item) {
  const wrap = clearContent();
  wrap.appendChild(entryHeader(item));
  if (!item.endpoint) return;

  const body = elem("div", "stack");
  body.appendChild(elem("p", "muted", "Loading…"));
  wrap.appendChild(body);

  let data;
  try {
    data = await api(item.endpoint);
  } catch (e) {
    body.innerHTML = "";
    body.appendChild(elem("p", "muted", e.message));
    return;
  }
  body.innerHTML = "";

  const note = elem("div", "notice muted-notice");
  note.appendChild(elem("p", null, data.message || ""));
  if (data.memoryDir) note.appendChild(elem("code", "doc-path", data.memoryDir));
  body.appendChild(note);

  const files = data.files || [];
  if (!files.length) return;

  const list = elem("ul", "list items inline-list");
  const viewer = elem("div", "sub-card");
  viewer.appendChild(elem("p", "muted", "Pick a memory file to read it."));

  for (const file of files) {
    const li = elem("li");
    li.dataset.memoryPath = file.relativePath;
    li.appendChild(elem("span", "item-label", file.relativePath));
    const meta = elem("span", "meta", bytesLabel(file.bytes) || "");
    li.appendChild(meta);
    li.addEventListener("click", async () => {
      markActive(list, "memoryPath", file.relativePath);
      viewer.innerHTML = "";
      const md = elem("div", "md-body");
      md.appendChild(elem("p", "muted", "Loading…"));
      viewer.appendChild(md);
      try {
        const doc = await api(`${projectBase()}/memory/file?path=${encodeURIComponent(file.relativePath)}`);
        renderMarkdownInto(md, doc.content);
      } catch (e) {
        md.innerHTML = "";
        md.appendChild(elem("p", "muted", e.message));
      }
    });
    list.appendChild(li);
  }
  body.appendChild(list);
  body.appendChild(viewer);
}

// --------------------------------------------------------------- action pane

function openAction(item) {
  const wrap = clearContent();
  wrap.appendChild(entryHeader(item));
  if (!item.offered) return;

  const box = elem("div", "stack");
  const actions = elem("div", "action-row");
  const btn = elem("button", "btn", "Prepare test data for the whole issue");
  btn.type = "button";
  btn.disabled = !item.enabled;
  actions.appendChild(btn);
  if (!item.enabled) actions.appendChild(elem("span", "muted", item.reason || "Not available right now."));
  box.appendChild(actions);

  const result = elem("div", "prepare-result");
  box.appendChild(result);
  wrap.appendChild(box);

  btn.addEventListener("click", () => runPrepare({ endpoint: item.endpoint, tcId: null, btn, result }));
}

// The third and last changing action. Confirmed before it starts, and its
// outcome, the path it produced, the script's output and the exit code are
// all shown — a run whose result is invisible is a run nobody can trust.
async function runPrepare({ endpoint, tcId, btn, result }) {
  const what = tcId ? `test data for ${tcId}` : "test data for every case of this issue";
  const ok = confirm(
    `Prepare ${what} in ${state.project} / ${state.issueId}?\n\n` +
      `This runs the issue's own setup script and rebuilds its working copy from scratch, ` +
      `outside the repository. Anything already in that working copy is replaced.`
  );
  if (!ok) return;

  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Preparing…";
  result.innerHTML = "";
  result.appendChild(elem("p", "muted", "Running…"));

  const res = await apiRaw(endpoint || `${issueBase()}/prepare`, {
    method: "POST",
    body: JSON.stringify(tcId ? { confirm: true, tcId } : { confirm: true }),
  });
  btn.disabled = false;
  btn.textContent = originalLabel;
  renderPrepareResult(result, res);
  showToast(res.data.ok ? "Test data prepared" : "Prepare failed", res.data.ok ? "ok" : "error");
}

function renderPrepareResult(result, res) {
  const data = res.data || {};
  result.innerHTML = "";

  const head = elem("div", "doc-title-row");
  head.appendChild(elem("h3", null, data.ok ? "Prepared" : "Not prepared"));
  head.appendChild(badge(data.ok ? "ok" : data.reason || data.error || `HTTP ${res.status}`, data.ok ? "ok" : "fail"));
  result.appendChild(head);

  if (data.message) result.appendChild(elem("p", null, data.message));

  const dl = elem("dl", "facts");
  const facts = [
    ["Case", data.tcId || "whole issue"],
    ["Ran the script", data.ran ? "yes" : "no"],
    ["Exit code", data.exitCode === null || data.exitCode === undefined ? "—" : String(data.exitCode)],
    ["Signal", data.signal || "—"],
    ["Timed out", data.timedOut ? "yes" : "no"],
    ["Duration", typeof data.durationMs === "number" ? `${data.durationMs} ms` : "—"],
    ["Script", data.scriptPath || "—"],
  ];
  if (data.workdir) facts.push(["Working copy", data.workdir]);
  for (const [key, value] of facts) {
    dl.appendChild(elem("dt", null, key));
    dl.appendChild(elem("dd", null, value));
  }
  result.appendChild(dl);

  const prepared = data.prepared || [];
  if (prepared.length) {
    const list = elem("ul", "plain-list");
    for (const entry of prepared) {
      const li = elem("li");
      li.appendChild(elem("strong", null, entry.tcId || "—"));
      li.appendChild(elem("code", "doc-path", entry.workdir || ""));
      list.appendChild(li);
    }
    result.appendChild(list);
  }

  for (const [label, text] of [["stdout", data.stdout], ["stderr", data.stderr]]) {
    if (!text) continue;
    result.appendChild(elem("h4", null, label));
    const pre = elem("pre", "output");
    pre.appendChild(elem("code", null, text));
    result.appendChild(pre);
  }
}

// ------------------------------------------------------------ checklist pane
//
// Everything below is the screen this tool started as, moved under the tester
// role and otherwise unchanged: the same per-step PATCH (one step, one field
// set — never a whole-file rewrite), the same debounced note saving, the same
// read-only preview for a checklist that lives on a branch, and the same
// confirmation in front of the checkout that would make it editable.

async function openChecklist(item) {
  const wrap = clearContent();
  wrap.appendChild(entryHeader(item));
  if (item.status !== "present") return;

  let checklist;
  try {
    checklist = await api(`${issueBase()}/checklist`);
  } catch (e) {
    const box = elem("div", "notice warn");
    box.appendChild(elem("p", null, e.message));
    wrap.appendChild(box);
    return;
  }
  state.checklist = checklist;
  const readOnly = checklist.checklistStatus !== "here";

  const header = elem("header", "checklist-header");
  header.appendChild(elem("h3", null, `${state.issueId} — ${checklist.meta["Feature Name"] || ""}`));
  checklistEl.progress = elem("div", "progress");
  header.appendChild(checklistEl.progress);
  wrap.appendChild(header);

  // The banner belongs to whichever source knows about the branch. When the
  // role entry already carried a checkout offer, the header above is showing
  // it; a second copy of the same button would only be a second chance to
  // misread the state.
  if (!item.checkout && checklist.checklistStatus === "on_branch" && checklist.branch) {
    wrap.appendChild(
      checkoutBanner({
        branch: checklist.branch,
        endpoint: `${issueBase()}/checklist/checkout`,
        message: `This checklist lives on ${checklist.branch}, which isn't checked out. Showing a read-only preview.`,
      })
    );
  }

  // Preparing the data of the whole issue, right where the cases are read.
  // The per-case button sits on each card below. Whether either is offered at
  // all is the action entry's own state, not a second opinion formed here:
  // the UI must not offer what the route would refuse.
  const action = prepareAction();
  if (action && action.offered) {
    const actions = elem("div", "action-row");
    const prepareAll = elem("button", "btn subtle", "Prepare test data for the whole issue");
    prepareAll.type = "button";
    prepareAll.disabled = !action.enabled;
    actions.appendChild(prepareAll);
    if (!action.enabled) actions.appendChild(elem("span", "muted", action.reason || "Not available right now."));
    wrap.appendChild(actions);

    const prepareResult = elem("div", "prepare-result");
    wrap.appendChild(prepareResult);
    prepareAll.addEventListener("click", () =>
      runPrepare({ endpoint: action.endpoint, tcId: null, btn: prepareAll, result: prepareResult })
    );
  }

  checklistEl.container = elem("div", "tc-container");
  wrap.appendChild(checklistEl.container);
  updateOverallProgress();
  for (const tc of checklist.tcs) {
    checklistEl.container.appendChild(renderTcCard(tc, readOnly, action));
  }
}

// The tester role's action entry, as the server last described it.
function prepareAction() {
  const items = (state.contents && state.contents.items) || [];
  return items.find((i) => i.kind === "action") || null;
}

function updateOverallProgress() {
  const checklist = state.checklist;
  if (!checklist || !checklistEl.progress) return;
  let total = 0,
    passed = 0;
  for (const tc of checklist.tcs) {
    for (const s of tc.steps) {
      total++;
      if (s.checked) passed++;
    }
  }
  checklistEl.progress.textContent = `${passed} / ${total} steps passed`;
}

function renderTcCard(tc, readOnly, action) {
  const card = elem("div", "tc-card" + (readOnly ? " readonly" : ""));
  card.dataset.tcId = tc.id;

  const heading = elem("h3");
  const tcPassed = tc.steps.filter((s) => s.checked).length;
  heading.appendChild(elem("span", null, `${tc.id}: ${tc.name}`));
  heading.appendChild(elem("span", "tc-progress", `${tcPassed}/${tc.steps.length}`));
  card.appendChild(heading);

  if (tc.prerequisites.length) {
    const ul = elem("ul", "prereqs");
    for (const p of tc.prerequisites) ul.appendChild(elem("li", null, p));
    card.appendChild(ul);
  }

  if (tc.steps.length) {
    const scroller = elem("div", "scroll-x");
    const table = elem("table", "steps");
    table.innerHTML = `<thead><tr><th></th><th>#</th><th>Action</th><th>Expected result</th><th>Note</th></tr></thead>`;
    const tbody = document.createElement("tbody");
    for (const step of tc.steps) {
      tbody.appendChild(renderStepRow(tc.id, step, card, readOnly));
    }
    table.appendChild(tbody);
    scroller.appendChild(table);
    card.appendChild(scroller);
  } else if (tc.parseWarnings && tc.parseWarnings.length) {
    const warn = elem("p", "parse-warning", "Could not parse steps for this TC: " + tc.parseWarnings.join("; "));
    card.appendChild(warn);
  }

  const notesWrap = elem("div", "tc-notes");
  const label = elem("label", null, "Notes");
  const textarea = document.createElement("textarea");
  textarea.value = tc.notesText || "";
  if (readOnly) {
    textarea.disabled = true;
  } else {
    let notesTimer;
    textarea.addEventListener("input", () => {
      clearTimeout(notesTimer);
      notesTimer = setTimeout(() => saveNotes(tc.id, textarea.value), 600);
    });
    textarea.addEventListener("blur", () => {
      clearTimeout(notesTimer);
      saveNotes(tc.id, textarea.value);
    });
  }
  notesWrap.appendChild(label);
  notesWrap.appendChild(textarea);
  card.appendChild(notesWrap);

  if (action && action.offered) {
    const caseActions = elem("div", "action-row");
    const prepareCase = elem("button", "btn subtle", `Prepare test data for ${tc.id}`);
    prepareCase.type = "button";
    prepareCase.disabled = !action.enabled;
    caseActions.appendChild(prepareCase);
    card.appendChild(caseActions);
    const caseResult = elem("div", "prepare-result");
    card.appendChild(caseResult);
    prepareCase.addEventListener("click", () =>
      runPrepare({ endpoint: action.endpoint, tcId: tc.id, btn: prepareCase, result: caseResult })
    );
  }

  return card;
}

function renderStepRow(tcId, step, card, readOnly) {
  const tr = document.createElement("tr");

  const checkTd = document.createElement("td");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "step-pass-toggle";
  checkbox.checked = step.checked;
  checkbox.disabled = readOnly;
  checkTd.appendChild(checkbox);
  tr.appendChild(checkTd);

  const numTd = elem("td", null, String(step.step));
  tr.appendChild(numTd);

  const actionTd = elem("td", null, step.action);
  tr.appendChild(actionTd);

  const expectedTd = elem("td", null, step.expected);
  tr.appendChild(expectedTd);

  const noteTd = document.createElement("td");
  const noteInput = document.createElement("input");
  noteInput.className = "note-input";
  noteInput.type = "text";
  noteInput.placeholder = "what actually happened…";
  noteInput.value = step.note || "";
  noteInput.disabled = readOnly;
  noteTd.appendChild(noteInput);
  tr.appendChild(noteTd);

  if (!readOnly) {
    let noteTimer;
    const save = () => saveStep(tcId, step.step, checkbox.checked, noteInput.value, card);

    checkbox.addEventListener("change", save);
    noteInput.addEventListener("input", () => {
      clearTimeout(noteTimer);
      noteTimer = setTimeout(save, 600);
    });
    noteInput.addEventListener("blur", () => {
      clearTimeout(noteTimer);
      save();
    });
  }

  return tr;
}

async function saveStep(tcId, stepNum, checked, note, card) {
  try {
    await api(`${issueBase()}/checklist/steps`, {
      method: "PATCH",
      body: JSON.stringify({ tcId, step: stepNum, checked, note }),
    });
    showToast("Saved", "ok");
    // Keep local model + progress counters in sync without a full re-fetch.
    const tc = state.checklist.tcs.find((t) => t.id === tcId);
    const s = tc.steps.find((x) => x.step === stepNum);
    s.checked = checked;
    s.note = note;
    const heading = card.querySelector("h3 .tc-progress");
    if (heading) heading.textContent = `${tc.steps.filter((x) => x.checked).length}/${tc.steps.length}`;
    updateOverallProgress();
    // Refresh the issue list's progress badge without a full reload.
    refreshIssueListProgressBadge();
  } catch (e) {
    showToast("Save failed: " + e.message, "error");
  }
}

async function saveNotes(tcId, notesText) {
  try {
    await api(`${issueBase()}/checklist/notes`, {
      method: "PATCH",
      body: JSON.stringify({ tcId, notesText }),
    });
    showToast("Saved", "ok");
  } catch (e) {
    showToast("Save failed: " + e.message, "error");
  }
}

function refreshIssueListProgressBadge() {
  // Cheap local recompute; avoids re-fetching the whole issue list on every keystroke.
  const active = el.issueList.querySelector("li.active .meta");
  if (!active || !state.checklist) return;
  let total = 0,
    passed = 0;
  for (const tc of state.checklist.tcs) {
    for (const s of tc.steps) {
      total++;
      if (s.checked) passed++;
    }
  }
  const progressSpan = active.querySelector("span:last-child") || active.lastChild;
  if (progressSpan) progressSpan.textContent = ` ${passed}/${total}`;
}

// --------------------------------------------------------------------- boot

async function boot() {
  pendingNav = readNav();
  await loadRoles();
  await loadProjects();
  await restoreNav();
  pendingNav = null; // from here on the selection is whatever the reader does
}

// Re-opens the issue and the entry the reader had before the reload. Runs after
// loadProjects, so the project and the role are already restored; each level is
// only restored when it still exists, since an issue can be closed or a
// document can change state between visits.
async function restoreNav() {
  const nav = pendingNav;
  if (!nav || nav.project !== state.project) return;

  if (nav.issueId && el.issueList.querySelector(`li[data-issue-id="${cssEscape(nav.issueId)}"]`)) {
    await selectIssue(nav.issueId);
  }
  if (!nav.itemId || !state.contents) return;

  const item = (state.contents.items || []).find((i) => i.id === nav.itemId);
  if (!item) return;
  state.itemId = item.id;
  markActive(el.roleItems, "itemId", item.id);
  await openItem(item);
}

// CSS.escape is not in every browser this tool is opened in, and an issue id is
// already constrained to [0-9a-z-] by the server's own pattern.
function cssEscape(value) {
  return typeof CSS !== "undefined" && CSS.escape ? CSS.escape(value) : String(value).replace(/[^\w-]/g, "");
}

boot().catch((e) => {
  showToast("Failed to start: " + e.message, "error");
  renderError("Failed to start: " + e.message);
});
