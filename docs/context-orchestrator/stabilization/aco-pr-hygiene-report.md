# ACO PR Hygiene Report

Final recommendation: `needs_approval`

## Baseline

- Current branch: `stabilization/stab-002-bmad-method-current-sync`
- Target branch: `sqcoot/stabilization/stab-002-sdd-atdd-alignment-upstream-dev`
- Merge base: `7fa37b78e1acac1e2c7e1692830c1b27c9b571cb`
- Compare command: `git diff --name-status sqcoot/stabilization/stab-002-sdd-atdd-alignment-upstream-dev...HEAD`
- Changed-file command: `git diff --name-status 7fa37b78e1acac1e2c7e1692830c1b27c9b571cb`
- Inventory timestamp: `2026-05-21T17:21:51Z`
- Initial changed-file count: 18
- Final changed-file count: 56
- Open PR: [Sqcoot/Archon#3](https://github.com/Sqcoot/Archon/pull/3)

## Hygiene Counts

- Files kept as product source: 19
- Files kept as fixtures/tests: 8
- Files kept as durable docs: 14
- Files moved to optional templates: 5
- Files moved to internal stabilization artifacts: 2
- Files removed as branch-local generated noise: 2
- Generated files retained: 6
- Generated files removed: 2
- Explicit deferrals: 0

## Provider-Specific Files

Retained provider-specific defaults are limited to optional AI-layer command templates:

- `.archon/commands/defaults/ai-layer-branch-gate.md`
- `.archon/commands/defaults/ai-layer-goal.md`
- `.archon/commands/defaults/ai-layer-preflight.md`
- `.archon/commands/defaults/ai-layer-stop-gate.md`
- `.archon/commands/defaults/ai-layer-study-reference.md`

Reason retained: these are bundled optional command templates. They now use environment variables, current checkout context, or explicit `not_configured` stop states instead of one developer's local paths or branch names. They do not mutate live Codex, Claude, MCP, or local provider config by default.

## Generated Files

Retained generated files and drift checks:

- `_bmad/_config/files-manifest.csv`: BMAD sync/install artifact; verify with BMAD sync plus `git diff -- _bmad`.
- `_bmad/_config/manifest.yaml`: BMAD sync/install artifact; verify with BMAD sync plus `git diff -- _bmad`.
- `_bmad/bmm/config.yaml`: BMAD config artifact; verify with BMAD sync plus `git diff -- _bmad`.
- `_bmad/core/config.yaml`: BMAD config artifact; verify with BMAD sync plus `git diff -- _bmad`.
- `packages/web/src/lib/api.generated.d.ts`: regenerated from the server OpenAPI document; verified by temp regeneration plus `diff -u`.
- `packages/workflows/src/defaults/bundled-defaults.generated.ts`: regenerated with `bun run generate:bundled`; verified with `bun run check:bundled`.

Removed generated files:

- `packages/core/tsconfig.tsbuildinfo`
- `packages/server/tsconfig.tsbuildinfo`

## Ignored Local Outputs

`.gitignore` now ignores `_bmad-output/` for generated local BMAD/planning output. These ignored local files are not part of the PR changed-file inventory:

- `_bmad-output/implementation-artifacts/investigations/coresee-media-upload-limit-investigation.md`
- `_bmad-output/implementation-artifacts/investigations/outlook-location-removal-resurrection-investigation.md`
- `_bmad-output/implementation-artifacts/spec-stable-outlook-location-detach.md`
- `_bmad-output/planning-artifacts/research/technical-officejs-location-field-stable-solution-research-2026-05-21.md`
- `_bmad-output/planning-artifacts/research/technical-uppy-large-folder-upload-research-2026-05-21.md`

Readiness impact: no merge-readiness blocker. Existing tracked `_bmad-output` artifacts remain tracked and classified as internal stabilization artifacts.

## Validation

Commands run and passing:

- `bun install --frozen-lockfile`
- `bun run type-check`
- `bun run lint --max-warnings 0`
- `bun run test`
- `bun --filter @archon/context-orchestrator test`
- `bun test ./packages/server/src/routes/api.aco.test.ts`
- `bun test ./packages/cli/src/commands/aco.test.ts ./packages/cli/src/commands/context.test.ts`
- `bun test ./packages/web/src/lib/aco-readiness.test.ts ./packages/web/src/routes/AcoStatusPage.test.ts`
- `bun run build:web`
- in-process OpenAPI generation plus `openapi-typescript` temp diff
- `bun run generate:bundled`
- `bun run check:bundled`
- `bun run check:bundled-skill`
- `bun run aco:policy`
- `bun run aco:traceability`
- `bun run aco:test:acceptance`
- `bun run validate:ts-navigation`
- `bun run cli validate commands goal --json`
- `bun run cli validate workflows context-orchestrate --json`
- `bun run format:check`
- `bun run validate`
- `bun run cli context route --cwd . --json "/goal stabilize-aco-merge-ready"`
- `bun run cli context status --cwd . --json "/goal stabilize-aco-merge-ready"`

Commands blocked or failing:

- None.

## Remaining Risks

- The branch cannot be declared `ready` while the ACO runtime status is `needs_approval`.
- Current graph waivers are deliberately preserved and require explicit reviewer approval or approved graph refresh.
- The scorecard is intentionally conservative: graph-waiver approval is still required before a ready merge recommendation.

## Final Recommendation

`needs_approval`

Exact reasons:

1. ACO runtime readiness is `needs_approval` for `/goal stabilize-aco-merge-ready`.
2. Graph waiver approvals remain required for `graph-waiver.bmad-plugins-marketplace` and `graph-waiver.bmad-sample-data`.
