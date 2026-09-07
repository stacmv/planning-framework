# Tech Debt

Findings that reached a `PASS` verdict without being fixed. Each line carries
the finding's stable ID, its priority, the issue it came from, and its final
state, so a remnant can always be traced back to the review that produced it.

- `CR-006` (P2, 20260902-feat-idea-stage) — `pf-idea-critique` checks predecessors by existence only, so a non-empty stub left by an interrupted `research.md` write satisfies it; the shared stage-completion criterion should apply here as it already does in `pf-idea-research`. The analogous check in `pf-idea-verdict` is loose the same way — state: `open`
- `CR-007` (P2, 20260902-feat-idea-stage) — for git-backed idea/spike closures `NO-REPO` is false, so the unchanged Phase 9 report still claims two commits were added and one was a `--no-ff` merge; both new paths skip Phase 4 and normally create only the archive commit, making every successful close report misleading — state: `open`
- `CR-012` (P2, 20260902-feat-idea-stage) — `pf-idea-critique` justifies its sequential Codex persona path by asserting Codex has no orchestrating primitive equivalent to the `Agent` tool; current documentation describes parallel subagents with concurrency control, so the sequential path is a defensible conservative fallback but not a consequence of a missing capability — state: `open`
- `CR-013` (P2, 20260902-feat-idea-stage) — `specs-part3.md` §9 points a future `SKILLS_ROOT` resolver only at `~/.codex/skills`; current documentation names a repo-level `.agents/skills`, a user-level `$HOME/.agents/skills` and plugin discovery. The "accepted as limitation" status stands, but the resolver target description is out of date — state: `open`

---

- `setup.mjs` rename (Windows, 20260812-bug-flaky-manual-test-ui) — публикация
  подготовленных данных через `fs.renameSync(stagingDir, workdir)` в
  `skills/pf-test/templates/setup.mjs` перемежающеся падает на Windows с `EPERM`:
  rename каталога не проходит, пока в дереве открыт хоть один хендл, что под
  параллельной нагрузкой `node --test` случается регулярно. Далее каскад — `ENOENT`
  на неподготовленном файле и `null` снапшот. Замеры: 5 прогонов сьюта дали 3
  зелёных и 2 красных; `--test-concurrency=1` — 6 зелёных из 6; файлы
  `prepare*.test.js` побайтно совпадают с `develop`, то есть дефект
  предсуществующий. Изоляция temp-каталога при этом исправна — гонки за общий путь
  нет. Средство: ретрай с backoff вокруг `fs.renameSync`, плюс проверка, нет ли той
  же схемы в других шаблонах. — state: `deferred`, кандидат в отдельную issue

- `CR-001` (P1, 20260806-improve-manual-test-budget) — заявленный баг извлечения
  значения `Manual reason` в `test/lib.sh`'s `pf_validate_manual_reasons()` при
  наличии пояснительного текста после причины (напр. `cost — 2 дня`).
  Эмпирически проверено и опровергнуто: `[^a-z-]*` — glob-паттерн, не regex;
  `*` матчит всё до конца строки безусловно после первого не-`[a-z-]` символа,
  извлечение работает корректно, включая дефисные слова (`human-judgment`).
  — state: `wont-fix`
- `CR-002` (P2, 20260806-improve-manual-test-budget) — фикстуры (`tc-006` и
  др.) не покрывают `Manual reason` с пояснительным текстом после значения —
  пробел в покрытии (не баг), из-за которого гипотетический CR-001 не был бы
  пойман тестами, даже если бы был реальным. — state: `wont-fix`
- `CR-003` (P2, 20260806-improve-manual-test-budget) — таблица бюджета в
  `pf-size-tiers/SKILL.md` использует `0-1` для trivial, но `≤N` для
  остальных tier — неоднородная нотация, без функционального эффекта. —
  state: `wont-fix`

- `CR-007` (P2, 20260806-feat-project-explorer-redesign) — проект без единой
  issue навсегда зависает на «Загрузка…» вместо информативного пустого
  состояния (`workspace.js`, ветка `state.project ? "Загрузка…" : "Проект не
  выбран."`). — state: `open`
- `CR-008` (P2, 20260806-feat-project-explorer-redesign) — в `style.css`
  остались мёртвые блоки `.shell`/`.app`/`.topbar`/`.sidebar`/`.content` от
  старой разметки. — state: `open`
- `CR-009` (P2, 20260806-feat-project-explorer-redesign) — `readonly.test.js`'s
  AC-05j-грепчек проходит формально даже когда единственного разрешённого
  action тоже нет — ложная уверенность. — state: `open`
