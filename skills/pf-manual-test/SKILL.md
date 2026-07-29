---
name: pf-manual-test
description: Launch the local Manual Test UI for filling in manual_test_checklist.md interactively, across this and other configured projects
version: 3.0.0
---

This skill launches **Manual Test UI** — a small local web tool for reading an
issue and running the manual test checklists `/pf-test` generates. It lists
every issue known to the project's default branch (`develop`/`main`), even ones
whose checklist only exists on their own unmerged `issue/<ID>` branch — the UI
offers a confirm-then-checkout button for those. It never commits anything;
that stays the job of `/pf-close`.

The tool is **role-first**: a tab strip of three roles sits above everything,
and each shows the documents that role needs for the selected issue — analyst
(`prompt.md`, `brd.md`, `analysis.md`, `notes.md`, `PLANNING.md`, decisions),
developer (`specs.md`, the plans, every `CLAUDE.md` in force, accumulated
memory), tester (`test_plan.md`, `manual_test_checklist.md`, `qa_report.md`,
`.qa-workflow.md`). A document that does not exist is shown as a state with an
explanation — not applicable to this issue's type and tier, or not written yet
by such-and-such stage — rather than as an error.

The tester role also carries one **action**: *Prepare test data*. On
confirmation it runs the issue's own `test-data/setup.mjs` and unpacks the
declared fixtures of a case into `<system temp dir>/pf-test-data/<ISSUE-ID>/<TC-ID>`
— outside the repository, so `git status` stays unchanged — and re-running it
is the reset. Only issues whose checklist declares test data for a case offer
it; the button explains itself when it is unavailable.

## Step 1: Locate the framework install

Read the `PLANNING_FRAMEWORK_HOME` environment variable.

- If it is set and `$PLANNING_FRAMEWORK_HOME/tools/manual-test-ui/server.js` exists, use it as FRAMEWORK-ROOT.
- If it is unset, or the path doesn't contain that file, ask the user for the path to their `planning-framework` checkout. Once given, tell them to set `PLANNING_FRAMEWORK_HOME` permanently (e.g. in their shell profile) so this step isn't needed again next time, then proceed with the path they gave for this run.

## Step 2: Check configuration

Check whether `FRAMEWORK-ROOT/tools/manual-test-ui/projects.json` exists.

- If it does not exist: copy `projects.json.example` to `projects.json`, then add an entry for the **current** project (its name and absolute path). Tell the user you did this and that they can add other projects by editing that file directly (it's gitignored, per-machine).
- If it exists: check whether the current project is already listed (by path). If not, add it and tell the user you did so. If it's already listed, leave the file untouched.

## Step 3: Check if already running

Before starting a new server, check whether one is already listening (e.g. via `curl -s -o /dev/null http://localhost:<port>/api/projects` for the default port 4317, or by checking for a process bound to that port). If one is already up and serving the expected API, just print its URL and stop here — don't start a second instance.

## Step 4: Launch

From FRAMEWORK-ROOT, start it in the background so it keeps running after this command returns:

```bash
cd "<FRAMEWORK-ROOT>" && (node tools/manual-test-ui/server.js > /tmp/manual-test-ui.log 2>&1 &)
```

(`make test-ui` works too if the user prefers running it themselves, but for this skill, invoke `node` directly so the working directory and log redirection are explicit and don't depend on `make` being on PATH.)

Launch it with no environment overrides unless the user asks. Three exist, and all three default to the right thing: `PLANNING_TEST_UI_CONFIG` (path to `projects.json`), `PLANNING_TEST_UI_MEMORY_ROOT` (where per-project memory is looked up, `~/.claude` by default) and `PLANNING_TEST_UI_PREPARE_TIMEOUT_MS` (how long a `setup.mjs` may run, 60000 by default).

Wait briefly, then confirm it started by checking the log file or re-probing the port.

## Step 5: Report

Print:

```
Manual Test UI running at http://localhost:<port>

Projects configured: <comma-separated list>

Open the URL, pick this project and issue, then pick a role — analyst,
developer or tester — to see that role's documents for it. In the tester
role, check off steps as you go: every save writes straight into
manual_test_checklist.md. If a case needs prepared data, use "Prepare test
data" first — it unpacks a working copy under your temp directory (outside
the repo) and can be re-run any time to reset it. If an issue's checklist
lives on its own branch, the UI will offer to check it out for you (it asks
for confirmation first, and refuses if you have uncommitted changes).
When you're done, come back here and I'll re-run /pf-test and /pf-qa to fold
your results in.
```

## Important Notes

- **Never commit.** This skill and the tool it launches must never run `git add`/`git commit`. That stays with `/pf-close`.
- **The tool changes exactly three things, each on explicit confirmation:** a checklist cell, the checked-out branch (`git checkout` of the issue's own branch), and the prepared working copy of a case's test data under the system temp directory. Everything else it does is reading. Don't replicate any of the three from this skill directly (e.g. don't checkout a branch or run a `setup.mjs` on the user's behalf while setting things up) — that's the tool's job, gated by its own UI confirmation, not this skill's.
- **Preparing test data never touches the repository.** The working copy goes to `<system temp dir>/pf-test-data/<ISSUE-ID>/<TC-ID>`; if a tester reports the data is gone (a temp sweep, a reboot), the answer is to prepare it again, not to look for it under `docs/issues/`.
- **No dependencies, ever.** The tool runs on Node's standard library alone. Never `npm install` anything for it, and never add a package to make a step easier — `test/manual-test-ui.sh` (TC-015) fails on a manifest, a lockfile, a `node_modules/` or a single non-builtin import.
- **One server is enough.** Don't spawn duplicate instances — check the port first.
- **Don't guess the framework path.** If `PLANNING_FRAMEWORK_HOME` isn't set and the user doesn't know the path either, stop and ask rather than assuming a default like `D:/dev/planning-framework` — that's this machine's layout, not a guarantee.
