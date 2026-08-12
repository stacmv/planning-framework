# Fixture: area-diff-repo (pf-product-test-plan TC-010)

Minimal base for `pf_setup_case "area-diff-repo" --git`. Not a real project —
just enough content for `pf_git_init` to produce one baseline commit. TC-010
itself creates the `develop` and `issue/<ID>` branches, writes the four
changed files (`skills/pf-close/SKILL.md`, `skills/pf-close/foo.md`, a
`scripts/` file, `docs/issues/open/<ID>/specs.md`) on the issue branch, and
performs the `--no-ff` merge that Phase 4 would perform — all of that lives
in the test body, not in this fixture (implementation_plan.md Task 5).

Deliberately never names the actual convergence script (S-1, test/
safety-audit.sh TC-032 step 1): its `scripts/` probe file is a generic
stand-in for "some file under scripts/", not that script.
