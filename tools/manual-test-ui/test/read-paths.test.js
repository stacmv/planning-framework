// TC-011 — path validation on the read side.
//
// The tool reads two things and nothing else: files inside a configured
// project, and one extra prefix outside it — the project's accumulated
// memory (`<memRoot>/projects/<slug>/memory/`). Everything else is refused,
// including the routes that existed before this issue: `serveStatic` used to
// decide containment with `startsWith`, which accepts a sibling directory
// sharing the prefix (`public-x/evil.js` next to `public/`).
//
// Session transcripts (`*.jsonl`, `sessions-index.json`) sit next to
// `memory/` and are refused as well, by listing and by direct read.
//
// Run: node --test test/read-paths.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const {
  TOOL_DIR,
  makeTempDir,
  writeFileTree,
  makeMemoryRoot,
  makeConfig,
  slugForProjectPath,
  autoCleanup,
} = require("./helpers/fixtures");
const { startServerFor } = require("./helpers/server");
const paths = require("../lib/paths");

const OUTSIDE_MARKER = "OUTSIDE-SECRET-MARKER";
const NEIGHBOUR_MARKER = "NEIGHBOUR-SECRET-MARKER";
const PROJECTS_ROOT_MARKER = "PROJECTS-ROOT-SECRET-MARKER";
const TRANSCRIPT_MARKER = "secret transcript content";

// A request sent exactly as written, without the normalisation `new URL()`
// performs: `/../public-x/evil.js` has to reach the server as typed, or the
// test would be proving something about the client instead of the server.
function rawGet(baseUrl, rawPath) {
  const url = new URL(baseUrl);
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: url.hostname, port: url.port, method: "GET", path: rawPath, headers: { Connection: "close" } },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString("utf8") }));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function buildFixture() {
  const tmp = makeTempDir("pf-ui-read-paths-");
  const parent = path.join(tmp, "parent");
  const projectDir = path.join(parent, "project");

  writeFileTree(tmp, {
    "parent/project/README.md": "# Fixture project\n\nReadable.\n",
    "parent/project/docs/issues/open/.gitkeep": "",
    "parent/project/docs/notes/inside.md": "Nested but inside the project.\n",
    // Sibling directory sharing the project's prefix.
    "parent/project-x/secret.md": `${NEIGHBOUR_MARKER}\n`,
    "parent/secret-outside.md": `${OUTSIDE_MARKER}\n`,
  });
  const memRoot = makeMemoryRoot({ root: path.join(tmp, "claude-home") });
  const mem = memRoot.addProject({
    projectPath: projectDir,
    memory: { "notes.md": "# Notes\n\nFirst line.\nSecond line.\n" },
  });
  // Above the per-project directory: reachable only by escaping the memory
  // prefix, which is what step 5 tries to do.
  fs.writeFileSync(path.join(memRoot.projectsDir, "secrets.md"), `${PROJECTS_ROOT_MARKER}\n`, "utf8");

  const transcript = fs
    .readdirSync(mem.dir)
    .find((n) => n.endsWith(".jsonl"));
  assert.ok(transcript, "the memory fixture no longer writes a session transcript");

  const config = makeConfig({ projects: [{ name: "project", path: projectDir }] });
  return { tmp, parent, projectDir, memRoot, mem, transcript, config };
}

// Copy of the whole tool with a sibling of public/ added, so the static
// route can be attacked end to end without a stray directory in the
// repository.
function copyToolWithNeighbour(tmp) {
  const dest = path.join(tmp, "tool-copy");
  fs.cpSync(TOOL_DIR, dest, {
    recursive: true,
    filter: (src) => path.basename(src) !== "projects.json" && !src.split(path.sep).includes("node_modules"),
  });
  fs.mkdirSync(path.join(dest, "public-x"), { recursive: true });
  fs.writeFileSync(path.join(dest, "public-x", "evil.js"), `// ${NEIGHBOUR_MARKER}\n`, "utf8");
  return dest;
}

function assertRefused(res, marker) {
  assert.ok(res.status >= 400 && res.status < 500, `expected a 4xx refusal, got ${res.status}: ${res.text}`);
  assert.notStrictEqual(res.status, 500, "a rejected path must never surface as a server error");
  if (marker) assert.ok(!res.text.includes(marker), "the refused content was returned anyway");
  if (res.json) assert.strictEqual(res.json.content, undefined, "a refusal must carry no content");
}

