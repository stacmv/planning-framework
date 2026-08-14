# Budget-decision fixture (TC-003 step 3)
#
# round == budget, but this round's own review is clean (no open P0/P1).
# Expected pf_cr_budget_decision result: pass — the budget must not block a
# legitimate PASS (BR-7).

round: 3
budget: 3
open_blocking: 0
