"use strict";

const state = {
  project: null,
  issueId: null,
  checklist: null, // last GET result, kept for local summary math
};

const el = {
  projectList: document.getElementById("project-list"),
  issueList: document.getElementById("issue-list"),
  emptyState: document.getElementById("empty-state"),
  checklistView: document.getElementById("checklist-view"),
  checklistTitle: document.getElementById("checklist-title"),
  checklistProgress: document.getElementById("checklist-progress"),
  checklistBanner: document.getElementById("checklist-banner"),
  tcContainer: document.getElementById("tc-container"),
  toast: document.getElementById("toast"),
};

const STATUS_LABEL = { here: null, on_branch: "on branch", missing: "no checklist" };

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
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function loadProjects() {
  const projects = await api("/api/projects");
  el.projectList.innerHTML = "";
  for (const p of projects) {
    const li = document.createElement("li");
    li.textContent = p.name;
    li.title = p.currentBranch ? `checked out: ${p.currentBranch}` : "";
    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = `${p.issueCount}`;
    li.appendChild(meta);
    li.addEventListener("click", () => selectProject(p.name));
    el.projectList.appendChild(li);
  }
  if (projects.length) selectProject(projects[0].name, el.projectList.firstChild);
}

async function selectProject(name, liEl) {
  state.project = name;
  state.issueId = null;
  [...el.projectList.children].forEach((li) => li.classList.remove("active"));
  (liEl || [...el.projectList.children].find((li) => li.firstChild.textContent === name))?.classList.add("active");
  showEmptyState();
  const { currentBranch, issues } = await api(`/api/projects/${encodeURIComponent(name)}/issues`);
  el.issueList.innerHTML = "";
  if (!issues.length) {
    const li = document.createElement("li");
    li.textContent = `No issues found under docs/issues/ on the checked-out branch (${currentBranch}).`;
    li.style.color = "var(--muted)";
    li.style.cursor = "default";
    li.style.whiteSpace = "normal";
    el.issueList.appendChild(li);
    return;
  }
  for (const issue of issues) {
    const li = document.createElement("li");
    const isMissing = issue.checklistStatus === "missing";
    if (isMissing) li.classList.add("disabled");

    const label = document.createElement("span");
    label.textContent = issue.issueId;
    li.appendChild(label);

    const right = document.createElement("span");
    right.className = "meta";
    const badge = document.createElement("span");
    badge.className = "badge" + (issue.status === "closed" ? " closed" : "");
    badge.textContent = issue.status;
    right.appendChild(badge);

    const statusLabel = STATUS_LABEL[issue.checklistStatus];
    if (statusLabel) {
      const statusBadge = document.createElement("span");
      statusBadge.className = "badge " + issue.checklistStatus.replace("_", "-");
      statusBadge.textContent = statusLabel;
      right.appendChild(statusBadge);
    }

    if (!isMissing) {
      const progress = document.createElement("span");
      progress.textContent = ` ${issue.summary.passedSteps}/${issue.summary.totalSteps}`;
      right.appendChild(progress);
    }
    li.appendChild(right);

    li.title = isMissing
      ? "No manual_test_checklist.md exists yet for this issue — run /pf-test on it first."
      : issue.feature;

    if (!isMissing) {
      li.addEventListener("click", () => selectIssue(issue.issueId, li));
    }
    el.issueList.appendChild(li);
  }
}

function showEmptyState() {
  el.emptyState.hidden = false;
  el.checklistView.hidden = true;
}

async function selectIssue(issueId, liEl) {
  state.issueId = issueId;
  [...el.issueList.children].forEach((li) => li.classList.remove("active"));
  liEl?.classList.add("active");
  await renderChecklist();
}

async function renderChecklist() {
  const { project, issueId } = state;
  let checklist;
  try {
    checklist = await api(
      `/api/projects/${encodeURIComponent(project)}/issues/${encodeURIComponent(issueId)}/checklist`
    );
  } catch (e) {
    showToast(e.message, "error");
    showEmptyState();
    return;
  }
  state.checklist = checklist;
  const readOnly = checklist.checklistStatus !== "here";

  el.emptyState.hidden = true;
  el.checklistView.hidden = false;
  el.checklistTitle.textContent = `${issueId} — ${checklist.meta["Feature Name"] || ""}`;
  updateOverallProgress();
  renderBanner(checklist);

  el.tcContainer.innerHTML = "";
  for (const tc of checklist.tcs) {
    el.tcContainer.appendChild(renderTcCard(tc, readOnly));
  }
}

function renderBanner(checklist) {
  if (checklist.checklistStatus !== "on_branch") {
    el.checklistBanner.hidden = true;
    el.checklistBanner.innerHTML = "";
    return;
  }
  el.checklistBanner.hidden = false;
  el.checklistBanner.innerHTML = "";

  const text = document.createElement("span");
  text.textContent = `This checklist lives on ${checklist.branch}, which isn't checked out. Showing a read-only preview.`;
  el.checklistBanner.appendChild(text);

  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = `Checkout ${checklist.branch}`;
  btn.addEventListener("click", () => checkoutCurrentIssue(checklist.branch, btn));
  el.checklistBanner.appendChild(btn);
}

