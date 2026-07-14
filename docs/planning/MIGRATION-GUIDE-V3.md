# Migration Guide: → v3.0 (converge)

**Version:** 3.0.0
**Applies to:** every project, whatever it starts from — no framework, v1.x, v2.0, a half-finished migration, or an incomplete v3 install.

---

## One command

```bash
make converge TARGET=/path/to/your-project
```

or, from inside the project itself:

```bash
/path/to/planning-framework/scripts/converge-to-v3.sh
```

That is the whole migration. `converge` is the **single entry point** of the framework: the four former per-version setup and migration scripts have been removed, and there is nothing else to run. Installing is not a separate operation — it is simply what converge does when it finds nothing to migrate.

Prefer a menu? `make tui` (or the global `pf` command) walks you through the same run.

---

## What "converged" means

Converge does not ask *"which version are you on?"* It compares your project against the v3 **target state** and fills in whatever is missing:

| # | Target |
|---|--------|
| T1 | `docs/issues/{open,closed}/` and `docs/planning/` exist |
| T2 | `.pf-version` carries the framework version |
| T3 | `PLANNING.md` is stamped **Framework Version:** 3.0 |
| T4 | `CLAUDE.md` holds exactly one `<!-- pf:begin -->` / `<!-- pf:end -->` section |
| T5 | `docs/planning/{implementation-plan,session-log,decisions}.md` exist |
| T6 | `docs/planning/templates/` **mirrors** the framework's templates |
| T7 | all 16 skills are installed in `~/.claude/skills/` |
| T8 | the `pf` shim exists at `~/.claude/bin/pf` |
| T9 | no v1/v2 artifacts are left behind (whitelist only — see below) |
| T10 | no hyphenated `implementation-plan.md` survives inside an issue |
| T11 | the project detects as `v3` |

Re-running converge on an already-converged project is a no-op — not because the script special-cases it, but because there is nothing left to top up. It is **idempotent**: run it as often as you like.

Your own documents are never overwritten. Once `PLANNING.md`, `CLAUDE.md` or `.qa-workflow.md` exist, they are yours; converge only adds what is absent (and warns when something carries a stale v2 stamp).

---

## The five starting states

Converge detects the starting state, prints it, and runs only the phases that state needs.

| State | What it is | What converge does |
|-------|-----------|--------------------|
| **no-pf** | No framework artifacts at all | Clean install: creates the layout, installs skills and the `pf` shim |
| **v1** | v1.x layout: `docs/planning/` without `docs/issues/` | Tops up to the v3 layout. An old unmarked `# Planning Framework Integration` section in `CLAUDE.md` is **not** deleted (your text may follow it) — converge adds the `pf:begin/end` section and warns you to remove the old banner by hand |
| **v2** | A real v2 install: `planning/issues/`, `planning/{implementation-plan,session-log,decisions}.md`, `planning/templates/`, v2-stamped `PLANNING.md` | Backup → transfer → normalise → delete v2 artifacts → top up |
| **mixed** | Half-migrated: `planning/issues/` and `docs/issues/` coexist | Same as v2, per file: whatever already landed in `docs/` is kept, the rest is carried over |
| **v3 (incomplete)** | The v3 fingerprint is there, but `.pf-version`, `PLANNING.md`, the `CLAUDE.md` section or some skills are missing | Tops up only what is missing. **This state is why "already v3" is not an exit condition** |

---

## What happens to your issues

**Open issues** are migrated in place and stay open:

- `implementation-plan.md` → `implementation_plan.md` (the v3 name; T10).
- `doc_language: Russian|English` is written into `prompt.md` front matter, decided by counting Cyrillic vs Latin letters in `prompt.md` + `analysis.md` (a tie is English). Force it with `--doc-language Russian|English`.
- **No stub documents are minted.** A migrated issue simply has documents it does not have yet; the final report lists them per issue ("still owes: `test_plan.md`"), and `/pf` routes you to the first incomplete stage. Earlier versions wrote `TODO: Run /pf-…` placeholders and then refused to regenerate over them — that dead end is gone.
- `size_tier` is deliberately **not** guessed. `/pf` asks you once.

