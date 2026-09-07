# Specs: Стадия идеи (idea/spike issue types)

**Version:** 1.0
**Date:** 2026-09-02
**Status:** Draft
**Satisfies:** BRD US-01 through US-13

Документ превышает 1500 строк — разбит на индекс (этот файл) и три части,
продолжающие нумерацию секций. Каждая часть самодостаточна для чтения по
отдельности, но ссылается на секции других частей по номеру.

## Части

- **[specs-part1.md](specs-part1.md)** — §1 Обзор архитектурных решений
  (три несущих решения: таблицы стадий в `pf-idea-lenses`, `idea_tier`
  вместо `size_tier`, единственный источник каркаса
  `skills/pf/templates/project/`), §2 File/Directory Structure, §3
  Component Specs (полное поведение всех семи новых скиллов и правок
  `/pf`'s пустой папки), §4 Data Flows (ASCII-диаграммы: пустая папка,
  idea-пайплайн с двумя точками касания человека, spike-ветка при
  закрытии, front-loaded перехват вопроса), §5 Edge Cases & Constraints.
- **[specs-part2.md](specs-part2.md)** — §6 Frontmatter & document schemas
  (точные YAML-шапки `prompt.md` для idea/spike, скелеты всех шести новых
  документов с бюджетами строк по `idea_tier`, схема `open_questions.md`),
  §7 Изменения в существующих скиллах (`/pf`, `pf-check`, `pf-close`,
  `pf-git`, `pf-autopilot`, `pf-help`, `pf-brd`, `pf-update`,
  `converge-to-v3.sh`, документация фреймворка, `pf-size-tiers`,
  `pf-roles`, и полная таблица front-loaded hook-сайтов по 13 скиллам).
- **[specs-part3.md](specs-part3.md)** — §8 Tests (три новых
  статических test-файла + перечень существующих тестов, не требующих
  правок, с обоснованием), §9 Codex compatibility notes (таблица
  Claude-специфичных конструкций и переносимых альтернатив/принятых
  ограничений), §10 Traceability matrix (все 50 AC BRD → секции спека).

## Как читать

Для понимания архитектуры целиком — part1 §1 и §3 достаточно. Для
имплементации — part2 §6-§7 даёт точные точки правки существующих файлов.
Для проверки готовности — part3 §8-§10.
