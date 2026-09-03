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
Can library Zorp parse the legacy config format directly?

## Success Criterion
A sample legacy config file parses without a manual pre-processing step.

## Time-box
Half a day.

## Method
Write a small script using library Zorp against a real sample file.
