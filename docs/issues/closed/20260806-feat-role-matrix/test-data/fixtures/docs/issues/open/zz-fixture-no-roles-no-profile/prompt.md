---
doc_language: Russian
size_tier: small
---

Тестовая фикстура для TC-003 (роль-матрица, 20260806-feat-role-matrix): ни
`roles:`, ни `profile:`, ни `reviewers:` не заданы вовсе. Маленький
CLI-инструмент `uptime-stub.sh`, печатающий фиксированную строку. Фикстура
существует, чтобы подтвердить, что issue без единого поля матрицы ролей
ведёт себя ровно как до этой фичи: write:claude везде, review:[claude] по
дефолту последнего уровня fallback.
