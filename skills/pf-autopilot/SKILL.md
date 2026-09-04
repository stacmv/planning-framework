---
name: pf-autopilot
version: 3.2.0
description: Drive one Planning Framework issue to /pf-close autonomously, surviving session limits and connection drops. Takes an optional issue ID (`/pf-autopilot [ISSUE-ID]`) and pins it for the whole run, so it works when several issues are open. Sets up a self-resume schedule (CronCreate) before starting work, walks the remaining pipeline stages, and removes the schedule once the issue is closed. Use when the user says "drive the issue to /pf-close", "autonomous mode", "гони issue до закрытия", "запланируй автоматическое продолжение работы", "продолжай, пока issue не будет закрыт", "поставь croncreate на каждые N часов".
---

# pf-autopilot — drive the active issue to /pf-close autonomously

Goal: the user launches this once — the issue then rides to closure on its own, surviving session limits ("You've hit your session limit") and connection drops ("API Error: Connection closed mid-response"), with no manual "continue" prompts.

## Step 0. Context — which issue is being driven

Autopilot takes an optional issue ID: `/pf-autopilot [ISSUE-ID]`, and `/pf-autopilot continue <ISSUE-ID>` on a scheduled resume. **The ID, once resolved, is pinned for the whole run** — every later step targets that issue and no other.

1. Determine the project (current working directory) and scan `docs/issues/open/`.
2. Resolve the target issue:
   - **No open issue at all** — stop and say so; autopilot has nothing to drive.
   - **An ID was given** — it must be a folder in `docs/issues/open/`. If it is not, stop with the list of open issues and the message "No open issue `<ID>`. Autopilot drives an existing open issue; it does not create one." Never fall back to a different issue: a wrong guess spends hours on the wrong work and commits it to the wrong branch.
   - **No ID and exactly one open issue** — that issue is the target.
   - **No ID and several open issues** — ask via `AskUserQuestion` which one to drive, listing them with their current stage. Under the Step 2 timeout rule (3 unanswered attempts), fall back to the **newest by the `YYYYMMDD` date in the folder name**, and record the fallback in that issue's `session-log.md` marked `[autopilot default]`. State the pinned issue in the run's first report line either way.
3. Run `/pf` to learn the current pipeline stage and the next step. `/pf` halts on multiple open issues and asks which one — answer it with the pinned ID rather than stopping the run.

**Pin the ID everywhere it can be lost:** the cron prompt (Step 1), every `/pf` interaction (Step 2), and the closing report (Step 3). A resumed session has no memory of this one — the ID must travel in the scheduled task itself.

## Step 1. Safety-net schedule (before starting work, not after)

1. Check via `CronList` whether a task named `pf-autopilot-<project-name>` already exists. **One autopilot per project, never two** — two autonomous sessions in one repository race each other for the working tree, the branch and the commits.
   - If a task exists **for the pinned issue** (its prompt names the same ID), this is a resume: keep it, do not recreate it.
   - If a task exists **for a different issue**, stop and say which issue is already being driven, offering the two ways out: let it finish, or `CronDelete pf-autopilot-<project>` and relaunch on this one. Do not silently retarget the existing schedule.
2. If no task exists, create it via `CronCreate`:
   - name: `pf-autopilot-<project-name>` (the project, not the issue — that is what keeps the "one per project" rule enforceable);
   - interval: every 2 hours (or the interval the user named);
   - task prompt: `cd <absolute project path>; /pf-autopilot continue <ISSUE-ID>` — the resumed session re-enters this skill with the issue pinned, and Step 0 re-derives the actual current stage for **that** issue. The ID is not optional here: a resume that has to guess is the failure this argument exists to prevent.
3. Tell the user in one line: which issue is pinned, what was scheduled, at what interval, and how to remove it manually (`CronDelete pf-autopilot-<project>`).

The schedule is created **before** substantive work: its whole point is to survive an interruption that happens in the middle.

## Step 2. Work loop

Repeat until the issue is closed:

