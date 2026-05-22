# STAB-002 Cleanup Decision Ledger

Timestamp: 2026-05-22T18:49:36Z
Baseline: `origin/dev...HEAD`

## Phase 11 Pre-Edit Dry-Run Plan

### Planned safe edits

1. In-place cleanup of older stabilization evidence:
   - `docs/context-orchestrator/stabilization/aco-stabilization-scorecard.md`
   - `docs/context-orchestrator/stabilization/aco-stabilization-scorecard.json`
   - `docs/context-orchestrator/stabilization/aco-pr-hygiene-report.md`

   Planned changes:
   - Replace the machine-local supplemental report path with historical wording that does not point to one contributor's machine.
   - Mark the earlier non-`origin/dev` PR review comparison as historical/non-final evidence.
   - Preserve the old report content as stabilization history; do not present it as final merge evidence.

2. Leave `packages/core/tsconfig.tsbuildinfo` and `packages/server/tsconfig.tsbuildinfo` deleted.

3. Update this ledger, the matrix, state file, checkpoint log, and validation report after cleanup.

### Planned moves

None in the safe cleanup batch.

Rationale: Phase 8 reference checks found live references for all move candidates:

- `docs/ai/stab-002-validation-report.md`
- `docs/ai/stab-002-runtime-validation-report.md`
- `docs/ai/goals/stab-002-runtime-enforcement.goal.md`
- `.archon/workflows/defaults/archon-ai-layer-bootstrap.yaml`
- `.archon/commands/defaults/ai-layer-*`
- `.archon/commands/defaults/goal.md`
- `.archon/commands/defaults/solidify-poc.md`
- `.codex/**`
- `.claude/agents/ai-layer-explorer.md`
- `.claude/skills/scoped-tests/SKILL.md`

### Planned removals

None in this cleanup batch.

Already present in branch diff:

- `packages/core/tsconfig.tsbuildinfo` removed from tracked source
- `packages/server/tsconfig.tsbuildinfo` removed from tracked source

### Files requiring human decision

- `.codex` project hooks and agents shipping to `dev`
- `.claude` settings/hooks and changed agent/skill defaults shipping to `dev`
- Required vs path-scoped ACO policy/OPA in CI
- BMAD advisory/mapped status vs native Archon workflows
- Mirroring `.agents/skills/bmad-*` into `.claude/skills`
- Branch-specific `/goal` command default status
- `ai-layer-*` command default status
- `archon-ai-layer-bootstrap` default workflow status
- `archon-aco-adversarial-loop` default workflow status
- `solidify-poc` default command status
- Whether old STAB reports under `docs/ai` should move after updating references
- Generated research retention/pruning
- Graph waiver refresh/removal
- Repo-local MCP template policy
- Exact workflow counts in README
- Whether this branch should split into multiple PRs
- DRI ownership for AI governance/BMAD/hooks after merge

### Validation required after each batch

Batch 1: stabilization report wording cleanup.

Required checks:

- Fixed-string search for the original machine-local supplemental report path in `docs/context-orchestrator/stabilization` and `docs/ai`.
- Fixed-string search for the original earlier PR review branch in `docs/context-orchestrator/stabilization` and `docs/ai`.
- `git diff --check`

No bundled default regeneration is required because this batch does not change `.archon/commands/defaults/**` or `.archon/workflows/defaults/**`.

Later final ladder still required:

- `bun run cli workflow list --cwd . --json`
- `bun run cli validate workflows --cwd .`
- `bun run cli validate commands --cwd .`
- `bun run check:bundled`
- `bun run check:bundled-skill`
- `bun run aco:traceability`
- `bun run format:check`
- `bun run validate`
- `git diff --check`

### Rollback plan

