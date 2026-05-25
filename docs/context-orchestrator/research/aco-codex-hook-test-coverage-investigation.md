# ACO Codex Hook Test Coverage Investigation

Generated: 2026-05-24
Branch: `codex/aco-stabilization-slices`
Commit inspected: `eac0bc3d`

## Short Answer

The hook tests are not enough for the full claim yet.

They are enough to prove a baseline: the current Archon/ACO surfaces validate, all ten ACO lifecycle events can be simulated through the ACO runner, cleanup has useful fixture coverage, and the opt-in real Codex smoke passes on installed `codex-cli 0.128.0`.

They are missing important coverage before we can say the hook system is complete and robust:

- `PermissionRequest` is supported by Codex 0.128.0 and templated by ACO, but the real-Codex smoke does not require or observe it.
- Runner output is not validated against Codex 0.128 generated command-hook schemas.
- Guardrail negative paths are mostly implementation-present but test-missing, especially `PreToolUse` deny reasons for graph refresh, destructive commands, auth/OAuth/credential access, and secrets.
- `PermissionRequest` approval-capsule behavior is a no-op in the runner; no allow/deny decision path is tested.
- Simulated-only events have only shallow "output exists" coverage, not event-specific contract assertions.
- Real cleanup checks the apply result but not residual files or same-run second cleanup before deleting the temp root.
- The real harness uses `--ignore-user-config` and session-only inline hooks, but it does not prove project `.codex/hooks.json` execution or a fully isolated temporary `HOME`/`CODEX_HOME`.

## Sources Checked

- Installed Codex CLI:
  - `codex --version`: `codex-cli 0.128.0`
  - `codex features list`: `codex_hooks` stable/enabled; `plugin_hooks` under development/disabled
  - `codex exec --help`: exposes `--config`, `--enable`, `--ignore-user-config`, `--sandbox`, `--json`, `--ephemeral`; no hook-trust bypass flag
- Context7:
  - `npx ctx7@latest library "Codex CLI" ...` selected `/openai/codex`
  - `npx ctx7@latest docs /openai/codex ...` showed current-main hook event names, including future ten-event shape
- Official upstream tag:
  - `git ls-remote --tags https://github.com/openai/codex.git` confirmed `rust-v0.128.0`
  - `codex-rs/protocol/src/protocol.rs` at `rust-v0.128.0` defines only six hook event names: `PreToolUse`, `PermissionRequest`, `PostToolUse`, `SessionStart`, `UserPromptSubmit`, `Stop`
  - `codex-rs/hooks/src/events` at `rust-v0.128.0` contains only six event implementation files
  - `codex-rs/hooks/src/schema.rs` at `rust-v0.128.0` contains generated schemas for those six command-hook inputs/outputs
- Archon repository files:
  - `docs/context-orchestrator/specs/025-aco-codex-real-bootstrap-cleanup-hooks.md`
  - `tests/acceptance/context-orchestrator/bootstrap-real-codex.acceptance.test.ts`
  - `tests/acceptance/context-orchestrator/bootstrap-cleanup.acceptance.test.ts`
  - `packages/context-orchestrator/src/aco-codex-hook-runner.ts`
  - `packages/context-orchestrator/src/aco-codex-hook-templates.ts`
  - `packages/context-orchestrator/src/real-codex-harness.ts`
  - `packages/context-orchestrator/src/cleanup-codex.ts`
  - `packages/cli/src/cli.ts`
  - `packages/core/src/handlers/command-handler.ts`

Primary upstream links used:

- <https://github.com/openai/codex/blob/rust-v0.128.0/codex-rs/protocol/src/protocol.rs>
- <https://github.com/openai/codex/blob/rust-v0.128.0/codex-rs/config/src/hook_config.rs>
- <https://github.com/openai/codex/blob/rust-v0.128.0/codex-rs/hooks/src/schema.rs>
- <https://github.com/openai/codex/tree/rust-v0.128.0/codex-rs/hooks/src/events>

## Validation Run

