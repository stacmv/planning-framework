## Implementation Plan: Pluggable Reviewers (Claude / Codex) for Documents and Code

### Overview

Вводим поле `reviewers` во frontmatter `prompt.md` (claude/codex/both на артефакт),
гарду, которая один раз при создании issue запрашивает этот выбор, единый механизм
вызова Codex с fallback на Claude, расширение `pf-check` для ревью документов силами
Codex/обоих ревьюеров, и новый жёсткий гейт `pf-codereview` — стадию ревью кода между
`/pf-execute` и `/pf-test`. Пять задач ниже реализуют всю фичу; по решению владельца
проекта формальным тест-планом покрыта только одна статическая проверка
(severity-mapping consistency, TC-001 в `test_plan.md`) — остальное верифицируется
дальнейшим использованием framework, см. `test_plan.md`'s "Scope decision".

### Files to Create/Modify

- `skills/pf-brd/SKILL.md` — гарда назначения ревьюеров (feat/improve)
- `skills/pf/SKILL.md` — та же гарда для bug-пайплайна; роутинг `pf-codereview`
- `skills/pf-check/SKILL.md` — чтение `reviewers.<doc>`, цепочка вызова Codex,
  нормализация severity, агрегация `both`
- `skills/pf-codereview/SKILL.md` — новый скилл, жёсткий гейт ревью кода
- `skills/pf-test/SKILL.md` — предусловие `code_review.md` с `verdict: PASS`
- `skills/pf-size-tiers/SKILL.md` — `code_review.md` в Scope, стадия код-ревью в
  таблице пайплайнов
- `skills/pf-update/SKILL.md` — упоминание `pf-codereview` в списке Managed Skills
- `PLANNING.md` — упоминание новой стадии/скилла в пайплайне

### Implementation Tasks

#### Task 1: Frontmatter `reviewers` и гарда назначения при создании issue