1. `/pf` → next stage → run the corresponding skill (`/pf-brd`, `/pf-spec`, `/pf-check`, `/pf-test-plan`, `/pf-impl-plan`, `/pf-execute`, `/pf-test`, `/pf-qa`, `/pf-close`, `/pf-idea`, `/pf-idea-research`, `/pf-idea-critique`, `/pf-idea-verdict`, `/pf-idea-spike`) — always against the pinned issue. When `/pf` lists several open issues and asks which one, answer with the pinned ID; that prompt is not a stop for autopilot. **Invoke `/pf-check` as `/pf-check autopilot`** so its review gate resolves itself — Fix now for P0/P1, continue otherwise — instead of stopping for a human; see `~/.claude/skills/pf-check/SKILL.md` ("Autopilot mode"). This is what keeps an unattended run from stalling at every check gate.
2. Questions to the user (BRD/spec content Q&A, overwrite-or-keep output gates) go through `AskUserQuestion` under the standard rule: a timeout is NOT a "no" — repeat the same questions up to 3 times; only after the third unanswered attempt proceed with the recommended option, and record every assumed default in the issue's `session-log.md` marked `[autopilot default]`. The `/pf-check` review gate ("How would you like to proceed?") is **not** one of these — it is resolved non-interactively by pf-check's Autopilot mode (item 1), not by waiting out three timeouts.
3. After each completed stage — commit and push per `~/.claude/skills/pf-git/SKILL.md` ("Stage commit & push"). The stage skills already do this themselves; this line stays as the backstop for a stage that ended without it. An interruption must not lose work.
4. If a sub-agent dies with "API Error: Connection closed mid-response" — immediately retry that same task once; don't wait for the cron resume.
5. Honor the environment's global conventions (e.g. cheaper models for sub-agents, verify-before-claim: a stage isn't "done" without a real run).
6. **`on_unavailable: wait` stops on its own, not a run failure.** When a stage's dispatch hits the Availability check (`~/.claude/skills/pf-roles/SKILL.md` §11) and the issue's `on_unavailable` policy resolves to `wait` (explicitly, or `degrade-tier`/`switch-provider` falling through with no alternative), that stage stops itself with a clear message — do not treat this as an autopilot error or retry it in a loop. It is simply undone until the next scheduled resume (Step 1's `CronCreate` interval) finds the actor's window recovered and `/pf` re-enters the same stage. Report the wait in the run's next status line the same way an `[autopilot default]` assumption is reported.
7. **Stop before the final human gate, never apply the 3-attempts rule to it — for both new types.** When the pinned issue is `idea`-type and its next step is `/pf-idea-verdict (decision session)`, OR the pinned issue is `spike`-type and its next step is `/pf-close` (spike has no separate decision session — `/pf-close`'s Phase 1 confirmation IS its one human gate, see `~/.claude/skills/pf-interaction/SKILL.md` "One final human gate per issue — not two") — stop the work loop there instead of invoking the next step. Print the final report (below) immediately; do not delete the schedule here — deletion is `/pf-close`'s job now (its own Phase 9 addition, for these two types), not this step's, precisely so that a human who completes the close by hand (without autopilot ever resuming again) still gets the schedule cleaned up. Until `/pf-close` runs, the next scheduled resume finds the same state and stops again.

## Step 3. Completion

When `/pf-close` has successfully closed the **pinned** issue:

1. Delete the schedule: `CronDelete pf-autopilot-<project>`. This step is mandatory — orphaned cron tasks wake sessions for nothing. Delete it even when other issues remain open: the schedule was pinned to the issue just closed, and autopilot never rolls on to a neighbouring issue by itself. **For `TYPE: idea`/`spike`, this deletion is normally already done by `/pf-close`'s own Phase 9 addition by the time this step would run for the closing invocation — this step's own `CronDelete` call is therefore usually a no-op (idempotent) for these two types, not a duplicate deletion attempt to avoid. It remains the primary deletion path for feat/improve/bug, whose `/pf-close` does not carry that Phase 9 addition.**
2. Final report: the pinned issue ID, which stages were completed, which defaults were assumed on timeout, link to the closed issue.

**Stopping before the final human gate (Step 2, item 7) is not this Completion step** — the issue is not yet closed. For `idea`/`spike`, print an interim report instead, immediately before stopping: the pinned issue ID, which stages were completed, which defaults were assumed on timeout so far, and the human gate now waiting (decision session or `/pf-close`). Additionally, this interim report enumerates the **full list of `[assumed]` lines and open questions from `open_questions.md`** verbatim, so the human walks into the gate with the complete ledger in front of them, not just a pointer to the file.

## Limits

- One autopilot run = one project and one issue, pinned at Step 0. A new issue means a new launch.
- One schedule per project. Driving two issues of the same repository at once is not supported — they would race for the working tree and the branch.
- Autopilot does not pick or create issues on its own. The one exception is the timeout fallback in Step 0 (several open issues, no answer after 3 attempts → the newest by date), and it is logged as `[autopilot default]`.
- Destructive or outward-facing actions outside the pf pipeline (production deploy, publishing) are not performed unless the user's original request explicitly allowed them.
