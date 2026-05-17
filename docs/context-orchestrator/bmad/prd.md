# ACO PRD

Date: 2026-05-17
BMAD action: `bmad-prd`

## Objective

Implement the first ACO milestone inside Archon as a generic package with a CLI MVP surface that compiles and archives Codex-ready prompt packages.

## Requirements

### R1 Capability Routing

ACO must select capabilities from the prompt and available evidence:

- graph context
- docs planning
- BMAD routing
- acceptance planning
- Caveman policy
- prompt compilation
- archive writing
- security validation

### R2 Documentation Planning

ACO must select OpenAI Docs MCP for OpenAI/Codex behavior. ACO must use Context7 for third-party library/API documentation only when a library ID is resolved. Unresolved library IDs must remain unresolved.

### R3 BMAD Routing

ACO must select the brownfield route for architecture-sensitive Archon implementation tasks and include PRD validation before architecture.

### R4 Acceptance Planning

ACO must generate Given/When/Then acceptance scenarios before compiling an implementation prompt.

### R5 Prompt Package

ACO must write:

- `manifest.json`
- `original-prompt.md`
- `user-prompt.md`
- `codex-prompt.md`
- `final-prompt-package.md`
- `route-report.md`
- `graph-summary.md`
- `docs-plan.md`
- `docs-evidence.json`
- `bmad-route.md`
- `acceptance-plan.md`
- `capability-route.json`
- `caveman-policy.md`
- `validation-report.md`

### R6 CLI Surface

ACO must expose at least:

- `archon context compile --cwd <repo> [--json] "<prompt>"`
- `archon context validate --cwd <repo> [--json]`
- `archon context status --cwd <repo> [--json]`

### R7 Security

ACO must not read target `.env` files. ACO must redact token-like values in prompt/archive output. ACO must reject archive path traversal.

## Non-Goals

- No REST API in MVP.
- No slash command in MVP.
- No workflow integration in MVP unless CLI is complete and acceptance tests remain small.
- No DB migration.

## Acceptance Criteria

- A prompt package includes traceability to specs and acceptance criteria.
- CLI compile returns archive paths and can emit JSON.
- Archive writer produces deterministic output with injected run ID and timestamp in tests.
- Secret-like strings do not appear in archives.
- Context7 unresolved library IDs are preserved as unresolved.
- Caveman policy does not alter code, JSON, YAML, TOML, paths, URLs, or commands.
