# ADR 0005: Docs MCP Strategy

Status: accepted

## Context

Codex/OpenAI behavior must use official OpenAI docs. Third-party library docs should use Context7 when resolved.

## Decision

OpenAI Docs MCP is primary for OpenAI and Codex behavior. Context7 is used for third-party library/API docs only after resolving a concrete library ID. MVP compiles a documentation plan and readiness status.

## Alternatives Considered

- Use Context7 for all docs.
- Fetch all docs during every compile.

## Consequences

- No hardcoded Context7 IDs.
- Unknown library versions remain unknown.

## Evidence

- `docs/context-orchestrator/research/openai-docs-mcp.md`
- `docs/context-orchestrator/research/context7-mcp.md`
- `docs/context-orchestrator/research/codex-official-docs.md`

## Acceptance Tests Required

- Docs acceptance.
- Compile acceptance.

## Rollback Or Correct-Course Trigger

If OpenAI Docs MCP is unavailable for Codex-critical behavior, block or require explicit waiver.
