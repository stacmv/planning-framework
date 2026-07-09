# Test Plan: Заменить относительные пути к pf-size-tiers на абсолютные
**Date:** 2026-07-09

## Overview
Подтверждаем: (1) все 10 вхождений `skills/pf-size-tiers/SKILL.md` в семи исходниках заменены на `~/.claude/skills/pf-size-tiers/SKILL.md`; (2) формулировки `docs/issues/open/` в `pf/SKILL.md` Steps 2 и 5 переписаны с явной CWD-привязкой; (3) контрольные grep'ы пусты; (4) установленные копии синхронизированы.

## Prerequisites
- Ветка `main` в `D:/dev/planning-framework/`, рабочее дерево чистое.
- Доступны `grep`, `diff`, и хотя бы один из `/pf-update` / `bash scripts/update-skills.sh`.

## Test Data
- Ожидаемое число вхождений `~/.claude/skills/pf-size-tiers/SKILL.md` после фикса: **10** (раскладка по строкам: TC-001 Step 1).

## Test Cases

### TC-001: Все 10 вхождений заменены на абсолютный путь
**Description:** Подтверждает замену в семи исходниках.
**Type:** Manual
**Preconditions:** AC#1 завершён.
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Прочитать: `pf-impl-plan/SKILL.md:7`, `pf-spec/SKILL.md:7`, `pf-test-plan/SKILL.md:7`, `pf-check/SKILL.md:7,19`, `pf-execute/SKILL.md:9`, `pf-brd/SKILL.md:9,21`, `pf/SKILL.md:170,190`. | В каждой — `~/.claude/skills/pf-size-tiers/SKILL.md`; относительной формы нет. |
| 2 | Подсчитать вхождения через `grep -c`. | Ровно 10 (см. Test Data). |

**Expected Outcome:** Все 10 вхождений заменены.
**Priority:** Critical

### TC-002: Формулировка `docs/issues/open/` имеет CWD-привязку
**Description:** Steps 2 и 5 в `pf/SKILL.md` не содержат голого `docs/issues/open/` без указания активного проекта.
**Type:** Auto (grep) + Manual (чтение найденных строк)
**Preconditions:** AC#2 завершён.
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `grep -n "the .docs/issues/open/. directory" D:/dev/planning-framework/skills/pf/SKILL.md`. | Печатает ровно 2 строки (Step 2 + Step 5) с актуальными номерами. |
| 2 | `grep -n "docs/issues/open" D:/dev/planning-framework/skills/pf/SKILL.md \| grep -v "active project (relative to /pf's CWD)"`. | Пустой вывод (exit 1). |
| 3 | Прочитать обе строки из Step 1 на осмысленность и английскую грамматику. | Текст осмысленный, грамматически корректный. |

**Expected Outcome:** Ни одна строка не заставляет агента интерпретировать `docs/issues/open/` как абсолютный путь от корня ФС.
**Priority:** Critical

### TC-003: Контрольные grep'ы возвращают пусто
**Description:** В исходниках не осталось относительных ссылок без замены.
**Type:** Auto
**Preconditions:** AC#1 и AC#2 завершены.
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `grep -rn 'skills/pf-size-tiers' D:/dev/planning-framework/skills/ \| grep -v '~/.claude/skills/pf-size-tiers'`. | Пустой вывод (exit 1). |
| 2 | Расширенный аудит: `grep -rn 'skills/pf-size-tiers' D:/dev/planning-framework/ --exclude-dir=.git --exclude-dir=closed \| grep -v '~/.claude/skills/pf-size-tiers'`. | Пустой вывод (exit 1). |

**Expected Outcome:** Шаги 1 и 2 пусты.
**Priority:** Critical

### TC-004: Установленные копии синхронизированы с исходниками
**Description:** Копии в `~/.claude/skills/` отражают правки.
**Type:** Auto (`diff -q`) + Manual (повтор TC-002)
**Preconditions:** Запущен `/pf-update` либо `bash D:/dev/planning-framework/scripts/update-skills.sh` (не ручной `cp`).
**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Для каждого из 7 скиллов: `diff -q ~/.claude/skills/<name>/SKILL.md D:/dev/planning-framework/skills/<name>/SKILL.md`. | Exit 0, без вывода. |
| 2 | В `~/.claude/skills/pf/SKILL.md` повторить TC-002 Step 1–2. | Проходит на установленной копии. |

**Expected Outcome:** Все семь копий актуальны; синхронизация выполнена штатным механизмом.
**Priority:** Critical

## Status Tracker

| TC     | Type   | Test Case                                                              | Priority | Status | Remarks |
| ------ | ------ | ---------------------------------------------------------------------- | -------- | ------ | ------- |
| TC-001 | Manual | Все 10 вхождений относительного пути заменены на абсолютный            | Critical | [ ]    |         |
| TC-002 | Auto   | Формулировка `docs/issues/open/` в pf/SKILL.md имеет CWD-привязку      | Critical | [ ]    |         |
| TC-003 | Auto   | Контрольные grep'ы возвращают пусто                                    | Critical | [ ]    |         |
| TC-004 | Auto   | Установленные копии синхронизированы с исходниками                     | Critical | [ ]    |         |
