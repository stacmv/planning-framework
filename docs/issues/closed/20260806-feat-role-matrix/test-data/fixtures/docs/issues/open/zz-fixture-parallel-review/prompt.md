---
doc_language: Russian
size_tier: small
roles:
  specs: { write: claude, review: { mode: parallel, by: [claude, codex] } }
---

Тестовая фикстура для TC-004 (роль-матрица, 20260806-feat-role-matrix):
маленький CLI-инструмент `json-validator.sh`. `specs.md` уже написан (см.
Test Data) и содержит намеренно подставную проблему — фикстура нужна
только чтобы прогнать `/pf-check` на готовом `specs.md` и убедиться, что
`parallel`-режим объединяет находки Claude и Codex без дедупликации.
