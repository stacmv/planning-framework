---
doc_language: Russian
size_tier: medium
reviewers:
  brd: codex
  specs: codex
  test_plan: codex
  implementation_plan: both
  code: both
---

Тестовая фикстура для TC-010 (роль-матрица, 20260806-feat-role-matrix):
эквивалент собственного `prompt.md` этой issue **до** автомиграции — тот
же `reviewers:` блок (`brd`/`specs`/`test_plan`: codex,
`implementation_plan`/`code`: both), но без `roles:`. Используется вместо
реального `prompt.md` issue `20260806-feat-role-matrix`, поскольку тот уже
мигрирован к моменту прогона теста. Содержательное задание фикстуры —
любой маленький CLI-инструмент, например `word-count.sh`, не имеет
значения для теста автомиграции.
