# 026 Next Decision Engine Spec

## Purpose

Define the ACO Next Decision Engine so Context Orchestrator evidence produces one deterministic, schema-versioned next action.

## Scope

Pure decision derivation, `NextDecision` schema, branch precedence, stable evidence IDs, status/compile/dossier/approval-capsule/API/Web exposure, and inert user-facing actions.

## Non-Goals

- Do not add database state.
- Do not add accepted-risk approval.
- Do not refresh graph evidence.
- Do not add new slash command or workflow execution semantics.
- Do not execute approval commands or mark work ready by implication.
- Do not mutate sessions, workflow runs, or lifecycle state.

## Generic Behavior

- ACO builds `NextDecision` with `schemaVersion: "aco.next-decision.v1"`.
- The builder is pure: it accepts already-assembled context intent, route, readiness, validation report, graph context, ledger summary, evidence blockers, and evidence resolution.
- The builder does not read files, environment variables, databases, process state, graph caches, clocks, or subprocess output.
- Decision kinds are `blocked_by_validation`, `blocked_by_evidence`, `blocked_by_graph`, `approval_required`, `needs_correct_course`, and `ready_for_implementation`.
- Decision branch priority is executable: failed validation; non-graph blockers; graph unavailable/forbidden without valid explicit waivers; graph unavailable/forbidden with valid explicit waivers and approval resolution; unknown/warning/partial states; ready.
- Action objects include a typed action kind, label, optional argv command, optional payload, approval flag, `willRun: false`, and success evidence.
- Waiver IDs, evidence blocker IDs, and evidence resolution IDs are sorted and stable.
- The same input produces the same output and does not mutate input objects.
- Unsupported schema versions are not actionable; consumers may render a manual fallback but must not execute anything or claim readiness.

## Archon-Specific Behavior

- `getContextOrchestratorStatus()` includes the canonical `nextDecision`.
- `compilePromptPackage()` stores the same `nextDecision` in prompt-package evidence.
- Decision dossier and approval capsule include and render the same `nextDecision`.
- Existing ACO API responses expose `nextDecision` through status and compile contracts.
- The Web Context Orchestrator page renders the API-provided decision and does not recompute decision priority client-side.

## Inputs

- `ContextIntent`
- `BmadRoute`
- `ContextOrchestratorReadiness`
- `ValidationReport`
- `GraphContext`
- `LedgerBundleSummary`
- `EvidenceBlocker[]`
- `EvidenceClosurePlan`

## Outputs

- `NextDecision`
- rendered Next Decision section in decision dossier and approval capsule Markdown
- status and compile JSON with `nextDecision`
- ACO API response schemas with `nextDecision`
- Web primary next-action rendering

## Known Unknowns

- Whether future slash command and workflow consumers should treat `nextDecision` as a gate input after this read-only surface proves stable.

## Evidence References

- packages/context-orchestrator/src/next-decision.ts
- packages/context-orchestrator/src/status.ts
- packages/context-orchestrator/src/decision-dossier.ts
- packages/context-orchestrator/src/approval-capsule.ts
- packages/context-orchestrator/src/compiler.ts
- packages/server/src/routes/schemas/aco.schemas.ts
- packages/web/src/routes/AcoStatusPage.tsx

## Acceptance Scenarios

- AC-NEXT-001: Given current repo evidence has passed validation, no non-graph evidence blockers, forbidden graph state, and explicit graph waivers, when status builds a next decision, then `kind` is `approval_required`, both graph waiver IDs are present, non-graph blocker IDs are empty, and all actions have `willRun=false`.
- AC-NEXT-002: Given validation status is failed and graph waivers also exist, when the decision is built, then `blocked_by_validation` wins over waiver approval.
- AC-NEXT-003: Given non-graph evidence blockers exist, when the decision is built, then `blocked_by_evidence` wins before graph approval and reports sorted blocker IDs.
- AC-NEXT-004: Given graph is forbidden or unavailable without valid explicit waivers and approval resolution items, when the decision is built, then `kind` is `blocked_by_graph`.
- AC-NEXT-005: Given decision dossier, approval capsule, status, compile, API, and Web surfaces receive ACO evidence, when they render next action state, then they use the same canonical `nextDecision` and do not locally recompute priority.
- AC-NEXT-006: Given identical input objects, when `buildNextDecision()` runs more than once, then output is identical, input objects are unchanged, and no I/O, subprocess, graph refresh, approval execution, or lifecycle mutation occurs.

## Failure Behavior

- Missing or malformed decision inputs produce `needs_correct_course` unless validation failure, evidence blockers, or graph failure provide a higher-priority blocked decision.
- Unsupported schema versions are rendered as manual fallback by consumers.
- Empty action commands remain inert and must not be shell-interpolated.

## Security Constraints

- Redact prompt-derived and evidence-derived text before rendering.
- Do not read `.env` files or external evidence sources during decision derivation.
- Do not include raw secrets in `nextPrompt`, action labels, summaries, or payloads.
- Do not execute command strings from decision rendering.

## Open Questions

- Should later workflow approval nodes consume `nextDecision.primaryAction.payload` directly, or continue using approval capsule artifacts as the stable handoff?
