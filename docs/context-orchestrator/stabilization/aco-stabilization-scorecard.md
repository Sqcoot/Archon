# ACO Stabilization Scorecard

Final recommendation: `ready_with_approved_graph_waivers`

ACO is merge-ready with explicit approved graph-waiver visibility. Runtime ACO
status for `/goal stabilize-aco-merge-ready` still reports `needs_approval`
because graph evidence is forbidden for two upstream BMAD repositories. The
user approved preserving those waivers for this run only, so the final merge
recommendation is not plain `ready`; it is
`ready_with_approved_graph_waivers`.

## Historical Comparison Baseline

This scorecard was generated on 2026-05-21 for an earlier PR review base. It is
retained as historical stabilization evidence only. Final merge-hygiene analysis
for the current cleanup goal uses `origin/dev...HEAD` in
`stab-002-dev-diff-inventory.md`.

| Field | Value |
| --- | --- |
| Current branch | `stabilization/stab-002-bmad-method-current-sync` |
| Historical target | Earlier PR review base; see Sqcoot/Archon#3. |
| Merge base | `7fa37b78e1acac1e2c7e1692830c1b27c9b571cb` |
| Historical compare command | Earlier PR-base comparison; not the final merge-hygiene command. |
| Historical changed-file command | Earlier PR-base inventory plus untracked files; not the final merge-hygiene inventory. |
| Inventory generated at | `2026-05-21T18:15:12Z` |
| Initial changed-file count | 56 |
| Final changed-file count | 62 |
| Head commit at inventory generation | `0217724685f1053f0678baef205d358634876ca0` |
| Base commit | `7fa37b78e1acac1e2c7e1692830c1b27c9b571cb` |
| Open PR | [Sqcoot/Archon#3](https://github.com/Sqcoot/Archon/pull/3) |
| Historical supplemental report | External local report used during the 2026-05-21 review; not retained in repo and not used as final evidence for this goal. |
| Missing baseline fields | 0 |

## Inventory Summary

| Metric | Count |
| --- | ---: |
| Initial changed files | 56 |
| Final changed files | 62 |
| Files kept | 58 |
| Files moved | 0 |
| Files removed | 4 |
| Files sanitized | 1 |
| Generated files retained | 7 |
| Generated files removed | 2 |
| Explicit deferrals | 0 |
| Behavior test files added or strengthened | 10 |
| Text-only tests removed or paired with behavior tests | 3 |
| Security scenarios validated | 12 |

## Changed-File Inventory

| Classification | Files |
| --- | --- |
| Product source | `.archon/commands/defaults/goal.md`, `.codex/hooks.json`, `.gitignore`, `packages/cli/src/commands/aco.ts`, `packages/cli/src/commands/context.ts`, `packages/context-orchestrator/src/approval-capsule.ts`, `packages/context-orchestrator/src/bmad.ts`, `packages/context-orchestrator/src/decision-dossier.ts`, `packages/context-orchestrator/src/docs.ts`, `packages/context-orchestrator/src/index.ts`, `packages/context-orchestrator/src/ledgers.ts`, `packages/context-orchestrator/src/schemas/next-decision.ts`, `packages/context-orchestrator/src/status.ts`, `packages/context-orchestrator/src/types.ts`, `packages/core/src/handlers/command-handler.ts`, `packages/server/src/routes/api.ts`, `packages/server/src/routes/schemas/aco.schemas.ts`, `packages/web/src/lib/aco-readiness.ts`, `packages/web/src/routes/AcoStatusPage.tsx`, `scripts/research/render-sdd-scaffold.ts` |
| Product fixture | `packages/context-orchestrator/src/decision-dossier.test.ts`, `packages/context-orchestrator/src/evidence-closure.test.ts`, `packages/context-orchestrator/src/ledgers.test.ts`, `packages/context-orchestrator/src/status.test.ts`, `packages/web/src/lib/aco-readiness.test.ts`, `tests/acceptance/context-orchestrator/ai-layer-bootstrap.acceptance.test.ts`, `tests/acceptance/context-orchestrator/api.acceptance.test.ts`, `tests/acceptance/context-orchestrator/bmad.acceptance.test.ts`, `tests/acceptance/context-orchestrator/docs.acceptance.test.ts`, `tests/acceptance/context-orchestrator/route.acceptance.test.ts` |
| Durable documentation | `.codex/README.md`, `docs/context-orchestrator/baseline.md`, `docs/context-orchestrator/bmad/bmad-method-6-7-sync-review.md`, `docs/context-orchestrator/bmad/project-context.md`, `docs/context-orchestrator/bmad/retrospective.md`, `docs/context-orchestrator/final-validation-report.md`, `docs/context-orchestrator/research/context7-mcp.md`, `docs/context-orchestrator/specs/006-bmad-routing-spec.md`, `docs/context-orchestrator/specs/017-implementation-discovery-protocol.md`, `docs/context-orchestrator/specs/018-release-readiness-spec.md`, `docs/context-orchestrator/specs/030-ai-layer-bootstrap-spec.md`, `docs/context-orchestrator/stabilization/aco-pr-hygiene-report.md`, `docs/context-orchestrator/stabilization/aco-stabilization-scorecard.md`, `docs/context-orchestrator/stabilization/context7-mcp-setup-notes.md`, `packages/docs-web/src/content/docs/book/quick-reference.md`, `packages/docs-web/src/content/docs/book/solidification-review-ledgers.md` |
| Optional template | `.archon/commands/defaults/ai-layer-branch-gate.md`, `.archon/commands/defaults/ai-layer-goal.md`, `.archon/commands/defaults/ai-layer-preflight.md`, `.archon/commands/defaults/ai-layer-stop-gate.md`, `.archon/commands/defaults/ai-layer-study-reference.md` |
| Generated retained | `_bmad/_config/files-manifest.csv`, `_bmad/_config/manifest.yaml`, `_bmad/bmm/config.yaml`, `_bmad/core/config.yaml`, `docs/context-orchestrator/stabilization/aco-stabilization-scorecard.json`, `packages/web/src/lib/api.generated.d.ts`, `packages/workflows/src/defaults/bundled-defaults.generated.ts` |
| Generated removed | `packages/core/tsconfig.tsbuildinfo`, `packages/server/tsconfig.tsbuildinfo` |
| Removed branch-local scaffolding | `.history/scripts/context-orchestrator/BMAD_20260518103326.md`, `.history/scripts/context-orchestrator/BMAD_20260518103327.md` |
| Deferred with reason | None |

## Cleanup Evidence

- `.agents` fixture dependency: `tests/acceptance/context-orchestrator/ai-layer-bootstrap.acceptance.test.ts` now reads committed `.claude` and `.codex` fixtures only.
- Codex `kild` hooks: removed from `.codex/hooks.json`; `.codex/README.md` now states private status integrations must be user-local or opt-in.
- `_bmad-output` MCP artifacts: removed from tracked source. Reusable guidance moved to `docs/context-orchestrator/stabilization/context7-mcp-setup-notes.md` with placeholders only.
- `.history`: branch-local BMAD snapshots removed.
- API acceptance: `tests/acceptance/context-orchestrator/api.acceptance.test.ts` now executes `packages/server/src/routes/api.aco.test.ts` and validates exported request schemas.
- Graph-waiver semantics: final recommendation is `ready_with_approved_graph_waivers`, not plain `ready`.

## Generated Files

| File | Source input | Generator | Drift check | Owner surface |
| --- | --- | --- | --- | --- |
| `_bmad/_config/files-manifest.csv` | BMAD installation inputs | `npx bmad-method install` / BMAD sync flow | `git diff -- _bmad` after BMAD sync | BMAD config |
| `_bmad/_config/manifest.yaml` | BMAD installation inputs | `npx bmad-method install` / BMAD sync flow | `git diff -- _bmad` after BMAD sync | BMAD config |
| `_bmad/bmm/config.yaml` | BMAD installation inputs | `npx bmad-method install` / BMAD sync flow | `git diff -- _bmad` after BMAD sync | BMAD config |
| `_bmad/core/config.yaml` | BMAD installation inputs | `npx bmad-method install` / BMAD sync flow | `git diff -- _bmad` after BMAD sync | BMAD config |
| `docs/context-orchestrator/stabilization/aco-stabilization-scorecard.json` | scorecard markdown and validation evidence | manual scorecard sync for this stabilization slice | `bun run validate` plus reviewer diff | stabilization evidence |
| `packages/web/src/lib/api.generated.d.ts` | server OpenAPI route registrar | in-process OpenAPI document plus `openapi-typescript` | regenerate temp output, prettier, then `diff -u` | API/web contract |
| `packages/workflows/src/defaults/bundled-defaults.generated.ts` | `.archon/commands/defaults/**`, `.archon/workflows/defaults/**` | `bun run generate:bundled` | `bun run check:bundled` | bundled defaults |

## Runtime Readiness And Graph Waivers

`bun run cli context status --cwd . --json "/goal stabilize-aco-merge-ready"`
returns:

- readiness: `needs_approval`
- next decision: `approval_required`
- validation: `passed`
- graph status: `forbidden`
- graph waivers: `graph-waiver.bmad-plugins-marketplace`, `graph-waiver.bmad-sample-data`
- evidence blockers: none

Approval evidence:

- approved by user in this thread at `2026-05-21T17:31:41Z`
- approval contract source: current `bun run cli context status --cwd . --json "/goal stabilize-aco-merge-ready"` output
- contract ID stability: commit-derived; do not pin the approval contract ID in tracked scorecard content because recording approval evidence changes the commit SHA
- scope: preserve `graph-waiver.bmad-plugins-marketplace` and `graph-waiver.bmad-sample-data` for this run only
- non-scope: no graph refresh, waiver cleanup, provider config mutation, or live MCP/Codex/Claude config mutation
- readiness impact: runtime remains `needs_approval`; final reviewer recommendation is `ready_with_approved_graph_waivers`

## Scorecard

| # | Gate | Status | Evidence type | Evidence |
| ---: | --- | --- | --- | --- |
| 1 | Baseline and comparison evidence | pass | validation command | Baseline table records branch, target, merge base, commands, timestamp, counts, head/base commits, PR URL, and supplemental 301-file comparison report. |
| 2 | Changed-file inventory coverage | pass | validation command | 62/62 final changed files are classified exactly once; 0 unclassified files. |
| 3 | Local-assumption removal | pass | code, removal, validation command | Changed-file scan has no retained developer-local `/Users/...` paths; `.history` and local MCP artifacts removed; remaining absolute paths are existing fixtures/examples outside this PR slice. |
| 4 | Provider-default safety | pass | code, removal | Default Codex hooks no longer call `kild`; provider-specific files are classified and do not mutate live config. |
| 5 | Missing dependency and fixture closure | pass | test, validation command | AI-layer acceptance no longer requires ignored `.agents/**`; targeted acceptance tests passed. |
| 6 | Generated-file reproducibility | pass | generated drift check, removal | Bundled defaults regenerated and drift-free; unreproducible tsbuildinfo removed; local `_bmad-output` MCP artifacts removed. |
| 7 | Readiness state contract | pass | code, test | `ready`, `blocked`, `needs_approval`, `needs_decision`, and `unknown` remain implemented and behavior-tested. |
| 8 | Runtime integration truthfulness | pass | code, test | Docs/MCP integrations expose explicit runtime/deferred states and do not assume Context7/OpenAI Docs availability from prompt text. |
| 9 | Behavior-driven test replacement | pass | test | API acceptance now executes server route behavior tests and schema validation; critical text checks are paired with behavior suites. |
| 10 | Security hardening | pass | test | Path traversal, unsafe cwd, artifact boundary, symlink, run ID, redaction, telemetry, approval/dossier, and provider-hook safety are covered by passing suites. |
| 11 | API contract | pass | test, generated drift check | Server ACO route behavior suite passes through acceptance; API generated type drift remains covered by validation. |
| 12 | CLI contract | pass | code, test | ACO/context CLI behavior remains covered by package tests and validation. |
| 13 | Web contract | pass | code, test | Web readiness helpers and page tests cover ready, non-ready, loading, error, and approval-dependent states. |
| 14 | Workflow safety | pass | workflow, validation command | `context-orchestrate` validates; bundled defaults are current; no retained workflow requires private machine state. |
| 15 | Policy gate | pass | test, validation command | Policy fixtures remain covered by `bun run aco:policy` and full validation. |
| 16 | Traceability gate | pass | validation command | Traceability remains mapped and validated by `bun run aco:traceability`. |
| 17 | Telemetry safety | pass | test | Context-orchestrator tests retain telemetry no-leak and safe-degradation coverage. |
| 18 | BMAD routing | pass | code, test | Required routing cases and current BMAD install alignment remain covered; optional/not-installed capabilities are not required. |
| 19 | Graph waiver semantics | pass | validation command, scorecard evidence | Waiver IDs, scope, reason, approval evidence, freshness/expiry condition, runtime impact, and final recommendation label are visible. |
| 20 | Repository-noise cleanup | pass | removal | `.history` snapshots removed; tracked local MCP `_bmad-output` artifacts removed; sanitized reusable Context7 notes retained as durable docs. |
| 21 | Documentation-only gate prevention | pass | scorecard evidence | No hard gate pass is based on documentation alone; every gate cites code, test, workflow, drift check, validation, or removal evidence. |
| 22 | Not-applicable evidence | pass | scorecard evidence | No hard gate is marked `not_applicable`; no risky surface is hidden. |
| 23 | Final validation commands | pass | validation command | Scoped validation passed after edits; full `bun run validate` is the final pre-PR gate for this slice. |
| 24 | Final merge recommendation | pass | scorecard evidence | Final recommendation is exactly `ready_with_approved_graph_waivers` because runtime remains `needs_approval` only for approved graph waivers. |

## Validation Results

| Command | Result | Evidence |
| --- | --- | --- |
| `npx ctx7@latest library Context7 "Context7 MCP setup with API key, environment variable, and npx @upstash/context7-mcp"` | blocked-noncritical | Context7 quota exceeded; readiness unaffected because MCP availability is not assumed. |
| `bun test ./tests/acceptance/context-orchestrator/ai-layer-bootstrap.acceptance.test.ts ./tests/acceptance/context-orchestrator/api.acceptance.test.ts` | pass | 8 acceptance tests passed; API acceptance executes server route behavior suite. |
| `bun run generate:bundled` | pass | Bundled defaults regenerated after `/goal` command update. |
| `bun run check:bundled` | pass | 55 commands and 23 workflows up to date. |
| `bun run cli validate commands goal --json` | pass | `goal` command valid. |
| `bun run cli validate workflows context-orchestrate --json` | pass | Workflow valid. |
| `bun run cli context route --cwd . --json "/goal stabilize-aco-merge-ready"` | pass | BMAD route is deterministic and high-confidence for the slash goal. |
| `bun run cli context status --cwd . --json "/goal stabilize-aco-merge-ready"` | pass-with-waivers | Runtime status is `needs_approval`, validation passed, graph status forbidden, two waiver IDs visible. |
| `bun run validate` | pass | Full pre-PR validation passed after this cleanup pass. |

## Final Recommendation

`ready_with_approved_graph_waivers`

Exact reasons:

1. All 24 hard gates are `pass`; 0 are `fail`, `unknown`, or unevidenced.
2. The PR-specific blockers were resolved: ignored `.agents` fixture dependency, default `kild` hooks, tracked local MCP artifacts, `.history` snapshots, graph-waiver recommendation semantics, and source-string-only API acceptance risk.
3. Runtime ACO readiness remains honestly `needs_approval` only because two approved graph waivers remain active and visible.
4. Approval scope is limited to preserving the listed waivers for this run only; it does not approve graph refresh, waiver cleanup, provider config mutation, or live MCP/Codex/Claude config mutation.
