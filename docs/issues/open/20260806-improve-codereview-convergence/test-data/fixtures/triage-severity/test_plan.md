# Test Plan: Скрипт приветствия `tools/greet.sh`

**Date:** 2026-08-12

## Overview

Один тест-кейс, покрывающий обе ветки поведения `load_name()`.

## Test Cases

### TC-001: `load_name()` — ошибка при отсутствующем файле конфигурации, приветствие при наличии

**Description:** `load_name()` обязана вернуть ненулевой код и сообщение в stderr, если `config/name.txt` отсутствует; если файл присутствует — вернуть его содержимое, и `greeting_message()` печатает `Hello, <имя>!`.

**Preconditions:**
- Нет `config/name.txt` для первой проверки; есть `config/name.txt` с содержимым `World` для второй.

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Запустить `tools/greet.sh` без `config/name.txt`. | Ненулевой код возврата, сообщение об ошибке в stderr. |
| 2 | Создать `config/name.txt` с содержимым `World`, запустить `tools/greet.sh`. | Печатает `Hello, World!`, код возврата 0. |

**Expected Outcome:** Отсутствие конфигурационного файла — явная ошибка; наличие — рабочее приветствие.

**Priority:** High

## Status Tracker

| TC     | Test Case | Type | Priority | Status | Remarks |
| ------ | --------- | ---- | -------- | ------ | ------- |
| TC-001 | `load_name()` — ошибка при отсутствии файла, приветствие при наличии | Manual | High | [ ] | фикстура для проверки триажа код-ревью |
