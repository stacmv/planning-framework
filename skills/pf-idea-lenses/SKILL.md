---
name: pf-idea-lenses
description: Reference data — idea_tier dictionary, lens sets, critique-persona sets, document budgets, and stage tables for the idea/spike pipelines. Not normally invoked directly.
version: 3.0.0
---

This skill is reference data for other Planning Framework skills. It is not meant
to be run directly. If invoked directly, just print the tables below.

It is read by `pf-idea`, `pf-idea-research`, `pf-idea-critique`, `pf-idea-verdict`,
`pf-idea-spike`, `pf-check` and `~/.claude/skills/pf/SKILL.md` — none of these
skills keep their own copy of any table below; they reference this skill by name
instead (decision (A) of this issue's `specs.md`: the stage tables for
`idea`/`spike` live here, not in `/pf`, which is already close to its own size
budget).

## 1. `idea_tier` — closed dictionary

| `idea_tier` | Когда выбирать |
|---|---|
| `personal` | Личный инструмент/скрипт для себя, без внешних пользователей и без рыночного контекста |
| `infra` | Внутренний инструмент/автоматизация для существующих проектов — не продукт, но нужна операционная надёжность |
| `content` | Контентный проект (блог, курс, рассылка) — успех определяется аудиторией/дистрибуцией, не рынком в классическом смысле |
| `product` | Продукт с внешними пользователями/рынком — полный набор бизнес-линз |

No fifth value exists. A `prompt.md` with any other `idea_tier` value is invalid.

## 2. Lens sets by `idea_tier`

| Линза | personal | infra | content | product |
|---|:---:|:---:|:---:|:---:|
| 5 почему (по боли) | ✓ | ✓ | ✓ | ✓ |
| SWOT (лёгкий) | — | ✓ | ✓ | ✓ |
| Build vs. Buy | — | ✓ | — | — |
| Audience/Distribution Fit | — | — | ✓ | — |
| Lean Canvas | — | — | — | ✓ |
| JTBD | — | — | — | ✓ |
| Pre-mortem | — | — | — | ✓ |
| TAM/SAM/SOM | — | — | — | ✓ |

"5 почему" обязательна для всех (AC-04b, дословно). `personal` не получает
ни SWOT, ни рыночных оценок (AC-04b, дословно). Остальное — дизайн-решение
спека этого issue.

## 3. Critique-persona sets by `idea_tier`

| Персона | personal | infra | content | product |
|---|:---:|:---:|:---:|:---:|
| Скептик-инвестор | ✓ | ✓ | ✓ | ✓ |
| Целевой пользователь | ✓ | ✓ | ✓ | ✓ |
| Техлид | ✓ | ✓ | ✓ | ✓ |
| Безопасник | ✓ | ✓ | ✓ | ✓ |
| Эксплуатация/надёжность | — | ✓ | — | — |
| Рыночный аналитик/конкурент | — | — | — | ✓ |
| Аудитория/дистрибуция | — | — | ✓ | — |

Базовые четыре — минимум US-06a (дословно). Расширение по `idea_tier` —
дизайн-решение спека этого issue (BRD делегирует состав расширения
`pf-idea-lenses`, US-06a: "набор ролей может расширяться по `idea_tier`").

## 4. Document budgets — the single source

| Документ | personal | infra | content | product |
|---|---|---|---|---|
| `idea.md` | ≤150 | ≤200 | ≤200 | ≤300 |
| `research.md` | ≤80 | ≤120 | ≤120 | ≤200 |
| `critique.md` | ≤200 | ≤250 | ≤250 | ≤300 |
| `verdict.md` | ≤60 | ≤100 | ≤100 | ≤100 |
| `hypothesis.md` | ≤50 | ≤60 | ≤60 | ≤80 |
| `findings.md` | ≤80 | ≤120 | ≤120 | ≤150 |

These are line-count budgets, same unit as `pf-size-tiers`' budgets for
feat/improve/bug documents. `pf-check`, for a TARGET in this table's row
list, reads `idea_tier` from `prompt.md` and compares against this table —
never against `pf-size-tiers`' budgets, which apply to `size_tier`-bearing
issue types only.

## 5. Stage tables