test("TC-011: reads are confined to the project and one memory prefix", async (t) => {
  autoCleanup(t);
  const fx = buildFixture();
  const server = await startServerFor(t, {
    configPath: fx.config.configPath,
    env: { PLANNING_TEST_UI_MEMORY_ROOT: fx.memRoot.root },
  });

  const doc = (p) => server.get(`/api/projects/project/docs?path=${encodeURIComponent(p)}`);
  const memFile = (p) => server.get(`/api/projects/project/memory/file?path=${encodeURIComponent(p)}`);

  await t.test("positive control: a document of the project is readable", async () => {
    const res = await doc("README.md");
    assert.strictEqual(res.status, 200, res.text);
    assert.ok(res.json.content.includes("Fixture project"));
    assert.strictEqual(res.json.relativePath, "README.md");

    const nested = await doc("docs/notes/inside.md");
    assert.strictEqual(nested.status, 200, nested.text);
    assert.ok(nested.json.content.includes("inside the project"));
  });

  await t.test("step 1: traversal out of the project is refused, however it is spelled", async () => {
    assertRefused(await doc("../../../etc/passwd"));
    assertRefused(await doc("/etc/passwd"));
    assertRefused(await doc("../secret-outside.md"), OUTSIDE_MARKER);
    // Percent-encoded separators, decoded by the server, not by the client.
    assertRefused(await server.get("/api/projects/project/docs?path=..%2f..%2fpasswd"));
    assertRefused(await server.get("/api/projects/project/docs?path=..%2fsecret-outside.md"), OUTSIDE_MARKER);
    // No path at all is a bad request, not a stack trace.
    const empty = await server.get("/api/projects/project/docs");
    assert.strictEqual(empty.status, 400, empty.text);
  });

  await t.test("step 2: a symlink pointing out of the project is refused", async (t2) => {
    // A symlink that lives inside the project but points out of it: literal
    // path comparison would accept it, realpath comparison must not. Created
    // here, not in buildFixture(), because on Windows without Developer Mode
    // fs.symlinkSync throws EPERM — and if that throw happened during
    // fixture construction, it would take down all nine subtests instead of
    // just this one.
    try {
      fs.symlinkSync(path.join(fx.parent, "secret-outside.md"), path.join(fx.projectDir, "outside.md"));
    } catch (err) {
      if (err.code === "EPERM" || err.code === "EACCES") {
        console.error(
          `Skipping symlink escape check: fs.symlinkSync failed with ${err.code}. ` +
            "On Windows, creating symlinks requires Developer Mode (or an elevated process); " +
            "enable Developer Mode to run this symlink-based subtest."
        );
        t2.skip(`fs.symlinkSync not permitted (${err.code}) — enable Developer Mode on Windows to run this check`);
        return;
      }
      throw err;
    }

    const res = await doc("outside.md");
    assertRefused(res, OUTSIDE_MARKER);
    // The literal path is inside the project; only realpath tells the truth.
    assert.ok(
      path.join(fx.projectDir, "outside.md").startsWith(fx.projectDir),
      "fixture is wrong: the symlink is not inside the project by literal path"
    );
    assert.strictEqual(paths.isInside(fx.projectDir, path.join(fx.projectDir, "outside.md")), false);
  });

  await t.test("step 3a: a sibling directory sharing the project's prefix is refused", async () => {
    assertRefused(await doc("../project-x/secret.md"), NEIGHBOUR_MARKER);
    assertRefused(await doc(path.join(fx.parent, "project-x", "secret.md")), NEIGHBOUR_MARKER);
    assert.strictEqual(paths.isInside(fx.projectDir, path.join(fx.parent, "project-x", "secret.md")), false);
    // The prefix comparison this replaced would have said yes.
    assert.ok(
      path.join(fx.parent, "project-x", "secret.md").startsWith(fx.projectDir),
      "fixture is wrong: the sibling does not share the project's string prefix"
    );
  });

  await t.test("step 3b: a sibling of public/ is refused by the static route", async () => {
    // Unit level first: this is the exact comparison server.js:195 used to
    // get wrong, and it must stay wrong-proof independently of routing.
    const publicDir = path.join(TOOL_DIR, "public");
    const neighbour = path.join(TOOL_DIR, "public-x", "evil.js");
    assert.ok(neighbour.startsWith(publicDir), "fixture is wrong: public-x does not share public's prefix");
    assert.strictEqual(paths.isInside(publicDir, neighbour), false);

    // End to end, against a copy of the tool that really has public-x/.
    const toolCopy = copyToolWithNeighbour(fx.tmp);
    assert.ok(fs.existsSync(path.join(toolCopy, "public-x", "evil.js")));
    const copiedHarness = require(path.join(toolCopy, "test", "helpers", "server.js"));
    const copied = await copiedHarness.startServer({
      configPath: fx.config.configPath,
      env: { PLANNING_TEST_UI_MEMORY_ROOT: fx.memRoot.root },
    });
    try {
      const ok = await rawGet(copied.baseUrl, "/index.html");
      assert.strictEqual(ok.status, 200, "the copied tool does not serve its own static files");
      const res = await rawGet(copied.baseUrl, "/../public-x/evil.js");
      assert.strictEqual(res.status, 403, `expected 403, got ${res.status}: ${res.text}`);
      assert.ok(!res.text.includes(NEIGHBOUR_MARKER), "the sibling file was served");
    } finally {
      await copied.stop();
    }
  });

  await t.test("step 4: the memory prefix is readable — the one allowed extension", async () => {
    const res = await memFile("notes.md");
    assert.strictEqual(res.status, 200, res.text);
    assert.ok(res.json.content.includes("First line"));
    assert.strictEqual(res.json.relativePath, "notes.md");
    assert.strictEqual(res.json.memoryDir, fx.mem.memoryDir);

    // The absolute form of the same file is accepted too — one decision, not
    // one per spelling.
    const absolute = await memFile(path.join(fx.mem.memoryDir, "notes.md"));
    assert.strictEqual(absolute.status, 200, absolute.text);

    // …and the same file is *not* reachable through the project route.
    assertRefused(await doc(path.join(fx.mem.memoryDir, "notes.md")));
  });

  await t.test("step 5: normalisation happens before the prefix comparison", async () => {
    assertRefused(await memFile("../../secrets.md"), PROJECTS_ROOT_MARKER);
    assertRefused(await memFile("memory/../../secrets.md"), PROJECTS_ROOT_MARKER);
    assertRefused(await memFile(path.join(fx.memRoot.projectsDir, "secrets.md")), PROJECTS_ROOT_MARKER);
    assertRefused(await server.get("/api/projects/project/memory/file?path=..%2f..%2fsecrets.md"), PROJECTS_ROOT_MARKER);
  });

  await t.test("step 6: session transcripts are unreachable, by name and by listing", async () => {
    assertRefused(await memFile(`../${fx.transcript}`), TRANSCRIPT_MARKER);
    assertRefused(await memFile(path.join(fx.mem.dir, fx.transcript)), TRANSCRIPT_MARKER);
    assertRefused(await memFile("../sessions-index.json"));
    assertRefused(await memFile(path.join(fx.mem.dir, "sessions-index.json")));
    assertRefused(await doc(path.join(fx.mem.dir, fx.transcript)), TRANSCRIPT_MARKER);

    const listing = await server.get("/api/projects/project/memory");
    assert.strictEqual(listing.status, 200, listing.text);
    assert.deepStrictEqual(
      listing.json.files.map((f) => f.relativePath),
      ["notes.md"],
      "the memory listing must contain memory files only"
    );
    assert.ok(!listing.text.includes(TRANSCRIPT_MARKER));
    assert.strictEqual(listing.json.slug, slugForProjectPath(fx.projectDir));
  });

  await t.test("browser modules are served from an allowlist, never from the whole lib/", async () => {
    const markdown = await server.get("/lib/markdown.js");
    assert.strictEqual(markdown.status, 200, "the renderer the client loads must be served");
    assert.ok(/text\/javascript/.test(markdown.headers["content-type"]));

    // roles.js is allowlisted but arrives with a later task: absent is a 404.
    const roles = await server.get("/lib/roles.js");
    assert.ok([200, 404].includes(roles.status), `expected 200 or 404 for roles.js, got ${roles.status}`);

    for (const forbidden of ["/lib/git.js", "/lib/checklist.js", "/lib/paths.js", "/lib/memory.js", "/lib/instructions.js"]) {
      const res = await server.get(forbidden);
      assert.strictEqual(res.status, 403, `${forbidden} must not be downloadable (got ${res.status})`);
    }
    const traversal = await rawGet(server.baseUrl, "/lib/../server.js");
    assert.ok(traversal.status >= 400, `traversal through /lib/ returned ${traversal.status}`);
    assert.ok(!traversal.text.includes("loadProjects"), "server.js was served through /lib/");
  });
});
