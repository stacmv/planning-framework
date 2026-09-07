---
size_tier: large
roles:
  specs:
    write: haiku
    review: [codex]
---

Negative-case fixture for `roles-resolve.test.js`: `roles.specs` is written as
multi-line block-style YAML, which `lib/roles-resolve.js` documents as an
unsupported form (module comment, "Documented limitation, not a bug"). The
parser must drop this entry rather than fabricate a partially-parsed result.
