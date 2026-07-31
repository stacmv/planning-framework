---
doc_language: Russian
size_tier: small
reviewers:
  brd: claude
  specs: claude
  test_plan: claude
  implementation_plan: claude
  code: codex
---

Тестовый issue для проверки молчаливого fallback на Claude: поле
`reviewers.code` установлено в `codex`, но на машине теста CLI `codex` не
установлен/недоступен и плагин `codex` недоступен в списке скиллов сессии.
Ревью кода должно тихо пройти силами Claude, с явной пометкой fallback.

Добавить сортировку по дате в списке задач.
