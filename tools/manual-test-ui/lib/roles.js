// The role → documents table of the Manual Test UI (implementation_plan.md,
// Task 8).
//
// This file is the *only* place where "which documents does a role show"
// is written down. The browser client has no list of its own: it asks
// `GET /api/roles` and renders whatever comes back (AC-04a…AC-04d, TC-006
// step 7). A second copy in `public/app.js` would be a second answer to the
// same question, and the two would drift apart the first time a document is
// renamed.
//
// Design constraints, identical to `lib/markdown.js`:
//   * zero dependencies — no npm packages and no `node:` builtins either, so
//     the same file loads under `require` and under `<script src>`;
//   * nothing is touched at load time — no `document`, no `window`, no I/O.
//     That is what makes the table assertable from `node --test` without any
//     browser infrastructure;
//   * pure data plus lookup rules. Whether a document *exists* and whether it
//     is applicable to a given issue is not decided here — that needs the
//     filesystem and git, and lives in `lib/docstate.js` (server-side only).
//
// A role shows exactly what it declares and nothing else: every accessor
// returns a deep copy, so a caller that decorates items with per-request
// state (the server does, on every role request) cannot leak that state into
// the next request's answer. TC-006 step 6 exists to catch precisely that.
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PFRoles = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // What kind of thing an entry points at. The server keys its state
  // resolution on this, and the client keys its rendering on it.
  var KIND = {
    // A document of the issue folder itself (docs/issues/<status>/<id>/…).
    ISSUE_DOC: "issue_doc",
    // A document of the project, outside any issue.
    PROJECT_DOC: "project_doc",
    // The project-instructions section: every CLAUDE.md in force, including
    // the inherited ones. Served by GET .../instructions, not as one file.
    INSTRUCTIONS: "instructions",
    // The accumulated-memory section, which lives outside the repository.
    MEMORY: "memory",
    // Something to do rather than to read.
    ACTION: "action",
  };

  var ROLES = [
    {
      id: "analyst",
      title: "Analyst",
      description:
        "The problem as stated and as understood: what was asked for, what it means, and what has already been decided.",
      items: [
        {
          kind: KIND.ISSUE_DOC,
          id: "prompt.md",
          name: "prompt.md",
          label: "Issue prompt",
          description: "The request as it was originally written, with the issue's type and size tier.",
        },
        {
          kind: KIND.ISSUE_DOC,
          id: "brd.md",
          name: "brd.md",
          label: "Business requirements",
          description: "Goals, user stories and acceptance criteria.",
        },
        {
          kind: KIND.ISSUE_DOC,
          id: "analysis.md",
          name: "analysis.md",
          label: "Problem analysis",
          description: "Root cause, reproduction and impact — the bug pipeline's counterpart of the BRD.",
        },
        {
          kind: KIND.ISSUE_DOC,
          id: "notes.md",
          name: "notes.md",
          label: "Working notes",
          description: "The single document a trivial-tier issue gets instead of a BRD, a spec and a plan.",
        },
        {
          kind: KIND.PROJECT_DOC,
          id: "PLANNING.md",
          name: "PLANNING.md",
          docPath: "PLANNING.md",
          label: "Framework configuration",
          description: "How the Planning Framework is configured for this project.",
        },
        {
          kind: KIND.PROJECT_DOC,
          id: "docs/planning/decisions.md",
          name: "docs/planning/decisions.md",
          docPath: "docs/planning/decisions.md",
          label: "Architectural decisions",
          description: "Decisions taken across the project, promoted out of individual issues.",
        },
      ],
    },
    {
      id: "developer",
      title: "Developer",
      description:
        "What has to be built and under what rules: the spec, the plans, the project's own history, and everything that is in force for it.",
      items: [
        {
          kind: KIND.ISSUE_DOC,
          id: "specs.md",
          name: "specs.md",
          label: "Technical spec",
          description: "Interfaces, data and behaviour of the change.",
        },
        {
          kind: KIND.ISSUE_DOC,
          id: "implementation_plan.md",
          name: "implementation_plan.md",
          label: "Implementation plan",
          description: "The issue's tasks, mapped to its test cases.",
        },
        {
          kind: KIND.PROJECT_DOC,
          id: "docs/planning/implementation-plan.md",
          name: "docs/planning/implementation-plan.md",
          docPath: "docs/planning/implementation-plan.md",
          label: "Project roadmap",
          description: "The project-wide roadmap — a different document from the issue's own plan.",
        },
        {
          kind: KIND.PROJECT_DOC,
          id: "docs/planning/session-log.md",
          name: "docs/planning/session-log.md",
          docPath: "docs/planning/session-log.md",
          label: "Session log",
          description: "The project's timeline of sessions.",
        },
        {
          kind: KIND.INSTRUCTIONS,
          id: "CLAUDE.md",
          name: "CLAUDE.md",
          label: "Project instructions",
          description:
            "Every CLAUDE.md in force for the project, including the ones inherited from parent directories.",
        },
        {
          kind: KIND.MEMORY,
          id: "memory",
          name: "memory",
          label: "Accumulated memory",
          description: "What has been remembered about this project, kept outside the repository.",
        },
      ],
    },
    {
      id: "tester",
      title: "Tester",
      description: "What to verify, how it is checked off, and the data a case needs before it can be run.",
      items: [
        {
          kind: KIND.ISSUE_DOC,
          id: "test_plan.md",
          name: "test_plan.md",
          label: "Test plan",
          description: "Every test case of the issue, automated and manual.",
        },
        {
          kind: KIND.ISSUE_DOC,
          id: "manual_test_checklist.md",
          name: "manual_test_checklist.md",
          label: "Manual test checklist",
          description: "The manual cases, as an external tester fills them in.",
        },
        {
          kind: KIND.ISSUE_DOC,
          id: "qa_report.md",
          name: "qa_report.md",
          label: "QA report",
          description: "The PASS/FAIL verdict produced by /pf-qa.",
        },
        {
          kind: KIND.PROJECT_DOC,
          id: ".qa-workflow.md",
          name: ".qa-workflow.md",
          docPath: ".qa-workflow.md",
          label: "QA workflow",
          description: "The checks this project requires before an issue may be closed.",
        },
        {
          kind: KIND.ACTION,
          id: "prepare",
          name: "prepare",
          label: "Prepare test data",
          description: "Unpack the working copy of a case's declared test data.",
        },
      ],
    },
  ];

  // ------------------------------------------------------------- accessors

  // A structural clone, so the table itself can never be mutated by a caller
  // that decorates what it was handed. Deliberately hand-rolled: JSON
  // round-tripping is slower and `structuredClone` is not available in every
  // browser this tool has to load in.
  function clone(value) {
    if (Array.isArray(value)) {
      var copy = [];
      for (var i = 0; i < value.length; i++) copy.push(clone(value[i]));
      return copy;
    }
    if (value && typeof value === "object") {
      var out = {};
      for (var key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) out[key] = clone(value[key]);
      }
      return out;
    }
    return value;
  }

  function roleIds() {
    var ids = [];
    for (var i = 0; i < ROLES.length; i++) ids.push(ROLES[i].id);
    return ids;
  }

  /** Every role, deep-copied, in display order. */
  function listRoles() {
    return clone(ROLES);
  }

  /** One role by its stable id, deep-copied, or null when there is no such role. */
  function getRole(id) {
    for (var i = 0; i < ROLES.length; i++) {
      if (ROLES[i].id === id) return clone(ROLES[i]);
    }
    return null;
  }

  function hasRole(id) {
    return getRole(id) !== null;
  }

  /** The declared entries of a role, deep-copied. `[]` for an unknown role. */
  function itemsOf(id) {
    var role = getRole(id);
    return role ? role.items : [];
  }

  /**
   * Does `roleId` declare an entry named `name`?
   *
   * The negative answer is the useful one: "a role shows nothing beyond what
   * it declares" is a property worth checking, not an assumption.
   */
  function declares(roleId, name) {
    var items = itemsOf(roleId);
    for (var i = 0; i < items.length; i++) {
      if (items[i].name === name) return true;
    }
    return false;
  }

  return {
    KIND: KIND,
    ROLE_IDS: roleIds(),
    listRoles: listRoles,
    getRole: getRole,
    hasRole: hasRole,
    itemsOf: itemsOf,
    declares: declares,
  };
});
