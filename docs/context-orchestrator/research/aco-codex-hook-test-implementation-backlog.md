# ACO Codex Hook Test Implementation Backlog

This backlog is extracted from `aco-codex-hook-test-coverage-investigation.md` for direct implementation use.

## P0

1. Prove or explicitly block real `PermissionRequest`.
   - Files: `packages/context-orchestrator/src/real-codex-harness.ts`, `tests/acceptance/context-orchestrator/bootstrap-real-codex.acceptance.test.ts`
   - Add a harness path that induces `PermissionRequest` in a temp repo, or emits a blocker saying Codex 0.128 cannot induce it noninteractively.
   - Acceptance: `RUN_REAL_CODEX=1` result includes `PermissionRequest` or a `PermissionRequest`-specific blocker.

2. Validate runner outputs against Codex 0.128 schemas.
   - File: new `packages/context-orchestrator/src/aco-codex-hook-runner.test.ts`
   - Cover supported events: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `Stop`
   - Assert simulated events are not emitted into active 0.128 hook config.

3. Cover negative `PreToolUse` guard paths.
   - File: new `packages/context-orchestrator/src/aco-codex-hook-runner.test.ts`
   - Inputs: graph refresh, destructive shell, auth/OAuth/credential paths, secret-like values.
   - Assert: deny decision, non-empty reason, redaction.

4. Strengthen real cleanup proof.
   - File: `packages/context-orchestrator/src/real-codex-harness.ts`
   - Before deleting the temp root, verify manifest ACO-owned files are gone and run same-run cleanup a second time.
   - Acceptance: cleanup evidence contains residual check pass and `idempotentNoopWhenRepeated: true` for the second apply.

## P1

5. Implement/test `PermissionRequest` decision output.
   - Add runner cases for no-decision, allow, and deny.
   - Use Codex-compatible shape: `hookSpecificOutput.decision.behavior`.

6. Decide and test unknown event behavior.
   - Current behavior falls back to `SessionStart`.
   - Preferred: strict blocked/error for unknown event in hook runner; if fallback remains, document and test it.

7. Add content assertions for simulated lifecycle events.
   - `PreCompact`: durable summary.
   - `PostCompact`: reload latest handoff/snapshot.
   - `SubagentStart`: role contract.
   - `SubagentStop`: role artifact collection.

8. Add `PostToolUse` evidence/redaction tests.
   - Include secret-bearing tool response.
   - Assert evidence context is preserved and secrets are redacted.

9. Add Stop runner continuation coverage.
   - Allow an incomplete-goal Stop fixture through `runAcoCodexHook`.
   - Assert continuation/next-goal output.

## P2

10. Add Codex hook release-drift detection.
    - If installed/source hook events include `PreCompact`, `PostCompact`, `SubagentStart`, or `SubagentStop`, fail with instructions to promote them from simulated to real smoke.

11. Add prompt/agent handler skip coverage.
    - Codex 0.128 parses `prompt` and `agent` handler kinds but only command hooks are runnable for ACO.
    - Assert ACO templates stay command-only.

12. Add project `.codex/hooks.json` trust probe.
    - Current real harness writes project hooks but uses inline `-c hooks.*`.
    - Prove project hooks execute in a trusted temp repo, or record blocked evidence and keep inline hooks as the tested path.

## Suggested Validation After Implementation

```bash
bun test ./packages/context-orchestrator/src/aco-codex-hook-runner.test.ts
bun test ./tests/acceptance/context-orchestrator/bootstrap-real-codex.acceptance.test.ts ./tests/acceptance/context-orchestrator/bootstrap-cleanup.acceptance.test.ts
RUN_REAL_CODEX=1 bun scripts/context-orchestrator/aco-real-codex-hook-smoke.ts
bun run cli validate commands --json
bun run cli context validate --json
bun run aco:traceability
```
