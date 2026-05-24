# ACO Bootstrap Slice Handoff

Generated: 2026-05-24

## Scope

Implemented the always-on ACO bootstrap slice:

- `CapabilitySnapshot` with read-only adapters for Archon commands/workflows/ledgers, BMAD, graph evidence, docs targets, MCP/provider sources, Codex lifecycle structure, and generic capability manifests.
- `buildAcoBootstrapContext({ cwd, prompt, event, maxBytes })` with lifecycle-specific compact context for `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PreCompact`, `PostCompact`, `SubagentStart`, `SubagentStop`, and `Stop`.
- Compile/status/ledger/telemetry integration for capability snapshot and bootstrap context artifacts.
- Traceability coverage for `ACO-BOOTSTRAP-001` through `ACO-BOOTSTRAP-005`.

## Durable Artifacts

- Spec: `docs/context-orchestrator/specs/023-always-on-aco-bootstrap-and-capability-discovery.md`
- Acceptance: `tests/acceptance/context-orchestrator/bootstrap.acceptance.test.ts`
- Unit fixture coverage: `packages/context-orchestrator/src/capability-snapshot.test.ts`
- Implementation: `packages/context-orchestrator/src/capability-snapshot.ts`
- Compile artifacts produced by future compiles: `capability-snapshot.json`, `aco-bootstrap-context.json`, `aco-bootstrap-context.md`
- Ledger rows: `tool.aco-capability-snapshot`, `cmd.aco-bootstrap-context`

## Validation

Passed:

- `bun test ./tests/acceptance/context-orchestrator/bootstrap.acceptance.test.ts`
- `bun test ./packages/context-orchestrator/src/capability-snapshot.test.ts ./packages/context-orchestrator/src/context-orchestrator.test.ts ./packages/context-orchestrator/src/ledgers.test.ts ./packages/context-orchestrator/src/telemetry.test.ts`
- `bun run aco:traceability`
- `bun run aco:test:acceptance`
- `bun run cli validate workflows --json`
- `bun run cli validate commands --json`
- `bun run cli context validate --cwd . --json`
- `bun run check:bundled`
- `bun run type-check`
- `bun run lint --max-warnings 0`
- `bun run format:check`

## Unknown, Blocked, Deferred

- `codex.active-config`: unknown by design. The adapter does not read active user-level Codex config.
- `mcp.oauth-state`: unknown by design. The adapter does not read MCP OAuth state.
- Hook activation: deferred and approval-gated. This slice emits inert context artifacts only.
- Graph refresh: deferred and approval-gated. Current committed graph evidence and waivers remain unchanged.

## Stop Continuation

Current slice is implemented and validated. Broader always-on runtime activation remains a later slice.

Next optional goal:

`/goal Implement approval-gated ACO runtime hook template/activation slice using existing CapabilitySnapshot and bootstrap artifacts, preserving auth, MCP OAuth, provider credentials, graph waivers, and graph evidence.`
