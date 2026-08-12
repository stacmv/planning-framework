---
doc_language: Russian
size_tier: small
roles:
  brd: { write: claude, review: [claude] }
  test_plan: { write: claude, review: [claude] }
  implementation_plan: { write: claude, review: [claude] }
  code: { write: claude, review: [claude] }
---

Фикстур-issue для проверки поведения на пустом предмете ревью: ветка задачи
создаётся, но ни одного коммита с изменениями поверх родительской ветки в
неё не добавляется. Не настоящая рабочая задача.
