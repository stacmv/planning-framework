# Bug: pagination skips the last page

Listing `/orders?page=N` returns `[]` for the final page when the total row
count is an exact multiple of the page size.

This file is BYTE-IDENTICAL in both layouts. Converge must simply delete the
source — no `prompt.v2.md` (TC-052, step 5).
