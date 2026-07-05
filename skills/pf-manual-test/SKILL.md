---
name: pf-manual-test
description: Launch the local Manual Test UI for filling in manual_test_checklist.md interactively, across this and other configured projects
version: 3.0.0
---

This skill launches **Manual Test UI** — a small local web tool for running
the manual test checklists `/pf-test` generates. It lists every issue known
to the project's default branch (`develop`/`main`), even ones whose checklist
only exists on their own unmerged `issue/<ID>` branch — the UI offers a
confirm-then-checkout button for those. It never commits anything; that
stays the job of `/pf-close`.

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

Wait briefly, then confirm it started by checking the log file or re-probing the port.

## Step 5: Report

Print:

```
Manual Test UI running at http://localhost:<port>

Projects configured: <comma-separated list>

Open the URL, pick this project and issue, and check off steps as you go —
every save writes straight into manual_test_checklist.md. If an issue's
checklist lives on its own branch, the UI will offer to check it out for you
(it asks for confirmation first, and refuses if you have uncommitted changes).
When you're done, come back here and I'll re-run /pf-test and /pf-qa to fold
your results in.
```

## Important Notes

- **Never commit.** This skill and the tool it launches must never run `git add`/`git commit`. That stays with `/pf-close`.
- **The tool may run `git checkout`, but only from the UI, only on explicit confirmation, and only for the issue's own branch.** Don't replicate that behavior from this skill directly (e.g. don't checkout a branch on the user's behalf while setting things up) — that's the tool's job, gated by its own UI confirmation, not this skill's.
- **One server is enough.** Don't spawn duplicate instances — check the port first.
- **Don't guess the framework path.** If `PLANNING_FRAMEWORK_HOME` isn't set and the user doesn't know the path either, stop and ask rather than assuming a default like `D:/dev/planning-framework` — that's this machine's layout, not a guarantee.
