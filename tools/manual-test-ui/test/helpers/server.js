"use strict";

// Starts the Manual Test UI server for a test and talks HTTP to it.
//
// Always on `listen(0)`. Never on the tool's default 4317: a suite that
// grabbed a fixed port would fail whenever a developer had the real UI open,
// and two suites running in parallel would fight over it. The ephemeral port
// the OS hands out is read back from `server.address()` and reported to the
// parent, so nothing has to guess or probe.
//
// The server is started in a forked child rather than in the test process.
// server.js is a script, not a module — it calls `main()` at load — so a
// require would (a) start a server the test has no handle on and (b) be
// cached, making a second start with a different `projects.json` impossible.
// A child also gives each test its own environment and its own captured
// stdout/stderr, which several test cases assert on (the warnings the tool
// prints for a missing or duplicated project).
//
// This file is dual-mode: required as a module it is the test-side API,
// executed as a forked child it is the bootstrap. Keeping both here means
// the fork target cannot drift away from the API that forks it.

const path = require("node:path");
const http = require("node:http");
const { fork } = require("node:child_process");

const TOOL_DIR = path.resolve(__dirname, "..", "..");
const SERVER_PATH = path.join(TOOL_DIR, "server.js");
const START_TIMEOUT_MS = 15000;

// ---------------------------------------------------------------------------
// Child side — bootstrap
// ---------------------------------------------------------------------------

function bootAsChild() {
  let captured = null;

  // server.js builds its http.Server inside main() and keeps the reference
  // to itself, so the only way to get a handle on it without editing the
  // file is to be holding the constructor when it is called. Restored
  // immediately afterwards so nothing else in the process sees the patch.
  const originalCreateServer = http.createServer;
  http.createServer = function patchedCreateServer(...args) {
    const server = originalCreateServer.apply(this, args);
    if (!captured) captured = server;
    return server;
  };

  const fail = (message) => {
    if (process.send) process.send({ type: "error", message });
    process.exit(1);
  };

  let mod;
  try {
    mod = require(SERVER_PATH);
  } catch (e) {
    http.createServer = originalCreateServer;
    fail(`server.js threw while loading: ${e && e.stack ? e.stack : e}`);
    return;
  }
  http.createServer = originalCreateServer;

  let server = captured;
  if (!server) {
    // Forward-compatible path: once server.js exports a factory (the
    // implementation plan has a later task extract `createServer(projects)`
    // from `main()`), use it directly instead of the interception above.
    if (mod && typeof mod.createServer === "function") {
      const projects = typeof mod.loadProjects === "function" ? mod.loadProjects() : undefined;
      server = mod.createServer(projects);
      server.listen(0);
    } else {
      fail("server.js neither created an http.Server on load nor exported createServer()");
      return;
    }
  }

  server.once("error", (e) => {
    if (process.send) process.send({ type: "error", message: `listen failed: ${e.message}` });
    process.exit(1);
  });

  const announce = () => {
    const address = server.address();
    if (!address || typeof address === "string") {
      fail(`server is not listening on a TCP port (address = ${JSON.stringify(address)})`);
      return;
    }
    process.send({ type: "listening", port: address.port });
  };
  if (server.listening) announce();
  else server.once("listening", announce);

  process.on("message", (msg) => {
    if (msg && msg.type === "stop") {
      server.close(() => process.exit(0));
      // Sockets kept alive by an HTTP agent would hold close() open; the
      // test client sends `Connection: close`, but be decisive anyway.
      if (typeof server.closeAllConnections === "function") server.closeAllConnections();
    }
  });
}

// ---------------------------------------------------------------------------
// Parent side — starting and stopping
// ---------------------------------------------------------------------------

/**
 * Start the Manual Test UI against a generated config, on an ephemeral port.
 *
 * @param {object} options
 * @param {string} options.configPath  Path to a throwaway `projects.json`
 *                                     (see `fixtures.makeConfig`). Required:
 *                                     a test must never fall through to the
 *                                     developer's real project list.
 * @param {object} [options.env]       Extra environment for the child.
 * @param {string} [options.cwd]       Child working directory.
 * @param {number} [options.timeoutMs] How long to wait for "listening".
 * @returns {Promise<{
 *   port: number, baseUrl: string, child: import("node:child_process").ChildProcess,
 *   stdout(): string, stderr(): string,
 *   request(opts): Promise<object>, get(p): Promise<object>,
 *   post(p, body): Promise<object>, patch(p, body): Promise<object>,
 *   stop(): Promise<void>
 * }>}
 */
