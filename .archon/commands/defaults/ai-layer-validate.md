---
description: Validate AI-layer workflow, commands, docs, generated defaults, and SDD/ATDD alignment
argument-hint: <ai-layer bootstrap request>
---

# AI Layer Validate

Request: $ARGUMENTS

## Goal Check

Read all required implementation artifacts from `$ARTIFACTS_DIR/ai-layer`.

Own deterministic validation except LSP/navigation-specific validation.

## Required Work

Run the strongest relevant commands discovered in preflight, including when present:
- `bun run cli validate workflows archon-ai-layer-bootstrap`
- `bun run cli validate commands`
- `bun run check:bundled`
- `bun run check:bundled-skill`
- `bun run aco:traceability`
- `bun run aco:test:acceptance`
- `bun run validate`

Record exact commands, outcomes, skipped checks, failures, and fixes.

Write:
- `$ARTIFACTS_DIR/ai-layer/validation.md`
- `$ARTIFACTS_DIR/ai-layer/validation.json`
- `$ARTIFACTS_DIR/ai-layer/validation-failures.json` if needed
- `$ARTIFACTS_DIR/ai-layer/retry-gate.json`

Update `$ARTIFACTS_DIR/ai-layer/status.json`.

## Guardrails

- Do not run forbidden ACO graph refresh commands.
- Do not claim validation passed unless commands prove it.

## Output

End with:
- status
- artifacts written
- acceptance criteria satisfied
- blockers
- next recommended node
- whether retry is needed
