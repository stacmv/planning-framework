# Test fixtures

Frozen, hand-built source projects the test suites run against. Twelve fixtures:
eleven are starting states the convergence script (`scripts/converge-*.sh`) must
converge from; the twelfth (`pf-close-basic/`) is a minimal git-project the
`/pf-close` suite (`test/pf-close.sh`) builds branches and upstreams on top of.

> The script's exact filename is deliberately not spelled out anywhere under `test/`
> except inside `_pf_converge_exec` in `lib.sh`. That single occurrence is the only
> place allowed to invoke it, so every call is forced through the wrappers that set
> `HOME=$TMP_HOME`. TC-032 enforces this by counting occurrences — a second one
> anywhere in `test/` fails the suite. See safety rule S-1.

---

## Ground rules

**1. Fixtures are hand-built, not generated.**
You cannot snapshot a v2 project by running `scripts/setup-planning-v2.sh` —
it can no longer produce a complete one. Commit `4a17bb7` deleted
`scripts/create-issue.sh` and `scripts/close-issue.sh`, and
`setup-planning-v2.sh:126` copies them behind an `if [ -f … ]` guard, so today
it silently skips both and lays down an *incomplete* `planning/scripts/`.
`scripts/issue-status.sh` does still exist and *is* still installed — which is
why `v2-project/planning/scripts/` contains that one script and nothing else
(KI-7).

**2. No fixture may contain a nested `.git` directory.**
Git would turn it into a gitlink (submodule) and the tree would not be
committable. Tests that need a git repo run `git init` (plus a first commit) on
the **copy**, in `$TMP_WORK` — never on the fixture. Enforced by
`find test/fixtures -name .git` → must be empty.

**3. Fixtures are consumed read-only (S-3).**
`pf_setup_case <fixture>` in `test/lib.sh` copies the fixture into a fresh
`mktemp -d` and works there. A fixture is never mutated by a test run; a test
that needs a variation (an extra `.gitignore` line, a planted `stale.md`,
an oversized `.pf-version`) makes it in the copy.

**4. Empty directories carry a `.gitkeep`.**
Git cannot commit an empty directory, and several fixtures legitimately have one
(`v3-incomplete/docs/issues/open/`, the `closed/` dirs of v2 layouts). Converge
does not care, and no assertion enumerates these directories.

---

## The twelve fixtures

