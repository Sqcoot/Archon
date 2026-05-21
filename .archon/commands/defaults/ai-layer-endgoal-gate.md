---
description: Classify final AI-layer bootstrap terminal state from artifacts and validation
argument-hint: <ai-layer bootstrap request>
---

# AI Layer Endgoal Gate

Request: $ARGUMENTS

## Goal Check

Read every required artifact from `$ARTIFACTS_DIR/ai-layer`, including `completion-audit.json`, `validation.json`, `lsp-validation.json`, `review.json`, and current `git diff`.

Own only final terminal-state classification.

## Required Work

1. Verify branch and branch gate.
2. Verify goal, registry, status, inspection, design, implementation, validation, review, and completion artifacts.
3. Verify bundled workflow/commands and generated defaults.
4. Verify AI-layer files, skills, agents, and docs.
5. Verify SDD/ATDD alignment.
6. Verify Helpline LSP inspection and TypeScript navigation strategy.
7. Verify no MCP/LSP/hook claim exceeds validation proof.
8. Write:
   - `$ARTIFACTS_DIR/ai-layer/endgoal-gate.md`
   - `$ARTIFACTS_DIR/ai-layer/endgoal-gate.json`
9. Update `$ARTIFACTS_DIR/ai-layer/status.json`.

## Terminal States

Output exactly one:
- `ENDGOAL_COMPLETE`
- `ENDGOAL_PARTIAL_WITH_DEFERRED_ITEMS`
- `ENDGOAL_BLOCKED`
- `ENDGOAL_FAILED_VALIDATION`

Only `ENDGOAL_COMPLETE` may be described as complete.

## Output

End with:
- status
- artifacts written
- acceptance criteria satisfied
- blockers
- next recommended node
- whether retry is needed