- Revert only the edited stabilization evidence files if wording cleanup is incorrect.
- If validation reveals a report is still relied on as final evidence, keep the file but add a clearer historical label rather than moving/removing it.
- If local path replacement obscures useful evidence, replace it with a repo-relative historical note instead of restoring an absolute path.
- Do not restore `tsconfig.tsbuildinfo` unless a validation command proves the build cache is required, which is not expected.

## No-Progress Entries

None.

## Phase 12 Batch 1 Execution

Timestamp: 2026-05-22T18:53:45Z

Files edited:

- `docs/context-orchestrator/stabilization/aco-stabilization-scorecard.md`
- `docs/context-orchestrator/stabilization/aco-stabilization-scorecard.json`
- `docs/context-orchestrator/stabilization/aco-pr-hygiene-report.md`
- `docs/context-orchestrator/stabilization/stab-002-file-analysis-matrix.md`
- `docs/context-orchestrator/stabilization/stab-002-keep-move-remove-split-matrix.md`
- `docs/context-orchestrator/stabilization/stab-002-cleanup-decision-ledger.md`

Action taken:

- Added historical baseline labels to the two older markdown stabilization reports.
- Replaced the old machine-local supplemental report reference with non-local historical wording.
- Replaced the earlier non-`origin/dev` PR review commands with historical/non-final wording.
- Updated the JSON scorecard baseline to identify the historical PR-review context without retaining the local path.
- Updated the analysis matrix and keep/move/remove/split matrix to record the batch action.

Validation:

- Original machine-local supplemental report path search in `docs/context-orchestrator/stabilization` and `docs/ai`: pass, no hits.
- Original earlier PR review branch search in `docs/context-orchestrator/stabilization` and `docs/ai`: pass, no hits.
- `git diff --check`: pass.
- `jq empty docs/context-orchestrator/stabilization/aco-stabilization-scorecard.json`: pass.

Rollback plan:

- Revert only the three stabilization report edits if the historical wording needs adjustment, then rerun the four targeted checks above.

## Phase 13 Post-Cleanup Reconciliation

Timestamp: 2026-05-22T18:54:48Z

Commands run:

- `git diff --name-only origin/dev...HEAD > /tmp/stab-002-after-cleanup-files.txt`
- `git diff --shortstat origin/dev...HEAD`
- `git diff --stat origin/dev...HEAD`
- `git diff --dirstat=files,10,cumulative origin/dev...HEAD`
- `git status --short`
- Node coverage check comparing `/tmp/stab-002-after-cleanup-files.txt` with the inventory and keep/move/remove/split matrix.

Results:

- Post-cleanup committed branch diff still contains 367 files, matching the Phase 3 inventory.
- Shortstat remains `367 files changed, 43318 insertions(+), 1249 deletions(-)`.
- Inventory coverage check: 0 missing paths.
- Matrix coverage check: 0 missing paths.
- The safe cleanup edits are uncommitted workspace modifications to three already changed stabilization reports; the new goal artifacts are untracked workspace artifacts and are not part of `origin/dev...HEAD` until intentionally added later.
- No moved files require link reconciliation in this batch.

## Phase 15 Optional No-Edit Workflow Smoke Decision

Timestamp: 2026-05-22T18:59:38Z

Decision: skipped.

Reason:

- The workspace contains uncommitted goal/report artifacts and three edited stabilization reports.
- `archon-assist --no-worktree` is intended to be read-only with the requested prompt, but it can still invoke provider execution in the current checkout.
- The safer validation surface for this merge-hygiene goal is schema/discovery validation, which already passed through `bun run cli workflow list --cwd . --json`, `bun run cli validate workflows --cwd .`, and duplicate installed `archon` validation.

No workflow execution was run in Phase 15.

## Human Decision Queue

Timestamp: 2026-05-22T19:02:00Z

### 1. Should `.codex` project hooks ship to `dev`?

