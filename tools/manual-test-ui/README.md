# Manual Test UI

A small local web tool for reading a Planning Framework issue and running the
manual test checklists the `pf-test` skill generates
(`docs/issues/{open,closed}/<ISSUE-ID>/manual_test_checklist.md`). It scans
every project you point it at, shows each issue through the eyes of one of
three roles — analyst, developer, tester — and lets you tick pass/fail with a
note per step, writing the result straight back into the same markdown file
`/pf-qa` and `/pf-close` already read.

No database, no npm dependencies. Node's standard library and nothing else, on
both sides: the server, the browser modules it serves, and the `setup.mjs`
scripts it runs. Clone the repository and start it; there is no install step,
and adding one would break `test/manual-test-ui.sh` (TC-015).

**Read-only, with exactly three exceptions**, each of them requiring an
explicit click and a confirmation:

1. a checklist cell — `PATCH .../checklist/steps` and `.../checklist/notes`;
2. the checked-out branch — `POST .../checklist/checkout`;
3. a prepared working copy of a case's test data, under the system temp
   directory and never inside the repository — `POST .../issues/:id/prepare`.

Nothing else writes anywhere, and none of the three ever commits. Committing
stays the job of `/pf-close`.

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

## Roles

Roles are the top level of the UI: a tab strip above everything else, always
live. Switching a role never loses the selected project or issue, and it works
with a document open — the same issue simply shows a different set of
documents.

| Role | What it answers | Entries |
|---|---|---|
| **Analyst** | The problem as stated and as understood | `prompt.md`, `brd.md`, `analysis.md`, `notes.md`, `PLANNING.md`, `docs/planning/decisions.md` |
| **Developer** | What has to be built, and under what rules | `specs.md`, `implementation_plan.md`, `docs/planning/implementation-plan.md`, `docs/planning/session-log.md`, project instructions (every `CLAUDE.md` in force), accumulated memory |
| **Tester** | What to verify, how it is checked off, and the data a case needs | `test_plan.md`, `manual_test_checklist.md`, `qa_report.md`, `.qa-workflow.md`, **Prepare test data** |

The table lives in one place only — `lib/roles.js`, served to the browser as
`GET /api/roles`. The client keeps no list of documents of its own, so a
renamed document is renamed once.

**Every entry carries a state**, decided by the server (`lib/docstate.js`) and
rendered as-is:

- `present` — the file is there. On disk it is read directly; when it exists
  only on the issue's own `issue/<ID>` branch it is previewed read-only via
  `git show`, with the confirm-then-checkout button offered next to it.
- `not_applicable` — the pipeline for *this* issue's type and size tier does
  not produce it (no `specs.md` for an `improve` issue, no `brd.md` for a
  `trivial` one). Existence always wins over this rule: a file that is really
  in the directory is shown, whatever the table says.
- `missing` — applicable, but not written yet; the entry names the stage that
  would create it (`/pf-brd`, `/pf-spec`, `/pf-test`, …).

Type and tier are read from the issue's `prompt.md`; when they are absent the
tool falls back to the `medium` tier and the type encoded in the issue id.

Two entries of the developer role are not files of the repository:

- **Project instructions** — every `CLAUDE.md` in force, the ones inherited
  from parent directories included, with framework templates
  (`docs/planning/templates/**`) and test fixtures (`test/fixtures/**`) listed
  but marked inactive: they are skeletons and samples, not rules.
- **Accumulated memory** — what Claude Code has remembered about the project,
  kept outside the repository in `<memory root>/projects/<slug>/memory/`.
  Session transcripts (`*.jsonl`, `sessions-index.json`) sit next to that
  directory, are never listed and are refused (403) if requested by path.

"There is nothing here" is always a sentence, never an empty panel: no
`CLAUDE.md`, no memory directory and an empty memory directory are three
distinct states with three distinct messages.

Documents are rendered by the tool's own markdown renderer (`lib/markdown.js`,
served to the browser at `/lib/markdown.js`) — which is one of the reasons the
dependency count is zero.

## Preparing test data

The tester role carries one action rather than a document: **Prepare test
data**. It runs the issue's own
`docs/issues/<status>/<ISSUE-ID>/test-data/setup.mjs` — for one case
(`{"tcId": "TC-002"}`) or for every case the issue declares — and unpacks the
result into

```
<system temp dir>/pf-test-data/<ISSUE-ID>/<TC-ID>
```

Four properties, all of them load-bearing:

- **Outside the repository.** The working copy never lands in the checkout, so
  preparing data any number of times leaves `git status --porcelain` byte for
  byte identical, and branch switching and the pre-close QA gate keep working.
  The trade-off is that the working copy does not survive a temp sweep — see
  KI-02 in the issue's test plan; prepare it again.
- **Idempotent.** Every run rebuilds the working copy from the fixtures under
  git: preparing and resetting are the same action. The case is assembled in a
  staging directory and moved into place with a single rename, so an
  interrupted run leaves the case directory either untouched or absent, never
  half-populated.
- **Confirmed, and never through a shell.** The UI asks first, and the route
  refuses without `{"confirm": true}`. The script path is assembled by the
  server from an issue id that already matched the issue-ID pattern — the
  request selects an issue, never a file — and it is started with
  `execFile(process.execPath, [script, tcId])`: no shell, arguments as an
  array, nothing interpolated into a command line.
- **Bounded.** A script that hangs is stopped (60 s by default, see
  `PLANNING_TEST_UI_PREPARE_TIMEOUT_MS`) and its staging directory swept, so
  the next run starts clean with no manual tidying.

