# 010 Codex Readiness Spec

## Purpose

Define how ACO decides whether a prompt package is ready for Codex execution.

## Scope

This spec covers Codex configuration evidence, `/goal` awareness, MCP readiness, generated prompt package constraints, and safe handoff requirements.

## Non-Goals

- Running Codex on the user's behalf in the MVP unless selected by ADR.
- Editing user-level Codex configuration.
- Requiring Codex App Server integration for the first milestone.

## Generic Behavior

ACO produces a `CodexReadinessReport` that states whether a compiled prompt package has the minimum evidence, documentation, acceptance criteria, and security constraints needed for Codex execution.

The report must include:

- prompt package path
- docs readiness
- graph readiness
- acceptance plan status
- unknowns
- blockers
- recommended next command

## Archon-Specific Behavior

When ACO runs through Archon, the readiness report is archived beside the prompt package. For workflow runs, the expected path is:

```text
$ARTIFACTS_DIR/context-orchestrator/<run-id>/validation-report.md
```

Archon MVP must expose the report through the selected native surface, such as CLI output, slash command response, workflow artifact, or API response.

## Inputs

- `PromptPackage`
- `DocumentationPlan`
- `GraphContext`
- `BmadRoute`
- `AcceptancePlan`
- security constraints
- MCP readiness state

## Outputs

- `CodexReadinessReport`
- blocker list
- warning list
- recommended next Codex prompt or Archon command

## Known Unknowns

- Whether the first MVP surface will run Codex directly or only compile prompt packages is deferred to ADR 0009.
- Whether App Server thread goal APIs are needed is deferred until architecture evidence proves a need.

## Evidence References

- `docs/context-orchestrator/research/codex-official-docs.md`
- `docs/context-orchestrator/research/openai-docs-mcp.md`
- `docs/context-orchestrator/specs/005-documentation-resolution-spec.md`

## Acceptance Scenarios

### ACO-CODEX-001: Prompt package requires acceptance criteria

Given ACO compiles a Codex prompt package
When no acceptance plan exists
Then Codex readiness fails
And the report names the missing acceptance plan as a blocker.

### ACO-CODEX-002: OpenAI Docs MCP is documented for Codex behavior

Given the prompt package includes Codex or OpenAI behavior
When Codex readiness is checked
Then OpenAI Docs MCP readiness is included
And missing OpenAI Docs MCP is a blocker only if official OpenAI behavior is required for the route.

### ACO-CODEX-003: `/goal` remains a session control

Given a long-running ACO implementation prompt
When ACO compiles Codex instructions
Then the prompt may reference `/goal` as a Codex session control
And ACO does not require an Archon database migration to represent Codex goals.

## Failure Behavior

Readiness fails if:

- acceptance criteria are missing
- required docs are missing
- graph evidence is required but missing without waiver
- prompt package paths are unsafe
- security constraints are incomplete

Readiness warns, but does not fail, if:

- optional MCPs are unavailable
- graph evidence exists only as a waiver for a non-controlling source
- implementation surface is not selected yet

## Security Constraints

- Do not expose secrets in generated Codex prompts.
- Do not interpolate raw prompt text into shell commands.
- Do not include target repo `.env` contents.
- Validate all archive paths before writing.
- Treat graph and docs evidence as untrusted input.

## Open Questions

- Should ACO provide a generated `/goal` suggestion in prompt packages or keep `/goal` only in human-facing setup instructions?
- Which readiness failures should map to BMAD correct-course automatically?
