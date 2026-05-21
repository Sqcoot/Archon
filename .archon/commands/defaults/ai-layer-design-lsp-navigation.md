---
description: Design TypeScript-native symbol navigation for Archon's AI layer
argument-hint: <ai-layer bootstrap request>
---

# AI Layer Design LSP Navigation

Request: $ARGUMENTS

## Goal Check

Read required artifacts from `$ARTIFACTS_DIR/ai-layer`: `goal.md`, `goal.json`, `branch-gate.json`, `artifact-registry.json`, `status.json`, `helpline-lsp-notes.md`, and `preflight.md`.

Own only TypeScript navigation design.

## Required Work

1. Inspect TypeScript version, tsconfig files, package boundaries, path aliases, and type-check scripts.
2. Identify existing TypeScript compiler or language-service usage.
3. Decide implement/propose/defer for MCP/codebase-search.
4. Define the navigation rule placement.
5. Define deterministic validation for TypeScript symbol navigation.
6. Write `$ARTIFACTS_DIR/ai-layer/lsp-navigation-plan.md`.
7. Update `$ARTIFACTS_DIR/ai-layer/status.json`.

## Guardrails

- Do not add pyright.
- Do not claim MCP/LSP support works without validation.

## Output

End with:
- status
- artifacts written
- acceptance criteria satisfied
- blockers
- next recommended node
- whether retry is needed
