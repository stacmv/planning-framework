PORT ?=

.PHONY: help test test-migration test-ui install uninstall update-skills issue-status converge tui lint

help:
	@echo "Planning Framework - Commands"
	@echo ""
	@echo "  make test                         Run the suite: test/*.sh + node --test (v2 migration excluded)"
	@echo "  make test-migration               Run the v2 -> v3 migration suite on demand (slow)"
	@echo "  make test-ui                      Launch the Manual Test UI (see tools/manual-test-ui/README.md)"
	@echo "  make test-ui PORT=4400            Launch it on a specific port"
	@echo "  make install                       Install PF3 globally for Claude Code"
	@echo "  make uninstall                     Remove the PF3 global install (asks first)"
	@echo "  make uninstall YES=1               Remove PF3 non-interactively"
	@echo "  make update-skills                Propagate skills/ to ~/.claude/skills/ for all consumer projects"
	@echo "  make update-skills SOURCE=path    Propagate from a different source directory"
	@echo "  make issue-status                 Check status of issues from remote branches"
	@echo "  make issue-status ID=20240127-... Check status of a specific issue"
	@echo "  make converge                     Converge a project on v3 (install, migrate or top up)"
	@echo "  make converge TARGET=<path>       Converge a specific project directory"
	@echo "  make converge TARGET=<path> YES=1    Converge non-interactively (skip confirmation prompt)"
	@echo "  make tui                          Launch the interactive onboarding/update wizard"
	@echo "  make tui TARGET=<path>            Run against a specific project directory"

# `test` is .PHONY on purpose: a directory named test/ exists, and without it
# make would consider the target already up to date and run nothing.
# test/lib.sh is a sourced library, not a suite — it is skipped.
#
# test/converge-migrate.sh is skipped too, but for a different reason: it covers
# the v2 -> v3 transfer paths, and every real consumer project has already
# migrated. The suite is NOT deleted — it is the slowest part of the run (20 of
# the 80 real converge invocations) and is still correct, so it is kept and run
# on demand with `make test-migration`.
#
# Bash suites run in parallel via xargs -P 4, each writing to its own log file.
# After all parallel jobs complete, logs are concatenated in alphabetical order.
# This produces output equivalent to a sequential run — each suite's log is a
# proper prefix of the final output in alphabetical order.
test:
	@# Collect bash suite files (skip lib.sh and converge-migrate.sh)
	@ls test/*.sh 2>/dev/null | grep -v '/lib\.sh$$' | grep -v '/converge-migrate\.sh$$' | sort > /tmp/pf-suites.txt || true
	@ran=$$(wc -l < /tmp/pf-suites.txt); \
	if [ "$$ran" -eq 0 ]; then \
		printf '\n=== test/*.sh\n'; \
		echo "  no bash test suites yet — nothing to run"; \
		echo 0 > /tmp/pf-test.rc; \
	else \
		rm -f /tmp/pf-suite-*.log /tmp/pf-suite-*.rc; \
		cat /tmp/pf-suites.txt | xargs -P 4 bash -c 'name=$$(basename "$$1" .sh); bash "$$1" > /tmp/pf-suite-$$name.log 2>&1; echo $$? > /tmp/pf-suite-$$name.rc' _; \
		rc=0; \
		for f in /tmp/pf-suite-*.rc; do \
			[ -f "$$f" ] && [ "$$(cat "$$f")" -ne 0 ] && rc=1; \
		done; \
		echo $$rc > /tmp/pf-test.rc; \
		cat $$(ls /tmp/pf-suite-*.log | sort); \
	fi
	@# Node tests run after all bash suites complete (sequentially, not in parallel)
	@nodetests=0; \
	for t in tools/onboarding-tui/test/*.test.js; do \
		[ -f "$$t" ] && nodetests=1; \
	done; \
	printf '\n=== node --test tools/onboarding-tui/test/\n'; \
	if [ "$$nodetests" -eq 1 ]; then \
		node --test "tools/onboarding-tui/test/*.test.js" || echo 1 >> /tmp/pf-test.rc; \
	else \
		echo "  no node test suites yet — nothing to run"; \
	fi
	@uitests=0; \
	for t in tools/manual-test-ui/test/*.test.js; do \
		[ -f "$$t" ] && uitests=1; \
	done; \
	printf '\n=== node --test tools/manual-test-ui/test/\n'; \
	if [ "$$uitests" -eq 1 ]; then \
		node --test "tools/manual-test-ui/test/*.test.js" || echo 1 >> /tmp/pf-test.rc; \
	else \
		echo "  no node test suites yet — nothing to run"; \
	fi
	@rc=$$(cat /tmp/pf-test.rc 2>/dev/null || echo 0); \
	printf '\n'; \
	if [ "$$rc" -eq 0 ]; then echo "make test: OK"; else echo "make test: FAILED"; fi; \
	exit $$rc

# The v2 -> v3 migration suite, excluded from `make test` above. Kept runnable
# so the transfer paths can still be exercised deliberately - before touching
# scripts/converge-to-v3.sh, or when a project on v2 does turn up.
test-migration:
	@printf '\n=== %s\n' "test/converge-migrate.sh"; \
	bash test/converge-migrate.sh; \
	rc=$$?; \
	printf '\n'; \
	if [ "$$rc" -eq 0 ]; then echo "make test-migration: OK"; else echo "make test-migration: FAILED"; fi; \
	exit $$rc

test-ui:
	@if [ ! -f tools/manual-test-ui/projects.json ]; then \
		echo "No tools/manual-test-ui/projects.json found."; \
		echo "Run: cp tools/manual-test-ui/projects.json.example tools/manual-test-ui/projects.json"; \
		echo "then edit it to list your project roots."; \
		exit 1; \
	fi
	node tools/manual-test-ui/server.js $(if $(PORT),--port $(PORT),)

lint:
	shellcheck scripts/*.sh test/*.sh || exit 1

install:
	sh scripts/install.sh

uninstall:
	sh scripts/uninstall.sh $(if $(YES),--yes,)

update-skills:
	bash scripts/update-skills.sh $(if $(SOURCE),--source $(SOURCE),)

issue-status:
	bash scripts/issue-status.sh $(ID)

# The single install/upgrade path (Р2): converge brings a project of ANY starting
# state — none / v1 / v2 / half-migrated / incomplete v3 — to the v3 target state.
# It replaces the four former per-version setup and migration targets, all removed.
# Without TARGET= the script defaults to the current directory.
converge:
	bash scripts/converge-to-v3.sh $(if $(TARGET),--target $(TARGET),) $(if $(YES),--yes,)

tui:
	node tools/onboarding-tui/cli.js $(if $(TARGET),--target $(TARGET),)
