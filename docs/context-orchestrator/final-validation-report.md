# Archon Context Orchestrator Final Validation Report

Date: 2026-05-17

## Summary

ACO first milestone is implemented as an Archon-native CLI MVP backed by a generic `@archon/context-orchestrator` package.

Selected MVP surface:

- `archon context route`
- `archon context compile`
- `archon context status`
- `archon context validate`

Deferred surfaces:

- Slash command surface
- REST API surface
- Workflow/event surface

Deferral is intentional and documented by ADR 0009. The first milestone locally validates the generic core, research corpus, SDD/ATDD artifacts, BMAD route selection, docs planning, prompt package compilation, archive writing, redaction, and CLI contract. This report is local validation evidence, not proof that hosted GitHub CI is green.

## Specs Completed

All required SDD specs exist and are sectioned:

- `000-product-charter.md` through `020-package-scripts-and-research-corpus-spec.md`
- `assumption-evidence-register.md`
- `spec-traceability-matrix.md`

Validation:

- `bun run research:validate-sdd`: passed
- `tests/acceptance/context-orchestrator/specs.acceptance.test.ts`: passed

## Acceptance Status

Acceptance harness:

- `tests/acceptance/context-orchestrator/`

Latest local result after the corrective security/documentation slice:

- `bun run aco:test:acceptance`: 26 passed, 4 todo, 0 failed

Intentional todo surfaces:

- API
- Slash command
- Workflow
- Workflow events

## Research Corpus Status

Bootstrap and graph status:

- Required upstream entries: 13
- Graph complete: 11
- Graph failed/waived: 2
- Waived repositories: `bmad-plugins-marketplace`, `bmad-sample-data`

Validation:

- `bun run research:validate-corpus`: passed

Manifest:

- `docs/context-orchestrator/research/upstream-manifest.json`

## Graphify Status

Graphify was available and used where possible.

Outputs:

- `research/graphs/<repo-name>/GRAPH_REPORT.md`
- `research/graphs/<repo-name>/graph.json`
- `research/graphs/<repo-name>/graph-metadata.json`
- `docs/context-orchestrator/research/graph-evidence-index.md`
- `docs/context-orchestrator/research/merged-ecosystem-report.md`
- `docs/context-orchestrator/research/waivers.md`

Current ACO graph status reports `partial` because two required upstreams have explicit graph waivers.

## Docs MCP Status

OpenAI Docs MCP:

- Status: available
- Verified through `codex mcp list`
- Used for Codex config and slash-command documentation evidence

Context7:

- Status: available
- Verified through `codex mcp list`
- CLI evidence gathered with `npx ctx7@latest library` and `npx ctx7@latest docs`

Documentation behavior:

- Codex/OpenAI topics route to OpenAI Docs MCP.
- Third-party library/API topics route to Context7 with unresolved library IDs unless resolved first.
- Runtime resolver behavior in the CLI MVP is static planning: the package records documentation targets and MCP readiness states from research evidence. It does not perform live MCP resolution during every `context compile` invocation.

## BMAD Route Status

Implemented route catalog:

- Brownfield architecture-sensitive route
- Quick contained route
- Correct-course route
- Unknown-help fallback

Validated:

- `archon context route --cwd . --json "Implement an architecture-sensitive context orchestrator inside Archon."`: selected `brownfield-architecture`
- `tests/acceptance/context-orchestrator/route.acceptance.test.ts`: passed
- `tests/acceptance/context-orchestrator/bmad.acceptance.test.ts`: passed

## Architecture ADR Decision

ADR 0009 selected a CLI-first MVP with:

- Generic core in `packages/context-orchestrator`
- Thin Archon CLI integration in `packages/cli`
- Archive output under `.archon/artifacts/context-orchestrator/<run-id>/`
- No DB migration for the first milestone

## Implemented MVP Surface

Core package:

- `packages/context-orchestrator/src/`

CLI integration:

- `packages/cli/src/commands/context.ts`
- `packages/cli/src/cli.ts`

Archive created by validation run:

- `.archon/artifacts/context-orchestrator/aco-validation-run/`

Expected archive files are written, including:

- `manifest.json`
- `codex-prompt.md`
- `final-prompt-package.md`
- `route-report.md`
- `docs-plan.md`
- `bmad-route.md`
- `acceptance-plan.md`
- `validation-report.md`

## Local Validation Results

These commands were run locally. They do not replace hosted CI.

Passed:

- `bun run type-check`
- `bun run lint --max-warnings 0`
- `bun run format:check`
- `bun run test`
- `bun run build`
- `bun run research:validate-corpus`
- `bun run research:validate-sdd`
- `bun run aco:test:acceptance`
- `bun run cli validate commands --cwd .`
- `bun run cli context validate --cwd . --json`
- `bun run cli context compile --cwd . --run-id aco-validation-run --timestamp 2026-05-17T12:00:00.000Z --json "Validate the ACO MVP."`

Known baseline workflow validation waiver:

- `bun run cli validate workflows --cwd .` fails on pre-existing workflow `archon-smart-pr-review` because `.archon/mcp/ntfy.json` is missing for node `notify`.
- This is not introduced by ACO and is documented as a baseline waiver.

Hosted CI status:

- PR #1 checks were not green at audit time.
- `docker-build` and `test (windows-latest)` did not execute because GitHub reported an account/billing runner lock.
- `test (ubuntu-latest)` was cancelled after the Windows matrix failure.
- Treat hosted CI as externally blocked until GitHub can run the jobs; do not treat this report as CI-green evidence.

Build note:

- `bun run build` passes with the pre-existing Vite chunk-size warning for `@archon/web`.

## Security Results

Passed:

- Secret redaction in prompt/archive output
- `.env` non-reading acceptance test
- Archive path containment
- Unsafe runId rejection
- Symlink archive-root and archive-file collision blocking
- Structured next-command argv instead of shell-interpolated command strings
- Broader redaction for lowercase and mixed-case keys, JSON/YAML style secrets, bearer tokens, OpenAI/GitHub/npm/AWS token shapes, URL credentials, and private-key blocks
- Project Codex hook task-id allowlisting and realpath containment checks
- Caveman structured-artifact preservation

Security posture:

- ACO does not read target repo `.env` files.
- Prompt text is not interpolated into shell commands.
- Archive writes are constrained under the selected archive root and reject known path traversal or symlink escape cases.
- Token-like prompt values are redacted before archive output.

## Package Scripts Added

Research and acceptance scripts:

- `research:bootstrap`
- `research:update-upstreams`
- `research:ff-upstreams`
- `research:validate-upstreams`
- `research:graph`
- `research:merge-graphs`
- `research:render-graph-docs`
- `research:render-sdd`
- `research:validate-sdd`
- `research:validate-corpus`
- `aco:research`
- `aco:test:acceptance`

## Known Limitations

- API surface is deferred.
- Slash command surface is deferred.
- Workflow definitions and workflow events are deferred.
- Graph evidence remains partial because two upstreams required waivers.
- Context7 version-specific docs are not used until a library ID is resolved.
- Hosted CI is externally blocked until GitHub runner billing/account status is resolved.
- Workflow validation still has the pre-existing non-ACO `archon-smart-pr-review` `.archon/mcp/ntfy.json` waiver.

## Next BMAD Skill

Next recommended BMAD step for this corrective slice:

`bmad-code-review`

Next recommended BMAD step for milestone 2 after review:

`bmad-create-story`

Story target:

Implement the second milestone surface selected by ADR update: workflow/event integration or slash command integration.
