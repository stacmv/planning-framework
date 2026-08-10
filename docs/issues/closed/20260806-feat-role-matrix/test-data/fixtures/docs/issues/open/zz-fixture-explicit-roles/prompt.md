---
doc_language: Russian
size_tier: small
roles:
  brd: { write: claude, review: [codex] }
  specs: { write: codex, review: [codex] }
---

Тестовая фикстура для TC-001 (роль-матрица, 20260806-feat-role-matrix):
маленький no-op инструмент — CLI-скрипт `whoami-stub.sh`, который печатает
текущее системное имя пользователя и код выхода 0. Никакой реальной
интеграции не требуется — фикстура существует только чтобы пройти через
`/pf-brd` и `/pf-spec` и понаблюдать, какой актор фактически пишет каждую
стадию.