| Command | Result | What It Proves |
| --- | --- | --- |
| `bun test ./tests/acceptance/context-orchestrator/bootstrap-real-codex.acceptance.test.ts ./tests/acceptance/context-orchestrator/bootstrap-cleanup.acceptance.test.ts` | Passed, 6 tests | Fixture acceptance remains green. Real smoke is blocked unless `RUN_REAL_CODEX=1`; all ten events simulate; cleanup fixture coverage passes. |
| `RUN_REAL_CODEX=1 bun scripts/context-orchestrator/aco-real-codex-hook-smoke.ts` | Passed | Installed Codex 0.128.0, authenticated via ChatGPT, observed `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`; two setup/smoke/cleanup runs passed. |
| `bun run cli validate commands --json` | Passed, 62/62 | Archon command catalog includes valid `aco-bootstrap-codex` and `aco-cleanup-codex`. |
| `bun run cli validate workflows --json` | Passed, 41/41 with one existing optional MCP warning | Workflow catalog remains valid. Warning is missing optional `.archon/mcp/ntfy.json`, unrelated to hooks. |
| `bun run aco:traceability` | Passed | Traceability matrix currently accepts the hook/cleanup slice. |
| `bun run cli context validate --json` | Passed | ACO specs, package scripts, acceptance reality check, policy, and traceability pass. |
| `bun run cli aco status --json` | Validation passed; readiness blocked | Blocked only because this investigation created an untracked docs artifact, so git-status evidence is dirty. Graph available, 0 graph waivers. |
| Direct `runAcoCodexHook` probe for destructive graph command | Produced `permissionDecision: deny` | Runner has a denial branch, but existing acceptance tests do not assert it. |

No graph refresh was run. No user Codex config, auth, MCP OAuth, provider credentials, graph evidence, or graph waivers were intentionally mutated.

## Current Test Inventory

