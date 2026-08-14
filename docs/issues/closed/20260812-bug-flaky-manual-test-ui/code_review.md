# Code Review Report

**Issue ID:** 20260812-bug-flaky-manual-test-ui
**Date:** 2026-08-13
**Reviewer(s):** Claude + Codex

Область: `git diff develop...HEAD` — `test/manual-test-ui.sh`, `tools/manual-test-ui/test/read-paths.test.js`
и документы issue. Раунд 1 из 3.

---

## Findings Ledger

| ID | Round | Priority | Description | Follow-up Issue | State |
|----|-------|----------|--------------|------------------|-------|
| CR-001 | 1 | P2 | [Claude] `test/manual-test-ui.sh:149` — `rp_rc` вычислялась и нигде не читалась. Проверено, что `test/lib.sh` включает `set -uo pipefail` **без** `-e`, поэтому `\|\| rp_rc=$?` ничего не защищала — переменная действительно мёртвая. Удалена вместе с суффиксом захвата. |  | fixed |
| CR-002 | 1 | P2 | [Claude] `test/manual-test-ui.sh:222-266` — восемь веток `pf_fail` для `TC-001 step 3a…3h` печатали тот же текст, что и успех: в логе появлялось `FAIL TC-001 step 3a: positive control passed despite EPERM`, то есть строка провала утверждала «passed». На сопоставление `/pf-test` Phase 3.3 не влияло (оно читает префикс `PASS`/`FAIL`), но лог читает человек — в частности ручная процедура атрибуции TC-008. Все восемь текстов провала заменены на «… did not pass». |  | fixed |

**Codex:** находок нет — «I did not identify any discrete introduced defects in the
changed test and documentation code that would break existing behavior or tests».

**P0 / P1:** ни одной находки ни от одного ревьюера.

---

## Проверенное, а не прочитанное

Оба ревьюера подтверждали выводы прогонами, а не только чтением:

- якорь `^[[:space:]]*(not )?ok [0-9]+ - <name>` действительно отделяет `not ok` от
  `ok` — строка не может после отступа начинаться одновременно с `n` и с `o`;
  проверено на настоящем TAP-выводе (восемь подпроверок → `pass`, `step 2` → `skip`);
- сравнение путей в TC-005 — это `tc005_written_path` (из файла) против
  `tc005_expected_path` (зафиксирован до записи), а не самосравнение;
- метки TC сверены посимвольно с `test_plan.md` и с именами подтестов, включая
  байты em-dash;
- `--test-reporter=tap` на строке 118 не задевает шаги 2/3/6: они грепают
  `$recipe` из `make -n test`, а рецепт не менялся.

После правки обеих находок: `bash -n` чист, сьют — **36 passed, 0 failed**.
Мутация подтверждает, что исправленная ветка провала печатается и читается верно:
`FAIL TC-001 step 3a: positive control did not pass`.

---

## Остатки

Строк, не находящихся в состоянии `fixed`, в реестре нет — переносить в
`docs/planning/tech-debt.md` по этому ревью нечего.

Отдельно, **не как находка ревью** (дефект предсуществующий, вне диффа):
перемежающееся падение сьюта из-за `fs.renameSync(stagingDir, workdir)` в
`skills/pf-test/templates/setup.mjs` зарегистрировано в `docs/planning/tech-debt.md`
как кандидат в отдельную issue. Подробности и замеры — в `session-log.md`.

---

## Verdict

**PASS**
