---
doc_language: Russian
size_tier: large
roles:
  brd: { write: claude, review: [codex] }
  specs: { write: codex, review: [claude], mode: blocking }
  code: { write: codex, review: [claude] }
  dev_docs: skip
---

Fixture snapshot of a `prompt.md` frontmatter block, single-line flow-style
`roles:` entries only — the format `docs/issues/**/prompt.md` files in this
repo actually write today. Committed on purpose (not a live glob over
`docs/issues/open/`) so `roles-resolve.test.js` has a stable input; see
`lib/roles-resolve.js`'s module comment for the parser limitation this
fixture exercises alongside `roles-resolve-multiline.md`.
