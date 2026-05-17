# ACO Technical Research

Date: 2026-05-17
BMAD action: `bmad-technical-research`

## Findings

1. A new isolated package keeps generic ACO core independent from CLI, core, server, and workflow-specific dependencies.
2. CLI first is the lowest-risk Archon-native MVP surface because it can read local evidence and write artifacts without introducing DB or API migration pressure.
3. Artifact storage can use deterministic local paths for CLI and `$ARTIFACTS_DIR/context-orchestrator/<run-id>/` for future workflow execution.
4. Graphify must remain optional by mode. Existing research graph scripts already support fixture/no-op behavior when Graphify is unavailable.
5. Docs resolvers should compile plans, not fetch every doc during MVP execution. OpenAI Docs MCP and Context7 readiness evidence is enough for route planning.
6. Caveman policy is a renderer policy only. It must not modify structured artifacts.

## Candidate Implementation Host

Preferred: `packages/context-orchestrator`

Reasons:

- Generic core remains reusable from CLI, workflows, slash commands, and API.
- Package boundary makes DDD objects explicit.
- Avoids adding more responsibility to `@archon/core` or `@archon/workflows`.
- CLI can depend on the package without creating reverse dependencies.

## Candidate MVP Surface

Preferred: CLI only.

Commands:

- `archon context compile --cwd <repo> [--json] [--archive-only] [--print-prompt] "<prompt>"`
- `archon context validate --cwd <repo> [--json]`
- `archon context status --cwd <repo> [--json]`

## Technical Risks

- Adding a package requires workspace package metadata, build, type-check, and exports.
- CLI argument parser must accept context flags without breaking existing commands.
- Archive writer must block traversal and avoid reading target `.env`.
- Full workflow validation remains blocked by optional ntfy until separately addressed or waived.
