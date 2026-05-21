# 030 AI Layer Bootstrap Spec

## Purpose

Archon provides an artifact-first AI Layer Bootstrap workflow that can analyze a target repository and generate or update maintainable agent-facing project context without weakening the stabilization branch's SDD/ATDD discipline.

The workflow adapts Helpline's large-codebase AI-layer concepts in an Archon-native way: bundled workflows, bundled commands, durable artifacts, JSON gates, lean shared instructions, Claude/Codex compatibility, scoped validation skills, TypeScript-native navigation validation, and honest proposal/defer behavior for hooks and MCP.

## Scope

- Add a bundled `archon-ai-layer-bootstrap` workflow.
- Add supporting `ai-layer-*` bundled commands.
- Dogfood Archon's own AI layer with lean root instructions, a codebase map, scoped tests skills, read-only explorer agents, package-local instruction files, and TypeScript symbol-navigation validation.
- Require artifact handoff under `$ARTIFACTS_DIR/ai-layer`.
- Preserve branch-specific SDD/ATDD behavior by adding acceptance coverage before implementation.
- Keep hooks and MCP as proposed/deferred unless deterministic validation proves live enablement.

## Non-Goals

- Do not implement on `dev` or `main`.
- Do not refresh graph evidence or clear graph waivers.
- Do not copy Helpline's Python `pyright` setup into Archon.
- Do not make hooks, MCP servers, provider credentials, telemetry, or project-local Codex provider config mandatory.
- Do not remove existing workflows, commands, provider support, hooks, agents, skills, settings, specs, or acceptance tests.
- Do not create or commit runtime workflow artifacts under `.archon/artifacts`.

## Generic Behavior

- The workflow starts with a branch gate and a goal/endgoal contract.
- Every downstream command reads `goal.md`, `goal.json`, `branch-gate.json`, `artifact-registry.json`, and `status.json` when present.
- Every command writes an assigned artifact and records `COMPLETE`, `PARTIAL`, `BLOCKED`, `SKIPPED`, or `FAILED`.
- JSON gates record branch, routing, write, retry, completion, endgoal, and stop decisions.
- Downstream work relies on artifacts, not prior conversational state.
- Risky config edits are proposed under `$ARTIFACTS_DIR/ai-layer/proposed/`.

## Archon-Specific Behavior

- Bundled workflow and commands live in `.archon/workflows/defaults/` and `.archon/commands/defaults/`.
- Generated bundled defaults are refreshed with `bun run generate:bundled`.
- The workflow remains provider-neutral and does not require Claude-only node fields.
- Claude-specific project context lives in `CLAUDE.md`, `.claude/skills`, and `.claude/agents`.
- Codex-specific project context lives in `AGENTS.md`, `.agents/skills`, and `.codex/agents`.
- `CODEBASE_MAP.md` holds architecture navigation so root instruction files stay lean.
- TypeScript navigation validation uses TypeScript's language service, not pyright.

## Inputs

- User request in `$ARGUMENTS`.
- Current workflow cwd.
- `$ARTIFACTS_DIR`.
- Archon source repository path.
- Required branch name.
- Helpline reference repository path.
- Existing Archon workflow, command, provider, docs, test, and validation conventions.

## Outputs

- `$ARTIFACTS_DIR/ai-layer/goal.md`
- `$ARTIFACTS_DIR/ai-layer/goal.json`
- `$ARTIFACTS_DIR/ai-layer/artifact-registry.json`
- `$ARTIFACTS_DIR/ai-layer/status.json`
- `$ARTIFACTS_DIR/ai-layer/*.json` gates
- `$ARTIFACTS_DIR/ai-layer/*.md` inspection, plan, validation, review, and completion artifacts
- Bundled workflow and command files
- Lean project instruction files and codebase map
- Scoped test skills and read-only explorer agents
- TypeScript navigation validation script
- Documentation page

## Known Unknowns

- Full TypeScript MCP codebase-search implementation is deferred until symbol-level tests are added.
- Live hook enablement is deferred until config trust and merge safety are explicitly proven.
- Future bootstrap runs may add safer structural merge helpers for config files.

## Evidence References

- `.archon/workflows/defaults/archon-ai-layer-bootstrap.yaml`
- `.archon/commands/defaults/ai-layer-goal.md`
- `.archon/commands/defaults/ai-layer-endgoal-gate.md`
- `.archon/commands/defaults/ai-layer-stop-gate.md`
- `AGENTS.md`
- `CLAUDE.md`
- `CODEBASE_MAP.md`
- `.agents/skills/scoped-tests/SKILL.md`
- `.claude/skills/scoped-tests/SKILL.md`
- `scripts/validate-ts-navigation.ts`
- `tests/acceptance/context-orchestrator/ai-layer-bootstrap.acceptance.test.ts`
- `packages/docs-web/src/content/docs/guides/ai-layer-bootstrap.md`

## Acceptance Scenarios

- AI-LAYER-001: Given the stabilization branch, when the AI Layer Bootstrap workflow is inspected, then it begins with branch and goal gates, writes artifact contracts, and ends with completion-audit, endgoal-gate, and stop-gate nodes.
- AI-LAYER-002: Given the bundled command set, when each `ai-layer-*` command is inspected, then each command has a Goal Check, reads required artifacts, writes an assigned artifact, and records a status and handoff.
- AI-LAYER-003: Given Archon's dogfooded AI layer, when root and package instruction files are inspected, then root instructions are lean, local files are scoped to real directories, and the symbol/type navigation rule is present.
- AI-LAYER-004: Given Claude and Codex compatibility requirements, when skills and explorer agents are inspected, then scoped-tests exists for both providers and explorer agents are read-only by instruction and location.
- AI-LAYER-005: Given Helpline's Python LSP reference, when Archon's navigation support is inspected, then pyright is not copied and TypeScript language-service validation exists.
- AI-LAYER-006: Given hooks and MCP are risky config surfaces, when implementation artifacts are inspected, then live hook/MCP config is not modified and templates/proposals or deferred reasons are recorded.
- AI-LAYER-007: Given a run reaches validation, completion, and stop gates, when gate artifacts are inspected, then terminal state is one of the allowed endgoal states and `stop-gate.json` states whether stopping is allowed.

## Failure Behavior

- Wrong branch produces a blocking branch gate and no product writes.
- Missing required artifacts block dependent nodes.
- Invalid workflow or command definitions fail validation.
- Validation failure produces `ENDGOAL_FAILED_VALIDATION` unless fixed.
- Missing Helpline LSP inspection blocks completion.
- Unsafe live config merge is rejected or converted to a proposed artifact.

## Security Constraints

- Do not add secrets or provider credentials.
- Do not broaden permissions silently.
- Do not run graph refresh commands as part of this implementation.
- Do not commit runtime artifacts.
- Do not add local absolute paths to generated reusable config, except documented local repository paths in runtime artifacts.
- Do not add pyright to Archon without an explicit Python LSP requirement.

## Open Questions

- Should a later slice add a TypeScript MCP codebase-search server as an Archon CLI subcommand?
- Should config merge helpers become first-class utilities for hooks and MCP templates?
- Should the bootstrap workflow gain a bounded retry loop after command-level gate artifacts prove reliable?
