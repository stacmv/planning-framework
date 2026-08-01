#!/usr/bin/env bash
#
# scripts/converge-to-v3.sh — the single entry point of Planning Framework v3.
#
# Converges a consumer project on the v3 target state (T1–T11) from ANY starting
# state: no framework / v1 / v2 / half-migrated / already-v3-but-incomplete.
# It supersedes the former per-version setup and migration scripts (all removed):
# installation is simply its last phase.
#
# Phases:
#   1  detect the starting state and print it
#   2  back up planning/            (iff phases 3+5 have work to do)
#   3  transfer the v2 layout into docs/   (per file, git-history-preserving)
#   4  normalise issue documents     (rename, doc_language, closed-issue pointer)
#   5  delete v1/v2 artifacts BY WHITELIST (never `rm -rf planning/`)
#   6  top up to the target state T1–T8
#   7  final report
#
# Exit codes — these and no others:
#   0   target state reached (or --dry-run finished)
#   1   ran, but the target state was NOT reached: a file-vs-directory collision
#       blocked phase 3, so phase 5 never ran and planning/ is intact
#   2   CLI error (unknown flag, missing value, bad --doc-language) + usage
#   3   gate: dirty worktree (TRACKED changes) and no --force
#   4   cancelled: empty answer, `n`, or closed stdin without --yes.
#       "Could not ask" is not "the user agreed"
#   70  the hidden --fail-after=<N> test hook fired
#
# NOT `set -e` on purpose: phases 3 and 5 are destructive, and an implicit abort
# in the middle of them would leave a project half-migrated with no rollback.
# Every operation is checked explicitly instead.

set -uo pipefail

PF_VERSION="3.0.0"

SCRIPT_PATH="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd -P)"
# The framework root is resolved relative to THIS FILE, never to $PWD and never
# as a baked-in constant: a run of a *copy* of the repo must use the copy's
# skills/ and templates/ (S-5 / KI-19), which is what proves the skill discovery
# below is genuinely dynamic.
FRAMEWORK_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"

SKILLS_SRC="$FRAMEWORK_ROOT/skills"
TEMPLATES_SRC="$FRAMEWORK_ROOT/docs/planning/templates"

PF_BEGIN='<!-- pf:begin -->'
PF_END='<!-- pf:end -->'
V1_BANNER='# Planning Framework Integration'
STUB_MARKER='TODO: Run /pf-'

# ─── CLI state ────────────────────────────────────────────────────────────────

TARGET=""
DRY_RUN=0
FORCE=0
ASSUME_YES=0
DOC_LANGUAGE=""
FAIL_AFTER=""

# ─── Report accumulators (phase 7) ────────────────────────────────────────────

STATE="" # no-pf | v1 | v2 | mixed | v3
EXIT_CODE=0
TRANSFER_FAILED=0
BACKUP_DIR=""
MOVED_COUNT=0

REPORT_TRANSFERRED=()  # issue ids whose files were carried over
REPORT_SIDECARS=()     # <path>.v2.md files kept side by side
REPORT_DELETED=()      # whitelist paths removed in phase 5
REPORT_MIRROR_GONE=()  # template files removed by the T6 mirror
REPORT_SKILLS=()       # skills actually installed (derived, never hardcoded)
REPORT_LANG=()         # per-issue doc_language decisions
REPORT_MISSING_DOCS=() # per-issue: which v3 documents are still missing
WARNINGS=()
ERRORS=()

warn() {
  WARNINGS+=("$1")
  printf 'WARNING: %s\n' "$1" >&2
}

err() {
  ERRORS+=("$1")
  printf 'ERROR: %s\n' "$1" >&2
}

say() { printf '%s\n' "$*"; }

# ─── Usage (the hidden --fail-after hook is deliberately absent) ──────────────

usage() {
  cat <<'USAGE'
Usage: converge-to-v3.sh [options]

Converges a project on Planning Framework v3 from any starting state
(no framework / v1 / v2 / half-migrated / incomplete v3). Idempotent.

Options:
  --target <dir>         Project to converge (default: current directory)
  --yes                  Do not ask for confirmation before destructive phases
  --dry-run              Print the plan; change nothing
  --force                Proceed even if the git worktree has uncommitted
                         changes to tracked files
  --doc-language <lang>  Force the doc_language of migrated issues.
                         Valid values: Russian, English
  --help                 Show this help and exit

Exit codes: 0 converged  1 blocked by a collision  2 CLI error
            3 dirty worktree  4 cancelled
USAGE
}

cli_error() {
  printf 'ERROR: %s\n\n' "$1" >&2
  usage >&2
  exit 2
}

# ─── Phase 0: parse the command line (flags in any order) ─────────────────────

while [ $# -gt 0 ]; do
  case "$1" in
    --target)
      [ $# -ge 2 ] || cli_error "--target requires a directory argument"
      TARGET="$2"
      shift 2
      ;;
    --target=*)
      TARGET="${1#--target=}"
      [ -n "$TARGET" ] || cli_error "--target requires a directory argument"
      shift
      ;;
    --doc-language)
      [ $# -ge 2 ] || cli_error "--doc-language requires a value (Russian, English)"
      DOC_LANGUAGE="$2"
      shift 2
      ;;
    --doc-language=*)
      DOC_LANGUAGE="${1#--doc-language=}"
      shift
      ;;
    --yes | -y)
      ASSUME_YES=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --force)
      FORCE=1
      shift
      ;;
    --help | -h)
      usage
      exit 0
      ;;
    --fail-after=*)
      # Hidden test hook (D-F). Only honoured with PF_CONVERGE_TEST_HOOKS=1;
      # otherwise it is just an unknown flag, like any other typo.
      if [ "${PF_CONVERGE_TEST_HOOKS:-0}" = "1" ]; then
        FAIL_AFTER="${1#--fail-after=}"
        case "$FAIL_AFTER" in
          '' | *[!0-9]*) cli_error "--fail-after requires a non-negative integer" ;;
        esac
        shift
      else
        cli_error "unknown option: $1"
      fi
      ;;
    *)
      cli_error "unknown option: $1"
      ;;
  esac
done

# --doc-language has a CLOSED domain on purpose: the Р5 classifier is binary
# (Cyrillic vs Latin) and converge only back-fills the field on legacy issues.
if [ -n "$DOC_LANGUAGE" ]; then
  case "$(printf '%s' "$DOC_LANGUAGE" | tr '[:upper:]' '[:lower:]')" in
    russian) DOC_LANGUAGE="Russian" ;;
    english) DOC_LANGUAGE="English" ;;
    *) cli_error "invalid --doc-language '$DOC_LANGUAGE' — valid values: Russian, English" ;;
  esac
fi

TARGET="${TARGET:-$(pwd)}"
if [ ! -d "$TARGET" ]; then
  printf 'ERROR: target directory does not exist: %s\n' "$TARGET" >&2
  exit 2