function startServer(options = {}) {
  const { configPath, env = {}, cwd = TOOL_DIR, timeoutMs = START_TIMEOUT_MS } = options;
  if (!configPath) {
    throw new Error("startServer requires configPath — tests must never fall back to the real projects.json");
  }

  const child = fork(__filename, ["--port", "0"], {
    cwd,
    env: {
      ...process.env,
      ...env,
      PLANNING_TEST_UI_CONFIG: configPath,
      PORT: "0",
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (c) => {
    stdout += c;
  });
  child.stderr.on("data", (c) => {
    stderr += c;
  });

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      settle(new Error(`server did not start within ${timeoutMs}ms\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    }, timeoutMs);
    timer.unref?.();

    let settled = false;
    function settle(err, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) {
        child.kill("SIGKILL");
        reject(err);
      } else {
        resolve(value);
      }
    }

    child.on("message", (msg) => {
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "error") {
        settle(new Error(`${msg.message}\nstdout:\n${stdout}\nstderr:\n${stderr}`));
        return;
      }
      if (msg.type === "listening") {
        const baseUrl = `http://127.0.0.1:${msg.port}`;
        settle(null, makeHandle({ child, port: msg.port, baseUrl, getStdout: () => stdout, getStderr: () => stderr }));
      }
    });

    child.on("error", (e) => settle(new Error(`failed to fork the server: ${e.message}`)));
    child.on("exit", (code, signal) => {
      settle(
        new Error(
          `server exited before it started listening (code ${code}, signal ${signal})\n` +
            `stdout:\n${stdout}\nstderr:\n${stderr}`
        )
      );
    });
  });
}

function makeHandle({ child, port, baseUrl, getStdout, getStderr }) {
  let stopped = false;

  const stop = () =>
    new Promise((resolve) => {
      if (stopped || child.exitCode !== null || child.signalCode !== null) return resolve();
      stopped = true;
      const done = () => resolve();
      child.once("exit", done);
      // Ask nicely, then insist: a wedged child must not hang the suite.
      try {
        child.send({ type: "stop" });
      } catch {
        /* channel already closed */
      }
      const hard = setTimeout(() => child.kill("SIGKILL"), 2000);
      hard.unref?.();
      child.once("exit", () => clearTimeout(hard));
    });

  const handle = {
    port,
    baseUrl,
    child,
    stdout: getStdout,
    stderr: getStderr,
    stop,
    request: (opts) => request(baseUrl, opts),
    get: (p, opts) => request(baseUrl, { ...opts, method: "GET", path: p }),
    post: (p, body, opts) => request(baseUrl, { ...opts, method: "POST", path: p, body }),
    patch: (p, body, opts) => request(baseUrl, { ...opts, method: "PATCH", path: p, body }),
    delete: (p, body, opts) => request(baseUrl, { ...opts, method: "DELETE", path: p, body }),
  };
  return handle;
}

/**
 * Start a server and tear it down automatically when the test finishes,
 * pass or fail.
 *
 *   const server = await startServerFor(t, { configPath });
 */
async function startServerFor(t, options) {
  const handle = await startServer(options);
  t.after(() => handle.stop());
  return handle;
}

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

/**
 * One request, one response, no connection reuse.
 *
 * Built on node:http rather than global fetch on purpose: fetch's shared
 * keep-alive dispatcher holds sockets open past the end of a test, which
 * both delays `server.close()` and can keep the test process alive after
 * the last assertion. `Connection: close` removes the whole question.
 *
 * A non-JSON body is returned as `text` with `json: null` rather than
 * throwing — an assertion on the status code is more useful than a parse
 * error when a route unexpectedly returns HTML or an empty body.
 *
 * @returns {Promise<{status: number, headers: object, text: string, json: any}>}
 */
function request(baseUrl, { method = "GET", path: pathname = "/", body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, baseUrl);
    const payload =
      body === undefined || body === null
        ? null
        : Buffer.from(typeof body === "string" ? body : JSON.stringify(body), "utf8");

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          Connection: "close",
          ...(payload ? { "Content-Type": "application/json", "Content-Length": payload.length } : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode, headers: res.headers, text, json });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

module.exports = {
  SERVER_PATH,
  TOOL_DIR,
  startServer,
  startServerFor,
  request,
};

if (require.main === module) bootAsChild();
