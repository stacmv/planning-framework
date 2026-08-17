// Resolving `roles.<key>` for one pipeline stage — the write/review actor
// for a stage, per the five-level fallback order of
// `~/.claude/skills/pf-roles/SKILL.md` §4.
//
// Design constraints, identical to `lib/roles.js` and `lib/markdown.js`:
//   * zero dependencies — no npm packages and no `node:` builtins either, so
//     the same file loads under `require` and under `<script src>` through
//     the UMD wrapper below;
//   * nothing is touched at load time — no `document`, no `window`, no I/O.
//     This module never reads a file itself: callers (server-side code) read
//     `prompt.md`, `role-profiles.yml` and `agents.yml` and pass their raw
//     text in. That is what keeps this module pure and testable from
//     `node --test` without any filesystem or browser infrastructure;
//   * pure functions, deep results — nothing here mutates its input.
//
// This is a FROM-SCRATCH minimal YAML reader, deliberately narrow in scope.
// `lib/markdown.js` already documents itself as "Deliberately not a YAML
// parser" for flat frontmatter `key: value` pairs — this module does not
// reuse that parser, because `roles:` needs one thing markdown.js's flat
// reader cannot do: nested mappings. What is supported, and nothing more:
//
//   * block-style nesting exactly two levels deep for `roles:` in
//     `prompt.md` (`roles:` -> `<key>:` -> a value) and for `actors:` in
//     `agents.yml` (`actors:` -> `<name>:` -> a value); three levels deep
//     for `profiles:` in `role-profiles.yml` (`profiles:` -> `<name>:` ->
//     `<key>:` -> a value) — never arbitrary depth;
//   * at the deepest block level, the value itself must be single-line
//     flow-style: `{ write: claude, review: [codex] }`, `[a, b]`, or a bare
//     scalar (`skip`, `claude`). The flow-style reader (`parseFlowMapping`/
//     `parseFlowList` below) is happy to recurse within *one* line — e.g.
//     `review: { mode: sequential, by: [haiku, codex] }` — but that is still
//     one line of text, not additional block indentation.
//
// Documented limitation, not a bug: multi-line block-style YAML for a
// `roles.<key>` entry —
//   roles:
//     specs:
//       write: claude
//       review:
//         - codex
// — is not read. `parseIndentTree` notices the continuation lines (indented
// deeper than the `specs:` line, which itself carries no inline value) and
// drops the `specs` entry rather than guessing at it. A caller resolving
// `specs` in this situation simply does not find a level-1 entry for it and
// falls through to level 2+ (§4) — it never sees fabricated `write`/`review`
// values, and this module never throws while reading it.
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PFRolesResolve = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ------------------------------------------------------- flow-style YAML
  //
  // The only supported multi-value forms, both single-line:
  //   flow mapping: { key: value, key2: [a, b] }
  //   flow list:    [a, b]
  // Both are exported (see bottom) as the two reusable primitives another
  // caller (a text-based line replacement, not this parser) may want.

  function parseScalar(raw) {
    var s = String(raw == null ? "" : raw).trim();
    if (s.length >= 2) {
      var first = s.charAt(0);
      var last = s.charAt(s.length - 1);
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        return s.slice(1, -1);
      }
    }
    return s;
  }

  // Split `s` on `sep` at depth 0 only — not inside `{...}`/`[...]`, and not
  // inside a quoted string. Never throws: unmatched brackets just leave
  // `depth` non-zero, which at worst merges two entries instead of crashing.
  function splitTopLevel(s, sep) {
    var parts = [];
    var depth = 0;
    var cur = "";
    var inQuote = null;
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (inQuote) {
        cur += ch;
        if (ch === inQuote) inQuote = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        inQuote = ch;
        cur += ch;
        continue;
      }
      if (ch === "{" || ch === "[") {
        depth++;
        cur += ch;
        continue;
      }
      if (ch === "}" || ch === "]") {
        depth--;
        cur += ch;
        continue;
      }
      if (ch === sep && depth === 0) {
        parts.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    parts.push(cur);
    return parts;
  }

  // First top-level (depth 0, outside quotes) ":" in `s`, or -1.
  function findTopLevelColon(s) {
    var depth = 0;
    var inQuote = null;
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (inQuote) {
        if (ch === inQuote) inQuote = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        inQuote = ch;
        continue;
      }
      if (ch === "{" || ch === "[") depth++;
      else if (ch === "}" || ch === "]") depth--;
      else if (ch === ":" && depth === 0) return i;
    }
    return -1;
  }

  /** A single value: `{...}` -> mapping, `[...]` -> list, else a bare/quoted scalar. */
  function parseValue(raw) {
    var s = String(raw == null ? "" : raw).trim();
    if (s.charAt(0) === "{" && s.charAt(s.length - 1) === "}") return parseFlowMapping(s);
    if (s.charAt(0) === "[" && s.charAt(s.length - 1) === "]") return parseFlowList(s);
    return parseScalar(s);
  }

  /**
   * Parse one single-line flow-style list, `[a, b]` (braces optional on the
   * input — a caller may hand in the inside already stripped). Values are
   * parsed recursively (`parseValue`), so `[claude, { mode: x, by: [a] }]`
   * would resolve, though the pipeline records this module reads never nest
   * a mapping inside a list. Malformed items are skipped, never thrown.
   */
  function parseFlowList(text) {
    var s = String(text == null ? "" : text).trim();
    if (s.charAt(0) === "[" && s.charAt(s.length - 1) === "]") s = s.slice(1, -1);
    var parts = splitTopLevel(s, ",");
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var item = parts[i].trim();
      if (item === "") continue;
      out.push(parseValue(item));
    }
    return out;
  }

  /**
   * Parse one single-line flow-style mapping, `{ key: value, key2: [a, b] }`
   * (braces optional on the input). A malformed entry (no top-level `:`) is
   * skipped rather than guessed at — the goal is never to fabricate a
   * partially-parsed result that could be mistaken for a valid one.
   */
  function parseFlowMapping(text) {
    var s = String(text == null ? "" : text).trim();
    if (s.charAt(0) === "{" && s.charAt(s.length - 1) === "}") s = s.slice(1, -1).trim();
    var out = {};
    if (s === "") return out;
    var entries = splitTopLevel(s, ",");
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i].trim();
      if (entry === "") continue;
      var colon = findTopLevelColon(entry);
      if (colon === -1) continue;
      var key = parseScalar(entry.slice(0, colon));
      var value = entry.slice(colon + 1).trim();
      if (!key) continue;
      out[key] = parseValue(value);
    }
    return out;
  }

  // --------------------------------------------------------- indent blocks
  //
  // A minimal indent tree, just deep enough for `roles:`/`actors:` (2
  // levels) and `profiles:` (3 levels). Any line that is not `key:` or
  // `key: value` is ignored, never throws.

  function parseIndentTree(text) {
    var normalized = String(text == null ? "" : text)
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");
    var lines = normalized.split("\n");
    var root = { indent: -1, children: [] };
    var stack = [root];
    var lineRe = /^([ \t]*)([A-Za-z0-9_.-]+):\s*(.*)$/;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line.trim() || /^\s*#/.test(line)) continue;
      var m = lineRe.exec(line);
      if (!m) continue;
      var indent = m[1].length;
      var rest = m[3];
      var node = { key: m[2], indent: indent, value: rest.trim() === "" ? null : rest, children: [] };
      while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    }
    return root.children;
  }

  function findChild(nodes, key) {
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].key === key) return nodes[i];
    }
    return null;
  }

  // The immediate children of one block node, as `{ key: rawValueString }`.
  // A child with no inline value AND further-indented children of its own
  // is multi-line block-style YAML — the documented limitation: dropped,
  // not fabricated (see module comment).
  function childEntries(node) {
    var out = {};
    for (var i = 0; i < node.children.length; i++) {
      var child = node.children[i];
      if (child.value !== null) out[child.key] = child.value;
    }
    return out;
  }

  /** `key: value` pairs directly under `blockKey:` (e.g. `actors:`), one level deep. */
  function extractBlockEntries(yamlText, blockKey) {
    var node = findChild(parseIndentTree(yamlText), blockKey);
    return node ? childEntries(node) : {};
  }

  /** `{ <profileName>: { <key>: rawValue, ... }, ... }` from `role-profiles.yml`'s `profiles:` block. */
  function extractProfilesEntries(yamlText) {
    var node = findChild(parseIndentTree(yamlText), "profiles");
    var out = {};
    if (!node) return out;
    for (var i = 0; i < node.children.length; i++) {
      var profileNode = node.children[i];
      out[profileNode.key] = childEntries(profileNode);
    }
    return out;
  }

  // A bare top-level scalar of the frontmatter, e.g. `profile:`/`size_tier:`.
  // `undefined` when the key is absent at all, `null` when present but empty.
  function topLevelScalar(frontmatterText, key) {
    var node = findChild(parseIndentTree(frontmatterText), key);
    if (!node) return undefined;
    if (node.value === null) return null;
    return parseScalar(node.value);
  }

  // ------------------------------------------------------------ frontmatter
  //
  // YAML frontmatter is only recognized on the very first line, matching
  // `lib/markdown.js`'s own rule — but this is an independent, minimal
  // reimplementation (see module comment: not reused on purpose).
  function extractFrontmatterText(fileText) {
    var normalized = String(fileText == null ? "" : fileText)
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");
    var lines = normalized.split("\n");
    if (lines[0] !== "---") return "";
    for (var i = 1; i < lines.length; i++) {
      if (lines[i] === "---" || lines[i] === "...") return lines.slice(1, i).join("\n");
    }
    return "";
  }

  // -------------------------------------------------------- actor registry

  // `docs/planning/agents.yml`'s shipped default content
  // (`~/.claude/skills/pf-roles/SKILL.md` §2), used only as a fallback when
  // a caller has no `agents.yml` text to hand in (e.g. the file does not
  // exist yet). This module never creates the file itself — it has no I/O.
  var DEFAULT_AGENTS_YAML = [
    "actors:",
    "  claude: { kind: llm, invoke: agent,  model: claude-sonnet-5 }",
    "  haiku:  { kind: llm, invoke: agent,  model: claude-haiku-4-5-20251001 }",
    "  codex:  { kind: llm, invoke: codex-companion }",
    '  gemini: { kind: llm, invoke: cli,    command: "gemini -p {prompt}" }',
  ].join("\n");

  /**
   * Resolve one actor name against `agents.yml`'s `actors:` block (falling
   * back to the shipped default actors when the name isn't found there).
   *
   * `kind: human` is not a hard-stop here: the caller (`resolveRole`) turns
   * it into a structured `{ kind: "human", inbox }` result instead of
   * throwing — see module comment and the task's `kind: human` handling.
   */
  function resolveActor(name, agentsText) {
    var explicit = extractBlockEntries(agentsText, "actors");
    var raw = Object.prototype.hasOwnProperty.call(explicit, name) ? explicit[name] : null;
    if (raw === null) {
      var fallback = extractBlockEntries(DEFAULT_AGENTS_YAML, "actors");
      raw = Object.prototype.hasOwnProperty.call(fallback, name) ? fallback[name] : null;
    }
    if (raw === null) return { ok: false, error: "unknown_actor", name: name };
    var entry = parseValue(raw);
    if (!entry || typeof entry !== "object") {
      return { ok: false, error: "unrecognized_actor", name: name };
    }
    var out = { ok: true, name: name };
    for (var k in entry) {
      if (Object.prototype.hasOwnProperty.call(entry, k)) out[k] = entry[k];
    }
    return out;
  }

  // ----------------------------------------------------------- resolution

  // `roles.code: skip` is invalid (code authorship cannot be skipped) — an
  // explicit error, never an unhandled exception (SKILL.md §1).
  function buildResult(key, record, level) {
    if (record === "skip") {
      if (key === "code") {
        return {
          ok: false,
          key: key,
          error: "invalid_skip",
          message: "roles.code: skip is invalid — code authorship cannot be skipped; did you mean code.review: skip?",
        };
      }
      return { ok: true, key: key, level: level, skip: true };
    }
    if (!record || typeof record !== "object") {
      return {
        ok: false,
        key: key,
        error: "unrecognized",
        message: "roles." + key + " could not be resolved from a recognized value.",
      };
    }
    var result = { ok: true, key: key, level: level, skip: false };
    if (record.write !== undefined) result.write = record.write;
    if (record.review !== undefined) result.review = record.review;
    if (record.run !== undefined) result.run = record.run;
    if (record.mode !== undefined) result.mode = record.mode; // blocking | non-blocking
    if (record.confirmed !== undefined) result.confirmed = record.confirmed;
    return result;
  }

  /**
   * Resolve `roles.<key>` for one pipeline stage, per the five-level
   * fallback order of `~/.claude/skills/pf-roles/SKILL.md` §4:
   *   1. explicit `roles.<key>` in `prompt.md`;
   *   2. the selected profile's point-specific entry for `<key>`;
   *   3. tier-default `skip` for `user_docs`/`dev_docs` on `trivial`/`small`;
   *   4. the selected profile's `default` entry;
   *   5. general default (`write: claude, review: [claude]`) when there is
   *      no `roles:` and no `profile:` at all.
   *
   * @param {string} key - a pipeline stage key, e.g. "specs", "code", "dev_docs".
   * @param {object} options
   * @param {string} [options.promptText] - the full raw text of `prompt.md`.
   * @param {string} [options.roleProfilesText] - the full raw text of `role-profiles.yml`.
   * @param {string} [options.agentsText] - the full raw text of `agents.yml`.
   * @param {string} [options.sizeTier] - overrides the `size_tier:` read from `prompt.md`.
   * @returns {object} one of:
   *   - `{ ok: true, key, level, skip: true }`
   *   - `{ ok: true, key, level, skip: false, write, review, run?, mode?, confirmed? }`
   *   - `{ kind: "human", inbox, key, level, mode? }` — the resolved `write` actor
   *     is a human; `mode` travels with this result exactly as it does with the
   *     non-human one (specs.md §4.1 — read "naravne s write/review/skip"),
   *     since a caller queuing a human task (`lib/inbox.js`) needs to know
   *     `blocking` vs. `non-blocking` just as much as any other caller does
   *   - `{ ok: false, key, error, message }` — an explicit, non-throwing failure
   *     (`invalid_skip`, `unrecognized`, `profile_not_found`, `no_default`)
   */
  function resolveRole(key, options) {
    var opts = options || {};
    var promptText = typeof opts.promptText === "string" ? opts.promptText : "";
    var roleProfilesText = typeof opts.roleProfilesText === "string" ? opts.roleProfilesText : "";
    var agentsText = typeof opts.agentsText === "string" ? opts.agentsText : "";

    var frontmatterText = extractFrontmatterText(promptText);
    var rolesEntries = extractBlockEntries(frontmatterText, "roles");
    var profileName = topLevelScalar(frontmatterText, "profile");
    var tier = opts.sizeTier !== undefined ? opts.sizeTier : topLevelScalar(frontmatterText, "size_tier");

    var record;
    var level;

    if (Object.prototype.hasOwnProperty.call(rolesEntries, key)) {
      // 1. explicit point-specific roles.<key> in prompt.md.
      record = parseValue(rolesEntries[key]);
      level = 1;
    } else if (profileName) {
      var profiles = extractProfilesEntries(roleProfilesText);
      var profile = profiles[profileName];
      if (!profile) {
        return {
          ok: false,
          key: key,
          error: "profile_not_found",
          message: "Profile '" + profileName + "' was not found in role-profiles.yml.",
        };
      }
      if (Object.prototype.hasOwnProperty.call(profile, key)) {
        // 2. the selected profile's point-specific entry for <key>.
        record = parseValue(profile[key]);
        level = 2;
      } else if ((key === "user_docs" || key === "dev_docs") && (tier === "trivial" || tier === "small")) {
        // 3. tier-default skip for user_docs/dev_docs.
        record = "skip";
        level = 3;
      } else if (Object.prototype.hasOwnProperty.call(profile, "default")) {
        // 4. the selected profile's default entry.
        record = parseValue(profile["default"]);
        level = 4;
      } else {
        return {
          ok: false,
          key: key,
          error: "no_default",
          message: "Profile '" + profileName + "' has no point-specific or default entry for '" + key + "'.",
        };
      }
    } else {
      // 5. general default — no roles.<key>, no profile: at all.
      record = { write: "claude", review: ["claude"] };
      level = 5;
    }

    var result = buildResult(key, record, level);
    if (!result.ok || result.skip) return result;

    if (result.write) {
      var actor = resolveActor(result.write, agentsText);
      if (actor.ok && actor.kind === "human") {
        var humanResult = { kind: "human", inbox: actor.inbox, key: key, level: result.level };
        if (result.mode !== undefined) humanResult.mode = result.mode;
        return humanResult;
      }
    }

    return result;
  }

  return {
    resolveRole: resolveRole,
    resolveActor: resolveActor,
    // Reusable low-level primitives (e.g. for POST .../reassign, a
    // text-based line replacement rather than a parser-based consumer).
    parseFlowMapping: parseFlowMapping,
    parseFlowList: parseFlowList,
    // Other pieces, exposed for tests and for callers that need less than
    // the full resolution (e.g. just the profile table).
    parseValue: parseValue,
    parseIndentTree: parseIndentTree,
    extractFrontmatterText: extractFrontmatterText,
    extractBlockEntries: extractBlockEntries,
    extractProfilesEntries: extractProfilesEntries,
    topLevelScalar: topLevelScalar,
  };
});
