---
doc_language: Russian
size_tier: small
roles:
  code: { write: claude, review: skip }
---

Тестовая фикстура для TC-017 (роль-матрица, 20260806-feat-role-matrix):
идентична TC-016 (`roles.code.review: skip` без `confirmed:`), но
`/pf-codereview` вызывается напрямую, минуя `/pf` — фикстура нужна, чтобы
убедиться, что `pf-codereview` сам запрашивает подтверждение и сам
записывает маркер `confirmed:`.
