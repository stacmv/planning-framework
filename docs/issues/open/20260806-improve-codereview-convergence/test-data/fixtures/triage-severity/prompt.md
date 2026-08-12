---
doc_language: Russian
size_tier: small
roles:
  brd: { write: claude, review: [claude] }
  test_plan: { write: claude, review: [claude] }
  implementation_plan: { write: claude, review: [claude] }
  code: { write: claude, review: [claude] }
---

Небольшая утилита приветствия: скрипт `tools/greet.sh` читает имя из
`config/name.txt` и печатает приветствие. Если файл конфигурации
отсутствует, скрипт обязан сообщить об ошибке (ненулевой код возврата,
сообщение в stderr), а не тихо напечатать пустое приветствие.

Это фикстур-issue для проверки триажа код-ревью (различение находки со
сценарием отказа и находки без него) — не настоящая рабочая задача.