- `CR-010` (P2, 20260806-feat-project-explorer-redesign) — `pf.lastIssue.${project}`
  в `launcher.js` — потенциальная коллизия ключей localStorage, если имя
  проекта содержит `.`. — state: `open`
- `CR-011` (P2, 20260806-feat-project-explorer-redesign) — счётчик «Дела (N)»
  на заголовке таба не обновляется после действия внутри самого таба
  (`state.projectTodoCount` мемоизирован, не инвалидируется). — state: `open`
- `CR-012` (P2, 20260806-feat-project-explorer-redesign) — «Завершить»/«Отдать
  агенту» в табе «Дела» тестируются только через застабленный `fetchImpl`, без
  server-round-trip теста, в отличие от соседних веток той же волны. —
  state: `open`
- `CR-013` (P2, 20260806-feat-project-explorer-redesign) — `renderChecklistPanel`
  больше не вызывается из продуктового кода, живо только ради тестов. —
  state: `open`
- `CR-018` (P2, 20260806-feat-project-explorer-redesign) — `public/attention.js`'s
  `attentionForRoles(...)` принимает четвёртый параметр `missingDocsByIssue`,
  который не передаёт ни один из двух вызывающих (`project-inbox.js`,
  `project-picker.js`): и параметр, и его обработка внутри мертвы, а JSDoc при
  этом утверждает, что экран списка issue его поставляет. — state: `open`
- `CR-020` (P2, 20260806-feat-project-explorer-redesign) — после merge `79f5e32`
  фолбэк-константа `DEFAULT_AGENTS_YAML` в `lib/roles-resolve.js` разошлась с §2
  `skills/pf-roles/SKILL.md`: дефолтный `agents.yml` стал tiered
  (`tiers:`/`default_tier:`/`degrade:` плюс запись `human:`), а константа
  осталась плоской. Проект без `docs/planning/agents.yml` на диске с
  `roles.<key>: { write: human }` даёт `unknown_actor` вместо `kind: "human"`, и
  human-очередь проекта молча пуста. Рядом (предсуществующее): `agents.yml`
  самого репозитория записи `human` тоже не содержит. — state: `open`
- `CR-021` (P2, 20260806-feat-project-explorer-redesign) — сообщение level-3 в
  `docstate.js`'s `roleSkipReason()` описывало случай, для level 3 недостижимый.
  Исправлено в `9fc3f4b` вместе с корневой причиной (`CR-019`), но раунд ревью,
  который переводит строку ledger в терминальное состояние, не запускался —
  поэтому в `code_review.md` строка осталась `open`. — state: `fixed`, ledger не
  обновлён
- `TD-SIGPIPE` (обнаружено 2026-09-04 при /pf-autopilot по
  20260806-feat-project-explorer-redesign) — конструкция
  `printf '%s\n' "$var" | grep -q ...` под `set -o pipefail` (его ставит
  `test/lib.sh`) возвращает 141, а не 0, когда совпадение находится рано в
  большом многострочном выводе: `grep -q` выходит по первому совпадению,
  `printf` получает SIGPIPE. Успешное совпадение читается как провал. В
  `test/*.sh` таких мест ~278; в этой issue починены только два реально
  покрасневших (`test/manual-test-ui.sh`, step 4 и TC-004 step 2) — заменой на
  here-string, у которого нет пишущего процесса выше по конвейеру. Остальные
  безопасны ровно до тех пор, пока их вход мал; при росте вывода любое из них
  может покраснеть тем же образом. Массовую замену не делали — вне scope этой
  issue. — state: `open`
- `TD-QA-NO-TESTS` (обнаружено 2026-09-04, там же) — `.qa-workflow.md` не
  содержит ни одной `[Automated]`-проверки, запускающей набор тестов
  (`make test`): есть shellcheck, debug-вывод, проверка незакрытых маркеров,
  Status Tracker, секреты,
  чистота дерева — но не сам прогон. Из-за этого `make test` был красным и на
  момент `code_review.md` PASS (проверено прогоном харнесса в worktree на
  `e6c6689`), и на момент `qa_report.md`, и ни один гейт этого не заметил.
  Починка — добавить `make test` в раздел Testing `.qa-workflow.md` (и в
  дефолтный шаблон `pf-qa-setup`), но это меняет гейт для всех будущих issue
  репозитория, поэтому вынесено из scope этой issue. — state: `open`
