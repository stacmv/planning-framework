# Implementation Plan

> Hyphenated name = v2. Converge renames it to `implementation_plan.md`.
>
> This bug issue has an implementation plan but NO `test_plan.md` — it is the
> exact input for TC-045: `/pf` must route it to `/pf-test-plan`, not to
> `/pf-execute`.

## Tasks

- [ ] 1. Replace `Math.floor` with `Math.ceil`
- [ ] 2. Add regression test for `total % size === 0`
- [ ] 3. Backport to the 1.x branch
