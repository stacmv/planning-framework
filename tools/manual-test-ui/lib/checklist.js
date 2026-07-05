"use strict";

// Parses and patches manual_test_checklist.md files produced by the
// planning-framework pf-test skill. Patching is always a single targeted
// line replacement re-derived from a fresh read of the file — never a full
// re-serialization — so anything this tool doesn't understand (prose,
// formatting, extra whitespace) survives untouched.

const TC_HEADING_RE = /^##\s+TC-(\d+):\s*(.+?)\s*$/;
const META_RE = /^\*\*(.+?):\*\*\s*(.*)$/;
const PREREQ_LABEL_RE = /^\*\*Prerequisites:\*\*\s*$/;
const STEPS_HEADER_RE = /^\|\s*Step\s*\|/i;
const NOTES_LABEL_RE = /^\*\*Notes:\*\*\s*(.*)$/;
const RESULT_CELL_RE = /^\[([ xX])\]\s*(.*)$/;

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
        const resultCol = headerCells.indexOf("result");
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