async function checkoutCurrentIssue(branch, btn) {
  const ok = confirm(
    `Checkout "${branch}" in ${state.project}?\n\n` +
      `This runs "git checkout ${branch}" in that project's working directory. ` +
      `It will be refused if there are uncommitted changes.`
  );
  if (!ok) return;

  const issueId = state.issueId; // selectProject() below resets state.issueId to null
  btn.disabled = true;
  btn.textContent = "Checking out…";
  try {
    await api(
      `/api/projects/${encodeURIComponent(state.project)}/issues/${encodeURIComponent(issueId)}/checklist/checkout`,
      { method: "POST" }
    );
    showToast(`Checked out ${branch}`, "ok");
    await selectProject(state.project); // refreshes branch label + issue list statuses
    const liEl = [...el.issueList.children].find((li) => li.firstChild.textContent === issueId);
    await selectIssue(issueId, liEl);
  } catch (e) {
    showToast("Checkout failed: " + e.message, "error");
    btn.disabled = false;
    btn.textContent = `Checkout ${branch}`;
  }
}

function updateOverallProgress() {
  const checklist = state.checklist;
  let total = 0, passed = 0;
  for (const tc of checklist.tcs) {
    for (const s of tc.steps) {
      total++;
      if (s.checked) passed++;
    }
  }
  el.checklistProgress.textContent = `${passed} / ${total} steps passed`;
}

function renderTcCard(tc, readOnly) {
  const card = document.createElement("div");
  card.className = "tc-card" + (readOnly ? " readonly" : "");
  card.dataset.tcId = tc.id;

  const heading = document.createElement("h3");
  const tcPassed = tc.steps.filter((s) => s.checked).length;
  heading.innerHTML = `${tc.id}: ${escapeHtml(tc.name)} <span class="tc-progress">${tcPassed}/${tc.steps.length}</span>`;
  card.appendChild(heading);

  if (tc.prerequisites.length) {
    const ul = document.createElement("ul");
    ul.className = "prereqs";
    for (const p of tc.prerequisites) {
      const li = document.createElement("li");
      li.textContent = p;
      ul.appendChild(li);
    }
    card.appendChild(ul);
  }

  if (tc.steps.length) {
    const table = document.createElement("table");
    table.className = "steps";
    table.innerHTML = `<thead><tr><th></th><th>#</th><th>Action</th><th>Expected result</th><th>Note</th></tr></thead>`;
    const tbody = document.createElement("tbody");
    for (const step of tc.steps) {
      tbody.appendChild(renderStepRow(tc.id, step, card, readOnly));
    }
    table.appendChild(tbody);
    card.appendChild(table);
  } else if (tc.parseWarnings && tc.parseWarnings.length) {
    const warn = document.createElement("p");
    warn.style.color = "var(--fail)";
    warn.textContent = "Could not parse steps for this TC: " + tc.parseWarnings.join("; ");
    card.appendChild(warn);
  }

  const notesWrap = document.createElement("div");
  notesWrap.className = "tc-notes";
  const label = document.createElement("label");
  label.textContent = "Notes";
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

  const numTd = document.createElement("td");
  numTd.textContent = step.step;
  tr.appendChild(numTd);

  const actionTd = document.createElement("td");
  actionTd.textContent = step.action;
  tr.appendChild(actionTd);

  const expectedTd = document.createElement("td");
  expectedTd.textContent = step.expected;
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
    const res = await api(
      `/api/projects/${encodeURIComponent(state.project)}/issues/${encodeURIComponent(state.issueId)}/checklist/steps`,
      { method: "PATCH", body: JSON.stringify({ tcId, step: stepNum, checked, note }) }
    );
    showToast("Saved", "ok");
    // Keep local model + progress counters in sync without a full re-fetch.
    const tc = state.checklist.tcs.find((t) => t.id === tcId);
    const s = tc.steps.find((s) => s.step === stepNum);
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
    await api(
      `/api/projects/${encodeURIComponent(state.project)}/issues/${encodeURIComponent(state.issueId)}/checklist/notes`,
      { method: "PATCH", body: JSON.stringify({ tcId, notesText }) }
    );
    showToast("Saved", "ok");
  } catch (e) {
    showToast("Save failed: " + e.message, "error");
  }
}

function refreshIssueListProgressBadge() {
  // Cheap local recompute; avoids re-fetching the whole issue list on every keystroke.
  const active = el.issueList.querySelector("li.active .meta");
  if (!active || !state.checklist) return;
  let total = 0, passed = 0;
  for (const tc of state.checklist.tcs) {
    for (const s of tc.steps) {
      total++;
      if (s.checked) passed++;
    }
  }
  const progressSpan = active.querySelector("span:last-child") || active.lastChild;
  if (progressSpan) progressSpan.textContent = ` ${passed}/${total}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

loadProjects().catch((e) => showToast("Failed to load projects: " + e.message, "error"));
