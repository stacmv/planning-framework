---
type: idea
doc_language: English
idea_tier: infra
interaction: front-loaded
---

## Idea
Move the internal build cache to a shared network volume.

## Evidence of Pain
Every developer rebuilds the cache locally from scratch.

## Constraints
No budget for a managed service.

## Out of Scope
Multi-region replication.

## What Would Convince You: Project
Two developers reporting the shared cache actually saved them a rebuild.

## Decision Rights
AI may pick the storage backend.
