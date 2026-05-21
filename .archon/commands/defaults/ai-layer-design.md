---
description: Produce the AI-layer implementation plan, file plan, risk register, and write gate
argument-hint: <ai-layer bootstrap request>
---

# AI Layer Design

Request: $ARGUMENTS

## Goal Check

Read all prior required artifacts from `$ARTIFACTS_DIR/ai-layer`.

Own only final design and write authorization.

## Required Work

1. Decide implement now, propose, or defer for every requested feature.
2. Produce an instruction extraction table before editing `AGENTS.md` or `CLAUDE.md`.
3. Produce exact file plan, rollback plan, validation plan, and risk register.
4. Verify `branch-gate.json` has `canProceed=true`.
5. Verify risky config edits are proposed-only unless merge safety is proven.
6. Write:
   - `$ARTIFACTS_DIR/ai-layer/implementation-plan.md`
   - `$ARTIFACTS_DIR/ai-layer/file-plan.json`
   - `$ARTIFACTS_DIR/ai-layer/risk-register.json`
   - `$ARTIFACTS_DIR/ai-layer/write-gate.json`
7. Update `$ARTIFACTS_DIR/ai-layer/status.json`.

## Guardrails

- Do not invent workflow schema fields.
- Do not write product files in this node.

## Output

End with:
- status
- artifacts written
- acceptance criteria satisfied
- blockers
- next recommended node
- whether retry is needed