fi
TARGET="$(cd "$TARGET" && pwd -P)"
PROJECT_NAME="$(basename "$TARGET")"

# ─── Small helpers ────────────────────────────────────────────────────────────

# sed-escape a replacement string (& / \ are special on the right-hand side).
sed_escape_replacement() {
  printf '%s' "$1" | sed -e 's/[\/&\\]/\\&/g'
}

# Render a template: the ONLY placeholder substituted is [Project Name].
# There is no date placeholder anywhere in these templates, by design (D-E):
# the artifacts are rewritten on every run, so a date would break byte-level
# idempotency and the test would be "green on Tuesdays".
render_template() {
  local src="$1" name_esc
  name_esc="$(sed_escape_replacement "$PROJECT_NAME")"
  sed "s/\[Project Name\]/${name_esc}/g" "$src"
}

git_available() {
  [ -d "$TARGET/.git" ] || git -C "$TARGET" rev-parse --is-inside-work-tree >/dev/null 2>&1
}

# Is <path>, relative to $TARGET, tracked by git?
git_tracked() {
  git -C "$TARGET" ls-files --error-unmatch "$1" >/dev/null 2>&1
}

# Move ONE file, preserving git history when it can.
#
# KI-2, verified empirically: `git mv` on a wholly untracked directory dies with
# `fatal: source directory is empty` (128) and on a single untracked file with
# `fatal: not under version control` (128). A repo-level "is this a git repo?"
# branch is therefore NOT enough — the probe has to be per file.
move_file() {
  local src="$1" dst="$2" rel_src rel_dst
  mkdir -p "$(dirname "$dst")" || return 1

  if [ "$GIT_OK" -eq 1 ]; then
    rel_src="${src#"$TARGET"/}"
    rel_dst="${dst#"$TARGET"/}"
    if git_tracked "$rel_src"; then
      if git -C "$TARGET" mv -f -- "$rel_src" "$rel_dst" 2>/dev/null; then
        return 0
      fi
    fi
  fi

  cp -a -- "$src" "$dst" || return 1
  rm -f -- "$src" || return 1
}

# The .v2.md sidecar name, computed AFTER the name has been normalised, so a
# v2 implementation-plan.md lands as implementation_plan.v2.md — never as
# implementation-plan.v2.md (TC-053).
sidecar_path() {
  local dst="$1"
  case "$dst" in
    *.md) printf '%s' "${dst%.md}.v2.md" ;;
    *) printf '%s' "${dst}.v2" ;;
  esac
}

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 1 — detect the starting state
# ══════════════════════════════════════════════════════════════════════════════
#
# This is converge's OWN detector, and it is not detect.js (KI-16). detect.js
# picks a TUI menu out of four tokens; this one picks phases. On no-pf-claude the
# two disagree on purpose and harmlessly (D-C).

detect_state() {
  local has_v2=0 has_v3=0
  [ -d "$TARGET/planning/issues" ] && has_v2=1
  [ -d "$TARGET/docs/issues" ] && has_v3=1

  if [ "$has_v2" -eq 1 ] && [ "$has_v3" -eq 1 ]; then
    STATE="mixed"
  elif [ "$has_v2" -eq 1 ]; then
    STATE="v2"
  elif [ "$has_v3" -eq 1 ]; then
    STATE="v3"
  elif [ -d "$TARGET/docs/planning" ]; then
    STATE="v1"
  else
    STATE="no-pf"
  fi
}

print_state() {
  case "$STATE" in
    no-pf) say "Detected state: no PF — no framework artifacts found; this will be a clean v3 install" ;;
    v1) say "Detected state: v1 — docs/planning/ without docs/issues/" ;;
    v2) say "Detected state: v2 — planning/issues/ present" ;;
    mixed) say "Detected state: mixed — planning/issues/ and docs/issues/ coexist (half-migrated)" ;;
    v3) say "Detected state: v3 — docs/issues/ present; converge will top it up to the target state" ;;
  esac
}

# ══════════════════════════════════════════════════════════════════════════════
# Planning: what phases 3 and 5 would do (pure; no mutation)
# ══════════════════════════════════════════════════════════════════════════════

P3_SOURCES=()
P5_PATHS=()

collect_phase3_sources() {
  local f
  if [ -d "$TARGET/planning/issues" ]; then
    while IFS= read -r -d '' f; do
      P3_SOURCES+=("$f")
    done < <(find "$TARGET/planning/issues" -type f -print0 2>/dev/null | LC_ALL=C sort -z)
  fi
  # The three global v2 documents. Everything ELSE under planning/ (scripts/,
  # templates/, FRAMEWORK.md) is a v2 *framework* artifact, not user data: it is
  # never transferred, only deleted (a copy survives in the backup).
  for f in implementation-plan.md session-log.md decisions.md; do
    [ -f "$TARGET/planning/$f" ] && P3_SOURCES+=("$TARGET/planning/$f")
  done
}

collect_phase5_paths() {
  local p
  for p in \
    planning/issues \
    planning/scripts \
    planning/templates \
    planning/FRAMEWORK.md \
    planning/implementation-plan.md \
    planning/session-log.md \
    planning/decisions.md; do
    [ -e "$TARGET/$p" ] && P5_PATHS+=("$p")
  done
}

# Cross-status merge map: issue id -> the status its files must land in, which is
# NOT necessarily the status they sit in under planning/.
#
# It is computed HERE, in the parent shell, and deliberately NOT inside
# map_destination — which is only ever reached through `$(map_destination …)`,
# i.e. a subshell. A `warn` raised in there prints to stderr but its append to
# WARNINGS is thrown away with the subshell, so the merge never appears in the
# final WARNINGS block of the report (it also fired once per FILE rather than
# once per issue). TC-051 step 6 wants exactly these events, once each, in the
# report.
declare -A ISSUE_STATUS_REMAP=()

# The v3 location is authoritative: if the ID already lives under docs/ in the
# OTHER status, its v2 files merge into that one. A second directory for the same
# ID is never created — /pf scans open/ only and would otherwise resurrect closed
# work (or hide open work in closed/).
compute_status_remap() {
  local src rel rest status id rstatus
  local -A seen=()

  for src in ${P3_SOURCES[@]+"${P3_SOURCES[@]}"}; do
    # Only <status>/<id>/<file…> carries an issue ID; a .gitkeep sitting directly
    # under planning/issues/ or planning/issues/<status>/ does not.
    case "$src" in
      "$TARGET"/planning/issues/*/*/*) ;;
      *) continue ;;
    esac

    rel="${src#"$TARGET"/planning/issues/}"
    status="${rel%%/*}"
    rest="${rel#*/}"
    id="${rest%%/*}"

    [ -n "${seen["$status/$id"]:-}" ] && continue
    seen["$status/$id"]=1

    rstatus="$status"
    if [ -d "$TARGET/docs/issues/open/$id" ]; then
      rstatus="open"
    elif [ -d "$TARGET/docs/issues/closed/$id" ]; then
      rstatus="closed"
    fi

    if [ "$rstatus" != "$status" ]; then
      ISSUE_STATUS_REMAP["$id"]="$rstatus"
      warn "issue $id is '$status' under planning/ but '$rstatus' under docs/ — merging into docs/issues/$rstatus/$id (the v3 location wins; no second directory for the same ID is ever created)"
    fi
  done
}

