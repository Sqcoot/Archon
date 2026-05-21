# ACO BMAD Project Context

Date: 2026-05-17
BMAD phase: analysis
Recommended next route: `bmad-document-project` then `bmad-domain-research`

## Context Summary

Archon is a Bun and TypeScript monorepo for running AI coding assistants from CLI, Web, Slack, Telegram, GitHub, and other adapters. The current architecture already has the main primitives ACO needs:

- CLI command dispatch in `packages/cli/src/cli.ts`.
- Workflow discovery, validation, DAG execution, artifacts, scripts, and events in `packages/workflows`.
- Core orchestration, deterministic slash commands, state, database, and workflow store integration in `packages/core`.
- REST/OpenAPI surfaces in `packages/server`.
- Worktree isolation in `packages/isolation` backed by `packages/git`.
- Path, artifact, env, and home/project directory utilities in `packages/paths`.

## Evidence Set

- Graph evidence: `docs/context-orchestrator/research/graph-evidence-index.md`.
- Merged ecosystem report: `docs/context-orchestrator/research/merged-ecosystem-report.md`.
- OpenAI Docs MCP readiness: `docs/context-orchestrator/research/openai-docs-mcp.md`.
- Context7 readiness: `docs/context-orchestrator/research/context7-mcp.md`.
- Caveman research: `docs/context-orchestrator/research/caveman-principles.md`.
- Baseline validation: `docs/context-orchestrator/baseline.md`.

## Current Constraints

- Production ACO behavior must follow specs and acceptance scenarios.
- No DB migration unless artifacts and workflow events are proven insufficient.
- Target repo `.env` files must not be read or archived.
- OpenAI/Codex behavior must be resolved through official OpenAI documentation first.
- Context7 IDs must be resolved, not hardcoded.
- Graphify failures must be explicit waivers.

## BMAD Help Orientation

Using `bmad-help`, this work is a brownfield core enhancement with architecture and quality-gate risk. The route should not jump directly to implementation. Required planning flow:

1. `bmad-index-docs`
2. `bmad-generate-project-context`
3. `bmad-document-project`
4. `bmad-domain-research`
5. `bmad-technical-research`
6. `bmad-investigate`
7. `bmad-product-brief`
8. `bmad-prd`
9. `bmad-create-architecture`
10. `bmad-review-adversarial-general`
11. `bmad-review-edge-case-hunter`
12. `bmad-create-epics-and-stories`
13. `bmad-check-implementation-readiness`
14. `bmad-sprint-planning`

## Blockers

No blocker prevents planning. All-workflow validation has a baseline optional MCP issue unrelated to ACO.

## BMAD 6.7.1 Sync Note

The installed BMAD catalog contains `core` and `bmm`, not optional CIS. ACO
routes must not require `bmad-cis-problem-solving` unless CIS is installed.
For current BMM forensic review, unfamiliar-code exploration, incident review,
or changelog-delta investigation, use `bmad-investigate` before product/PRD
planning and architecture steps.
