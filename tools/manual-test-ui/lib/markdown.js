// Minimal markdown renderer for the Manual Test UI.
//
// Design constraints (see implementation_plan.md, Task 2):
//   * zero dependencies — no npm packages and no node: builtins either, so
//     the very same file is loadable from Node (`require`) and from a browser
//     (`<script src="/lib/markdown.js">`) through the UMD wrapper below;
//   * nothing is touched at load time except the wrapper's own globals — no
//     `document`, no `window`, no I/O — which is what makes the module
//     testable from `node --test` without any browser infrastructure;
//   * HTML is escaped in the *whole* source text first, markup is parsed
//     afterwards. Document content is arbitrary text and must never be able
//     to become an executable element, so escaping cannot be a per-construct
//     decision that a future edit might forget.
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PFMarkdown = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ---------------------------------------------------------------- escaping

  var ESCAPE_MAP = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (ch) {
      return ESCAPE_MAP[ch];
    });
  }

  // Line endings are normalized before anything else: a CRLF document must
  // render byte-for-byte identically to its LF twin.
  function normalizeEol(text) {
    return String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  }

  // ------------------------------------------------------------------- urls

  // Only these schemes may become a clickable href. Anything else (notably
  // `javascript:`) is rendered as plain text without an href.
  var SAFE_SCHEME_RE = /^(?:https?|mailto|tel):/;
  var ANY_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/;

  function safeUrl(url) {
    var raw = String(url).trim();
    // Whitespace and control characters are dropped for the scheme probe
    // only, so a tab spliced into "java<TAB>script:" cannot slip past the
    // check. Built by char code rather than by a regex escape so the source
    // file itself stays free of literal control characters.
    var probe = "";
    for (var i = 0; i < raw.length; i++) {
      if (raw.charCodeAt(i) > 32) probe += raw.charAt(i);
    }
    probe = probe.toLowerCase();
    if (SAFE_SCHEME_RE.test(probe)) return raw;
    if (ANY_SCHEME_RE.test(probe)) return null; // unknown scheme -> not a link
    return raw; // relative path, anchor, query
  }

  // ----------------------------------------------------------------- inline

  // Sentinel for stashed inline fragments. U+E000 is in the private use area:
  // it never occurs in a real document, and any stray copy in the input is
  // stripped by render() before parsing starts.
  var SENTINEL = String.fromCharCode(0xe000);
  var RESTORE_RE = new RegExp(SENTINEL + "(\\d+)" + SENTINEL, "g");
  var HAS_STASH_RE = new RegExp(SENTINEL + "\\d+" + SENTINEL);
  // A literal pipe carried out of a table cell. GFM resolves "\|" while
  // splitting cells, i.e. before inline parsing, so the pipe survives even
  // inside a code span — which is exactly why the token is restored last.
  var PIPE_TOKEN = SENTINEL + "pipe" + SENTINEL;
  var PIPE_TOKEN_RE = new RegExp(PIPE_TOKEN, "g");

  // Backslash escapes. The text is already HTML-escaped by the time inline
  // parsing runs, so the entity forms have to be listed alongside the raw
  // punctuation (`\>` in the source reads as `\&gt;` here).
  var BACKSLASH_RE = /\\(&gt;|&lt;|&amp;|&quot;|&#39;|[\\`*_{}[\]()#+\-.!|~])/g;
  var CODE_RE = /(`+)([^\n]*?)\1/g;
  // The URL group tolerates one level of balanced parentheses so that
  // "(javascript:alert(1))" is captured whole and not cut at the inner ")".
  var URL_GROUP = "((?:[^()\\s]|\\([^()\\s]*\\))*)";
  var TITLE_GROUP = "(?:\\s+&quot;([^)]*)&quot;)?";
  var IMAGE_RE = new RegExp("!\\[([^\\]]*)\\]\\(" + URL_GROUP + TITLE_GROUP + "\\)", "g");
  var LINK_RE = new RegExp("\\[([^\\]]*)\\]\\(" + URL_GROUP + TITLE_GROUP + "\\)", "g");

  function renderInline(text) {
    var stash = [];
    function put(html) {
      stash.push(html);
      return SENTINEL + (stash.length - 1) + SENTINEL;
    }

    var out = String(text);

    // 1. Inline code first: its content is opaque, and backslash escapes do
    //    not apply inside it, so a documented regex like `\d{3}\.\d+` keeps
    //    its backslashes.
    out = out.replace(CODE_RE, function (m, ticks, code) {
      return put("<code>" + code + "</code>");
    });

    // 2. Backslash escapes are stashed verbatim so the escaped character can
    //    never be re-read as markup.
    out = out.replace(BACKSLASH_RE, function (m, ch) {
      return put(ch);
    });

    // 3. Images, then links (images first: `![x](y)` must not be read as
    //    "!" followed by a link).
    out = out.replace(IMAGE_RE, function (m, alt, url, title) {
      var href = safeUrl(url);
      if (href === null) return put(alt);
      var attrs = ' src="' + href + '" alt="' + alt + '"';
      if (title) attrs += ' title="' + title + '"';
      return put("<img" + attrs + ">");
    });
    out = out.replace(LINK_RE, function (m, label, url, title) {
      var href = safeUrl(url);
      if (href === null) return put(label); // e.g. javascript: — text only
      var attrs = ' href="' + href + '"';
      if (title) attrs += ' title="' + title + '"';
      return put("<a" + attrs + ">" + label + "</a>");
    });

    // 4. Emphasis.
    out = out.replace(/~~([^~]+)~~/g, "<del>$1</del>");
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    out = out.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
    out = out.replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s.,;:!?)])/g, "$1<em>$2</em>");

    // 5. Restore. Stashed HTML may itself contain sentinels (a link label
    //    holding inline code), so unwind until none are left.
    for (var i = 0; i < 20 && HAS_STASH_RE.test(out); i++) {
      out = out.replace(RESTORE_RE, function (m, idx) {
        return stash[Number(idx)];
      });
    }

    // 6. Table pipes last, so they survive code spans untouched.
    return out.replace(PIPE_TOKEN_RE, "|");
  }

  // ----------------------------------------------------------------- tables

  // "| a | b |" -> ["a", "b"]. Unlike lib/checklist.js (which deliberately
  // does not support it — see Known Issues KI-04) an escaped "\|" does not
  // split a cell here; the backslash survives splitting and renderInline
  // turns it into a literal "|".
  function splitRow(row) {
    var s = row.trim();
    if (s.charAt(0) === "|") s = s.slice(1);
    if (s.slice(-1) === "|" && s.slice(-2) !== "\\|") s = s.slice(0, -1);
    var cells = [];
    var cur = "";
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (ch === "\\" && s.charAt(i + 1) === "|") {
        cur += PIPE_TOKEN;
        i++;
        continue;
      }
      if (ch === "|") {
        cells.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    cells.push(cur);
    return cells.map(function (c) {
      return c.trim();
    });
  }

  function isTableRow(line) {
    return /^\s{0,3}\|/.test(line);
  }

  var DELIM_CELL_RE = /^:?-+:?$/;

  // A delimiter row is every cell matching ---, :---, ---: or :---:. Returns
  // per-column alignment, or null when the line is ordinary data.
  function parseDelimiterRow(line) {
    if (!isTableRow(line)) return null;
    var cells = splitRow(line);
    if (!cells.length) return null;
    for (var i = 0; i < cells.length; i++) {
      if (!DELIM_CELL_RE.test(cells[i])) return null;
    }
    return cells.map(function (c) {
      var left = c.charAt(0) === ":";
      var right = c.slice(-1) === ":";
      if (left && right) return "center";
      if (right) return "right";
      if (left) return "left";
      return null;
    });
  }

  function alignAttr(align) {
    return align ? ' style="text-align:' + align + '"' : "";
  }

  function renderTable(headerLine, aligns, bodyLines) {
    var header = splitRow(headerLine);
    var width = header.length;
    var html = ["<table>", "<thead>", "<tr>"];
    for (var i = 0; i < width; i++) {
      html.push("<th" + alignAttr(aligns[i]) + ">" + renderInline(header[i]) + "</th>");
    }
    html.push("</tr>", "</thead>", "<tbody>");
    for (var r = 0; r < bodyLines.length; r++) {
      var cells = splitRow(bodyLines[r]);
      html.push("<tr>");
      // Row width is normalized against the header: extra cells are dropped,
      // missing ones padded, so a table never renders ragged.
      for (var c = 0; c < width; c++) {
        var value = c < cells.length ? renderInline(cells[c]) : "";
        html.push("<td" + alignAttr(aligns[c]) + ">" + value + "</td>");
      }
      html.push("</tr>");
    }
    html.push("</tbody>", "</table>");
    return html.join("\n");
  }

  // ------------------------------------------------------------ frontmatter

  var FENCE_RE = /^\s{0,3}(`{3,}|~{3,})\s*([^`\n]*)$/;
  var HEADING_RE = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
  var HR_RE = /^\s{0,3}(?:-{3,}|_{3,}|\*{3,})\s*$/;
  var LIST_RE = /^(\s*)(?:([-*+])|(\d+)[.)])\s+(.*)$/;
  var FRONTMATTER_KV_RE = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/;

  // YAML frontmatter is only recognized on the very first line, so a "---"
  // anywhere else stays a horizontal rule (or a table delimiter).
  function splitFrontmatter(text) {
    var lines = normalizeEol(text).split("\n");
    if (lines[0] !== "---") return { frontmatter: null, body: lines.join("\n") };
    for (var i = 1; i < lines.length; i++) {
      if (lines[i] === "---" || lines[i] === "...") {
        return {
          frontmatter: parseFrontmatterLines(lines.slice(1, i)),
          body: lines.slice(i + 1).join("\n"),
        };
      }
    }
    // Unterminated: not frontmatter after all, hand the whole text back.
    return { frontmatter: null, body: lines.join("\n") };
  }

  // Deliberately not a YAML parser: flat `key: value` pairs are all the
  // pipeline documents use, and anything else is kept as a raw line.
  function parseFrontmatterLines(lines) {
    var entries = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line.trim()) continue;
      var m = FRONTMATTER_KV_RE.exec(line.trim());
      if (m) entries.push({ key: m[1], value: m[2].trim() });
      else entries.push({ key: null, value: line.trim() });
    }
    return entries;
  }

  // Rendered as a definition list, never as a table and never as an <hr>:
  // the reader must be able to tell metadata from document content.
  function renderFrontmatter(entries) {
    var html = ['<div class="md-frontmatter">', "<dl>"];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (e.key === null) {
        html.push("<dd>" + e.value + "</dd>");
      } else {
        html.push("<dt>" + e.key + "</dt>");
        html.push("<dd>" + e.value + "</dd>");
      }
    }
    html.push("</dl>", "</div>");
    return html.join("\n");
  }

  // ------------------------------------------------------------------ lists

  function indentWidth(spaces) {
    var n = 0;
    for (var i = 0; i < spaces.length; i++) n += spaces.charAt(i) === "\t" ? 4 : 1;
    return n;
  }

  function renderListItems(items) {
    if (!items.length) return "";
    var ordered = items[0].ordered;
    var open = ordered ? "<ol>" : "<ul>";
    if (ordered && items[0].start !== 1) open = '<ol start="' + items[0].start + '">';
    var html = [open];
    for (var i = 0; i < items.length; i++) {
      var inner = renderInline(items[i].text);
      var kids = items[i].children.length ? "\n" + renderListGroups(items[i].children) : "";
      html.push("<li>" + inner + kids + "</li>");
    }
    html.push(ordered ? "</ol>" : "</ul>");
    return html.join("\n");
  }

  // Siblings of different kinds (a bullet list right after a numbered one at
  // the same level) become separate lists.
  function renderListGroups(items) {
    var out = [];
    var group = [];
    for (var i = 0; i < items.length; i++) {
      if (group.length && group[0].ordered !== items[i].ordered) {
        out.push(renderListItems(group));
        group = [];
      }
      group.push(items[i]);
    }
    if (group.length) out.push(renderListItems(group));
    return out.join("\n");
  }

  function buildListTree(raw) {
    var root = [];
    var stack = [{ indent: -1, children: root }];
    for (var i = 0; i < raw.length; i++) {
      var item = raw[i];
      var node = {
        indent: item.indent,
        ordered: item.ordered,
        start: item.start,
        text: item.text,
        children: [],
      };
      while (stack.length > 1 && item.indent <= stack[stack.length - 1].indent) stack.pop();
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    }
    return root;
  }

  // ----------------------------------------------------------------- blocks

  function closingFenceRe(marker) {
    return new RegExp("^\\s{0,3}" + marker.charAt(0) + "{" + marker.length + ",}\\s*$");
  }

  function renderBlocks(body) {
    var lines = body.split("\n");
    var out = [];
    var paragraph = [];

    function flushParagraph() {
      if (!paragraph.length) return;
      out.push("<p>" + renderInline(paragraph.join("\n")) + "</p>");
      paragraph = [];
    }

    var i = 0;
    while (i < lines.length) {
      var line = lines[i];

      if (!line.trim()) {
        flushParagraph();
        i++;
        continue;
      }

      // Fenced code block: content is emitted verbatim (already escaped),
      // with no markdown interpretation inside.
      var fence = FENCE_RE.exec(line);
      if (fence) {
        flushParagraph();
        var closing = closingFenceRe(fence[1]);
        var info = (fence[2] || "").trim().split(/\s+/)[0] || "";
        var lang = /^[A-Za-z0-9_+#.-]+$/.test(info) ? info : "";
        var code = [];
        i++;
        while (i < lines.length && !closing.test(lines[i])) {
          code.push(lines[i]);
          i++;
        }
        if (i < lines.length) i++; // consume the closing fence
        var cls = lang ? ' class="language-' + lang + '"' : "";
        out.push("<pre><code" + cls + ">" + code.join("\n") + "</code></pre>");
        continue;
      }

      // Table: a pipe row immediately followed by a delimiter row. The
      // delimiter row itself never reaches the body.
      if (isTableRow(line) && i + 1 < lines.length) {
        var aligns = parseDelimiterRow(lines[i + 1]);
        if (aligns) {
          flushParagraph();
          var headerLine = line;
          var bodyLines = [];
          i += 2;
          while (i < lines.length && isTableRow(lines[i])) {
            bodyLines.push(lines[i]);
            i++;
          }
          var width = splitRow(headerLine).length;
          while (aligns.length < width) aligns.push(null);
          out.push(renderTable(headerLine, aligns, bodyLines));
          continue;
        }
      }

      var heading = HEADING_RE.exec(line);
      if (heading) {
        flushParagraph();
        var level = heading[1].length;
        out.push("<h" + level + ">" + renderInline(heading[2]) + "</h" + level + ">");
        i++;
        continue;
      }

      if (HR_RE.test(line)) {
        flushParagraph();
        out.push("<hr>");
        i++;
        continue;
      }

      if (LIST_RE.test(line)) {
        flushParagraph();
        var raw = [];
        while (i < lines.length) {
          var m = LIST_RE.exec(lines[i]);
          if (m) {
            raw.push({
              indent: indentWidth(m[1]),
              ordered: m[2] === undefined,
              start: m[3] === undefined ? 1 : Number(m[3]),
              text: m[4],
            });
            i++;
            continue;
          }
          // Lazy continuation: an indented, non-blank, non-list line belongs
          // to the previous item.
          if (raw.length && lines[i].trim() && /^\s+/.test(lines[i])) {
            raw[raw.length - 1].text += "\n" + lines[i].trim();
            i++;
            continue;
          }
          break;
        }
        out.push(renderListGroups(buildListTree(raw)));
        continue;
      }

      paragraph.push(line);
      i++;
    }
    flushParagraph();
    return out.join("\n");
  }

  // -------------------------------------------------------------------- API

  function render(text) {
    if (text === null || text === undefined) return "";
    var normalized = normalizeEol(text).split(SENTINEL).join("");
    // Escape first, parse second: no document content can become markup.
    var escaped = escapeHtml(normalized);
    var split = splitFrontmatter(escaped);
    var parts = [];
    if (split.frontmatter && split.frontmatter.length) {
      parts.push(renderFrontmatter(split.frontmatter));
    }
    var blocks = renderBlocks(split.body);
    if (blocks) parts.push(blocks);
    return parts.join("\n");
  }

  // Frontmatter of the raw (unescaped) document, for callers that need the
  // metadata itself rather than its rendering.
  function parseFrontmatter(text) {
    var src = text === null || text === undefined ? "" : String(text);
    var split = splitFrontmatter(src);
    return { frontmatter: split.frontmatter, body: split.body };
  }

  return {
    render: render,
    renderMarkdown: render,
    parseFrontmatter: parseFrontmatter,
    escapeHtml: escapeHtml,
    normalizeEol: normalizeEol,
    safeUrl: safeUrl,
    splitRow: splitRow,
  };
});
