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
(2, 4, 6, 8, 10, 11, 12, 14). Позже к ним добавилась Task 15 (`tests`),
заведённая эскалацией `/pf-codereview` по исчерпании бюджета раундов, —
итого пятнадцать. Порядок задач в этом документе — тот
порядок, в котором они перечислены ниже, а не обязательный порядок
исполнения `/pf-execute` (см. раздел Dependencies за реальным графом).

**Каждый TC-ID из 27 в `test_plan.md` привязан ровно к одной задаче** — к
`code`-задаче, которая делает соответствующий drift-guard зелёным (или,
для четырёх Manual TC, которая реализует проверяемое ими поведение).
`tests`-задачи (1, 3, 5, 7, 9, 13) несут в поле `Mapped Test Cases` не номера
кейсов, а короткое обоснование (`нет — infrastructure task: …`) —
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
- Follow `test/skills-role-matrix-static.sh`'s anchor-narrowing technique (locate a section by its own heading/text, then grep only inside that range) for TC-002 step 4, **TC-003 step 4**, and TC-004 — a bare unscoped `grep` on the whole file would pass on an unrelated occurrence of the same words elsewhere.
- Every step reports via `pf_pass "TC-NNN step K: …"` / `pf_fail "TC-NNN step K: …"` — the literal form `/pf-test`'s Phase 3.2 scan recognizes. A `printf '=== TC-NNN …'` banner is not a substitute.
- TC-001/002/003 helper steps (1-2, or 1-3) are pure bash logic on the fixtures above — no dependency on `skills/pf-codereview/SKILL.md`'s actual text, so they can be GREEN from the start. Only the drift-guard step (TC-001 step 3, TC-002 step 4, TC-003 step 4) reads the real file and is expected RED until Task 2 lands — write its failure message to say "rule not documented in SKILL.md", distinguishable from a missing-fixture/missing-file infra failure (`test_plan.md`'s own requirement).
- **TC-003's drift-guard needs the same anchor-narrowing as TC-002/TC-004 (not just presence of the two phrases anywhere in the file).** A bare unscoped `grep` for "исчерпание бюджета … возврат на /pf-execute" and the "не PASS и не бесконечный цикл" prohibition (`test_plan.md` TC-003 step 4) risks a false match — the file mentions `/pf-execute` and `PASS` in several unrelated places (Phase 0's prerequisite messages, Phase 3's verdict rules). Locate the budget-exhaustion block Task 2 adds (under "Budget exhaustion (AC-1.3, BR-7)") by its own heading/introductory phrase first, then require both halves of the rule only inside that narrowed range.
- TC-004 has no fixtures at all — locate the Phase 4 round-2+ instruction block in `skills/pf-codereview/SKILL.md` (today: the "loop" paragraph after "If 'Fix now'") and require BOTH the "closure of prior findings" signal and the "review… own diff" signal inside that same block, not just anywhere in the file — a single-sided fix (only one of the two) must fail this TC exactly as it failed round 9 of `20260709-feat-dockerize`.
- New file — no `Makefile` edit needed; `make test`'s `for t in test/*.sh` loop picks it up automatically.

**Acceptance Criteria:**
- [x] TC-001 harness implemented; helper steps (1-2) pass now, drift-guard step (3) is RED pending Task 2
- [x] TC-002 harness implemented; helper steps (1-3) pass now, drift-guard step (4) is RED pending Task 2
- [x] TC-003 harness implemented; helper steps (1-3) pass now, drift-guard step (4) is RED pending Task 2
- [x] TC-004 harness implemented; RED pending Task 2 (no fixtures, pure static audit)

---

#### Task 2: `pf-codereview` — бюджет раундов и эскалация

**Task Type:** code
**Mapped Test Cases:** TC-001, TC-002, TC-003, TC-004, TC-027
**Files:**
- `skills/pf-codereview/SKILL.md` - модифицирован: поле `review_rounds` в `prompt.md` (дефолт 3), ранний бросок назад в раунде 1, исчерпание бюджета, дельта-проверка раунда N>1

