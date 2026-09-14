# Session Log — 20260818-improve-project-explorer-launcher-search-and-tc-scroll

[/pf-brd] notes.md написан на тире trivial (два пункта из CR-014/CR-015).
Разведка по коду показала, что фикс перехода к тест-кейсу дешевле, чем
предполагалось: связь продуктового PTC с issue-локальным TC уже лежит в
колонке Origin продуктового тест-плана, регулярка её разбирает, но вторая
группа отбрасывается. @ 2026-09-09

[pf-check round 1, Codex] P1: тир trivial не соответствует содержанию — две
независимые функции, 7 AC, notes.md 76 строк при бюджете ~50. Пользователь
выбрал поднять тир до small (альтернативы — разделить на два issue или урезать
скоуп — отклонены). notes.md удалён, вместо него написан brd.md; технические
детали (файлы, функции) убраны из документа и уйдут в implementation_plan.md.
@ 2026-09-09

[pf-check PASSED] brd.md — раунд 2 (Codex): находок нет.
@ 2026-09-09

[pf-check, Codex] test_plan.md: verdict needs-attention — 9 findings severity=high
(→P0), 2 severity=low (→P2). P0: TC-008/TC-005 нереализуемый маршрут по
инбоксу; TC-004/TC-005 обходят контракт Origin→tcId; TC-006 принимает
aria-label без видимой подписи; TC-001 не проверяет границы поиска; нет
проверки персистентности запроса при асинхронных перерисовках; BR-2
(read-only) не в целях/трассировке; TC-007 требует конкретную сигнатуру
функции сверх AC-05; TC-009 не исключает sessionStorage/URL; TC-005 не
утверждает вызов scrollIntoView. P2: неверная ссылка TC-005→TC-009,
противоречие Preconditions/«данные не требуются» в TC-008.
[autopilot default] pf-check auto-applied Fix now — 9 P0 addressed (agent
verified fixes against brd.md и реальный код tools/manual-test-ui).
@ 2026-09-14

[pf-check PASSED] test_plan.md @ 2026-09-14T12:33:01Z

[pf-codereview round 1, Codex] verdict FAIL — CR-001 (P1, launcher search
loses focus every keystroke — full DOM rebuild on input), CR-002 (P1,
workspace TC-scroll race — concurrent render can strand highlight on a
detached checklist body), CR-003 (P2, sticky header can overlap the scrolled
TC panel).
[autopilot default] pf-codereview auto-applied Fix now — 2 P1 addressed (no
interactive user in this run; front-loaded interaction not set for this
issue, so this is a one-time autopilot default, not a recorded assumption
in prompt.md).

[pf-codereview round 2, Codex] CR-001/CR-002 confirmed fixed (regression test
added for CR-002 race, verified fails without fix). New round-2 findings,
both P2: CR-004 (narrower residual of CR-001 — typing during
loadProjectIssues()'s own async render), CR-005 (highlight discarded by a
later todo-count render before reapplication). Verdict PASS — no open
P0/P1. CR-003/CR-004/CR-005 carried to docs/planning/tech-debt.md.
@ 2026-09-14
