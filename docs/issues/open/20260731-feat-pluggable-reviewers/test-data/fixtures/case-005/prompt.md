---
doc_language: Russian
size_tier: small
reviewers:
  brd: claude
  specs: codex
  test_plan: claude
  implementation_plan: claude
  code: claude
---

Тестовый issue для проверки промежуточного звена цепочки: CLI `codex`
установлен и авторизован на машине, но плагин `codex` (скиллы
codex:setup/codex:rescue) НЕ установлен в этой сессии Claude Code. При
отказе от установки плагина ревью должно пройти через прямой вызов
`codex exec`, результат — нетронутым, отдельным неструктурированным
блоком.

Добавить сортировку по дате в списке задач.
