# Manual Test Checklist

**Feature Name:** Sections the parser does not understand
**Issue ID:** 20260101-feat-fixture-full

## TC-001: Case followed by content the parser ignores

**Prerequisites:**
- Nothing in particular.

**Steps:**

| Step | Action | Expected Result | Result |
| --- | --- | --- | --- |
| 1 | Do the first thing | It happens | [ ] |
| 2 | Do the second thing | It happens too | [ ] |

**Notes:**

Свободная проза между тест-кейсами. Парсер её не разбирает и не
должен разбирать: она обязана пережить точечную правку без единого
изменённого байта, включая это выравнивание   и   двойные  пробелы.

| Параметр | Значение |
| --- | --- |
| timeout | 30s |
| retries | 3 |

## TC-002: Case after the unknown content

**Prerequisites:**
- The previous case has been read.

**Steps:**

| Step | Action | Expected Result | Result |
| --- | --- | --- | --- |
| 1 | Do the third thing | It happens as well | [ ] |

**Notes:**