Question: Should `.codex/hooks.json` and `.codex/hooks/verify-task-list.sh` remain project defaults?
Why it matters: Project hooks execute in contributor environments and can surprise users if they call private tools or trust unsafe input.
Options: keep as default; move to example docs; require opt-in config only.
Recommended default: keep with note, because the hook is limited to `SessionStart`, validates `CODEX_TASK_LIST_ID`, constrains path traversal, and does not call private local tools by default.
Risk: medium contributor-experience risk if future hooks expand beyond the current verifier.
Files affected: `.codex/hooks.json`, `.codex/hooks/verify-task-list.sh`, `.codex/README.md`, `.codex/agents/**`.
Evidence: Phase 7/8 hook inspection and acceptance references; command/workflow validation passed.

### 2. Should Claude hooks/settings ship as project defaults?

Question: Should `.claude/settings.json` hook behavior be treated as a project default for all contributors?
Why it matters: Existing Claude settings include private/local `kild agent-status` commands, which are not safe as universal contributor defaults.
Options: keep existing behavior; move private hooks to local settings/example docs; split into later trust-policy PR.
Recommended default: require human decision before merge; do not broaden or edit without explicit approval.
Risk: high contributor trust risk if private local commands run unexpectedly.
Files affected: `.claude/settings.json`, `.claude/agents/ai-layer-explorer.md`, `.claude/skills/scoped-tests/SKILL.md`.
Evidence: Phase 7 Claude hook inspection found private/local commands; no cleanup edit was approved.

### 3. Should ACO policy/OPA be required in main CI or path-scoped?

Question: Should `.github/workflows/test.yml` keep ACO policy and traceability as required main CI gates?
Why it matters: Global gates protect ACO traceability but can slow or block unrelated contributor work.
Options: keep global required gate; make path-scoped; run advisory only.
Recommended default: keep for this branch unless release owner decides to path-scope in a follow-up PR, because `bun run aco:policy`, `bun run aco:policy:test`, and `bun run aco:traceability` pass.
Risk: medium CI ownership risk.
Files affected: `.github/workflows/test.yml`, `package.json`, `scripts/policy/**`, `scripts/context-orchestrator/validate-traceability.ts`, `packages/context-orchestrator/policies/**`.
Evidence: Phase 14 validation passed; CI policy scope remains policy-sensitive.

### 4. Should BMAD remain mapped/advisory or become native Archon workflows?

Question: Should this merge add native BMAD workflows, or keep BMAD as advisory/mapped assets?
Why it matters: Native workflows increase product surface and validation obligations.
Options: keep advisory/mapped; add native workflows now; split native workflow work to later PR.
Recommended default: keep BMAD advisory/mapped for this merge and defer native workflows.
Risk: medium scope risk if native BMAD workflows are added during cleanup.
Files affected: `_bmad/**`, `.agents/skills/bmad-*`, `docs/ai/bmad-to-archon-mapping.md`.
Evidence: Phase 5/7 BMAD discovery found tracked sync assets and ignored user configs; no BMAD-specific package scripts exist.

### 5. Should `.agents/skills/bmad-*` be mirrored into `.claude/skills`?

Question: Should BMAD skills be copied into Claude project skills as part of this branch?
Why it matters: Mirroring would add a large second provider-specific surface and new maintenance expectations.
Options: do not mirror; mirror selected skills; split mirroring to later PR.
Recommended default: do not mirror in this cleanup; record as future work.
Risk: medium duplication and drift risk.
Files affected: `.agents/skills/bmad-*`, `.claude/skills/**`.
Evidence: Phase 7 found `.agents` BMAD skills referenced by mapping docs; no direct validation requires Claude mirrors.

### 6. Should branch-specific `/goal` commands ship as defaults?

Question: Should `.archon/commands/defaults/goal.md` remain a bundled default command?
Why it matters: It is branch-specific by wording but referenced by code, tests, reports, and generated defaults.
Options: keep; move to stabilization docs; split replacement/default design to later PR.
Recommended default: keep for this branch with note, then decide product naming in a follow-up PR.
Risk: medium product-surface risk.
Files affected: `.archon/commands/defaults/goal.md`, `packages/context-orchestrator/src/bmad.ts`, tests, generated defaults.
Evidence: Phase 8 reference checks found live references; command validation passed.