**Closed issues** are never rewritten. They only get a `brd.md` **pointer** — a few lines linking to the legacy `prompt.md` / `analysis.md` / `definition-of-done.md` that are already in the folder — so the v3 pipeline can read the archive without anyone editing it. A closed issue that already has a `brd.md` (or a trivial-tier `notes.md`) is left completely alone.

If the same issue ID exists in both `open/` and `closed/`, the transfer follows the destination that already exists — an issue is never resurrected into `open/`, and open work is never buried in `closed/`.

**Name collisions.** If a v2 file and an existing v3 file with the same destination differ, the v2 copy is parked beside it as `<name>.v2.md` and you get a warning. Nothing is silently overwritten, and nothing is silently dropped.

---

## The backup

Before any destructive phase, converge copies your whole `planning/` directory to:

```
planning-backup-YYYYMMDD-HHMMSS/planning/
```

in the project root. Notes:

- The backup is taken **only when there is destructive work to do** (a transfer or a deletion). A pure top-up does not need one and does not take one.
- An existing backup is never overwritten — a numeric suffix is added instead.
- If your `.gitignore` hides the backup path, converge warns you: a backup git cannot see is a backup nobody restores.
- Rolling back is a directory copy back; nothing else was moved out of `planning/`.

**Deletion is by whitelist.** Converge never runs `rm -rf planning/`. It removes only the paths it knows to be v1/v2 *framework* artifacts (`planning/issues/`, `planning/scripts/`, `planning/templates/`, `planning/FRAMEWORK.md`, the three global v2 documents), then a bare `rmdir` that succeeds only if the directory is now empty. Anything of yours that was in `planning/` stays there, and the directory survives with it.

---

## Look before you leap: `--dry-run`

```bash
scripts/converge-to-v3.sh --target /path/to/project --dry-run
```

Prints the detected state and the complete plan — every file that would move, every path that would be deleted, every skill that would be installed — and **changes nothing**. Exit code 0. Run it first on any project you care about.

Other flags:

| Flag | Effect |
|------|--------|
| `--target <dir>` | Project to converge (default: the current directory) |
| `--dry-run` | Print the plan; change nothing |
| `--yes` | Do not ask before the destructive phases |
| `--force` | Proceed even with uncommitted changes to tracked files |
| `--doc-language Russian\|English` | Force the language of migrated issues instead of detecting it |
| `--help` | Usage |

Exit codes: `0` converged (or dry-run finished) · `1` blocked by a file-vs-directory collision (nothing was deleted, `planning/` is intact) · `2` CLI error · `3` dirty worktree, no `--force` · `4` cancelled.

A dirty worktree is a **gate**, not a nuisance: converge moves and deletes files, and you want `git status` to be able to tell you what it did.

---

## `.qa-workflow.md` is not shipped

There is no `.qa-workflow.md` template, and converge never creates one. QA gates are project-specific — a generic checklist is worse than none, because it passes without checking anything.

After converging, run this in Claude Code:

```
/pf-qa-setup
```

It writes a `.qa-workflow.md` fitted to the project (its real lint, test and build commands). If you already have one from v2, converge leaves it alone and warns you if it still carries the **Version:** 2.0 stamp — `/pf-qa-setup` will regenerate it.

---

## After converging

1. Review the diff: `git status` / `git diff`.
2. Commit the migration.
3. Run `/pf-qa-setup` if you have no `.qa-workflow.md`.
4. Run `/pf` in Claude Code — it names your active issue, its stage, and the next step.
5. Delete `planning-backup-*/` once you are satisfied.

---

## See also

- [QUICKSTART.md](QUICKSTART.md) — 5-minute getting started
- [FRAMEWORK.md](FRAMEWORK.md) — complete v3.0 guide
- [v1.0-archive/MIGRATION-GUIDE-v1-to-v2.md](v1.0-archive/MIGRATION-GUIDE-v1-to-v2.md) — the historical v1.0 → v2.0 guide (do not execute it; its scripts are gone)