| Fixture | What it models | Consumed by |
|---|---|---|
| `no-pf-bare/` | A plain project that has never seen the framework — `README.md`, `src/main.js`, and **no** `CLAUDE.md`. `detectState` → `'none'` (D-C). | TC-001, TC-009, TC-016, TC-024, TC-026 |
| `no-pf-claude/` | Same, plus a hand-written `CLAUDE.md` with no PF section anywhere. `detectState` → `'v2-or-older'` (`detect.js:56-58`) while converge's own detector sees "no PF" — the two-detector split of D-C. | TC-002, TC-013, TC-014 |
| `v1-project/` | A v1 install: `docs/prd.md`, `docs/planning/{implementation-plan,session-log,decisions,FRAMEWORK}.md`, no `docs/issues/`, and a `CLAUDE.md` carrying the **unmarked** v1 banner (`# ====…` / `# Planning Framework Integration`) with user prose written *after* it. Converge must warn about the banner, not delete it. | TC-003, TC-015 |
| `v2-project/` | A real v2 install — the case today's `migrate-v2-to-v3.sh` no-ops on. `planning/issues/{open,closed}/`, `planning/scripts/issue-status.sh`, `planning/templates/`, `planning/FRAMEWORK.md`, `planning/{implementation-plan,session-log,decisions}.md`, root `PLANNING.md` (**Framework Version:** 2.0, `planning/` paths), root `.qa-workflow.md` (**Version:** 2.0), and **no `CLAUDE.md`** (v2 never created one). Three issues: `open/20250101-feat-alpha` (Russian `prompt.md`; `analysis.md`, `implementation-plan.md`, `definition-of-done.md`), `open/20250102-bug-beta` (bug with a plan but no test plan), `closed/20241201-feat-gamma`. | TC-004, TC-007, TC-008, TC-010, TC-012–TC-014, TC-016–TC-024, TC-026–TC-031, TC-045, TC-049, TC-056, TC-057 |
| `v2-with-stub/` | `v2-project` plus the damage `migrate-v2-to-v3.sh:128-141` actually inflicts: a `test_plan.md` in the feat issue whose entire body is a heading and `> TODO: Run /pf-test-plan to generate this file.` Measure 1 (stop minting stubs) does not remove the ones already on disk — measure 2 must refuse to count them. | TC-046, TC-047 (Manual) |
| `v3-incomplete/` | Exactly what **today's** `setup-planning-v3.sh` lays down: `docs/issues/{open,closed}/`, the three `docs/planning/` global docs, and `docs/planning/templates/` **as it stands right now** — i.e. still carrying `config/.qa-workflow.md` and the v2-stamped `config/PLANNING.md` (`cp -r "$TEMPLATES_SRC/."`, `setup-planning-v3.sh:89`). No `.pf-version`, no `PLANNING.md`, `CLAUDE.md` without a pf section. This is the fixture that proves T6 is a **mirror**, not an overlay: those two template files are deleted/rewritten in the framework, and must therefore vanish from the project too. Snapshotting it *before* that deletion is the whole reason this fixture is frozen here. | TC-005, TC-011, TC-016 |
| `mixed-layout/` | A half-migration: `planning/issues/open/20250101-feat-alpha/` and `docs/issues/open/20250101-feat-alpha/` coexist. `prompt.md` and `analysis.md` were already copied **byte-identically**; `implementation-plan.md` is still only in `planning/`; `planning/session-log.md` was already copied identically to `docs/planning/`. Converge must finish the job without minting `.v2.md` sidecars for the files that already match. | TC-006, TC-055 |
| `collision-same-id/` | The same issue ID present in both layouts, three ways. **ID-A `20250101-feat-alpha`** — v2 `open` vs v3 `closed`. **ID-B `20250102-bug-beta`** — the *same* status (`open`) in both, with `analysis.md` differing, `prompt.md` byte-identical, and both a `planning/…/implementation-plan.md` and a differing `docs/…/implementation_plan.md`. **ID-C `20250103-improve-gamma`** — v2 `closed` vs v3 `open`, the reverse cross-status case (one ID cannot be in two different cross-status configurations at once, hence three IDs). Rule under test: the v3 location is authoritative, in both directions. | TC-025, TC-051, TC-052, TC-053 |
| `collision-file-dir/` | `notes.md` is a **file** in `planning/issues/open/20250101-feat-alpha/` and a **directory** in `docs/issues/open/20250101-feat-alpha/` — and the mirror image in `20250102-bug-beta`. Neither a `.v2.md` suffix nor a `.v2/` directory can resolve this. A third, conflict-free issue (`20250103-improve-gamma`) proves phase 3 still carried every non-conflicting element to completion. Converge must ERROR, exit non-zero, and **skip phase 5 entirely** so `planning/` survives (D-B). | TC-054 |
| `v2-latin/` | A v2 layout whose seven open issues span the whole `doc_language` matrix (Р5, D-G): (1) `20250201-feat-latin` pure Latin → `English`; (2) `20250202-feat-yo` Cyrillic present **only** as `ё`/`Ё` and outnumbering the Latin (72 vs 10) → `Russian`, which a naive `[а-яА-Я]` class would get wrong; (3) `20250203-feat-nodocs` has neither `prompt.md` nor `analysis.md`; (4) `20250204-feat-empty` has both, both empty (0 letters); (5) `20250205-feat-tie` exactly 4 Cyrillic vs 4 Latin → `English` (the rule is *strictly* greater); (6) `20250206-feat-fm` already carries valid frontmatter `doc_language: Russian` and no `size_tier` → not overwritten; (7) `20250207-feat-broken` has **malformed** frontmatter (opening `---`, no closing `---`) → WARNING, file not edited at all. | TC-023, TC-058 |
| `planning-with-user-files/` | A v2 layout plus `planning/notes-of-mine.md`, a file the framework has never created. Deletion is by whitelist followed by a bare `rmdir planning`, so this file must survive, the `rmdir` must fail, and converge must warn about the leftovers. | TC-018 |
| `pf-close-basic/` | **Not a convergence fixture.** A minimal one-file project (`docs/issues/open/20260101-bug-close-fixture/prompt.md`, no `.git`) that the `/pf-close` behavioural suite copies via `pf_setup_case … --git`, then adds a `develop` branch, an `issue/…` branch, a self-tracking or legitimate upstream, and extra commits on top of — per-case, never in the fixture itself. | TC-001, TC-002, TC-003, TC-004, TC-005 |

---

## Notes on faithfulness

- `planning/scripts/`, `planning/templates/`, the root `PLANNING.md` and the root
  `.qa-workflow.md` of the v2 layouts are reproduced by replaying exactly what
  `setup-planning-v2.sh` does today: `issue-status.sh` copied and path-rewritten
  (`:147-149`), the template tree copied verbatim with its `[Project Name]` /
  `YYYY-MM-DD` placeholders intact (`:158`), `PLANNING.md` and `.qa-workflow.md`
  copied from `templates/config/` with placeholders substituted and paths
  rewritten to `planning/` (`:174-204`).
- `planning/FRAMEWORK.md` is a short hand-written v2-era stand-in rather than a
  copy of today's `docs/planning/FRAMEWORK.md` (which is a v3 document). Nothing
  reads its contents; the tests only assert that it exists, that it is **not**
  transferred to `docs/planning/`, and that it lands in the backup.
- The literal `TODO: Run /pf-` appears **only** in `v2-with-stub`. `v2-project`
  must stay free of it — TC-020 step 4 greps for exactly that string and expects
  zero hits.
