## Implementation Plan: greeting.txt

### Overview

Создать файл `greeting.txt` с заданным содержимым — однозначно
verifiable задача, используемая только для наблюдения за тем, какой актор
фактически выполняет запись.

### Files to Create/Modify

- `greeting.txt` — новый файл, единственное содержимое: строка `Hello from
  the resolved write actor.` (с завершающим переводом строки).

### Implementation Tasks

#### Task 1: Create greeting.txt

**Task Type:** code
**Mapped Test Cases:** TC-012
**Files:**
- `greeting.txt` - создать с содержимым `Hello from the resolved write
  actor.`

**Implementation Notes:**
- Никакой логики — файл с фиксированным содержимым.

**Acceptance Criteria:**
- [ ] TC-012 passes
