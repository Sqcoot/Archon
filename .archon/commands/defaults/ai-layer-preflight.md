---
description: Inspect Archon and Helpline context before AI-layer product edits
argument-hint: <ai-layer bootstrap request>
---

# AI Layer Preflight

Request: $ARGUMENTS

## Goal Check

Read `goal.md`, `goal.json`, `branch-gate.json`, `artifact-registry.json`, and `status.json` from `$ARTIFACTS_DIR/ai-layer`.

Own only read-only preflight inspection.

## Required Work

1. Verify Archon repo identity, branch, remote, status, and target cwd.
2. Verify `/Users/edam/Documents/TODA/helpline` exists and is readable.
3. Inspect actual workflow and command conventions.
4. Inspect workflow schemas, command validation, provider registry, docs conventions, and bundled default generation.
5. Inspect validation commands from `package.json`.
6. Inspect TypeScript config and language/tooling context.
7. Record high-risk files and config merge constraints.
8. Write `$ARTIFACTS_DIR/ai-layer/preflight.md`.
9. Update `$ARTIFACTS_DIR/ai-layer/status.json`.

## Guardrails

- Do not write product files.
- Do not use dev branch assumptions.
- Do not use network access to inspect Helpline.

## Output

End with:
- status
- artifacts written
- acceptance criteria satisfied
- blockers
- next recommended node
- whether retry is needed
