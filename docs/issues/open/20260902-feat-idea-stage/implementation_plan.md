## Implementation Plan: Стадия идеи (idea/spike issue types)

### Overview

Issue добавляет во фреймворк два новых типа issue — `idea` и `spike` — как
ветки поверх существующей машинерии `docs/issues/{open,closed}/`, `/pf`,
`/pf-check`, `/pf-close`, `/pf-autopilot`, `pf-roles`, `pf-git`. Семь новых
скиллов (пять пишущих: `pf-idea`, `pf-idea-research`, `pf-idea-critique`,
`pf-idea-verdict`, `pf-idea-spike`; два справочных: `pf-idea-lenses`,
`pf-interaction`) плюс дополнительные, всегда условные ветки в 13
существующих скиллах доводят фреймворк с 21 до 28 скиллов. Пайплайны
feat/improve/bug содержательно не меняются — каждая правка в общем скилле
обусловлена TYPE issue или полем `interaction: front-loaded`, ни одна не
заменяет существующую безусловную ветку (G7/AC-12a).

План разбит на 24 задачи, сгруппированные по файлу/скиллу (не по TC), в
порядке зависимостей: сначала два справочных скилла (на них ссылаются все
остальные), затем пять пишущих idea/spike-скиллов, затем `/pf` (точка
входа), затем правки в `pf-close`/`pf-git`/`pf-autopilot`/`pf-check`/
`pf-brd`/`pf-roles`/`pf-size-tiers`, затем зеркало каркаса и
`converge-to-v3.sh`, затем документация фреймворка и счётчики скиллов,
затем два новых теста, покрывающих всё перечисленное (Phase A), и только
после чекпоинта `make test` — front-loaded hook-сайты в 13 существующих
скиллах для feat/improve/bug (Phase B) и третий новый тест-файл, который их
проверяет, затем контракт Codex-адаптера интерактивных точек (P0-1 фикс), и
в конце — финальный дог-фуд-прогон (Phase C). Обоснование порядка и
отступление от буквального порядка «сначала все три тест-файла, потом
хуки» — см. раздел «Dependencies» ниже.

### Files to Create/Modify

**Новые директории/файлы:**
- `skills/pf-idea-lenses/SKILL.md`
- `skills/pf-interaction/SKILL.md`
- `skills/pf-idea/SKILL.md`
- `skills/pf-idea-research/SKILL.md`
- `skills/pf-idea-critique/SKILL.md`
- `skills/pf-idea-verdict/SKILL.md`
- `skills/pf-idea-spike/SKILL.md`
- `skills/pf/templates/project/` (побайтовое зеркало `docs/planning/templates/`)
- `test/pf-idea-stage-static.sh`
- `test/pf-idea-front-loaded-static.sh`
- `test/pf-idea-templates-mirror.sh`
- `test/fixtures/idea-verdict-project-bare/` (+ `-spike-first` вариант)
- `test/fixtures/idea-verdict-project-existing/`
- `test/fixtures/spike-close-branch/`
- `test/fixtures/spike-close-no-evidence/`
- `test/fixtures/idea-no-size-tier/`

**Изменяемые файлы:**
- `skills/pf/SKILL.md`
- `skills/pf-close/SKILL.md`
- `skills/pf-git/SKILL.md`
- `skills/pf-autopilot/SKILL.md`
- `skills/pf-check/SKILL.md`
- `skills/pf-brd/SKILL.md`
- `skills/pf-roles/SKILL.md`
- `skills/pf-size-tiers/SKILL.md`
- `skills/pf-help/SKILL.md`
- `skills/pf-update/SKILL.md`
- `skills/pf-spec/SKILL.md`
- `skills/pf-test-plan/SKILL.md`
- `skills/pf-impl-plan/SKILL.md`
- `skills/pf-execute/SKILL.md`
- `skills/pf-codereview/SKILL.md`
- `skills/pf-test/SKILL.md`
- `skills/pf-qa/SKILL.md`
- `skills/pf-user-docs/SKILL.md`
- `skills/pf-dev-docs/SKILL.md`
- `scripts/converge-to-v3.sh`
- `CLAUDE.md`
- `README.md`
- `CONTRIBUTING.md`
- `docs/planning/FRAMEWORK.md`
- `docs/planning/QUICKSTART.md`
- `tools/onboarding-tui/lib/tutorial.js`

**Явно НЕ меняются** (проверено при подготовке спека — §7.10, §1.2 part1):
`PLANNING.md`, `docs/planning/templates/` (остаётся каноническим источником,
не переименовывается и не перемещается), `role-profiles.yml`,
`install.sh`, `update-skills.sh`, `Makefile`, `test/docs-refs.sh`,
`test/skills-static.sh`, `test/skills-role-matrix-static.sh`,
`test/converge-fresh.sh`/`converge-migrate.sh`/`converge-normalize.sh`/
`lib.sh`, `pf-execute`/`pf-codereview`/`pf-test`/`pf-qa`/`pf-qa-setup`/
`pf-manual-test`/`pf-user-docs`/`pf-dev-docs` за пределами их front-loaded
hook-сайтов (Task 20).

---

## Dependencies

**Нумерация задач ниже сверена построчно с фактическими заголовками Tasks
1..24 этого документа (P1-2 фикс — более ранняя редакция несла
систематически отставшие номера начиная с группы 4; исправлено везде, не
только в этом разделе).** Порядок задач соответствует девяти группам
зависимостей, заданным для этого плана, с одним обоснованным отступлением
(Phase-boundary trade-off, описан отдельным пунктом ниже):

1. **Справочные скиллы первыми** (Task 1) — `pf-idea-lenses` и
   `pf-interaction` не вызываются пользователем напрямую, но их читает
   каждый пишущий idea/spike-скилл и почти каждый изменяемый общий скилл
   (decision (A) из specs-part1.md §1.1: таблицы стадий и линз живут в
   `pf-idea-lenses`, не дублируются нигде).
2. **Пять пишущих idea/spike-скиллов** (Tasks 2-6) — каждый читает
   `pf-idea-lenses`/`pf-interaction` по имени; независимы друг от друга по
   содержанию (разные документы), но естественно идут в порядке пайплайна
   idea (`pf-idea` → `pf-idea-research` → `pf-idea-critique` →
   `pf-idea-verdict`), затем `pf-idea-spike`.
3. **`/pf` — точка входа** (Tasks 7-8) — маршрутизация на новые скиллы
   должна знать об их существовании; разбита на «пустая папка» (Task 7,
   constraint-важная развилка «идея / сразу проект») и «существующий
   проект + intake-ветки + routing» (Task 8).
4. **Правки `pf-close`/`pf-git`/`pf-autopilot`/`pf-check`/`pf-brd`/
   `pf-roles`/`pf-size-tiers`** (Tasks 9-14) — зависят от того, что типы
   `idea`/`spike` и их документы уже определены (Tasks 1-6), и от того, что
   `/pf`'s Step 4 (определение TYPE по имени папки) уже специфицирован
   (Task 8) — эти скиллы используют тот же способ определения TYPE. Группа
   разбита на `pf-close`/Phase 0-4.5 (Task 9), `pf-git` (Task 10),
   `pf-close`/Phase 4.6-9 (Task 11, продолжает Task 9), `pf-autopilot`
   (Task 12), `pf-check` (Task 13), `pf-brd`+`pf-roles`+`pf-size-tiers`
   (Task 14).
5. **Зеркало каркаса + `converge-to-v3.sh` + `CONTRIBUTING.md`** (Task 15)
   — независимо от Tasks 1-14 по содержанию, но логически идёт после того,
   как набор документов idea/spike зафиксирован (`required_docs()` в
   `converge-to-v3.sh` ссылается на эти имена файлов).
6. **Документация/счётчики скиллов** (Task 16) — обязана идти **до**
   чекпоинта Task 19 (`make test`), потому что `test/docs-refs.sh`'s
   `N_SKILLS` вычисляется динамически (`find skills -mindepth 1 -maxdepth 1
   -type d`) — как только Task 1 создаёт первую новую директорию скилла,
   `N_SKILLS` становится больше 21, и `assert_lists_every_skill`/счётчик-
   проверки в `test/docs-refs.sh` начинают падать до тех пор, пока
   `CLAUDE.md`/`README.md`/`docs/planning/FRAMEWORK.md`/
   `docs/planning/QUICKSTART.md`/`skills/pf-update/SKILL.md`/
   `tools/onboarding-tui/lib/tutorial.js` не обновлены. Это ровно то
   самозащитное свойство, ради которого `test/docs-refs.sh` был написан —
   план обязан пройти его тем, что документация обновлена, а не тем, что
   тест изменён.
7. **Два новых теста, покрывающих Tasks 1-16** (Tasks 17-18) —
   `test/pf-idea-stage-static.sh` (статический, Task 17) и фикстуры +
   поведенческие тесты + `test/pf-idea-templates-mirror.sh` (Task 18) —
   Task 17's статические проверки включают все шесть изменённых общих
   скиллов (Tasks 9-14) и документацию (Task 16), не только Tasks 1-8.
8. **Front-loaded hook-сайты в 13 существующих скиллах** (Tasks 20-21) —
   отдельная, поздняя группа задач, применимая только к feat/improve/bug
   (idea/spike front-loaded безусловно и без hook-таблицы, decision из
   specs-part1.md §3.8) — третий новый тест (Task 22) проверяет именно эти
   правки.
9. **Codex-адаптер интерактивных точек** (Task 23, P0-1 фикс) — зависит от
   `pf-interaction` (Task 1, расширяемый скилл), `pf-idea-verdict` Режима 2
   (Task 5) и `pf-close`'s front-loaded финального гейта (Task 21) —
   документирует контракт (не рантайм-запуск, вне скоупа per BRD
   Non-Goals), на который они оба ссылаются для `write == codex`; логически
   не может идти раньше Task 21, поскольку у front-loaded финального гейта
   до Task 21 просто нет текста, на который можно сослаться.

**Обоснованное отступление от буквального порядка «все три тест-файла одной
группой перед хуками».** Инструкция группирует «три новых `test/*.sh`
файла» одним пунктом (7) перед hook-сайтами (8). Технически это
неисполнимо буквально: `test/pf-idea-front-loaded-static.sh` (третий файл)
проверяет содержимое hook-сайтов (Tasks 20-21), которых до Task 21 не
существует — написанный раньше, этот тест был бы заведомо красным без
какой-либо связанной с ним пользы. План поэтому пишет `test/pf-idea-
front-loaded-static.sh` **после** hook-сайтов (Tasks 20-21), а не одним
пакетом с двумя другими тест-файлами (Tasks 17-18), которые действительно
можно и нужно написать сразу после соответствующей им функциональности
(Phase A). Дублирующая логика — та же, что уже описывает сам спек в §8's
преамбуле («каждый TC отдельно называет свой test file») — тест-файл
пишется тогда, когда впервые может содержательно проходить, не раньше.

**Внешние зависимости.** Только `bash`/`git` — `pytest` явно не
используется, все тесты фреймворка (существующие и новые три файла) —
bash-скрипты (`test/*.sh`), запускаемые через `make test`. Никаких новых
runtime-зависимостей (npm-пакетов, языковых рантаймов) issue не вводит.

---

## Implementation Tasks

#### Task 1: Справочные скиллы `pf-idea-lenses` и `pf-interaction`

**Task Type:** code
**Mapped Test Cases:** TC-001, TC-008, TC-013, TC-015, TC-016, TC-019

**Files:**
- `skills/pf-idea-lenses/SKILL.md` - новый: справочный скилл (по образцу
  `pf-size-tiers`)
- `skills/pf-interaction/SKILL.md` - новый: справочный скилл

**Implementation Notes:**
- Оба скилла — справочные, не вызываются пользователем напрямую: при
  прямом вызове просто печатают своё содержимое, как это уже устроено у
  `pf-size-tiers`/`pf-git`/`pf-roles` (specs-part1.md §1, «Справочные»).
- `pf-idea-lenses/SKILL.md` несёт, каждая — отдельная таблица/раздел:
  1. Словарь `idea_tier` — 4 строки: `personal`/`infra`/`content`/`product`
     с колонкой «когда выбирать» (specs-part1.md §3.7.1).
  2. Таблица линз 8 строк × 4 колонки (specs-part1.md §3.7.2): «5 почему»
     — ✓ во всех четырёх колонках; SWOT/Build vs. Buy/Audience-Distribution
     Fit/Lean Canvas/JTBD/Pre-mortem/TAM-SAM-SOM по распределению из
     таблицы (`personal` не получает ничего кроме «5 почему»).
  3. Таблица персон критики 7 строк × 4 колонки (specs-part1.md §3.7.3):
     базовые 4 (скептик-инвестор/целевой пользователь/техлид/безопасник) —
     ✓ везде; `infra` добавляет «Эксплуатация/надёжность», `content` —
     «Аудитория/дистрибуция», `product` — «Рыночный аналитик/конкурент».
  4. Сводная таблица бюджетов документов 6 строк (idea/research/critique/
     verdict/hypothesis/findings) × 4 колонки tier — точные числа из
     specs-part2.md §6.10 (единственный источник; §6.2.2/§6.3/§6.4/§6.5/
     §6.6/§6.7 part2 её лишь цитируют).
  5. Обе таблицы стадий, дословно из specs-part1.md §3.7.4: `idea` — 9
     строк «позиция → next step», **включая** отдельную строку «VERDICT +
     check OPEN after override» (не путать с «VERDICT, документ написан,
     check ещё не пройден» — это две разные строки); `spike` — 3 строки.
     Ниже — обоснование «почему `/pf-check` только после `idea.md` и после
     `verdict.md`» (пять доводов) и «почему у `spike` нет обязательного
     `/pf-check`» — оба абзаца дословно из specs-part1.md §3.7.4.
  6. Закрытый словарь вердиктов: ровно `project` / `spike-first` / `defer`
     / `archive` (specs-part1.md §3.7.5). **Не** содержит `incubate-until`
     — это формулировка `prompt.md`'s constraint 3, сознательно
     отменённая decision-документом issue; регрессия к ней ловится
     TC-013.
