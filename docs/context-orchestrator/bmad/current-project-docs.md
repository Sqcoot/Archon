# ACO Current Project Documentation

Date: 2026-05-17
BMAD action: `bmad-document-project`

## Archon Surfaces Relevant To ACO

| Surface | Evidence | ACO relevance |
| --- | --- | --- |
| CLI | `packages/cli/src/cli.ts` | Best first MVP surface because it is deterministic, scriptable, and already supports `--cwd`, `--json`, and validation commands. |
| Workflows | `packages/workflows/src` and `.archon/workflows/` | Strong follow-up surface for multi-stage orchestration, artifacts, and events. |
| Slash commands | `packages/core/src/handlers/` | Useful after CLI core stabilizes, but coupled to conversations and codebase resolution. |
| REST API | `packages/server/src/routes/` | Useful after contract stability because routes require OpenAPI schemas and generated web types. |
| Artifacts | `@archon/paths` project/run artifact helpers | Preferred MVP storage before database changes. |
| Validation | `packages/workflows/src/validator.ts` and `packages/cli/src/commands/validate.ts` | ACO should reuse validation patterns and avoid shelling out where a typed API exists. |

## Architecture Observations

- Packages are already split by responsibility.
- `@archon/workflows` intentionally avoids `@archon/core` dependencies and imports provider contract types through `@archon/providers/types`.
- CLI commands are plain functions under `packages/cli/src/commands/`, routed from `cli.ts`.
- OpenAPI route schemas live under `packages/server/src/routes/schemas/` and should be introduced only after the contract is stable.
- `@archon/paths` owns Archon home/workspace/artifact paths and env isolation.

## ACO Integration Implication

The least coupled MVP is a generic package plus CLI command. Workflow, slash command, and API integration can wrap the same core later.

## Baseline Risks

- Full `validate workflows` is blocked by a pre-existing optional ntfy MCP path.
- Global/home Archon state can affect validation and tests unless isolated.
- Bundled defaults are generated; changes to default workflows or commands may require `bun run generate:bundled`.
