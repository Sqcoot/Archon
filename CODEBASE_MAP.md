# Archon Codebase Map

## Overview

Archon is a Bun + TypeScript monorepo for remote AI coding workflows. It connects platform adapters, an orchestration core, provider SDK integrations, a workflow engine, CLI, server API, web UI, and documentation.

Use this file for navigation. Use `AGENTS.md` for always-on rules and package-local `AGENTS.md` files for tracked workspace package invariants.

## Top-Level Directories

- `.archon/commands/defaults`: bundled command prompt sources.
- `.archon/workflows/defaults`: bundled workflow YAML sources.
- `.agents/skills`: Codex-compatible repository skills.
- `.claude/agents`: Claude Code subagents.
- `.claude/skills`: Claude Code skills.
- `.codex`: Codex project hooks and custom agents.
- `docs/ai`: AI workflow governance, compliance mapping, BMAD mapping, lifecycle/security policy, source traceability, and validation evidence.
- `docs/context-orchestrator`: SDD/ATDD specs, ADRs, research evidence, and traceability.
- `migrations`: database migrations.
- `packages`: TypeScript workspace packages.
- `scripts`: repository validation, generation, research, policy, and release scripts.
- `tests/acceptance`: branch-level acceptance tests.

## Package Map

- `packages/cli`: CLI entry point and commands, including workflow and context-orchestrator surfaces.
- `packages/providers`: AI provider integrations for `claude`, `codex`, and community `pi`.
- `packages/core`: shared business logic, config, DB access, orchestrator, command handling, services, and workflow store bridge.
- `packages/workflows`: workflow engine, schemas, discovery, executor, validator, event emitter, defaults, and script discovery.
- `packages/git`: typed git operations and exec wrappers.
- `packages/isolation`: worktree isolation providers, resolver, store interfaces, and copy helpers.
- `packages/paths`: Archon path resolution and logger utilities.
- `packages/adapters`: chat and forge adapters for Slack, Telegram, GitHub, and community integrations.
- `packages/server`: Hono HTTP server, API routes, OpenAPI generation, and web adapter.
- `packages/web`: React/Vite UI.
- `packages/docs-web`: documentation site.
- `packages/context-orchestrator`: ACO route, compile, validation, policy, ledger, dossier, approval, and target-boundary logic.

## Workflow Engine

- Schemas: `packages/workflows/src/schemas/`.
- Loader/parser: `packages/workflows/src/loader.ts`.
- Executor: `packages/workflows/src/executor.ts` and `packages/workflows/src/dag-executor.ts`.
- Discovery: `packages/workflows/src/workflow-discovery.ts`.
- Validation: `packages/workflows/src/validator.ts`.
- Bundled defaults source: `.archon/workflows/defaults` and `.archon/commands/defaults`.
- Generated defaults: `packages/workflows/src/defaults/bundled-defaults.generated.ts`.

When adding a workflow, inspect schema support first, add the YAML source, add commands as needed, regenerate bundled defaults, then validate workflow and command references.

## Provider Architecture

- Provider registry: `packages/providers/src/registry.ts`.
- Provider contract: `packages/providers/src/types.ts`.
- Claude provider: `packages/providers/src/claude/`.
- Codex provider: `packages/providers/src/codex/`.
- Community Pi provider: `packages/providers/src/community/pi/`.
- MCP config loading: `packages/providers/src/mcp/`.

Preserve provider identity semantics. Provider is resolved from node provider, workflow provider, or assistant default. Model strings are forwarded to provider SDKs.

## SDD/ATDD Stabilization Files

- ADR: `docs/context-orchestrator/adr/0007-atdd-sdd-gates.md`.
- Specs: `docs/context-orchestrator/specs/*.md`.
- Traceability matrix: `docs/context-orchestrator/specs/spec-traceability-matrix.md`.
- Traceability manifest: `docs/context-orchestrator/specs/traceability/aco-traceability.json`.
- Acceptance tests: `tests/acceptance/context-orchestrator/*.acceptance.test.ts`.
- Traceability script: `scripts/context-orchestrator/validate-traceability.ts`.

For stabilization work, update specs and acceptance tests before production code.

## AI Operating Layer

- `docs/ai/agentic-coding-operating-guide.md`: operating model for context, workflow-as-code, artifacts, gates, loops, review, and validation.
- `docs/ai/workflow-compliance-matrix.md`: maps guide requirements to actual workflows, commands, scripts, skills, agents, MCP status, and gaps.
- `docs/ai/bmad-to-archon-mapping.md`: maps `_bmad` assets and BMAD phases to Archon workflows, commands, artifacts, and gates.
- `docs/ai/stab-002-validation-report.md`: current evidence trail for the STAB-002 operating-layer patch.
- `docs/ai/source-traceability.md`: maps source ideas to repo decisions.
- `docs/ai/workflow-validation.md`: workflow/command/repo validation policy.
- `docs/ai/worktree-and-branch-lifecycle.md`: branch, worktree, resume, abandon, complete, and cleanup policy.
- `docs/ai/security-and-secrets.md`: secrets, MCP, shell safety, and trust-sensitive config policy.

Check these docs before adding workflow, command, BMAD, MCP, Claude, Codex, or AI-layer assets.

## TypeScript Navigation

Prefer symbol/type navigation for definitions and references. Use grep for broad discovery or text search, not as the primary way to locate TypeScript definitions/references.

- Root type-check: `bun run type-check`.
- TypeScript navigation validation: `bun run validate:ts-navigation`.
- Root TypeScript config: `tsconfig.json`.
- Script TypeScript config: `scripts/tsconfig.json`.
- Package-level configs: package-local `tsconfig.json` files.

Archon uses TypeScript tooling for navigation. Do not copy Helpline's Python `pyright` setup into Archon unless Python LSP support becomes a real requirement.

## Common Change Routes

- Add a command: create `.archon/commands/defaults/<name>.md`, regenerate bundled defaults, validate commands.
- Add a workflow: create `.archon/workflows/defaults/<name>.yaml`, validate against schemas, regenerate bundled defaults.
- Add a provider: update provider package, registry, docs, tests, and preserve provider resolution semantics.
- Add a docs page: update `packages/docs-web/src/content/docs`, follow existing frontmatter, run docs checks where relevant.
- Add a skill: add provider-native skill files under `.agents/skills` and/or `.claude/skills`, validate frontmatter.
- Add a hook: prefer proposed templates first; do not overwrite `.codex/hooks.json` or `.claude/settings.json`.
- Add MCP: implement and test server first; then propose config entries for Claude/Codex.
- Change SDD/ATDD behavior: update spec, acceptance test, traceability, then implementation.

## High-Risk Files

- `AGENTS.md`
- `CLAUDE.md`
- `CODEBASE_MAP.md`
- `.claude/settings.json`
- `.codex/hooks.json`
- `.codex/config.toml`
- `.mcp.json`
- `.archon/workflows/defaults/*`
- `.archon/commands/defaults/*`
- `packages/workflows/src/defaults/bundled-defaults.generated.ts`
- `docs/context-orchestrator/specs/*`
- `tests/acceptance/context-orchestrator/*`
- root and package `tsconfig*.json`

## AI Layer Bootstrap

The bundled `archon-ai-layer-bootstrap` workflow uses `$ARTIFACTS_DIR/ai-layer` for all durable handoff artifacts. It should reach completion only after validation, LSP/navigation validation, review, completion-audit, endgoal-gate, and stop-gate artifacts exist.
