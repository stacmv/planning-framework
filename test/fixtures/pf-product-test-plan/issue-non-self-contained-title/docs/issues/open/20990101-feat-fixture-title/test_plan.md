# Test Plan: Fixture — self-contained vs. context-dependent titles (pf-product-test-plan)

Fixture for `test/pf-product-test-plan.sh` TC-017. Not a real issue.
Read-only; copied fresh into a temp dir by `pf_setup_case` for every case
that uses it — never edited in place.

TC-001's title already stands alone and must transfer verbatim (specs.md
"Самодостаточность кейса"). TC-002's title ("Проверить шаг 3") only reads in
the context of this issue; its `**Description:**` line below supplies the
context ("сценарий «Настройка темы интерфейса»", "тема") a deterministic
expansion needs to produce a self-contained `Test case` phrase.

## Test Cases

### TC-001: Тема сохраняется между перезагрузками страницы

**Description:** Уже самостоятельное название — переносится без изменений.

### TC-002: Проверить шаг 3

**Description:** Шаг 3 сценария «Настройка темы интерфейса» — после переключения темы и перезагрузки страницы выбранная тема должна сохраняться, а не сбрасываться на дефолт.

## Status Tracker

| TC     | Test Case                                      | Type   | Priority | Status | Remarks |
| ------ | ----------------------------------------------- | ------ | -------- | ------ | ------- |
| TC-001 | Тема сохраняется между перезагрузками страницы | Manual | High     | [ ]    |         |
| TC-002 | Проверить шаг 3                                | Manual | Medium   | [ ]    |         |