# Where does a phase-3 source file belong in the v3 layout?
#
# PURE: no warnings, no side effects — it runs in a command substitution, where a
# side effect would be silently discarded (see compute_status_remap above).
map_destination() {
  local src="$1" rel rest status id tail tail_dir tail_base rstatus

  case "$src" in
    "$TARGET"/planning/issues/*)
      rel="${src#"$TARGET"/planning/issues/}"

      # NOT every file under planning/issues/ belongs to an issue. A .gitkeep is
      # how an empty open/ or closed/ stays alive in git — v2 projects are full of
      # them — and a stray README.md sits one level higher still. Such a file has
      # no issue ID, so it keeps its place verbatim under docs/issues/.
      #
      # Without these two guards the first path component is taken for an issue
      # ID: `.gitkeep` becomes a DIRECTORY named `.gitkeep` holding a file called
      # `.gitkeep`, i.e. a phantom issue that /pf would list as real work (and
      # that phase 4 would then try to normalise).
      case "$rel" in
        */*) ;;
        *)
          printf '%s' "$TARGET/docs/issues/$rel"
          return 0
          ;;
      esac

      status="${rel%%/*}"
      rest="${rel#*/}"

      case "$rest" in
        */*) ;;
        *)
          printf '%s' "$TARGET/docs/issues/$status/$rest"
          return 0
          ;;
      esac

      id="${rest%%/*}"
      tail="${rest#*/}"

      tail_dir="$(dirname "$tail")"
      tail_base="$(basename "$tail")"
      # Р12: the rename happens FIRST, so the collision is detected against the
      # *target* name (TC-053).
      [ "$tail_base" = "implementation-plan.md" ] && tail_base="implementation_plan.md"
      [ "$tail_dir" = "." ] && tail_dir=""

      # Decided once, in the parent shell, by compute_status_remap.
      rstatus="${ISSUE_STATUS_REMAP[$id]:-$status}"

      if [ -n "$tail_dir" ]; then
        printf '%s' "$TARGET/docs/issues/$rstatus/$id/$tail_dir/$tail_base"
      else
        printf '%s' "$TARGET/docs/issues/$rstatus/$id/$tail_base"
      fi
      ;;
    *)
      # The three global documents keep their hyphenated names in v3 (TC-022).
      printf '%s' "$TARGET/docs/planning/$(basename "$src")"
      ;;
  esac
}

# ══════════════════════════════════════════════════════════════════════════════
# Worktree gate (D-A / KI-14)
# ══════════════════════════════════════════════════════════════════════════════
#
# TRACKED changes only — untracked files never make the tree "dirty". Converge's
# own new files (.pf-version, PLANNING.md, docs/issues/…) are untracked, and a
# gate that tripped on them would make the SECOND run fail in every git project,
# killing the idempotency this script exists for.
#
# But TRACKED is not enough on its own, and this is the subtle part. Converge
# *moves and deletes tracked files* — with `git mv`, which STAGES the rename
# (KI-2 requires git mv, so that `git log --follow` keeps working). After run 1
# the index therefore legitimately differs from HEAD, and a gate written as
# `git status --porcelain --untracked-files=no` (D-A, literally) would report the
# project dirty and refuse to run again — the exact failure D-A was written to
# prevent. D-A's parenthetical "equivalent to git diff --quiet HEAD" was derived
# from the assumption that converge's outputs are untracked; that is true of a
# cp+rm implementation and false of the git-mv one the test plan also mandates.
#
# So the gate looks at UNSTAGED changes to tracked files (column 2 of porcelain
# v1: the worktree column). That is precisely the work that exists nowhere but in
# the working tree and could be lost — which is what the gate is for. Converge
# then stages its own footprint (git_stage_footprint, below), so worktree ==
# index when it is done and the next run starts from a clean gate.

check_worktree() {
  if [ "$GIT_OK" -eq 0 ]; then
    say "  git: not a git repository — worktree gate skipped (this is not 'dirty')"
    return 0
  fi
  local dirty
  dirty="$(git -C "$TARGET" status --porcelain --untracked-files=no 2>/dev/null |
    awk 'substr($0, 2, 1) != " "')"
  if [ -n "$dirty" ]; then
    if [ "$FORCE" -eq 1 ]; then
      warn "worktree has uncommitted changes to tracked files — proceeding because of --force"
      return 0
    fi
    printf 'ERROR: the worktree has uncommitted changes to TRACKED files:\n' >&2
    printf '%s\n' "$dirty" >&2
    printf 'Commit or stash them first, or re-run with --force.\n' >&2
    printf '(Untracked files do not trip this gate.)\n' >&2
    exit 3
  fi
  say "  git: worktree clean (no unstaged changes to tracked files)"
}

