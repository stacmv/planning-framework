# Manual Test UI

A small local web tool for running the manual test checklists the `pf-test`
skill generates (`docs/issues/{open,closed}/<ISSUE-ID>/manual_test_checklist.md`).
It scans every project you point it at, lists all TCs with their steps and
prerequisites, and lets you tick pass/fail with a note per step — writing the
result straight back into the same markdown file `/pf-qa` and `/pf-close`
already read.

No database, no npm dependencies. It only ever edits the working tree, and
the only git command it ever runs that changes anything is `git checkout` of
an issue's own branch — and only right after you click a confirm button in
the UI. Committing stays the job of `/pf-close`.

**Issues are listed from the project's default branch, not the checked-out
one.** An issue's folder (`prompt.md`, `brd.md`, ...) lands on `develop`/`main`
as soon as `/pf-execute` starts it, well before its `manual_test_checklist.md`
exists anywhere — so the tool always enumerates issues via `git ls-tree`
against the default branch (auto-detected: `develop`, then `main`, then
`master`; override per-project with a `"defaultBranch"` field in
`projects.json`). This is also why an issue never disappears just because
you happen to have some *other* issue's branch checked out.

For each issue found this way, its checklist is one of three states:

| State | Meaning | Editable? |
|---|---|---|
| `here` | On disk right now, on the checked-out branch | Yes |
| `on_branch` | Not on disk; lives on the issue's own `issue/<ID>` branch (created, not merged) | Read-only preview (via `git show`) — a **Checkout** button in the banner switches to it after you confirm |
| `missing` | No `manual_test_checklist.md` anywhere yet | No — run `/pf-test` first |

Checkout is refused (409, nothing touched) if the project's working tree has
uncommitted changes — commit or stash them yourself first. This mirrors
plain `git checkout`'s own safety behavior; the tool doesn't add `-f`
anywhere.

## Setup

```bash
cp projects.json.example projects.json
```

The example ships with `{"projectRoots": ["D:/dev"]}` — point it at whatever
directory holds your projects and it auto-discovers every immediate
subdirectory containing a `docs/issues/` folder (one level deep only, so it
won't wander into `node_modules` or nested checkouts). No per-project listing
needed. `projects.json` is gitignored — it's a per-machine path.

Need to rename a discovered project, pin its default branch, or include a
project that lives outside your scanned root? Add it explicitly — see
`projects.json` fields below; explicit entries win over auto-discovery for
the same path.

## Run

From the `planning-framework` root:

```bash
make test-ui
```

or directly:

```bash
node tools/manual-test-ui/server.js [--port 4317]
```

Then open the printed `http://localhost:<port>` URL.

## How it edits files

Every save is a single targeted line replacement, re-derived from a fresh
read of the file each time (so two tabs open on the same issue can't clobber
each other's edits with a stale line number). Nothing else in the file is
touched — headings, prose, formatting, and untouched TCs stay byte-identical.

The checklist format has no true "not run / passed / failed" tri-state — a
step's `Result` cell is either `[x]` (passed) or `[ ]` (not passed, for any
reason: not yet run, or run and failed). This mirrors the file format `pf-test`
generates and `pf-qa`/`pf-close` parse; the UI doesn't invent a state the
underlying files can't represent. Use the per-step note to record *why* a
step is unchecked when it was actually run and failed.

## API (for reference / scripting)

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/api/projects` | — | configured projects + current/default branch + issue counts |
| GET | `/api/projects/:name/issues` | — | every issue known to the default branch, with `checklistStatus` |
| GET | `/api/projects/:name/issues/:id/checklist` | — | full parsed checklist (works read-only for `on_branch` too) |
| POST | `/api/projects/:name/issues/:id/checklist/checkout` | — | `git checkout` the issue's branch; 409 if the tree is dirty |
| PATCH | `/api/projects/:name/issues/:id/checklist/steps` | `{tcId, step, checked, note}` | patch one step; 409 unless `checklistStatus` is `here` |
| PATCH | `/api/projects/:name/issues/:id/checklist/notes` | `{tcId, notesText}` | patch a TC's free-text notes; same 409 guard |

`:name` must match an entry in `projects.json`; `:id` must match the issue-ID
pattern (`YYYYMMDD-{feat,improve,bug}-slug`) and be known to the project
(on disk or on the default branch) — both are validated server-side to
prevent path traversal.

## `projects.json` fields

```json
{
  "projectRoots": ["D:/dev"],
  "projects": [
    { "name": "goal-attacker", "path": "D:/dev/ga" },
    { "name": "other-repo", "path": "D:/dev/other", "defaultBranch": "main" }
  ]
}
```

- `projectRoots` — directories to scan one level deep for auto-discovery.
  Each subdirectory containing `docs/issues/` becomes a project, named after
  its folder (e.g. `D:/dev/ga` → `"ga"`).
- `projects` — explicit entries, for renaming a discovered project (as
  above — `D:/dev/ga` shows as `"goal-attacker"` instead of `"ga"`), pinning
  `defaultBranch`, or including a project outside any scanned root. Matched
  by resolved path against `projectRoots` results, so there's never a
  duplicate entry for the same project under two names.

`defaultBranch` is optional on an explicit entry — omit it to auto-detect
(`develop`, then `main`, then `master`, then whatever's currently checked out
as a last resort). Auto-discovered projects always auto-detect.
