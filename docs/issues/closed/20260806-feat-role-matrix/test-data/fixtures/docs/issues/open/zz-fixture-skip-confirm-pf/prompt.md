---
doc_language: Russian
size_tier: small
roles:
  code: { write: claude, review: skip }
---

Тестовая фикстура для TC-016 (роль-матрица, 20260806-feat-role-matrix):
`roles.code.review: skip` вписан вручную, без `confirmed:`. Фикстура нужна,
чтобы запустить `/pf` и убедиться, что скилл обнаруживает пропуск ревью
кода без подтверждения и задаёт вопрос через `AskUserQuestion`.
