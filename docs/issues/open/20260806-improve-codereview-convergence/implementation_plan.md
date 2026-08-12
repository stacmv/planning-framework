## Implementation Plan: Сходимость ревью и честность отчётов стадий

### Overview

Предмет этой issue — не код, а **проза пяти `pf-*` skill-файлов**
(`pf-codereview`, `pf-execute`, `pf-check`, `pf`, `pf-close`), которую во
время реального прогона интерпретирует LLM-агент. `pf-roles` и `pf-git`
не трогаются — обе issue's предшествующие issue-документы (`test_plan.md`
Overview, `brd.md`) явно оставляют их за скобками; вся эта issue ссылается
на их канонические разделы по имени, не переопределяя их.

Из этого следует форма плана. Каждый Auto тест-кейс тест-плана состоит из
двух неразделимых частей — транскрибированного bash-хелпера на фикстурах
и drift-guard'а, сверяющего хелпер с реальным текстом `SKILL.md` — и обе
части обязаны появиться в одной **`tests`**-задаче. Правил, которые эти
drift-guard'ы ищут, в `skills/` сегодня физически нет (кроме TC-011,
единственного baseline/regression-кейса), поэтому 22 из 23 Auto TC дают
**ожидаемо RED** сразу после создания соответствующей `tests`-задачи —
это не брак плана, а прямое следствие test-first-подхода, которого
требует сама issue (see `test_plan.md`, пункт 3 Overview). План поэтому
разбит на пары «`tests`-задача → `code`-задача» по областям user stories:
сначала тест, ожидаемо красный, затем правка `SKILL.md`, которая его
зеленит — шесть `tests`-задач (1, 3, 5, 7, 9, 13) и восемь `code`-задач
(2, 4, 6, 8, 10, 11, 12, 14). Порядок задач в этом документе — тот
порядок, в котором они перечислены ниже, а не обязательный порядок
исполнения `/pf-execute` (см. раздел Dependencies за реальным графом).

**Каждый TC-ID из 27 в `test_plan.md` привязан ровно к одной задаче** — к
`code`-задаче, которая делает соответствующий drift-guard зелёным (или,
для четырёх Manual TC, которая реализует проверяемое ими поведение).
`tests`-задачи (1, 3, 5, 7, 9, 13) сами несут `Mapped Test Cases: None` —
они инфраструктурные: пишут харнесс для TC, которые формально числятся за
их парной `code`-задачей, по образцу `20260806-bug-test-plan-tc-
untracked`'s `implementation_plan.md` (его Task 5 тоже не несёт
TC-001..006, которые её сьют реализует, — только собственный TC-007).
Это исключает двойное назначение одного TC двум задачам.

Два решения, принятые на стадии `brd.md`/`test_plan.md`, не пересматриваются
здесь и явно закреплены в соответствующих задачах:
- словарь состояний находки в ledger `code_review.md` закрыт на шести
  значениях — `open` (начальное) плюс пять терминальных (`fixed`,
  `accepted-risk`, `deferred`, `wont-fix`, `duplicate-of CR-NNN`) — Task 4;
- гейт полноты плана реализации живёт только в `skills/pf-execute/SKILL.md`
  как условие *передачи* работы в ревью (выходной гейт стадии реализации),
  не как входной гейт `pf-codereview` — Task 8. `pf-codereview`'s Phase 0
  уже проверяет «`implementation_plan.md` complete» по общему определению
  `pf-size-tiers/SKILL.md` — это другая, уже существующая проверка, и Task 8
  её не дублирует и не переносит.

Переклассификация важности (AC-3.2/BR-4) остаётся **единственным** признаком
блокировки — Task 6 явно не вводит параллельного поля `blocking: yes/no`
рядом с P0/P1/P2, а понижает саму важность находки. BR-5's две разные
механики («остатки на выходе PASS → `docs/planning/tech-debt.md`» против
«вынос в follow-up issue как способ пройти гейт, только для P1») тоже не
путаются — обе задокументированы раздельно в Task 6.

Новый тестовый код — шесть файлов `test/*.sh` плюс фикстуры под
`test/fixtures/pf-codereview-convergence/…`. Ни один не требует правки
`Makefile`: `make test`'s цикл (`for t in test/*.sh`) подбирает любой новый
файл автоматически, за вычетом `lib.sh` и `converge-migrate.sh` — оба
здесь не создаются. Каждый шаг каждого нового Auto TC обязан печатать
`pf_pass "TC-NNN step K: …"` / `pf_fail "TC-NNN step K: …"` — это
единственная форма, которую распознаёт сканирование `/pf-test`'а Phase 3.2;
баннер `printf '=== TC-NNN …'` меткой не считается. Это требование указано
в каждой `tests`-задаче ниже, а не только здесь, чтобы ни одна не потеряла
его по дороге.

**О формулировке Acceptance Criteria ниже.** Для `code`-задач «TC-NNN
passes» означает то же, что везде — TC полностью зелёный. Для `tests`-задач
это было бы неверно сформулировать так же: часть TC (drift-guard) обязана
быть RED до соответствующей `code`-задачи. Acceptance Criteria `tests`-задач
поэтому сформулированы как «TC-NNN harness реализован; drift-guard
ожидаемо RED до Task N» — точнее отражает то, что реально проверяется на
этом шаге, не переопределяя сам TC.

### Files to Create/Modify