### 7. Should `ai-layer-*` commands ship as defaults?

Question: Should `.archon/commands/defaults/ai-layer-*.md` remain default commands?
Why it matters: They may be bootstrap/stabilization scaffolding, but moving them independently breaks references.
Options: keep as defaults; move as a coordinated later PR; convert to examples.
Recommended default: keep for this branch with human signoff; any move requires coordinated workflow/docs/tests/bundle updates.
Risk: medium default-command bloat risk.
Files affected: `.archon/commands/defaults/ai-layer-*.md`, `archon-ai-layer-bootstrap`, generated defaults, tests, docs-web.
Evidence: Phase 8 reference checks found workflow, docs, test, and generated-default references; command validation passed.

### 8. Should `archon-ai-layer-bootstrap` ship as a default workflow?

Question: Should `.archon/workflows/defaults/archon-ai-layer-bootstrap.yaml` remain in defaults?
Why it matters: It is bootstrap-oriented but validated and strongly referenced.
Options: keep; move to examples/stabilization; split workflow decision to later PR.
Recommended default: require human decision; do not move in this cleanup because references are live.
Risk: medium to high product-surface risk.
Files affected: `.archon/workflows/defaults/archon-ai-layer-bootstrap.yaml`, `ai-layer-*` commands, generated defaults, docs, tests.
Evidence: Phase 8 reference checks and workflow validation.

### 9. Should `context-orchestrate` ship as a default workflow?

Question: Should `.archon/workflows/defaults/context-orchestrate.yaml` remain in defaults?
Why it matters: It is the ACO product workflow surface.
Options: keep; move; split.
Recommended default: keep.
Risk: high product regression risk if moved.
Files affected: `.archon/workflows/defaults/context-orchestrate.yaml`, CLI route docs/tests, generated defaults.
Evidence: Phase 8 found strong product/test/traceability references; workflow validation passed.

### 10. Should `archon-aco-adversarial-loop` ship as a default workflow?

Question: Should `.archon/workflows/defaults/archon-aco-adversarial-loop.yaml` remain in defaults?
Why it matters: It is ACO/product-quality oriented but expands the default workflow surface.
Options: keep with note; move to examples; split to later PR.
Recommended default: keep with note if release owner accepts the product-quality workflow; otherwise split to later PR with coordinated reference updates.
Risk: medium default-surface risk.
Files affected: `.archon/workflows/defaults/archon-aco-adversarial-loop.yaml`, docs/spec 028, traceability, generated defaults, acceptance tests.
Evidence: Phase 8 found tests/specs/docs/generated-default references; workflow validation passed.

### 11. Should STAB-specific validation reports remain under `docs/ai` or move to stabilization/history?

Question: Should older STAB validation reports under `docs/ai` stay as AI governance evidence?
Why it matters: `docs/ai` should remain evergreen where possible, while branch-specific evidence can bloat future context.
Options: keep under `docs/ai`; move to stabilization/history; split link migration later.
Recommended default: keep now because reference checks found root instructions, CODEBASE_MAP, CLAUDE, and governance docs links; move only in a coordinated docs PR.
Risk: medium documentation churn risk.
Files affected: `docs/ai/stab-002-validation-report.md`, `docs/ai/stab-002-runtime-validation-report.md`, `docs/ai/goals/stab-002-runtime-enforcement.goal.md`.
Evidence: Phase 8 reference checks found live references.

### 12. Should generated research reports be retained, pruned, or moved?