**Implementation Notes:**
- **`review_rounds` field.** Read from `docs/issues/open/ISSUE-ID/prompt.md`'s frontmatter, default `3` when absent — document both the field name and the default literally (TC-001's drift-guard greps for both together).
- **This task depends on Task 4 landing first (see Dependencies) — the ledger is read here, not written here.** Every rule below that talks about "the ledger" assumes Task 4's `CR-NNN` append-only ledger already exists in `skills/pf-codereview/SKILL.md`; this task does not introduce a second, competing findings structure.
- **New logical point: "Phase 3.5 (Round 1 Early Bail-Out)".** Add this check right after Phase 3 first writes `code_review.md` for round 1 specifically, as its own named point between Phase 3 and Phase 4 — same naming convention Task 8 uses for its own new gate ("Phase 3.5") in `pf-execute`, applied here to `pf-codereview` instead. If the round found **3 or more** blocking (P0/P1) findings, do **not** enter the Phase 4 fix loop at all — instead, convert each finding into a new task appended to `implementation_plan.md`, and route the issue back to `/pf-execute`. Below the threshold (0-2 blocking), Phase 4 runs exactly as today. State the threshold as "3 or more", the destination as `/pf-execute` specifically (not just "back to execution" in prose), and that findings become `implementation_plan.md` tasks — TC-002's drift-guard checks for all three signals together.
- **Each converted finding-task must carry a non-empty `Mapped Test Cases:` field, or Task 8's Check 2 blocks the very next handoff.** State this explicitly: when a finding becomes a new `implementation_plan.md` task here (or in the budget-exhaustion path below), its `Mapped Test Cases:` field names the original TC-ID(s) the finding's fix must keep passing (drawn from the diff/task it relates to) — not a newly invented TC-ID absent from `test_plan.md`'s Status Tracker. Reusing an existing TC-ID across two tasks is legal under Check 2/Check 3 (Task 8): Check 2 only requires the field non-empty, Check 3 only requires at least one task name each TC — neither forbids a TC being named by more than one task. This keeps a `/pf-execute` re-run after an escalation from tripping Task 8's own gate.
- **Round number.** Today's Phase 4 loop has no concept of a round counter at all. Derive it from the ledger Task 4 introduces (highest round number recorded + 1 for a fresh review; 1 for an empty/first ledger) — do not add a second, separate counter file; a second counter is exactly the kind of "two mechanisms for one fact" this issue's BRD flags as a defect pattern (see AC-3.2's parallel-flag prohibition, same principle applied here).
- **Budget exhaustion (AC-1.3, BR-7).** When the current round equals `review_rounds` and at least one P0/P1 is still open: write `verdict` as **not** `PASS`, do not loop again — instead take the same "convert remaining findings to `implementation_plan.md` tasks, return to `/pf-execute`" path as the round-1 bail-out (Phase 3.5). When the current round equals the budget but the round's own review is clean (no open P0/P1), the cycle closes as `PASS` regardless of round number — the budget is a trigger for escalation, never a ceiling that blocks a legitimate `PASS` (BR-7). TC-003's drift-guard checks for both halves of this rule.
- **Round N>1 dual check (AC-1.4).** Rewrite the Phase 4 loop instruction for the second and later rounds so it explicitly requires BOTH: (a) verifying that every blocking finding from the previous round's ledger is actually closed, AND (b) reviewing the current round's own fix diff for new problems. A one-sided instruction ("only verify closure" or "only review the new diff") is exactly what let round 9 of `20260709-feat-dockerize` ship 2 new P0s unreviewed — do not phrase this as "re-run Phase 2" alone, as today's text does.
- **Do not weaken Phase 3's existing `FAIL` condition** ("any open P0 or P1 → FAIL") while adding round/budget logic — Task 6's regression guard (TC-011) depends on this staying true independent of round number; a bug here would silently pass TC-003 while failing TC-011.
- **Phase 5 staging must cover the new artifact this task can produce.** When Phase 3.5's early bail-out or Phase 4's budget-exhaustion path fires, it appends new tasks to `docs/issues/open/ISSUE-ID/implementation_plan.md` before handing back to `/pf-execute`. Extend Phase 5's existing staging sentence ("Stage `docs/issues/open/ISSUE-ID/code_review.md`, plus `prompt.md` if…, plus any file(s) a fix actor actually edited…") to also include `implementation_plan.md`, **when this task's escalation path actually wrote to it this run** — conditional staging, mirroring the sentence's existing "if…touched it this run" clauses, not an unconditional addition. Extend the sentence in place; do not restate or duplicate Phase 5's commit procedure itself (message format and push guard stay defined once, in `~/.claude/skills/pf-git/SKILL.md`). Task 6 also extends this same sentence with its own clause (see its Implementation Notes) — land this one first, per the corrected `Task 4 → Task 2 → Task 6 → Task 10` order.
- TC-027 (Manual, e2e) is mapped here because it is primarily an acceptance check of this task's mechanism (round budget driving early bail-out or convergence) exercised live, on top of the ledger (Task 4) and triage (Task 6) machinery — it does not add new SKILL.md text of its own.

**Acceptance Criteria:**
- [x] TC-001 passes
- [x] TC-002 passes
- [x] TC-003 passes
- [x] TC-004 passes
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
- [x] TC-005 harness implemented; steps 1-3 pass now, step 4 (drift-guard) is RED pending Task 4
- [x] TC-006 harness implemented; steps 1-2 pass now, steps 3-4 (drift-guards) are RED pending Task 4
- [x] TC-007 harness implemented; RED pending Task 4 (no fixtures, pure static audit)
- [x] TC-008 harness implemented; steps 1-3 pass now, step 4 (drift-guard) is RED pending Task 4

---

#### Task 4: `pf-codereview` — append-only ledger находок

**Task Type:** code
**Mapped Test Cases:** TC-005, TC-006, TC-007, TC-008
**Files:**
- `skills/pf-codereview/SKILL.md` - модифицирован: Phase 3 переходит с перезаписываемых секций P0/P1/P2 на append-only ledger `CR-NNN`; also touches Phase 2 (Reviewer Selection) — the round 2+ reviewer-prompt addition (both the "Claude review path" and the Codex path's brief) that passes the ledger to the reviewer, see Implementation Notes below

**Implementation Notes:**
- **This replaces KI-3.** Today's Phase 3 rewrites the `### P0`/`### P1`/`### P2` sections wholesale on every run — no stable IDs, no append-only guarantee. Redesign `code_review.md`'s findings section as a table (or equivalent structured list) keyed by a stable `CR-NNN` ID, carrying at minimum: ID, round number, priority (P0/P1/P2), description, and **state**. A later Phase 3 run only ever appends new `CR-NNN` rows or updates the `state` cell of an existing row — it never rewrites or deletes a previously written row's identity/round/description (BR-8).
- **Six-value state dictionary**, spelled out verbatim: `open` (assigned when a finding is first created) plus five terminal resolutions — `fixed`, `accepted-risk`, `deferred`, `wont-fix`, `duplicate-of CR-NNN`. This is the same closed set `brd.md`/`test_plan.md` already fixed — do not add a seventh value or rename any of the five.
- **Reviewer prompt for round 2+** (both the "Claude review path" and the Codex path's brief): pass the current ledger of prior findings alongside the diff, with an explicit instruction that these are already triaged — do not re-report them, look specifically for what the round's fixes introduced (AC-2.3). This is the text TC-007's drift-guard checks.
- **This addition lands in Phase 2, not Phase 4 — and TC-007's harness already anchors on Phase 2.** `test_plan.md`'s TC-007 step 1 says parenthetically "(Phase 4 loop)"; that parenthetical is loose and must not be followed. Measured against the real file: Phase 2 is "Reviewer Selection" and is where both reviewer briefs are actually constructed (its `### Claude review path` subsection, and its by-name reference to `pf-check`'s Codex invocation chain); Phase 4 is "The Hard Gate — no 'Skip and continue'" and dispatches no reviewer at all. The ledger has to reach the reviewer at dispatch time, so Phase 2 is the only place this text can work. Task 3's harness anchors on Phase 2 accordingly — put the edit there, or TC-007 stays RED no matter how correct the wording is.
- **`PASS` validation (AC-2.4).** Before writing `verdict: PASS`, every ledger row must carry an explicit, non-empty `state` — an empty cell is a violation (this is what silently lost the P2 from round 1 of `20260709-feat-dockerize`); a row with `state: open` is not itself a violation of *this* rule (it is a real, explicit value) — whether an `open` P0 blocks `PASS` is Task 6's separate rule (TC-011), layered on top, not replaced by this one.
- Round-number bookkeeping for the ledger is what Task 2 reads to compute the current round — keep the row's `round` field authoritative; do not introduce a second counter.

**Acceptance Criteria:**
- [x] TC-005 passes
- [x] TC-006 passes
- [x] TC-007 passes
- [x] TC-008 passes

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
- [x] TC-010 harness implemented; RED pending Task 6 (no fixtures, pure static audit)
- [x] TC-011 harness implemented and passes now (baseline/regression guard)
- [x] TC-012 harness implemented; helper step passes now, drift-guard step is RED pending Task 6

---

#### Task 6: `pf-codereview` — рубрика блокирования и triage

**Task Type:** code
**Mapped Test Cases:** TC-009, TC-010, TC-011, TC-012
**Files:**
- `skills/pf-codereview/SKILL.md` - модифицирован: требование сценария отказа для P0/P1, явный шаг переклассификации, follow-up issue как терминальная резолюция ledger'а для P1. **Phase 4's two-option `AskUserQuestion` gate text ("Fix now" / "I'll fix manually, then re-run /pf-codereview", and its "never a third 'skip' option" / "This is the one deliberate divergence from `pf-check`'s gate" note in "Important Notes") is explicitly NOT touched by this task** — do not "harmonize" it to mention follow-up issues; the follow-up path is wired in at the ledger level (Task 4's `CR-NNN` rows), not as a gate option.

**Implementation Notes:**
- **Failure-scenario requirement (AC-3.1).** A P0/P1 finding must name a concrete failure scenario: input/state → wrong output, crash, regression, or violation of a stated requirement. Add this as an explicit requirement on the findings-collection step (Phase 2's brief to the reviewer, or a new triage step right after it).
- **Reclassification, not a second flag (AC-3.2, BR-4).** A finding that does not name a failure scenario is **reclassified to P2** — its priority itself changes. Do **not** add a separate `blocking: yes/no` field next to the existing P0/P1/P2 priority; the BRD explicitly rejects this shape (a second, parallel signal either breaks the gate or lets an important finding pass as `PASS`). Priority remains the single axis the gate reads.
- **Explicit, attributed, visible step (AC-3.3).** Name this as its own step (not folded silently into "group by priority"), require a one-line reason recorded per reclassified finding, and require the reclassification to be visible in `code_review.md`'s own ledger row (e.g., a note next to the finding) — not just applied invisibly before the report is written. TC-010's drift-guard checks all three together.
- **Follow-up issue — a terminal ledger resolution, not a third gate option (AC-3.5, BR-5).** This does **not** add a third branch to Phase 4's `AskUserQuestion` — Phase 4's two-option gate and its "never a third 'skip' option" text stay exactly as they are today (see the `Files` note above). Instead, wire this in at Task 4's ledger level: a P1 finding can be resolved by filing a separate follow-up issue and setting that finding's `CR-NNN` row `state` to `deferred`, **with the created issue's ID/path recorded in that same row** (e.g. appended to the finding's description or a dedicated column) — an unlinked `deferred` is indistinguishable from a silently dropped finding, which directly contradicts US-2's "a finding never disappears silently." Once a finding's state is terminal (this `deferred`-via-follow-up case included), Phase 3's existing "any open P0/P1 → FAIL" condition no longer treats it as open — the same mechanism TC-006/TC-008/TC-011 already establish (a terminal state is not `open`), not a new blocking rule of its own. **P0 has no such path, ever (BR-1, AC-3.4)** — this specific route into `deferred` (via a follow-up issue) is available starting from P1 only, per AC-3.5's own wording ("для средней важности... для высшей — недоступен"), independent of the pre-existing dictionary of terminal states. Document this as clearly distinct from where PASS-time remnants (P2/`deferred` for any other reason) go (`docs/planning/tech-debt.md`, per BR-5's "куда попадают остатки на выходе `PASS`" vs. "что доступно как способ пройти гейт") — these are two different mechanisms and must read as two different mechanisms in the text, not one.
- **Phase 5 staging must cover the follow-up-issue path.** When a P1 finding is resolved via a follow-up issue, that creates the new issue's own files (`docs/issues/open/<new-issue-id>/prompt.md` etc.), and, separately, `docs/planning/tech-debt.md` may also be written per BR-5. Extend Phase 5's staging sentence (the same one Task 2 already extends — see its Implementation Notes) with its own conditional clause: "plus the created follow-up issue's files and `docs/planning/tech-debt.md`, when this run actually wrote to them." Append this task's clause to the sentence Task 2 leaves behind rather than overwriting it — this task lands after Task 2 in the corrected `Task 4 → Task 2 → Task 6 → Task 10` order.
- **Do not touch Phase 3's unconditional "any open P0/P1 → FAIL" line** while writing this task — TC-011 (Task 5) is the guard that this stays true.
- TC-009 (Manual) is mapped here — it is the live verification that a real reviewer run actually reclassifies a no-failure-scenario finding to P2 while keeping a real bug as a blocking P0/P1, with no second blocking flag anywhere in the resulting `code_review.md`.

**Acceptance Criteria:**
- [ ] TC-009 — verified via live `/pf-codereview` run on the `triage-severity` fixture (see `test_plan.md` TC-009 Steps)
- [x] TC-010 passes
- [x] TC-011 passes (still — no regression introduced)
- [x] TC-012 passes

---

#### Task 7: Тесты гейта полноты `/pf-execute`

**Task Type:** tests
**Mapped Test Cases:** нет — infrastructure task: сьют пишет тестовую обвязку, а сами кейсы заявлены на парной code-задаче (Task 8), которая делает их drift-guard'ы зелёными. Номера кейсов намеренно не перечислены в этом поле: оно машинно парсится гейтом полноты (AC-4.2/AC-4.3), и номер кейса, стоящий в прозе поля, был бы прочитан как настоящее сопоставление. Перечень — в Acceptance Criteria ниже.
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
- **Known coverage gap: TC-013 does not exercise Task 8's new checkbox-writing step.** TC-013 only transcribes and drift-guards the reading/blocking side of Check 1 (`pf_execute_all_tasks_checked` on a fixture `implementation_plan.md`) — it says nothing about who actually flips `- [ ]` to `- [x]` in a real run. Task 8 adds that writing step to `pf-execute`'s Phase 2 ("Execution Strategy" point 6) to make Check 1 satisfiable at all in practice (see its Implementation Notes), but no Auto TC in this issue's `test_plan.md` covers the writing step itself — it is prose in `pf-execute`'s task-execution flow, not a fixture-and-drift-guard shape. TC-027's live multi-round run is the closest live exercise of it, incidentally, not by design. This is a known, accepted test-plan gap, not fixed by editing `test_plan.md` here.
- **TC-014's helper must be `Task Type`-aware (Task 8's Check 2 / Check 2b split).** `pf_execute_task_has_test` cannot simply require every task's `Mapped Test Cases:` field to be non-empty — this issue's own `implementation_plan.md` has six `tests`-typed tasks whose field is deliberately free of TC-IDs by convention — it carries a short prose reason instead of case numbers (see this plan's Overview and every `tests` task above). The helper must read each task's `**Task Type:**` and apply Check 2's rule (`Mapped Test Cases:` non-empty) only to `code` tasks, and Check 2b's rule (at least one `TC-\d+` literal named somewhere in `**Acceptance Criteria:**`) to `tests` tasks. Extend the `-gap` fixture to cover both branches independently: a `code` task with an empty `Mapped Test Cases:` field (must fail/block), and a `tests` task with an empty `Mapped Test Cases:` field but at least one TC-ID named in its `Acceptance Criteria` (must NOT fail/block). `test_plan.md`'s TC-014 text is not changed by this issue — this is a refinement of the transcribed helper beyond the TC's literal wording, tracked here rather than there.
- TC-014/TC-015 helper steps (parsing `Mapped Test Cases:` correctly, including the negative control and the `Task Type` awareness above) are GREEN from the start; each TC's step-3 drift-guard is direction-sensitive — TC-014 greps for the forward-direction phrasing ("every task has a test") and explicitly must **not** be satisfied by the reverse phrasing alone (and vice versa for TC-015) — write both drift-guards to check this exclusion, not just presence.
- TC-016/TC-017 are pure static audits (no fixtures) of the same gate block — RED until Task 8 exists at all.

**Acceptance Criteria:**
- [x] TC-013 harness implemented; helper steps pass now, drift-guard is RED pending Task 8
- [x] TC-014 harness implemented; helper steps pass now, drift-guard is RED pending Task 8
- [x] TC-015 harness implemented; helper steps pass now, drift-guard is RED pending Task 8
- [x] TC-016 harness implemented; RED pending Task 8
- [x] TC-017 harness implemented; RED pending Task 8

---

#### Task 8: `pf-execute` — гейт полноты перед передачей в ревью

**Task Type:** code
**Mapped Test Cases:** TC-013, TC-014, TC-015, TC-016, TC-017
**Files:**
- `skills/pf-execute/SKILL.md` - модифицирован: новый блокирующий гейт полноты в Phase 3/3.5, вставленный между завершением задач и переходом к `/pf-codereview`; also touches Phase 2 ("Execution Strategy" point 6) — the per-task checkbox-writing step this gate depends on (see Implementation Notes)

**Implementation Notes:**
- **Location.** This gate belongs only here — per US-4, it is an output gate of the implementation stage (a condition on *handing off* to review), not an input gate of `/pf-codereview`. Insert it into Phase 3 ("Completion Summary"), before the final "Ready for Testing" report, or as a new Phase 3.5 — either way, before this skill's own completion is reported.
- **Prerequisite for Check 1 — a writer for the checkboxes it reads.** Check 1 below only works if something actually flips `implementation_plan.md`'s `- [ ]` to `- [x]` — today, nothing in `pf-execute` does: task completion is judged from a sub-agent's final summary or the orchestrator's own disk re-read (Phase 2, "Execution Strategy" point 6), never written back into the plan document itself. Add this writing step to Phase 2, "Execution Strategy" point 6 — the exact point that reads: "Once every task in a wave is confirmed complete, the orchestrator runs the shared commit & push procedure... for that wave, on the issue branch." Insert the new sub-step **there, per task, immediately after that task is confirmed complete and before the wave's `git add -A`/commit** — for both confirmation paths point 6 already describes (a `write: claude` task, confirmed from the dispatched sub-agent's own final summary; a `write != claude` task, confirmed from the orchestrator's own disk re-read): edit `implementation_plan.md` and change **only that task's own** `**Acceptance Criteria:**` checkboxes from `- [ ]` to `- [x]` — never the whole document in one pass. **Ordering is load-bearing:** this write must land before the wave's commit (so it rides the same `git add -A`), and Check 1 below must only ever run after every wave has already gone through this step — a gate reading its own successful work as still-unchecked is a false block, not a real gap.
- **Partial confirmation.** If a task's confirmation (sub-agent summary or orchestrator disk re-read) reports the task as incomplete, deviated, or only partially done, do **not** check any of its boxes — leave them `- [ ]` exactly as written. This is correct, not a bug: Check 1 is supposed to block on genuinely incomplete work, and an inaccurately checked box would defeat that.
- **Check 1 — all plan checkboxes done (AC-4.1), scoped to Auto TCs.** Mechanically scan `implementation_plan.md` for any remaining `- [ ]` line. For each one, extract the `TC-\d+` it names and look up that TC's `Type` column in `test_plan.md`'s Status Tracker (the same cross-reference Check 3 already does): if `Type: Auto` (or the line names no TC-ID at all), it blocks; **if `Type: Manual`, it is explicitly out of scope for this check.** This carve-out exists because this very plan has four Manual-TC Acceptance Criteria lines that cannot be true at hand-off time by design — "TC-027 — verified via live multi-round `/pf-codereview`/`/pf-execute` run..." (Task 2), "TC-009 — verified via live `/pf-codereview` run..." (Task 6), "TC-019/TC-020 — verified via live run..." (Task 10) — this issue's own "Внешние зависимости" note that the Manual-TC live runs happen only after `make update-skills` is run post-`/pf-execute`, and the Dependencies section already establishes that an Acceptance Criteria line need not close the moment its task reaches the head of its wave. Blocking on a still-unchecked Manual-TC line here would make this gate unsatisfiable by this plan's own design — the carve-out is narrow (one cross-referenced lookup per line) and stays fully mechanical (AC-4.5), not a general judgment call. Manual-TC criteria are closed later, when the tester actually runs them (`/pf-test`'s manual checklist / `/pf-manual-test`), not by this gate.
- **Check 2 — forward: every `code` task has a test (AC-4.2).** Applies only to tasks whose `**Task Type:**` is `code`. For every such task, its `**Mapped Test Cases:**` field must be non-empty. This is the direction that would have caught rounds 5 and 8 of `20260709-feat-dockerize` (functionality declared, not built) — a TC-ID mentioned only in a task's prose description does not count. **`tests`-typed tasks are exempt from this specific check** — this issue's own plan is the reason: a `tests`-typed task's `Mapped Test Cases:` field is deliberately free of TC-IDs by convention — a short prose reason stands in place of case numbers (see every `tests` task in this document) — because the field is machine-parsed and a TC-ID sitting in its prose would be read as a real mapping; the TC-IDs it exercises belong to its paired `code` task, which is the one that makes the corresponding drift-guards green. A `tests`-typed task's harness adds no behavior of its own — it is checked by Check 2b instead.
- **Check 2b — `tests`-typed tasks: Acceptance Criteria names at least one TC-ID (AC-4.2, `tests` variant).** For every task whose `**Task Type:**` is `tests`, its `**Acceptance Criteria:**` section must name at least one TC-ID (any `TC-\d+` literal there counts — it is prose there by design, unlike the machine-parsed `Mapped Test Cases:` field). A `tests` task with an empty `Mapped Test Cases:` field AND no TC-ID anywhere in its `Acceptance Criteria` is a real gap (an infrastructure task nobody is tracking against any test case) and blocks exactly like Check 2 does for `code` tasks.
- **Check 3 — reverse: every TC has a task (AC-4.3).** For every TC row in `test_plan.md`'s Status Tracker, at least one task's `Mapped Test Cases:` field must name it. This is a **different** gap from Check 2/2b (a requirement nobody picked up) and does not substitute for either.
- **All checks blocking (AC-4.4).** State plainly that these are hard stops, not advisory warnings — a soft warning is exactly what "the gate didn't hold" meant in the source incident (dockerize case, finding 4).
- **All checks mechanical (AC-4.5).** Phrase each check as a deterministic parse/scan — no "use your judgment whether coverage is sufficient" language anywhere in this block; a model that can be talked past the gate is not a gate.

**Acceptance Criteria:**
- [x] TC-013 passes
- [x] TC-014 passes
- [x] TC-015 passes
- [x] TC-016 passes
- [x] TC-017 passes

---

#### Task 9: Тесты честной отчётности стадий (статический аудит, AC-5.1/5.2/5.3/5.4/5.5)

**Task Type:** tests
**Mapped Test Cases:** нет — infrastructure task: сьют пишет тестовую обвязку, а сами кейсы заявлены на парной code-задаче (Task 10, Task 11 и Task 12), которая делает их drift-guard'ы зелёными. Номера кейсов намеренно не перечислены в этом поле: оно машинно парсится гейтом полноты (AC-4.2/AC-4.3), и номер кейса, стоящий в прозе поля, был бы прочитан как настоящее сопоставление. Перечень — в Acceptance Criteria ниже.
**Files:**
- `test/pf-honest-reporting-static.sh` - новый: чисто статический аудит `skills/pf-codereview/SKILL.md`, `skills/pf-check/SKILL.md`, `skills/pf/SKILL.md`, `skills/pf-close/SKILL.md` — фикстур не требует

**Implementation Notes:**
- No fixtures for any of these four — they are read-only static audits of the real skill files, in the spirit of `test/skills-role-matrix-static.sh`.
- **TC-018 (per the revised `test_plan.md` TC-018 — split by file, not one shared anchor set).** `pf-codereview` and `pf-check` have genuinely different diff-computation shapes: `pf-codereview` always computes a branch diff in Phase 1 and hard-stops off-branch before that phase even finishes; `pf-check`'s Codex invocation chain computes a branch diff, but its Claude review path never computes one at all, and `pf-check` is the only one of the two skills with a legitimate "no issue branch yet" case. Write TC-018 as two file-specific checks in the same harness, not one shared loop: for `pf-codereview`, check the pre-existing branch guard (baseline) plus the new empty-diff-is-an-error anchors; for `pf-check`, check the empty-diff-is-an-error anchors (scoped to its Codex invocation chain specifically) plus the off-branch → review-by-path anchors. Do not collapse these into one grep pattern reused verbatim across both files — that shape is exactly what produced the P1-5-class defect this revision fixes (a drift-guard requiring a behavior from a file that structurally cannot exhibit it).
- TC-021 checks **both ends** of the same marker: the reader definition in `skills/pf/SKILL.md`'s "Note on 'check passed'" section (must reference an explicit written marker, not the circular "next document is ready" definition), and the writer in `skills/pf-check/SKILL.md` (must add an *unconditional* session-log line — not only the existing `[autopilot default]` line, which only fires in autopilot mode). Step 5 additionally cross-checks that the literal marker format named by the reader matches the literal format the writer emits — two texts separately using the word "marker" without agreeing on its shape must fail this step.
- TC-022 uses the anchor technique from `test/skills-role-matrix-static.sh`'s `check_order` — extract every `## Phase N` heading's line number in `skills/pf-close/SKILL.md`, then confirm each phase's block (except the last, Phase 9) contains either an explicit continuation or an explicit stop-with-message. Phase 4.5 must already pass today (baseline); full coverage of every other phase is RED until Task 12. **This drift-guard's "explicit continuation" signal must match the literal phrase Task 12 actually adds** ("Proceed to Phase N." — see Task 12's Implementation Notes) as an alternative to the pre-existing stop constructions ("stop:", "Merge conflict detected", "Stop and surface") — write the two as one alternation so this guard and Task 12's edit cannot drift apart on what counts as a signal.
- TC-023 reuses TC-022's list of stop messages and requires a concrete recovery path (a command, a numbered step list) next to each — Phase 4.5's own "Recovering from a failure inside this phase" is the passing exemplar (baseline); Phase 4's bare "Resolve conflicts manually on PARENT-BRANCH" is the known gap this TC is built to catch.

**Acceptance Criteria:**
- [x] TC-018 harness implemented; RED pending Task 10
- [x] TC-021 harness implemented; RED pending Task 11
- [x] TC-022 harness implemented; Phase 4.5 sub-check passes now (baseline), full-coverage check is RED pending Task 12
- [x] TC-023 harness implemented; Phase 4.5 sub-check passes now (baseline), full-coverage check is RED pending Task 12

---

#### Task 10: `pf-codereview` + `pf-check` — пустой предмет ревью и предмет вне ветки issue

**Task Type:** code
**Mapped Test Cases:** TC-018, TC-019, TC-020
**Files:**
- `skills/pf-codereview/SKILL.md` - модифицирован: пустой дифф — явная ошибка стадии
- `skills/pf-check/SKILL.md` - модифицирован: пустой дифф — явная ошибка стадии; отсутствие ветки issue — ревью по пути документа

**Implementation Notes:**
- **Empty review target = stage error, not clean (AC-5.1, BR-6).** In `pf-codereview`, add this check right after Phase 1 computes `git diff PARENT-BRANCH...HEAD`: if the diff is empty, stop with an explicit error ("nothing to review" / "empty review target") — do **not** proceed to Phase 2/3 and do **not** write `verdict: PASS` with empty findings lists. **In `pf-check`, this guard belongs only around the Codex invocation chain** — its step 2b (`--scope branch --base <base-ref>`) is the only place `pf-check` computes a diff at all; add the same empty-diff-is-an-error check there. `pf-check`'s Claude review path has **no equivalent to add**: it dispatches a sub-agent to read TARGET and its predecessor documents by path — no `git diff` call anywhere in that path — so "empty diff" is not a state that path can be in. Do not write prose implying a parallel diff-check exists for it. At most, note in the report which review mechanism actually ran (diff-based Codex chain vs. path-based Claude review), so the two are never confused. Both stop-messages (`pf-codereview`'s, and `pf-check`'s Codex-chain one) must read distinctly from a genuine "reviewed, found nothing" result — TC-018 (per the revised split in `test_plan.md`, see Task 9's Implementation Notes) checks for this distinction explicitly, not just the word "empty".
- **Off-branch document — review by path, reported explicitly (AC-5.2).** This is `pf-check`'s scenario **only** — `pf-codereview` does not carry an equivalent, see below. When TARGET was authored before an `issue/ISSUE-ID` branch exists (still on `develop`), `pf-check` must not compute a diff against a nonexistent branch and read "empty" as "clean": detect the missing branch, switch to reviewing the document by its current on-disk content instead, and state the reason ("no issue branch yet") in the report. `pf-codereview`'s Phase 1 already hard-stops if the current branch isn't `issue/ISSUE-ID` (a different, pre-existing guard), which makes the off-branch scenario structurally unreachable there — so `pf-codereview`'s text does **not** need review-by-path anchors at all. Per the revised TC-018 (see `test_plan.md` and Task 9's Implementation Notes): `pf-codereview` is checked only for its pre-existing branch guard plus the empty-diff rule above; `pf-check` is checked for the empty-diff rule (around its Codex chain) plus this off-branch/review-by-path rule. Do not invent a review-by-path behavior for `pf-codereview` that its Phase 1 guard already makes unreachable.
- TC-019 (Manual) and TC-020 (Manual) map here — TC-019 is the live empty-diff run (either skill), TC-020 is the live off-branch run (`pf-check` specifically, per its own Preconditions).

**Acceptance Criteria:**
- [x] TC-018 passes
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
- [x] TC-021 passes

---

#### Task 12: `pf-close` — ни одна фаза не виснет без явного отчёта и пути восстановления

**Task Type:** code
**Mapped Test Cases:** TC-022, TC-023
**Files:**
- `skills/pf-close/SKILL.md` - модифицирован: каждая фаза либо продолжается явно, либо останавливается с названным шагом и конкретным путём восстановления

**Implementation Notes:**
- **Audit every phase (AC-5.4).** Walk Phase 0 through Phase 9 (including 4.5 and 8.5). Phase 0's three prerequisite checks and Phase 1's confirmation already stop with a concrete next command each — leave those as-is. Phase 4.5 already has the fullest example of the target shape ("Recovering from a failure inside this phase", three numbered steps with real `git` commands) — treat it as the pattern to match, not to rewrite.
- **The one gap `test_plan.md` names explicitly (AC-5.5): Phase 4's merge-conflict stop.** Today it reads "Merge conflict detected. Resolve conflicts manually on PARENT-BRANCH, then re-run /pf-close." — a bare "resolve manually" with no concrete steps, exactly the shape AC-5.5 forbids. Extend it with an actual numbered recovery path (e.g.: identify conflicting files via `git status`, resolve them, `git add` the resolved files, `git commit` to complete the merge, then re-run `/pf-close` — adapt to this framework's actual recovery need, matching Phase 4.5's level of concreteness).
- **Phases 2, 3, 5, 6, 7, 8 and 8.5 have no signal a mechanical guard can match — add an explicit one-line continuation to each (AC-5.4).** Confirmed by direct inspection **and by Task 9's harness, which measured this**: these seven phases contain no "stop:"/"Merge conflict detected"/"Stop and surface"-style construction anywhere in their block, and no sentence naming the next phase either — they simply run out of numbered steps into the next `## Phase N` heading, which is not a signal TC-022's drift-guard counts. Append one short sentence at the end of each phase's numbered steps, in the file's existing plain style: Phase 2 → "Proceed to Phase 3." Phase 3 → "Proceed to Phase 4." Phase 5 → "Proceed to Phase 6." Phase 6 → "Proceed to Phase 7." Phase 7 → "Proceed to Phase 8." Phase 8 → "Proceed to Phase 8.5." **Phase 8.5 → "Proceed to Phase 9."** Do not invent a failure mode for a phase that has none (e.g. Phase 5's `mkdir -p`/`mv` are not expected to fail in normal operation) — an explicit continuation sentence, not a fabricated stop condition, is what TC-022's disjunctive check ("either explicit continuation or explicit stop") asks for here.
- **Phase 8.5 is included in the list above, and this corrects an earlier claim in this plan.** An earlier revision of these notes asserted that Phase 8.5 "already satisfies TC-022 today" on the strength of its non-fatal handling ("On push failure... do NOT abort... surface it in the Phase 9 report"). That reading is semantic, and Task 9's drift-guard cannot make it: 8.5 carries neither a `stop:`-style construction nor a phrase naming the next phase, and Task 9's measured run reports Phase 8.5 as FAIL alongside 2/3/5/6/7/8. Leaving 8.5 out would have left `TC-022 passes` in this task's own Acceptance Criteria unmet after the task reported success — the exact "a stage reports success without having done the work" defect this issue exists to remove. A mechanical gate must be satisfied mechanically (AC-4.5's principle, applied to this drift-guard): add the literal sentence rather than relying on a reader inferring continuation from "do NOT abort".
- **Phase 4, Phase 0 and Phase 1 already satisfy TC-022 today — leave their TC-022 status untouched.** Phase 4 has an explicit stop for its own failure mode (the conflict case); Phase 0's three prerequisite checks and Phase 1's confirmation each stop with an explicit message. Each satisfies the "explicit stop" half of TC-022's disjunctive check, so none needs an added "Proceed to Phase N" sentence. Their remaining gaps are TC-023's, not TC-022's — see the next bullet.
- **TC-023 gap in Phase 1 (AC-5.5), also measured by Task 9.** Phase 1's stop is `stop: "Close cancelled. No changes made."` — an explicit stop (so TC-022 passes) with **no recovery path at all**, which is what TC-023 requires next to every stop message; Task 9's run reports Phase 1 as FAIL on TC-023 step 3. An earlier revision of these notes claimed Phase 1 "stops with a concrete next command"; it does not — there is no command in that line. The honest recovery path here is short, because nothing was changed: extend the message so it names the way forward explicitly, e.g. "Close cancelled. No changes made. Re-run `/pf-close` when you are ready to close this issue." Phase 0's three stops already carry concrete next commands (`Run /pf-qa first`, `git checkout issue/ISSUE-ID`) and pass TC-023 today — leave them as they are.
- **Do not weaken Phase 4.5's existing recovery text** while editing nearby phases — TC-023's baseline sub-check depends on it staying intact.
- **Keep Task 9's TC-022 drift-guard in sync with the literal phrase added here.** Task 9's Implementation Notes call for the drift-guard's "explicit continuation" signal to match "Proceed to Phase N." verbatim, alongside the pre-existing stop constructions — if this task ends up phrasing the continuation differently, update Task 9's note (or the phrase here) so the two stay the same string; what one writes, the other must search for.

**Acceptance Criteria:**
- [x] TC-022 passes
- [x] TC-023 passes

---

#### Task 13: Тесты самодостаточности задания сабагенту

**Task Type:** tests
**Mapped Test Cases:** нет — infrastructure task: сьют пишет тестовую обвязку, а сами кейсы заявлены на парной code-задаче (Task 14), которая делает их drift-guard'ы зелёными. Номера кейсов намеренно не перечислены в этом поле: оно машинно парсится гейтом полноты (AC-4.2/AC-4.3), и номер кейса, стоящий в прозе поля, был бы прочитан как настоящее сопоставление. Перечень — в Acceptance Criteria ниже.
**Files:**
- `test/pf-execute-task-dispatch.sh` - новый: `pf_execute_resolve_task_content` helper + drift-guards
- `test/fixtures/pf-codereview-convergence/impl-plan-mismatched-numbering.md` - новый

**Implementation Notes:**
- **TC-024/TC-025 target the small/medium/large "Create each task with:" block specifically, not the trivial one.** `skills/pf-execute/SKILL.md` has two blocks with the identical literal heading `**Create each task** with:` — one under "If `size_tier: trivial`:" (its own four-bullet list — description+files, mapped TCs, `blocked_by`, `blocks` — has no `Task Type` field at all, by design — see Phase 1's own "No `Task Type` field" note, out of scope for this issue), and one under "If `size_tier` is small/medium/large:" (the block AC-6.1 actually targets, appearing later in the file, currently under Phase 1 → "Create Tasks from Implementation Plan"). Task 14 edits only the small/medium/large block. TC-024/TC-025's helpers and drift-guards must do the same, using anchor-narrowing (`test/skills-role-matrix-static.sh`'s technique): first locate the `**If `size_tier` is small/medium/large:**` heading's line number, then search only within that block's range — never a bare unscoped `grep "Create each task"` on the whole file, which would match the trivial block first (it appears earlier in the file) or match both indiscriminately. The trivial block is explicitly out of scope for this issue and must not be touched or asserted against.
- TC-024/TC-025 are otherwise pure static audits (no fixtures) of that narrowed "Create each task with:" block and of the "For Each Task — `write: claude` (Sub-Agent Instructions)" block (this second heading is unique in the file, no narrowing needed there).
- TC-025's single step is deliberately one-directional (per `test_plan.md`'s own note): it only checks that `TaskGet`/`TaskUpdate` are **not** prescribed to the sub-agent in that block. It is expected RED right now — `skills/pf-execute/SKILL.md` today literally says "Use `TaskGet` to read full task details" (step 1) and "Use `TaskUpdate` to mark task complete" (step 5) in that exact block (KI-1). A green result before Task 14 lands would mean the test itself is broken, not that the rule is already satisfied.
- TC-026's `pf_execute_resolve_task_content` helper is pure bash: a payload carrying only a task number resolves to nothing (step 1); a payload carrying full task content resolves to that content regardless of a mismatched number (step 2) — both GREEN from the start. Its drift-guard (step 3) is RED pending Task 14.

**Acceptance Criteria:**
- [x] TC-024 harness implemented; RED pending Task 14 (missing-criterion (в) only — (а)(б)(г)(д) baseline-pass today per `test_plan.md`)
- [x] TC-025 harness implemented and RED right now (KI-1) — this is the expected state, not a defect in the test
- [x] TC-026 harness implemented; helper steps pass now, drift-guard is RED pending Task 14

---

#### Task 14: `pf-execute` — самодостаточное задание сабагенту

**Task Type:** code
**Mapped Test Cases:** TC-024, TC-025, TC-026
**Files:**
- `skills/pf-execute/SKILL.md` - модифицирован: пятиэлементный минимум задания, устранение `TaskGet`/`TaskUpdate` из инструкции сабагенту, устойчивость к расхождению нумерации

**Implementation Notes:**
- **Five-element minimum (AC-6.1).** In the **small/medium/large** `**Create each task** with:` block only (Phase 1 → "Create Tasks from Implementation Plan" — do not touch the trivial block, which has its own, deliberately different, no-`Task Type` shape and is out of scope here): today already states four of five elements explicitly: what to do + files (as one combined bullet), mapped TCs, and dependencies (`blocked_by`/`blocks`). Add the missing fifth as its own explicit bullet — a concrete "what counts as done" criterion for the task, not folded into "Implement functionality to pass mapped TCs" inside the sub-agent instructions (that already exists but is not framed as a task-level completion criterion). Do not phrase any of the five as "a sufficient description" without enumerating them — that phrase was already rejected during this issue's own `brd.md` review as unverifiable.
- **Remove `TaskGet`/`TaskUpdate` from the sub-agent's own instructions (AC-6.2, KI-1).** In "For Each Task — `write: claude` (Sub-Agent Instructions)", step 1 ("Use `TaskGet` to read full task details") and step 5 ("Use `TaskUpdate` to mark task complete…") both prescribe tools sub-agents were confirmed (via `ToolSearch`, on two separate test sub-agents) not to have. Replace step 1 with an instruction to work from the task's full content already included in this dispatch prompt (per the five-element minimum above) — never fetched via `TaskGet`. Replace step 5 with an instruction to return a completion summary as the sub-agent's final message — the orchestrator reads that summary and calls `TaskUpdate` itself (this is already how "Execution Strategy" point 6 describes completion being judged in practice; this task makes the sub-agent-facing instruction match that reality instead of contradicting it).
- **Numbering-mismatch immunity (AC-6.3).** State explicitly that the dispatch prompt for a sub-agent always includes the task's full content (description, files, mapped TCs, dependencies) — never a bare task number/identifier alone — specifically covering the case where the orchestrator's own internal wave/task bookkeeping numbering does not match `implementation_plan.md`'s own `Task N` labels. This is the exact failure from `prompt.md` item 7's second paragraph: a sub-agent, lacking `TaskGet`, went and picked "Task 3" by number from the plan and did the wrong work because the numbers didn't line up.
- Reconcile with Phase 2's `write != claude` (delegated actor) path, which already **does** use `TaskGet`/`TaskUpdate` legitimately — that's the orchestrating session itself, not a dispatched sub-agent, and is explicitly out of scope for this task's changes (see `skills/pf-execute/SKILL.md`'s own "Why the orchestrator, not the actor, reads and marks the task" note).

**Acceptance Criteria:**
- [x] TC-024 passes
- [x] TC-025 passes
- [x] TC-026 passes

---

---

#### Task 15: Гейт полноты — симметрия кросс-ссылки с трекером и fail-closed на дублях

**Task Type:** tests
**Mapped Test Cases:** нет — задача заведена эскалацией `/pf-codereview` по
исчерпании бюджета раундов (AC-1.3, BR-7). Номера кейсов не перечислены в этом
поле по той же причине, что и у остальных задач `tests`: поле машинно парсится
гейтом полноты (AC-4.2/AC-4.3), и номер кейса, стоящий в его прозе, был бы
прочитан как настоящее сопоставление. Перечень — в Acceptance Criteria ниже.
**Files:**
- `skills/pf-execute/SKILL.md` - модифицирован: Check 2 получает ту же кросс-ссылку с Status Tracker, что и Check 2b; из Check 2b убирается обещание проверки `Type`
- `test/pf-execute-completeness.sh` - модифицирован: ветка `code` в `_pf_task_rule_ok` сверяет номера с трекером; `_pf_status_tracker_type_of` закрывается на дублях; ветка `tests` перестаёт перепарсивать трекер в цикле
- `test/fixtures/pf-codereview-convergence/coverage-forward-code-unknown-tc/` - новый: задача `code`, маппящаяся на несуществующий кейс
- `test/fixtures/pf-codereview-convergence/tracker-duplicate-type/` - новый: кейс, дважды присутствующий в трекере с разными `Type`

**Происхождение:** находки CR-013…CR-016 раунда 3 ревью кода. Раунд 3 —
последний в бюджете (`review_rounds` по умолчанию 3), на выходе осталась
открытая P1, поэтому по AC-1.3 и BR-7 находки переведены в задачи плана, а issue
возвращена на `/pf-execute` вместо выдачи `PASS`.

**Implementation Notes:**
- **CR-013 (P1) — симметрия Check 2.** Check 2 сегодня требует лишь, чтобы поле
  `**Mapped Test Cases:**` содержало литерал вида `TC-NNN` по форме, и никогда не
  проверяет существование строки в Status Tracker. Ту же дыру для задач `tests`
  уже закрыл CR-010 в Check 2b — здесь закрывается симметричная половина для
  `code`. Воспроизведённый сценарий, который обязан начать блокировать: задача
  `code` маппится на `TC-999`, отсутствующий в трекере, при этом другая задача
  маппится на реальный кейс и тем закрывает Check 3 — сегодня все три проверки
  зелёные, и задача самосертифицируется против выдуманного кейса. Это отказ
  AC-4.2 в его исходной формулировке: «функциональность объявлена, не построена».
- **CR-014 (P2) — убрать обещание, а не добавлять проверку.** Текст Check 2b
  говорит «the same fail-closed cross-reference Check 1 above applies (missing
  row, or missing/empty `Type` column, still blocks)», тогда как хелпер `Type` не
  читает. Ревьюеры разошлись: Codex предлагал привести хелпер к правилу, Claude —
  убрать оговорку из правила. **Решение оператора — вариант Claude:** `Type`
  семантически не относится к вопросу «существует ли кейс», а пустой `Type` всё
  равно блокируется fail-closed в Check 1 ниже по потоку. Убрать из текста
  Check 2b оговорку про `Type`, оставив требование существования строки. Проверку
  `Type` в хелпер Check 2b **не добавлять**.
- **CR-015 (P2) — fail-closed на дублирующихся строках.**
  `_pf_status_tracker_type_of` возвращает `Type` первой найденной строки и молча
  игнорирует последующие. При `TC-001`, присутствующем дважды — сначала `Manual`,
  ниже `Auto`, — незакрытый критерий проходит по оговорке для ручных кейсов, хотя
  кейс автоматический; `sort -u` в Check 3 конфликта тоже не видит. Сделать так,
  чтобы незакрытая строка проходила только если **все** строки каждого названного
  кейса существуют и все имеют ровно `Manual`; дубль с расходящимся `Type`
  блокирует.
- **CR-016 (P2) — снять асимметрию перепарсинга.** Ветка `tests` в
  `_pf_task_rule_ok` зовёт `_pf_status_tracker_tc_ids` внутри цикла по кейсам —
  тот самый паттерн, который убрали из Check 1 по CR-012. Материализовать набор
  один раз на вызов. Воспроизводимого отказа по времени нет ни здесь, ни у CR-012
  (замеры: реальные файлы issue — 1 с, синтетический план 50×50 — 0 с на
  незагруженной машине), поэтому это приведение к единообразию, а не оптимизация
  под измеренную проблему.
- **Каждый шаг каждого кейса отчитывается через `pf_pass "TC-NNN step K: …"` /
  `pf_fail "TC-NNN step K: …"`** — единственная форма, которую распознаёт
  сканирование TC-ID в `/pf-test` (Phase 3.2).
- **Не ослаблять существующее.** Направленность TC-014 и TC-015 остаётся
  независимой: прямое и обратное направления реализованы отдельными паттернами и
  отдельными путями кода, у каждого своя самопроверка против формулировки
  противоположного направления. Оговорка для ручных кейсов в Check 1 (CR-005) и
  чтение Status Tracker в Check 3 (CR-006) сохраняются.

**Acceptance Criteria:**
- [x] TC-014 passes — включая новую ветку: задача `code`, маппящаяся на кейс без строки в Status Tracker, блокирует гейт
- [x] TC-013 passes — включая fail-closed на дублирующейся строке кейса с расходящимся `Type`
- [x] TC-015 passes — обратное направление не затронуто, самопроверка направленности зелёная

### Dependencies

Порядок в этом документе — по user story, не по графу исполнения.
Реальные зависимости — только между задачами, редактирующими **один и тот
же файл**; задачи на разных файлах независимы и могут исполняться в любом
относительном порядке (в том числе параллельно, в одной волне
`/pf-execute`).

- **Все `tests`-задачи (1, 3, 5, 7, 9, 13, и добавленная эскалацией 15) не блокируются ничем.** Они
  не зависят от соответствующей `code`-задачи для своего создания — только
  их drift-guard-шаг ожидаемо RED до неё. Это осознанное свойство плана
  (test-first), не повод вводить искусственный `blocked_by`.
- **Цепочка `skills/pf-codereview/SKILL.md`: Task 4 → Task 2 → Task 6 →
  Task 10.** Все четыре редактируют один файл в разных секциях (Phase 3
  ledger, Phase 3.5/Phase 4 бюджет, Phase 2/3 triage, Phase 1 empty-diff).
  Между Task 4 и Task 2 связь **содержательная, не только защита от
  затирания правок параллельными сабагентами в одной волне**: Task 2's
  правило вычисления номера раунда («highest round number recorded + 1»,
  см. её Implementation Notes, «Round number») читает поле `round` из
  ledger'а `CR-NNN`, который физически вводит только Task 4 — без него
  Task 2 нечего читать, и второй, отдельный счётчик раундов Task 2 сама
  себе запрещает как «два механизма для одного факта». Между Task 2 и
  Task 6, и между обеими и Task 10, связь — файловый конфликт (не
  одновременная правка одной секции в одной волне) плюс проверяемая
  регрессия: Task 2 не должен ослабить условие `FAIL` из Phase 3, которое
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
  того, что проверяет сквозной прогон). По номерам задач в этом документе
  (позиция раздела, а не порядок исполнения — см. Overview) Task 2 идёт
  раньше Task 4/6; по исправленному порядку исполнения выше (`Task 4 →
  Task 2 → Task 6 → Task 10`) Task 4 к моменту исполнения Task 2 уже
  landed, но Task 6 — ещё нет, она исполняется после. Это означает, что
  TC-027's Acceptance Criteria в Task 2 фактически проверяется не сразу
  по завершении Task 2, а только после того, как Task 6 тоже landed —
  это нормально: Acceptance Criteria задачи не обязаны закрываться в
  момент, когда задача дошла до головы своей волны.

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
`code`-задачи вместо одной. Итог на момент проектирования: 6 `tests`-задач + 8 `code`-задач; после эскалации раунда 3 ревью добавилась Task 15 (`tests`), итого 7 + 8 = 15.

Оценка отражает фактический охват: пять изменяемых skill-файлов, шесть
user stories, 26 AC, 27 TC (23 Auto, требующих новой тестовой инфраструктуры
с нуля — ни одна не расширяет существующий сьют, все шесть новых файлов
`test/*.sh` создаются впервые), плюс ~20 новых фикстур. Она не раздута
искусственно: каждая `code`-задача правит одну связную область одного
файла (одна user story или, при пересечении файлов, одна пара
AC/файл), а не «переписать `pf-codereview` целиком» — самая крупная
единица, `pf-codereview/SKILL.md`, тронута четырьмя отдельными задачами
именно поэтому.
