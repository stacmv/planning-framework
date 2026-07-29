// TC-009: markdown rendering, tables included, with HTML escaping.
//
// The renderer is imported directly and the returned HTML string is what is
// asserted on — no DOM is involved, so the case runs under plain
// `node --test tools/manual-test-ui/test/markdown.test.js`.
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");

const MODULE_PATH = path.join(__dirname, "..", "lib", "markdown.js");
const FIXTURES = path.join(__dirname, "fixtures");
const md = require(MODULE_PATH);

function fixture(name) {
  return fs.readFileSync(path.join(FIXTURES, name), "utf8");
}

const KITCHEN_SINK = fixture("renderer-kitchen-sink.md");

// Returns the lines of a "## <heading>" section, so a single construct can be
// rendered on its own without duplicating it outside the fixture file.
function sectionUnder(source, heading) {
  const lines = source.split(/\r\n|\n/);
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  assert.notStrictEqual(start, -1, `section "${heading}" not found in fixture`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^##\s/.test(l));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n");
}

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

// All real (non-escaped) HTML tags of the output. Escaped source text such as
// "&lt;img ...&gt;" is deliberately not a tag and must not be matched.
function tagsOf(html) {
  return html.match(/<[a-zA-Z/!][^>]*>/g) || [];
}

function bodyRows(tableHtml) {
  const body = tableHtml.slice(tableHtml.indexOf("<tbody>"), tableHtml.indexOf("</tbody>"));
  return body.split("<tr>").slice(1);
}

// --------------------------------------------------------------- step 1

test("TC-009 step 1: six-column table renders one <table>, header in <th>, delimiter row dropped", () => {
  const html = md.render(sectionUnder(KITCHEN_SINK, "Шестиколоночная таблица"));

  assert.strictEqual(count(html, "<table>"), 1, "expected exactly one <table>");
  // `<th` alone would also match `<thead>`.
  assert.strictEqual((html.match(/<th[\s>]/g) || []).length, 6, "expected six header cells");
  assert.ok(/<th>TC<\/th>/.test(html), "header text must land in <th>");

  const rows = bodyRows(html);
  assert.strictEqual(rows.length, 6, "expected six data rows");
  for (const row of rows) {
    assert.strictEqual(count(row, "<td"), 6, `row must have six cells: ${row}`);
  }

  // The delimiter row must not have become data.
  assert.ok(!html.includes("------"), "delimiter row leaked into the output");
  assert.ok(!/<td[^>]*>\s*-+\s*<\/td>/.test(html), "delimiter row rendered as a data row");
});

// --------------------------------------------------------------- step 2

test("TC-009 step 2: alignment row (:---, ---:, :---:) is a delimiter, not data", () => {
  const html = md.render(sectionUnder(KITCHEN_SINK, "Таблица с выравниванием"));

  assert.strictEqual(count(html, "<table>"), 1);
  assert.ok(!html.includes(":---"), "alignment row leaked into the output");

  const rows = bodyRows(html);
  assert.strictEqual(rows.length, 2, "only the two data rows may be in <tbody>");

  assert.ok(/<th style="text-align:left">Слева<\/th>/.test(html));
  assert.ok(/<th style="text-align:center">По центру<\/th>/.test(html));
  assert.ok(/<th style="text-align:right">Справа<\/th>/.test(html));
});

// --------------------------------------------------------------- step 3

test("TC-009 step 3: escaped pipe does not split a cell and prints as |", () => {
  const html = md.render(sectionUnder(KITCHEN_SINK, "Таблица с выравниванием"));
  const rows = bodyRows(html);

  assert.strictEqual(count(rows[0], "<td"), 3, "escaped pipe split the cell in two");
  assert.ok(rows[0].includes(">a | b<"), `literal pipe missing: ${rows[0]}`);

  // GFM resolves "\|" while splitting cells, so it survives inside a code
  // span too. lib/checklist.js deliberately does not support this — see
  // Known Issues KI-04; the renderer is the reference here.
  assert.ok(rows[1].includes("<code>code | pipe</code>"), `code span: ${rows[1]}`);

  assert.ok(!html.includes("\\|"), "the backslash must not reach the output");
});

// --------------------------------------------------------------- step 4

test("TC-009 step 4: headings, nested and numbered lists, code block, inline code, link", () => {
  const html = md.render(KITCHEN_SINK);

  assert.ok(/<h1>Kitchen sink рендерера<\/h1>/.test(html));
  assert.ok(/<h2>Заголовок второго уровня<\/h2>/.test(html));
  assert.ok(/<h3>Заголовок третьего уровня<\/h3>/.test(html));
  assert.ok(/<h4>Заголовок четвёртого уровня<\/h4>/.test(html));

  // Nested list: an inner <ul> inside an <li> of the outer one.
  const nested = md.render(sectionUnder(KITCHEN_SINK, "Вложенный список"));
  assert.strictEqual(count(nested, "<ul>"), 2, "expected an outer and an inner list");
  assert.ok(/<li>Второй пункт верхнего уровня\n<ul>/.test(nested), nested);
  assert.strictEqual(count(nested, "<li>"), 5);

  const ordered = md.render(sectionUnder(KITCHEN_SINK, "Нумерованный список"));
  assert.strictEqual(count(ordered, "<ol>"), 1);
  assert.strictEqual(count(ordered, "<li>"), 3);
  assert.ok(!ordered.includes("<ul>"), "a numbered list must not become a bullet list");

  // Fenced code block: nothing inside is interpreted as markdown.
  const codeBlock = md.render(sectionUnder(KITCHEN_SINK, "Блок кода"));
  assert.ok(/<pre><code class="language-js">/.test(codeBlock), codeBlock);
  assert.ok(!codeBlock.includes("<table"), "a pipe inside a code block became a table");
  assert.ok(!/<h[1-6]>/.test(codeBlock), "a hash inside a code block became a heading");
  assert.ok(codeBlock.includes("// # это не заголовок, а | это не таблица"), codeBlock);
  assert.ok(!codeBlock.includes("<code><code>"), "code block content was re-parsed");

  assert.ok(html.includes("<code>инлайн-кодом</code>"), "inline code");
  assert.ok(
    html.includes('<a href="https://nodejs.org/api/test.html">документацию Node</a>'),
    "absolute link",
  );
  assert.ok(
    html.includes('<a href="../../../../PLANNING.md">PLANNING.md</a>'),
    "relative link",
  );
});

// --------------------------------------------------------------- step 5

test("TC-009 step 5: YAML frontmatter is frontmatter, not a table and not an <hr>", () => {
  const html = md.render(KITCHEN_SINK);

  assert.ok(html.startsWith('<div class="md-frontmatter">'), html.slice(0, 120));
  assert.ok(html.includes("<dt>title</dt>"));
  assert.ok(html.includes("<dt>issue</dt>"));
  assert.ok(html.includes("<dd>ru</dd>"));

  assert.ok(!html.includes("<hr>"), "frontmatter fences became horizontal rules");
  // Exactly the three tables of the fixture — the frontmatter is not one.
  assert.strictEqual(count(html, "<table>"), 3, "frontmatter must not render as a table");

  // The closing fence must not leak into the body either.
  const firstHeading = html.indexOf("<h1>");
  assert.ok(firstHeading > 0);
  assert.ok(!html.slice(firstHeading).includes("doc_language"), "frontmatter leaked into the body");

  // A "---" that is not on the first line stays a horizontal rule.
  const withRule = md.render("Текст\n\n---\n\nЕщё текст\n");
  assert.ok(withRule.includes("<hr>"), withRule);
  assert.ok(!withRule.includes("md-frontmatter"), withRule);
});

// --------------------------------------------------------------- step 6

test("TC-009 step 6: arbitrary HTML in a document is escaped and never executable", () => {
  const html = md.render(fixture("renderer-xss.md"));

  // Present as text...
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"), html);
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"), html);
  assert.ok(html.includes("&amp;amp;"), "the entity &amp; must survive as text");
  assert.ok(html.includes("&amp;lt;b&amp;gt;"), "the entity &lt;b&gt; must survive as text");
  assert.ok(html.includes("<code>&lt;div class=&quot;evil&quot;&gt;</code>"), html);

  // ...and nowhere as markup.
  assert.ok(!html.includes("<script"), "a <script> element reached the output");
  assert.ok(!html.includes("<img src=x"), "an unescaped <img> reached the output");
  for (const tag of tagsOf(html)) {
    assert.ok(!/\son[a-z]+\s*=/i.test(tag), `event-handler attribute in tag: ${tag}`);
    assert.ok(
      /^<\/?(?:p|h[1-6]|ul|ol|li|pre|code|table|thead|tbody|tr|th|td|a|em|strong|del|img|hr|div|dl|dt|dd)\b/.test(tag),
      `unexpected tag emitted: ${tag}`,
    );
  }

  // A javascript: URL yields no clickable link — text only.
  assert.ok(html.includes("Ссылка со скриптовой схемой: нажми"), html);
  assert.ok(!html.includes("javascript:"), "javascript: URL reached the output");
  assert.ok(!html.includes("<a "), "javascript: URL became a link");

  assert.strictEqual(md.safeUrl("javascript:alert(1)"), null);
  assert.strictEqual(md.safeUrl("JaVaScRiPt:alert(1)"), null);
  assert.strictEqual(md.safeUrl("data:text/html,<script>"), null);
  assert.strictEqual(md.safeUrl("vbscript:msgbox"), null);
  assert.strictEqual(md.safeUrl("https://example.com/x"), "https://example.com/x");
  assert.strictEqual(md.safeUrl("./docs/specs.md"), "./docs/specs.md");
  assert.strictEqual(md.safeUrl("mailto:qa@example.com"), "mailto:qa@example.com");
});

// --------------------------------------------------------------- step 7

test("TC-009 step 7: a CRLF document renders byte-for-byte like its LF twin", () => {
  const lf = fixture("renderer-kitchen-sink.md");
  const crlf = fixture("renderer-kitchen-sink.crlf.md");

  // Guard the fixtures themselves, so the case cannot pass vacuously.
  assert.ok(!lf.includes("\r"), "the LF fixture must not contain CR");
  assert.ok(crlf.includes("\r\n"), "the CRLF fixture must contain CRLF");
  assert.ok(!/(?<!\r)\n/.test(crlf), "the CRLF fixture must be purely CRLF");
  assert.strictEqual(crlf.replace(/\r\n/g, "\n"), lf, "the two fixtures must differ only in EOL");

  assert.strictEqual(md.render(crlf), md.render(lf));

  // No swallowed tables and no extra blank blocks.
  const html = md.render(crlf);
  assert.strictEqual(count(html, "<table>"), 3);
  assert.ok(!html.includes("<p></p>"), "empty paragraph produced from CRLF");
  assert.ok(!html.includes("\r"), "CR reached the output");
});

// --------------------------------------------------------------- step 8

test("TC-009 step 8: the module imports only node: builtins and touches no DOM at load", () => {
  const src = fs.readFileSync(MODULE_PATH, "utf8");

  // Comments legitimately mention `document`/`window`; strip them (and block
  // comments) before looking at the code itself.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  const requires = code.match(/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g) || [];
  const imports = code.match(/^\s*import\s.+$/gm) || [];
  assert.deepStrictEqual(requires, [], "the renderer must not require anything");
  assert.deepStrictEqual(imports, [], "the renderer must not import anything");

  assert.ok(!/\bdocument\b/.test(code), "the renderer references document");
  assert.ok(!/\bwindow\b/.test(code), "the renderer references window");
  assert.ok(!/\bprocess\b/.test(code), "the renderer references process");

  // Loading in a browser-like context: no `module`, no `require`, and both
  // `document` and `window` throw on any access.
  const sandbox = { self: {} };
  Object.defineProperty(sandbox, "document", {
    get() {
      throw new Error("the renderer touched document at load time");
    },
  });
  Object.defineProperty(sandbox, "window", {
    get() {
      throw new Error("the renderer touched window at load time");
    },
  });
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: "markdown.js" });

  assert.strictEqual(typeof sandbox.self.PFMarkdown, "object", "PFMarkdown not published");
  assert.strictEqual(typeof sandbox.self.PFMarkdown.render, "function");
  assert.strictEqual(
    sandbox.self.PFMarkdown.render(KITCHEN_SINK),
    md.render(KITCHEN_SINK),
    "the browser-loaded module must render identically to the Node-loaded one",
  );

  // ...and in a clean Node process, where neither global exists at all.
  const probe = [
    'const m = require(' + JSON.stringify(MODULE_PATH) + ");",
    'if (typeof document !== "undefined") throw new Error("document exists");',
    'if (typeof window !== "undefined") throw new Error("window exists");',
    'if (typeof m.render !== "function") throw new Error("no render export");',
    'process.stdout.write(m.render("# ok"));',
  ].join("\n");
  const out = execFileSync(process.execPath, ["-e", probe], { encoding: "utf8" });
  assert.strictEqual(out, "<h1>ok</h1>");
});