Question: Should `docs/context-orchestrator/research/**` remain tracked in this branch?
Why it matters: Research evidence improves traceability but can pollute context.
Options: retain all; prune unreferenced; move selected reports to history.
Recommended default: retain for this merge; Phase 7 basename search found references for all research files.
Risk: medium context-size risk.
Files affected: `docs/context-orchestrator/research/**`.
Evidence: Phase 7 research evidence bloat pass; graph refresh and waiver cleanup were not approved.

### 13. Should graph waivers remain, be refreshed, or require approval?

Question: Should active graph waivers be preserved, refreshed, or removed?
Why it matters: Graph refresh/waiver cleanup can change ACO readiness semantics and was explicitly out of scope.
Options: preserve current waivers; refresh graph; remove waivers.
Recommended default: preserve current waivers; require explicit approval for refresh or cleanup.
Risk: high traceability/readiness risk.
Files affected: graph evidence docs and ACO status/ledger surfaces.
Evidence: Root instructions require preserving active Context Orchestrator graph waivers unless approved; validation passed without refresh.

### 14. Should repo-local MCP templates exist?

Question: Should Archon add repo-local `.archon/mcp/*.json` templates in this merge?
Why it matters: Live MCP config can imply secrets, accounts, or environment-specific setup.
Options: no live configs; add `.example.json`; add docs only.
Recommended default: keep docs/illustrative references only; do not add live MCP configs.
Risk: medium secrets/config risk.
Files affected: `.archon/mcp/**`, `docs/**`, workflow MCP references.
Evidence: Phase 7 found no live MCP config; workflow warning is optional and guarded.

### 15. Should README include exact workflow counts?

Question: Should README state exact workflow counts for this branch?
Why it matters: Counts drift across bundled/home/repo/test/internal discovery surfaces.
Options: exact counts; durable wording; CLI command for current count.
Recommended default: keep durable wording and point users to `bun run cli workflow list --cwd .`.
Risk: low docs drift risk.
Files affected: `README.md`, docs workflow references.
Evidence: Phase 7 count drift check found README already avoids brittle exact counts.

### 16. Should this branch be split into multiple PRs?

Question: Should STAB-002 merge as one PR or be split by concern?
Why it matters: The branch changes product code, ACO specs, BMAD assets, hooks/config, CI/policy, commands/workflows, and evidence docs.
Options: merge as one with explicit acceptance evidence; split by surface; defer sensitive surfaces.
Recommended default: split only if reviewers cannot approve trust-sensitive defaults and CI policy in one review. Otherwise merge as one ACO stabilization slice with this evidence packet.
Risk: high reviewability risk if merged without owner signoff.
Files affected: full 367-file branch diff plus goal artifacts.
Evidence: Phase 3 inventory and Phase 18 split recommendation.

### 17. Who is DRI for AI governance/BMAD mapping/hooks after merge?

Question: Who owns AI governance docs, BMAD mapping, Codex/Claude hook defaults, and ACO policy after merge?
Why it matters: These surfaces need ongoing review as provider behavior and workflow defaults evolve.
Options: single AI-governance DRI; split by platform owners; defer ownership.
Recommended default: assign an AI governance DRI plus package owners for hooks/provider defaults before merge.
Risk: medium maintenance risk.
Files affected: `docs/ai/**`, `.codex/**`, `.claude/**`, `_bmad/**`, `.agents/**`, `.archon/**`.
Evidence: Branch adds/changes governance, workflow, hooks, and BMAD assets across multiple ownership boundaries.

## Phase 18 PR Split Recommendation

Timestamp: 2026-05-22T19:03:20Z

Overall recommendation: this can merge as one ACO stabilization PR only if reviewers explicitly accept the trust-sensitive default hooks/config, branch/default command surfaces, workflow defaults, and CI/OPA policy scope. If that signoff is not available, split the branch before merge.

### 1. General Archon fixes