- `pf-interaction/SKILL.md` несёт:
  1. Формулировку «Front-loaded rule» дословно из specs-part1.md §3.8:
     взять рекомендацию тем же способом, каким сегодня вычисляется
     рекомендация для интерактивного вопроса → записать `[assumed] <вопрос>
     → <ответ> — <почему>` в `open_questions.md` (точный формат —
     specs-part2.md §6.9, дословно этой же задачей не создаётся — файл
     появляется лениво, первым пишущим скиллом/стадией, которой есть что в
     него записать, specs-part1.md §5.6) → продолжить без паузы.
  2. Утверждение «один финальный человеческий гейт на issue — не два»,
     называющее decision session (`pf-idea-verdict` Режим 2) для `idea` и
     `pf-close`'s Phase 1 для `spike` (specs-part1.md §3.8, второй абзац).
  3. Раздел исключений для `idea`/`spike` — **ровно один** случай: install
     Codex CLI/плагин при полной недоступности CLI/npm (не «список из
     четырёх» — `code.review: skip` confirmation не применим вовсе, нет
     ключа `code`; готовность к Codex-ревью решается на intake тем же
     батчем — specs-part1.md §3.8, третий абзац).
  4. §6.11 part2 дословно: `interaction: front-loaded` опционально для
     feat/improve/bug (по умолчанию — сегодняшнее интерактивное
     поведение, поле читается **каждым** hook-сайтом индивидуально, не
     централизованно); для `idea`/`spike` поле присутствует всегда, но
     **не читается как переключатель**.

**Acceptance Criteria:**
- [x] TC-001 passes (частично — 2 из 7 директорий; полное прохождение требует Tasks 2-6)
- [x] TC-008 passes
- [x] TC-013 passes (частично — только словарь вердиктов; полное прохождение требует Task 5)
- [x] TC-015 passes
- [x] TC-016 passes (частично — только таблица бюджетов; полное прохождение требует Task 13)
- [x] TC-019 passes

---

#### Task 2: `pf-idea` — пишущий скилл `idea.md`

**Task Type:** code
**Mapped Test Cases:** TC-001, TC-009

**Files:**
- `skills/pf-idea/SKILL.md` - новый

**Implementation Notes:**
- Структура один-в-один с `pf-brd`'s small/medium/large-веткой (output-гейт
  regenerate/keep/cancel по критерию `pf-size-tiers`, resolve роли для
  ключа `idea` через `pf-roles` §4, диспетчеризация саб-агента/делегата по
  той же логике, что нестандартный tier у `pf-brd`), но **без**
  `AskUserQuestion`-цикла по содержанию — весь контент уже в `prompt.md`
  (specs-part1.md §3.2).
- Действие (specs-part1.md §3.2, пп.1-5): прочитать `idea_tier` из
  `prompt.md`; прочитать у `pf-idea-lenses` обязательные линзы для этого
  tier и бюджет строк; составить `idea.md`, применяя каждую линзу к
  материалу `prompt.md`; там, где линзе не хватает факта, которого нет и
  нельзя вывести логически — **не выдумывать и не спрашивать**: писать
  `[assumed]`-строку в `open_questions.md` (формат specs-part2.md §6.9) с
  пометкой в тексте «(допущение, см. `open_questions.md` #N)»; секция
  «Lenses Applied» перечисляет ровно список, вернувшийся из
  `pf-idea-lenses` — `idea.md` не переопределяет состав (AC-04c); проверить
  объём `wc -l` против бюджета — при превышении не останавливать запись, а
  пометить P1-подобным наблюдением в отчёте скилла (настоящий гейт —
  последующий `/pf-check`).
- Скелет `idea.md` — ровно семь `##`-заголовков в фиксированном порядке
  (specs-part2.md §6.2.1): Pain & Evidence / Analogs / Prior Art /
  Differentiation / USP / MVP / Cost (Effort) / Risks / Lenses Applied.
  Артефакты конкретных линз (Lean Canvas, JTBD, SWOT, pre-mortem, TAM/SAM/
  SOM, Build vs. Buy, Audience/Distribution Fit, 5 почему) вкладываются как
  `###`-подзаголовки **внутрь** «Lenses Applied» — не становятся новыми
  верхнеуровневыми секциями.
- Бюджеты (specs-part2.md §6.2.2): personal ≤150, infra ≤200, content
  ≤200, product ≤300 строк.
- Выход: commit & push по `pf-git` (Task 10), с guard'ом «нет
  репозитория» (Task 7). Следующий шаг в отчёте — `/pf-check`.

**Acceptance Criteria:**
- [x] TC-001 passes (частично)
- [x] TC-009 passes

---

#### Task 3: `pf-idea-research` — пишущий скилл `research.md`

**Task Type:** code
**Mapped Test Cases:** TC-001, TC-010

**Files:**
- `skills/pf-idea-research/SKILL.md` - новый

**Implementation Notes:**
- Вход: `prompt.md`, `idea.md`. Веб-поиск разрешён (`WebSearch`/`WebFetch`
  уже доступны сессии `/pf`, отдельного включения не требуют) —
  specs-part1.md §3.3.
- Действие (specs-part1.md §3.3, пп.1-5): извлечь из `idea.md` каждое
  фактчекуемое утверждение (аналоги, ограничения платформы, наличие API,
  лицензии — список открыт, минимум по AC-05a); для каждого — попытаться
  найти источник; **найден → `Status: проверено`, `Source`: URL/путь**; не
  найден/противоречиво/непроверяемо в принципе → `Status: не проверено`,
  **строка не исключается из документа**, остаётся видимой и помеченной
  (US-03d).
- **Жёсткий инвариант записи, не конвенция (AC-05b):** `Status: проверено`
  без непустого `Source` — невалидная комбинация, которую скилл **никогда
  не пишет** — это утверждение о том, как скилл формирует таблицу, не
  runtime-проверка (сравнимо с тем, как `pf-test-plan` не пишет `Manual`
  без `Manual reason:`).
- Каждая `не проверено`-строка дополнительно копируется (по одной записи
  на факт) в `open_questions.md` как запись `Status: unverified-fact` (**не**
  `assumed`) — колонка «Assumed answer» для такой строки буквально `(нет —
  не проверено, не допущение)`, колонка «Why» — причина непроверяемости
  (specs-part2.md §6.9).
- Секция «Methodology» фиксирует, что и как искалось.
- Скилл **никогда не задаёт вопросов пользователю** — даже output-гейт
  regenerate/keep/cancel общий для всех пишущих скиллов остаётся, но
  контентных вопросов нет вовсе (specs-part1.md §3.3, последний абзац).
- Скелет `research.md` (specs-part2.md §6.3): `## Facts` (таблица
  `#`/`Claim`/`Status`/`Source`/`Notes`), `## Methodology`, `## Open
  Questions Raised` (указатель на `open_questions.md`, не дублирует
  содержимое). Бюджет: personal ≤80, infra ≤120, content ≤120, product ≤200
  строк (мягкий ориентир).
- Выход: commit & push по `pf-git` (Task 10), guard «нет репозитория»
  (Task 7). Следующий шаг — `/pf-idea-critique`.

**Acceptance Criteria:**
- [x] TC-001 passes (частично)
- [x] TC-010 passes

---

#### Task 4: `pf-idea-critique` — пишущий скилл `critique.md`

**Task Type:** code
**Mapped Test Cases:** TC-001, TC-011, TC-012

**Files:**
- `skills/pf-idea-critique/SKILL.md` - новый

**Implementation Notes:**
- Вход: `idea.md`, `research.md`, `idea_tier`.
- Персоны (specs-part1.md §3.4, п.1): базовые четыре (скептик-инвестор,
  целевой пользователь, техлид, безопасник) + tier-специфичное расширение
  из `pf-idea-lenses` (Task 1, §3.7.3).
- **Диспетчеризация — независимо, параллельно, по одному вызову на
  персону, все вызовы одного сообщения** (specs-part1.md §3.4, п.2, US-06b).
  Актор/tier резолвится **один раз** для всего документа через ключ
  `critique` (`pf-roles` §4) — все персоны запускаются под одним
  резолвнутым `(actor, tier, model)`, различается только промпт («ты —
  <персона>, читай `idea.md`/`research.md`, сформулируй возражения...»).
  Если `write == claude` — каждая персона это независимый `Agent`-вызов с
  `model: <resolved tier>`. Если `write != claude` — **не** через `pf-roles`
  §7 (та форма всегда `--write` с жёстким стопом; персона не пишет файл) —
  а через тот же document-form, что `pf-check`'s «Codex invocation chain»
  использует (`codex-companion.mjs task "<brief>" --json`, без `--write`),
  применённую **к каждой персоне независимо**: недоступность Codex для
  одной персоны не блокирует остальные и не останавливает скилл целиком
  (graceful fallback на Claude для этой персоны, с пометкой в собранном
  `critique.md` «(Codex unavailable — эта персона отработана Claude)») —
  обоснование этой формы, а не `pf-roles` §7, зафиксировано в
  specs-part2.md §7.12.2 (эта задача не редактирует `pf-roles/SKILL.md` —
  правка целиком лежит здесь).
- **Явный планировщик персон — bounded concurrency, не «все сразу»
  (P0-2 фикс, specs-part3.md §9 «`Agent` tool с `model:`» row):** для
  `write == claude` персоны разбиваются на волны по **не более 3**
  одновременных `Agent`-вызовов за раз (тот же типичный лимит параллельных
  дочерних слотов, который называет сам спек в §9) — personal/infra/content
  (4-5 персон) идут в 2 волны (3+1 или 3+2), product (6 персон) — в 2 волны
  по 3. Внутри одной волны все вызовы — одним сообщением (как и было
  специфицировано выше); следующая волна стартует только после того, как
  предыдущая полностью вернулась (успешно или с ошибкой по каждой персоне).
  Единый формат результата на каждую персону независимо от волны/актора:
  `{persona, objections[], raw_text}` — сборка секций и Summary Table
  начинается только после того, как все волны завершены.
- **Codex fallback — строго последовательно, без волн:** когда актор для
  всего документа резолвится в `codex` (не per-persona graceful fallback
  выше, а исходный резолв через `critique`-ключ), персоны обрабатываются
  одна за другой отдельными вызовами `codex-companion.mjs task ... --json`
  — отсутствие у Codex оркестрирующего примитива, эквивалентного `Agent`
  tool (specs-part3.md §9), означает, что параллелизм здесь не имитируется;
  более долгое время выполнения — принятый trade-off для этого пути, не
  дефект.
- **Частичный отказ персоны (P0-2 фикс):** сбой отдельного вызова
  (timeout/недоступность актора) не останавливает скилл целиком. Базовые
  четыре персоны (скептик-инвестор/целевой пользователь/техлид/безопасник)
  обязательны для валидного `critique.md`: сбой одной из них — один
  автоматический повтор тем же путём/актором; повторный сбой — стоп с явной
  ошибкой, `critique.md` не пишется наполовину. Tier-специфичные
  дополнительные персоны (пятая/шестая) — best-effort: неустранимый сбой
  (после одного повтора) заменяет секцию персоны строкой «(персона
  недоступна — <причина>)» и добавляет строку в Summary Table с диспозицией
  по умолчанию **Риск принят** (недостаточно данных для другой оценки),
  логируемую как `[assumed]` в `open_questions.md` — скилл продолжает как
  обычно, отсутствие опциональной персоны не блокирует запись.
- Каждая персона: промпт по образцу `pf-check`'s Claude review path («read
  X, do not edit anything, return only your findings»); персона **не
  пишет в файл**, возвращает список возражений; `pf-idea-critique`
  (эта сессия) собирает секции по персонам плюс Summary Table.
- Summary Table «возражение → диспозиция → Reflected in» (AC-06c):
  диспозиция — закрытый словарь ровно трёх значений — **Отвечено**, **Риск
  принят**, **Идея меняется** (`pf-idea-critique` не редактирует `idea.md`
  сама — коррекция откладывается на решение пользователя в decision session
  или фиксируется как вход для `verdict.md`). Каждая строка обязана иметь
  непустой `Reflected in` — если сама `pf-idea-critique` не может
  определить диспозицию однозначно, записывает `[assumed]` в
  `open_questions.md` с рекомендованной диспозицией (specs-part1.md §3.4,
  п.5).
- Скелет `critique.md` (specs-part2.md §6.4): `## <Персона>` разделы (сырые
  возражения) + `## Summary Table` (`#`/`Objection`/`From`/`Response`/
  `Disposition`/`Reflected in`). Бюджет: personal ≤200, infra/content ≤250
  (5 персон), product ≤300 (6 персон) строк.
- Выход: commit & push по `pf-git` (Task 10), guard «нет репозитория»
  (Task 7). Следующий шаг — `/pf-idea-verdict`.

**Acceptance Criteria:**
- [x] TC-001 passes (частично)
- [x] TC-011 passes
- [ ] TC-012 — manual, per test_plan.md. **Допущение (P0-2):** текущая
      формулировка TC-012 в test_plan.md проверяет наличие секций по
      персонам в `critique.md`, не факт независимого запуска каждой персоны
      отдельным вызовом и не bounded-concurrency/sequential-fallback/
      partial-failure правила этой задачи — test_plan.md уже прошёл свой
      `/pf-check` и не редактируется этим документом, формулировка TC-012
      требует уточнения при следующей ревизии test plan. До тех пор
      тестировщик, выполняющий TC-012 вручную, обязан **дополнительно**
      сверить волновой планировщик/Codex-fallback/partial-failure поведение
      по Implementation Notes выше, не только наличие секций.

---

#### Task 5: `pf-idea-verdict` — пишущий скилл (Режим 1 + Режим 2/decision session)

**Task Type:** code
**Mapped Test Cases:** TC-001, TC-013, TC-014

**Files:**
- `skills/pf-idea-verdict/SKILL.md` - новый

**Implementation Notes:**
- **Режим 1 — запись `verdict.md`** (specs-part1.md §3.5): вход — `idea.md`,
  `research.md`, `critique.md`, `open_questions.md` (если есть). Оценить
  по словарю вердиктов (Task 1), проверяя явно пять сигналов в «##
  Reasoning»: подтверждена ли боль; остались ли критичные технические
  вопросы дешевле проверяемые экспериментом (→ `spike-first`); перевешивают
  ли нерешённые возражения критики пользу (→ `defer` с текстовыми условиями
  возврата, **без дат** — или → `archive`); соответствует ли идея
  собственному критерию пользователя «что убедит сказать project».
  «## Return Conditions» пишется **только** для `defer`. «## Assumptions
  Summary» и «## Unverified Facts Summary» — построчный пересказ (не
  ссылка) каждой `[assumed]`/`unverified-fact` записи. **«## Decision» в
  этом режиме не пишется вовсе** — файл заканчивается на «## Unverified
  Facts Summary» (specs-part2.md §6.5, finding #13 — не placeholder-
  заголовок, физическое отсутствие заголовка — единственный признак
  неподтверждённого вердикта). Commit & push, следующий шаг — `/pf-check`.
