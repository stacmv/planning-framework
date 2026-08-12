#!/usr/bin/env node
// Prepared-data setup script for one issue.
//
// /pf-test copies this file to `docs/issues/<status>/<ISSUE-ID>/test-data/setup.mjs`
// and replaces the GENERATED CONFIG block below. Nothing outside that block is
// meant to be edited by hand.
//
// What it does
// ------------
// Unpacks the fixtures a manual test case needs into a working copy the tester
// can open, edit and ruin, then re-run this script to get back to a known state.
//
//   node setup.mjs           prepare every declared test case
//   node setup.mjs TC-002    prepare only that case
//
// Three properties this script is required to have, because the whole point of
// preparing data automatically dies without any one of them:
//
//  1. Idempotent. Every run rebuilds the working copy from the fixtures under
//     git. There is no teardown step and nothing to clean up by hand: the
//     "prepare" action and the "reset" action are the same action.
//
//  2. Atomic. A case is assembled in a staging directory and moved into place
//     with a single rename. A crash, a failed copy or a killed process
//     therefore leaves the case directory either untouched or absent — never
//     half-populated. A tester who starts a run always starts on complete data.
//
//  3. Outside the repository. The working copy is unpacked under the system
//     temp directory, at
//
//         <tmpdir>/pf-test-data/<ISSUE-ID>/<TC-ID>
//
//     never inside the checkout. Preparing data any number of times leaves
//     `git status --porcelain` byte for byte identical, so switching branches
//     and the pre-close quality gate keep working. The same formula is written
//     into each case's prerequisites in the checklist, so the checklist stays
//     self-sufficient when read as a plain file.
//
// Portability: standard library only (node:fs, node:os, node:path, node:url),
// no npm packages, no sub-processes, no shell, no platform-specific paths —
// every path is composed with path.join. It runs wherever the Manual Test UI
// runs.
//
// Output (machine readable, consumed by tools/manual-test-ui/lib/prepare.js):
//
//     PF-PREPARED <TC-ID> <absolute path of the working copy>
//     PF-FILE <TC-ID> <path of a prepared file, relative to that copy>
//
// Exit status: 0 when everything requested was prepared, 1 otherwise (an
// undeclared test case id, a missing fixture, an unwritable temp directory).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// --- BEGIN GENERATED CONFIG ---
// Replaced wholesale by /pf-test. `PRELUDE` holds the entries every case
// shares; `CASES` maps each Manual TC-ID to the entries it declared.
//
// Both manual cases here run the closure procedure inside a throwaway copy of
// the repository, so each one needs its own fixture issue. They share no
// entries, hence an empty PRELUDE.
const ISSUE_ID = "20260806-feat-product-test-plan";
const PRELUDE = [];
const CASES = {
  "TC-014": [
    "test/fixtures/pf-product-test-plan/issue-real-close/docs/issues/open/20990101-feat-fixture-realclose/test_plan.md",
    "test/fixtures/pf-product-test-plan/issue-real-close/docs/issues/open/20990101-feat-fixture-realclose/qa_report.md",
  ],
  "TC-016": [
    "test/fixtures/pf-product-test-plan/issue-partial-promotion/docs/issues/open/20990101-feat-fixture-partial/test_plan.md",
    "test/fixtures/pf-product-test-plan/issue-partial-promotion/docs/issues/open/20990101-feat-fixture-partial/qa_report.md",
    "test/fixtures/pf-product-test-plan/issue-partial-promotion/docs/planning/test-plan.md",
  ],
};
// --- END GENERATED CONFIG ---

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(SCRIPT_DIR, "fixtures");

// The one place the location of prepared data is defined. Keep it in step with
// the prerequisites block of the checklist.
const ISSUE_ROOT = path.join(os.tmpdir(), "pf-test-data", ISSUE_ID);

// Staging lives next to the case directories rather than in a directory of its
// own, so the final move is a rename within one filesystem and cannot degrade
// into a copy that is observable half-done.
const STAGING_ROOT = path.join(ISSUE_ROOT, ".staging");

