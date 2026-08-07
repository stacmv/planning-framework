---
doc_language: Russian
size_tier: small
---

Тестовая фикстура для TC-013 (роль-матрица, 20260806-feat-role-matrix): та
же задача, что в TC-012 (создать `greeting.txt`), но без `roles.code` —
резолвится в дефолт `write: claude`. `implementation_plan.md` уже готов
(см. Test Data) — фикстура нужна, чтобы прогнать `/pf-execute` и
убедиться, что диспетчеризация идёт через `Agent` tool на Claude-субагента,
как и раньше, без обращения к `codex-companion.mjs`.