| Area | Existing Coverage | Assessment |
| --- | --- | --- |
| Real Codex preflight | `bootstrap-real-codex.acceptance.test.ts` checks binary path, version, exec help, login status are not unknown; opt-in run requires pass. | Good baseline. |
| Real Codex smoke events | `runRealCodexHookSmoke` requires five observed events: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`. | Partial; misses supported `PermissionRequest`. |
| Ten-event simulation | One test loops all `acoBootstrapEvents`, calls `runAcoCodexHook`, checks event identity, output exists, redaction regex, and simulated vs command-hook support. | Useful but shallow. |
| Hook templates | Test checks active manifest includes six supported events and inert templates length is 10. | Good structure coverage. |
| Capability domains | Test asserts 18 domain IDs and evidence presence. | Good category coverage; role/subagent assertions could be stronger. |
| Cleanup manifest/artifacts | Fixture tests cover manifest emission, dry-run default, apply, second apply no-op, protected paths, graph evidence, unmanaged `.codex/config.toml`, symlink escape. | Strong fixture coverage. |
| Real cleanup | Real harness applies cleanup for two temp runs and records cleanup result. | Partial; no residual-file assertion before deleting temp root; no same-run second cleanup. |
| CLI/slash surfaces | Bootstrap command tests plus command validation cover `/aco:bootstrap-codex`, `/aco:cleanup-codex`, CLI aliases, and bundled docs. | Good surface coverage. |
| Codex schema conformance | No local test validates ACO runner output against Codex generated schemas. | Missing. |
| Negative hook outputs | No tests for malformed stdin, unknown event policy, invalid output fields, prompt/agent handler skip, unsupported future events in real config. | Missing. |

## Event Coverage Matrix

| Event | Codex 0.128 Status | Current Evidence | Verdict | Missing Tests |
| --- | --- | --- | --- | --- |
| `SessionStart` | Supported command hook | Spec, template, runner simulation, real smoke observed, bootstrap command coverage. | Enough for smoke; partial for schema. | Validate output against `session-start.command.output` schema; assert startup/resume/clear matcher template. |
| `UserPromptSubmit` | Supported command hook | Spec, template, runner simulation, real smoke observed. | Partial. | Add prompt-routing assertions, secret-paste block/feedback path, schema validation. |
| `PreToolUse` | Supported command hook | Spec, template, runner simulation, real smoke observed, direct probe showed deny branch works. | Partial. | Add acceptance/unit tests for graph refresh, destructive command, auth/OAuth/credential path, and secret denial; assert deny reason and schema validity. |
| `PermissionRequest` | Supported command hook | Spec, template, runner simulation only; active manifest includes it. | Missing real proof. | Add real or blocked `PermissionRequest` smoke; implement/test allow/deny decision output shape; assert deny wins and reserved fields fail closed when represented. |
| `PostToolUse` | Supported command hook | Spec, template, runner simulation, real smoke observed. | Partial. | Assert tool response/evidence capture, redaction of tool output, optional block feedback, schema validity. |
| `PreCompact` | Not present in Codex 0.128 tag; current-main docs may expose future type | ACO simulation only; inert template marked simulated. | Correctly deferred, but shallow. | Assert durable precompact summary content, decisions, changed files, validation state, next actions; ensure real harness never activates it on 0.128. |
| `PostCompact` | Not present in Codex 0.128 tag; current-main docs may expose future type | ACO simulation only; inert template marked simulated. | Correctly deferred, but shallow. | Assert reload instructions for latest handoff/snapshot/capsule/ledger refs. |
| `SubagentStart` | Not present in Codex 0.128 tag; current-main docs may expose future type | ACO simulation only; inert template marked simulated. | Correctly deferred, but shallow. | Assert role contract, allowed evidence sources, role expectations, and artifact destination. |
| `SubagentStop` | Not present in Codex 0.128 tag; current-main docs may expose future type | ACO simulation only; inert template marked simulated. | Correctly deferred, but shallow. | Assert role artifact collection, evidence claim capture, unknowns, evaluator notes. |
| `Stop` | Supported command hook | Spec, template, runner simulation, real smoke observed, separate bootstrap command continuation tests. | Partial. | Runner currently uses `goalStatus: complete`; add Stop hook-runner continuation/block test for incomplete goals and schema validity. |

## Acceptance ID Mapping

| ID | Current State | Verdict | Follow-Up |
| --- | --- | --- | --- |
| `ACO-CODEX-REAL-001` | Real harness discovers `codex`, version, exec help, login status; opt-in run passed. | Enough. | Add version-sensitive source-tag assertion if the release contract remains pinned. |
| `ACO-CODEX-REAL-002` | Uses `--ignore-user-config`, session `-c hooks.*`, temp repo; does not mutate active config through test paths. | Partial. | Add explicit before/after checks for active `$CODEX_HOME/config.toml`, auth files, MCP OAuth paths; decide whether temp `HOME`/`CODEX_HOME` is required or document auth-only exception. |
| `ACO-CODEX-REAL-003` | Bootstrap emits cleanup manifest and artifacts in temp fixture. | Enough for function path. | Add CLI/slash invocation variant if strict acceptance requires command surface here, not just direct function call. |
| `ACO-CODEX-REAL-004` | Cleanup dry-run/apply/second-apply/protected-path/symlink fixture tests pass. | Enough in fixture. | Mirror residual/no-op checks in real harness. |
| `ACO-CODEX-REAL-005` | Real smoke proves five supported events. | Partial. | Add `PermissionRequest` real smoke or blocked evidence if Codex cannot induce approval path noninteractively. |
| `ACO-CODEX-REAL-006` | All ten events simulate and templates exist. | Partial. | Add Codex schema validation for six supported events and content assertions for four simulated events. |
| `ACO-CODEX-REAL-007` | Required capability domains are present and evidence-backed/explicit. | Mostly enough. | Add a regression test that fails on omitted future categories from the spec list. |
| `ACO-CODEX-REAL-008` | MCP/Context7/BMAD strings are asserted; subagents/roles included via domain coverage. | Partial. | Add explicit role-contract/subagent assertions, not only domain presence. |
| `ACO-CODEX-REAL-009` | Real harness runs two fresh setup/smoke/cleanup cycles. | Partial. | Check duplicate ledgers, stale manifests, residual ACO paths, and same-run second cleanup before temp root deletion. |
| `ACO-CODEX-REAL-010` | Cleanup fixture refuses protected paths; real output redacts common secret patterns; mutation report is false. | Partial. | Add real before/after hashing or stat checks for active config/auth/MCP OAuth/provider/graph paths. |

## Missing Implementation-Ready Tests

### P0: Required Before Claiming Hook Coverage Complete

1. Add a `PermissionRequest` real-Codex harness path.
   - Target: `packages/context-orchestrator/src/real-codex-harness.ts`
   - Test: `tests/acceptance/context-orchestrator/bootstrap-real-codex.acceptance.test.ts`
   - Shape: run a temp Codex exec path that triggers an approval-sensitive operation in a controlled sandbox/approval mode, or return explicit blocked evidence that noninteractive Codex 0.128 cannot induce `PermissionRequest`.
   - Assertion: `eventsObserved` includes `PermissionRequest`, or `blockers` includes a release/CLI limitation specific to `PermissionRequest`.

2. Add Codex 0.128 schema fixture validation for runner outputs.
   - Target: new pure test near `aco-codex-hook-runner`.
   - Fixtures: checked-in JSON schemas copied from official `rust-v0.128.0` generated files, or minimal local validators derived from those schemas with source refs.
   - Assert: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, and `Stop` outputs parse as valid 0.128 command-hook JSON; simulated four events are not passed to real 0.128 schemas.

3. Add negative `PreToolUse` guard tests.
   - Inputs: `graphify`, `research:graph`, `refresh-graph`, `rm -rf`, `git reset --hard`, `auth.json`, `oauth`, `credential`, `OPENAI_API_KEY`, `sk-...`.
   - Assert: `permissionDecision: deny`, non-empty reason, redacted logs, no graph/auth/config mutation.

4. Add real cleanup residual checks.
   - Before `rm(root)`, inspect the temp repo after cleanup.
   - Assert all manifest ACO-owned paths are missing, protected/unmanaged paths remain where expected, and second apply returns `idempotentNoopWhenRepeated: true`.

### P1: Strongly Recommended

5. Add `PermissionRequest` decision tests.
   - Implement runner policy output for approval capsule deny/allow/no-decision cases.
   - Assert Codex-compatible shape: `hookSpecificOutput.decision.behavior` with optional `message`.

6. Add malformed and unknown-event tests.
   - Current `parseHookEvent` defaults unknown values to `SessionStart`.
   - Decide contract: strict blocked error is safer for hook runner; if fallback stays, test and document it explicitly.

7. Add event-specific assertions for simulated lifecycle events.
   - `PreCompact`: decisions, changed files, validation, next actions.
   - `PostCompact`: latest handoff/snapshot reload.
   - `SubagentStart`: role contract and evidence constraints.
   - `SubagentStop`: role artifact and unknown collection.

8. Add `PostToolUse` evidence/redaction tests.
   - Include tool response with stdout/stderr-like payload and embedded secret.
   - Assert evidence context is present and secret is redacted.

9. Add Stop runner continuation tests.
   - The bootstrap command covers incomplete Stop continuation, but `runAcoCodexHook` always builds Stop with `goalStatus: complete`.
   - Add runner option or fixture path for incomplete Stop and assert continuation output.

### P2: Release Drift And Hardening

10. Add release-drift test for Codex hook event names.
    - Compare installed `codex --version` plus source-tag evidence or vendored fixture.
    - If a future release exposes `PreCompact`, `PostCompact`, `SubagentStart`, or `SubagentStop`, fail with an actionable message to promote them from simulated to real smoke.

11. Add prompt/agent handler skip tests.
    - The 0.128 config type parses `prompt` and `agent`, while runnable support is command-only.
    - Add parser/template tests or documented blocked evidence that ACO emits only command hooks.

12. Add project `.codex/hooks.json` trust behavior test.
    - Current harness writes `.codex/hooks.json` but relies on inline `-c hooks.*`.
    - Add a narrow opt-in probe to prove project hooks execute when trusted, or record current-release blocked evidence and keep inline config as the tested path.

## Suggested Next Test Files

- `packages/context-orchestrator/src/aco-codex-hook-runner.test.ts`
  - Pure tests for schema output, negative guard decisions, unknown/malformed event behavior, redaction, and simulated event content.
- `tests/acceptance/context-orchestrator/bootstrap-real-codex.acceptance.test.ts`
  - Add `PermissionRequest` real/blocked evidence and stronger cleanup residual assertions.
- `tests/acceptance/context-orchestrator/bootstrap-cleanup.acceptance.test.ts`
  - Add stale run manifest, duplicate manifest entry, non-ACO owned same path, and same-run ledger duplication coverage if not handled by the pure cleanup tests.

## Risk Assessment

The main risk is overclaiming. The suite currently proves that the hook system can be discovered, templated, simulated, and smoke-tested against real Codex for five events. It does not prove every supported Codex 0.128 hook event in real execution, and it does not prove runner outputs against Codex's generated schemas.

The second risk is release drift. Context7 current-main documentation already shows a broader ten-event hook enum than the installed/tagged 0.128 source. Tests need a release-sensitive boundary so future Codex releases do not leave `PreCompact`, `PostCompact`, `SubagentStart`, and `SubagentStop` stuck in simulated-only coverage after upstream support appears.

The third risk is cleanup confidence in the real harness. Fixture cleanup is strong, but the opt-in real harness deletes the temp root after cleanup without first proving no ACO-owned files remain and without same-run idempotent reapply.

## Reuse Summary

Use this as the implementation prompt:

Add P0 tests first. Start with a pure `aco-codex-hook-runner.test.ts` for schema and guard paths, then extend the real harness for `PermissionRequest` and cleanup residual checks. Keep release-unsupported events simulated on Codex 0.128, but add a drift check so the test suite asks for real coverage when installed Codex exposes them.
