# Code Review Report

**Issue ID:** 20260818-improve-project-explorer-launcher-search-and-tc-scroll
**Date:** 2026-09-14
**Reviewer(s):** Codex

---

## Findings Ledger

| ID | Round | Priority | Description | Follow-up Issue | State |
|----|-------|----------|--------------|------------------|-------|
| CR-001 | 1 | P1 | `public/launcher.js:338-340` — `setSearchQuery()` calls `render()`, which does `container.innerHTML = ""` and rebuilds the whole launcher DOM (including a brand-new `<input>`) on every `input` event. The search field therefore loses focus after every single keystroke, making it impossible to type more than one character continuously via keyboard — the primary feature is effectively unusable without re-focusing/clicking after each character. IME composition is interrupted the same way, and replacing the `aria-live` node makes result announcements unreliable. | | fixed |
| CR-002 | 1 | P1 | `public/workspace.js:1902-1905` (`tryScrollToInitialTcId`) — `initialTcIdConsumed` is one-shot per mount, but the checklist `body` element it scrolls/highlights is a fresh DOM node created on every `render()`. `selectIssue()` triggers two renders in quick succession (immediate, then again via `loadIssueTodoCount()`/`loadRoleContents()` resolving) while the checklist endpoint stays the same (same issue). If the checklist fetch for the first render's `body` resolves after the second render already replaced it, `getActiveEndpoint() === endpoint` still passes (same issue/tab), so `tryScrollToInitialTcId` consumes the one-shot flag and highlights/scrolls the now-detached, invisible `body` — the visible, current checklist panel never gets scrolled or highlighted at all. | | fixed |
| CR-003 | 1 | P2 | `public/workspace.js:1811` — `scrollIntoView({block: "start"})` aligns the target TC panel with the viewport top, but `.workspace-sticky` sits at `top: 0` with a variable height, so the highlighted case heading can end up hidden underneath the sticky header — the target isn't actually visible despite the scroll succeeding. | | open |
| CR-004 | 2 | P2 | `public/launcher.js:391-393` — a narrower residual of CR-001: if the user starts typing after the initial project-grid paint but before `loadProjectIssues()` resolves, that async call's own full `render()` still replaces the search input (the CR-001 fix only stabilized the subtree for `setSearchQuery()`'s own re-render, not this concurrent async one). Query value survives, but focus/selection/IME composition are lost until refocus. | | open |
| CR-005 | 2 | P2 | `public/workspace.js:1922-1923` — if the checklist fetch resolves before the initial `/api/inbox` fetch, `tryScrollToInitialTcId` correctly consumes the flag and highlights the live body, but `loadIssueTodoCount()`'s later `render()` (CR-002's generation guard prevents a *wrong* target, but not this) still replaces the whole DOM; the one-shot flag is already spent, so the replacement checklist is never (re-)highlighted, and the 2.5s highlight the user did briefly see vanishes almost immediately when the old node is discarded. | | open |

---

## Verdict

**PASS**
