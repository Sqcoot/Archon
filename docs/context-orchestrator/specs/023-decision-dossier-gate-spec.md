# 023 Decision Dossier Gate Spec

## Purpose

Define the ACO Decision Dossier Gate: a canonical decision receipt emitted at the route and compile boundary.

## Scope

Decision dossier schema, deterministic Markdown rendering, CLI output, prompt-package archive artifacts, dynamic Codex Goal Handoff, waiver visibility, approval command display, and no-automatic-execution behavior.

## Non-Goals

- Do not add a database table for dossier state.
- Do not expose the dossier through new API, Web UI, or workflow engine surfaces in this slice.
- Do not run graph refresh, tracked-file write, or approval-required commands.
- Do not replace the existing ledger bundle or graph waiver closure report.

## Generic Behavior

- ACO emits a `DecisionDossier` with `schemaVersion: "aco.decision-dossier.v1"`.
- The dossier contains route, decision, evidenceUsed, readiness, validationStatus, graphStatus, waivers, ledgerSummary, blockedItems, approvalRequired, approvalCommands, rejectedAlternatives, nextGoalObjective, and nextPlanPrompt.
- The dossier is the source of truth for Codex handoff text. Static Codex Goal Handoff text is forbidden.
- `nextGoalObjective`, `nextPlanPrompt`, and approval command reasons are derived from the current prompt and current evidence state, then redacted.
- Human Markdown is a derived view of the same machine dossier facts.
- Approval commands are inert display only: `willRun=false`, `requiresApproval=true`.

## Archon-Specific Behavior

- The canonical builder lives in `@archon/context-orchestrator`.
- `archon context dossier --cwd . "<prompt>"` renders the dossier without archive writes.
- `archon context dossier --cwd . --json "<prompt>"` emits the machine dossier.
- `archon context compile` writes `decision-dossier.json` and `decision-dossier.md` to the prompt-package archive.
- `codex-prompt.md` uses the dossier-derived `/goal` objective and must not reuse stale hard-coded goals from earlier ACO work.

## Inputs

- prompt
- cwd
- BMAD route
- graph context
- validation report
- ledger bundle
- acceptance plan
- documentation plan

## Outputs

- `DecisionDossier`
- `decision-dossier.json`
- `decision-dossier.md`
- dynamic Codex Goal Handoff in `codex-prompt.md`
- compact CLI human summary

## Known Unknowns

- Whether later API, Web, or workflow surfaces should expose dossier artifacts after the artifact-first CLI slice proves stable.

## Evidence References

- docs/context-orchestrator/specs/008-prompt-package-spec.md
- docs/context-orchestrator/specs/010-codex-readiness-spec.md
- docs/context-orchestrator/specs/012-cli-contract.md
- docs/context-orchestrator/specs/014-workflow-contracts.md

## Acceptance Scenarios

- AC-DOSSIER-001: Given a prompt, when the dossier builder runs, then it emits a canonical machine dossier with all required fields.
- AC-DOSSIER-002: Given `context compile`, when the archive is written, then `decision-dossier.json` and `decision-dossier.md` exist and match canonical builder output.
- AC-DOSSIER-003: Given `context dossier`, when run with and without `--json`, then JSON and Markdown outputs report the same facts.
- AC-DOSSIER-004: Given an unrelated prompt compile, when `codex-prompt.md` is inspected, then it contains a dossier-derived `/goal` and does not contain stale `Implement ACO Acceptance Reality Gate` text.
- AC-DOSSIER-005: Given forbidden graph state with waivers, when the dossier is built, then exact waiver IDs remain visible and are never auto-cleared.
- AC-DOSSIER-006: Given approval-required state, when the dossier is built, then approval commands are listed with `willRun=false` and are not executed.
- AC-DOSSIER-007: Given artifacts can carry dossier output, when this slice is implemented, then no DB, API, Web, or workflow engine change is required.

## Failure Behavior

- Dossier generation fails if required underlying ACO evidence builders fail.
- If validation fails, the dossier decision is blocked and must not claim implementation readiness.
- If graph evidence is forbidden or unavailable, readiness remains approval-required until the user approves explicit repair commands or preserves waivers.
- Missing dossier artifact in a compiled archive fails compile acceptance.

## Security Constraints

- Redact secrets in all dossier text fields.
- Do not read target repo `.env` files.
- Do not interpolate raw prompt text into shell commands.
- Do not execute approval commands from dossier generation.
- Treat graph, ledger, docs, and validation evidence as untrusted input for rendering.

## Open Questions

- Should a later surface link the dossier from Web or workflow run detail after CLI and archive behavior stabilizes?
