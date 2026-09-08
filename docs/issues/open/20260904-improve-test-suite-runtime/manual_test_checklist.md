# Manual Test Checklist

**Feature Name:** Ускорение прогона `make test` (20260904-improve-test-suite-runtime)
**Issue ID:** 20260904-improve-test-suite-runtime
**Date:** 2026-09-08
**Tester:**

---

## How to use

This checklist walks you through testing a specific feature by hand.

1. Read through each test section before you start so you know what to expect.
2. Set up any prerequisites listed at the top of each test — if you cannot complete a prerequisite, stop and ask the developer before continuing.
3. Follow the steps in order. After each step, check the "Expected Result" column and write what actually happened in the "Result" column.
4. Mark the checkbox `[x]` if the step behaved as expected, or leave it `[ ]` if something was wrong.
5. Use the Notes line at the bottom of each test to record anything unusual, even if the test passed.
6. When you finish all tests, hand this document back to the developer.

---

## TC-008: Environment hypothesis is measured

**Prerequisites:**
- Windows 11 machine with access to Dev Drive (optional)
- Access to Windows Security → Virus & threat protection → Manage settings → Exclusions
- Prepared data: none

**Test Data:** none

**Steps:**

| Step | Action | Expected Result | Result |
|------|--------|-----------------|--------|
| 1 | Identify measurement approach: either (a) move `TMPDIR` to a Windows Dev Drive path, or (b) add `D:\dev\planning-framework` to Windows Defender exclusions | Approach defined | [ ] |
| 2 | Record current `make test` wall-clock time (run `time make test` and note the real time in seconds) | Timing data collected (T1 baseline) | [ ] |
| 3 | Apply the environment change: (a) set `TMPDIR=/path/to/dev-drive` and run `make test` again, OR (b) add the exclusion and run `make test` again | Change applied | [ ] |
| 4 | Record the new `make test` wall-clock time (T2) | Timing data collected (T2) | [ ] |
| 5 | Compare: if T2 < T1 by more than ~15%, the hypothesis is confirmed. Otherwise not confirmed. Record the result in the issue's `brd.md` (replace "Pending" with "confirmed" or "not confirmed") | Result written to brd.md | [ ] |
| 6 | If hypothesis is confirmed: add the recommended setting note to `brd.md` under Hypothesis Measurement Protocol section | Note present | [ ] |

**Notes:**

---
