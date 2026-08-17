// lib/roles-resolve.js — single-line flow-style `roles:` parsing, and the
// documented multi-line-block limitation.
//
// The module is pure (no filesystem, no `require("node:...")`), so it is
// exercised the same way `test/markdown.test.js` exercises `lib/markdown.js`:
// import it directly and check the returned objects — no server, no browser.
//
// The fixture case (step 4) is the point of this suite: `prompt.md` files in
// this repo write `roles:` in single-line flow style (see any file under
// `docs/issues/**/prompt.md`), and `test/fixtures/prompt-roles-flow.md` is a
// committed snapshot of exactly that shape, not a live glob over
// `docs/issues/open/` — a glob would make this suite flake or go stale as
// issues open and close. See specs.md §3.2 and the /pf-check finding that
// asked for this fixture.
//
// Run: node --test test/roles-resolve.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const rolesResolve = require("../lib/roles-resolve");
const { resolveRole } = rolesResolve;

const FIXTURES = path.join(__dirname, "fixtures");

function fixture(name) {
  return fs.readFileSync(path.join(FIXTURES, name), "utf8");
}

// --------------------------------------------------------------- step 1

test("single-line flow-style entry with write/review parses correctly", () => {
  const promptText = [
    "---",
    "roles:",
    "  brd: { write: claude, review: [codex] }",
    "---",
    "",
  ].join("\n");

  const result = resolveRole("brd", { promptText, agentsText: "", roleProfilesText: "" });

  assert.strictEqual(result.ok, true, `expected ok:true, got ${JSON.stringify(result)}`);
  assert.strictEqual(result.skip, false);
  assert.strictEqual(result.level, 1, "explicit roles.<key> in prompt.md is level 1");
  assert.strictEqual(result.write, "claude");
  assert.deepStrictEqual(result.review, ["codex"]);
});

// --------------------------------------------------------------- step 2

test("mode: blocking is parsed and returned on the resolution result", () => {
  const promptText = [
    "---",
    "roles:",
    "  specs: { write: codex, review: [claude], mode: blocking }",
    "---",
    "",
  ].join("\n");

  const result = resolveRole("specs", { promptText, agentsText: "", roleProfilesText: "" });

  assert.strictEqual(result.ok, true, `expected ok:true, got ${JSON.stringify(result)}`);
  assert.strictEqual(result.skip, false);
  assert.strictEqual(result.mode, "blocking");
  assert.strictEqual(result.write, "codex");
  assert.deepStrictEqual(result.review, ["claude"]);
});

// --------------------------------------------------------------- step 3

test("a bare scalar (dev_docs: skip) parses as a skip, not a format error", () => {
  const promptText = ["---", "roles:", "  dev_docs: skip", "---", ""].join("\n");

  const result = resolveRole("dev_docs", { promptText, agentsText: "", roleProfilesText: "" });

  assert.strictEqual(result.ok, true, `expected ok:true, got ${JSON.stringify(result)}`);
  assert.strictEqual(result.skip, true);
  assert.strictEqual(result.error, undefined, "a bare skip scalar must not be reported as an error");
});

// --------------------------------------------------------------- step 4

test("the committed prompt-roles-flow.md fixture resolves every key it declares", () => {
  const promptText = fixture("prompt-roles-flow.md");

  const brd = resolveRole("brd", { promptText, agentsText: "", roleProfilesText: "" });
  assert.strictEqual(brd.ok, true, `brd: ${JSON.stringify(brd)}`);
  assert.strictEqual(brd.skip, false);
  assert.strictEqual(brd.write, "claude");
  assert.deepStrictEqual(brd.review, ["codex"]);
  assert.strictEqual(brd.mode, undefined, "brd's fixture entry declares no mode");

  const specs = resolveRole("specs", { promptText, agentsText: "", roleProfilesText: "" });
  assert.strictEqual(specs.ok, true, `specs: ${JSON.stringify(specs)}`);
  assert.strictEqual(specs.skip, false);
  assert.strictEqual(specs.write, "codex");
  assert.deepStrictEqual(specs.review, ["claude"]);
  assert.strictEqual(specs.mode, "blocking");

  const code = resolveRole("code", { promptText, agentsText: "", roleProfilesText: "" });
  assert.strictEqual(code.ok, true, `code: ${JSON.stringify(code)}`);
  assert.strictEqual(code.skip, false);
  assert.strictEqual(code.write, "codex");
  assert.deepStrictEqual(code.review, ["claude"]);

  const devDocs = resolveRole("dev_docs", { promptText, agentsText: "", roleProfilesText: "" });
  assert.strictEqual(devDocs.ok, true, `dev_docs: ${JSON.stringify(devDocs)}`);
  assert.strictEqual(devDocs.skip, true);
});

// --------------------------------------------------------------- negative case

test("multi-line block-style roles.<key> never throws and never fabricates write/review", () => {
  // test/fixtures/roles-resolve-multiline.md writes roles.specs as multi-line
  // block-style YAML (write: haiku, review: [codex] on their own indented
  // lines) — the form lib/roles-resolve.js's module comment documents as
  // unsupported: parseIndentTree's childEntries() drops any child that has no
  // inline value of its own, so the `specs` key never lands in rolesEntries
  // at level 1. With no `profile:` in this fixture either, resolution falls
  // all the way through to the general default (level 5): write: claude,
  // review: [claude] — not "haiku" or "[codex]", which would mean the broken
  // block leaked into the result.
  const promptText = fixture("roles-resolve-multiline.md");

  let result;
  assert.doesNotThrow(() => {
    result = resolveRole("specs", { promptText, agentsText: "", roleProfilesText: "" });
  }, "resolving a multi-line block-style roles.<key> must never throw");

  assert.strictEqual(result.ok, true, `expected a non-throwing resolution, got ${JSON.stringify(result)}`);
  assert.notStrictEqual(result.write, "haiku", "write must not be fabricated from the dropped multi-line block");
  assert.ok(
    !Array.isArray(result.review) || !result.review.includes("codex"),
    "review must not be fabricated from the dropped multi-line block"
  );
  // The actual, documented outcome: falls through past the missing level-1
  // entry to the general default, since this fixture also has no `profile:`.
  assert.strictEqual(result.level, 5);
  assert.strictEqual(result.skip, false);
  assert.strictEqual(result.write, "claude");
  assert.deepStrictEqual(result.review, ["claude"]);
});