Files/directories included: `packages/adapters/**`, `packages/core/**`, `packages/git/**`, `packages/providers/**`, shared `AGENTS.md`/`CLAUDE.md` package-local docs.
Validation proof: `bun run validate` and `bun run test` passed; package typecheck/lint/test ran through validate.
Merge risk: medium, because changes span provider/core/adapters surfaces.
Should be included now: yes, if reviewed with package owners.

### 2. ACO/context-orchestrator product slice

Files/directories included: `packages/context-orchestrator/**`, `packages/cli/src/commands/aco.ts`, `packages/cli/src/commands/context.ts`, `packages/server/src/routes/api.ts`, `packages/server/src/routes/schemas/aco.schemas.ts`, `packages/web/src/lib/aco-*`, `packages/web/src/routes/AcoStatusPage.tsx`, `tests/acceptance/context-orchestrator/**`, `docs/context-orchestrator/specs/**`.
Validation proof: `bun run aco:traceability`, `bun run aco:policy`, `bun run aco:policy:test`, `bun run validate`, and `bun run test` passed.
Merge risk: medium to high, because this is the largest product surface but is well covered.
Should be included now: yes.

### 3. BMAD sync assets

Files/directories included: `_bmad/**`, `.agents/skills/bmad-*`, `docs/ai/bmad-to-archon-mapping.md`, `docs/context-orchestrator/bmad/**`.
Validation proof: BMAD references inspected; no BMAD-specific package scripts exist; full validation passed.
Merge risk: medium, because sync/generated/user-local boundaries need owner signoff.
Should be included now: yes with note, unless reviewer requires a separate BMAD sync PR.

### 4. AI governance docs

Files/directories included: `docs/ai/**`, `CODEBASE_MAP.md`, `AGENTS.md`, `CLAUDE.md`.
Validation proof: references inspected; full validation passed; this cleanup report and decision ledger document branch-specific evidence.
Merge risk: medium, because some STAB reports are branch-specific but live-referenced.
Should be included now: yes, with follow-up to prune/move historical reports after links are updated.

### 5. Codex/Claude/agent config and hooks

Files/directories included: `.codex/**`, `.claude/agents/ai-layer-explorer.md`, `.claude/skills/scoped-tests/SKILL.md`, existing `.claude/settings.json` policy context.
Validation proof: hook/config inspection completed; Codex hook safety was inspected; acceptance and full validation passed.
Merge risk: high, because hooks and agent defaults affect contributor trust.
Should be included now: human decision required.

### 6. Stabilization evidence

Files/directories included: `docs/context-orchestrator/stabilization/**`, including this goal evidence packet and older ACO scorecard/hygiene reports.
Validation proof: Batch 1 targeted cleanup passed; inventory/matrix coverage passed; final validation passed.
Merge risk: low to medium, mostly context bloat and historical-evidence clarity.
Should be included now: yes, because it is the proof package for the branch.

### 7. CI/policy changes

Files/directories included: `.github/workflows/test.yml`, `package.json`, `scripts/policy/**`, `packages/context-orchestrator/policies/**`.
Validation proof: `bun run aco:policy`, `bun run aco:policy:test`, `bun run aco:traceability`, and `bun run validate` passed.
Merge risk: medium to high, because required CI gates affect all contributors.
Should be included now: human decision required for global vs path-scoped gate.

### 8. Default workflows and commands

Files/directories included: `.archon/workflows/defaults/**`, `.archon/commands/defaults/**`, `.archon/scripts/**`, `packages/workflows/src/defaults/bundled-defaults.generated.ts`.
Validation proof: `bun run generate:bundled`, `bun run check:bundled`, `bun run check:bundled-skill`, `bun run cli validate workflows --cwd .`, `bun run cli validate commands --cwd .`, and duplicate installed `archon` validations passed.
Merge risk: high for branch/bootstrap defaults, medium for product workflows.
Should be included now: keep `context-orchestrate`; require human signoff for `archon-ai-layer-bootstrap`, `ai-layer-*`, `/goal`, `solidify-poc`, and `archon-aco-adversarial-loop`.
