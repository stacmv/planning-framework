# Tech Debt

Долг, замеченный в ходе работы над issue и сознательно не закрытый в ней.
Строки заводятся стадией `/pf-codereview` (остатки реестра находок) и вручную,
когда дефект найден вне диффа текущей issue.

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
