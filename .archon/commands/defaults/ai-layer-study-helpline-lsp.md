---
description: Inspect Helpline LSP and MCP files and adapt the concepts to TypeScript Archon
argument-hint: <ai-layer bootstrap request>
---

# AI Layer Study Helpline LSP

Request: $ARGUMENTS

## Goal Check

Read required artifacts from `$ARTIFACTS_DIR/ai-layer`: `goal.md`, `goal.json`, `branch-gate.json`, `artifact-registry.json`, and `status.json`.

Own only mandatory Helpline LSP/MCP inspection.

## Required Work

Inspect and cite exact paths for:
- `check_lsp.py`
- `check_lsp_navigation.py`
- `check_mcp.py`
- `validate_all.py`
- every `codebase_search.py`
- `pyproject.toml`
- root `CLAUDE.md`

Document:
- pyright optional dev dependency and `[tool.pyright]`
- `extraPaths`, `venvPath`, and `venv`
- `pyright-langserver --stdio`
- LSP definition/reference validation behavior
- MCP tool behavior
- navigation-by-symbol rule
- TypeScript-native Archon adaptation

Write `$ARTIFACTS_DIR/ai-layer/helpline-lsp-notes.md` and update `status.json`.

## Guardrails

- Do not add pyright to Archon in this node.
- Do not claim MCP works in Archon unless Archon tests prove it.

## Output

End with:
- status
- artifacts written
- acceptance criteria satisfied
- blockers
- next recommended node
- whether retry is needed
