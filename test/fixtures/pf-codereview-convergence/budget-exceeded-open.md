# Budget-decision fixture (TC-003 step 1b — CR-001)
#
# round > budget, at least one blocking finding still open. The ledger's round
# counter is append-only and never resets, including after this exact
# escalation path (Phase 3.5's early bail-out, or this rule's own
# return-to-execute below) routes the issue back to /pf-execute and a fix
# comes back for re-review — so a fresh cycle's first round can already start
# ABOVE the budget, not just land exactly on it. Budget 3, exhausted at round
# 3 with an open P0/P1 -> escalate -> /pf-execute -> fix -> re-review is now
# round 4, still with an open P0/P1. Expected pf_cr_budget_decision result:
# return-to-execute (same as round == budget) — CR-001's fix generalizes the
# rule to "round >= budget", not just "round == budget".

round: 4
budget: 3
open_blocking: 2