- Скелет Режима 1 (specs-part2.md §6.5): `## Recommended Verdict` / `##
  Reasoning` / `## Return Conditions` / `## Assumptions Summary` / `##
  Unverified Facts Summary`. Бюджет: personal ≤60, остальные ≤100 строк (не
  считая «## Decision»).
- **Режим 2 — сессия решения** (когда `verdict.md` завершён, check
  `PASSED`, «## Decision» отсутствует, specs-part1.md §3.5.1-§3.5.3):
  1. Один `AskUserQuestion` (≤4 вопроса — тот же лимит, что intake):
     показывает рекомендованный вердикт+обоснование сокращённо, **полный**
     список `[assumed]`, **полный** список открытых вопросов, **полный**
     список непроверенных фактов; три ответа — **Подтвердить**, **Выбрать
     другой** (второй вызов с оставшимися тремя вариантами словаря),
     **Переопределить допущение** (третий вызов, список `[assumed]`-записей,
     по одной за раз).
  2. **Override (AC-07d, specs-part1.md §3.5.2):** новый ответ →
     регенерировать **только** секции, названные в «Used in» переопределённой
     записи, во **всех** названных документах (не только в одном) — точечная
     правка блока между заголовками, не переписывание документа целиком.
     «Used in» необходимо, но не достаточно — канонический порядок
     зависимости фиксирован (`idea.md → research.md → critique.md →
     verdict.md`, тот же, что `pf-idea-lenses`'s Stage tables), поэтому
     инвалидация консервативно накрывает **весь хвост** пайплайна от
     самого раннего изменённого документа, не только явно названные секции.
     Пометить исходную запись `[overridden]` в `open_questions.md`, рядом —
     новый ответ (не удалять). Для каждого регенерированного/хвостового
     документа — дописать `[pf-check OPEN] <файл> — invalidated by override
     of open_questions.md #<N>` в `session-log.md`. Пересчитать
     рекомендуемый вердикт **заново** по правилу Режима 1. Commit & push.
     Следующий шаг — **`/pf-check`**, не сразу decision session повторно:
     каждый `OPEN`-документ обязан получить свежий `PASSED` до того, как
     сессия решения покажется снова. Цикл повторяется, пока пользователь не
     подтвердит один из четырёх вердиктов.
  3. **Подтверждение (specs-part1.md §3.5.3):** append-блок «## Decision»
     в конец `verdict.md` — `**Confirmed verdict:**`, `**Confirmed by:**`,
     `**Date:**`, `**Timestamp:**` (specs-part2.md §6.5, точный скелет
     append-блока, включая `Confirmed by`, добавленный в финальной
     редакции спека — finding #32). Это единственный машиночитаемый
     признак «вердикт подтверждён» (AC-07e), на который опирается
     `/pf-close`'s prerequisite guard (Task 9). Commit & push, следующий
     шаг — `/pf-close`.
- **Автопилот и front-loaded (US-10b, specs-part1.md §3.5.4):** Режим 2
  никогда не диспетчеризуется автопилотом — рабочий цикл доходит до
  «verdict.md готов, check пройден, следующий шаг — сессия решения» и
  останавливается, печатая финальный отчёт с полным списком допущений/
  вопросов (детальная правка `pf-autopilot` — Task 12; здесь фиксируется
  только собственное поведение `pf-idea-verdict`: не пытается сама
  запускать Режим 2 в автопилот-контексте).

**Acceptance Criteria:**
- [x] TC-001 passes (частично)
- [x] TC-013 passes
- [ ] TC-014 — manual, per test_plan.md

---

#### Task 6: `pf-idea-spike` — пишущий скилл (Режим 1: `hypothesis.md`, Режим 2: `findings.md`)

**Task Type:** code
**Mapped Test Cases:** TC-001, TC-018, TC-028

**Files:**
- `skills/pf-idea-spike/SKILL.md` - новый

**Implementation Notes:**
- **Режим 1** (specs-part1.md §3.6): переносит вопрос/критерий успеха/
  time-box/метод **из `prompt.md`** (уже собраны на intake — Task 8, §6.8
  part2) в структуру `hypothesis.md` — форматирующий шаг, без
  дополнительных вопросов. Скелет (specs-part2.md §6.6): `## Question` /
  `## Success Criterion` / `## Time-box` / `## Method`. Бюджет: personal
  ≤50, infra/content ≤60, product ≤80 строк. Commit & push, следующий шаг —
  `/pf-idea-spike` (Режим 2).
- **Режим 2** (specs-part1.md §3.6, пп.1-6):
  1. Определить по `hypothesis.md`'s «## Method», нужен ли код/эксперимент,
     требующий изменений в репозитории.
  2. **Если да** — создать/checkout ветку `issue/<spike-id>` **тем же
     механизмом, что `pf-execute`'s Phase 0 «Branch Setup»** (ссылка по
     имени на процедуру, не копирование текста), выполнить эксперимент на
     этой ветке, `git add -A && git commit` (без push до конца стадии —
     push через `pf-git`'s Step 3 в конце, на **этой** ветке — эксперимент
     пушится, это не финальный merge). `findings.md` пишется **тоже на
     этой ветке**.
  3. **Если нет** — эксперимент выполняется прямо в сессии (например,
     `WebFetch` реальной документации), без ветки; `findings.md` пишется
     там, где уже находится сессия.
  4. **Гейт записи (AC-09c):** «## Run Evidence» обязана содержать
     конкретное свидетельство — команда+вывод, путь к артефакту, или
     прямая цитата с URL/путём — не пересказ ожидания. Скилл **не пишет**
     «## Conclusion» без непустой «## Run Evidence» (та же дисциплина, что
     `research.md`'s Source-требование).
  5. «## Result vs. Success Criterion» — met/not met/partial, сверяясь с
     критерием из `hypothesis.md`.
  6. Commit & push на той ветке, где сессия сейчас находится. Следующий
     шаг — `/pf-close`.
- Скелет `findings.md` (specs-part2.md §6.7): `## Run Evidence` / `##
  Result vs. Success Criterion` / `## Conclusion` / `## Follow-up`.
  Бюджет: personal ≤80, infra/content ≤120, product ≤150 строк.

**Acceptance Criteria:**
- [x] TC-001 passes (частично)
- [x] TC-018 passes
- [ ] TC-028 — manual, per test_plan.md

---

#### Task 7: `/pf` — Step 0 (детект состояния папки), not-a-repo guard, разворот каркаса «сразу проект»

**Task Type:** code
**Mapped Test Cases:** TC-002, TC-003, TC-004

**Files:**
- `skills/pf/SKILL.md` - правка: новый «Step 0», правка «Step 2»,
  инлайновая git-строка в ветке «Идея» «Creating prompt.md»

**Implementation Notes:**
- **Step 0 (новый, перед сегодняшним Step 1) — specs-part1.md §3.1.1:**
  `has_pf := PLANNING.md существует ИЛИ docs/issues/ существует ИЛИ
  .pf-version существует`; `has_git := git rev-parse --is-inside-work-tree`
  успешен. Если `has_pf` ложно (независимо от `has_git`) — задать ровно
  один `AskUserQuestion`: «Над чем работаем: над идеей (которая может и не
  стать проектом) или сразу создаём проект?» с двумя вариантами (точный
  текст — specs-part1.md §3.1.1). Если `has_pf` истинно — обычный путь,
  Step 1 дальше без изменений.
- **Ветка «Идея» (AC-01b):** создаётся **только**
  `docs/issues/open/YYYYMMDD-idea-<slug>/prompt.md`, заполненный
  intake-батчем (Task 8, §3.1.3/§6.1 part1/2). Ничего больше — ни
  `PLANNING.md`, ни `docs/planning/*`, ни `.pf-version`, ни `git init`.
  После записи — переход к печати git-строки ниже (эта же ветка).
- **Ветка «Сразу проект» (AC-01c) — devять шагов, specs-part1.md §3.1.1:**
  1. `git init` — только если `has_git` ложно.
  2. Создать `docs/issues/{open,closed}/`, `docs/planning/`.
  3. Записать `.pf-version` = значению `version:` из шапки **самого
     `~/.claude/skills/pf/SKILL.md`** (только что прочитанного в Step 1),
     **не** `PF_VERSION` из `converge-to-v3.sh` (недоступен установленному
     скиллу) — два независимых источника, требующих ручной синхронизации
     (specs-part1.md §5.2; CONTRIBUTING.md-пункт — Task 15).
  4. Скопировать `~/.claude/skills/pf/templates/project/config/PLANNING.md`
     → `./PLANNING.md`, подставив `[Project Name]` → имя текущей директории.
  5. Создать/дополнить `CLAUDE.md` маркерным блоком `<!-- pf:begin -->…<!--
     pf:end -->`, тело из `.../templates/project/config/CLAUDE.md`.
  6. Скопировать `.../templates/project/global/*.md` → `docs/planning/*.md`,
     не переписывая существующее (в пустой папке — всегда «ещё не
     существует»).
  7. Зеркалировать `.../templates/project/` → `docs/planning/templates/`.
  8. Пропустить шаги «переустановить скиллы/shim» — `/pf` уже сам —
     установленный скилл.
  9. Продолжить как «tell me what you want to build or fix» — теперь
     трёхвариантный/четырёхвариантный вопрос (Task 8, §3.1.5), поскольку
     `docs/issues/open/` только что создана и пуста.
  Ошибка «`~/.claude/skills/pf/templates/project/` не существует»
  останавливает `/pf` с понятным сообщением («Обновите скиллы:
  `/pf-update`») — не безмолвный переход к частично развёрнутому проекту.
- **Not-a-repo guard (specs-part1.md §3.1.2), Step 2:** предваряющая
  строка — если `has_git` ложно (вычислено в Step 0, **пересчитывается
  каждый раз**, не кешируется), пропустить весь git-синк (git remote/
  fetch/branch/rev-list) целиком и перейти сразу к листингу
  `docs/issues/open/` — без этого пропуска команды падают кодом 128
  («fatal: not a git repository») до того, как пользователь вообще увидел
  вопрос «идея/проект», нарушая AC-01a.
- **Отсутствие `git` на PATH целиком (specs-part1.md §5.3):** отличить
  «git не установлен» (ошибка «command not found») от «not a repo» (код
  128) — при отсутствии самой команды остановиться с понятным сообщением,
  не пытаться продолжить каркас без git. Путь «идея» не требует `git`
  вовсе и этим краем не задет.
- **«Не закоммичено» для CREATE (AC-01d, specs-part1.md §3.1.4):** это
  единственная стадия, печатающая git-строку **инлайново**, не через
  `pf-git` (нечего стадировать/коммитить на CREATE-шаге) — дописать к
  обычному intake-отчёту ровно ту же формулировку, что `pf-git`'s Step 0
  печатает для остальных стадий (Task 10): *"Git: not committed — no git
  repository"* (переведено по `doc_language`), когда `has_git` ложно в
  момент завершения intake.

**Acceptance Criteria:**
- [x] TC-002 passes
- [ ] TC-003 — manual, per test_plan.md (частично — шаги 1-3 сценария)
- [x] TC-004 passes (частично — not-a-repo guard + CREATE-строка; полное прохождение требует Task 10)

---

#### Task 8: `/pf` — существующий проект без issue (4 варианта), определение TYPE, завершённые стадии, маршрутизация idea/spike, статус-блок, intake-ветки idea/spike

**Task Type:** code
**Mapped Test Cases:** TC-003, TC-005, TC-006, TC-007

**Files:**
- `skills/pf/SKILL.md` - правка: Step 3, Step 4, Step 5, Step 6, Step 7,
  «Creating prompt.md»

**Implementation Notes:**
- **Step 3 — «No issue folders found» → явный `AskUserQuestion` с четырьмя
  вариантами** (specs-part1.md §3.1.5): «Build a feature» (`feat`), «Fix a
  bug» (`bug`), «Describe an idea» (`idea`), «Run a technical spike»
  (`spike`). Свободный текст ("Other") остаётся, маршрутизируется
  эвристически как сегодня (в т.ч. в `improve`). Если свободный текст
  описывает технический эксперимент — **дополнительный** подтверждающий
  `AskUserQuestion` («Похоже на технический спайк — создать `spike`-issue
  вместо фичи?», Да/Нет) перед созданием issue. Выбор build/fix (или
  распознанный как таковой свободный текст) продолжает **сегодняшним,
  неизменным** путём «Creating prompt.md».
- **Step 4 — определение типа:** два новых варианта к существующим трём —
  `YYYYMMDD-idea-` → `idea`, `YYYYMMDD-spike-` → `spike`. Паттерн-фильтр
  Step 2 расширяется до TYPE ∈ {feat, improve, bug, idea, spike}.
- **Step 5 — таблица завершённых стадий:** шесть новых строк (specs-part1.md
  §3.1.7) — `idea.md`→IDEA, `research.md`→RESEARCH, `critique.md`→CRITIQUE,
  `verdict.md`→VERDICT (документ написан, **не** то же самое, что вердикт
  подтверждён), `hypothesis.md`→HYPOTHESIS, `findings.md`→FINDINGS. Тот же
  общий критерий «Stage completion» из `pf-size-tiers` (без изменений в
  самом критерии); третий конъюнкт («предыдущая стадия своего пайплайна
  тоже завершена») читает порядок стадий из `pf-idea-lenses` (Task 1) —
  единственный источник, не копия. `open_questions.md` **не появляется** в
  этой таблице ни в каком виде (specs-part1.md §5.6) — это сквозной
  журнал, не стадия.
- **Step 6 — новый абзац «idea/spike-пайплайн», перед существующими
  таблицами** (specs-part1.md §3.1.8): если TYPE — `idea`/`spike`,
  применяется **только** таблица стадий `pf-idea-lenses`'s «Stage tables»
  для этого типа, по тому же правилу первой незавершённой стадии и той же
  семантике маркеров `[pf-check PASSED]`/`[pf-check OPEN]` — не
  восстанавливается заново текстом. Feat/improve/bug/trivial-таблицы этого
  файла для `idea`/`spike` не применяются вообще. **Единственное
  исключение** из «маршрутизация только по существованию/маркерам»:
  различение «VERDICT (документ написан, check не пройден)» от «VERDICT +
  check passed, "## Decision" отсутствует» требует прочитать **содержимое**
  `verdict.md` (присутствует ли секция «## Decision»), не только факт
  существования файла/последний `[pf-check ...]`-маркер — реализация
  обязана предусмотреть это явно.
- **Step 7 — вывод:** статус-блок не меняется по форме. Для `verdict.md`,
  ожидающего decision session — `Next step` показывает не `/pf-idea-verdict`,
  а явно **`/pf-idea-verdict (decision session)`**.
- **«Creating prompt.md» — три ветки** (specs-part1.md §3.1.3, §6.1/§6.8
  part2):
  - `feat`/`improve`/`bug` — **без изменений**.
  - `idea` (НОВОЕ): `doc_language` переиспользуется тем же вопросом, что и
    сегодня (не дублируется); затем ≤2 `AskUserQuestion`-вызова по ≤4
    вопроса каждый (§6.1 part2: язык уже спрошен; `idea_tier`; текст идеи —
    введённая вручную **или извлечённая из названного пользователем
    файла** и показанная на подтверждение отдельным `AskUserQuestion`
    (Да, это то / Нет, дай переформулировать через "Other") — извлечение
    из файла **не регламентируется**, ассистент решает сам, как извлечь
    (BRD Non-Goals); свидетельства боли; ограничения; вне рамок; критерий
    «что убедит сказать project»; права ИИ на самостоятельные решения).
    **Развилка по carve-out:** голая папка без каркаса PF (сценарий
    AC-01b) — role assignment и `on_unavailable`-вопрос **не задаются
    вовсе**; `roles:`/`profile:`/`on_unavailable:` не пишутся в
    `prompt.md` этим шагом (резолв упадёт на level 5 `pf-roles`, пока
    пользователь не впишет `roles.<key>` вручную — level 1 всё ещё
    проверяется первым, Task 14). Существующий проект — role assignment
    (та же процедура `pf-roles` §10, kind-набор `idea`/`research`/
    `critique`/`verdict`) + `on_unavailable`, без изменений от общего
    случая. Записывается `type: idea`, `idea_tier`,
    `interaction: front-loaded` (константа) — точный YAML-скелет
    specs-part2.md §6.1.
  - `spike` (НОВОЕ) — та же развилка, вопросы §6.8 part2 (Question,
    Success Criterion, Time-box, Method, Constraints опц., Out of Scope
    опц., Decision Rights), роли для `hypothesis`/`findings`.
  - **Найденный файл идеи недоступен/бинарен/без текста (specs-part1.md
    §5.8):** не падать молча — сообщить об ошибке чтения, попросить ввести
    идею текстом напрямую, в рамках того же intake-вызова (переспрашивается
    только этот один вопрос).
- **`type:` vs. имя папки — конфликт есть ошибка (specs-part1.md §5.1):**
  каждая стадия, читающая `prompt.md`, сверяет `type:` с именем папки;
  расхождение — явная ошибка остановки, не тихий приоритет.

**Acceptance Criteria:**
- [ ] TC-003 — manual, per test_plan.md (частично — шаги 4-5 сценария)
- [x] TC-005 passes
- [x] TC-006 passes
- [x] TC-007 passes

---

#### Task 9: `pf-close` — TYPE, Phase 0 (idea/spike prerequisite checks), Phase 1 (skip для idea), Phase 3.5 (spike copy без merge), Phase 4.5 (skip)

**Task Type:** code
**Mapped Test Cases:** TC-017, TC-027, TC-032

**Files:**
- `skills/pf-close/SKILL.md` - правка

**Implementation Notes:**
- В начало файла, сразу после «Read ISSUE-ID from the active folder name»
  — добавить: извлечь TYPE из ISSUE-ID тем же способом, что `/pf`'s Step 4
  (Task 8); TYPE ∈ {feat, improve, bug, idea, spike} (specs-part2.md
  §7.3.1).
- **Phase 0, оба существующих пункта** (QA report exists / QA verdict
  PASS) получают оговорку «— только для feat/improve/bug; пропускается
  целиком для idea/spike (ни один из этих типов не производит
  `qa_report.md`)».
- **Пункт 3 («On correct branch») — условная ветка по TYPE**
  (specs-part2.md §7.3.1, таблица): feat/improve/bug — без изменений.
  `idea` — не проверяется вовсе (idea никогда не создаёт `issue/<id>`-ветку)
  — вместо этого новое условие: **«## Decision» присутствует в
  `verdict.md`** — если нет, стоп: *"Verdict not confirmed. Run
  /pf-idea-verdict (decision session) first."* (AC-07e). `spike` — не
  требует именно `issue/<id>` — допустима родительская ветка **или**
  `issue/<spike-id>`, если она существует.
- **Новый пункт 4 (spike only) — Run Evidence gate (AC-09c):**
  1. `hypothesis.md` и `findings.md` оба завершены по критерию
     `pf-size-tiers`; если нет — стоп *"Spike is not ready to close:
     <missing document>. Run /pf-idea-spike first."*
  2. `findings.md`'s «## Run Evidence» непуста **и не плейсхолдер**
     (`<конкретное свидетельство...>` из шаблона Task 6) — механическая
     проверка на чтение, повторяющая дисциплину записи задачи 6 п.4, но
     применённая к уже записанному файлу. Если пусто/плейсхолдер — стоп
     *"findings.md's Run Evidence is empty or a template placeholder —
     spike close requires evidence of an actual run. Fix findings.md (or
     re-run /pf-idea-spike Mode 2), then re-run /pf-close."*
  3. «## Result vs. Success Criterion» ссылается на конкретный пункт
     «## Run Evidence» (не пустая секция).
- **Новый пункт 5 — `has_git`.** Если ложно (единственный достижимый
  случай — bare-folder `idea`) — установить `NO-REPO` на весь остаток
  прогона, **если только Phase 4.6 (Task 11) не снимет его**.
- **`NO-REPO`-ветка (idea only):** Phase 2 («Pre-Close Cleanup»), Phase 3
  («Detect Parent Branch»), Phase 4/3.5 (merge/copy) **пропускаются
  целиком** — переход прямо к Phase 4.6 (Task 11).
- **Checkout PARENT-BRANCH для `idea` без `NO-REPO`:** Phase 3, сразу после
  определения PARENT-BRANCH — добавить `git checkout PARENT-BRANCH`
  (тот же чекаут, что Phase 4's шаг 1, без последующего `git merge` — idea
  не мерджит ничего).
- **Phase 1 — единственный человеческий гейт, не второй:** для `idea`
  **пропускается целиком** — подтверждённая «## Decision» уже и есть
  подтверждение закрытия. Для `spike` — **без изменений по смыслу**, но
  текст резюме меняется (см. ниже) — у spike нет отдельной decision
  session, Phase 1 и есть единственный финальный гейт (US-09e). Для
  feat/improve/bug — не меняется здесь (front-loaded-расширение — Task 20).
- **Новая Phase 3.5 (spike only, требует git) — между Phase 3 и Phase 4,
  заменяет Phase 4 целиком для `TYPE: spike`** (specs-part2.md §7.3.2):
  1. Если текущая ветка `issue/<spike-id>` — переключиться на
     PARENT-BRANCH, **без** `git merge`.
  2. Если ветка `issue/<spike-id>` существует — `git checkout
     issue/<spike-id> -- docs/issues/open/<spike-id>` (копирует только
     папку issue, staged-изменение, коммитится Phase 8).
  3. Если ветки нет — пропустить, документы уже на PARENT-BRANCH.
  4. Ветка `issue/<spike-id>` **не мерджится и не удаляется** ни здесь, ни
     нигде далее во всём `pf-close` — нигде не должно быть `git merge
     issue/<spike-id>` или `git branch -d issue/<spike-id>`.
  Phase 1's текст резюме для `TYPE: spike` меняется на «Copy
  docs/issues/open/ISSUE-ID/ from issue/ISSUE-ID to <parent-branch> — code
  stays on issue/ISSUE-ID, never merged or deleted».
- **Phase 4.5** получает предваряющую строку: «Skip this entire phase for
  `TYPE: idea` or `TYPE: spike` — neither type ever produces a
  `test_plan.md`; reading a non-existent Status Tracker would incorrectly
  trigger the 'no Status Tracker table found at all' stop-and-surface
  rule.» Без этого явного пропуска Phase 4.5 ошибочно блокирует каждое
  закрытие idea/spike-issue.

**Acceptance Criteria:**
- [x] TC-017 passes (частично — Phase 0/1/4.5; полное прохождение требует Task 11)
- [x] TC-027 passes (частично — обусловленность правок pf-close)
- [x] TC-032 passes

---

#### Task 10: `pf-git` — No-repository guard, семь новых строк в таблице staging

**Task Type:** code
**Mapped Test Cases:** TC-004

**Files:**
- `skills/pf-git/SKILL.md` - правка

**Implementation Notes:**
- **Новый раздел «## Step 0: No-repository guard», перед «## Step 1: Stage
  the artifact»** (specs-part2.md §7.4, дословный текст): перед любым
  действием проверить `has_git` (`git rev-parse --is-inside-work-tree`,
  тот же расчёт, что `/pf`'s Step 0 — Task 7). Если ложно — не выполнять
  Step 1/2/3 (stage/commit/push); вместо обычной строки Step 4 напечатать
  *"Git: not committed — no git repository"* (переведено по
  `doc_language`, если отличен от английского). Единая точка определения
  этого текста — на неё ссылаются все стадии (Task 7's CREATE-строка, Task
  9's `pf-close` NO-REPO-branch — используют идентичную формулировку по
  значению, не переопределяют текст заново).
- **«## Step 1: Stage the artifact», таблица — семь новых строк** (не
  шесть — `pf-idea-verdict` и `pf-idea-spike` несут по две строки каждый,
  разные режимы разные пути) — specs-part2.md §7.4, точная таблица:
  `/pf-idea` → `idea.md` (+ `open_questions.md`, если изменён); `/pf-idea-
  research` → `research.md` (+ `open_questions.md`); `/pf-idea-critique` →
  `critique.md` (+ `open_questions.md`); `/pf-idea-verdict` [режим 1] →
  `verdict.md` (+ `open_questions.md`); `/pf-idea-verdict` [режим 2] →
  `verdict.md`, `open_questions.md` (+ любые регенерированные документы);
  `/pf-idea-spike` [режим 1] → `hypothesis.md`; `/pf-idea-spike` [режим 2]
  → `findings.md` (+ код эксперимента, `-A` на этой стадии, если ветка
  создавалась — та же логика, что `/pf-execute`, «owns the code, not just
  the issue folder»). Каждая строка несёт стандартную «(+ `prompt.md`, if
  automigration ran this same invocation)».

**Acceptance Criteria:**
- [x] TC-004 passes

---

#### Task 11: `pf-close` — Phase 4.6 (bootstrap + follow-up issue до архивации), Phase 9 (autopilot schedule cleanup), NO-REPO таблица для Phase 5-9

**Task Type:** code
**Mapped Test Cases:** TC-017, TC-031

**Files:**
- `skills/pf-close/SKILL.md` - правка (продолжение Task 9)

**Implementation Notes:**
- **Новая Phase 4.6, между Phase 4.5 и Phase 5 — идёт ДО архивации**,
  только для `TYPE: idea` (specs-part2.md §7.3.4, порядок — намеренно
  инвертирован относительно первых черновиков спека, findings #2-5/#19):
  1. Прочитать вердикт из **`docs/issues/open/ISSUE-ID/verdict.md`'s
     «## Decision»** — issue ещё **не** перемещён в `closed/` на этом шаге.
  2. `defer`/`archive` — no-op целиком, перейти к Phase 5.
  3. `project`/`spike-first` — **обе ветки проходят один и тот же
     bootstrap** (не только `project` — finding #19):
     a. Вычислить **раздельно**: `has_git`; `has_full_scaffold :=
        PLANNING.md существует` (**не** `has_pf`'s дизъюнкция — та уже
        истинна для голой idea-папки просто из-за `docs/issues/open/`).
     b. `!has_git` → `git init`.
     c. `!has_full_scaffold` → развернуть каркас (та же процедура, что Task
        7's п.2/4-7, без шагов 8-9).
     d. **PARENT-BRANCH:** если Phase 3 уже вычислила его в этом прогоне
        (случай «idea в существующем проекте», `NO-REPO` не установлен) —
        то же значение, включая checkout (Task 9). Если Phase 3 была
        пропущена (bare-folder, `NO-REPO` установлен) — PARENT-BRANCH := 
        ветка сразу после `git init` в п.b (`git branch --show-current`),
        без обращения к develop/main-fallback Phase 3 (finding #5).
     e. **Атомарный «bootstrap PF scaffold» commit — только если п.b/c
        реально что-то сделали в этом прогоне** (идемпотентность):
        `git add PLANNING.md CLAUDE.md .pf-version docs/planning` (scoped,
        **не** `-A`, **не** `docs/issues/`) и `git commit -m "chore:
        bootstrap PF scaffold for ISSUE-ID (verdict: <verdict>)"`.
     f. Снять `NO-REPO`.
     g. Определить `<slug>` из `idea.md`'s заголовка/темы.
     h. **Идемпотентность recovery:** перед созданием follow-up — проверить,
        не существует ли уже под `open/` папка с `idea_ref: ISSUE-ID`
        (свидетельство прерванного предыдущего прогона) — если да,
        переиспользовать, не создавать вторую.
     i. **`project`:** создать `docs/issues/open/<YYYYMMDD>-feat-<slug>/
        prompt.md`, предзаполненный: `doc_language` унаследован напрямую;
        `roles`/`profile`/`on_unavailable`, если присутствуют в idea's
        `prompt.md`, копируются как есть; **`size_tier` выводится и
        записывается сразу** (не оставляется на legacy-tier guard) по
        таблице `idea_tier` × сигнал длительности из «Cost (Effort)»
        (specs-part2.md §7.3.4, точная таблица шести строк:
        personal→small; infra+«часы/день»→small, infra+«дни»→medium;
        content→small; product+«неделя или короче»→medium,
        product+«недели/месяц»→large) — обоснование логируется как
        `[assumed]` в **новом** `open_questions.md` этого feat-issue.
        Если сигнал длительности не распознан — `size_tier` **не**
        записывается, обычный legacy-tier guard спросит как для любого
        issue без tier (единственный случай, когда AC-08c допускает
        вопрос). `idea_ref: <idea-id>`; тело — компоновка из
        `idea.md`+`verdict.md`+исходного intake-текста. Отчёт: «Created
        follow-up issue: <feat-id> (idea_ref: <idea-id>). Next: /pf-brd.»
     j. **`spike-first`:** аналогично `docs/issues/open/<YYYYMMDD>-spike-
        <slug>/prompt.md`, `idea_ref`, поля Question/Success Criterion/
        Time-box/Method best-effort выведены из `verdict.md`'s Reasoning и
        `critique.md`'s Summary Table (диспозиция «Идея меняется» или
        нерешённые технические возражения) — неоднозначность резолвится
        рекомендацией, логируется `[assumed]` в новом `open_questions.md`.
        Этот spike теперь **всегда** git-backed. Отчёт: «Created follow-up
        issue: <spike-id> (idea_ref: <idea-id>). Next: /pf-idea-spike.»
  4. Перейти к Phase 5.
  **Recovery:** прерванный прогон оставляет две папки под `open/` —
  холодный повторный `/pf-close` не выбирает молча первую при нескольких
  кандидатах; предпочитает папку с подтверждающим маркером закрытия
  (`## Decision` для idea); follow-up-папка отличима по `idea_ref`,
  указывающему на ISSUE-ID, чья папка ещё в `open/`.
- **NO-REPO guard в закрытии — таблица по Phase (specs-part2.md §7.3.5),
  применима только к исходу `defer`/`archive` в изначально голой не-git
  папке (единственный случай, где `NO-REPO` доживает до Phase 5):**
  Phase 5 — без изменений (mv, не git-операция). Phase 6 — без
  структурных изменений (уже штатно ловит пустой `git log`). Phase 7 —
  оговорка: если `NO-REPO`, `docs/planning/session-log.md` не существует
  — пропустить целиком, отметить в Phase 9 «session-log.md not updated —
  no PF scaffold exists in this folder», **не создавать** `docs/planning/`
  ради одной строки. Phase 8 — если `NO-REPO`, пропустить `git add`/
  `git commit`, отчитаться «not committed — no git repository». Phase
  8.5 — пропускается тем же guard'ом, что и «no remote configured». Phase
  9 — отчёт заменяет обычный git-блок одной строкой «Not committed — no
  git repository. Issue folder archived on disk only:
  docs/issues/closed/ISSUE-ID/.»
- **Phase 9 — autopilot schedule cleanup (specs-part2.md §7.3.6), только
  для `TYPE: idea`/`spike`, выполняется ДО печати отчёта:** проверить
  `CronList` на существование `pf-autopilot-<project>`; если есть —
  `CronDelete` + строка отчёта «Autopilot schedule removed»; если нет —
  ничего дополнительного (общий случай для issue, никогда не гнанного
  автопилотом).

**Acceptance Criteria:**
- [ ] TC-017 passes
- [ ] TC-031 passes

---

#### Task 12: `pf-autopilot` — пять новых скиллов, остановка перед единственным гейтом, отчёт с допущениями

**Task Type:** code
**Mapped Test Cases:** TC-023

**Files:**
- `skills/pf-autopilot/SKILL.md` - правка

**Implementation Notes:**
- **«## Step 2. Work loop», п.1** (specs-part2.md §7.5): список скиллов
  расширяется до включения `/pf-idea`, `/pf-idea-research`,
  `/pf-idea-critique`, `/pf-idea-verdict`, `/pf-idea-spike`.
- **Новый пункт 7 в конце «## Step 2. Work loop»** — дословная формулировка
  из спека: «Stop before the final human gate, never apply the 3-attempts
  rule to it — for both new types». Когда pinned issue — `idea`-type и
  next step `/pf-idea-verdict (decision session)`, **ИЛИ** pinned issue —
  `spike`-type и next step `/pf-close` (у spike нет отдельной decision
  session — `pf-close`'s Phase 1 confirmation и есть единственный
  человеческий гейт, US-09e) — остановить work loop там вместо вызова
  следующего шага. Печатать финальный отчёт немедленно; **не** удалять
  schedule здесь — удаление теперь job `/pf-close`'s Phase 9 (Task 11), не
  этого шага, чтобы человек, завершивший закрытие вручную (без повторного
  запуска автопилота), всё равно получил очищенный schedule.
- **«## Step 3. Completion», финальный отчёт** — для idea/spike-issue,
  остановленного перед финальным гейтом: дополнительно перечислить полный
  список `[assumed]`-строк и открытых вопросов из `open_questions.md`
  (US-10c дословно).
- **«## Step 3. Completion», п.1 (`CronDelete`)** получает оговорку: для
  `TYPE: idea`/`spike` эта удаление обычно уже выполнено `pf-close`'s
  Phase 9 (Task 11) к моменту, когда этот шаг выполнился бы для закрывающего
  вызова — собственный `CronDelete` этого пункта поэтому обычно no-op
  (идемпотентно), не дублирующая попытка; остаётся основным путём удаления
  для feat/improve/bug (их `pf-close` не несёт добавку Phase 9).

**Acceptance Criteria:**
- [x] TC-023 passes

---

#### Task 13: `pf-check` — TYPE до `size_tier`, TARGET-таблицы, `open_questions.md` как контекст

**Task Type:** code
**Mapped Test Cases:** TC-016, TC-021, TC-033

**Files:**
- `skills/pf-check/SKILL.md` - правка

**Implementation Notes:**
- **Opening `size_tier` guard — структурная правка, не текстовая**
  (specs-part2.md §7.2). Сегодняшний первый абзац файла («Before checking
  any other prerequisite, read `prompt.md`'s frontmatter. If it has no
  `size_tier` field, ask the user...») выполняется до определения
  TARGET/TYPE и безусловно — в отличие от `pf-brd`/`pf-spec`/… (их guard
  физически недостижим для idea/spike, эти скиллы для них не вызываются
  вовсе), `pf-check` **вызывается** на документах idea/spike (US-11d), guard
  достигается и без правки задал бы запрещённый вопрос посреди
  front-loaded пайплайна. Правка: предваряющее условие — *"First, determine
  TYPE from the active issue's folder-name prefix (the same way
  `~/.claude/skills/pf/SKILL.md` Step 4 does). If TYPE is `idea` or `spike`,
  skip this entire `size_tier` paragraph... Only for any other TYPE does
  the rest of this paragraph apply, unchanged."* Порядок условий в тексте
  файла критичен — TYPE-условие обязано **физически предшествовать**
  абзацу про `size_tier` (проверяется drift guard'ом Task 17, TC-033).
- **Вводный абзац «предшественники по TARGET» — шесть новых строк**
  (specs-part2.md §7.2): `idea.md`→нет; `research.md`→`idea.md`;
  `critique.md`→`idea.md`,`research.md`; `verdict.md`→`idea.md`,
  `research.md`,`critique.md`; `hypothesis.md`→нет; `findings.md`→
  `hypothesis.md`.
- **Отдельное предложение — `open_questions.md` как context, не
  предшественник** (finding #29): для каждого TARGET из этого набора,
  также прочитать `prompt.md`'s intake body (не только `size_tier`/
  `idea_tier` фронтматтер) как обязательный контекст. Для `critique.md`,
  `verdict.md`, `findings.md` — также прочитать `open_questions.md`, если
  существует (без него ревьюер не может проверить AC-05d/AC-06c/AC-07b).
  Это предложение синтаксически **отделено** от списка предшественников
  выше — `open_questions.md` не участвует в конъюнкте 3 критерия
  завершённости (specs-part1.md §5.6).
- **«## Reviewer selection», таблица TARGET→key — шесть новых строк:**
  `idea.md`→`idea`; `research.md`→`research`; `critique.md`→`critique`;
  `verdict.md`→`verdict`; `hypothesis.md`→`hypothesis`;
  `findings.md`→`findings`.
- **«### Claude review path», условная ветка перед брифинг-цитатой:** если
  TARGET — один из шести idea/spike-документов, читать `idea_tier` вместо
  `size_tier` и сравнивать объём с бюджетной таблицей `pf-idea-lenses`'s
  §6.10 (Task 1) — **не** с таблицей `pf-size-tiers`. P0-формулировка при
  превышении идентична сегодняшней с заменой «size_tier» на «idea_tier».
  Это же условие покрывает «Codex invocation chain»'s document-form бриф —
  ссылается на тот же текстовый шаблон, правка одного места покрывает обе
  ветки без дублирования.

**Acceptance Criteria:**
- [x] TC-016 passes (частично — pf-check-часть; Task 1 несёт таблицу бюджетов)
- [x] TC-021 passes
- [x] TC-033 passes (drift-guard часть — фикстура и транскрипция в Task 18)

---

#### Task 14: `pf-brd` (idea_ref hook), `pf-roles` (шесть ключей + carve-out), `pf-size-tiers` (Pipelines-ссылки)

**Task Type:** code
**Mapped Test Cases:** TC-022, TC-024, TC-027

**Files:**
- `skills/pf-brd/SKILL.md` - правка
- `skills/pf-roles/SKILL.md` - правка
- `skills/pf-size-tiers/SKILL.md` - правка

**Implementation Notes:**
- **`pf-brd` — `idea_ref` hook** (specs-part2.md §7.7), новый абзац сразу
  после «Read `docs/issues/open/[ISSUE-ID]/prompt.md`...» и **перед**
  output-гейтом: если `prompt.md`'s фронтматтер несёт `idea_ref:
  <closed-idea-id>`, дополнительно прочитать
  `docs/issues/closed/<closed-idea-id>/{idea.md,verdict.md}` и оригинальный
  intake `prompt.md`. Каждое уже отвеченное поле (боль, свидетельства,
  MVP, ограничения, вне рамок, отличие) **не** переспрашивается в цикле
  уточняющих вопросов — только genuine gaps (US-08b дословно). Явно
  упомянуть, что `doc_language`/`size_tier`/`roles`/`profile`/
  `on_unavailable` **обычно уже присутствуют** к моменту, когда `pf-brd`
  их читает, благодаря `pf-close`'s Phase 4.6 (Task 11) — не спрашиваются
  заново; если `size_tier` всё же отсутствует (Phase 4.6's таблица не
  нашла распознаваемого сигнала длительности), обычный legacy-tier guard
  спрашивает как для любого issue без tier — единственный случай, где
  AC-08c допускает вопрос. Это единственная правка `pf-brd/SKILL.md`, не
  считая front-loaded hook'а (Task 20).
- **`pf-roles` — «Known stage keys»** дополняется шестью ключами:
  `idea`, `research`, `critique`, `verdict` (idea-type only), `hypothesis`,
  `findings` (spike-type only) — все резолвятся тем же алгоритмом §4, не
  спец-случай (specs-part2.md §7.12). Алгоритм §4/§10/§11 сам по себе не
  меняется структурно.
- **Carve-out для голой `idea`/`spike`-папки (§7.12.1 part2):** оба
  раздела «### Auto-creation» (`agents.yml`, `role-profiles.yml`) получают
  одинаковую оговорку — *«Exception — bare `idea`/`spike` folder. Skip
  auto-creation entirely... when TYPE is `idea`/`spike` and the project has
  no PF scaffold at all... Level 1 (explicit `roles.<key>`/`profile:`
  literally present in this issue's own `prompt.md`) is still checked
  first, exactly as always»* — тест ищет буквально «level 1» рядом с
  carve-out'ом, не только «level 5 unreachable» (finding #18, TC-024
  step 3). «## 4. Resolving a stage's role...», level 5 получает уточнение:
  level 1 проверяется как обычно, только levels 2-4 недостижимы (требуют
  резолвнутого `role-profiles.yml`, которого в bare-папке нет по
  построению) — level 5 достигается всегда, когда level 1 не совпал, не
  безусловно. **Именование третьей формы диспетчеризации персон критики
  (§7.12.2) — `pf-roles/SKILL.md` этим пунктом НЕ редактируется** —
  обоснование целиком в `pf-idea-critique` (Task 4); здесь только
  зафиксировано, что фикс не сюда.
- **`pf-size-tiers` — «### Pipelines», две новые строки, ссылающиеся, не
  копирующие** (specs-part2.md §7.11, finding #30): `idea` (по типу issue,
  не `size_tier`) → «See `~/.claude/skills/pf-idea-lenses/SKILL.md`'s
  "Stage tables" (the `idea` table) — read live from there, not copied
  here.»; `spike` → та же ссылка на spike-таблицу. Предваряющая оговорка:
  эти два pipeline keyed на TYPE (папка-префикс), не на `size_tier` —
  idea/spike никогда не несут `size_tier` вовсе. Тест проверяет наличие
  подстроки `pf-idea-lenses` в каждой из этих строк, **не** совпадение
  списка документов (TC-027 step 3). **«### Scope», первый пункт** —
  дополняется шестью именами документов (`idea.md`…`findings.md`);
  оговорка сразу после: `open_questions.md` намеренно исключён из этого
  списка — сквозной журнал, не документ стадии.

**Acceptance Criteria:**
- [x] TC-022 passes
- [x] TC-024 passes
- [x] TC-027 passes (частично — эта задача покрывает pf-brd/pf-roles/pf-size-tiers; полная обусловленность проверяется Task 17 по всем шести изменённым общим скиллам)

---

#### Task 15: Зеркало каркаса `skills/pf/templates/project/`, `converge-to-v3.sh`, `CONTRIBUTING.md`

**Task Type:** code
**Mapped Test Cases:** TC-025, TC-026

**Files:**
- `skills/pf/templates/project/` - новая директория (побайтовое зеркало)
- `scripts/converge-to-v3.sh` - правка
- `CONTRIBUTING.md` - правка

**Implementation Notes:**
- **`skills/pf/templates/project/`** — точная побайтовая копия
  `docs/planning/templates/` (`config/{PLANNING.md,CLAUDE.md}`,
  `global/{session-log,decisions,implementation-plan,test-plan}.md`,
  `issue/*.md`) — specs-part1.md §1.1(C): `docs/planning/templates/`
  остаётся единственным вручную редактируемым источником, эта новая
  директория — производная копия, синхронизируемая вручную. Копируется в
  `~/.claude/skills/pf/templates/project/` тем же механизмом, что уже
  копирует `skills/pf-test/templates/` (`install.sh`/`update-skills.sh`/
  `converge-to-v3.sh`'s T7 копируют `skills/<name>/.` целиком, без списка
  файлов) — **правки этих трёх скриптов не требуются**, проверить это
  явно (не предполагать).
- **`scripts/converge-to-v3.sh`, `required_docs()`** — новая `case`-ветка
  до сегодняшней `*)` (specs-part2.md §7.9): `idea)` → `idea.md
  research.md critique.md verdict.md`; `spike)` → `hypothesis.md
  findings.md`. Без этой правки конвергенция на проекте с открытым idea/
  spike-issue ошибочно требует `test_plan.md`/`implementation_plan.md`
  (реальный дефект, найденный при подготовке спека).
- **`skill_for_doc()`** — новые ветки: `idea.md`→`/pf-idea`;
  `research.md`→`/pf-idea-research`; `critique.md`→`/pf-idea-critique`;
  `verdict.md`→`/pf-idea-verdict`; `hypothesis.md`→`/pf-idea-spike`;
  `findings.md`→`/pf-idea-spike`. `TEMPLATES_SRC` (строка ~46) — **без
  изменений**.
- **`CONTRIBUTING.md`** — пункт 6 существующего чек-листа синхронизации
  версии дополняется: `skills/pf/SKILL.md`'s `version:` field (второй
  источник `.pf-version` для проектов, развёрнутых `/pf` напрямую —
  specs-part1.md §5.2) добавляется к списку файлов; новое правило: «Любая
  правка `docs/planning/templates/` обязана быть отражена побайтово в
  `skills/pf/templates/project/` (и наоборот) — проверяется
  `test/pf-idea-templates-mirror.sh`» (Task 18).

**Acceptance Criteria:**
- [ ] TC-025 passes
- [ ] TC-026 passes (частично — зеркало и converge-ветки; счётчики документации проверяются Task 16)

---

#### Task 16: Счётчик скиллов и документация фреймворка (`pf-help`, `pf-update`, `CLAUDE.md`, `README.md`, `FRAMEWORK.md`, `QUICKSTART.md`, `tutorial.js`)

**Task Type:** code
**Mapped Test Cases:** TC-006, TC-026

**Files:**
- `skills/pf-help/SKILL.md` - правка
- `skills/pf-update/SKILL.md` - правка
- `CLAUDE.md` - правка
- `README.md` - правка
- `docs/planning/FRAMEWORK.md` - правка
- `docs/planning/QUICKSTART.md` - правка
- `tools/onboarding-tui/lib/tutorial.js` - правка

**Implementation Notes:**
- **Это задача обязана быть выполнена до Task 19 (чекпоинт `make test`)** —
  как только Task 1 создаёт первые новые директории скиллов,
  `test/docs-refs.sh`'s `N_SKILLS` (вычисляется динамически через `find
  skills -mindepth 1 -maxdepth 1 -type d`) становится 28, и
  `assert_lists_every_skill`/счётчик-проверки начинают падать, пока эти
  файлы не обновлены (это самозащитное свойство теста, не дефект).
- **`pf-help/SKILL.md`** (specs-part2.md §7.6): новый абзац после «##
  Workflow by issue type», перед «## Skills» — два блока по образцу
  существующих трёх (feat/improve/bug): `**Idea** (idea)` — «Intake → Idea
  → ✓ Check → Research → Critique → Verdict → ✓ Check → Decision session →
  Close»; `**Spike** (spike)` — «Intake → Hypothesis → Findings → Close»;
  плюс завершающая строка «Don't know where to start? Just run `/pf` in an
  empty folder...». Таблица «## Skills» — **пять** новых строк (только
  пишущие: `pf-idea`, `pf-idea-research`, `pf-idea-critique`,
  `pf-idea-verdict`, `pf-idea-spike`) — **не** `pf-idea-lenses`/
  `pf-interaction` (справочные скиллы того же класса, что `pf-size-tiers`/
  `pf-git`/`pf-roles`, тоже не перечисленные в этой пользовательской
  таблице). Таблица «## Issue folder contents» — две новые строки (`idea`,
  `spike`) с их документами. **`pf-help/SKILL.md` не входит в список
  файлов, которые `test/docs-refs.sh`'s TC-040 проверяет на упоминание
  каждого скилла** — правка не обязана перечислять все 28 имён.
- **`skills/pf-update/SKILL.md`** (specs-part2.md §7.8): «## Managed
  Skills» — семь новых пунктов (пять пишущих + два справочных, точные
  описания specs-part2.md §7.8). Вводное «All 21 skills:» → «All 28
  skills:».
- **Пять framework-документов** (specs-part2.md §7.10, точная таблица):
  `CLAUDE.md` — «21 Claude Code skills» → «28 Claude Code skills» (обе
  строки, 16 и 36); список из 21 имени → список из 28. `README.md` —
  «21 Claude Code skills» (строка 21) → «28»; «## Skills»-таблица + семь
  строк. **Версионная запись «3.0.0 release — 7 Claude Code skills» (строка
  ~319/437, `test/docs-refs.sh` TC-040 step 6) НЕ трогается** — это
  исторический release-note, тест явно проверяет, что она осталась
  нетронутой. `docs/planning/FRAMEWORK.md` — «21 Claude Code skills»
  (строка 380) → «28»; список имён + семь. `docs/planning/QUICKSTART.md` —
  список имён + семь новых (счётчик там же по тому же шаблону, что
  требует `grep -q "$N_SKILLS skills"`). `tools/onboarding-tui/lib/
  tutorial.js` — «Screen 3/4» список + семь строк; «That is all 21 of
  them.» → «That is all 28 of them.»
- **`PLANNING.md` — БЕЗ ИЗМЕНЕНИЙ** (проверено грепом при подготовке
  спека — файл не содержит ни счётчика скиллов, ни их поимённого списка;
  пайплайн-диаграммы idea/spike туда сознательно не добавляются — decision
  (A), справочные таблицы стадий живут в `pf-idea-lenses`).

**Acceptance Criteria:**
- [ ] TC-006 passes (частично — pf-help-часть)
- [ ] TC-026 passes (частично — счётчики/имена; зеркало проверяется Task 15/18)

---

#### Task 17: `test/pf-idea-stage-static.sh` — статические структурные проверки (§8.1)

**Task Type:** tests
**Mapped Test Cases:** TC-001, TC-002, TC-004, TC-005, TC-006, TC-007,
TC-008, TC-009, TC-010, TC-011, TC-013, TC-015, TC-016, TC-017, TC-018,
TC-019, TC-021, TC-022, TC-023, TC-024, TC-025, TC-026, TC-027

**Files:**
- `test/pf-idea-stage-static.sh` - новый

**Implementation Notes:**
- Стиль — read-only, grep-based, без обращения к `~/.claude/skills`, без
  запуска реального `/pf` (тот же паттерн, что `test/skills-static.sh`/
  `test/skills-role-matrix-static.sh` — specs-part3.md §8, преамбула).
  Источник `test/lib.sh` (`pf_pass`/`pf_fail`/`pf_assert`/`pf_note`/
  `pf_summary`).
- Каждая проверка печатает `pf_pass "TC-0NN: <краткое имя>"` /
  `pf_fail "TC-0NN: ..."` — этот литерал и есть label, по которому
  `/pf-test` находит TC-ID (marker-конвенция test_plan.md, «Marker-
  конвенция для Auto TC»). Файловый заголовок-маркер `# @pf-issue
  20260902-feat-idea-stage` в первых ~10 строках.
- **Пункт 1 (§8.1, TC-001) — собственный цикл, не переиспользование**
  (finding #26 — `test/skills-static.sh` не содержит общего frontmatter-
  валидатора по `skills/*/`): цикл по семи новым директориям, `grep -q
  '^name:'`/`'^description:'`/`'^version:'` — точный shell-фрагмент дан в
  specs-part3.md §8.1 п.1.
- **Пункты 2-16 (§8.1)** — по одной проверке на каждый пункт списка
  specs-part3.md §8.1: `pf/SKILL.md` (TC-002, TC-004 частично, TC-005,
  TC-006, TC-007), `skills/pf/templates/project/` существует и не пуста
  (TC-026 частично — побайтовое сравнение отдельно, Task 18), `pf-check/
  SKILL.md` (TC-016, TC-021), `pf-close/SKILL.md` (TC-017), `pf-git/
  SKILL.md` (TC-004), `pf-autopilot/SKILL.md` (TC-023), `pf-help/SKILL.md`
  (TC-006), `pf-brd/SKILL.md` (TC-022), `pf-update/SKILL.md` (TC-026),
  `pf-size-tiers/SKILL.md` (TC-016, TC-027), `pf-roles/SKILL.md` (TC-024),
  `converge-to-v3.sh` (TC-025), `pf-idea-lenses/SKILL.md` (TC-013,
  TC-015), `pf-interaction/SKILL.md` (TC-008, TC-019).
- Отдельные проверки для скелетов документов (specs-part2.md §6.2-§6.7,
  реализованных в Task 2-6): `idea.md`'s семь секций (TC-009),
  `research.md`'s Status/Source-инвариант (TC-010), `critique.md`'s
  Disposition-словарь (TC-011), `verdict.md`'s Режим-1-скелет без
  «## Decision» (TC-013), `hypothesis.md`/`findings.md`'s секции + гейт
  (TC-018).
- Единственный источник порядка стадий (TC-027) — `pf-size-tiers`'s две
  новые строки содержат подстроку `pf-idea-lenses`, не копию списка
  документов.

**Acceptance Criteria:**
- [ ] TC-001 passes
- [ ] TC-002 passes
- [ ] TC-004 passes
- [ ] TC-005 passes
- [ ] TC-006 passes
- [ ] TC-007 passes
- [ ] TC-008 passes
- [ ] TC-009 passes
- [ ] TC-010 passes
- [ ] TC-011 passes
- [ ] TC-013 passes
- [ ] TC-015 passes
- [ ] TC-016 passes
- [ ] TC-017 passes
- [ ] TC-018 passes
- [ ] TC-019 passes
- [ ] TC-021 passes
- [ ] TC-022 passes
- [ ] TC-023 passes
- [ ] TC-024 passes
- [ ] TC-025 passes
- [ ] TC-026 passes
- [ ] TC-027 passes

---

#### Task 18: Фикстуры и поведенческие тесты (§8.1a) + `test/pf-idea-templates-mirror.sh`

**Task Type:** tests
**Mapped Test Cases:** TC-026, TC-030, TC-031, TC-032, TC-033

**Files:**
- `test/fixtures/idea-verdict-project-bare/` - новая фикстура (+ вариант
  `## Decision: spike-first`)
- `test/fixtures/idea-verdict-project-existing/` - новая фикстура
- `test/fixtures/spike-close-branch/` - новая фикстура
- `test/fixtures/spike-close-no-evidence/` - новая фикстура
- `test/fixtures/idea-no-size-tier/` - новая фикстура
- `test/pf-idea-stage-static.sh` - правка (продолжение Task 17 — добавляет
  §8.1a)
- `test/pf-idea-templates-mirror.sh` - новый

**Implementation Notes:**
- **§8.1a — throwaway-репозиторий через `pf_setup_case <fixture> --git`,
  bash-транскрипция проверяемой логики, assert на реальный результат** (не
  только текст скилла — specs-part3.md §8.1a, finding #27: статические
  grep-проверки Task 17 — drift guards, не доказательство корректности
  исполняемого поведения). Пять сценариев, каждый — по образцу
  `test/pf-close.sh`/`test/converge-fresh.sh`:
  1. **Bare-folder idea создаёт только папку issue (TC-030):** fixture
     `test/fixtures/no-pf-bare` (существует, переиспользуется). `pf_setup_case
     no-pf-bare` (без `--git`); транскрибировать ветку «Идея» (Task 7);
     `find . -mindepth 1` после — ровно исходные файлы фикстуры + новый
     `prompt.md`, ни `PLANNING.md`, ни `.git`.
  2. **`project`/`spike-first` — bootstrap+init+follow-up в правильном
     порядке, до архивации; вывод `size_tier`; PARENT-BRANCH для существующего
     проекта (TC-031):** новые фикстуры `idea-verdict-project-bare`
     (`verdict.md`'s «## Decision: project»; `idea.md` с `idea_tier:
     product` и «Cost (Effort)» = «около недели» → `size_tier: medium`) и
     её `spike-first`-вариант; `idea-verdict-project-existing` (idea внутри
     уже развёрнутого PF-проекта, PARENT-BRANCH уже вычислен Phase 3).
     Транскрибировать Phase 4.6 (Task 11) в этом порядке: `git init` →
     каркас → scoped commit (без `docs/issues/`-путей) → follow-up-папка
     под `open/` **до** Phase 5's `mv`. Проверить: `size_tier` follow-up
     `prompt.md` совпадает с таблицей; `open_questions.md` follow-up несёт
     `[assumed]`-обоснование; после полного прогона `git status
     --porcelain` пуст; для `-existing` — п.b/c bootstrap-шаги no-op
     (`has_full_scaffold` уже истинно), PARENT-BRANCH берётся из значения
     Phase 3, не нового `git init`.
  3. **Spike close — гейт пустого Run Evidence, ветка без merge (TC-032):**
     фикстура `spike-close-no-evidence` (Run Evidence — плейсхолдер) —
     транскрибировать Phase 0 п.4 (Task 9); ожидать остановку, называющую
     «Run Evidence», и **отсутствие** `mv`/commit. Фикстура
     `spike-close-branch` (ветка `issue/<spike-id>` с кодом и заполненным
     `findings.md`) — транскрибировать Phase 3.5 (Task 9); `issue/<spike-id>`
     существует после закрытия, `git log --merges` не содержит её
     merge-коммита, `docs/issues/closed/<spike-id>/` на PARENT-BRANCH.
  4. **`pf-check` никогда не спрашивает `size_tier` для idea/spike
     (TC-033):** фикстура `idea-no-size-tier` (`idea_tier`, без
     `size_tier`) — транскрибировать opening guard (Task 13) как bash-
     функцию с условиями в фиксированном порядке (TYPE-определение →
     skip-если-idea/spike → «нет size_tier → спросить»); проверить, что
     выполнение останавливается на TYPE-условии, не доходя до
     size_tier-вопроса; сверить исходный текст `pf-check/SKILL.md` —
     TYPE-условие физически предшествует `size_tier`-абзацу (тот же
     drift-guard принцип, что `test/pf-close.sh`'s TC-005).
- **`test/pf-idea-templates-mirror.sh` (§8.3, TC-026 частично):**
  ```sh
  diff -r "$REPO_ROOT/docs/planning/templates" \
          "$REPO_ROOT/skills/pf/templates/project"
  ```
  `pf_pass`/`pf_fail` по результату — тот же паттерн, что `test/lib.sh`
  уже использует для T6-зеркала конвергенции. Единственный тест,
  напрямую проверяющий decision (C) из specs-part1.md §1.1.

**Acceptance Criteria:**
- [ ] TC-026 passes
- [ ] TC-030 passes
- [ ] TC-031 passes
- [ ] TC-032 passes
- [ ] TC-033 passes

---

#### Task 19: Чекпоинт Phase A — `make test` зелёный

**Task Type:** tests
**Mapped Test Cases:** —

**Files:** нет (верификационная задача, без изменений кода/тестов)

**Implementation Notes:**
- Прогнать `make test` на текущем состоянии дерева (Tasks 1-18
  завершены). Ожидаемый результат — весь существующий набор (`test/
  converge-*.sh`, `test/pf-close.sh`, `test/skills-static.sh`, `test/
  skills-role-matrix-static.sh`, `test/docs-refs.sh` и т.д.) остаётся
  зелёным без изменений в их коде (G7/AC-12a — ни одна правка Tasks 1-18
  не заменяет существующую безусловную ветку, только добавляет
  обусловленные), и три новых файла (`test/pf-idea-stage-static.sh`,
  `test/pf-idea-templates-mirror.sh`) тоже зелёные (`test/pf-idea-front-
  loaded-static.sh` ещё не существует на этом чекпоинте — Task 22).
- Если `test/docs-refs.sh` красный — вернуться к Task 16 (счётчики/списки
  скиллов), не к тесту: это самозащитное свойство теста, а не дефект в
  нём (Dependencies, п.6 выше).
- Если любой существующий тест (`converge-*`, `pf-close.sh`,
  `skills-static.sh` и т.д.) стал красным — это регрессия правки в общем
  скилле, нарушающая G7; остановиться и исправить соответствующую задачу
  (Task 7-14) до продолжения.
- Это ровно та точка, где по Phased Rollout подтверждается: **idea/spike
  работают end-to-end, поведение feat/improve/bug не изменилось** (Phase A
  завершена).

**Acceptance Criteria:**
- [ ] `make test` завершается с кодом 0, весь существующий и три новых
      файла зелёные

---

#### Task 20: Front-loaded hook-сайты — 12 скиллов (механическая вставка канонического hook-текста)

**Task Type:** code
**Mapped Test Cases:** TC-020

**Files:**
- `skills/pf-brd/SKILL.md` - правка
- `skills/pf-spec/SKILL.md` - правка
- `skills/pf-test-plan/SKILL.md` - правка
- `skills/pf-impl-plan/SKILL.md` - правка
- `skills/pf-execute/SKILL.md` - правка
- `skills/pf-check/SKILL.md` - правка
- `skills/pf-user-docs/SKILL.md` - правка
- `skills/pf-dev-docs/SKILL.md` - правка
- `skills/pf-codereview/SKILL.md` - правка
- `skills/pf-qa/SKILL.md` - правка
- `skills/pf-test/SKILL.md` - правка
- `skills/pf/SKILL.md` - правка (оставшиеся hook-сайты, не Task 7/8)

**Implementation Notes:**
- **Канонический текст hook'а** (вставляется дословно везде, где сказано
  «hook» ниже, переводя по `doc_language`): *«Front-loaded check: if
  `prompt.md`'s `interaction` field resolves to `front-loaded`
  (`~/.claude/skills/pf-interaction/SKILL.md`, "Front-loaded rule"), apply
  that rule instead of asking this question interactively.»*
  (specs-part2.md §7.13, преамбула).
- **Точная таблица (скилл, секция) → hook/исключение — specs-part2.md
  §7.13, полная таблица, применяется дословно; повторяю сайты, не покрытые
  Task 21:**
  - `pf-brd`: Legacy-tier guard; Reviewer-assignment guard; Output gate
    (regenerate/keep/cancel — резолюция: допущение согласно тексту гейта);
    «## If `size_tier: trivial`» (цикл целиком пропускается); «## If
    `size_tier` is small/medium/large» (то же); Post-save tier
    reconfirmation (допущение «согласиться с записанным tier», расхождение
    → `[assumed]`, tier молча не меняется).
  - `pf-spec`: Legacy-tier guard (вводный абзац, без заголовка); Output
    gate; основной Q&A-цикл (пропускается целиком).
  - `pf-test-plan`: Legacy-tier guard; Output gate; Manual-budget-exceeded
    вопрос после Step 4c (резолюция: первая из трёх опций).
  - `pf-impl-plan`: Legacy-tier guard; Output gate.
  - `pf-execute`: Legacy-tier guard (вводный абзац).
  - `pf-check`: Legacy-tier guard (вводный абзац — **отдельно** от
    структурной TYPE-first правки Task 13, это front-loaded hook, не
    idea/spike-условие); «### Codex invocation chain» шаг 1/2a
    (**условно hook** — см. ниже); шаг 3 (тот же статус); «How would you
    like to proceed?» review gate — **не новый hook**, переиспользует
    существующий «Autopilot mode» неинтерактивный путь, помечая запись
    `[assumed]` вместо `[autopilot default]`; fix-сабагент's собственный
    `AskUserQuestion` — hook (инструкция сабагенту не спрашивать, брать
    разумный вариант, фиксировать допущение в summary).
  - `pf-user-docs`, `pf-dev-docs`: основной Q&A-цикл — hook.
  - `pf-codereview`: `code.review: skip` confirmation — **исключение**
    (диапазон **не** должен содержать hook-ссылку, всегда спрашивается);
    Review-gate после Phase 3 — **не новый hook**, переиспользует
    собственный autopilot-режим, если есть, иначе идентично `pf-check`'s
    Autopilot mode; fix-сабагент — hook.
  - `pf-qa`: «These items require human confirmation» (ручные QA-пункты,
    plain-text, не литеральный `AskUserQuestion`) — **hook, обобщённый на
    не-`AskUserQuestion` формы**: front-loaded правило распространяется на
    «любую точку, где стадия иначе ждала бы ответа человека», не только
    буквальные вызовы инструмента. Резолюция — допущение PASS без
    противопоказаний, с явным `[assumed]` на каждый такой пункт (пункт
    остаётся видимым в `qa_report.md` как assumed-PASS).
  - `pf-test`: «## Phase 1: Detect Test Runner», п.5 («None of the above
    match» plain-text вопрос) — **hook (finding #11)**: это такая же
    остановка, как и литеральный `AskUserQuestion`, черновик спека
    ошибочно считал иначе. Резолюция: пропустить вопрос, попробовать
    `make test` (наиболее общий кросс-языковый вариант в списке
    приоритетов Phase 1), логируя `[assumed] No test runner auto-detected
    → assumed 'make test'`. Если и эта команда падает с «command not
    found» — не более «допущаемый» вопрос: стадия останавливается с
    обычной ошибкой, не гадает дальше.
  - `pf` (остальные сайты, не Task 7/8): Reviewer-assignment guard (перед
    Step 5, bug-type) — hook; `code.review: skip` confirmation guard —
    **исключение**; Bug workflow, «CREATE only» строка (clarifying dialog +
    tier reconfirmation) — hook.
- Для **codex-install-подсказок** (`pf-check` шаг 1/2a/3) — assert
  **условный**, не «есть/нет hook»: диапазон должен упоминать оба пути
  текстом — «intake» (readiness/install-предпочтение уже собрано на CREATE
  для issue, включившего front-loaded там же — Task 21) и «unconditional»
  (для issue, включившего `interaction: front-loaded` вручную postfactum —
  вопрос остаётся безусловным исключением, поскольку intake для такого
  issue уже прошёл без него).

**Acceptance Criteria:**
- [ ] TC-020 passes (частично — 12 из 13 скиллов; `pf-close` — Task 21)

---

#### Task 21: `pf-close` Phase 1 — front-loaded final decision gate; `/pf` — новый опциональный intake-вопрос

**Task Type:** code
**Mapped Test Cases:** TC-008, TC-019, TC-020

**Files:**
- `skills/pf-close/SKILL.md` - правка
- `skills/pf/SKILL.md` - правка

**Implementation Notes:**
- **`pf-close`'s «## Phase 1: Confirm with User» — не исключение, а
  расширенный финальный гейт** (specs-part2.md §7.13.1, finding #10):
  для feat/improve/bug issue с `interaction: front-loaded`, эта Phase —
  **единственный финальный человеческий гейт issue** (та же роль, что
  decision session для idea/spike — specs-part1.md §3.8). Условный блок
  перед сегодняшним plain-summary:
  1. Показать полный ledger — каждую `[assumed]`-строку и
     `unverified-fact`/note из `open_questions.md` по **всем** стадиям,
     через которые прошёл issue, одним батчем, той же формы, что
     `pf-idea-verdict`'s decision session (Task 5) — не просто счётчик,
     каждая строка легибельна.
  2. Показать сегодняшнее обычное резюме (merge/archive/usage/session-log)
     **после** ledger'а, не вместо него.
  3. **Три ответа, не два:** **Proceed** (закрыть как есть); **Override an
     assumption** (выбрать запись, дать новый ответ — регенерирует только
     секции, названные её «Used in», той же дисциплиной, что §3.5.2 part1
     пп.3-4, и повторно прогоняет `/pf-check` на каждый затронутый документ
     до того, как этот гейт покажется снова — та же инвалидация, что
     override для idea/spike, specs-part1.md §3.5.2 пп.6-8, переиспользуется
     по ссылке, не пересказывается); **Stop** (отмена, как сегодняшнее
     «no»).
  4. Подтверждённый **Proceed** — записанное финальное подтверждение
     этого issue; дальше Phase 2 как сегодня.
  Для issue **без** `interaction: front-loaded` эта Phase не меняется
  (сегодняшнее plain-summary и yes/no).
  **Почему `open_questions.md` читается здесь, хотя feat/improve/bug
  раньше этого файла не имели:** front-loaded резолюция hook'ов (Task 20)
  уже требует от каждого hook-сайта писать в `open_questions.md` при
  допущении — файл создаётся первой стадией, которой есть что в него
  записать, той же ленивой-инициализацией, что и у idea/spike
  (specs-part1.md §5.6, переиспользуется по ссылке — не новое правило).
- **`/pf`'s «## Creating prompt.md» — новый, необязательный вопрос в конце
  обычной ветки feat/improve/bug** (specs-part2.md §7.13, преамбула, после
  таблицы), после `on_unavailable`, если он задавался: *«Enable
  front-loaded interaction for this issue (human only at intake and at the
  final decision gate before close)? Default: No — today's interactive
  behavior.»* Выбор **Да** — не просто пишет `interaction: front-loaded`
  (AC-12c, без изменений), это и есть intake-момент для этого issue: тем
  же батчем задаётся: «Do you want Codex to review this issue's documents/
  code? If Codex needs installing later, may I install it automatically
  without asking again?» — тот же вопрос, что иначе задал бы `codex:setup`/
  «Codex invocation chain» посреди пайплайна (Task 20's условный
  codex-install hook). Ответ пишется в `profile:`/`roles:` (обычная схема
  `pf-roles` §1/§3) **и**, для install-предпочтения, в `open_questions.md`
  как обычное `[assumed]`. **Честно называемое ограничение:** это закрывает
  вопрос только для issue, включивших front-loaded **на этом самом
  CREATE-вызове** — issue, дописавший поле в уже существующий `prompt.md`
  вручную, не проходит через этот intake-момент заново, для него
  Codex-install-вопрос остаётся безусловным исключением (уже
  задокументировано в Task 20).

**Acceptance Criteria:**
- [ ] TC-008 passes (частично — параллель с decision session, ссылка на pf-close Phase 1)
- [ ] TC-019 passes (частично — новый опциональный вопрос как единственный источник поля для feat/improve/bug)
- [ ] TC-020 passes (частично — `pf-close` Phase 1 сайт; полное прохождение требует Task 20)

---

#### Task 22: `test/pf-idea-front-loaded-static.sh`

**Task Type:** tests
**Mapped Test Cases:** TC-020

**Files:**
- `test/pf-idea-front-loaded-static.sh` - новый

**Implementation Notes:**
- Проверяет каждую строку таблицы specs-part2.md §7.13 механически
  (specs-part3.md §8.2): для каждой (скилл, секция) — извлечь текст файла
  между этим заголовком/якорем и следующим заголовком того же/более
  высокого уровня, убедиться, что диапазон содержит **и** подстроку
  `pf-interaction`, **и** подстроку `front-loaded` (канонический hook-текст
  или смысловой эквивалент).
- **Для строк-исключений** (`code.review: skip` confirmation в
  `pf-codereview` и в `pf` — Task 20/21) — обратная проверка: диапазон **не
  должен** содержать эту ссылку.
- **Для codex-install-подсказок** (`pf-check` шаг 1/2a/3) — assert
  **условный**: диапазон может не содержать hook, тест требует только, что
  раздел упоминает оба пути текстом («intake» и «unconditional»).
- **Для `pf-close`'s Phase 1** (Task 21) — assert **положительный**:
  диапазон содержит **и** упоминание `front-loaded` (hook применяется —
  расширенный гейт), **и** текст, подтверждающий, что для issue **без**
  `front-loaded` поведение Phase 1 не меняется.
- **Для `pf-test`** (Task 20, finding #11) — assert **обновлён**: файл
  по-прежнему не содержит ни одного литерального `AskUserQuestion` (это
  по-прежнему верно), но Phase 1's plain-text вопрос обязан быть покрыт
  hook-ссылкой в диапазоне вокруг этого текста — тест не довольствуется
  отсутствием `AskUserQuestion` как доказательством отсутствия остановки
  (это и была сама ошибка finding #11).
- Тестируемые файлы (specs-part2.md §7.13, Test Data): `pf-brd`, `pf-spec`,
  `pf-test-plan`, `pf-impl-plan`, `pf-check`, `pf-user-docs`, `pf-dev-docs`,
  `pf-codereview`, `pf-qa`, `pf-test`, `pf-close`, `pf` — 12 файлов (не
  `pf-execute` отдельно проверяется через тот же цикл — Legacy-tier guard
  сайт учтён в общей таблице).

**Acceptance Criteria:**
- [ ] TC-020 passes

---

#### Task 23: Codex-адаптер интерактивных точек — текстовый REPL-протокол, pending-state, безопасное возобновление

**Task Type:** code
**Mapped Test Cases:** TC-029

**Files:**
- `skills/pf-interaction/SKILL.md` - правка (новый раздел)
- `skills/pf-idea-verdict/SKILL.md` - правка (ссылка на раздел, Режим 2)
- `skills/pf-close/SKILL.md` - правка (ссылка на раздел, front-loaded Phase 1)

**Implementation Notes:**
- **Обоснование (P0-1 фикс):** specs-part3.md §9 (таблица, строка
  `AskUserQuestion`) прямо требует: «implementation plan обязан завести под
  это отдельную задачу, не молчаливо предполагать идентичное поведение» —
  для двух обязательных человеческих точек, остающихся при front-loaded
  дизайне (intake-батч и финальный гейт: decision session
  `pf-idea-verdict` Режим 2 для `idea`, front-loaded `pf-close`'s Phase 1
  для `spike`/feat/improve/bug — Task 21). Эта задача поставляет **контракт
  адаптера**, проверяемый статически — не запуск фреймворка под Codex
  целиком (реальный Codex-прогон вне скоупа per BRD Non-Goals: «Работа
  фреймворка в Codex прямо сейчас… не требуется»); контракт должен быть
  достаточно конкретным, чтобы будущий Codex-runtime-issue или ручное
  Codex-ревью (TC-029) могли проверить его напрямую, не переоткрывая вопрос
  с нуля.
- Новый раздел `pf-interaction/SKILL.md`, «### Codex text-REPL adapter
  (non-Claude `write`)», применимый когда резолвнутый `write` для
  затронутой точки — `codex`, не `claude`:
  1. **Формат вопроса** — вместо `AskUserQuestion`, вопрос печатается
     обычным текстом в сессию, в том же порядке полей, что структурированный
     вариант: краткое резюме контекста (рекомендация+обоснование / summary
     issue), затем пронумерованный список вариантов (тот же словарь, что и
     структурированный вопрос), затем явная инструкция «ответьте номером
     или точным текстом варианта».
  2. **Pending-state — где хранится, точный маркер:** перед печатью вопроса
     — записать в документ (не в память сессии) строку-маркер вида
     `<!-- pf-pending-interaction: <stage-key> | options: <opt1>|<opt2>|...
     | asked: <ISO-timestamp> -->`, вставляемую в `verdict.md` сразу перед
     «## Decision» (decision session) или в `open_questions.md` как
     отдельную строку (финальный гейт `pf-close`'s Phase 1 — там нет
     аналога «## Decision»). Максимум один незакрытый маркер на точку —
     новый вопрос той же точки заменяет, не дублирует.
  3. **Разбор ответа:** нормализовать (trim, lower-case, снять пунктуацию)
     и сравнить с (а) номером варианта, (б) точным текстом варианта, (в)
     известными синонимами первых 1-2 значимых слов каждого варианта
     (например «подтвер»/«confirm» → Подтвердить). Не распознано —
     переспросить тот же вопрос один раз текстом «Не понял ответ, выберите
     один из: …», без записи нового маркера (`asked` не обновляется).
  4. **Безопасное возобновление:** новая codex-сессия того же issue,
     перечитывающая документ, обязана сначала проверить наличие незакрытого
     `pf-pending-interaction`-маркера **до** любого другого действия; если
     найден — повторно показать тот же вопрос (не пересчитывать заново
     рекомендацию — она уже зафиксирована в окружающем тексте документа),
     не начинать стадию с начала. Валидный ответ — маркер удаляется (или
     помечается `resolved: <answer>`; реализация фиксирует, какой из двух
     эквивалентных вариантов выбран), дальше — обычная логика (append
     «## Decision» и т.д.), как в Claude-пути.
  5. Протокол переиспользуется и для intake-батча (pending-state хранится в
     черновике `prompt.md`, ещё не закоммиченном на этот момент — тот же
     принцип «состояние в документе, не в памяти сессии») — единый
     механизм на обе оставшиеся интерактивные точки под Codex, не только на
     финальный гейт.
- `pf-idea-verdict/SKILL.md`, Режим 2 — одна ссылочная строка перед
  описанием `AskUserQuestion`-вызова: «Under Codex orchestration
  (`write == codex`), replace this `AskUserQuestion` call with
  `~/.claude/skills/pf-interaction/SKILL.md`'s "Codex text-REPL adapter" —
  same options, same pending-state discipline.»
- `pf-close/SKILL.md`, front-loaded Phase 1 (Task 21) — та же одна
  ссылочная строка, применённая к трёхвариантному ответу
  (Proceed/Override/Stop).
- **Явно вне скоупа этой задачи** (зафиксировано, не пропущено молчанием):
  реальный запуск любой стадии под Codex-рантаймом целиком, включая
  `SKILLS_ROOT`-резолвер путей — см. «## Out-of-Scope Follow-ups» ниже; эта
  задача поставляет только контракт/протокол вопроса, проверяемый
  статически, не рантайм.

**Acceptance Criteria:**
- [ ] `pf-interaction/SKILL.md` содержит раздел «Codex text-REPL adapter» с
      форматом вопроса, точным местом/форматом pending-state маркера,
      правилом разбора ответа и правилом безопасного возобновления
- [ ] `pf-idea-verdict/SKILL.md` (Режим 2) и `pf-close/SKILL.md`
      (front-loaded Phase 1) ссылаются на этот раздел по имени для
      `write == codex`
- [ ] TC-029 — manual/blocked per test_plan.md; ревью Task 24 сверяет, что
      таблица specs-part3.md §9's строка `AskUserQuestion` для «оставшихся
      двух точек» теперь отражена именованным контрактом, а не только
      пометкой «принято как ограничение»

---

#### Task 24: Чекпоинт Phase B/C — `make test` зелёный, финальный дог-фуд (manual TC-003), install-полировка

**Task Type:** tests
**Mapped Test Cases:** TC-003, TC-029

**Files:** нет (верификационная/дог-фуд задача)

**Implementation Notes:**
- **Чекпоинт Phase B:** прогнать `make test` — теперь весь набор
  (существующий + три новых файла: `pf-idea-stage-static.sh`,
  `pf-idea-templates-mirror.sh`, `pf-idea-front-loaded-static.sh`)
  обязан быть зелёным. Если `test/pf-idea-front-loaded-static.sh` красный
  — вернуться к Task 20/21 (недостающий hook-сайт), не к тесту.
- **Install-полировка (Phase C):** явно верифицировать, что
  `scripts/install.sh` и `scripts/update-skills.sh` **не требуют правок**
  (они копируют `skills/<name>/.` целиком по маске директорий, без
  списка файлов — specs-part1.md §1.1.C) — прогнать `make converge`/
  `update-skills` (или их тестовые обёртки `test/converge-fresh.sh`) на
  свежей fixture-копии и убедиться, что все 28 директорий (включая семь
  новых) физически копируются в целевой `~/.claude/skills/` (через
  `pf_run_converge`, никогда напрямую на реальном `$HOME` — S-1 в
  `test/lib.sh`).
- **Финальный дог-фуд — manual TC-003** (test_plan.md, Preconditions:
  свежая пустая директория без `.git`; отдельно — временная копия
  работающего PF-проекта без открытых issue):
  1. `mkdir proj && cd proj && claude`, `/pf` — вопрос «идея или сразу
     проект» задан первым действием, без падения на git-командах.
  2. Ответить «Идея», пройти intake — на диске только
     `docs/issues/open/<id>-idea-<slug>/prompt.md`.
  3. В новой пустой директории повторить `/pf`, ответить «Сразу проект» —
     `git init`, каркас развёрнут, 3/4-вариантный вопрос дальше.
  4. В существующем PF-проекте без открытых issue — `/pf`, «Describe an
     idea», intake.
  5. Повторный `/pf` в том же проекте — idea-issue распознан, статус-блок
     той же формы, что feat/improve/bug, корректный Next step.
  Довести хотя бы одну реальную идею владельца фреймворка через
  idea-issue до вердикта (BRD Success Metrics) — это природный повод
  выполнить дог-фуд не на синтетической, а на настоящей идее.
- **TC-029 (Codex compatibility review)** — при отправке документов/
  скиллов этого issue на ревью в Codex, явно запросить измерение
  «совместимость с Codex» (AC-13a) и сверить ответ с таблицей
  specs-part3.md §9 (7 строк: `AskUserQuestion`, `Agent` tool, абсолютные
  пути скиллов, `WebSearch`/`WebFetch`, `CronCreate`/`CronList`/
  `CronDelete`, `Skill` tool/slash-команды, session-log-атрибуция) —
  каждая строка обязана быть отражена переносимой альтернативой или
  явной пометкой «принято как ограничение», ни одна не пропущена
  молчанием (AC-13b). Строка `AskUserQuestion` сверяется в первую
  очередь с Task 23's контрактом (текстовый REPL-адаптер), не с
  пометкой «принято как ограничение» из более ранней редакции спека.
  Это единственный TC, требующий реально настроенного Codex CLI/
  `codex-companion.mjs` — при недоступности помечается blocked,
  не пройден/провален (test_plan.md, Prerequisites).

**Acceptance Criteria:**
- [ ] `make test` зелёный (весь набор, включая три новых файла)
- [ ] `scripts/install.sh`/`scripts/update-skills.sh` подтверждены
      неизменными и рабочими для 28 директорий
- [ ] TC-003 — manual, per test_plan.md
- [ ] TC-029 — manual, per test_plan.md

---

## Complexity Estimate

**Complex.** Обоснование:
- Семь совершенно новых скиллов (два справочных, пять пишущих), каждый со
  своей нетривиальной логикой (параллельная диспетчеризация персон в
  `pf-idea-critique`, двухрежимный override-цикл с точечной регенерацией
  и инвалидацией в `pf-idea-verdict`, ветвление код/не-код с git-веткой в
  `pf-idea-spike`).
- Правки затрагивают 13 существующих скиллов плюс `converge-to-v3.sh` —
  каждая правка обязана быть строго условной (TYPE issue или новое поле),
  никогда не заменяя существующую безусловную ветку, что требует
  аккуратной хирургии текста, а не добавления в конец файла.
- Самая сложная отдельная часть — `pf-close`'s Phase 4.6 (bootstrap
  каркаса + `git init` + создание follow-up issue **до** архивации,
  атомарный commit, идемпотентный recovery-путь при частичном сбое,
  вывод `size_tier` по таблице) — порядок операций здесь критичен для
  корректности (пять отдельных находок ревью спека были about именно этот
  порядок).
- Front-loaded режим — 20+ отдельных hook-сайтов в 13 файлах, каждый со
  своей резолюцией по умолчанию (не универсальный шаблон) — требует
  внимательного чтения specs-part2.md §7.13's таблицы построчно, не
  автоматической подстановки одного текста.
- Три новых теста включают не только grep-based статические проверки, но
  и fixture-based поведенческие тесты с новыми throwaway git-репозиториями
  — пять новых fixture-директорий, каждая со своим сценарием.
- Одновременно — почти всё это текстовые (markdown) правки, интерпретируемые
  LLM-агентом во время реального прогона, не компилируемый код: нет
  типов, нет сборки, ошибки текста не ловятся статическим анализом языка
  — только grep-тестами, которые эта же реализация и пишет.

## Phased Rollout

Тир `large` — рекомендован трёхфазный прогон с проверкой `make test` на
каждой границе (Tasks 19 и 24 — явные чекпоинты).

**Phase A — idea/spike типы end-to-end, без изменения поведения
feat/improve/bug (Tasks 1-19).** Все семь новых скиллов, точка входа `/pf`
(бар-папка и существующий проект), условные правки в `pf-close`/`pf-git`/
`pf-autopilot`/`pf-check`/`pf-brd`/`pf-roles`/`pf-size-tiers`, зеркало
каркаса, `converge-to-v3.sh`, и — что важно — **документация/счётчики
скиллов (Task 16) включены в эту фазу, а не отложены в Phase C**: как
только Task 1 создаёт первую новую директорию скилла,
`test/docs-refs.sh`'s динамически вычисляемый `N_SKILLS` становится 28, и
существующий тест начинает падать до тех пор, пока документация не
обновлена — «зелёный `make test`» на границе этой фазы физически
недостижим без Task 16 внутри неё. Это единственное отступление от
буквального прочтения формулировки «Phase C: docs/tests/install polish»
— часть «docs» переносится в Phase A по причине, зафиксированной здесь и в
разделе Dependencies, а не по произволу. Границу фазы закрывает Task 19
(`make test` зелёный на всём существующем наборе плюс двух из трёх новых
файлов).

**Phase B — front-loaded режим для feat/improve/bug, опционально (Tasks
20-22).** Двадцать с лишним hook-сайтов в 13 существующих скиллах, каждый
— обусловленная ветка, ничего не меняющая для issue без поля
`interaction: front-loaded`. Третий новый тест-файл
(`test/pf-idea-front-loaded-static.sh`) пишется **после** hook-сайтов
(Task 22), не одновременно с двумя другими тест-файлами Phase A — он не
может содержательно проходить раньше, чем хуки существуют (обоснование —
раздел Dependencies).

**Phase C — Codex-совместимость, финальная верификация и полировка (Tasks
23-24).** Task 23 поставляет контракт Codex-адаптера интерактивных точек
(текстовый REPL-вопрос, pending-state в документе, безопасное
возобновление — P0-1 фикс, specs-part3.md §9), проверяемый статически, не
рантайм-запуск (вне скоупа per BRD Non-Goals). Task 24 — явная проверка,
что `install.sh`/`update-skills.sh` действительно не требуют правок (не
предположение, а прогон), полный `make test` по всему набору, и
дог-фуд-прогон manual TC-003/TC-029 на реальном use case владельца
фреймворка — оба обязательны по BRD Success Metrics до закрытия issue.

Каждая фаза заканчивается зелёным `make test` (Tasks 19, 24) до перехода к
следующей — регрессия в существующем поведении feat/improve/bug (G7)
останавливает прогон немедленно, не переносится «на потом».

---

## Out-of-Scope Follow-ups

Один пункт из specs-part3.md §9 (Codex compatibility notes) сознательно
остаётся вне скоупа этого issue — зафиксированный здесь как отдельный
follow-up с явной зависимостью (P1-1 фикс), не как ручная пометка внутри
TC-029:

- **`SKILLS_ROOT`/резолвер путей вместо литеральных `~/.claude/skills/...`.**
  specs-part3.md §9 (строка «`~/.claude/skills/...` — абсолютные пути»)
  называет это необходимым для запуска фреймворка под Codex вообще, но
  явно вне скоупа этого issue по BRD Non-Goals («Работа фреймворка в Codex
  прямо сейчас… не требуется»). **Зависимость:** такой follow-up не может
  начаться раньше, чем этот issue закрыт — семь новых скиллов и ~20
  правленных call site'ов (Tasks 1-22) должны сначала существовать как
  полный инвентарь путей, который резолвер обязан покрыть; открывать
  follow-up параллельно с этим issue означало бы резолвить путь
  несуществующих ещё файлов. Заводится отдельным `idea`/`feat`-issue после
  закрытия этого, не как незакрытый TODO внутри `open_questions.md`.

---

## TC Coverage Check

Проверка: каждый TC-001…TC-033 test_plan.md появляется хотя бы в одном
`Mapped Test Cases` выше.

| TC | Задача(и) |
|---|---|
| TC-001 | Tasks 1, 2, 3, 4, 5, 6, 17 |
| TC-002 | Tasks 7, 17 |
| TC-003 | Tasks 7, 8, 24 (manual) |
| TC-004 | Tasks 7, 10, 17 |
| TC-005 | Tasks 8, 17 |
| TC-006 | Tasks 8, 16, 17 |
| TC-007 | Tasks 8, 17 |
| TC-008 | Tasks 1, 17, 21 |
| TC-009 | Tasks 2, 17 |
| TC-010 | Tasks 3, 17 |
| TC-011 | Tasks 4, 17 |
| TC-012 | Task 4 (manual) |
| TC-013 | Tasks 1, 5, 17 |
| TC-014 | Task 5 (manual) |
| TC-015 | Tasks 1, 17 |
| TC-016 | Tasks 1, 13, 17 |
| TC-017 | Tasks 9, 11, 17 |
| TC-018 | Tasks 6, 17 |
| TC-019 | Tasks 1, 17, 21 |
| TC-020 | Tasks 20, 21, 22 |
| TC-021 | Tasks 13, 17 |
| TC-022 | Tasks 14, 17 |
| TC-023 | Tasks 12, 17 |
| TC-024 | Tasks 14, 17 |
| TC-025 | Tasks 15, 17 |
| TC-026 | Tasks 15, 16, 18 |
| TC-027 | Tasks 14, 17 |
| TC-028 | Task 6 (manual) |
| TC-029 | Tasks 23, 24 (manual) |
| TC-030 | Task 18 |
| TC-031 | Task 18 |
| TC-032 | Tasks 9, 18 |
| TC-033 | Tasks 13, 18 |

Все 33 TC покрыты; нет непокрытых TC.
