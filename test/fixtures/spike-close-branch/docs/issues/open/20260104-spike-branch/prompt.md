---
type: spike
doc_language: English
idea_tier: infra
interaction: front-loaded
roles:
  hypothesis: { write: claude, review: [claude] }
  findings:   { write: claude, review: [claude] }
on_unavailable: degrade-tier
---

## Question
Can library Whirl handle a 10k-row batch within the time-box?

## Success Criterion
A sample script processes a 10k-row fixture and prints a final row count.

## Time-box
One day.

## Method
Write a small script using library Whirl and run it against a sample fixture.