The script reports what it prepared on stdout, in two line formats the tool
parses (`PF-PREPARED <TC-ID> <workdir>`, `PF-FILE <TC-ID> <relative path>`);
the UI shows the path, the files, the exit code and the raw output either way.
The template every issue's script is generated from is
`skills/pf-test/templates/setup.mjs`.

### When the button is offered, and when it works

One rule, in `lib/docstate.js`, published to the UI and enforced by the route —
so "the button was greyed out" and "the request was refused" are the same
decision with the same wording, never two:

| Situation | Offered | Enabled | `reason` code |
|---|---|---|---|
| The issue is closed | no | — | `issue_closed` |
| No `manual_test_checklist.md` anywhere yet | no | — | `checklist_not_found` |
| The checklist says the case needs no prepared data | no | — | `data_not_required` |
| The checklist lives only on the issue branch | yes | no — check the branch out first | `not_checked_out` |
| The issue has no `test-data/setup.mjs` | yes | no | `no-setup-script` |
| The checklist does not record what the case needs (written before declared test data) | yes | no — re-run `/pf-test` | `data_need_unknown` |
| The case declares data and the script is there | yes | yes | — |

What the checklist says about a case beats what the issue's directory happens
to contain, and for the issue as a whole the strongest claim wins: one case
that declares data makes the issue-level action available.

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
| GET | `/api/roles` | — | the three roles and the entries each declares; project- and issue-independent |
| GET | `/api/projects` | — | configured projects + current/default branch + issue counts |
| GET | `/api/projects/:name/docs?path=` | — | one document of the project itself; `path` is resolved inside the project root and nowhere else |
| GET | `/api/projects/:name/instructions` | — | every `CLAUDE.md` in force, own and inherited, each flagged active or inactive |
| GET | `/api/projects/:name/memory` | — | the project's memory files (transcripts excluded), or a message saying there are none |
| GET | `/api/projects/:name/memory/file?path=` | — | one memory file; `path` is relative to that project's memory directory. 403 for a transcript |
| GET | `/api/projects/:name/issues` | — | every issue known to the default branch, with `checklistStatus` |
| GET | `/api/projects/:name/issues/:id/roles/:role` | — | the entries of one role for this issue, each with its state, its message and the endpoint to fetch it from |
| GET | `/api/projects/:name/issues/:id/docs?path=` | — | one document of the issue, with its state. `present`, `not_applicable` and `missing` are all **200 with an explanation** — the client renders the explanation, so a state is never an error |
| GET | `/api/projects/:name/issues/:id/checklist` | — | full parsed checklist (works read-only for `on_branch` too), plus the prepare verdict for the issue and for every case |
| POST | `/api/projects/:name/issues/:id/prepare` | `{confirm: true, tcId?}` | run this issue's `test-data/setup.mjs`; omit `tcId` for every declared case |
| POST | `/api/projects/:name/issues/:id/checklist/checkout` | — | `git checkout` the issue's branch; 409 if the tree is dirty |
| PATCH | `/api/projects/:name/issues/:id/checklist/steps` | `{tcId, step, checked, note}` | patch one step; 409 unless `checklistStatus` is `here` |
| PATCH | `/api/projects/:name/issues/:id/checklist/notes` | `{tcId, notesText}` | patch a TC's free-text notes; same 409 guard |
| GET | `/lib/<basename>.js` | — | the modules that load in both Node and the browser — `markdown.js` and `roles.js`, by exact name. Any other name is 403 whether or not the file exists |

`:name` must match an entry in `projects.json`; `:id` must match the issue-ID
pattern (`YYYYMMDD-{feat,improve,bug}-slug`) and be known to the project
(on disk or on the default branch) — both are validated server-side to
prevent path traversal.

Every `path` parameter is resolved through `lib/paths.js`, which compares
*real* paths segment by segment (symlinks resolved) against exactly two
allowed roots: the project directory, and that project's memory directory.
Anything else is a 403 with no content attached; a read that fails is a 4xx,
never a 500. Documents larger than 4 MiB are refused with 413.

Failures of `POST .../prepare` are reported by kind, not lumped together: a
refusal before anything starts uses the code from the table above (404 or
409), a script that exited non-zero is 422, a timeout 504, output over the
4 MiB buffer 413, and a process that could not be started 500. `ran` says
whether the script was started at all.

## Environment variables

| Variable | Default | Effect |
|---|---|---|
| `PLANNING_TEST_UI_CONFIG` | `tools/manual-test-ui/projects.json` | Path to the project list to serve. The tool exits with a message if the file does not exist |
| `PLANNING_TEST_UI_MEMORY_ROOT` | `~/.claude` | Root under which `projects/<slug>/memory/` is looked up. Point it elsewhere to browse another machine's export — and the test suites set it so they never read your real one |
| `PLANNING_TEST_UI_PREPARE_TIMEOUT_MS` | `60000` | How long an issue's `setup.mjs` may run before it is stopped. A non-numeric or non-positive value falls back to the default rather than to "no timeout" |
| `PORT` | `4317` | Port to listen on. `--port <n>` on the command line wins over it |

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

## Tests

```bash
node --test "tools/manual-test-ui/test/*.test.js"   # the tool's own suites
bash test/manual-test-ui.sh                         # TC-001, TC-015, TC-016
```

Both run from `make test`. The node suites drive the real server on an
ephemeral port against generated fixture repositories and their own
`PLANNING_TEST_UI_CONFIG`, so they never touch your project list, your
`~/.claude`, or the framework's working tree.
