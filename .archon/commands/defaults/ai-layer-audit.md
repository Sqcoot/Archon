---
description: Inventory existing Archon AI-layer instructions, skills, agents, hooks, and config
argument-hint: <ai-layer bootstrap request>
---

# AI Layer Audit

Request: $ARGUMENTS

## Goal Check

Read required artifacts from `$ARTIFACTS_DIR/ai-layer`: `goal.md`, `goal.json`, `branch-gate.json`, `artifact-registry.json`, and `status.json`.

Own only existing AI-layer inventory and preservation requirements.

## Required Work

1. Inventory root `AGENTS.md`, root `CLAUDE.md`, and `CODEBASE_MAP.md`.
2. Inventory `.agents/skills`, `.claude/skills`, `.claude/agents`, `.codex/agents`, `.codex/hooks.json`, `.codex/config.toml`, `.claude/settings.json`, and `.mcp.json` when present.
3. Identify existing hooks, settings, MCP servers, skills, agents, commands, and workflows that must not be removed.
4. Identify missing pieces for Claude and Codex compatibility.
5. Write `$ARTIFACTS_DIR/ai-layer/audit.md`.
6. Update `$ARTIFACTS_DIR/ai-layer/status.json`.

## Guardrails

- Do not overwrite high-risk config.
- Prefer proposal artifacts when merge safety is uncertain.

## Output

End with:
- status
- artifacts written
- acceptance criteria satisfied
- blockers
- next recommended node
- whether retry is needed
