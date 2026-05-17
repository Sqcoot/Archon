# ACO BMAD Retrospective

Date: 2026-05-17

## What Worked

- Bootstrap-first sequencing prevented architecture from being chosen before upstream evidence existed.
- The separate research scripts made the upstream corpus reproducible and updateable.
- Graphify provided enough structure evidence to justify a generic package plus thin CLI adapter.
- OpenAI Docs MCP and Context7 checks clarified documentation source boundaries.
- ATDD acceptance files caught the missing CLI package resolution and missing `context route` command before final reporting.

## What Failed Or Changed

- Root acceptance tests could not import `@archon/context-orchestrator` until the root package declared the workspace package as a dev dependency and `bun install` refreshed links.
- `archon context route` was documented in the intended guidance but was not in the initial MVP implementation. It was added before final validation.
- Full workflow validation exposed a pre-existing missing MCP config for `archon-smart-pr-review`; this remains a baseline waiver, not an ACO regression.

## Discovery Changes

- ADR 0009 kept the MVP CLI-first instead of implementing all candidate surfaces.
- ADR 0011 rejected a DB migration for the first milestone; artifacts and CLI validation are sufficient.
- Graph failures in `bmad-plugins-marketplace` and `bmad-sample-data` forced explicit waivers and partial graph status.

## Wrong Or Risky Assumptions

- Assumption: workspace packages are automatically importable from root-level tests.
  Result: false until linked through root `devDependencies`.

- Assumption: compile/status/validate were enough for durable ACO guidance.
  Result: incomplete; `context route` was added.

- Assumption: full workflow validation would pass as a baseline.
  Result: false due a pre-existing missing `.archon/mcp/ntfy.json`.

## Test And Acceptance Gaps

- Deferred API acceptance remains todo.
- Deferred slash command acceptance remains todo.
- Deferred workflow and workflow-event acceptance remain todo.
- Status command behavior has no direct acceptance assertion yet beyond CLI smoke coverage.

## Security Lessons

- Redaction must happen before archive rendering, not only at CLI output.
- Archive paths need containment checks even for generated run IDs.
- Target repo `.env` files must remain outside the evidence and archive model.
- Caveman compression must not touch fenced structured artifacts.

## Future Route Improvements

- Add a dedicated validation route for prompts like "Validate the ACO MVP."
- Add explicit route output for selected capability IDs and unresolved assumptions.
- Add richer Context7 target extraction based on graph dependencies, not only prompt text.
- Add workflow-event integration after the workflow contract is accepted.

## Next BMAD Workflow

`/bmad-bmm-create-story`

Recommended story:

Add the next Archon-native surface for ACO, with workflow/event integration as the highest-value candidate if observability is the next priority.
