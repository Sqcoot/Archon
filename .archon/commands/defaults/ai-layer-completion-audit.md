---
description: Check artifact and deliverable readiness before the AI-layer endgoal gate
argument-hint: <ai-layer bootstrap request>
---

# AI Layer Completion Audit

Request: $ARGUMENTS

## Goal Check

Read every required artifact listed in `$ARTIFACTS_DIR/ai-layer/artifact-registry.json`.

Own only pre-final completion readiness.

## Required Work

1. Verify branch correctness and `branch-gate.json`.
2. Verify required artifacts exist, JSON parses, Markdown is non-empty, and `status.json` is current.
3. Verify every Phase 1 deliverable is implemented, proposed, or explicitly blocked.
4. Verify optional deliverables are implemented, proposed, deferred, or disabled by arguments.
5. Verify changed files match `file-plan.json`.
6. Verify runtime artifacts are not committed.
7. Verify Helpline LSP inspection and TypeScript navigation plan exist.
8. Verify validation and review artifacts exist.
9. Write:
   - `$ARTIFACTS_DIR/ai-layer/completion-audit.md`
   - `$ARTIFACTS_DIR/ai-layer/completion-audit.json`
10. Update `$ARTIFACTS_DIR/ai-layer/status.json`.

## Output States

- `READY_FOR_ENDGOAL_GATE`
- `NOT_READY_WRONG_BRANCH`
- `NOT_READY_MISSING_ARTIFACTS`
- `NOT_READY_VALIDATION_FAILED`
- `NOT_READY_UNPLANNED_CHANGES`
- `NOT_READY_SDD_ATDD_RISK`
- `NOT_READY_LSP_INSPECTION_MISSING`
- `NOT_READY_BLOCKED`

## Output

End with:
- status
- artifacts written
- acceptance criteria satisfied
- blockers
- next recommended node
- whether retry is needed
