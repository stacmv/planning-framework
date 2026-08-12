## Implementation Plan: Утилита конфигурации `lib/config.sh` / `bin/run.sh`

### Overview

Четыре задачи: чтение конфига с обязательной обработкой отсутствующего
файла, поиск значения по ключу с обязательным предупреждением о
неизвестном ключе, валидация обязательных ключей, и точка входа,
обязанная вызвать валидацию перед использованием значений.

### Files to Create/Modify

- `lib/config.sh` — новый: `load_config()`, `get_value()`, `validate_config()`
- `bin/run.sh` — новый: точка входа
- `config/app.conf` — новый: пример конфига (`host`, `port`)

### Implementation Tasks

#### Task 1: `load_config()` — путь конфига и обработка отсутствующего файла

**Task Type:** code
**Mapped Test Cases:** TC-001
**Files:** `lib/config.sh` — новый файл, `config/app.conf` — новый файл

**Implementation Notes:**
- Путь к конфигу — `config/app.conf`, относительно корня репозитория (не
  относительно текущей рабочей директории).
- Если `config/app.conf` отсутствует — `load_config()` обязана вывести
  сообщение об ошибке в stderr и вернуть ненулевой код возврата.
- При наличии файла — построчно разобрать `key=value` в ассоциативный
  массив `CONFIG_VALUES`.

**Acceptance Criteria:**
- [x] TC-001 passes

#### Task 2: `get_value()` — поиск по ключу с предупреждением о неизвестном ключе

**Task Type:** code
**Mapped Test Cases:** TC-002
**Files:** `lib/config.sh`

**Implementation Notes:**
- `get_value(key)` возвращает значение ключа из `CONFIG_VALUES`.
- Если ключ отсутствует — возвращает пустую строку И печатает
  предупреждение в stderr. Неизвестные ключи логируются, не проглатываются
  молча.

**Acceptance Criteria:**
- [x] TC-002 passes

#### Task 3: `bin/run.sh` — точка входа, обязана вызывать валидацию перед использованием значений

**Task Type:** code
**Mapped Test Cases:** TC-003
**Files:** `bin/run.sh` — новый файл

**Implementation Notes:**
- Порядок вызовов: `load_config()`, затем `validate_config()`, и только
  потом любое использование `get_value()`.
- Валидация обязана быть вызвана всегда — не только в отладочном режиме.

**Acceptance Criteria:**
- [x] TC-003 passes

#### Task 4: `validate_config()` — проверка обязательных ключей

**Task Type:** code
**Mapped Test Cases:** TC-004
**Files:** `lib/config.sh`

**Implementation Notes:**
- `validate_config()` проверяет, что каждый ключ из списка обязательных
  (`host`, `port`) присутствует в `CONFIG_VALUES`.
- При отсутствии обязательного ключа — печатает, какой именно ключ
  отсутствует, и завершает работу с ненулевым кодом возврата.

**Acceptance Criteria:**
- [x] TC-004 passes
