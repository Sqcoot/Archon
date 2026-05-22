# ACO PR Hygiene Report

Final recommendation: `ready_with_approved_graph_waivers`

## Historical Baseline

This report was generated on 2026-05-21 for an earlier PR review base. It is
retained as historical stabilization evidence only. Final merge-hygiene analysis
for the current cleanup goal uses `origin/dev...HEAD` in
`stab-002-dev-diff-inventory.md`.

- Current branch: `stabilization/stab-002-bmad-method-current-sync`
- Historical target: Earlier PR review base; see Sqcoot/Archon#3.
- Merge base: `7fa37b78e1acac1e2c7e1692830c1b27c9b571cb`
- Historical compare command: Earlier PR-base comparison; not the final merge-hygiene command.
- Historical changed-file command: Earlier PR-base inventory plus untracked files; not the final merge-hygiene inventory.
- Inventory timestamp: `2026-05-21T18:15:12Z`
- Initial changed-file count: 56
- Final changed-file count: 62
- Head commit at inventory generation: `0217724685f1053f0678baef205d358634876ca0`
- Base commit: `7fa37b78e1acac1e2c7e1692830c1b27c9b571cb`
- Open PR: [Sqcoot/Archon#3](https://github.com/Sqcoot/Archon/pull/3)
- Historical supplemental branch comparison: External local report used during the 2026-05-21 review; not retained in repo and not used as final evidence for this goal.

## Hygiene Counts

- Files kept as product source: 20
- Files kept as fixtures/tests: 10
- Files kept as durable docs: 16
- Files moved to optional templates: 5
- Files moved to internal stabilization artifacts: 0
- Files removed as branch-local scaffolding: 2
- Files sanitized into durable docs: 1
- Generated files retained: 7
- Generated files removed: 2
- Explicit deferrals: 0
- Behavior test files added or strengthened: 10
- Text-only tests removed or paired with behavior tests: 3
- Security tests/scenarios added or strengthened: 12

## PR-Specific Cleanup Outcomes

- `.agents` fixture resolution: `tests/acceptance/context-orchestrator/ai-layer-bootstrap.acceptance.test.ts` no longer reads ignored `.agents/skills/scoped-tests/SKILL.md`; it uses committed `.claude` and `.codex` fixtures.
- Codex hook decision: default `kild agent-status` hooks were removed from `.codex/hooks.json`; `.codex/README.md` now requires private status integrations to be user-local or opt-in.
- `_bmad-output` MCP artifact decision: the tracked Context7 MCP proposal and investigation were removed. Reusable, sanitized setup guidance lives at `docs/context-orchestrator/stabilization/context7-mcp-setup-notes.md` with placeholders only.
- `.history` cleanup decision: `.history/scripts/context-orchestrator/BMAD_20260518103326.md` and `.history/scripts/context-orchestrator/BMAD_20260518103327.md` were removed as branch-local snapshots.
- Text-presence test remediation: `tests/acceptance/context-orchestrator/api.acceptance.test.ts` now executes the server ACO route behavior suite and validates exported schemas instead of only scanning source strings.
- Graph-waiver final recommendation semantics: runtime status remains `needs_approval`; the final recommendation is `ready_with_approved_graph_waivers`, not plain `ready`.

## Generated Files

Retained generated files and drift checks:

- `_bmad/_config/files-manifest.csv`: BMAD sync/install artifact; verify with BMAD sync plus `git diff -- _bmad`.
- `_bmad/_config/manifest.yaml`: BMAD sync/install artifact; verify with BMAD sync plus `git diff -- _bmad`.
- `_bmad/bmm/config.yaml`: BMAD config artifact; verify with BMAD sync plus `git diff -- _bmad`.
- `_bmad/core/config.yaml`: BMAD config artifact; verify with BMAD sync plus `git diff -- _bmad`.
- `docs/context-orchestrator/stabilization/aco-stabilization-scorecard.json`: scorecard JSON companion; verify by reviewing against the markdown scorecard and `bun run validate`.
- `packages/web/src/lib/api.generated.d.ts`: regenerated from the server OpenAPI document; verified by temp regeneration plus `diff -u`.
- `packages/workflows/src/defaults/bundled-defaults.generated.ts`: regenerated with `bun run generate:bundled`; verified with `bun run check:bundled`.

Removed generated or local artifacts:

- `packages/core/tsconfig.tsbuildinfo`
- `packages/server/tsconfig.tsbuildinfo`
- `_bmad-output/implementation-artifacts/context7-mcp-key/proposed/context7-mcp-config-proposal.md`
- `_bmad-output/implementation-artifacts/investigations/context7-mcp-key-investigation.md`

## Provider-Specific Files

Retained provider-specific files:

- `.codex/hooks.json`: product default hook config; now only runs the repository task-list verifier and no private local status command.
- `.codex/README.md`: durable provider guidance; records the no-private-default-hooks rule.
- `.archon/commands/defaults/ai-layer-*.md`: optional command templates; parameterized and non-mutating by default.
- `.claude/**` and `.codex/agents/**`: retained provider agent/skill fixtures are classified as optional provider support or committed fixtures where tests reference them.

Removed or made optional:

- Default `kild` hooks removed.
- Live MCP/Claude/Codex config mutation remains out of scope unless separately approved.
- Ignored `.agents/**` content is not required for validation success.

## Validation

Commands run and passing:

- `bun test ./tests/acceptance/context-orchestrator/ai-layer-bootstrap.acceptance.test.ts ./tests/acceptance/context-orchestrator/api.acceptance.test.ts`
- `bun run generate:bundled`
- `bun run check:bundled`
- `bun run cli validate commands goal --json`
- `bun run cli validate workflows context-orchestrate --json`
- `bun run cli context route --cwd . --json "/goal stabilize-aco-merge-ready"`
- `bun run cli context status --cwd . --json "/goal stabilize-aco-merge-ready"`
- `bun run validate`

Command blocked:

- `npx ctx7@latest library Context7 "Context7 MCP setup with API key, environment variable, and npx @upstash/context7-mcp"` was blocked by Context7 monthly quota exhaustion. This is noncritical because ACO does not assume Context7 MCP availability; it reports Context7 as runtime-verified, deferred, unknown, or not configured.

## Remaining Risks

- Runtime ACO status still reports `needs_approval` while graph evidence is forbidden; this is intentional so the waivers stay visible.
- The user approved preserving `graph-waiver.bmad-plugins-marketplace` and `graph-waiver.bmad-sample-data` for this run only.
- Approval does not authorize graph refresh, waiver cleanup, provider config mutation, live MCP config mutation, or live Codex/Claude config mutation.

## Final Recommendation

`ready_with_approved_graph_waivers`

Exact reasons:

1. All hard gates are pass/not-applicable with evidence; no hard gates are failed or unknown.
2. Full local validation passed, including `bun run validate`.
3. PR-specific cleanup blockers were resolved: ignored `.agents` fixture dependency, default `kild` hooks, tracked local MCP artifacts, `.history` snapshots, plain-ready graph-waiver semantics, and source-string-only API acceptance.
4. Runtime remains `needs_approval` only because the two approved graph waivers remain active and visible to reviewers.
