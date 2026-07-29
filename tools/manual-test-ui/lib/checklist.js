"use strict";

// Parses and patches manual_test_checklist.md files produced by the
// planning-framework pf-test skill. Patching is always a single targeted
// line replacement re-derived from a fresh read of the file — never a full
// re-serialization — so anything this tool doesn't understand (prose,
// formatting, extra whitespace) survives untouched.

const TC_HEADING_RE = /^##\s+TC-(\d+):\s*(.+?)\s*$/;
const META_RE = /^\*\*(.+?):\*\*\s*(.*)$/;
// pf-test writes checklists in the issue's doc_language — accept both the
// English and the Russian labels it generates.
const PREREQ_LABEL_RE = /^\*\*(?:Prerequisites|Предварительные условия):\*\*\s*$/;
const STEPS_HEADER_RE = /^\|\s*(?:Step|Шаг)\s*\|/i;
const NOTES_LABEL_RE = /^\*\*(?:Notes|Заметки):\*\*\s*(.*)$/;
const RESULT_COL_NAMES = ["result", "результат"];
const RESULT_CELL_RE = /^\[([ xX])\]\s*(.*)$/;
// Data a TC needs, declared by pf-test inside the TC section, in one of two
// shapes:
//   **Требуемые данные:** не требуются          (**Test Data:** none)
//   **Требуемые данные:**  followed by a bullet list of paths
// A TC with no such label at all is *not* the same as one marked "none" — it
// predates the feature, so its data need is unknown, never "not needed".
const TEST_DATA_LABEL_RE = /^\*\*(?:Test Data|Требуемые данные):\*\*\s*(.*)$/;
const NO_DATA_VALUE_RE = /^(?:не\s+требуются|none)\s*\.?$/i;
// Where the prepared working copy was unpacked — a bullet inside the
// prerequisites block. It stays in `prerequisites` as well; this only lifts
// the path out for callers that need it.
const PREPARED_PATH_RE = /^-\s*(?:Prepared data|Подготовленные данные):\s*(.+?)\s*$/;

function stripBackticks(s) {
  return s.trim().replace(/^`+|`+$/g, "").trim();
}

