---
doc_language: English
size_tier: trivial
profile: solo-claude
---

Temporary fixture task, used only while checking that a test case declared
`Auto` is actually picked up and marked by the test stage.

It is not a real task and must never be committed into a real project: it
exists so that the copy under test contains exactly one task folder, which
makes the active task unambiguous.
