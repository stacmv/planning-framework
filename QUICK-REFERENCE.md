# Planning Framework - Quick Reference

**One-page cheat sheet for the Planning Framework**

---

## 📁 Core Documents

| Document | Purpose | Update When |
|----------|---------|-------------|
| **prd.md** | Requirements, features, scope | Planning phase |
| **implementation-plan.md** | Task breakdown, progress | After each session |
| **session-log.md** | Session notes, next steps | During/end of session |
| **decisions.md** | Architecture choices (ADRs) | When deciding |

---

## 🚀 Session Start (3 steps, 2 minutes)

```bash
# 1. Read session log (last 50 lines)
tail -50 docs/planning/session-log.md

# 2. Check implementation status (Quick Status section)
head -40 docs/planning/implementation-plan.md

# 3. Review decisions
cat docs/planning/decisions.md
```

**Then:** Start task marked "Next Session" in implementation plan

---

## 🏁 Session End (4 steps, 5 minutes)

### 1. Update Session Log
```markdown
### Session: 2025-11-04

**Phase:** Phase 1 - Foundation
**Goal:** Implement config parser

#### Completed
- [x] Created ConfigParser class
- [x] Added YAML parsing
- [ ] Tests (partial)

#### Decisions Made
1. **YAML format:** Chose YAML over JSON for readability

#### Next Session Priorities
1. [ ] Complete test coverage
2. [ ] Add validation logic
```

### 2. Update Implementation Plan
- ✅ Check off completed tasks
- 🔄 Update "Quick Status" at top
- 📊 Update phase progress

### 3. Document Decisions
- 📝 Add ADR for any architectural decisions

### 4. Commit
```bash
git add .
git commit -m "Session 2025-11-04: Implemented config parser"
```

---

## 📝 ADR Template (2 minutes)

```markdown
## ADR-001: [Decision Title]

**Date:** 2025-11-04
**Status:** Accepted

### Context
[Problem description]

### Options Considered
1. **Option A:** [Pros/Cons]
2. **Option B:** [Pros/Cons]

### Decision
Chose [Option] because [reason]

### Consequences
**Positive:** [Benefits]
**Negative:** [Trade-offs]
```

---

## ✅ Progress Tracking

**Checkbox format:**
- `[ ]` = Not started / ⏸️ Not Started
- `[~]` = In progress / 🔄 In Progress
- `[x]` = Complete / ✅ Complete

**Example:**
```markdown
- [x] Task 1: Complete
- [~] Task 2: In progress (70% done)
- [ ] Task 3: Not started
```

---

## 🎯 Implementation Plan Structure

```markdown
## Quick Status
**Current Phase:** Phase 1
**Current Task:** Task 1.1 - Config Parser
**Next Task:** Task 1.2 - Validation

## Phase 1: Foundation (2/5 complete, 40%)
#### 1.1 Config Parser ✅ Complete
#### 1.2 Validator 🔄 In Progress
#### 1.3 Platform Detection ⏸️ Not Started
```

---

## 🤖 For AI Assistants

**Always do:**
- ✅ Read planning docs at session start
- ✅ Update progress immediately
- ✅ Document decisions (ADR)
- ✅ Mark next task before ending

**Never do:**
- ❌ Skip reading planning docs
- ❌ Make decisions without documenting
- ❌ Complete tasks without updating plan
- ❌ End session without updating log

---

## 🔧 Setup New Project

**Quick setup:**
```bash
# Copy templates
cp -r /path/to/templates ./planning-framework
cd planning-framework

# Run setup script
./setup-planning-framework.sh /path/to/project "ProjectName"
```

**Manual setup:**
```bash
mkdir -p docs/planning
cp prd-template.md docs/prd.md
cp implementation-plan-template.md docs/planning/implementation-plan.md
cp session-log-template.md docs/planning/session-log.md
cp decisions-template.md docs/planning/decisions.md

# Customize: Replace [Project Name] and YYYY-MM-DD
```

---

## 📋 Document Sizes

**For reference (adjust to your project):**

| Document | Small Project | Medium Project | Large Project |
|----------|---------------|----------------|---------------|
| **PRD** | 2-5 pages | 10-20 pages | 30+ pages |
| **Implementation Plan** | 1-3 pages | 10-15 pages | 30+ pages |
| **Session Log** | Grows over time | Grows over time | Grows over time |
| **Decisions** | 1-3 ADRs | 5-15 ADRs | 20+ ADRs |

---

## 🎨 Customization

**Simplify for small projects:**
- Combine implementation plan + session log
- Skip ADRs for obvious decisions
- Single-page PRD

**Extend for large projects:**
- Split implementation plan by phase
- Add risks.md, dependencies.md
- Add testing-plan.md, deployment-plan.md

---

## 📚 Learn More

- **Full guide:** `docs/planning/FRAMEWORK.md`
- **Templates:** `docs/planning/templates/`
- **Export guide:** `docs/planning/EXPORT-GUIDE.md`
- **Example:** BackupSystem project (this repo)

---

## 💡 Tips

**Effective PRDs:**
- Focus on "what" and "why", not "how"
- Use bullet points, not paragraphs
- Include examples and diagrams

**Effective Implementation Plans:**
- Break tasks into manageable chunks
- Mark dependencies clearly
- Keep "Quick Status" up to date

**Effective Session Logs:**
- Update during session, not after
- Be specific (not "fixed bugs" but "fixed parser null handling")
- Always set next priorities

**Effective ADRs:**
- Write when deciding, not retroactively
- Explain "why", not "how"
- Include alternatives considered
- Keep concise (1-2 pages max)

---

## ⚡ Common Mistakes

❌ **Don't:**
- Skip reading planning docs at session start
- Batch updates (update as you go)
- Document "how" in ADRs (focus on "why")
- Make Quick Status stale

✅ **Do:**
- Read planning docs every session
- Update progress immediately
- Explain rationale in ADRs
- Keep Quick Status current

---

## 📊 Success Metrics

**Framework is working if:**
- ✅ Zero "where was I?" confusion
- ✅ Context fully restored in < 5 minutes
- ✅ Decisions not revisited unnecessarily
- ✅ Progress visible at a glance
- ✅ AI assistants maintain consistency

---

## 🆘 Troubleshooting

**"Planning docs are out of date"**
→ Update at session end, not beginning

**"Too much overhead"**
→ Simplify templates, combine documents

**"AI not following decisions"**
→ Ensure decisions.md is read at session start

**"Lost track of progress"**
→ Update Quick Status after each task

---

**Version:** 1.1
**Last Updated:** 2025-11-12
**Full Documentation:** `docs/planning/FRAMEWORK.md`
