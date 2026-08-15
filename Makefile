PORT ?=
AGENTS ?= auto
TARGET ?= .

.PHONY: help test test-ui install activate deactivate uninstall update-skills issue-status converge tui

help:
	@echo "Planning Framework - Commands"
	@echo ""
	@echo "  make test                         Run the Node.js test suite"
	@echo "  make test-ui PORT=4400            Launch the Manual Test UI"
	@echo "  make install AGENTS=codex TARGET=path  Download/update PF4 and activate Codex"
	@echo "  make activate AGENTS=claude       Activate Claude from this PF4 checkout"
	@echo "  make activate AGENTS=codex TARGET=path  Activate Codex for a project"
	@echo "  make deactivate AGENTS=codex TARGET=path  Remove an adapter; keep PF and planning docs"
	@echo "  make uninstall AGENTS=both TARGET=path YES=1  Remove adapters without prompts"
	@echo "  make uninstall AGENTS=both TARGET=path YES=1 REMOVE_CORE=1  Also remove the PF4 runtime cache"
	@echo "  make update-skills AGENTS=codex TARGET=path  Update already active skills"
	@echo "  make issue-status ID=...          Check status of an issue branch"
	@echo "  make converge                     Install, migrate or top up to v4"
	@echo "  make converge TARGET=<path>       Converge a specific project"
	@echo "  make converge AGENTS=both         Install Claude and Codex adapters"
	@echo "  make tui TARGET=<path>            Launch the onboarding wizard"

test:
	node --test tools/onboarding-tui/test/*.test.js test/pf-cli.test.mjs

test-ui:
	node tools/manual-test-ui/server.js $(if $(PORT),--port $(PORT),)

install:
	node scripts/install.mjs --agents $(AGENTS) --target $(TARGET)

activate:
	node scripts/pf-cli.mjs activate --agents $(AGENTS) --target $(TARGET) $(if $(YES),--yes,)

deactivate:
	node scripts/pf-cli.mjs deactivate --agents $(AGENTS) --target $(TARGET) $(if $(YES),--yes,)

update-skills:
	node scripts/pf-cli.mjs update-skills $(if $(SOURCE),--source $(SOURCE),) --target $(TARGET) --agents $(AGENTS)

uninstall:
	node scripts/pf-cli.mjs uninstall --target $(TARGET) --agents $(AGENTS) $(if $(YES),--yes,) $(if $(REMOVE_CORE),--remove-core,)

issue-status:
	node scripts/pf-cli.mjs issue-status $(ID) $(if $(TARGET),--target $(TARGET),)

converge:
	node scripts/pf-cli.mjs converge --target $(TARGET) --agents $(AGENTS) $(if $(YES),--yes,)

tui:
	node tools/onboarding-tui/cli.js --target $(TARGET)
