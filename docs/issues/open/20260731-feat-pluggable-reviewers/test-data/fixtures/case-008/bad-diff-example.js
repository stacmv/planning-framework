// Example "issue diff" for TC-008 — copy this file into a scratch project's
// working tree as if it were the code /pf-execute had just produced, so that
// /pf-codereview has a real, intentional P0-level problem to find.
//
// The bug: `sortField` comes straight from request input and is interpolated
// into a shell command with no sanitization — a classic command-injection P0.
const { execSync } = require("child_process");

function sortTasks(sortField, order) {
  const cmd = `sort -k ${sortField} -${order === "desc" ? "r" : ""} tasks.txt`;
  return execSync(cmd).toString();
}

module.exports = { sortTasks };
