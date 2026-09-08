# Implementation Plan: Ускорение прогона `make test`

## Overview

Задача: сократить полный прогон `make test` с ~23 мин до 5–7 мин на Windows 11 + Git Bash, реализовав все 6 согласованных мер ускорения. Покрытие не уменьшается; `shellcheck` переносится в отдельную цель `make lint`.

## Files to Create/Modify

| File | Action |
|---|---|
| `test/lib.sh` | Modify `snapshot_tree` (measure 1), add `pf_repo_copy_reset` (measure 3) |
| `Makefile` | Add `lint` target (measure 2), parallel suite execution (measure 5) |
| `scripts/converge-to-v3.sh` | Fork diet in `t7_skills` and `t6_mirror_templates` (measure 4) |
| `test/docs-refs.sh` | Remove `shellcheck` invocation (measure 2) |
| `docs/issues/open/20260904-improve-test-suite-runtime/*.md` | Document environment hypothesis result (measure 6) |

---

## Implementation Tasks

### Task 1 — `snapshot_tree`: один конвейер вместо цикла с форками

**Task Type:** code

**Mapped Test Cases:** TC-006 (measure 1), TC-007 (existing invariants)

**Files:** `test/lib.sh`

**Implementation Notes:**

Текущая реализация (`lib.sh:321-342`) запускает subshell + `sha256sum` + `cut` в цикле `while read`, что даёт ~3 форка на файл. Замена на конвейер:

```bash
snapshot_tree() {
  local dir="$1"
  (
    cd "$dir" 2>/dev/null || { printf 'MISSING %s\n' "$dir"; exit 0; }
    # Файлы — один конвейер: find → sort → xargs sha256sum
    find . -name .git -prune -o -type f -print0 | \
      LC_ALL=C sort -z | \
      xargs -0 sha256sum | \
      while IFS=' ' read -r hash _ path; do
        printf 'f %s %s\n' "${path#.}" "$hash"
      done
    # Каталоги
    find . -name .git -prune -o -type d -print0 | \
      LC_ALL=C sort -z | \
      while IFS= read -r -d '' p; do
        [ "$p" = "." ] && continue
        printf 'd %s\n' "${p#.}"
      done
    # Симлинки
    find . -name .git -prune -o -type l -print0 | \
      LC_ALL=C sort -z | \
      while IFS= read -r -d '' p; do
        printf 'l %s -> %s\n' "$p" "$(readlink "$p")"
      done
  )
}
```

Обе стороны сравнения (`assert_tree_identical`) используют одну функцию — формат манифеста детерминирован, семантика сохранена. Других потребителей `snapshot_tree` нет.

**Acceptance Criteria:**
- [ ] `snapshot_tree` использует `xargs -0 sha256sum` для файлов, не запуская subshell на каждый файл
- [ ] Формат манифеста (префикс `f/d/l`, хеш) не изменился
- [ ] `make test` проходит, все `assert_tree_identical` зелёные

---

### Task 2 — `shellcheck` из `docs-refs.sh` в отдельную цель `make lint`

**Task Type:** code

**Mapped Test Cases:** TC-003, TC-004, TC-005, TC-006 (measure 2)

**Files:** `Makefile`, `test/docs-refs.sh`

**Implementation Notes:**

В `Makefile` добавляется:

```make
.PHONY: lint
lint:
	@if command -v shellcheck >/dev/null 2>&1; then \
	  shellcheck scripts/*.sh test/*.sh; \
	else \
	  echo "ERROR: shellcheck is not installed — install it to run make lint" >&2; \
	  exit 1; \
	fi
```

`shellcheck` вызывается с полным путём `shellcheck scripts/*.sh test/*.sh` — именно так, как сейчас в `docs-refs.sh:223`, но в отдельной цели. `docs-refs.sh:220-231` удаляется (шаг `TC-039 step 9` с `pf_note` о skipped-состоянии убирается). Если `shellcheck` недоступен, `make lint` завершается с ненулевым кодом — в отличие от текущего `pf_note` в `docs-refs.sh`, который проходит молча.

