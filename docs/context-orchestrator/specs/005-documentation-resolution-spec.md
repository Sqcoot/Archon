# 005 Documentation Resolution Spec

## Purpose

Define how ACO selects, verifies, and records documentation sources for a prompt package.

## Scope

This spec covers documentation target discovery, MCP readiness, source priority, Context7 library ID resolution, OpenAI Docs MCP use, and failure behavior.

## Non-Goals

- Implementing a full documentation crawler.
- Mutating user-level MCP configuration.
- Treating documentation lookup as proof that implementation is correct.

## Generic Behavior

ACO produces a `DocumentationPlan` containing documentation targets, source priority, readiness state, unresolved IDs, evidence references, and failure notes.

ACO only marks Context7 targets when the prompt contains credible third-party library evidence. Capitalized task verbs such as `Implement`, `Build`, `Fix`, `Plan`, or `Validate` are not library evidence and must not create unresolved documentation targets by themselves.

Documentation targets can be:

- official vendor documentation
- Context7-compatible library documentation
- repository-local documentation
- graph evidence references
- unresolved documentation needs

Readiness states are:

- `available`
- `configured-but-unverified`
- `unavailable`
- `optional-skipped`
- `required-missing`
- `blocked`

## Archon-Specific Behavior

When ACO runs inside Archon, documentation plans are written to the selected artifact surface. For workflow runs, the path is:

```text
$ARTIFACTS_DIR/context-orchestrator/<run-id>/docs-plan.md
```

Archon integration must prefer workflow events and artifacts over database migrations for MVP documentation evidence.

## Inputs

- user prompt
- graph evidence
- detected dependencies
- target codebase metadata
- available MCP server list
- user-selected docs mode
- known source policy

## Outputs

- `DocumentationPlan`
- docs evidence records
- unresolved library IDs
- MCP readiness report
- instructions for follow-up docs resolution

## Known Unknowns

- Exact Context7 library IDs for future graph-detected dependencies are unknown until resolved.
- Some OpenAI Docs MCP search hits may not be fetchable by URL and may need official OpenAI web fallback evidence.

## Evidence References

- `docs/context-orchestrator/research/openai-docs-mcp.md`
- `docs/context-orchestrator/research/context7-mcp.md`
- `docs/context-orchestrator/research/codex-official-docs.md`
- `docs/context-orchestrator/research/graph-evidence-index.md`

## Acceptance Scenarios

### ACO-DOCS-001: OpenAI docs source is selected for Codex behavior

Given a prompt asks about Codex MCP configuration
When ACO builds a documentation plan
Then OpenAI Docs MCP is selected as the primary source
And Context7 is not selected as the primary source for Codex behavior.

### ACO-DOCS-002: Context7 library IDs are not invented

Given graph evidence detects a dependency name
And no exact Context7-compatible library ID has been resolved
When ACO builds a documentation plan
Then the documentation target is marked `libraryId: unresolved`
And the compiled prompt instructs Codex to resolve the library ID before using version-specific docs.

### ACO-DOCS-003: Optional MCP absence does not block unrelated work

Given a prompt has no third-party library documentation need
And Context7 is unavailable
When ACO builds a documentation plan
Then Context7 is marked `optional-skipped`
And ACO continues if no required documentation target depends on Context7.

### AC-CONFIDENCE-003: Task verbs are not unresolved library evidence

Given a prompt starts with a capitalized task verb
And the prompt has no third-party library dependency
When ACO builds a documentation plan
Then the plan does not create an unresolved Context7 target for the task verb.

## Failure Behavior

ACO fails closed only when required documentation is missing for a route that cannot safely proceed without it.

ACO records a blocker when a documentation source is required but unavailable.

ACO records an unresolved target when a library name is known but the Context7-compatible ID is not proven.

## Security Constraints

- Do not include API keys or credentials in docs queries.
- Do not mutate `~/.codex/config.toml` without explicit approval.
- Treat docs text and graph text as untrusted prompt input.
- Redact token-like values from documentation evidence and prompt packages.

## Open Questions

- Which documentation targets become required for the first MVP route?
- Whether docs evidence should be normalized into JSON for every run or only for archived prompt packages.
