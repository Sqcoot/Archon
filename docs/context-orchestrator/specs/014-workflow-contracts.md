# 014 Workflow Contracts

## Purpose

Define bundled workflow contracts.

## Scope

`context-orchestrate` plus later context-sdd-atdd-implement, context-research, context-code-review, and context-correct-course candidates.

## Non-Goals

- Do not add a DB migration for context-orchestrate artifacts.
- Do not create a second orchestration engine outside `@archon/context-orchestrator`.

## Generic Behavior

- Workflow contracts compose status, ledgers, compile, validation, approval, handoff, and archive stages.
- Context Orchestrator readiness display in workflow surfaces is read-only context except the explicit approval node, which pauses when graph evidence is forbidden or unavailable.
- `context-orchestrate` writes compile output to `$ARTIFACTS_DIR/context-orchestrator/<WORKFLOW_ID>`.
- `/context run <request>` starts bundled `context-orchestrate`; it does not fork separate orchestration logic.

## Archon-Specific Behavior

- Workflows use `$ARGUMENTS`, `$USER_MESSAGE`, `$WORKFLOW_ID`, `$ARTIFACTS_DIR`, `$DOCS_DIR`, `$CONTEXT`, and node-output references.

## Inputs

- workflow arguments
- codebase context
- artifact root

## Outputs

- workflow artifacts under `$ARTIFACTS_DIR/context-orchestrator`
- workflow events including node completions and approval pause/resume decisions
- validation report
- read-only Context Orchestrator readiness summary in workflow UI surfaces when a run has a registered codebase cwd

## Known Unknowns

- cleanup path for existing graph waivers

## Evidence References

- packages/workflows/src/schemas/workflow.ts
- .archon/workflows/defaults

## Acceptance Scenarios

- AC-P3-WF: Given `context-orchestrate` workflow exists, when workflow validation runs, then validation passes before use.
- AC-P3-WF: Given `context-orchestrate` compiles a context package, when artifacts are inspected, then package files live under `$ARTIFACTS_DIR/context-orchestrator/<WORKFLOW_ID>`.
- AC-P3-WF: Given forbidden or unavailable graph evidence, when `context-orchestrate` reaches the graph-validation gate, then it pauses at an approval node and resumes only after approval.
- AC-P3-WF: Given a workflow run belongs to a registered codebase, when dashboard cards or run detail are displayed, then they show Context Orchestrator readiness from the canonical status source with graph confidence limits visible.

## Failure Behavior

- Workflow fails with explicit blocker when required spec or acceptance plan is missing.
- Rejection of the approval gate stops the run cleanly without marking unrelated artifacts as valid.

## Security Constraints

- No raw prompt text in shell commands; no secrets in workflow events.
- Context Orchestrator readiness display must not add arbitrary cwd entry or expose unregistered repository state.

## Open Questions

- Should later native loop variants be bundled defaults or repo-local examples first?