**Acceptance Criteria:**
- [ ] `make lint` существует и гоняет `shellcheck scripts/*.sh test/*.sh`
- [ ] `make lint` завершается ошибкой, если `shellcheck` недоступен
- [ ] `make test` больше не запускает `shellcheck`
- [ ] `test/docs-refs.sh` не содержит вызова `shellcheck`

---

### Task 3 — Восстановление через `git checkout` вместо повторного `cp -a`

**Task Type:** code

**Mapped Test Cases:** TC-006 (measure 3), TC-007 (existing invariants)

**Files:** `test/lib.sh`, `test/pf-idea-semantic-mutations.sh`

**Implementation Notes:**

В `test/lib.sh` добавляется новая функция `pf_repo_copy_reset`, которая восстанавливает уже созданную копию репозитория вместо создания новой:

```bash
# pf_repo_copy_reset <existing_copy> — reset an existing repo copy to pristine state.
# Uses git checkout + git clean (1-2 s vs 17 s for a full cp -a).
pf_repo_copy_reset() {
  local copy="${1:?pf_repo_copy_reset: path required}"
  git -C "$copy" checkout -- . 2>/dev/null || true
  git -C "$copy" clean -fdx -q 2>/dev/null || true
}
```

В `test/pf-idea-semantic-mutations.sh` (4 вызова `pf_repo_copy`, строка 95) первый вызов остаётся `pf_repo_copy`, последующие используют `pf_repo_copy_reset "$target_repo"`. Первая копия — полный `cp -a` (нужен свежий `.git` для мутаций), все последующие — `git checkout -- . && git clean -fdx`.

Других потребителей `pf_repo_copy` в `test/*.sh` нет — проверяется `grep -rn 'pf_repo_copy' test/*.sh`.

**Acceptance Criteria:**
- [ ] `pf_repo_copy_reset` создана в `test/lib.sh`
- [ ] `test/pf-idea-semantic-mutations.sh` использует `pf_repo_copy` один раз, затем `pf_repo_copy_reset` для последующих итераций
- [ ] `make test` проходит, S-5 invariant не нарушен

---

### Task 4 — Форк-диета в `scripts/converge-to-v3.sh`

**Task Type:** code

**Mapped Test Cases:** TC-006 (measure 4), TC-007 (existing invariants)

**Files:** `scripts/converge-to-v3.sh`

**Implementation Notes:**

Две зоны оптимизации:

**`t7_skills` (~:981):** вместо 21 пары `mkdir + cp -r` — один `cp -r` со списком:

```bash
t7_skills() {
  local skills_dir="$HOME/.claude/skills" src
  mkdir -p "$skills_dir"
  # Одна команда копирования: все скиллы за один проход
  cp -r "${SKILLS_SRC}"/*/ "$skills_dir/"
  ...
}
```

**`t6_mirror_templates` (~:945):** per-file `mkdir -p "$(dirname "$rel")"` + `cp` (18 файлов × 3 форка) заменяется на батч `mkdir -p` + tar-pipe:

```bash
t6_mirror_templates() {
  local dst="$TARGET/docs/planning/templates"
  mkdir -p "$dst"
  # Собрать все подкаталоги одной командой
  (cd "$TEMPLATES_SRC" && find . -type d -print0 | LC_ALL=C sort -z | \
    xargs -0 -I{} mkdir -p "$dst/{}")
  # Один tar-pipe вместо 18 cp
  (cd "$TEMPLATES_SRC" && tar --null -cf - -T -) | \
    (cd "$dst" && tar -xf -)
  ...
}
```

Семантика `mirror-not-overlay` (фаза удаления stale-файлов) не трогается. Защита от коллизий файл/каталог сохранена.

**Acceptance Criteria:**
- [ ] `t7_skills` использует один `cp -r` вместо цикла с `mkdir`+`cp`
- [ ] `t6_mirror_templates` использует батч-операции (tar-pipe или батч `mkdir`), не per-file форки
- [ ] `make test` проходит — все T1–T11Invariant остаются зелёными

