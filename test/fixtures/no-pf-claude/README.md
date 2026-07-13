# Sample Project

An ordinary project with a hand-written `CLAUDE.md` but no Planning Framework:
no `PLANNING.md`, no `docs/issues/`, no `planning/`, and no PF section inside
`CLAUDE.md`.

`detectState()` returns `'v2-or-older'` here (detect.js rule "CLAUDE.md present"),
while converge's own detector sees "no PF". Both routes must converge to the
same result (D-C).
