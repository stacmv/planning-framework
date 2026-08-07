---
doc_language: Russian
size_tier: small
roles:
  code: { write: claude, review: skip, confirmed: 2026-08-01 }
---

Тестовая фикстура для TC-018 (роль-матрица, 20260806-feat-role-matrix):
`roles.code.review: skip` уже подтверждён (`confirmed: 2026-08-01`).
Фикстура нужна, чтобы довести issue до стадии QA (все прочие проверки —
PASS) и убедиться, что `/pf-qa` безусловно добавляет строку риска в
`qa_report.md`, не блокируя `PASS`-вердикт.
