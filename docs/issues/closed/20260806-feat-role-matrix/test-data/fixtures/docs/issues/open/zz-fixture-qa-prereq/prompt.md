---
doc_language: Russian
size_tier: small
roles:
  user_docs: { write: claude, review: [claude] }
  dev_docs: { write: claude, review: [claude] }
---

Тестовая фикстура для TC-015 (роль-матрица, 20260806-feat-role-matrix):
маленький CLI-инструмент `date-stamp.sh`. `roles.user_docs`/`roles.dev_docs`
намеренно не `skip` — фикстура нужна, чтобы довести issue до стадии QA
всеми предыдущими стадиями (`/pf-brd` → ... → `/pf-codereview`), затем
запустить `/pf-qa` без `user_docs.md`/`dev_docs.md` и убедиться, что
prerequisite-проверка блокирует переход.
