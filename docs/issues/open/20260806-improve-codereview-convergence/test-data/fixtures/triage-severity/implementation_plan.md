## Implementation Plan: Скрипт приветствия `tools/greet.sh`

### Overview

Один файл, одна задача: скрипт читает имя из конфигурационного файла и
печатает приветствие. Отсутствие конфигурационного файла — документированный
случай ошибки, не молчаливый пропуск.

### Files to Create/Modify

- `tools/greet.sh` — новый: `load_name()` и `greeting_message()`

### Implementation Tasks

#### Task 1: `tools/greet.sh` — чтение имени с обязательной обработкой отсутствующего файла

**Task Type:** code
**Mapped Test Cases:** TC-001
**Files:** `tools/greet.sh` — новый файл

**Implementation Notes:**
- `load_name()` читает `config/name.txt`.
- Если `config/name.txt` отсутствует — `load_name()` обязана вывести
  сообщение об ошибке в stderr и вернуть ненулевой код возврата. Это
  задокументированное поведение, а не побочная деталь: вызывающий код
  различает «имя не задано» (ошибка) и «имя задано, но пустое».
- `greeting_message()` вызывает `load_name()` и печатает `Hello, <имя>!`.

**Acceptance Criteria:**
- [x] TC-001 passes
