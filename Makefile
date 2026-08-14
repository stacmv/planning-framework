PORT ?=
AGENTS ?= auto
UNINSTALL_AGENTS ?= codex

.PHONY: help test test-ui update-skills uninstall issue-status converge tui

help:
	@echo "Planning Framework - Commands"
	@echo ""
	@echo "  make test                         Run the Node.js test suite"
	@echo "  make test-ui PORT=4400            Launch the Manual Test UI"
	@echo "  make update-skills                Install skills for Claude"
	@echo "  make update-skills AGENTS=codex TARGET=path  Install skills for Codex"
	@echo "  make uninstall TARGET=path        Remove PF4 Codex integration"
	@echo "  make issue-status ID=...          Check status of an issue branch"
	@echo "  make converge                     Install, migrate or top up to v4"
	@echo "  make converge TARGET=<path>       Converge a specific project"
	@echo "  make converge AGENTS=both         Install Claude and Codex adapters"
	@echo "  make tui TARGET=<path>            Launch the onboarding wizard"

test:
	node --test tools/onboarding-tui/test/*.test.js test/pf-cli.test.mjs

test-ui:
	node tools/manual-test-ui/server.js $(if $(PORT),--port $(PORT),)

update-skills:
	node scripts/pf-cli.mjs update-skills $(if $(SOURCE),--source $(SOURCE),) $(if $(TARGET),--target $(TARGET),) --agents $(AGENTS)

uninstall:
	node scripts/pf-cli.mjs uninstall $(if $(TARGET),--target $(TARGET),) --agents $(UNINSTALL_AGENTS) $(if $(YES),--yes,)

issue-status:
	node scripts/pf-cli.mjs issue-status $(ID) $(if $(TARGET),--target $(TARGET),)

converge:
	node scripts/pf-cli.mjs converge $(if $(TARGET),--target $(TARGET),) --agents $(AGENTS) $(if $(YES),--yes,)

tui:
	node tools/onboarding-tui/cli.js $(if $(TARGET),--target $(TARGET),)