**New:**
- `test/pf-codereview-rounds.sh` — TC-001..004
- `test/pf-codereview-ledger.sh` — TC-005..008
- `test/pf-codereview-triage.sh` — TC-010..012
- `test/pf-execute-completeness.sh` — TC-013..017
- `test/pf-honest-reporting-static.sh` — TC-018, TC-021..023
- `test/pf-execute-task-dispatch.sh` — TC-024..026
- `test/fixtures/pf-codereview-convergence/with-rounds-5/prompt.md`
- `test/fixtures/pf-codereview-convergence/no-rounds-field/prompt.md`
- `test/fixtures/pf-codereview-convergence/round1-2-blocking.md`
- `test/fixtures/pf-codereview-convergence/round1-3-blocking.md`
- `test/fixtures/pf-codereview-convergence/round1-4-blocking.md`
- `test/fixtures/pf-codereview-convergence/budget-exhausted-open.md`
- `test/fixtures/pf-codereview-convergence/budget-remaining-open.md`
- `test/fixtures/pf-codereview-convergence/budget-exhausted-clean.md`
- `test/fixtures/pf-codereview-convergence/ledger-round1-3-entries.md`
- `test/fixtures/pf-codereview-convergence/ledger-all-states-set.md`
- `test/fixtures/pf-codereview-convergence/ledger-missing-state.md`
- `test/fixtures/pf-codereview-convergence/ledger-state-open.md`
- `test/fixtures/pf-codereview-convergence/ledger-open-p0-round1.md`
- `test/fixtures/pf-codereview-convergence/ledger-open-p0-round7.md`
- `test/fixtures/pf-codereview-convergence/impl-plan-all-checked.md`
- `test/fixtures/pf-codereview-convergence/impl-plan-one-unchecked.md`
- `test/fixtures/pf-codereview-convergence/coverage-forward-complete/implementation_plan.md`
- `test/fixtures/pf-codereview-convergence/coverage-forward-complete/test_plan.md`
- `test/fixtures/pf-codereview-convergence/coverage-forward-gap/implementation_plan.md`
- `test/fixtures/pf-codereview-convergence/coverage-forward-gap/test_plan.md`
- `test/fixtures/pf-codereview-convergence/coverage-converse-complete/implementation_plan.md`
- `test/fixtures/pf-codereview-convergence/coverage-converse-complete/test_plan.md`
- `test/fixtures/pf-codereview-convergence/coverage-converse-gap/implementation_plan.md`
- `test/fixtures/pf-codereview-convergence/coverage-converse-gap/test_plan.md`
- `test/fixtures/pf-codereview-convergence/impl-plan-mismatched-numbering.md`

**Modified:**
- `skills/pf-codereview/SKILL.md` — round budget & escalation (Task 2),
  findings ledger (Task 4), blocking rubric & triage (Task 6), empty
  review target / off-branch handling (Task 10)
- `skills/pf-check/SKILL.md` — empty review target / off-branch handling
  (Task 10), check-passed marker — writer side (Task 11)
- `skills/pf/SKILL.md` — check-passed marker — reader side (Task 11)
- `skills/pf-execute/SKILL.md` — completeness gate (Task 8), self-contained
  task dispatch (Task 14)
- `skills/pf-close/SKILL.md` — no phase ends without an explicit stop and a
  concrete recovery path (Task 12)

---

### Implementation Tasks

#### Task 1: Тесты бюджета раундов и эскалации

**Task Type:** tests
**Mapped Test Cases:** нет — infrastructure task: сьют пишет тестовую обвязку, а сами кейсы заявлены на парной code-задаче (Task 2), которая делает их drift-guard'ы зелёными. Номера кейсов намеренно не перечислены в этом поле: оно машинно парсится гейтом полноты (AC-4.2/AC-4.3), и номер кейса, стоящий в прозе поля, был бы прочитан как настоящее сопоставление. Перечень — в Acceptance Criteria ниже.
**Files:**
- `test/pf-codereview-rounds.sh` - новый: хелперы `pf_cr_review_rounds`, `pf_cr_round1_decision`, `pf_cr_budget_decision` + drift-guards на `skills/pf-codereview/SKILL.md`
- `test/fixtures/pf-codereview-convergence/with-rounds-5/prompt.md` - новый
- `test/fixtures/pf-codereview-convergence/no-rounds-field/prompt.md` - новый
- `test/fixtures/pf-codereview-convergence/round1-2-blocking.md` - новый
- `test/fixtures/pf-codereview-convergence/round1-3-blocking.md` - новый
- `test/fixtures/pf-codereview-convergence/round1-4-blocking.md` - новый
- `test/fixtures/pf-codereview-convergence/budget-exhausted-open.md` - новый
- `test/fixtures/pf-codereview-convergence/budget-remaining-open.md` - новый
- `test/fixtures/pf-codereview-convergence/budget-exhausted-clean.md` - новый

**Implementation Notes:**
- Follow `test/skills-role-matrix-static.sh`'s anchor-narrowing technique (locate a section by its own heading/text, then grep only inside that range) for TC-002 step 4 and TC-004 — a bare unscoped `grep` on the whole file would pass on an unrelated occurrence of the same words elsewhere.
- Every step reports via `pf_pass "TC-NNN step K: …"` / `pf_fail "TC-NNN step K: …"` — the literal form `/pf-test`'s Phase 3.2 scan recognizes. A `printf '=== TC-NNN …'` banner is not a substitute.
- TC-001/002/003 helper steps (1-2, or 1-3) are pure bash logic on the fixtures above — no dependency on `skills/pf-codereview/SKILL.md`'s actual text, so they can be GREEN from the start. Only the drift-guard step (TC-001 step 3, TC-002 step 4, TC-003 step 4) reads the real file and is expected RED until Task 2 lands — write its failure message to say "rule not documented in SKILL.md", distinguishable from a missing-fixture/missing-file infra failure (`test_plan.md`'s own requirement).
- TC-004 has no fixtures at all — locate the Phase 4 round-2+ instruction block in `skills/pf-codereview/SKILL.md` (today: the "loop" paragraph after "If 'Fix now'") and require BOTH the "closure of prior findings" signal and the "review… own diff" signal inside that same block, not just anywhere in the file — a single-sided fix (only one of the two) must fail this TC exactly as it failed round 9 of `20260709-feat-dockerize`.
- New file — no `Makefile` edit needed; `make test`'s `for t in test/*.sh` loop picks it up automatically.

**Acceptance Criteria:**
- [ ] TC-001 harness implemented; helper steps (1-2) pass now, drift-guard step (3) is RED pending Task 2
- [ ] TC-002 harness implemented; helper steps (1-3) pass now, drift-guard step (4) is RED pending Task 2
- [ ] TC-003 harness implemented; helper steps (1-3) pass now, drift-guard step (4) is RED pending Task 2
- [ ] TC-004 harness implemented; RED pending Task 2 (no fixtures, pure static audit)

---

#### Task 2: `pf-codereview` — бюджет раундов и эскалация

**Task Type:** code
**Mapped Test Cases:** TC-001, TC-002, TC-003, TC-004, TC-027
**Files:**
- `skills/pf-codereview/SKILL.md` - модифицирован: поле `review_rounds` в `prompt.md` (дефолт 3), ранний бросок назад в раунде 1, исчерпание бюджета, дельта-проверка раунда N>1

