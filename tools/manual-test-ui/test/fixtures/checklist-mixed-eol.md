# Manual Test Checklist

**Feature Name:** Checklist patch regression
**Issue ID:** 20260101-feat-fixture-full
**Date:** 2026-07-29

## TC-001: First case

**Prerequisites:**
- The Manual Test UI is running.

**Steps:**

| Step | Action | Expected Result | Result |
| --- | --- | --- | --- |
| 1 | Open the checklist | The checklist opens | [ ] |
| 2 | Check the first step | The box is checked | [ ] |
| 3 | Reload the page | The state survives the reload | [ ] |

**Notes:**

## TC-002: Second case

**Prerequisites:**
- The first case has been run.

**Steps:**

| Step | Action | Expected Result | Result |
| --- | --- | --- | --- |
| 1 | Open the second case | The case opens | [ ] |
| 2 | Write a note | The note is stored | [ ] |
| 3 | Close the tool | Nothing is lost | [ ] |

**Notes:**

