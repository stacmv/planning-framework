---
doc_language: Russian
size_tier: small
roles:
  code: { write: codex, review: [claude] }
---

Тестовая фикстура для TC-012 (роль-матрица, 20260806-feat-role-matrix):
одна простая, однозначно verifiable задача — создать файл `greeting.txt` с
заданным содержимым. `implementation_plan.md` уже готов (см. Test Data) —
фикстура нужна, чтобы прогнать `/pf-execute` и убедиться, что задачу
фактически пишет Codex (`codex-companion.mjs task ... --write`), а не
Claude-субагент.
