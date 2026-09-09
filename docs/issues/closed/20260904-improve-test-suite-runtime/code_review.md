# Code Review Report

**Issue ID:** 20260904-improve-test-suite-runtime
**Date:** 2026-09-08 (round 1-2), 2026-09-09 (verdict withdrawn)
**Reviewer(s):** Claude (rounds 1-3), Codex (round 4)

---

## Verdict of 2026-09-08: WITHDRAWN

The PASS recorded on 2026-09-08 was wrong. It was given to code that did not
work at all, and the run that "confirmed" it was measuring a broken test
harness. Re-measured on 2026-09-09 (Ubuntu, 12 cores, main working tree):

| Tree | Wall | Suites run | Assertions | Result |
|---|---|---|---|---|
| develop | 194 s | 27 | 1149 | OK |
| this branch as reviewed | 6 s | **1** | 161 | FAILED, 29 failures in converge-fresh.sh |

The "speed-up" was `converge` dying instantly plus `make test` executing one
suite out of 28 and still printing OK — precisely the outcome the issue's hard
constraint ("ускорение не достигается сокращением проверок") forbids.

Two of the defects were reported by the round-2 reviewer and dismissed by this
review as CR-007 "false positive" and CR-008 "риск минимальный". Both were real
and both were P0. That dismissal is the review failure to learn from, not the
code.

## Findings ledger — corrected

| ID | Round | Priority | Description | State |
|----|-------|----------|--------------|-------|
| CR-001 | 1 | P0 | `snapshot_tree` emitted `f ./path` instead of `f path` — manifest format is part of the contract | fixed |
| CR-002 | 1 | P0 | `t7_skills`: per-skill `cp -r` loop, not the batched copy the plan required | superseded by CR-008 |
| CR-003 | 1 | P1 | `t6_mirror_templates`: per-file `cp` loop, not the batched copy the plan required | superseded by CR-009 |
| CR-004 | 1 | P1 | `make lint`: `@` prefix hid shellcheck's findings | fixed |
| CR-005 | 1 | P2 | No live progress during a parallel run — output appears only at the end | open (accepted) |
| CR-006 | 1 | P2 | Measure 6 hypothesis result still `Pending` in brd.md | open — Windows-only, see below |
| CR-007 | 2 | **P0** | `make test`: the whole suite list was piped into one `xargs -P 4 bash -c` without `-n 1`, so only `$1` ran. **1 suite of 28 executed and the run reported OK.** Dismissed in round 2 as a false positive; it was not | fixed 2026-09-09 |
| CR-008 | 2 | **P0** | `t7_skills`: `printf -v brace_srcs '%s/.,'` builds `a/.,b/.,c/.` and calls it brace expansion. Unquoted word splitting splits on spaces, not commas, so `cp -r` received one non-existent path and installed **0 skills**. Dismissed in round 2 as low-risk; it broke the production install path | fixed 2026-09-09 |
| CR-009 | 3 | **P0** | `t6_mirror_templates`: a NUL-delimited `find` list was printed with `printf '%s\n'` and fed to `xargs -0`/`sort -uz`, collapsing it into one string; the `tar` leg additionally ran with cwd ≠ `$TEMPLATES_SRC`. `templates/config`, `templates/global` and `templates/issue` were never mirrored | fixed 2026-09-09 |
| CR-010 | 3 | P1 | `make test` used fixed `/tmp/pf-suites.txt` and `/tmp/pf-suite-*.log`, which the issue's own "must not be weakened" list rules out (`mktemp -d` instead of fixed directories), and `echo 1 >> /tmp/pf-test.rc` made the rc file two lines long, breaking the `-eq` comparison | fixed 2026-09-09 |
| CR-011 | 3 | P1 | `test/lib.sh` `pf_repo_copy`: `cp -a` of a git **worktree** copies `.git` as a pointer file, so git commands "in the copy" mutate the real repository. TC-041's deliberate probe commits landed on the real branch. Guard added; asserted by `safety-audit.sh` step 7 | fixed 2026-09-09 |
| CR-012 | 3 | P1 | The `16a3eaf` commit suppressed SC2086 on the exact line CR-008 describes, silencing the one check that would have caught it | fixed 2026-09-09 (suppression removed with the code) |
| CR-013 | 4 | P1 | [Codex] `converge-to-v3.sh:974` — `cp -f --parents` is a GNU extension; BSD `cp` on macOS has no `--parents`. README.md and scripts/install.sh both advertise Linux/macOS, so T6 would fail there, and the unchecked command lets the run report success with templates missing | fixed |
| CR-014 | 4 | P2 | [Codex] `test/lib.sh:247` — `pf_repo_copy_reset` is not equivalent to a fresh `cp -a` when the source tree is dirty: `git checkout -- .` + `git clean -fdx` wipe the uncommitted state the first mutation ran against, so results become order-dependent. Note this contradicts prompt.md's own reason for rejecting `git clone --local` (uncommitted work must be under test) | fixed |
| CR-015 | 4 | P2 | [Codex] `test/lib.sh:366` — `snapshot_tree`'s single pipeline is not filename-safe: `xargs -0` without `-r` runs `sha256sum` on an empty list (fake `-` entry), and `awk $2` truncates names containing spaces. The per-file loop it replaced was safe, so measure 1 introduced this | fixed |
| CR-016 | 4 | P2 | [Codex] `test/safety-audit.sh:126` — step 7 greps for the phrase `is a git worktree`, which survives in comments after the guard itself is deleted; it asserts prose, not behaviour | fixed |
| CR-017 | 5 | P2 | [Codex] `pf_repo_copy_reset` used `git clean -fdx`, deleting ignored files (e.g. `.claude/`) that `pf_repo_copy` had copied, so later cases saw a different tree than the first. A first attempt (hard-fail on a dirty tree) turned out to break the ordinary edit-and-rerun loop — `make test` went red on any uncommitted change | fixed — `clean -fd` plus a hybrid: fast reset on a clean tree, fresh copy per case on a dirty one, announced in the output rather than silent |
| CR-018 | 5 | P2 | [Codex] `converge-to-v3.sh` phase 6 called `t6_mirror_templates` without checking its status, so a missing templates source or a failed mirror copy still exited 0 with a success report. Pre-existing on develop (the `return 1` for a missing source was already discarded); the new error-checked copy makes it reachable more often | fixed — status now sets EXIT_CODE |

## Note on measure 6

Measure 6 is a Windows 11 Dev Drive / Defender hypothesis. It is not testable on
this machine and its `Pending` result stays pending; it is not a gate for this
issue on Linux.

---

## Verdict

**PASS**

After round 5.

Round 4 (Codex): one P1 + three P2, all fixed. Round 5 (Codex, re-review of the
fix diff): no P0/P1; two P2, both fixed rather than deferred. No finding is left
`open`, and no P0/P1 was ever resolved by anything but a fix.

Reviewer: Codex (`codex review --base develop`, codex-cli 0.152.1,
authenticated on this machine — unlike the 08.09 run, no silent fallback to
self-review occurred).

Verification after the last fix: `make test` OK — 27 suites, 1151 assertions;
`make lint` OK; `make test-migration` OK — 193 assertions.
