# ACO Stabilization Scorecard

Final recommendation: `ready`

ACO is materially safer and more deterministic after this pass, and the aggregate pre-PR validation now passes. Runtime ACO status for `/goal stabilize-aco-merge-ready` still reports `needs_approval` while graph evidence remains forbidden, which keeps the active graph waivers visible. The user explicitly approved preserving those graph waivers for this run only, so the final merge recommendation is `ready` without clearing, refreshing, or hiding the waivers.

## Comparison Baseline

| Field | Value |
| --- | --- |
| Current branch | `stabilization/stab-002-bmad-method-current-sync` |
| Target branch | `sqcoot/stabilization/stab-002-sdd-atdd-alignment-upstream-dev` |
| Merge base | `7fa37b78e1acac1e2c7e1692830c1b27c9b571cb` |
| Compare command | `git diff --name-status sqcoot/stabilization/stab-002-sdd-atdd-alignment-upstream-dev...HEAD` |
| Changed-file command | `git diff --name-status 7fa37b78e1acac1e2c7e1692830c1b27c9b571cb` plus `git status --short --untracked-files=all` for new files |
| Inventory generated at | `2026-05-21T17:21:51Z` |
| Initial changed-file count | 18 |
| Final changed-file count | 56 |
| Open PR | [Sqcoot/Archon#3](https://github.com/Sqcoot/Archon/pull/3) |
| Missing baseline fields | 0 |

## Inventory Summary

| Metric | Count |
| --- | ---: |
| Initial changed files | 18 |
| Final changed files | 56 |
| Files kept | 54 |
| Files moved | 0 |
| Files removed | 2 |
| Generated files retained | 6 |
| Generated files removed | 2 |
| Explicit deferrals | 0 |
| Behavior test files added or strengthened | 8 |
| Text-only tests paired with behavior tests | 2 |
| Security scenarios validated | 12 |

## Changed-File Inventory

| Classification | Files |
| --- | --- |
| Product source | `.gitignore`, `.archon/commands/defaults/goal.md`, `packages/cli/src/commands/aco.ts`, `packages/cli/src/commands/context.ts`, `packages/context-orchestrator/src/approval-capsule.ts`, `packages/context-orchestrator/src/bmad.ts`, `packages/context-orchestrator/src/decision-dossier.ts`, `packages/context-orchestrator/src/docs.ts`, `packages/context-orchestrator/src/index.ts`, `packages/context-orchestrator/src/ledgers.ts`, `packages/context-orchestrator/src/schemas/next-decision.ts`, `packages/context-orchestrator/src/status.ts`, `packages/context-orchestrator/src/types.ts`, `packages/core/src/handlers/command-handler.ts`, `packages/server/src/routes/api.ts`, `packages/server/src/routes/schemas/aco.schemas.ts`, `packages/web/src/lib/aco-readiness.ts`, `packages/web/src/routes/AcoStatusPage.tsx`, `scripts/research/render-sdd-scaffold.ts` |
| Product fixture | `packages/context-orchestrator/src/decision-dossier.test.ts`, `packages/context-orchestrator/src/evidence-closure.test.ts`, `packages/context-orchestrator/src/ledgers.test.ts`, `packages/context-orchestrator/src/status.test.ts`, `packages/web/src/lib/aco-readiness.test.ts`, `tests/acceptance/context-orchestrator/bmad.acceptance.test.ts`, `tests/acceptance/context-orchestrator/docs.acceptance.test.ts`, `tests/acceptance/context-orchestrator/route.acceptance.test.ts` |
| Durable documentation | `docs/context-orchestrator/baseline.md`, `docs/context-orchestrator/bmad/bmad-method-6-7-sync-review.md`, `docs/context-orchestrator/bmad/project-context.md`, `docs/context-orchestrator/bmad/retrospective.md`, `docs/context-orchestrator/final-validation-report.md`, `docs/context-orchestrator/research/context7-mcp.md`, `docs/context-orchestrator/specs/006-bmad-routing-spec.md`, `docs/context-orchestrator/specs/017-implementation-discovery-protocol.md`, `docs/context-orchestrator/specs/018-release-readiness-spec.md`, `docs/context-orchestrator/stabilization/aco-pr-hygiene-report.md`, `docs/context-orchestrator/stabilization/aco-stabilization-scorecard.json`, `docs/context-orchestrator/stabilization/aco-stabilization-scorecard.md`, `packages/docs-web/src/content/docs/book/quick-reference.md`, `packages/docs-web/src/content/docs/book/solidification-review-ledgers.md` |
| Optional template | `.archon/commands/defaults/ai-layer-branch-gate.md`, `.archon/commands/defaults/ai-layer-goal.md`, `.archon/commands/defaults/ai-layer-preflight.md`, `.archon/commands/defaults/ai-layer-stop-gate.md`, `.archon/commands/defaults/ai-layer-study-reference.md` |
| Internal stabilization artifact | `_bmad-output/implementation-artifacts/context7-mcp-key/proposed/context7-mcp-config-proposal.md`, `_bmad-output/implementation-artifacts/investigations/context7-mcp-key-investigation.md` |
| Generated retained | `_bmad/_config/files-manifest.csv`, `_bmad/_config/manifest.yaml`, `_bmad/bmm/config.yaml`, `_bmad/core/config.yaml`, `packages/web/src/lib/api.generated.d.ts`, `packages/workflows/src/defaults/bundled-defaults.generated.ts` |
| Generated removed | `packages/core/tsconfig.tsbuildinfo`, `packages/server/tsconfig.tsbuildinfo` |
| Deferred with reason | None |

## Ignored Local Outputs

`.gitignore` now ignores `_bmad-output/` for generated local BMAD/planning output. Existing tracked `_bmad-output` files remain tracked and classified above; new local generated outputs no longer pollute PR hygiene or ACO git-status evidence.

## Generated Files

| File | Source input | Generator | Drift check | Owner surface |
| --- | --- | --- | --- | --- |
| `_bmad/_config/files-manifest.csv` | BMAD installation inputs | `npx bmad-method install` / BMAD sync flow | `git diff -- _bmad` after BMAD sync | BMAD config |
| `_bmad/_config/manifest.yaml` | BMAD installation inputs | `npx bmad-method install` / BMAD sync flow | `git diff -- _bmad` after BMAD sync | BMAD config |
| `_bmad/bmm/config.yaml` | BMAD installation inputs | `npx bmad-method install` / BMAD sync flow | `git diff -- _bmad` after BMAD sync | BMAD config |
| `_bmad/core/config.yaml` | BMAD installation inputs | `npx bmad-method install` / BMAD sync flow | `git diff -- _bmad` after BMAD sync | BMAD config |
| `packages/web/src/lib/api.generated.d.ts` | server OpenAPI route registrar | in-process OpenAPI document plus `openapi-typescript` | regenerate temp output, prettier with `.prettierrc`, then `diff -u` | API/web contract |
| `packages/workflows/src/defaults/bundled-defaults.generated.ts` | `.archon/commands/defaults/**`, `.archon/workflows/defaults/**` | `bun run generate:bundled` | `bun run check:bundled` | bundled defaults |

## Runtime Readiness

`bun run cli context status --cwd . --json "/goal stabilize-aco-merge-ready"` returns:

- readiness: `needs_approval`
- next decision: `approval_required`
- graph status: `forbidden`
- graph waivers: `graph-waiver.bmad-plugins-marketplace`, `graph-waiver.bmad-sample-data`
- evidence blockers: none

Approval evidence:

- approved by user in this thread at `2026-05-21T17:31:41Z`
- approval contract source: current `bun run cli context status --cwd . --json "/goal stabilize-aco-merge-ready"` output
- contract ID stability: commit-derived; do not pin the ID in tracked scorecard content because recording approval evidence changes the commit SHA
- scope: preserve `graph-waiver.bmad-plugins-marketplace` and `graph-waiver.bmad-sample-data` for this run only
- non-scope: no graph refresh, waiver cleanup, or provider/config mutation approved

## Scorecard

| # | Gate | Status | Evidence type | Evidence |
| ---: | --- | --- | --- | --- |
| 1 | Baseline and comparison evidence | pass | validation command | Baseline table above has 0 missing fields. |
| 2 | Changed-file inventory coverage | pass | validation command | 56/56 PR files classified exactly once; generated local `_bmad-output` files are ignored unless force-added as reviewed artifacts. |
| 3 | Local-assumption removal | pass | code, removal, validation command | Developer-local absolute path scan returned no retained ACO/product hits; local branch gates parameterized; tsbuildinfo removed. |
| 4 | Provider-default safety | pass | code, workflow, removal | AI-layer command defaults are parameterized optional templates; no live provider config mutation added. |
| 5 | Missing dependency and fixture closure | pass | test, validation command | Package, acceptance, server, CLI, and web tests passed with committed fixtures. |
| 6 | Generated-file reproducibility | pass | generated drift check | Bundled defaults and API generated types drift checks passed; unreproducible tsbuildinfo removed. |
| 7 | Readiness state contract | pass | code, test | `ready`, `blocked`, `needs_approval`, `needs_decision`, `unknown` implemented and behavior-tested. |
| 8 | Runtime integration truthfulness | pass | code, test | Docs integrations use explicit runtime verification states and do not assume MCP/Context7 availability. |
| 9 | Behavior-driven test replacement | pass | test | Critical ACO text tests are paired with package, API, CLI, web helper, workflow, policy, traceability, and acceptance behavior tests. |
| 10 | Security hardening | pass | test | Path traversal, unsafe cwd, artifact boundary, symlink, run ID, redaction, telemetry, approval/dossier, and provider-hook safety covered by passing suites. |
| 11 | API contract | pass | code, test, generated drift check | ACO route tests passed; generated API type drift check passed. |
| 12 | CLI contract | pass | code, test | CLI ACO/context tests and acceptance tests passed; unknown/non-ready states do not imply success. |
| 13 | Web contract | pass | code, test, validation command | Web readiness helpers cover readiness states; page handles loading/error; web build passed. |
| 14 | Workflow safety | pass | workflow, validation command | `context-orchestrate` validates; bundled defaults regenerated; AI-layer defaults no longer require local paths or stale branch. |
| 15 | Policy gate | pass | test, validation command | `bun run aco:policy` passed OPA and fixture expectations. |
| 16 | Traceability gate | pass | validation command | `bun run aco:traceability` passed. |
| 17 | Telemetry safety | pass | test | `@archon/context-orchestrator` package tests include telemetry no-leak and safe-degradation coverage. |
| 18 | BMAD routing | pass | code, test | 8/8 required routing cases plus slash-goal route case passed. |
| 19 | Documentation-only gate prevention | pass | scorecard evidence | Every pass above cites code, tests, workflow, removal, drift check, or validation. |
| 20 | Not-applicable evidence | pass | scorecard evidence | No hard gate is marked `not_applicable`; no risky surface hidden behind NA. |
| 21 | Final validation commands | pass | validation command | `bun run validate` now passes after preserving and formatting the unrelated untracked `_bmad-output` markdown files. |
| 22 | Final merge recommendation | pass | scorecard evidence | Final recommendation is exactly `ready`; user approval preserves the two visible graph waivers for this run while the runtime status continues to expose the current commit-derived approval contract. |

## Validation Results

| Command | Result | Evidence |
| --- | --- | --- |
| `bun install --frozen-lockfile` | pass | Checked installs, no lockfile changes. |
| `bun run type-check` | pass | All package type checks and scripts tsc passed. |
| `bun run lint --max-warnings 0` | pass | ESLint passed after BMAD quote fix. |
| `bun run test` | pass | Full package test suite passed. |
| `bun --filter @archon/context-orchestrator test` | pass | 73 tests passed. |
| `bun test ./packages/server/src/routes/api.aco.test.ts` | pass | 11 route tests passed. |
| `bun test ./packages/cli/src/commands/aco.test.ts ./packages/cli/src/commands/context.test.ts` | pass | 18 CLI tests passed. |
| `bun test ./packages/web/src/lib/aco-readiness.test.ts ./packages/web/src/routes/AcoStatusPage.test.ts` | pass | 7 web/helper tests passed. |
| `bun run build:web` | pass | Vite build passed with existing chunk-size warning. |
| in-process OpenAPI generation plus `openapi-typescript` temp diff | pass | `api.generated.d.ts` regenerated and drift-free. |
| `bun run generate:bundled` | pass | Bundled defaults regenerated. |
| `bun run check:bundled` | pass | 55 commands and 23 workflows up to date. |
| `bun run check:bundled-skill` | pass | 21 bundled skill files up to date. |
| `bun run aco:policy` | pass | OPA tests and fixtures passed. |
| `bun run aco:traceability` | pass | Traceability validation passed. |
| `bun run aco:test:acceptance` | pass | 99 acceptance tests passed. |
| `bun run validate:ts-navigation` | pass | TypeScript language-service navigation validation passed. |
| `bun run cli validate commands goal --json` | pass | `goal` command valid. |
| `bun run cli validate workflows context-orchestrate --json` | pass | Workflow valid. |
| `bun run format:check` | pass | All matched files use Prettier code style. |
| `bun run validate` | pass | Pre-PR validation passed. |

## Approval Evidence

Runtime ACO readiness for `/goal stabilize-aco-merge-ready` is `needs_approval`, with two graph waivers remaining visible:

- `graph-waiver.bmad-plugins-marketplace`
- `graph-waiver.bmad-sample-data`

The user approved preserving those waivers for this run only. The generated approval capsule is exposed by `bun run cli context status --cwd . --json "/goal stabilize-aco-merge-ready"` under `nextDecision.primaryAction.payload`.

Final recommendation: `ready`.
