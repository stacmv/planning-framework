# Analysis

## Root cause

`totalPages` is computed as `Math.floor(total / size)` instead of
`Math.ceil(total / size)`, and the off-by-one only shows up when
`total % size === 0`.

## Fix

Use `Math.ceil`, and add a regression test for the exact-multiple case.

## Blast radius

Only the listing endpoint. No schema change.