```
idea:  CREATE(prompt.md) → /pf-idea(idea.md) → /pf-check
       → /pf-idea-research(research.md) → /pf-idea-critique(critique.md)
       → /pf-idea-verdict[режим 1](verdict.md) → /pf-check
       → /pf-idea-verdict[режим 2, сессия решения] → /pf-close

spike: CREATE(prompt.md) → /pf-idea-spike[режим 1](hypothesis.md)
       → /pf-idea-spike[режим 2](findings.md) → /pf-close
```

| Позиция (первая незавершённая стадия) | Next step |
|---|---|
| CREATE only | `/pf-idea` (`/pf-idea-spike` для spike) |
| IDEA | `/pf-check` |
| IDEA + check passed | `/pf-idea-research` |
| RESEARCH | `/pf-idea-critique` |
| CRITIQUE | `/pf-idea-verdict` |
| VERDICT (документ написан, check ещё не пройден) | `/pf-check` |
| VERDICT + check passed, "## Decision" отсутствует | `/pf-idea-verdict (decision session)` |
| VERDICT + check OPEN после override (§3.5.2, п.6-8) | `/pf-check` |
| VERDICT + "## Decision" присутствует | `/pf-close` |

| Позиция (spike) | Next step |
|---|---|
| CREATE only | `/pf-idea-spike` |
| HYPOTHESIS | `/pf-idea-spike` |
| FINDINGS | `/pf-close` |

**Почему `/pf-check` только после `idea.md` и после `verdict.md`
(decision 3).** Четыре довода, каждый — самостоятельная причина не
вставлять check после `research.md`/`critique.md`:
1. **Короткий прогон — явная цель фреймворка** (G6/prompt.md constraint 3:
   "человек только в начале и в конце"; automated-check gates добавляют
   раунды `Fix now`, которые в автопилоте не бесплатны по времени, даже
   будучи неинтерактивными).
2. **`idea.md`** — единственная точка, где ошибка **дёшево исправить
   рано**: если позиционирование идеи в принципе кривое, это должно
   всплыть до того, как `research`/`critique` потратят усилия на
   исследование и критику неверно сформулированной идеи.
3. **`research.md`'s собственная дисциплина уже есть встроенный гейт** —
   AC-05b делает "проверено без источника" структурно невозможной записью
   самим скиллом (§3.3, п.3), а не чем-то, что нужно поймать отдельным
   ревью после факта.
4. **`critique.md`'s весь смысл — уже и есть adversarial-проверка** —
   ещё один общий P0/P1-ревью поверх документа, чья единственная функция
   — противоречить идее с разных точек зрения, структурно избыточен.
5. **`verdict.md`** — последний документ перед тем, как решение увидит
   человек: ошибка здесь (неверно посчитанные допущения, пропущенное
   возражение из сводной таблицы критики) — это ровно то, что должно быть
   поймано **до**, а не во время сессии решения, где переделка стоит
   дороже (нужно заново показывать батч).

**Почему у `spike` нет обязательного `/pf-check` вообще.** Настоящий
гейт качества спайка — не текстовое ревью, а AC-09c ("findings
подтверждены реальным прогоном"), встроенный в саму `pf-idea-spike`
(§3.6, п.4) тем же способом, что и `research.md`'s встроенная дисциплина
источников. `/pf-check` остаётся доступным **по требованию** — US-11d
требует, чтобы гейт для документов idea/spike **работал**, не чтобы он
**был обязателен в маршруте**; TARGET↔key отображение (§7.2) делает его
пригодным для ручного/автопилотного вызова на `hypothesis.md`/`findings.md`,
просто маршрутная таблица его туда не вставляет по умолчанию.

## 6. Verdict dictionary — closed vocabulary

`project` / `spike-first` / `defer` / `archive` — closed list (BRD
decision, AC-07a). `defer` carries free-text return conditions, no dates
(specs-part1.md §3.5, п.2).

This deliberately **differs** from the wording in `prompt.md`
("`incubate-until:<дата>`"): the `incubate-until` form is **not** part of
this dictionary. The divergence is intentional, resolved in favor of the
related "decisions already made" item (AC-07a, п.5) — the Planning
Framework does not store dates and does not know about an incubator (BRD
Non-Goals, prompt.md constraint 4). A verdict value of `incubate-until` (or
any date-bearing variant) anywhere in the pipeline is a regression to the
overridden wording, not a valid fifth verdict.
