# ACO Confidence-Closure PR Notes

## Purpose

This PR narrative supports AC-CONFIDENCE-006. It frames the confidence-closure pass as release risk reduction, not broader ACO feature expansion.

## Scope

- Harden deterministic ledger evidence for the committed code-level ledger engine.
- Align `context status`, `context ledgers --json`, and prompt-package compile evidence.
- Name and explain remaining graph waivers instead of treating partial graph status as green readiness.
- Keep command guardrails explicit for commands that write artifacts or tracked files.

## Validation

The confidence-closure PR should report these commands and their results:

- `bun test packages/context-orchestrator/src/ledgers.test.ts packages/context-orchestrator/src/context-orchestrator.test.ts packages/context-orchestrator/src/telemetry.test.ts`
- `bun test packages/cli/src/commands/context.test.ts`
- `bun run cli context ledgers --cwd . --json`
- `bun run cli context status --cwd . --json`
- deterministic compile comparison against two `/tmp` archive roots
- `bun run type-check`
- `bun run lint --max-warnings 0`
- `bun run format:check`
- `bun run validate`

## Remaining Waivers

Any remaining graph waiver must be listed with its stable waiver ID, owner, reason, source evidence, and expiry condition.

## Release Risk

Release remains constrained while graph evidence is partial, validation is skipped or failed, ledger output is nondeterministic, or unknown rows lack explicit evidence.

## Rollback

Rollback is a normal revert of the confidence-closure commit. It must not require a database migration, Web/API rollback, or runtime workflow semantic rollback.
