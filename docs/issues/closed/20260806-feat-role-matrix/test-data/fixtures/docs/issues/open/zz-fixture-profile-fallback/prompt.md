---
doc_language: Russian
size_tier: small
profile: codex-implements
---

Тестовая фикстура для TC-002 (роль-матрица, 20260806-feat-role-matrix):
маленький CLI-инструмент `line-counter.sh`, считающий строки в переданном
файле. Профиль `codex-implements` (см. `docs/planning/role-profiles.yml`)
задан вместо блока `roles:` — фикстура нужна, чтобы дойти до стадии `code`
и убедиться, что точечная запись профиля (`code: {write: codex, review:
[claude]}`) резолвится корректно, а остальные стадии идут через `default`
профиля.
