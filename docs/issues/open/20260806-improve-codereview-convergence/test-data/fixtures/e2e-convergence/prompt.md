---
doc_language: Russian
size_tier: small
review_rounds: 3
roles:
  brd: { write: claude, review: [claude] }
  test_plan: { write: claude, review: [claude] }
  implementation_plan: { write: claude, review: [claude] }
  code: { write: claude, review: [claude] }
---

Небольшая утилита конфигурации: `lib/config.sh` загружает и валидирует
key=value конфиг из `config/app.conf`, `bin/run.sh` — точка входа,
использующая эти функции.

Это фикстур-issue для сквозного прогона цикла код-ревью (найти пять
намеренных дефектов, вернуться на исправление, сойтись за 2-3 раунда) — не
настоящая рабочая задача.
