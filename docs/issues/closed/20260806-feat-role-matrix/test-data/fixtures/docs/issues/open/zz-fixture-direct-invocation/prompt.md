---
doc_language: Russian
size_tier: small
reviewers:
  specs: codex
---

Тестовая фикстура для TC-011 (роль-матрица, 20260806-feat-role-matrix):
legacy issue с `reviewers:` и без `roles:`, к которой `/pf` ни разу не
обращался. `specs.md` уже готов (см. Test Data) — фикстура нужна, чтобы
вызвать `/pf-check` напрямую на `specs.md`, в обход `/pf`, и убедиться, что
`pf-check` сам выполняет автомиграцию как собственное предусловие.
