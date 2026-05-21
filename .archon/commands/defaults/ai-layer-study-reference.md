---
description: Study the local Helpline reference and classify reusable AI-layer ideas
argument-hint: <ai-layer bootstrap request>
---

# AI Layer Study Reference

Request: $ARGUMENTS

## Goal Check

Read required artifacts from `$ARTIFACTS_DIR/ai-layer`: `goal.md`, `goal.json`, `branch-gate.json`, `artifact-registry.json`, and `status.json`.

Own only read-only Helpline reference classification.

## Required Work

1. Inspect `ARCHON_HELPLINE_REFERENCE_ROOT` as read-only reference material when configured; otherwise stop with `not_configured`.
2. Classify ideas as generalizable, repo-specific, provider-specific, implement-now, propose, or defer.
3. Do not copy repo-specific content blindly.
4. Write `$ARTIFACTS_DIR/ai-layer/helpline-notes.md`.
5. Update `$ARTIFACTS_DIR/ai-layer/status.json`.

## Guardrails

- Do not use network access.
- Do not modify Helpline.
- Do not copy Python-specific setup into Archon without evidence.

## Output

End with:
- status
- artifacts written
- acceptance criteria satisfied
- blockers
- next recommended node
- whether retry is needed
