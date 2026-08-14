# Specs: char-count.sh

## Overview

`char-count.sh <file>` печатает число символов в файле.

## Behavior

- Реализация: `wc -m < "$1"`.
- Отсутствующий файл — код выхода 1, сообщение `ERROR: file not found`.

## Out of scope

- Подсчёт по кодировкам, отличным от UTF-8.
