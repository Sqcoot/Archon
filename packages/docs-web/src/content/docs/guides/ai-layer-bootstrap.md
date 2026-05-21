---
title: AI Layer Bootstrap
description: Generate and validate artifact-first Claude and Codex project context for large codebases.
category: guides
area: workflows
audience: [user]
status: current
sidebar:
  order: 10
---

AI Layer Bootstrap is a bundled Archon workflow that analyzes a repository and creates a maintainable AI layer for agents working in that codebase.

In Archon terms, the AI layer is:

- lean root instructions for shared rules
- provider-specific compatibility files for Claude and Codex
- a factual codebase map
- scoped skills for repeatable procedures
- optional read-only explorer agents
- artifact-first workflow handoff
- JSON gates for branch, write, retry, completion, endgoal, and stop decisions
- deterministic validation

## Workflow

Run the bundled workflow from the target repository:

```bash
bun run cli workflow run archon-ai-layer-bootstrap --no-worktree "provider=both --propose Bootstrap an AI layer"
```

The workflow writes durable runtime artifacts under:

```text
$ARTIFACTS_DIR/ai-layer/
```

It does not use `.archon/artifacts/ai-layer` as a fallback.

## SDD/ATDD Alignment

On the stabilization branch, AI Layer Bootstrap follows the same SDD/ATDD rule as Context Orchestrator work:

1. Define or update a spec.
2. Define acceptance scenarios.
3. Implement.
4. Validate.
5. Audit completion before stopping.

The workflow uses `completion-audit`, `endgoal-gate`, and `stop-gate` nodes so it does not stop after only writing files or running validation.

## Artifacts

Required artifacts include:

- `branch-gate.json`
- `goal.md`
- `goal.json`
- `artifact-registry.json`
- `status.json`
- `routing-gate.json`
- `write-gate.json`
- `validation.json`
- `lsp-validation.json`
- `retry-gate.json`
- `completion-audit.json`
- `endgoal-gate.json`
- `stop-gate.json`

The final terminal state is one of:

- `ENDGOAL_COMPLETE`
- `ENDGOAL_PARTIAL_WITH_DEFERRED_ITEMS`
- `ENDGOAL_BLOCKED`
- `ENDGOAL_FAILED_VALIDATION`

Only `ENDGOAL_COMPLETE` means the workflow completed all required acceptance criteria.

## Claude And Codex

Archon uses `AGENTS.md` as the canonical shared instruction file and `CLAUDE.md` as the Claude compatibility layer.

Codex-native assets:

- `AGENTS.md`
- `.agents/skills/<skill>/SKILL.md`
- `.codex/agents/*.toml`
- proposed `.codex/hooks.json` or `.codex/config.toml` changes only when trust and merge safety are clear

Claude-native assets:

- `CLAUDE.md`
- `.claude/skills/<skill>/SKILL.md`
- `.claude/agents/*.md`
- proposed `.claude/settings.json` or MCP changes only when merge safety is clear

The workflow remains provider-neutral. Existing providers such as `pi` are not removed or reinterpreted.

## TypeScript Navigation

Helpline uses Python `pyright` and `pyright-langserver` for LSP-backed navigation. Archon is TypeScript-oriented, so the bootstrap adapts the concept rather than copying the setup.

Archon's navigation rule is:

> Prefer symbol/type navigation for definitions and references. Use grep for broad discovery or text search, not as the primary way to locate TypeScript definitions/references.

Validate the TypeScript navigation check with:

```bash
bun run validate:ts-navigation
```

This uses TypeScript's language service against real Archon workflow files. It does not add pyright.

## Hooks And MCP

Hooks and MCP config are high-trust surfaces. The Phase 1 bootstrap does not live-edit:

- `.claude/settings.json`
- `.codex/hooks.json`
- `.codex/config.toml`
- `.mcp.json`

Hook and MCP ideas should be proposed under `$ARTIFACTS_DIR/ai-layer/proposed/` until deterministic behavior and safe config merge are validated.

## Validation

Useful checks:

```bash
bun run cli validate workflows archon-ai-layer-bootstrap
bun run cli validate commands
bun run validate:ts-navigation
bun run check:bundled
bun run check:bundled-skill
bun run aco:traceability
bun run aco:test:acceptance
```

Run `bun run validate` before a PR when the scoped checks pass.
