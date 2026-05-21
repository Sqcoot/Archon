---
description: Plan the Archon CODEBASE_MAP.md content for the AI layer
argument-hint: <ai-layer bootstrap request>
---

# AI Layer Map Codebase

Request: $ARGUMENTS

## Goal Check

Read required artifacts from `$ARTIFACTS_DIR/ai-layer`: `goal.md`, `goal.json`, `branch-gate.json`, `artifact-registry.json`, `status.json`, `preflight.md`, `audit.md`, and `sdd-atdd-audit.md`.

Own only codebase-map planning.

## Required Work

1. Map packages, entry points, workflow engine, commands, providers, CLI, docs, tests, scripts, generated defaults, and high-risk files.
2. Include SDD/ATDD paths and validation commands.
3. Include TypeScript config and type-check entry points.
4. Include common change routes for workflow, command, provider, docs, skill, hook, MCP, generated defaults, and SDD/ATDD updates.
5. Write `$ARTIFACTS_DIR/ai-layer/codebase-map-plan.md`.
6. Update `$ARTIFACTS_DIR/ai-layer/status.json`.

## Guardrails

- Do not create `CODEBASE_MAP.md` until design has approved live edits.
- Keep the future map factual; do not document nonexistent commands.

## Output

End with:
- status
- artifacts written
- acceptance criteria satisfied
- blockers
- next recommended node
- whether retry is needed