---

### Task 5 — Параллельный запуск сьютов в Makefile (`xargs -0 -P`)

**Task Type:** code

**Mapped Test Cases:** TC-006 (measure 5), TC-009 (parallel output integrity), TC-007

**Files:** `Makefile`, `test/lib.sh`

**Implementation Notes:**

Текущий `test:` — последовательный цикл по `test/*.sh`. Меняется на:

```make
test:
	@... collect suite names into a temp file, one per line ...
	@... run suites via xargs with per-suite logs ...
	@rc=0; \
	suites=$$(ls test/*.sh 2>/dev/null | grep -v lib.sh | grep -v converge-migrate.sh | \
	  while read -r t; do ... done | sort); \
	printf '%s\n' "$$suites" >/tmp/pf-test-suites.txt; \
	< /dev/null xargs -0 -P 4 -I {} \
	  bash -c 'printf "\n=== %s\n" "{}"; bash "{}"' < /tmp/pf-test-suites.txt; \
	... aggregate exit codes ...
```

Каждый сьют пишет в собственный лог-файл (`/tmp/pf-suite-NAME.log`), вывод собирается в стабильном порядке (алфавитная сортировка имён сьютов) — эквивалент последовательной конкатенации. Это гарантирует, что `pf_pass`/`pf_fail` строки не перемешиваются между параллельными процессами, и TC-ID matching через `pf_test` сохраняется.

`-P 4` — начальное значение; по результатам замера (AC-01) корректируется на `-P 6`, `-P 8` если машина выдерживает.

**Acceptance Criteria:**
- [ ] `make test` запускает сьюты параллельно (проверка: `grep -c 'xargs -P' Makefile`)
- [ ] Каждый сьют пишет в отдельный лог-файл
- [ ] Финальный вывод — стабильная конкатенация логов, не смешанные потоки
- [ ] `make test 2>&1 | grep -o 'pf_[a-z_]*'` возвращает все строки без пропусков
- [ ] `/pf-test` skill разрешает TC-ID корректно

---

### Task 6 — Замер и документирование гипотезы об окружении

**Task Type:** code (measurement + documentation)

**Mapped Test Cases:** TC-008, TC-010

**Files:** `docs/issues/open/20260904-improve-test-suite-runtime/implementation_plan.md` (this file)

**Implementation Notes:**

Гипотеза: расположение `$TMPDIR` на Windows 11 Dev Drive (ReFS) или в каталоге с исключением Defender уменьшает sys-время (сигнатура «sys много больше user» в профиле указывает на сканирование).

Замер: один контролируемый прогон `time make test` с `TMPDIR=/path/to/dev-drive` vs стандартный `TMPDIR`. Разница фиксируется. Результат (подтверждена/не подтверждена) записывается в этот issue.

Автоматизация применения настроек ОС — вне скоупа. Если гипотеза подтверждена, в issue добавляется заметка для разработчика с рекомендуемыми настройками.

**Acceptance Criteria:**
- [ ] Выполнен один контролируемый замер (with/without Dev Drive или исключение Defender)
- [ ] Результат записан в issue: hypothesis confirmed / not confirmed
- [ ] Если подтверждена — рекомендуемая настройка указана
- [ ] Никаких изменений ОС или автоматизации их применения

---

## Итог

**Task count:** 6 задач (по одной на каждую меру ускорения)

**Files touched:**
- `test/lib.sh` — Tasks 1, 3
- `Makefile` — Tasks 2, 5
- `scripts/converge-to-v3.sh` — Task 4
- `test/docs-refs.sh` — Task 2
- `docs/issues/open/20260904-improve-test-suite-runtime/implementation_plan.md` — Task 6

**Complexity estimate:** medium

Причина: мера 4 затрагивает production-скрипт конвергенции (покрыт T1–T11 и TC-007, но требует аккуратности в зонах mirror/stale-delete). Мера 5 требует надёжной изоляции логов параллельных процессов и агрегации без перемешивания потоков. Остальные меры — точечные правки с низким риском.
