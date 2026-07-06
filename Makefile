PORT ?=

.PHONY: help test-ui update-skills issue-status migrate-v1-to-v2 migrate-v2-to-v3 setup-v2 setup-v3 tui

help:
	@echo "Planning Framework - Commands"
	@echo ""
	@echo "  make test-ui                      Launch the Manual Test UI (see tools/manual-test-ui/README.md)"
	@echo "  make test-ui PORT=4400            Launch it on a specific port"
	@echo "  make update-skills                Propagate skills/ to ~/.claude/skills/ for all consumer projects"
	@echo "  make update-skills SOURCE=path    Propagate from a different source directory"
	@echo "  make issue-status                 Check status of issues from remote branches"
	@echo "  make issue-status ID=20240127-... Check status of a specific issue"
	@echo "  make migrate-v1-to-v2             Migrate a consumer project from v1.0 to v2.0"
	@echo "  make migrate-v2-to-v3             Migrate a consumer project from v2.0 to v3.0"
	@echo "  make setup-v2                     Interactive v2.0 setup for a new consumer project"
	@echo "  make setup-v3                     Interactive v3.0 setup for a new consumer project"
	@echo "  make tui                           Launch the interactive onboarding/update wizard"
	@echo "  make tui TARGET=<path>             Run against a specific target project directory"

test-ui:
	@if [ ! -f tools/manual-test-ui/projects.json ]; then \
		echo "No tools/manual-test-ui/projects.json found."; \
		echo "Run: cp tools/manual-test-ui/projects.json.example tools/manual-test-ui/projects.json"; \
		echo "then edit it to list your project roots."; \
		exit 1; \
	fi
	node tools/manual-test-ui/server.js $(if $(PORT),--port $(PORT),)

update-skills:
	bash scripts/update-skills.sh $(if $(SOURCE),--source $(SOURCE),)

issue-status:
	bash scripts/issue-status.sh $(ID)

migrate-v1-to-v2:
	bash scripts/migrate-v1-to-v2.sh

migrate-v2-to-v3:
	bash scripts/migrate-v2-to-v3.sh

setup-v2:
	bash scripts/setup-planning-v2.sh

setup-v3:
	bash scripts/setup-planning-v3.sh

tui:
	node tools/onboarding-tui/cli.js $(if $(TARGET),--target $(TARGET),)
