---
doc_language: Russian
size_tier: small
roles:
  specs: { write: claude, review: { mode: sequential, by: [haiku, codex] } }
---

Тестовая фикстура для TC-005 (роль-матрица, 20260806-feat-role-matrix):
маленький CLI-инструмент `retry-wrapper.sh`. `specs.md` уже написан (см.
Test Data) и содержит намеренно внесённое явное противоречие двух
абзацев — фикстура нужна только чтобы прогнать `/pf-check` на готовом
`specs.md` и убедиться, что `sequential`-режим находит проблему первым
проходом (`haiku`), автоприменяет фикс актором `write` (Claude) без
запроса подтверждения, и передаёт исправленную версию второму проходу
(`codex`).
