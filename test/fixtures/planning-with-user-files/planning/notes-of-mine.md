# Notes of mine

The Planning Framework has NEVER created a file at this path. It is mine.

Converge deletes `planning/` by WHITELIST — `{issues, scripts, templates,
FRAMEWORK.md, implementation-plan.md, session-log.md, decisions.md}` — and then
runs a plain `rmdir planning`, which succeeds only on an empty directory. So
this file must survive, `rmdir` must fail, and converge must print a WARNING
listing what is left behind (TC-018).

A second converge run must not re-migrate: detection keys on `planning/issues/`,
which by then is gone.
