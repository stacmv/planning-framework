# Implementation Plan (fixture — mismatched task numbering)

Used by TC-026 (`20260806-improve-codereview-convergence`). Reproduces
`prompt.md` item 7's second paragraph: the plan's own `Task N` labels are
numbered independently within each section, while the orchestrator's own
internal wave/dispatch bookkeeping assigns tasks a different sequential
number. A sub-agent that tried to resolve "its" task by number alone against
a file shaped like this — e.g. picking whichever text is labeled "Task 3" —
could pick the wrong one: this file legitimately contains TWO tasks both
labeled "Task 3", in different sections. This is exactly the confusion a
self-contained dispatch payload (full task content, not a bare number) must
make structurally impossible.

## Section A: Auth

#### Task 3: Add rate limiting to login endpoint

**Task Type:** code
**Mapped Test Cases:** TC-101
**Files:**
- `src/auth/login.php` - add a rate limiter

**Implementation Notes:**
- Limit to 5 attempts per minute per IP.

---

## Section B: Billing

<!-- TASK-CONTENT-START -->
#### Task 3: Add invoice PDF export

**Task Type:** code
**Mapped Test Cases:** TC-102
**Files:**
- `src/billing/invoice.php` - add PDF export

**Implementation Notes:**
- Use the existing PDF library already vendored in this repo; do not add a
  new dependency.
<!-- TASK-CONTENT-END -->

---