function detectEol(text) {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

function splitCells(row) {
  // "| a | b | c |" -> ["a", "b", "c"], trimmed. Tolerates a missing
  // trailing pipe. Does not support escaped "\|" inside cells — this
  // format has never needed one.
  let s = row.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

function parseChecklist(content) {
  const eol = detectEol(content);
  const lines = content.split(/\r\n|\n/);

  const meta = {};
  const tcs = [];

  let i = 0;
  // Header metadata block, before the first TC heading.
  for (; i < lines.length && !TC_HEADING_RE.test(lines[i]); i++) {
    const m = lines[i].match(META_RE);
    if (m) meta[m[1].trim()] = m[2].trim();
  }

  while (i < lines.length) {
    const heading = lines[i].match(TC_HEADING_RE);
    if (!heading) {
      i++;
      continue;
    }
    const tc = {
      id: `TC-${heading[1]}`,
      name: heading[2],
      headingLineIndex: i,
      prerequisites: [],
      requiredData: [],
      dataStatus: "unknown",
      preparedPath: null,
      steps: [],
      notesLineIndex: null,
      notesText: "",
      parseWarnings: [],
    };
    i++;

    // Section runs until the next TC heading or EOF.
    const sectionEnd = (() => {
      for (let j = i; j < lines.length; j++) {
        if (TC_HEADING_RE.test(lines[j])) return j;
      }
      return lines.length;
    })();

    for (let j = i; j < sectionEnd; j++) {
      const line = lines[j];

      if (PREREQ_LABEL_RE.test(line)) {
        for (let k = j + 1; k < sectionEnd; k++) {
          const bullet = lines[k].match(/^-\s*(.*)$/);
          if (!bullet) break;
          tc.prerequisites.push(bullet[1]);
        }
        continue;
      }

      if (STEPS_HEADER_RE.test(line)) {
        // line = header, line+1 = "|---|---|---|---|" separator, then rows.
        const headerCells = splitCells(line).map((c) => c.toLowerCase());
        const resultCol = headerCells.findIndex((c) => RESULT_COL_NAMES.includes(c));
        if (resultCol === -1) {
          tc.parseWarnings.push("steps table has no Result column — skipped");
          continue;
        }
        let k = j + 2; // skip header + separator
        for (; k < sectionEnd; k++) {
          const row = lines[k];
          if (!row.trim().startsWith("|")) break;
          const cells = splitCells(row);
          if (cells.length <= resultCol) {
            tc.parseWarnings.push(`row ${k + 1}: fewer columns than header — skipped`);
            continue;
          }
          const stepNum = parseInt(cells[0], 10);
          if (Number.isNaN(stepNum)) continue; // not a data row (shouldn't happen here)
          const resultMatch = cells[resultCol].match(RESULT_CELL_RE);
          tc.steps.push({
            step: stepNum,
            action: cells[1] ?? "",
            expected: cells[2] ?? "",
            checked: resultMatch ? resultMatch[1].toLowerCase() === "x" : false,
            note: resultMatch ? resultMatch[2] : cells[resultCol],
            lineIndex: k,
            resultColIndex: resultCol,
          });
        }
        continue;
      }

      const dataMatch = line.match(TEST_DATA_LABEL_RE);
      if (dataMatch) {
        const inline = dataMatch[1].trim();
        const declaredNone = NO_DATA_VALUE_RE.test(inline);
        const items = [];
        for (let k = j + 1; k < sectionEnd; k++) {
          const bullet = lines[k].match(/^-\s*(.*)$/);
          if (!bullet) break;
          const item = stripBackticks(bullet[1]);
          if (item) items.push(item);
        }
        // An inline value that isn't the "none" marker is a single-item
        // declaration written on the label line.
        if (inline && !declaredNone) items.unshift(stripBackticks(inline));

        if (items.length) {
          tc.requiredData = items;
          tc.dataStatus = "declared";
          if (declaredNone) {
            tc.parseWarnings.push(
              "test data marked as not required but a list follows — treated as declared"
            );
          }
        } else if (declaredNone) {
          tc.dataStatus = "none";
        } else {
          // Label with nothing under it says nothing about the data need.
          tc.parseWarnings.push("test data block is empty — data need left unknown");
        }
        continue;
      }

      const preparedMatch = line.match(PREPARED_PATH_RE);
      if (preparedMatch) {
        tc.preparedPath = stripBackticks(preparedMatch[1]) || null;
        continue;
      }

      const notesMatch = line.match(NOTES_LABEL_RE);
      if (notesMatch) {
        tc.notesLineIndex = j;
        tc.notesText = notesMatch[1];
      }
    }

    tcs.push(tc);
    i = sectionEnd;
  }

  return { meta, tcs, eol, lineCount: lines.length };
}

function summarize(parsed) {
  let total = 0;
  let passed = 0;
  let failed = 0;
  for (const tc of parsed.tcs) {
    for (const s of tc.steps) {
      total++;
      if (s.checked) passed++;
    }
  }
  failed = 0; // "failed" isn't distinguishable from "not yet run" in this format —
  // an unchecked box means either. We only ever report done vs total.
  return { totalSteps: total, passedSteps: passed, totalTcs: parsed.tcs.length };
}

/**
 * Rewrite exactly one step's Result cell, in place, re-deriving its line
 * from a fresh parse so concurrent edits from another tab/process can't
 * be clobbered by a stale line number.
 */
function patchStepResult(content, tcId, stepNum, { checked, note }) {
  const parsed = parseChecklist(content);
  const tc = parsed.tcs.find((t) => t.id === tcId);
  if (!tc) throw new Error(`${tcId} not found`);
  const step = tc.steps.find((s) => s.step === stepNum);
  if (!step) throw new Error(`${tcId} step ${stepNum} not found`);

  const lines = content.split(/\r\n|\n/);
  const row = lines[step.lineIndex];
  const cells = splitCells(row);
  const box = checked ? "[x]" : "[ ]";
  const cleanNote = (note || "").replace(/\|/g, "/").trim();
  cells[step.resultColIndex] = cleanNote ? `${box} ${cleanNote}` : box;
  lines[step.lineIndex] = `| ${cells.join(" | ")} |`;

  return lines.join(parsed.eol);
}

/**
 * Rewrite a TC's free-text Notes line, in place.
 */
function patchNotes(content, tcId, notesText) {
  const parsed = parseChecklist(content);
  const tc = parsed.tcs.find((t) => t.id === tcId);
  if (!tc) throw new Error(`${tcId} not found`);
  if (tc.notesLineIndex === null) {
    throw new Error(`${tcId} has no **Notes:** line to patch`);
  }

  const lines = content.split(/\r\n|\n/);
  const cleanText = (notesText || "").replace(/\r?\n/g, " ").trim();
  lines[tc.notesLineIndex] = cleanText ? `**Notes:** ${cleanText}` : "**Notes:**";

  return lines.join(parsed.eol);
}

module.exports = { parseChecklist, summarize, patchStepResult, patchNotes };