**Implementation Notes:**
- **`review_rounds` field.** Read from `docs/issues/open/ISSUE-ID/prompt.md`'s frontmatter, default `3` when absent — document both the field name and the default literally (TC-001's drift-guard greps for both together).
- **Round 1 early bail-out (AC-1.2).** Add this check right after Phase 3 first writes `code_review.md` for round 1 specifically: if the round found **3 or more** blocking (P0/P1) findings, do **not** enter the Phase 4 fix loop at all — instead, convert each finding into a new task appended to `implementation_plan.md`, and route the issue back to `/pf-execute`. Below the threshold (0-2 blocking), Phase 4 runs exactly as today. State the threshold as "3 or more", the destination as `/pf-execute` specifically (not just "back to execution" in prose), and that findings become `implementation_plan.md` tasks — TC-002's drift-guard checks for all three signals together.
- **Round number.** Today's Phase 4 loop has no concept of a round counter at all. Derive it from the ledger Task 4 introduces (highest round number recorded + 1 for a fresh review; 1 for an empty/first ledger) — do not add a second, separate counter file; a second counter is exactly the kind of "two mechanisms for one fact" this issue's BRD flags as a defect pattern (see AC-3.2's parallel-flag prohibition, same principle applied here).
- **Budget exhaustion (AC-1.3, BR-7).** When the current round equals `review_rounds` and at least one P0/P1 is still open: write `verdict` as **not** `PASS`, do not loop again — instead take the same "convert remaining findings to `implementation_plan.md` tasks, return to `/pf-execute`" path as the round-1 bail-out. When the current round equals the budget but the round's own review is clean (no open P0/P1), the cycle closes as `PASS` regardless of round number — the budget is a trigger for escalation, never a ceiling that blocks a legitimate `PASS` (BR-7). TC-003's drift-guard checks for both halves of this rule.
- **Round N>1 dual check (AC-1.4).** Rewrite the Phase 4 loop instruction for the second and later rounds so it explicitly requires BOTH: (a) verifying that every blocking finding from the previous round's ledger is actually closed, AND (b) reviewing the current round's own fix diff for new problems. A one-sided instruction ("only verify closure" or "only review the new diff") is exactly what let round 9 of `20260709-feat-dockerize` ship 2 new P0s unreviewed — do not phrase this as "re-run Phase 2" alone, as today's text does.
- **Do not weaken Phase 3's existing `FAIL` condition** ("any open P0 or P1 → FAIL") while adding round/budget logic — Task 6's regression guard (TC-011) depends on this staying true independent of round number; a bug here would silently pass TC-003 while failing TC-011.
- TC-027 (Manual, e2e) is mapped here because it is primarily an acceptance check of this task's mechanism (round budget driving early bail-out or convergence) exercised live, on top of the ledger (Task 4) and triage (Task 6) machinery — it does not add new SKILL.md text of its own.

**Acceptance Criteria:**
- [ ] TC-001 passes
- [ ] TC-002 passes
- [ ] TC-003 passes
- [ ] TC-004 passes
- [ ] TC-027 — verified via live multi-round `/pf-codereview`/`/pf-execute` run on the prepared 5-defect fixture (see `test_plan.md` TC-027 Steps)

---

#### Task 3: Тесты ledger находок

**Task Type:** tests
**Mapped Test Cases:** нет — infrastructure task: сьют пишет тестовую обвязку, а сами кейсы заявлены на парной code-задаче (Task 4), которая делает их drift-guard'ы зелёными. Номера кейсов намеренно не перечислены в этом поле: оно машинно парсится гейтом полноты (AC-4.2/AC-4.3), и номер кейса, стоящий в прозе поля, был бы прочитан как настоящее сопоставление. Перечень — в Acceptance Criteria ниже.
**Files:**
- `test/pf-codereview-ledger.sh` - новый: хелперы `pf_cr_append_finding`, `pf_cr_valid_state`, `pf_cr_validate_pass_ledger` + drift-guards
- `test/fixtures/pf-codereview-convergence/ledger-round1-3-entries.md` - новый
- `test/fixtures/pf-codereview-convergence/ledger-all-states-set.md` - новый
- `test/fixtures/pf-codereview-convergence/ledger-missing-state.md` - новый
- `test/fixtures/pf-codereview-convergence/ledger-state-open.md` - новый

**Implementation Notes:**
- TC-005 steps 1-3 are pure bash (append a row, byte-compare the untouched prior rows, check the new row carries ID/round/state) — GREEN from the start. Step 4 (drift-guard for `CR-NNN` format + "append-only") is RED until Task 4.
- TC-006's closed six-value dictionary — `open` (initial) plus five terminal (`fixed`, `accepted-risk`, `deferred`, `wont-fix`, `duplicate-of CR-NNN`) — is a decision already made in `brd.md`/`test_plan.md`; `pf_cr_valid_state` hardcodes exactly these six and rejects anything else (step 2's `wontfix-later` probe). Steps 3 and 4's drift-guards are two **separate** greps — five terminal literals together (step 3) and `open`-as-initial-state documented separately (step 4) — do not collapse them into one grep, `test_plan.md` requires both distinctly.
- TC-007 has no fixtures — locate both the "Claude review path" and "Codex path" sections' round-2+ application in `skills/pf-codereview/SKILL.md` and require, together: (a) the ledger of prior findings is actually passed to the reviewer, and (b) both "don't repeat" and "look for new" appear as two independent signals, not one phrase happening to contain both words.
- TC-008 step 3 is a **negative control**: a ledger row with `state: open` must NOT be flagged by this validator (an explicit `open` is a real word from the six-value dictionary, not a missing record) — only a genuinely empty State cell is a violation. Do not let the helper conflate "empty" and "open"; TC-011 (Task 5) is the separate rule that blocks `PASS` on an `open` P0, not this one.

**Acceptance Criteria:**
- [ ] TC-005 harness implemented; steps 1-3 pass now, step 4 (drift-guard) is RED pending Task 4
- [ ] TC-006 harness implemented; steps 1-2 pass now, steps 3-4 (drift-guards) are RED pending Task 4
- [ ] TC-007 harness implemented; RED pending Task 4 (no fixtures, pure static audit)
- [ ] TC-008 harness implemented; steps 1-3 pass now, step 4 (drift-guard) is RED pending Task 4

---

#### Task 4: `pf-codereview` — append-only ledger находок

**Task Type:** code
**Mapped Test Cases:** TC-005, TC-006, TC-007, TC-008
**Files:**
- `skills/pf-codereview/SKILL.md` - модифицирован: Phase 3 переходит с перезаписываемых секций P0/P1/P2 на append-only ledger `CR-NNN`

