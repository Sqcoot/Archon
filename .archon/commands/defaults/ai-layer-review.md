---
description: Review final AI-layer diff against goal, plan, SDD/ATDD, and LSP constraints
argument-hint: <ai-layer bootstrap request>
---

# AI Layer Review

Request: $ARGUMENTS

## Goal Check

Read all required artifacts from `$ARTIFACTS_DIR/ai-layer`, especially `goal.json`, `implementation-plan.md`, `file-plan.json`, `sdd-atdd-audit.md`, `lsp-navigation-plan.md`, `validation.json`, and `lsp-validation.json`.

Own only read-only review.

## Required Work

1. Inspect `git diff`.
2. Compare changed files against `file-plan.json`.
3. Flag unplanned edits, risky config edits, missing planned files, SDD/ATDD drift, provider-specific mistakes, invalid CLI examples, unvalidated MCP/LSP/hook claims, unsupported schema fields, committed runtime artifacts, and generated bundle mismatch.
4. Write:
   - `$ARTIFACTS_DIR/ai-layer/review.md`
   - `$ARTIFACTS_DIR/ai-layer/review.json`
5. Update `$ARTIFACTS_DIR/ai-layer/status.json`.

## Guardrails

- Do not self-approve if validation failed.
- Do not hide deferred work.

## Output

End with:
- status
- artifacts written
- acceptance criteria satisfied
- blockers
- next recommended node
- whether retry is needed