/** Absolute path of the working copy of one test case. */
function workdirFor(tcId) {
  return path.join(ISSUE_ROOT, tcId);
}

/** Split a declared entry into path segments; entries always use forward slashes. */
function segmentsOf(relPath) {
  return relPath.split("/").filter((s) => s.length > 0);
}

function removeTree(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

/**
 * Copy one fixture entry into the staging tree.
 *
 * Returns the relative paths of the files it produced, so the report can list
 * what a tester actually got rather than what was asked for.
 */
function copyEntry(sourcePath, destPath, relPath) {
  const stat = fs.statSync(sourcePath);

  if (stat.isDirectory()) {
    fs.mkdirSync(destPath, { recursive: true });
    const produced = [];
    const names = fs.readdirSync(sourcePath).sort();
    for (const name of names) {
      produced.push(
        ...copyEntry(path.join(sourcePath, name), path.join(destPath, name), `${relPath}/${name}`)
      );
    }
    return produced;
  }

  if (!stat.isFile()) {
    throw new Error(`fixture "${relPath}" is neither a file nor a directory`);
  }

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(sourcePath, destPath);
  return [relPath];
}

/**
 * Rebuild one test case from scratch.
 *
 * Assembles into `<ISSUE_ROOT>/.staging/<TC-ID>`, then removes the previous
 * working copy and renames staging into its place. Whatever the tester did to
 * the old copy — edited a file, deleted one, dropped extra ones in — is gone,
 * because the directory itself is replaced rather than patched.
 */
function prepareCase(tcId) {
  const entries = CASES[tcId];
  const stagingDir = path.join(STAGING_ROOT, tcId);

  removeTree(stagingDir);
  fs.mkdirSync(stagingDir, { recursive: true });

  const files = [];
  for (const relPath of entries) {
    const segments = segmentsOf(relPath);
    const sourcePath = path.join(FIXTURES_DIR, ...segments);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`fixture "${relPath}" declared for ${tcId} does not exist under test-data/fixtures`);
    }
    files.push(...copyEntry(sourcePath, path.join(stagingDir, ...segments), segments.join("/")));
  }

  const workdir = workdirFor(tcId);
  fs.mkdirSync(ISSUE_ROOT, { recursive: true });
  removeTree(workdir);
  fs.renameSync(stagingDir, workdir);

  files.sort();
  return { tcId, workdir, files };
}

function report(prepared) {
  process.stdout.write(`PF-PREPARED ${prepared.tcId} ${prepared.workdir}\n`);
  for (const file of prepared.files) {
    process.stdout.write(`PF-FILE ${prepared.tcId} ${file}\n`);
  }
}

function main() {
  const declared = Object.keys(CASES);
  const requested = process.argv.slice(2);
  const targets = requested.length > 0 ? requested : declared;

  // Validated before anything is created: an undeclared id is a typo in a
  // command line or in a checklist, and it must not leave a directory behind
  // to confuse the next run.
  const unknown = targets.filter((id) => !Object.prototype.hasOwnProperty.call(CASES, id));
  if (unknown.length > 0) {
    process.stderr.write(`unknown test case: ${unknown.join(", ")}\n`);
    process.stderr.write(`declared test cases of ${ISSUE_ID}: ${declared.join(", ")}\n`);
    return 1;
  }

  if (declared.length === 0) {
    process.stderr.write(`no test cases are declared for ${ISSUE_ID}\n`);
    return 1;
  }

  // Swept before and after: a previous run killed mid-flight may have left a
  // staging tree, and it is never valid input for this one.
  removeTree(STAGING_ROOT);
  try {
    for (const tcId of targets) {
      report(prepareCase(tcId));
    }
  } catch (error) {
    process.stderr.write(`prepare failed: ${(error && error.message) || error}\n`);
    return 1;
  } finally {
    removeTree(STAGING_ROOT);
  }

  return 0;
}

process.exitCode = main();