**Implementation Notes:**
- **This replaces KI-3.** Today's Phase 3 rewrites the `### P0`/`### P1`/`### P2` sections wholesale on every run — no stable IDs, no append-only guarantee. Redesign `code_review.md`'s findings section as a table (or equivalent structured list) keyed by a stable `CR-NNN` ID, carrying at minimum: ID, round number, priority (P0/P1/P2), description, and **state**. A later Phase 3 run only ever appends new `CR-NNN` rows or updates the `state` cell of an existing row — it never rewrites or deletes a previously written row's identity/round/description (BR-8).
- **Six-value state dictionary**, spelled out verbatim: `open` (assigned when a finding is first created) plus five terminal resolutions — `fixed`, `accepted-risk`, `deferred`, `wont-fix`, `duplicate-of CR-NNN`. This is the same closed set `brd.md`/`test_plan.md` already fixed — do not add a seventh value or rename any of the five.
- **Reviewer prompt for round 2+** (both the "Claude review path" and the Codex path's brief): pass the current ledger of prior findings alongside the diff, with an explicit instruction that these are already triaged — do not re-report them, look specifically for what the round's fixes introduced (AC-2.3). This is the text TC-007's drift-guard checks.
- **`PASS` validation (AC-2.4).** Before writing `verdict: PASS`, every ledger row must carry an explicit, non-empty `state` — an empty cell is a violation (this is what silently lost the P2 from round 1 of `20260709-feat-dockerize`); a row with `state: open` is not itself a violation of *this* rule (it is a real, explicit value) — whether an `open` P0 blocks `PASS` is Task 6's separate rule (TC-011), layered on top, not replaced by this one.
- Round-number bookkeeping for the ledger is what Task 2 reads to compute the current round — keep the row's `round` field authoritative; do not introduce a second counter.

**Acceptance Criteria:**
- [ ] TC-005 passes
- [ ] TC-006 passes
- [ ] TC-007 passes
- [ ] TC-008 passes

---

#### Task 5: Тесты рубрики блокирования и triage (Auto-часть)

**Task Type:** tests
**Mapped Test Cases:** нет — infrastructure task: сьют пишет тестовую обвязку, а сами кейсы заявлены на парной code-задаче (Task 6), которая делает их drift-guard'ы зелёными. Номера кейсов намеренно не перечислены в этом поле: оно машинно парсится гейтом полноты (AC-4.2/AC-4.3), и номер кейса, стоящий в прозе поля, был бы прочитан как настоящее сопоставление. Перечень — в Acceptance Criteria ниже.
**Files:**
- `test/pf-codereview-triage.sh` - новый: `pf_cr_gate_verdict` helper + drift-guards; TC-012's `pf_cr_followup_allowed` helper
- `test/fixtures/pf-codereview-convergence/ledger-open-p0-round1.md` - новый
- `test/fixtures/pf-codereview-convergence/ledger-open-p0-round7.md` - новый

**Implementation Notes:**
- **TC-011 is the plan's one baseline/regression case** — `skills/pf-codereview/SKILL.md`'s Phase 3 already says "If any P0 or P1 finding is open: write FAIL", unconditioned by round number. Write this TC to be **GREEN today, before any other task in this issue runs** — its purpose is to catch a regression Task 2's round-budget logic (or Task 6's triage logic) might accidentally introduce, not to prove new behavior. Run it early and re-run it after Tasks 2 and 6 land, exactly as `test_plan.md` frames it.
- TC-010 is a pure static audit (no fixtures) — locate an explicitly named reclassification step (not just "assign priorities") in `skills/pf-codereview/SKILL.md`, plus a requirement that the reason is retained per finding, plus a requirement that the reclassification is visible in `code_review.md` itself — all three signals together, RED until Task 6.
- TC-012's `pf_cr_followup_allowed(priority)` is pure bash (`P1` → `allowed`, `P0` → `rejected`) — GREEN from the start; its drift-guard (step 3) checks that the **two separate BR-5 mechanisms** — "where PASS-time remnants go" (`tech-debt.md`) vs. "what is available to pass the gate" (follow-up issue, P1-only) — are documented as two distinct things, not merged into one, and RED until Task 6.

**Acceptance Criteria:**
- [ ] TC-010 harness implemented; RED pending Task 6 (no fixtures, pure static audit)
- [ ] TC-011 harness implemented and passes now (baseline/regression guard)
- [ ] TC-012 harness implemented; helper step passes now, drift-guard step is RED pending Task 6

---

#### Task 6: `pf-codereview` — рубрика блокирования и triage

**Task Type:** code
**Mapped Test Cases:** TC-009, TC-010, TC-011, TC-012
**Files:**
- `skills/pf-codereview/SKILL.md` - модифицирован: требование сценария отказа для P0/P1, явный шаг переклассификации, follow-up issue только для P1

