---
description: Validate Helpline LSP inspection and Archon TypeScript symbol-navigation adaptation
argument-hint: <ai-layer bootstrap request>
---

# AI Layer Validate LSP Navigation

Request: $ARGUMENTS

## Goal Check

Read `goal.md`, `goal.json`, `branch-gate.json`, `artifact-registry.json`, `status.json`, `helpline-lsp-notes.md`, `lsp-navigation-plan.md`, and `validation.json` from `$ARTIFACTS_DIR/ai-layer`.

Own only LSP/navigation validation.

## Required Work

1. Verify Helpline LSP files were inspected and documented.
2. Verify `pyrightCopied=false` unless an explicit Python requirement exists.
3. If TypeScript navigation validation was implemented, run it and record command output.
4. If MCP is deferred/proposed, verify docs and artifacts do not claim working MCP.
5. Write:
   - `$ARTIFACTS_DIR/ai-layer/lsp-validation.md`
   - `$ARTIFACTS_DIR/ai-layer/lsp-validation.json`
6. Update `$ARTIFACTS_DIR/ai-layer/status.json`.

## Guardrails

- Do not claim LSP navigation works unless validation passes.
- Do not claim MCP works unless symbol-level MCP tests pass.

## Output

End with:
- status
- artifacts written
- acceptance criteria satisfied
- blockers
- next recommended node
- whether retry is needed
