# 012 CLI Contract

## Purpose

Define CLI contract candidates.

## Scope

`archon context` commands, flags, JSON output, ledger output, and validation behavior.

## Non-Goals

- Do not implement CLI before ADR 0009 selects MVP surface.

## Generic Behavior

- CLI exposes route, compile, ledgers, graph, docs, bmad, accept, validate, and status operations.
- `archon context ledgers --cwd .` builds a read-only `LedgerBundle` without archive writes or unsafe command execution.
- `archon context ledgers --cwd . --json` emits the combined `LedgerBundle` shape used by compiled prompt-package evidence.

## Archon-Specific Behavior

- Archon CLI command should live under `packages/cli/src/commands` if selected.

## Inputs

- --cwd
- prompt
- --json
- --graph
- --docs
- --context7
- --openai-docs
- --caveman

## Outputs

- human summary
- JSON response
- archive path
- ledger summary
- ledger bundle JSON
- exit code

## Known Unknowns

- whether CLI or workflow is first MVP

## Evidence References

- packages/cli/src/commands/validate.ts
- packages/cli/src/cli.ts

## Acceptance Scenarios

- Given `archon context compile --cwd . --json "prompt"`, when CLI surface is selected, then output is valid JSON and includes prompt package paths.
- AC-LEDGER-005: Given `archon context ledgers --cwd . --json`, when it succeeds, then stdout is a combined `LedgerBundle` with the same contract used by compiled prompt-package evidence.
- AC-LEDGER-007: Given route/status/compile/validate commands exist, when ledger support is added, then those existing commands keep their current behavior.

## Failure Behavior

- Exit nonzero for blockers; include machine-readable error in JSON mode.
- `context ledgers` exits `0` when a bundle builds, even when rows contain `unknown`, `partial`, or `blocked`; it exits `1` only for schema or internal invariant failures.

## Security Constraints

- Do not print secrets in stdout/stderr.

## Open Questions

- Should CLI command be available in binary builds for MVP?