# Leave converge's own work STAGED, so that (a) the user reviews one coherent
# change set with `git diff --cached` and commits it, and (b) the next run starts
# from a clean gate. `git mv` already stages the renames; this catches the rest:
# files converge rewrote in place (PLANNING.md, CLAUDE.md, an issue's prompt.md)
# and the tracked files phase 5 deleted. Only converge's own paths are staged —
# a user's edit anywhere else is left exactly as it was found.
git_stage_footprint() {
  [ "$GIT_OK" -eq 1 ] || return 0
  local p paths=()
  for p in .pf-version PLANNING.md CLAUDE.md docs/issues docs/planning planning; do
    if [ -e "$TARGET/$p" ] ||
      git -C "$TARGET" ls-files --error-unmatch -- "$p" >/dev/null 2>&1; then
      paths+=("$p")
    fi
  done
  [ ${#paths[@]} -gt 0 ] || return 0
  git -C "$TARGET" add -A -- "${paths[@]}" >/dev/null 2>&1 || true
}

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 2 — backup
# ══════════════════════════════════════════════════════════════════════════════
#
# Created IFF the set of phase-3 and phase-5 operations is non-empty. The T6
# template mirror (phase 6) deletes files too, but those are FRAMEWORK artifacts
# restorable by re-running converge — they do not trigger a backup. Without that
# distinction TC-005 and TC-016 could not both be green.
#
# The name is NOT planning.bak/: `*.bak` sits in .gitignore:16 of this very
# repository, and a backup invisible to git is a backup nobody can restore.

make_backup() {
  local stamp n
  stamp="$(date +%Y%m%d-%H%M%S)"
  BACKUP_DIR="$TARGET/planning-backup-$stamp"

  # The stamp has one-second resolution, and an interrupted run followed straight
  # away by a recovery run (D-F, TC-055) lands inside the same second. Reusing the
  # directory would make `cp -a planning "$BACKUP_DIR/planning"` copy INTO the
  # existing backup — yielding planning-backup-…/planning/planning/ and quietly
  # ruining the only rollback artifact. Never overwrite a backup; take a new one.
  n=2
  while [ -e "$BACKUP_DIR" ]; do
    BACKUP_DIR="$TARGET/planning-backup-$stamp-$n"
    n=$((n + 1))
  done

  if [ "$GIT_OK" -eq 1 ] && git -C "$TARGET" check-ignore -q "$BACKUP_DIR" 2>/dev/null; then
    warn "the backup path is ignored by this project's .gitignore: $(basename "$BACKUP_DIR")/ — it will still be created, but git will not see it"
  fi

  mkdir -p "$BACKUP_DIR" || {
    err "could not create the backup directory: $BACKUP_DIR"
    return 1
  }
  cp -a "$TARGET/planning" "$BACKUP_DIR/planning" || {
    err "could not copy planning/ into the backup"
    return 1
  }
  say "  backed up planning/ -> $(basename "$BACKUP_DIR")/planning/"
}

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3 — transfer the v2 layout, per element
# ══════════════════════════════════════════════════════════════════════════════
#
# A naive `mv planning/issues docs/issues` yields docs/issues/issues/, because
# converge creates docs/issues/{open,closed} itself. Per element it is.
#
# Restart rule (check-then-act, per file — this is what makes an interrupted run
# recoverable): destination absent -> move; destination byte-identical -> just
# drop the source (a previous run already carried it); destination differs ->
# keep it and park the v2 copy as <name>.v2.md. The suffix cannot grow: sources
# only ever come from planning/, and planning/ holds no *.v2.md files.

phase3_transfer() {
  local src dst side p issue_id
  local -A seen_issue=()

  for src in ${P3_SOURCES[@]+"${P3_SOURCES[@]}"}; do
    [ -f "$src" ] || continue
    dst="$(map_destination "$src")"

    # File-vs-directory collision (D-B), in both directions: a path component of
    # the destination is an existing FILE, or the destination itself is a
    # DIRECTORY. Neither a .v2.md suffix nor a .v2/ directory can resolve this —
    # a .v2/ issue directory would show up in /pf as a second active issue.
    local conflict=0
    p="$(dirname "$dst")"
    while [ "$p" != "$TARGET" ] && [ "$p" != "/" ]; do
      if [ -e "$p" ] && [ ! -d "$p" ]; then
        err "file-vs-directory collision: '$src' cannot be placed under '$p', which is a file, not a directory — resolve it by hand"
        conflict=1
        break
      fi
      p="$(dirname "$p")"
    done
    if [ "$conflict" -eq 0 ] && [ -d "$dst" ]; then
      err "file-vs-directory collision: source '$src' is a file but destination '$dst' is a directory — resolve it by hand"
      conflict=1
    fi
    if [ "$conflict" -eq 1 ]; then
      TRANSFER_FAILED=1
      continue
    fi

    if [ ! -e "$dst" ]; then
      if ! move_file "$src" "$dst"; then
        err "could not move '$src' -> '$dst'"
        TRANSFER_FAILED=1
        continue
      fi
    elif cmp -s "$src" "$dst"; then
      # Already carried over by an earlier (possibly interrupted) run.
      rm -f -- "$src"
    else
      side="$(sidecar_path "$dst")"
      if [ -d "$side" ]; then
        err "cannot park the v2 copy of '$src': '$side' exists and is a directory"
        TRANSFER_FAILED=1
        continue
      fi
      if [ -f "$side" ] && cmp -s "$src" "$side"; then
        rm -f -- "$src" # a previous run already parked it; no .v2.v2.md ever
      else
        if ! move_file "$src" "$side"; then
          err "could not park the v2 copy '$src' -> '$side'"
          TRANSFER_FAILED=1
          continue
        fi
        REPORT_SIDECARS+=("${side#"$TARGET"/}")
        warn "kept both copies: ${dst#"$TARGET"/} (v3, untouched) and ${side#"$TARGET"/} (v2)"
      fi
    fi

    MOVED_COUNT=$((MOVED_COUNT + 1))

    case "$src" in
      "$TARGET"/planning/issues/*/*/*)
        # <status>/<id>/<file…> — only THIS shape carries an issue ID. A file
        # lying directly under planning/issues/ or planning/issues/<status>/ (a
        # .gitkeep, say) is not an issue and must not be reported as one.
        issue_id="${src#"$TARGET"/planning/issues/}"
        issue_id="${issue_id#*/}"
        issue_id="${issue_id%%/*}"
        if [ -z "${seen_issue[$issue_id]:-}" ]; then
          seen_issue["$issue_id"]=1
          REPORT_TRANSFERRED+=("$issue_id")
        fi
        ;;
    esac

    # D-F: deterministic interruption, so that "recover from a crash" is a test
    # and not a race with SIGKILL.
    if [ -n "$FAIL_AFTER" ] && [ "$MOVED_COUNT" -ge "$FAIL_AFTER" ]; then
      say ""
      say "--fail-after=$FAIL_AFTER: aborting after $MOVED_COUNT transferred file(s) (test hook)"
      exit 70
    fi
  done

  # Prune the directories the moves emptied out; phase 5 removes the rest.
  find "$TARGET/planning" -mindepth 1 -type d -empty -delete 2>/dev/null || true
}

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 4 — normalise issue documents (Р1, Р5, Р12)
# ══════════════════════════════════════════════════════════════════════════════

# T10: no hyphenated implementation-plan.md may survive in ANY issue, including
# ones that were already sitting in docs/ before this run.
phase4_rename_plans() {
  local src dst side
  [ -d "$TARGET/docs/issues" ] || return 0
  while IFS= read -r -d '' src; do
    dst="$(dirname "$src")/implementation_plan.md"
    if [ ! -e "$dst" ]; then
      move_file "$src" "$dst" && say "  renamed  ${src#"$TARGET"/} -> ${dst#"$TARGET"/}"
    elif cmp -s "$src" "$dst"; then
      rm -f -- "$src"
    else
      side="$(sidecar_path "$dst")"
      if [ -e "$side" ] && cmp -s "$src" "$side"; then
        rm -f -- "$src"
      elif [ ! -d "$side" ]; then
        move_file "$src" "$side"
        REPORT_SIDECARS+=("${side#"$TARGET"/}")
        warn "kept both plans in $(basename "$(dirname "$src")"): implementation_plan.md (v3) and implementation_plan.v2.md (v2)"
      fi
    fi
  done < <(find "$TARGET/docs/issues" -type f -name 'implementation-plan.md' -print0 2>/dev/null | LC_ALL=C sort -z)
}

# Р5: count Cyrillic vs Latin letters. Cyrillic is counted by its UTF-8 LEAD
# bytes 0xD0/0xD1 (U+0400–U+047F), which is the only way that catches ё (D1 91)
# and Ё (D0 81) — both live OUTSIDE the а-я/А-Я block, and a naive [а-яА-Я]
# bracket loses them. Continuation bytes are 0x80–0xBF, so a lead byte is never
# double-counted.
detect_doc_language() {
  local dir="$1" f cyr=0 lat=0 n
  for f in prompt.md analysis.md; do
    [ -f "$dir/$f" ] || continue
    n="$(LC_ALL=C tr -dc '\320\321' <"$dir/$f" | wc -c)"
    cyr=$((cyr + n))
    n="$(LC_ALL=C tr -dc 'A-Za-z' <"$dir/$f" | wc -c)"
    lat=$((lat + n))
  done
  # Strictly greater: a tie is English.
  if [ "$cyr" -gt "$lat" ]; then
    printf 'Russian'
  else
    printf 'English'
  fi
}

# Write doc_language into an OPEN issue's prompt.md only (D-D: closed issues are
# never edited in content). Degenerate inputs never abort the run (D-G).
phase4_doc_language() {
  local dir id lang first close_line has_lang tmp
  [ -d "$TARGET/docs/issues/open" ] || return 0

  while IFS= read -r -d '' dir; do
    id="$(basename "$dir")"
    lang="${DOC_LANGUAGE:-$(detect_doc_language "$dir")}"

    if [ ! -f "$dir/prompt.md" ]; then
      # Р1: no stubs in open issues — not even an empty prompt.md.
      warn "$id: no prompt.md — doc_language not written (decision would have been: $lang)"
      REPORT_LANG+=("$id: $lang (not written — prompt.md missing)")
      continue
    fi

    first="$(head -n 1 "$dir/prompt.md")"
    if [ "$first" = "---" ]; then
      close_line="$(awk 'NR>1 && $0=="---" {print NR; exit}' "$dir/prompt.md")"
      if [ -z "$close_line" ]; then
        # Malformed YAML: opening --- with no closing ---. Do NOT try to "fix" it.
        warn "$id: prompt.md has a malformed frontmatter block (opening '---' with no closing '---') — left untouched"
        REPORT_LANG+=("$id: skipped (malformed frontmatter)")
        continue
      fi
      has_lang="$(awk -v c="$close_line" 'NR>1 && NR<c && /^doc_language:/ {print "y"; exit}' "$dir/prompt.md")"
      if [ -n "$has_lang" ]; then
        REPORT_LANG+=("$id: already declared (not overwritten)")
        continue
      fi
      tmp="$dir/.prompt.md.pf-tmp"
      awk -v c="$close_line" -v l="$lang" 'NR==c {print "doc_language: " l} {print}' \
        "$dir/prompt.md" >"$tmp" && mv -f "$tmp" "$dir/prompt.md"
    else
      tmp="$dir/.prompt.md.pf-tmp"
      {
        printf -- '---\n'
        printf 'doc_language: %s\n' "$lang"
        printf -- '---\n\n'
        cat "$dir/prompt.md"
      } >"$tmp" && mv -f "$tmp" "$dir/prompt.md"
    fi
    # size_tier is deliberately NOT guessed: the legacy-tier guard of /pf must
    # ask the user rather than inherit a machine's guess.
    say "  doc_language: $id -> $lang"
    REPORT_LANG+=("$id: $lang")
  done < <(find "$TARGET/docs/issues/open" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null | LC_ALL=C sort -z)
}

# Р1: a pointer brd.md in CLOSED issues only, linking to the legacy documents
# that actually survived. It deliberately carries NO `TODO: Run /pf-` marker — it
# is a pointer, not an unfinished document, and the stub-recognition rule must
# not fire on it. No `legacy:` marker either.
phase4_closed_pointers() {
  local dir id f links tmp
  [ -d "$TARGET/docs/issues/closed" ] || return 0

  while IFS= read -r -d '' dir; do
    id="$(basename "$dir")"
    [ -f "$dir/brd.md" ] && continue
    [ -f "$dir/notes.md" ] && continue # trivial tier — BRD lives in notes.md

    links=""
    for f in prompt.md analysis.md definition-of-done.md; do
      [ -f "$dir/$f" ] && links="${links}- [\`${f}\`](${f})"$'\n'
    done
    [ -n "$links" ] || continue

    tmp="$dir/brd.md"
    {
      printf '# BRD: %s\n\n' "$id"
      printf 'This issue was closed before the v3 pipeline existed, so it has no BRD.\n'
      printf 'Its requirements are recorded in the legacy documents kept alongside this file:\n\n'
      printf '%s' "$links"
      printf '\nThe archive is not rewritten — only pointed at.\n'
    } >"$tmp"
    say "  pointer:  docs/issues/closed/$id/brd.md"
  done < <(find "$TARGET/docs/issues/closed" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null | LC_ALL=C sort -z)
}

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 5 — delete v1/v2 artifacts BY WHITELIST
# ══════════════════════════════════════════════════════════════════════════════
#
# Never `rm -rf planning/`: anything could be in there, including files the
# framework never created. Only the seven whitelisted paths go, then a bare
# `rmdir` which succeeds only on an empty directory.

phase5_delete() {
  local p leftovers
  for p in ${P5_PATHS[@]+"${P5_PATHS[@]}"}; do
    if [ -e "$TARGET/$p" ]; then
      rm -rf -- "${TARGET:?}/$p"
      REPORT_DELETED+=("$p")
      say "  deleted  $p"
    fi
  done

  if [ -d "$TARGET/planning" ]; then
    if rmdir "$TARGET/planning" 2>/dev/null; then
      say "  deleted  planning/"
    else
      leftovers="$(find "$TARGET/planning" -mindepth 1 -maxdepth 1 -printf '%f ' 2>/dev/null)"
      warn "planning/ is not empty and was kept — it still holds files the framework never created: ${leftovers}"
    fi
  fi
}

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 6 — top up to the target state (T1–T8)
# ══════════════════════════════════════════════════════════════════════════════
#
# Convergence is a TOP-UP, not "no-op if it already looks like v3" (Р11). A
# project installed by an older v3 installer reports 'v3' through the structural
# fingerprint yet has no .pf-version, no PLANNING.md, no CLAUDE.md section and
# 7 skills out of 15. It must get all of them.
#
# Asymmetry (KI-11): FRAMEWORK artifacts (.pf-version, PLANNING.md, the CLAUDE.md
# section, docs/planning/templates/, the skills, the shim) are always rewritten.
# USER documents (docs/planning/{session-log,decisions,implementation-plan}.md,
# .qa-workflow.md) are never touched once they exist.

t1_directories() {
  local d
  for d in docs/issues/open docs/issues/closed docs/planning; do
    if [ ! -d "$TARGET/$d" ]; then
      mkdir -p "$TARGET/$d"
      say "  created  $d/"
    fi
  done
}

t2_version_marker() {
  printf '%s\n' "$PF_VERSION" >"$TARGET/.pf-version"
  say "  wrote    .pf-version ($PF_VERSION)"
}

t3_planning_md() {
  local src="$TEMPLATES_SRC/config/PLANNING.md"
  if [ ! -f "$src" ]; then
    err "template not found: $src"
    return 1
  fi
  render_template "$src" >"$TARGET/PLANNING.md"
  say "  wrote    PLANNING.md"
}

# Р8. The marked-up section is new work — the v1 script had no markers and no
# idempotency (a second run duplicated the whole section). The template is the
# section BODY: the markers are supplied here, which is what lets the same file
# both create CLAUDE.md from scratch and replace a marked region in an existing
# one.
t4_claude_md() {
  [ "${PF_CONVERGE_SKIP_CLAUDE:-0}" = "1" ] && return 0
  local src="$TEMPLATES_SRC/config/CLAUDE.md"
  local file="$TARGET/CLAUDE.md"
  local body n_begin n_end bl el banner tmp

  if [ ! -f "$src" ]; then
    err "template not found: $src"
    return 1
  fi
  body="$(render_template "$src")"

  if [ ! -f "$file" ]; then
    {
      printf '# %s\n\n' "$PROJECT_NAME"
      printf '%s\n' "$PF_BEGIN"
      printf '%s\n' "$body"
      printf '%s\n' "$PF_END"
    } >"$file"
    say "  created  CLAUDE.md (with the pf section)"
    return 0
  fi

  n_begin="$(grep -c -F -- "$PF_BEGIN" "$file")"
  n_end="$(grep -c -F -- "$PF_END" "$file")"

  # An old, UNMARKED v1 section is never deleted: arbitrary user prose may follow
  # it to EOF, and "delete to the end of the file" would eat it.
  banner="$(grep -n -F -- "$V1_BANNER" "$file" | head -n 1 | cut -d: -f1)"

  tmp="$file.pf-tmp"
  if [ "$n_begin" -eq 1 ] && [ "$n_end" -eq 1 ]; then
    bl="$(grep -n -F -- "$PF_BEGIN" "$file" | head -n 1 | cut -d: -f1)"
    el="$(grep -n -F -- "$PF_END" "$file" | head -n 1 | cut -d: -f1)"
    if [ "$bl" -ge "$el" ]; then
      warn "CLAUDE.md: '$PF_END' appears before '$PF_BEGIN' — the section was left untouched, fix the markers by hand"
      return 0
    fi
    {
      [ "$bl" -gt 1 ] && head -n "$((bl - 1))" "$file"
      printf '%s\n' "$PF_BEGIN"
      printf '%s\n' "$body"
      printf '%s\n' "$PF_END"
      tail -n "+$((el + 1))" "$file"
    } >"$tmp" && mv -f "$tmp" "$file"
    say "  updated  CLAUDE.md (pf section replaced in place)"
  elif [ "$n_begin" -eq 0 ] && [ "$n_end" -eq 0 ]; then
    {
      cat "$file"
      printf '\n%s\n' "$PF_BEGIN"
      printf '%s\n' "$body"
      printf '%s\n' "$PF_END"
    } >"$tmp" && mv -f "$tmp" "$file"
    say "  updated  CLAUDE.md (pf section appended)"
  else
    # Unpaired or duplicated markers: warn, and above all do NOT add a second
    # section on top of a file we do not understand.
    warn "CLAUDE.md carries unbalanced pf markers ($n_begin x '$PF_BEGIN', $n_end x '$PF_END') — no section was written; fix the markers by hand"
    return 0
  fi

  if [ -n "$banner" ]; then
    warn "CLAUDE.md:$banner holds an old, unmarked v1 section ('$V1_BANNER'). It was NOT removed — user text may follow it. Delete it by hand once you have checked what is under it."
  fi
}

t5_global_docs() {
  local f src
  for f in session-log.md decisions.md implementation-plan.md; do
    src="$TEMPLATES_SRC/global/$f"
    if [ -f "$TARGET/docs/planning/$f" ]; then
      continue # user document — never overwritten
    elif [ -f "$src" ]; then
      cp "$src" "$TARGET/docs/planning/$f"
      say "  created  docs/planning/$f"
    else
      warn "template not found: $src"
    fi
  done
}

# T6 is a MIRROR, not an overlay (KI-17). `cp -r "$SRC/."` adds and overwrites
# but NEVER deletes: a file dropped from the framework (config/.qa-workflow.md,
# removed without replacement) would linger in the project forever and pass every
# other check. rsync is not used — the repo depends on it nowhere.
t6_mirror_templates() {
  local dst="$TARGET/docs/planning/templates" rel
  if [ ! -d "$TEMPLATES_SRC" ]; then
    err "templates source not found: $TEMPLATES_SRC"
    return 1
  fi
  mkdir -p "$dst"

  while IFS= read -r -d '' rel; do
    rel="${rel#./}"
    mkdir -p "$dst/$(dirname "$rel")"
    [ -d "$dst/$rel" ] && rm -rf -- "${dst:?}/$rel"
    cp -f "$TEMPLATES_SRC/$rel" "$dst/$rel"
  done < <(cd "$TEMPLATES_SRC" && find . -type f -print0 | LC_ALL=C sort -z)

  while IFS= read -r -d '' rel; do
    rel="${rel#./}"
    if [ ! -f "$TEMPLATES_SRC/$rel" ]; then
      rm -f -- "${dst:?}/$rel"
      REPORT_MIRROR_GONE+=("docs/planning/templates/$rel")
      say "  mirrored away  docs/planning/templates/$rel"
    fi
  done < <(cd "$dst" && find . -type f -print0 | LC_ALL=C sort -z)

  while IFS= read -r -d '' rel; do
    rel="${rel#./}"
    [ "$rel" = "." ] && continue
    [ -d "$TEMPLATES_SRC/$rel" ] || rmdir "$dst/$rel" 2>/dev/null || true
  done < <(cd "$dst" && find . -depth -type d -print0)

  say "  mirrored docs/planning/templates/"
}

# T7 — dynamic discovery, lifted from install.sh:72-80. A fourth hardcoded list
# is exactly how defect 3 (7 skills out of 15) came to exist; the final summary
# below is derived from what was actually installed, never from a fixed list.
t7_skills() {
  [ "${PF_CONVERGE_SKIP_CLAUDE:-0}" = "1" ] && return 0
  local skills_dir="$HOME/.claude/skills" src name dst
  mkdir -p "$skills_dir"
  for src in "$SKILLS_SRC"/*/; do
    [ -d "$src" ] || continue
    [ -f "${src}SKILL.md" ] || continue
    name="$(basename "$src")"
    dst="$skills_dir/$name"
    mkdir -p "$dst"
    cp -r "${src}." "$dst/"
    REPORT_SKILLS+=("$name")
  done
  say "  installed ${#REPORT_SKILLS[@]} skill(s) -> $skills_dir"
}

t8_shim() {
  [ "${PF_CONVERGE_SKIP_CLAUDE:-0}" = "1" ] && return 0
  local bin_dir="$HOME/.claude/bin"
  mkdir -p "$bin_dir"
  cat >"$bin_dir/pf" <<EOF
#!/usr/bin/env sh
# Installed by Planning Framework — delegates to the onboarding TUI.
# Regenerated on every converge run; safe to remove.
exec node "$FRAMEWORK_ROOT/tools/onboarding-tui/cli.js" "\$@"
EOF
  chmod +x "$bin_dir/pf"
  say "  installed pf shim -> $bin_dir/pf"
}

# Р4 — .qa-workflow.md is NOT templated and is NEVER created by converge. The
# load-bearing fix is that /pf-qa-setup now actually reaches the project (T7).
check_qa_workflow() {
  local f="$TARGET/.qa-workflow.md"
  if [ ! -f "$f" ]; then
    if [ "${PF_CONVERGE_SKIP_CLAUDE:-0}" = "1" ]; then
      QA_HINT="Run the PF qa-setup skill to create \`.qa-workflow.md\` for this project"
    else
      QA_HINT="Run \`/pf-qa-setup\` in Claude Code to create \`.qa-workflow.md\` for this project"
    fi
  elif grep -qE '\*\*Version:\*\* *2\.0' "$f"; then
    warn ".qa-workflow.md carries the v2 stamp (**Version:** 2.0) — it was NOT overwritten (it is your document). Run \`/pf-qa-setup\` to regenerate it for v3."
  fi
}

# Which v3 documents does this issue still owe? Keyed on the issue TYPE, which is
# the second dash-separated field of the ID (<date>-<type>-<slug>) — the same
# convention /pf routes on. A notes.md on disk means the trivial tier, whose
# pipeline is notes.md -> test_plan.md and which has no BRD, spec or plan.
#
# size_tier is NOT inspected, and cannot be: converge deliberately does not write
# it (Р5), precisely so that /pf's legacy-tier guard asks the user instead of
# inheriting a machine's guess.
required_docs() {
  local dir="$1" id="$2" type
  if [ -f "$dir/notes.md" ]; then
    printf '%s\n' test_plan.md
    return 0
  fi
  type="${id#*-}"
  type="${type%%-*}"
  case "$type" in
    feat | improve) printf '%s\n' brd.md specs.md test_plan.md implementation_plan.md ;;
    *) printf '%s\n' test_plan.md implementation_plan.md ;;
  esac
}

skill_for_doc() {
  case "$1" in
    brd.md | notes.md) printf '/pf-brd' ;;
    specs.md) printf '/pf-spec' ;;
    test_plan.md) printf '/pf-test-plan' ;;
    implementation_plan.md) printf '/pf-impl-plan' ;;
    *) printf '/pf' ;;
  esac
}

# What is still missing from each open issue, so the report can say it out loud —
# by name, and with the skill that writes it — instead of minting a stub
# (defect 5, measure 1). A file that is absent is an unfinished stage, stated
# honestly; a file that is present but is a STUB is the same thing wearing a
# document's name, and is called out as such (measure 2).
collect_missing_docs() {
  local dir id doc f entry
  [ -d "$TARGET/docs/issues/open" ] || return 0
  while IFS= read -r -d '' dir; do
    id="$(basename "$dir")"
    entry=""
    while IFS= read -r doc; do
      [ -f "$dir/$doc" ] && continue
      entry="${entry:+$entry, }$doc ($(skill_for_doc "$doc"))"
    done < <(required_docs "$dir" "$id")

    for f in "$dir"/*.md; do
      [ -f "$f" ] || continue
      if grep -q -F -- "$STUB_MARKER" "$f"; then
        doc="$(basename "$f")"
        entry="${entry:+$entry, }$doc [a stub, not a document — re-run $(skill_for_doc "$doc")]"
      fi
    done

    [ -n "$entry" ] && REPORT_MISSING_DOCS+=("$id: $entry")
  done < <(find "$TARGET/docs/issues/open" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null | LC_ALL=C sort -z)
}

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 7 — report
# ══════════════════════════════════════════════════════════════════════════════

print_report() {
  local item
  say ""
  say "════════════════════════════════════════════════════════════════"
  if [ "$DRY_RUN" -eq 1 ]; then
    say "  DRY-RUN — no changes were made"
  elif [ "$TRANSFER_FAILED" -eq 1 ]; then
    say "  Converge INCOMPLETE — the target state was NOT reached"
  else
    say "  Converge complete"
  fi
  say "════════════════════════════════════════════════════════════════"
  say ""
  say "Detected state : $STATE"
  say "Project        : $TARGET"
  say "Framework      : $FRAMEWORK_ROOT (v$PF_VERSION)"
  say ""

  if [ ${#REPORT_TRANSFERRED[@]} -gt 0 ]; then
    say "Issues transferred from planning/ to docs/issues/:"
    for item in "${REPORT_TRANSFERRED[@]}"; do say "  - $item"; done
    say ""
  fi

  if [ ${#REPORT_SIDECARS[@]} -gt 0 ]; then
    say "Both copies kept (the v3 copy won; the v2 copy is parked next to it):"
    for item in "${REPORT_SIDECARS[@]}"; do say "  - $item"; done
    say ""
  fi

  if [ ${#REPORT_DELETED[@]} -gt 0 ]; then
    say "Deleted (whitelist):"
    for item in "${REPORT_DELETED[@]}"; do say "  - $item"; done
    say ""
  fi

  if [ ${#REPORT_SKILLS[@]} -gt 0 ]; then
    say "Skills installed in \$HOME/.claude/skills/ (${#REPORT_SKILLS[@]}):"
    for item in "${REPORT_SKILLS[@]}"; do say "  /$item"; done
    say ""
  fi

  if [ -n "$BACKUP_DIR" ]; then
    say "Backup (kept — it is the only rollback artifact):"
    say "  $BACKUP_DIR"
    say "  Remove it once you are happy:  rm -rf \"$BACKUP_DIR\""
    say ""
  fi

  say "Still to do by hand:"
  if [ -n "${QA_HINT:-}" ]; then
    say "  - $QA_HINT"
  fi
  if [ ${#REPORT_MISSING_DOCS[@]} -gt 0 ]; then
    say "  - Open issues missing v3 documents (converge does NOT stub them — run the"
    say "    pipeline skills instead: /pf-brd, /pf-spec, /pf-test-plan, /pf-impl-plan):"
    for item in "${REPORT_MISSING_DOCS[@]}"; do say "      $item"; done
  fi
  if [ ${#REPORT_MISSING_DOCS[@]} -eq 0 ] && [ -z "${QA_HINT:-}" ]; then
    say "  - nothing"
  fi
  say ""

  if [ ${#WARNINGS[@]} -gt 0 ]; then
    say "WARNINGS (${#WARNINGS[@]}):"
    for item in "${WARNINGS[@]}"; do say "  - $item"; done
    say ""
  fi

  if [ ${#ERRORS[@]} -gt 0 ]; then
    say "ERRORS (${#ERRORS[@]}) — these need you:"
    for item in "${ERRORS[@]}"; do say "  - $item"; done
    say ""
    say "phase 5 (deletion) was SKIPPED: planning/ is intact, nothing was thrown away."
    say ""
  fi

  if [ "${PF_CONVERGE_SKIP_CLAUDE:-0}" = "1" ]; then
    say "Next: continue with the selected outer adapter."
  else
    say "Next: open Claude Code in the project and run /pf"
  fi
}

print_plan() {
  local src dst
  say ""
  say "Plan (dry run — nothing will be changed):"
  say ""
  if [ ${#P3_SOURCES[@]} -gt 0 ]; then
    say "  Would transfer ${#P3_SOURCES[@]} file(s):"
    for src in "${P3_SOURCES[@]}"; do
      dst="$(map_destination "$src")"
      say "    ${src#"$TARGET"/}  ->  ${dst#"$TARGET"/}"
    done
    say ""
  fi
  if [ ${#P5_PATHS[@]} -gt 0 ]; then
    say "  Would delete (whitelist):"
    for src in "${P5_PATHS[@]}"; do say "    $src"; done
    say ""
  fi
  if [ "$BACKUP_WANTED" -eq 1 ]; then
    say "  Would back up planning/ into planning-backup-<timestamp>/"
  else
    say "  Would NOT create a backup (nothing to transfer or delete)"
  fi
  say ""
  say "  Would top up to the target state:"
  say "    docs/issues/{open,closed}/, docs/planning/      (T1)"
  say "    .pf-version = $PF_VERSION                            (T2)"
  say "    PLANNING.md                                     (T3)"
  say "    CLAUDE.md — the <!-- pf:begin --> section        (T4)"
  say "    docs/planning/{session-log,decisions,implementation-plan}.md, if absent (T5)"
  say "    docs/planning/templates/ mirrored from the framework (T6)"
  say "    skills -> \$HOME/.claude/skills/                  (T7)"
  say "    pf shim -> \$HOME/.claude/bin/pf                  (T8)"
}

# ══════════════════════════════════════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════════════════════════════════════

say ""
say "Planning Framework — converge to v3"
say "==================================="
say ""

GIT_OK=0
git_available && GIT_OK=1

# ─── Phase 1 ──────────────────────────────────────────────────────────────────
detect_state
print_state

collect_phase3_sources
collect_phase5_paths
# Before ANY destination is mapped — and before --dry-run prints the plan, which
# must show the merged destinations and the warnings that go with them.
compute_status_remap

BACKUP_WANTED=0
if [ ${#P3_SOURCES[@]} -gt 0 ] || [ ${#P5_PATHS[@]} -gt 0 ]; then
  BACKUP_WANTED=1
fi

QA_HINT=""
check_qa_workflow

if [ "$DRY_RUN" -eq 1 ]; then
  print_plan
  collect_missing_docs
  print_report
  exit 0
fi

check_worktree

# ─── Confirmation — cancellation is NEVER exit 0 (KI-6) ───────────────────────
# The old v2→v3 migration script answered an empty CONFIRM with `exit 0`. On that
# contract every automated test is green while nothing at all has been migrated.
if [ "$BACKUP_WANTED" -eq 1 ] && [ "$ASSUME_YES" -eq 0 ] && [ "$FORCE" -eq 0 ]; then
  say ""
  say "This will transfer ${#P3_SOURCES[@]} file(s) out of planning/ and then delete"
  say "${#P5_PATHS[@]} whitelisted path(s). A backup of planning/ is taken first."
  printf 'Proceed? [y/N] '
  # `read` returns non-zero at EOF even when it DID read data — a final line with
  # no trailing newline (`printf 'y' | converge`, a heredoc, an editor that does
  # not end files with \n). Treating that as "could not ask" would cancel a run
  # the user plainly agreed to. "Could not ask" is the case where nothing arrived
  # at all, so test the payload, not just the return code.
  REPLY_CONFIRM=""
  if ! IFS= read -r REPLY_CONFIRM && [ -z "$REPLY_CONFIRM" ]; then
    say ""
    say "Converge cancelled — stdin is closed and --yes was not given. Nothing was changed."
    exit 4
  fi
  case "$REPLY_CONFIRM" in
    [Yy] | [Yy][Ee][Ss]) ;;
    *)
      say "Converge cancelled by the user. Nothing was changed."
      exit 4
      ;;
  esac
fi

say ""

# ─── Phase 2 ──────────────────────────────────────────────────────────────────
if [ "$BACKUP_WANTED" -eq 1 ]; then
  say "Phase 2 — backup"
  make_backup || exit 1
  say ""
fi

# ─── Phase 3 ──────────────────────────────────────────────────────────────────
if [ ${#P3_SOURCES[@]} -gt 0 ]; then
  say "Phase 3 — transfer the v2 layout"
  phase3_transfer
  say "  transferred $MOVED_COUNT file(s)"
  say ""
fi

# ─── Phase 4 ──────────────────────────────────────────────────────────────────
say "Phase 4 — normalise issue documents"
phase4_rename_plans
phase4_doc_language
phase4_closed_pointers
say ""

# ─── Phase 5 ──────────────────────────────────────────────────────────────────
# KI-13 / D-B: no deletions until every transfer has succeeded. Silently skipping
# T9–T11 *and* erasing the sources is the worst possible outcome.
if [ "$TRANSFER_FAILED" -eq 1 ]; then
  EXIT_CODE=1
  say "Phase 5 — SKIPPED: a transfer failed, so planning/ is left intact"
  say ""
elif [ ${#P5_PATHS[@]} -gt 0 ]; then
  say "Phase 5 — delete v1/v2 artifacts (whitelist)"
  phase5_delete
  say ""
fi

# ─── Phase 6 ──────────────────────────────────────────────────────────────────
say "Phase 6 — top up to the target state"
t1_directories
t2_version_marker
t3_planning_md
t4_claude_md
t5_global_docs
t6_mirror_templates
t7_skills
t8_shim
say ""

git_stage_footprint

# ─── Phase 7 ──────────────────────────────────────────────────────────────────
collect_missing_docs
print_report

exit "$EXIT_CODE"
