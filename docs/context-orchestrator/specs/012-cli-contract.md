# 012 CLI Contract

## Purpose

Define CLI contract candidates.

## Scope

`archon context` commands, `archon aco status`, flags, JSON output, ledger output, and validation behavior.

## Non-Goals

- Do not implement CLI before ADR 0009 selects MVP surface.

## Generic Behavior

- CLI exposes route, compile, ledgers, graph, docs, bmad, accept, validate, and status operations.
- `archon context ledgers --cwd .` builds a read-only `LedgerBundle` without archive writes or unsafe command execution.
- `archon context ledgers --cwd . --json` emits the combined `LedgerBundle` shape used by compiled prompt-package evidence.
- `archon context status --cwd . --json` includes graph status, graph waiver count, waiver IDs, waiver details, approvalRequired, readiness, validation status, ledger schema version, and ledger summary for confidence comparison with ledger and compile outputs.
- `archon context status --cwd .` is the Context Orchestrator status visibility surface over the same `getContextOrchestratorStatus()` data. It is read-only and must not create archives, repair graph evidence, or hide graph confidence limits.
- Human output shows validation status, readiness, graph status, waiver count and IDs, ledger schema version, and ledger counts in fixed order: total, available, partial, deferred, forbidden, unknown.
- Existing `archon context status` and `archon context ledgers` behavior remains backwards compatible.
- Context Orchestrator workflow and handoff visibility reuses the same status evidence. It must not add a second readiness model, mutate workflow state outside the explicit approval gate, or infer complete graph coverage from waivers.
- Failed waiver-required graph evidence is reported as `forbidden`, not `partial`. Human output must describe readiness as `Needs approval`.

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
- ACO Status summary
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
- AC-CONFIDENCE-004: Given status, ledger, and compile commands run against the same repository state, when JSON output is compared, then graph status, waiver count, waiver IDs, ledger schema version, and ledger summary agree.
- AC-ACO-STATUS-001: Given `archon aco status --cwd <path>` runs, when text output is inspected, then it shows validation, graph, waiver IDs, schema version, and ledger counts.
- AC-ACO-STATUS-002: Given `archon aco status --cwd <path> --json` runs, when JSON is parsed, then it matches the raw `getContextOrchestratorStatus()` contract with no wrapper.
- AC-ACO-STATUS-006: Given `archon aco status` is added, when existing `archon context status` and `archon context ledgers` are run, then their behavior remains unchanged.
- AC-ACO-STATUS-007: Given the current graph has `graph-waiver.bmad-plugins-marketplace` and `graph-waiver.bmad-sample-data`, when status is shown, then those IDs remain visible as forbidden graph confidence limits rather than hidden or repaired.
- AC-FORBIDDEN-GRAPH-001: Given the current graph has failed waiver-required evidence, when CLI status is shown, then graph status is `forbidden`, graph-derived ledger rows are `forbidden`, and readiness says `Needs approval`.
- AC-P1-CLI: Given the ACO Status trust surface is preserved, when CLI status runs, then it reports validation, graph, waiver IDs, ledger schema, and ledger counts from the canonical status contract.
- AC-P1-SLASH: Given a chat, Web, or CLI conversation has a registered project, when `/context status|route|ledgers|compile|run` is used, then deterministic slash commands call the Context Orchestrator package or bundled `context-orchestrate` workflow without reading arbitrary cwd inputs.
- AC-NONREG: Given workflow and handoff visibility is added, when existing context commands run, then context status, context ledgers, cwd handling, and ledger schema behavior do not regress.

## Failure Behavior

- Exit nonzero for blockers; include machine-readable error in JSON mode.
- `context ledgers` exits `0` when a bundle builds, even when rows contain `unknown`, `partial`, or `blocked`; it exits `1` only for schema or internal invariant failures.

## Security Constraints

- Do not print secrets in stdout/stderr.

## Open Questions

- Should CLI command be available in binary builds for MVP?
