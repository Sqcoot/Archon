# ACO Architecture

Date: 2026-05-17

## Decision Summary

Implement a generic core package, `@archon/context-orchestrator`, and expose the first milestone through `archon context`.

## Package Boundary

`packages/context-orchestrator` owns:

- schemas and domain types
- capability registry
- graph summary loader
- documentation planner
- BMAD router
- acceptance planner
- Caveman policy
- prompt package compiler
- archive writer
- validation report builder

`packages/cli` owns:

- argument parsing
- user-facing console output
- `--json` response shape
- command dispatch to the generic package

## Storage

CLI archives go under:

```text
.archon/artifacts/context-orchestrator/<run-id>/
```

Future workflow archives may use:

```text
$ARTIFACTS_DIR/context-orchestrator/<run-id>/
```

## MVP Commands

```bash
archon context status --cwd .
archon context validate --cwd .
archon context compile --cwd . --json "Prompt"
```

## Security Model

- Never read `.env`, `.env.local`, `.env.development`, or `.env.production` from the target repository.
- Redact token-like values from all prompt and archive text.
- Validate all archive paths stay under the selected archive root.
- Do not invoke shell commands with raw prompt text.

## Follow-Up Surfaces

- Slash command wrapper: `/context compile <prompt>`.
- Workflow wrapper: `context-orchestrate`.
- REST API: `/api/context/*`.
