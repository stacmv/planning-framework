# Prompt

Add support for a documentation language preference. On issue CREATE, ask the user which language all planning docs for this issue should be written in: English, Russian, or other (user must specify if "other").

## Context

Today, all Planning Framework docs (brd.md, specs.md, test_plan.md, implementation_plan.md, analysis.md, qa_report.md, etc.) are implicitly written in English by whichever skill produces them. There's no mechanism for a non-English-speaking user/team to request docs in their own language, and no per-issue record of which language was chosen so downstream skills (pf-brd, pf-spec, pf-test-plan, pf-impl-plan, pf-check, pf-qa, pf-close, etc.) stay consistent across the pipeline.

## Ask

- When an issue is created (the CREATE stage — i.e. when `prompt.md` is written, likely in the `/pf` skill's issue-creation path and/or wherever issue folders get initialized), ask the user for their preferred documentation language: English, Russian, or other (free text if other).
- Persist that choice somewhere in the issue folder so every subsequent pipeline skill (BRD, spec, test plan, impl plan, check, QA, close) can read it and write its output document in that language.
- Every doc-producing skill should honor the stored preference for that issue.
- Default behavior (no interaction, defaults to English) should be preserved for anyone who doesn't care — but the ask here is explicit prompting at CREATE time, not a silent default.

## Open questions for BRD/spec stage

- Exact storage location/format for the language preference (e.g. a field in prompt.md's frontmatter, or a separate `.language` file in the issue folder).
- Whether structural elements (headings like "BRD", "Status Tracker", table column names) stay in English for consistency with the framework's own tooling (e.g. pf-check's parsing of `**PASS**`/`**FAIL**`) while prose content is translated, or whether everything including headings is translated.
- Whether this is retroactive (existing open issues) or only applies to new issues going forward.
