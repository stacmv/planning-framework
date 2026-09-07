#!/usr/bin/env bash
# test/pf-roles-human-actor.sh — TC-027, TC-028 for issue
# 20260806-feat-project-explorer-redesign.
#
# Both TCs are static/grep-based audits of skill Markdown files (a code-review
# style audit found no automated test asserting either, though both were
# implemented correctly per direct code reading):
#
#   TC-027 (steps 1-3) — skills/pf-roles/SKILL.md §2's default `agents.yml`
#     example gained a `human: { kind: human, inbox: project-explorer }`
#     entry, and the resolver's old hard-stop for `kind: human` (which used to
#     error out, referencing this issue's earlier name
#     `20260806-improve-project-explorer-redesign`) was removed entirely, not
#     just reworded — the resolver now returns a structured
#     `{ kind: "human", ... }` result to its caller instead.
#
#   TC-028 — skills/pf-close/SKILL.md's Phase 0 gained a human-task-completion
#     check (item 4): every pipeline key that resolves to `kind: human` — via
#     its `write` actor OR any actor in its `review[]` list — must carry a
#     `[human-task done] <key> @ <ts> content-hash=<sha256>` marker in
#     session-log.md before /pf-close proceeds. skills/pf-autopilot/SKILL.md's
#     work loop (Step 2/item 6) gained matching handling: if /pf-close stops
#     on unresolved human-tasks, delete the cron schedule immediately and end
#     the run with a report, instead of retrying uselessly on the next resume.
#
# Read-only. Greps skills/*/SKILL.md only — touches no $HOME, runs no script,
# mutates nothing (S-5 is not implicated: nothing here writes anywhere).

# shellcheck source=test/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lib.sh"

ROLES="$REPO_ROOT/skills/pf-roles/SKILL.md"
CLOSE="$REPO_ROOT/skills/pf-close/SKILL.md"
AUTOPILOT="$REPO_ROOT/skills/pf-autopilot/SKILL.md"

printf '=== TC-027: agents.yml default gains human; kind: human hard-stop removed\n'
# ══════════════════════════════════════════════════════════════════════════════

if [ ! -f "$ROLES" ]; then
  pf_fail "TC-027: skills/pf-roles/SKILL.md does not exist"
else
  # ─── step 1: default agents.yml example carries the human actor ────────────
  if grep -qE 'human:[[:space:]]*\{[[:space:]]*kind:[[:space:]]*human' "$ROLES"; then
    pf_pass "TC-027 step 1: default agents.yml example in pf-roles/SKILL.md carries a human: { kind: human, ... } entry"
  else
    pf_fail "TC-027 step 1: no human: { kind: human, ... } entry found in pf-roles/SKILL.md's default agents.yml example"
  fi

  # ─── step 2: no leftover reference to this issue's earlier stale name ──────
  if grep -q '20260806-improve-project-explorer-redesign' "$ROLES"; then
    pf_fail "TC-027 step 2: stale issue-id 20260806-improve-project-explorer-redesign still referenced in pf-roles/SKILL.md"
  else
    pf_pass "TC-027 step 2: no leftover reference to the stale issue-id 20260806-improve-project-explorer-redesign"
  fi

  # ─── step 3: the old hard-stop error text for kind: human is gone ──────────
  # The earlier behaviour errored out on kind: human with wording along the
  # lines of "actor '<name>' is kind: human — not supported until <issue>".
  # None of that phrasing (nor a generic "not supported"/"unsupported" framing
  # around kind: human) should remain now that it is a normal, non-error
  # resolution outcome.
  if grep -qiE "kind: human.*(not supported|unsupported)|(not supported|unsupported).*kind: human" "$ROLES"; then
    pf_fail "TC-027 step 3: leftover 'not supported'/hard-stop wording for kind: human still present in pf-roles/SKILL.md"
  else
    pf_pass "TC-027 step 3: no leftover hard-stop/'not supported' wording for kind: human in pf-roles/SKILL.md"
  fi

  # Positive confirmation that the replacement text is the one specs.md calls
  # for: the resolver returns a structured result instead of stopping.
  if grep -qE '\{[[:space:]]*kind:[[:space:]]*"human"' "$ROLES" && grep -qi 'not.*hard-stop' "$ROLES"; then
    pf_pass "TC-027 step 3: pf-roles/SKILL.md documents kind: human as a structured non-error result"
  else
    pf_fail "TC-027 step 3: pf-roles/SKILL.md does not clearly document kind: human as a structured non-error result"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
printf '=== TC-028: pf-close Phase 0 human-task check; pf-autopilot cron-delete-on-stop\n'
# ══════════════════════════════════════════════════════════════════════════════

if [ ! -f "$CLOSE" ]; then
  pf_fail "TC-028: skills/pf-close/SKILL.md does not exist"
else
  # ─── step 2: Phase 0 human-task check covers write AND review[] ────────────
  if grep -q '\[human-task done\]' "$CLOSE"; then
    pf_pass "TC-028 step 2: pf-close/SKILL.md's Phase 0 checks for the [human-task done] marker"
  else
    pf_fail "TC-028 step 2: no [human-task done] marker check found in pf-close/SKILL.md"
  fi

  # The fix this TC guards: the check must resolve BOTH the write actor and
  # every actor in review[] to kind: human — checking write only was the
  # earlier, incomplete version.
  if grep -qE 'review\[\]' "$CLOSE" && grep -qi 'write' "$CLOSE" && grep -qi 'do not check .*write only\|not.*write only\|OR whose' "$CLOSE"; then
    pf_pass "TC-028 step 2: pf-close/SKILL.md's human-task check covers both the write actor and review[] resolving to kind: human"
  else
    pf_fail "TC-028 step 2: pf-close/SKILL.md's human-task check does not clearly cover both write and review[] resolving to kind: human"
  fi

  # ─── step 4: stale-marker (content-hash mismatch) handling ─────────────────
  if grep -qi 'content-hash' "$CLOSE" && grep -qiE 'stale|does not match' "$CLOSE"; then
    pf_pass "TC-028 step 4: pf-close/SKILL.md treats a content-hash mismatch as not-done (stale)"
  else
    pf_fail "TC-028 step 4: pf-close/SKILL.md does not document stale/mismatched content-hash handling"
  fi
fi

if [ ! -f "$AUTOPILOT" ]; then
  pf_fail "TC-028 step 5: skills/pf-autopilot/SKILL.md does not exist"
else
  # ─── step 5: autopilot deletes the cron schedule and stops on this block ───
  if grep -qi 'CronDelete' "$AUTOPILOT" && grep -qi 'human-task' "$AUTOPILOT"; then
    pf_pass "TC-028 step 5: pf-autopilot/SKILL.md's work loop calls CronDelete when /pf-close stops on unresolved human-tasks"
  else
    pf_fail "TC-028 step 5: pf-autopilot/SKILL.md does not document CronDelete on an unresolved-human-task stop from /pf-close"
  fi

  # It must not just delete the schedule — it must also NOT retry on the next
  # resume (the run-ending, not stage-to-retry, framing).
  if grep -qiE 'not.*retry|do not let.*resume|end the run' "$AUTOPILOT"; then
    pf_pass "TC-028 step 5: pf-autopilot/SKILL.md documents this as run-ending, not a stage to retry on the next resume"
  else
    pf_fail "TC-028 step 5: pf-autopilot/SKILL.md does not clearly document this as run-ending rather than retried"
  fi
fi

pf_summary
