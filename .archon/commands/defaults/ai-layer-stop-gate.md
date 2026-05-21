---
description: Decide whether the AI-layer bootstrap workflow is allowed to stop
argument-hint: <ai-layer bootstrap request>
---

# AI Layer Stop Gate

Request: $ARGUMENTS

## Goal Check

Read `$ARTIFACTS_DIR/ai-layer/endgoal-gate.json`, `completion-audit.json`, `status.json`, `validation.json`, `lsp-validation.json`, `retry-gate.json`, and `branch-gate.json`.

Own only stop permission.

## Required Work

1. Verify terminal state is one of the allowed endgoal states.
2. Verify branch is `stabilization/stab-002-sdd-atdd-alignment`.
3. Verify no retry is still recommended.
4. Verify no required node is pending.
5. Verify final response can honestly report results.
6. Write `$ARTIFACTS_DIR/ai-layer/stop-gate.json`.
7. Update `$ARTIFACTS_DIR/ai-layer/status.json`.

## Stop Rules

Set `canStop=true` only when completion-audit, endgoal-gate, validation, LSP validation, retry gate, status, and branch gate are coherent.

Set `canStop=false` when required artifacts are missing, branch is wrong, retry is recommended, runtime artifacts were committed, unsafe config edits were found, SDD/ATDD risk is unresolved, or LSP inspection is missing.

## Output

End with:
- status
- artifacts written
- acceptance criteria satisfied
- blockers
- next recommended node
- whether retry is needed
