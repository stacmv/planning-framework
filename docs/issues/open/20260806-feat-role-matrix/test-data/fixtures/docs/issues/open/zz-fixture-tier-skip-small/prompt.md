---
doc_language: Russian
size_tier: small
---

Тестовая фикстура для TC-019 (роль-матрица, 20260806-feat-role-matrix),
шаги 1-3: `size_tier: small`, без явных `roles.user_docs`/`roles.dev_docs`
и без `profile:`. Маленький CLI-инструмент `noop.sh`. Фикстура нужна, чтобы
довести issue до маршрутизации между TESTING и QA и убедиться, что обе
стадии документации резолвятся в `skip` по tier-дефолту.
