---
name: pf-autopilot
version: 3.1.0
description: Drive the active Planning Framework issue to /pf-close autonomously, surviving session limits and connection drops. Sets up a self-resume schedule (CronCreate) before starting work, walks the remaining pipeline stages, and removes the schedule once the issue is closed. Use when the user says "drive the issue to /pf-close", "autonomous mode", "гони issue до закрытия", "запланируй автоматическое продолжение работы", "продолжай, пока issue не будет закрыт", "поставь croncreate на каждые N часов".
---

# pf-autopilot — drive the active issue to /pf-close autonomously

Goal: the user launches this once — the issue then rides to closure on its own, surviving session limits ("You've hit your session limit") and connection drops ("API Error: Connection closed mid-response"), with no manual "continue" prompts.

## Step 0. Context

1. Determine the project (current working directory) and the active issue: scan `docs/issues/open/` exactly as `/pf` does. If there is no open issue — stop and say so; autopilot has nothing to drive.
2. Run `/pf` to learn the current pipeline stage and the next step.

## Step 1. Safety-net schedule (before starting work, not after)

1. Check via `CronList` whether a task named `pf-autopilot-<project-name>` already exists.
2. If not, create it via `CronCreate`:
   - name: `pf-autopilot-<project-name>`;
   - interval: every 2 hours (or the interval the user named);
   - task prompt: `cd <absolute project path>; /pf-autopilot continue` — the resumed session re-enters this skill, and Step 0 re-derives the actual current stage.
3. Tell the user in one line: what was scheduled, at what interval, and how to remove it manually (`CronDelete pf-autopilot-<project>`).

The schedule is created **before** substantive work: its whole point is to survive an interruption that happens in the middle.

## Step 2. Work loop

Repeat until the issue is closed:

1. `/pf` → next stage → run the corresponding skill (`/pf-brd`, `/pf-spec`, `/pf-check`, `/pf-test-plan`, `/pf-impl-plan`, `/pf-execute`, `/pf-test`, `/pf-qa`, `/pf-close`).
2. Questions to the user (BRD/spec stages, overwrite-or-keep output gates) go through `AskUserQuestion` under the standard rule: a timeout is NOT a "no" — repeat the same questions up to 3 times; only after the third unanswered attempt proceed with the recommended option, and record every assumed default in the issue's `session-log.md` marked `[autopilot default]`.
3. After each completed stage — commit (Conventional Commits) and push the issue branch: an interruption must not lose work.
4. If a sub-agent dies with "API Error: Connection closed mid-response" — immediately retry that same task once; don't wait for the cron resume.
5. Honor the environment's global conventions (e.g. cheaper models for sub-agents, verify-before-claim: a stage isn't "done" without a real run).

## Step 3. Completion

When `/pf-close` has successfully closed the issue:

1. Delete the schedule: `CronDelete pf-autopilot-<project>`. This step is mandatory — orphaned cron tasks wake sessions for nothing.
2. Final report: which stages were completed, which defaults were assumed on timeout, link to the closed issue.

## Limits

- One autopilot run = one project and one issue. A new issue means a new launch.
- Autopilot does not pick or create issues on its own.
- Destructive or outward-facing actions outside the pf pipeline (production deploy, publishing) are not performed unless the user's original request explicitly allowed them.
