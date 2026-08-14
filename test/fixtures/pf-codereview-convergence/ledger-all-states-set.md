# Findings Ledger (fixture) — every row carries an explicit State

| ID | Round | Priority | Description | State |
|--------|-------|----------|-------------------------------------------------------|----------------------|
| CR-001 | 1 | P0 | Unvalidated redirect target read from the query string | fixed |
| CR-002 | 1 | P1 | Retry loop lacks a backoff ceiling | accepted-risk |
| CR-003 | 2 | P2 | Docstring says returns none but returns an empty list | duplicate-of CR-002 |
