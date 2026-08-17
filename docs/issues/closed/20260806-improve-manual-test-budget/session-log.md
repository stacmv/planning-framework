[autopilot default] pf-check brd.md — Claude review (off-branch fallback, no
issue branch yet) вернуло 0 P0 и 2 P1, поэтому гейт разрешён как "Fix now" без
вопроса к человеку. Правки внесены оркестратором: уточнено, где и как
фиксируется "отложить избыток" (примечание в test_plan.md, чисто
информационное до появления реестра в 20260806-feat-product-test-plan), и
переформулирован AC-01, чтобы не приписывать ссылочной issue tier, которого у
неё нет (она предшествует полю size_tier).
@ 2026-08-13T14:05:36Z

[pf-check PASSED] brd.md @ 2026-08-13T14:05:36Z

[autopilot default] pf-check test_plan.md — Claude review (off-branch
fallback) вернуло 0 P0 и 4 P1, поэтому гейт разрешён как "Fix now" без
вопроса к человеку. Правки: Test Data у Manual TC-011/012/013 очищены от
шагов верификации в Status Tracker Remarks (тело TC уже содержало корректные
пути к fixture-файлам); добавлена строка Known Issues, поясняющая, что
харнессы/фикстуры Auto TC — задача будущего implementation_plan.md, не
дефект теста-плана; TC-006 расширен проверкой отклонения недопустимого
значения словаря (ранее это покрывал только TC-020, и только по размеру
словаря, не по отклонению).
@ 2026-08-13T14:15:22Z

[pf-check PASSED] test_plan.md @ 2026-08-13T14:15:22Z

[autopilot default] pf-check implementation_plan.md — Claude review
(off-branch fallback) вернуло 0 P0 и 2 P1, поэтому гейт разрешён как "Fix
now" без вопроса к человеку. Правки: Task 9 (manual_test_checklist.md —
документация, не автотест) перемаркирован tests → code, т.к. Task Type:
docs запрещён и заблокировал бы весь /pf-execute; добавлена Task 10 —
расширение "Claude review path" в pf-check/SKILL.md проверкой Manual-
бюджета и словаря `Manual reason` по tier, иначе ручная правка test_plan.md
в обход этого бюджета проходила бы pf-check незамеченной.
@ 2026-08-13T14:29:29Z

[pf-check PASSED] implementation_plan.md @ 2026-08-13T14:29:29Z