**Mapped Test Cases:** none (descoped from the formal test plan by owner decision — see test_plan.md's "Scope decision")

**Files:**
- `skills/pf-brd/SKILL.md` - добавить гарду назначения ревьюеров сразу после
  существующей legacy-tier-гарды (строки 9-10): если `reviewers` отсутствует в
  frontmatter — `AskUserQuestion` по одному вопросу на применимый ключ
  (brd/specs/test_plan/implementation_plan/code для feat; без specs для improve),
  рекомендация `claude` везде, запись блока `reviewers:` в `prompt.md`
- `skills/pf/SKILL.md` - тот же вопрос в Legacy-tier guard (строки 56-58), перед
  Step 5, для bug-пайплайна (ключи: analysis/test_plan/implementation_plan/code);
  для `size_tier: trivial` — ключи `notes`/`test_plan`/`code`

**Implementation Notes:**
- Формат блока — как в specs.md §2: один ключ на документ, значения
  `claude`/`codex`/`both`, дефолт `claude`
- Гарда не перезаписывает уже существующее поле `reviewers` — проверка
  присутствия ключа предшествует вопросу, как уже устроено для `size_tier`
- Набор ключей зависит от типа issue и тира — см. specs.md §2/§3

**Acceptance Criteria:**
- [x] Implemented and committed; not covered by a formal test case (see test_plan.md's "Scope decision")

#### Task 2: `pf-check` — выбор ревьюера, вызов Codex, `both`-агрегация

**Mapped Test Cases:** TC-001 (severity-mapping consistency only; the reviewer-selection/Codex-invocation/both-aggregation behavior this task implements is descoped from the formal test plan by owner decision — see test_plan.md's "Scope decision")

**Files:**
- `skills/pf-check/SKILL.md` - перед диспетчеризацией сабагента анализа (строка
  15) читать `reviewers.<ключ-текущего-документа>` из `prompt.md` (отсутствие
  ключа = `claude`, обратная совместимость); реализовать цепочку обнаружения
  Codex из specs.md §4 (плагин доступен → `codex:setup` → `codex-companion.mjs
  review --wait`; плагина нет → предложить установить → при отказе `codex exec`
  напрямую через Bash; Codex реально недоступен → молчаливый fallback на
  сегодняшний Claude-сабагент с пометкой «Codex недоступен — ревью выполнено
  Claude»); задокументировать сопоставление severity → приоритет (critical/high
  → P0, medium → P1, low → P2), с явной оговоркой, что сырой ответ `codex exec`
  показывается как есть, отдельным блоком «Codex findings (unstructured)», без
  этого сопоставления; для `both` — выполнить оба ревью независимо и объединить
  замечания в один список с подписями `[Claude]`/`[Codex]`, сохранив
  группировку P0/P1/P2, без разрешения противоречий

**Implementation Notes:**
- Эта логика — единственное место, документирующее цепочку §4 и сопоставление
  severity; `pf-codereview` (Task 3) ссылается на неё, а не переопределяет —
  по образцу того, как `pf-git`/`pf-size-tiers` используются как общие
  reference-скиллы
- Три опции гейта (Fix now / I'll fix manually / Skip and continue) не
  меняются для `both`/`codex` — жёсткость без «Skip» это свойство одного лишь
  `pf-codereview` (Task 3), не `pf-check`
- Fix-сабагент остаётся Claude-only независимо от того, кто нашёл замечание
  (specs.md §7) — этот шаг `pf-check` уже не требует правки

**Acceptance Criteria:**
- [x] TC-001 passes (severity-mapping section verified consistent with pf-codereview)
- [x] Reviewer-selection/Codex-invocation/both-aggregation implemented and committed; not covered by a formal test case (see test_plan.md's "Scope decision")

#### Task 3: Новый скилл `pf-codereview` — жёсткий гейт ревью кода

**Mapped Test Cases:** TC-001 (severity-mapping consistency only; the hard-gate behavior this task implements is descoped from the formal test plan by owner decision — see test_plan.md's "Scope decision")

**Files:**
- `skills/pf-codereview/SKILL.md` - новый файл. Входной гейт: `implementation_plan.md`
  complete (та же механическая проверка, что у `/pf-execute`). Диапазон ревью:
  `git diff <parent>...HEAD`, родитель определяется тем же способом, что
  `/pf-close` (Phase 3 «Detect Parent Branch» — `git config branch.issue/ISSUE-ID.merge`
  с fallback на develop/main). Ревьюер — `reviewers.code` из `prompt.md`, тот же
  механизм вызова Codex и та же severity-нормализация, что документирует
  `pf-check` (Task 2) — ссылка на него, без копирования текста. Артефакт:
  `docs/issues/open/<ISSUE-ID>/code_review.md` (`verdict: PASS|FAIL` + замечания
  по P0/P1/P2, с подписями `[Claude]`/`[Codex]` при `both`). Гейт без «Skip and
  continue»: пока открыт P0/P1, только «Fix now» (Claude fix-сабагент правит
  diff, ревью перезапускается автоматически) и «I'll fix manually, then re-run
  /pf-codereview»; цикл до `verdict: PASS`

**Implementation Notes:**
- Fix-сабагент — Claude-only, как в Task 2 (specs.md §7)
- Коммит & push — по образцу `~/.claude/skills/pf-git/SKILL.md` («Stage commit
  & push»), как каждый `pf-*` скилл на выходе; формат `code_review.md` — по
  образцу `qa_report.md`

**Acceptance Criteria:**
- [x] TC-001 passes (severity-mapping section verified consistent with pf-check)
- [x] Hard-gate behavior implemented and committed; not covered by a formal test case (see test_plan.md's "Scope decision")

#### Task 4: `pf-test` — предусловие `code_review.md`

**Mapped Test Cases:** none (descoped from the formal test plan by owner decision — see test_plan.md's "Scope decision")

**Files:**
- `skills/pf-test/SKILL.md` - добавить проверку сразу после существующей
  проверки `test_plan.md` (строка 7): `docs/issues/open/[ISSUE-ID]/code_review.md`
  должен существовать и иметь `verdict: PASS`; иначе остановиться с сообщением
  «code_review.md (PASS) is required. Run /pf-codereview first.» (на языке
  `doc_language` issue, если он отличен от English)

**Implementation Notes:**
- Проверка механическая (чтение файла и поля `verdict`), без семантической
  оценки — по аналогии с механической проверкой stage-complete из
  `pf-size-tiers`
- `verdict: FAIL` трактуется так же, как отсутствие файла — предусловие не
  выполнено

**Acceptance Criteria:**
- [x] Implemented and committed; not covered by a formal test case (see test_plan.md's "Scope decision")

#### Task 5: Роутинг и справочные обновления (`pf`, `pf-size-tiers`, `pf-update`, `PLANNING.md`)

**Mapped Test Cases:** none (descoped from the formal test plan by owner decision — see test_plan.md's "Scope decision")

**Files:**
- `skills/pf-size-tiers/SKILL.md` - добавить `code_review.md` в список документов
  раздела Scope (строки 76-79); добавить стадию код-ревью между IMPL_PLAN и
  TESTING в таблицу пайплайнов (строки 63-66) для всех типов и тиров, включая
  `trivial`
- `skills/pf/SKILL.md` - вставить `/pf-codereview` следующим шагом после
  IMPL_PLAN/`/pf-execute`, перед `/pf-qa`, во всех четырёх таблицах роутинга
  (trivial, feat, improve, bug), независимо от наличия поля `reviewers` в
  `prompt.md` (дефолт `claude` покрывает старые issue)
- `skills/pf-update/SKILL.md` - добавить `pf-codereview` в документационный
  список Managed Skills (строки 13-31); скрипт обновления обнаруживает его
  автоматически по глобу, правка нужна только для синхронности документации
- `PLANNING.md` - добавить `/pf-codereview` в схемы Workflow Pipelines (строки
  58-71) между `/pf-execute` и TESTING для feat/improve/bug

**Implementation Notes:**
- Код-ревью не зависит от тира документов — применяется одинаково и к
  `trivial`, где документный пайплайн свёрнут в `notes.md`
- Изменение в таблицах `pf` — чисто добавление строки/шага, без переупорядочивания

**Acceptance Criteria:**
- [x] Implemented and committed; not covered by a formal test case (see test_plan.md's "Scope decision")
