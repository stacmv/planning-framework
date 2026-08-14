# Test Plan — Fixture (Check 1, duplicate Status Tracker row, CR-015, companion)

## Coverage

`TC-001` is deliberately listed TWICE below — a malformed Status Tracker,
but the exact input CR-015 requires this helper to handle safely. The
first row says `Type: Manual`; the second says `Type: Auto`. A helper that
returns only the first match's Type would read this as Manual and let an
unchecked line naming `TC-001` pass Check 1's carve-out; CR-015 requires
the opposite — any divergence between duplicate rows for the same TC-ID
must block, not silently resolve to whichever row happened to come first.

## Status Tracker

| TC     | Test Case | Type   | Priority | Status | Remarks |
| ------ | --------- | ------ | -------- | ------ | ------- |
| TC-001 | Alpha behaves as documented | Manual | Medium | [ ] | duplicate row 1 |
| TC-001 | Alpha behaves as documented | Auto | Medium | [ ] | duplicate row 2 |