**Implementation Notes:**
- **Failure-scenario requirement (AC-3.1).** A P0/P1 finding must name a concrete failure scenario: input/state → wrong output, crash, regression, or violation of a stated requirement. Add this as an explicit requirement on the findings-collection step (Phase 2's brief to the reviewer, or a new triage step right after it).
- **Reclassification, not a second flag (AC-3.2, BR-4).** A finding that does not name a failure scenario is **reclassified to P2** — its priority itself changes. Do **not** add a separate `blocking: yes/no` field next to the existing P0/P1/P2 priority; the BRD explicitly rejects this shape (a second, parallel signal either breaks the gate or lets an important finding pass as `PASS`). Priority remains the single axis the gate reads.
- **Explicit, attributed, visible step (AC-3.3).** Name this as its own step (not folded silently into "group by priority"), require a one-line reason recorded per reclassified finding, and require the reclassification to be visible in `code_review.md`'s own ledger row (e.g., a note next to the finding) — not just applied invisibly before the report is written. TC-010's drift-guard checks all three together.
- **Follow-up issue — P1 only, never P0 (AC-3.5, BR-5).** Add a third way to resolve a finding at the gate: filing it as a separate follow-up issue. Available only for P1; a P0 has no such option under any circumstance. Document this as clearly distinct from where PASS-time remnants (P2/`deferred`) go (`docs/planning/tech-debt.md`, per BR-5) — these are two different mechanisms and must read as two different mechanisms in the text, not one.
- **Do not touch Phase 3's unconditional "any open P0/P1 → FAIL" line** while writing this task — TC-011 (Task 5) is the guard that this stays true.
- TC-009 (Manual) is mapped here — it is the live verification that a real reviewer run actually reclassifies a no-failure-scenario finding to P2 while keeping a real bug as a blocking P0/P1, with no second blocking flag anywhere in the resulting `code_review.md`.

**Acceptance Criteria:**
- [ ] TC-009 — verified via live `/pf-codereview` run on the `triage-severity` fixture (see `test_plan.md` TC-009 Steps)
- [ ] TC-010 passes
- [ ] TC-011 passes (still — no regression introduced)
- [ ] TC-012 passes

---

#### Task 7: Тесты гейта полноты `/pf-execute`

**Task Type:** tests
**Mapped Test Cases:** нет — infrastructure task: сьют пишет тестовую обвязку, а сами кейсы заявлены на парной code-задаче (Task 10, Task 11 и Task 12), которая делает их drift-guard'ы зелёными. Номера кейсов намеренно не перечислены в этом поле: оно машинно парсится гейтом полноты (AC-4.2/AC-4.3), и номер кейса, стоящий в прозе поля, был бы прочитан как настоящее сопоставление. Перечень — в Acceptance Criteria ниже.
**Files:**
- `test/pf-execute-completeness.sh` - новый: `pf_execute_all_tasks_checked`, `pf_execute_task_has_test`, `pf_execute_tc_has_task` helpers + drift-guards
- `test/fixtures/pf-codereview-convergence/impl-plan-all-checked.md` - новый
- `test/fixtures/pf-codereview-convergence/impl-plan-one-unchecked.md` - новый
- `test/fixtures/pf-codereview-convergence/coverage-forward-complete/implementation_plan.md` - новый
- `test/fixtures/pf-codereview-convergence/coverage-forward-complete/test_plan.md` - новый
- `test/fixtures/pf-codereview-convergence/coverage-forward-gap/implementation_plan.md` - новый
- `test/fixtures/pf-codereview-convergence/coverage-forward-gap/test_plan.md` - новый
- `test/fixtures/pf-codereview-convergence/coverage-converse-complete/implementation_plan.md` - новый
- `test/fixtures/pf-codereview-convergence/coverage-converse-complete/test_plan.md` - новый
- `test/fixtures/pf-codereview-convergence/coverage-converse-gap/implementation_plan.md` - новый
- `test/fixtures/pf-codereview-convergence/coverage-converse-gap/test_plan.md` - новый

**Implementation Notes:**
- All three helpers parse the literal `**Mapped Test Cases:**` field in a task's heading block — exactly the field this very document uses — never a TC-ID mentioned in prose elsewhere in a task's description. The `-gap` fixtures each plant a negative control: a TC-ID mentioned in prose (Task 3's description, or the plan's Overview) that must **not** count as a mapping. This is the exact P0 a prior BRD review of this issue caught on the reversed-direction confusion between TC-014 and TC-015 — get the direction right in both helpers independently.
- TC-013's two fixtures and helper are pure bash (checkbox scan) — GREEN from the start; only its drift-guard (step 3) is RED pending Task 8.
- TC-014/TC-015 helper steps (parsing `Mapped Test Cases:` correctly, including the negative control) are GREEN from the start; each TC's step-3 drift-guard is direction-sensitive — TC-014 greps for the forward-direction phrasing ("every task has a test") and explicitly must **not** be satisfied by the reverse phrasing alone (and vice versa for TC-015) — write both drift-guards to check this exclusion, not just presence.
- TC-016/TC-017 are pure static audits (no fixtures) of the same gate block — RED until Task 8 exists at all.

**Acceptance Criteria:**
- [ ] TC-013 harness implemented; helper steps pass now, drift-guard is RED pending Task 8
- [ ] TC-014 harness implemented; helper steps pass now, drift-guard is RED pending Task 8
- [ ] TC-015 harness implemented; helper steps pass now, drift-guard is RED pending Task 8
- [ ] TC-016 harness implemented; RED pending Task 8
- [ ] TC-017 harness implemented; RED pending Task 8

---

#### Task 8: `pf-execute` — гейт полноты перед передачей в ревью

**Task Type:** code
**Mapped Test Cases:** TC-013, TC-014, TC-015, TC-016, TC-017
**Files:**
- `skills/pf-execute/SKILL.md` - модифицирован: новый блокирующий гейт полноты, вставленный между завершением задач и переходом к `/pf-codereview`

**Implementation Notes:**
- **Location.** This gate belongs only here — per US-4, it is an output gate of the implementation stage (a condition on *handing off* to review), not an input gate of `/pf-codereview`. Insert it into Phase 3 ("Completion Summary"), before the final "Ready for Testing" report, or as a new Phase 3.5 — either way, before this skill's own completion is reported.
- **Check 1 — all plan checkboxes done (AC-4.1).** Mechanically scan `implementation_plan.md` for any remaining `- [ ]` line. Any unchecked item blocks.
- **Check 2 — forward: every task has a test (AC-4.2).** For every task in `implementation_plan.md`, its `**Mapped Test Cases:**` field must be non-empty. This is the direction that would have caught rounds 5 and 8 of `20260709-feat-dockerize` (functionality declared, not built) — a TC-ID mentioned only in a task's prose description does not count.
- **Check 3 — reverse: every TC has a task (AC-4.3).** For every TC row in `test_plan.md`'s Status Tracker, at least one task's `Mapped Test Cases:` field must name it. This is a **different** gap from Check 2 (a requirement nobody picked up) and does not substitute for it.
- **All three blocking (AC-4.4).** State plainly that these are hard stops, not advisory warnings — a soft warning is exactly what "the gate didn't hold" meant in the source incident (dockerize case, finding 4).
- **All three mechanical (AC-4.5).** Phrase each check as a deterministic parse/scan — no "use your judgment whether coverage is sufficient" language anywhere in this block; a model that can be talked past the gate is not a gate.

**Acceptance Criteria:**
- [ ] TC-013 passes
- [ ] TC-014 passes
- [ ] TC-015 passes
- [ ] TC-016 passes
- [ ] TC-017 passes

---

#### Task 9: Тесты честной отчётности стадий (статический аудит, AC-5.1/5.2/5.3/5.4/5.5)

**Task Type:** tests
**Mapped Test Cases:** нет — infrastructure task: сьют пишет тестовую обвязку, а сами кейсы заявлены на парной code-задаче (Task 10, Task 11 и Task 12), которая делает их drift-guard'ы зелёными. Номера кейсов намеренно не перечислены в этом поле: оно машинно парсится гейтом полноты (AC-4.2/AC-4.3), и номер кейса, стоящий в прозе поля, был бы прочитан как настоящее сопоставление. Перечень — в Acceptance Criteria ниже.
**Files:**
- `test/pf-honest-reporting-static.sh` - новый: чисто статический аудит `skills/pf-codereview/SKILL.md`, `skills/pf-check/SKILL.md`, `skills/pf/SKILL.md`, `skills/pf-close/SKILL.md` — фикстур не требует

**Implementation Notes:**
- No fixtures for any of these four — they are read-only static audits of the real skill files, in the spirit of `test/skills-role-matrix-static.sh`.
- TC-018 repeats the same anchor set (empty-diff-is-an-error signals; off-branch-review-by-path signals) against **both** `skills/pf-codereview/SKILL.md` and `skills/pf-check/SKILL.md` — write it as one loop over the two files so the two checks cannot silently drift apart (e.g. one file gets fixed and the other doesn't, and the test still reports a vacuous pass on the fixed one alone).
- TC-021 checks **both ends** of the same marker: the reader definition in `skills/pf/SKILL.md`'s "Note on 'check passed'" section (must reference an explicit written marker, not the circular "next document is ready" definition), and the writer in `skills/pf-check/SKILL.md` (must add an *unconditional* session-log line — not only the existing `[autopilot default]` line, which only fires in autopilot mode). Step 5 additionally cross-checks that the literal marker format named by the reader matches the literal format the writer emits — two texts separately using the word "marker" without agreeing on its shape must fail this step.
- TC-022 uses the anchor technique from `test/skills-role-matrix-static.sh`'s `check_order` — extract every `## Phase N` heading's line number in `skills/pf-close/SKILL.md`, then confirm each phase's block (except the last, Phase 9) contains either an explicit continuation or an explicit stop-with-message. Phase 4.5 must already pass today (baseline); full coverage of every other phase is RED until Task 12.
- TC-023 reuses TC-022's list of stop messages and requires a concrete recovery path (a command, a numbered step list) next to each — Phase 4.5's own "Recovering from a failure inside this phase" is the passing exemplar (baseline); Phase 4's bare "Resolve conflicts manually on PARENT-BRANCH" is the known gap this TC is built to catch.

**Acceptance Criteria:**
- [ ] TC-018 harness implemented; RED pending Task 10
- [ ] TC-021 harness implemented; RED pending Task 11
- [ ] TC-022 harness implemented; Phase 4.5 sub-check passes now (baseline), full-coverage check is RED pending Task 12
- [ ] TC-023 harness implemented; Phase 4.5 sub-check passes now (baseline), full-coverage check is RED pending Task 12

---

#### Task 10: `pf-codereview` + `pf-check` — пустой предмет ревью и предмет вне ветки issue

**Task Type:** code
**Mapped Test Cases:** TC-018, TC-019, TC-020
**Files:**
- `skills/pf-codereview/SKILL.md` - модифицирован: пустой дифф — явная ошибка стадии
- `skills/pf-check/SKILL.md` - модифицирован: пустой дифф — явная ошибка стадии; отсутствие ветки issue — ревью по пути документа

**Implementation Notes:**
- **Empty review target = stage error, not clean (AC-5.1, BR-6).** In `pf-codereview`, add this check right after Phase 1 computes `git diff PARENT-BRANCH...HEAD`: if the diff is empty, stop with an explicit error ("nothing to review" / "empty review target") — do **not** proceed to Phase 2/3 and do **not** write `verdict: PASS` with empty findings lists. In `pf-check`, add the equivalent check wherever it computes the branch diff (the Codex invocation chain's `--scope branch --base <base-ref>`, and the Claude review path's equivalent). Both messages must read distinctly from a genuine "reviewed, found nothing" result — TC-018 step 1 checks for this distinction explicitly, not just the word "empty".
- **Off-branch document — review by path, reported explicitly (AC-5.2).** This is `pf-check`'s scenario primarily: when TARGET was authored before an `issue/ISSUE-ID` branch exists (still on `develop`), don't compute a diff against a nonexistent branch and read "empty" as "clean" — detect the missing branch, switch to reviewing the document by its current on-disk content instead, and state the reason ("no issue branch yet") in the report. `pf-codereview`'s Phase 1 already hard-stops if the current branch isn't `issue/ISSUE-ID` (a different, pre-existing guard) — TC-018 still requires the same three anchors present in `pf-codereview`'s text too; document there that this scenario is structurally prevented by that existing branch guard, and that a still-empty resulting diff (e.g. an unresolvable `PARENT-BRANCH`) falls through to the empty-diff rule above rather than being silently read as clean. This keeps both files textually consistent without inventing a review-by-path behavior for `pf-codereview` that its Phase 1 guard already makes unreachable.
- TC-019 (Manual) and TC-020 (Manual) map here — TC-019 is the live empty-diff run (either skill), TC-020 is the live off-branch run (`pf-check` specifically, per its own Preconditions).

**Acceptance Criteria:**
- [ ] TC-018 passes
- [ ] TC-019 — verified via live run on the `empty-diff` fixture (see `test_plan.md` TC-019 Steps)
- [ ] TC-020 — verified via live `/pf-check` run on the `off-branch` fixture (see `test_plan.md` TC-020 Steps)

---

#### Task 11: `pf` + `pf-check` — явный признак пройденной проверки

**Task Type:** code
**Mapped Test Cases:** TC-021
**Files:**
- `skills/pf-check/SKILL.md` - модифицирован: writer — безусловная запись маркера в `session-log.md` issue
- `skills/pf/SKILL.md` - модифицирован: reader — «Note on 'check passed'» ссылается на этот маркер, не на готовность следующего документа

**Implementation Notes:**
- **Writer, unconditional (`pf-check`).** Today's only `session-log.md` write happens inside the autopilot branch (`[autopilot default] pf-check auto-...`), which does not cover the ordinary interactive path. Add an unconditional step — runs regardless of which of the three gate options was chosen, and regardless of autopilot — that appends a marker line to the issue's `session-log.md` recording that this check passed. Reuse the existing "Close the stage: commit & push" section's staging so the marker is committed with everything else this run touched.
- **Reader (`pf`).** Rewrite the "Note on 'check passed'" section so it reads the marker written above as the source of truth — the current text ("A check counts as passed only when… the next document in sequence is complete as well") is circular and must not remain the *sole* criterion; it can stay as an additional/legacy fallback for issues predating this marker, but the marker takes precedence when present.
- **Same literal format on both ends.** Whatever the marker's exact text/format, it must be the same string/pattern the writer emits and the reader parses — TC-021 step 5 explicitly cross-checks this; do not let `pf-check` write one phrase and `pf` look for a different one.
- This directly reproduces and fixes `prompt.md` item 6: `/pf-check` had already run (commit `d3f2b32`) but `/pf` could not see it, because "check passed" was defined circularly through the next document's readiness.

**Acceptance Criteria:**
- [ ] TC-021 passes

---

#### Task 12: `pf-close` — ни одна фаза не виснет без явного отчёта и пути восстановления

**Task Type:** code
**Mapped Test Cases:** TC-022, TC-023
**Files:**
- `skills/pf-close/SKILL.md` - модифицирован: каждая фаза либо продолжается явно, либо останавливается с названным шагом и конкретным путём восстановления

**Implementation Notes:**
- **Audit every phase (AC-5.4).** Walk Phase 0 through Phase 9 (including 4.5 and 8.5). Phase 0's three prerequisite checks and Phase 1's confirmation already stop with a concrete next command each — leave those as-is. Phase 4.5 already has the fullest example of the target shape ("Recovering from a failure inside this phase", three numbered steps with real `git` commands) — treat it as the pattern to match, not to rewrite.
- **The one gap `test_plan.md` names explicitly (AC-5.5): Phase 4's merge-conflict stop.** Today it reads "Merge conflict detected. Resolve conflicts manually on PARENT-BRANCH, then re-run /pf-close." — a bare "resolve manually" with no concrete steps, exactly the shape AC-5.5 forbids. Extend it with an actual numbered recovery path (e.g.: identify conflicting files via `git status`, resolve them, `git add` the resolved files, `git commit` to complete the merge, then re-run `/pf-close` — adapt to this framework's actual recovery need, matching Phase 4.5's level of concreteness).
- **Do not weaken Phase 4.5's existing recovery text** while editing nearby phases — TC-023's baseline sub-check depends on it staying intact.
- Every other phase (2, 3, 5, 6, 7, 8, 8.5, 9) already either always continues (no failure mode documented) or has its own explicit non-fatal handling (8.5's push-failure reporting) — confirm this holds after the Phase 4 edit above; TC-022's full-coverage check will catch a phase that silently has neither path.

**Acceptance Criteria:**
- [ ] TC-022 passes
- [ ] TC-023 passes

---

#### Task 13: Тесты самодостаточности задания сабагенту

**Task Type:** tests
**Mapped Test Cases:** нет — infrastructure task: сьют пишет тестовую обвязку, а сами кейсы заявлены на парной code-задаче (Task 14), которая делает их drift-guard'ы зелёными. Номера кейсов намеренно не перечислены в этом поле: оно машинно парсится гейтом полноты (AC-4.2/AC-4.3), и номер кейса, стоящий в прозе поля, был бы прочитан как настоящее сопоставление. Перечень — в Acceptance Criteria ниже.
**Files:**
- `test/pf-execute-task-dispatch.sh` - новый: `pf_execute_resolve_task_content` helper + drift-guards
- `test/fixtures/pf-codereview-convergence/impl-plan-mismatched-numbering.md` - новый

**Implementation Notes:**
- TC-024/TC-025 are pure static audits (no fixtures) of `skills/pf-execute/SKILL.md`'s "Create each task with:" and "For Each Task — `write: claude` (Sub-Agent Instructions)" blocks.
- TC-025's single step is deliberately one-directional (per `test_plan.md`'s own note): it only checks that `TaskGet`/`TaskUpdate` are **not** prescribed to the sub-agent in that block. It is expected RED right now — `skills/pf-execute/SKILL.md` today literally says "Use `TaskGet` to read full task details" (step 1) and "Use `TaskUpdate` to mark task complete" (step 5) in that exact block (KI-1). A green result before Task 14 lands would mean the test itself is broken, not that the rule is already satisfied.
- TC-026's `pf_execute_resolve_task_content` helper is pure bash: a payload carrying only a task number resolves to nothing (step 1); a payload carrying full task content resolves to that content regardless of a mismatched number (step 2) — both GREEN from the start. Its drift-guard (step 3) is RED pending Task 14.

**Acceptance Criteria:**
- [ ] TC-024 harness implemented; RED pending Task 14 (missing-criterion (в) only — (а)(б)(г)(д) baseline-pass today per `test_plan.md`)
- [ ] TC-025 harness implemented and RED right now (KI-1) — this is the expected state, not a defect in the test
- [ ] TC-026 harness implemented; helper steps pass now, drift-guard is RED pending Task 14

---

#### Task 14: `pf-execute` — самодостаточное задание сабагенту

**Task Type:** code
**Mapped Test Cases:** TC-024, TC-025, TC-026
**Files:**
- `skills/pf-execute/SKILL.md` - модифицирован: пятиэлементный минимум задания, устранение `TaskGet`/`TaskUpdate` из инструкции сабагенту, устойчивость к расхождению нумерации

**Implementation Notes:**
- **Five-element minimum (AC-6.1).** "Create each task with:" (Phase 1) today already states four of five elements explicitly: what to do + files (as one combined bullet), mapped TCs, and dependencies (`blocked_by`/`blocks`). Add the missing fifth as its own explicit bullet — a concrete "what counts as done" criterion for the task, not folded into "Implement functionality to pass mapped TCs" inside the sub-agent instructions (that already exists but is not framed as a task-level completion criterion). Do not phrase any of the five as "a sufficient description" without enumerating them — that phrase was already rejected during this issue's own `brd.md` review as unverifiable.
- **Remove `TaskGet`/`TaskUpdate` from the sub-agent's own instructions (AC-6.2, KI-1).** In "For Each Task — `write: claude` (Sub-Agent Instructions)", step 1 ("Use `TaskGet` to read full task details") and step 5 ("Use `TaskUpdate` to mark task complete…") both prescribe tools sub-agents were confirmed (via `ToolSearch`, on two separate test sub-agents) not to have. Replace step 1 with an instruction to work from the task's full content already included in this dispatch prompt (per the five-element minimum above) — never fetched via `TaskGet`. Replace step 5 with an instruction to return a completion summary as the sub-agent's final message — the orchestrator reads that summary and calls `TaskUpdate` itself (this is already how "Execution Strategy" point 6 describes completion being judged in practice; this task makes the sub-agent-facing instruction match that reality instead of contradicting it).
- **Numbering-mismatch immunity (AC-6.3).** State explicitly that the dispatch prompt for a sub-agent always includes the task's full content (description, files, mapped TCs, dependencies) — never a bare task number/identifier alone — specifically covering the case where the orchestrator's own internal wave/task bookkeeping numbering does not match `implementation_plan.md`'s own `Task N` labels. This is the exact failure from `prompt.md` item 7's second paragraph: a sub-agent, lacking `TaskGet`, went and picked "Task 3" by number from the plan and did the wrong work because the numbers didn't line up.
- Reconcile with Phase 2's `write != claude` (delegated actor) path, which already **does** use `TaskGet`/`TaskUpdate` legitimately — that's the orchestrating session itself, not a dispatched sub-agent, and is explicitly out of scope for this task's changes (see `skills/pf-execute/SKILL.md`'s own "Why the orchestrator, not the actor, reads and marks the task" note).

**Acceptance Criteria:**
- [ ] TC-024 passes
- [ ] TC-025 passes
- [ ] TC-026 passes

---

### Dependencies

Порядок в этом документе — по user story, не по графу исполнения.
Реальные зависимости — только между задачами, редактирующими **один и тот
же файл**; задачи на разных файлах независимы и могут исполняться в любом
относительном порядке (в том числе параллельно, в одной волне
`/pf-execute`).

- **Все шесть `tests`-задач (1, 3, 5, 7, 9, 13) не блокируются ничем.** Они
  не зависят от соответствующей `code`-задачи для своего создания — только
  их drift-guard-шаг ожидаемо RED до неё. Это осознанное свойство плана
  (test-first), не повод вводить искусственный `blocked_by`.
- **Цепочка `skills/pf-codereview/SKILL.md`: Task 2 → Task 4 → Task 6 →
  Task 10.** Все четыре редактируют один файл в разных секциях (Phase 4
  бюджет, Phase 3 ledger, Phase 2/3 triage, Phase 1 empty-diff) —
  последовательность нужна, чтобы параллельные сабагенты в одной волне не
  затёрли правки друг друга, не потому что одна секция технически не
  скомпилируется без другой. Единственная содержательная связь внутри
  цепочки: Task 2 не должен ослабить условие `FAIL` из Phase 3, которое
  Task 6's TC-011 регрессионно проверяет — обе задачи должны проверяться
  друг после друга, не только после кода.
- **Task 10 логически зависит от Task 2 и Task 4** (округляет и Phase 1, и
  Phase 3, которые они же меняют) — отражено порядком в цепочке выше.
- **Цепочка `skills/pf-check/SKILL.md`: Task 10 → Task 11.** Обе трогают
  `pf-check`; Task 11 добавляет writer-сторону маркера в тот же файл, где
  Task 10 уже добавил empty-diff/off-branch логику.
- **`skills/pf/SKILL.md` трогает только Task 11** — конфликтов нет,
  отдельного упорядочивания не требуется.
- **Цепочка `skills/pf-execute/SKILL.md`: Task 8 → Task 14.** Обе трогают
  один файл в разных местах (новый гейт полноты перед Phase 3's отчётом;
  переписанный блок «For Each Task» дальше в файле) — тот же
  файловый-конфликт довод, что и для `pf-codereview`.
- **`skills/pf-close/SKILL.md` трогает только Task 12** — независима от
  всех остальных цепочек, может исполняться в любой волне.
- **TC-027 (mapped inside Task 2) требует Task 4 и Task 6 уже
  выполненными** для содержательного прогона (ledger и triage — часть
  того, что проверяет сквозной прогон) — при буквальном порядке этого
  документа (Task 2 идёт раньше Task 4/6) это означает, что TC-027's
  Acceptance Criteria в Task 2 фактически проверяется в самом конце
  реализации, после того как Task 4 и Task 6 landed — это нормально:
  Acceptance Criteria задачи не обязаны закрываться в момент, когда задача
  дошла до головы своей волны.

**Фазированное внедрение не применяется.** Все 14 задач меняют прозу пяти
skill-файлов одной issue-ветки, сходятся в один `/pf-close`, и ни один
подмножество изменений не образует самостоятельно полезного релиза —
скилл, получивший, скажем, только бюджет раундов (Task 2) без ledger
(Task 4), не может сформулировать раунд-2-инструкцию, требующую и
закрытия прежних находок, и проверки своего диффа, потому что «прежние
находки» без ledger не имеют устойчивого состояния. Разбиение по стадиям
развёртывания не даёт дополнительной ценности сверх уже описанного графа
Dependencies.

**Внешние зависимости:**
- Ни одна задача не требует Codex CLI — все Manual TC (`test_plan.md`
  Prerequisites) используют дефолтный `[claude]`-путь ревью.
- `make update-skills` (или `/pf-update`) должен быть прогнан после всех
  14 задач и до прогона Manual TC — как и у прошлых issue, изменяющих
  `skills/`, тест-план читает установленные копии `~/.claude/skills/`.

### Complexity Estimate

**Complex (6+ tasks).** 14 задач: шесть пар `tests`→`code` по числу user
stories (US-1 и US-2 — по одной паре каждая; US-4 и US-6 — по одной паре
каждая) плюс US-3 (пара) и US-5, которая из-за охвата трёх разных файлов
(`pf-codereview`+`pf-check` для AC-5.1/5.2, `pf`+`pf-check` для AC-5.3,
`pf-close` для AC-5.4/5.5) разбита на одну `tests`-задачу и три отдельные
`code`-задачи вместо одной. Итог: 6 `tests`-задач + 8 `code`-задач.

Оценка отражает фактический охват: пять изменяемых skill-файлов, шесть
user stories, 26 AC, 27 TC (23 Auto, требующих новой тестовой инфраструктуры
с нуля — ни одна не расширяет существующий сьют, все шесть новых файлов
`test/*.sh` создаются впервые), плюс ~20 новых фикстур. Она не раздута
искусственно: каждая `code`-задача правит одну связную область одного
файла (одна user story или, при пересечении файлов, одна пара
AC/файл), а не «переписать `pf-codereview` целиком» — самая крупная
единица, `pf-codereview/SKILL.md`, тронута четырьмя отдельными задачами
именно поэтому.
