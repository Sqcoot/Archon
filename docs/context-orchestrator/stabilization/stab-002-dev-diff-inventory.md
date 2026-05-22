# STAB-002 Dev Diff Inventory

## Phase 1 Preflight

Timestamp: 2026-05-22T18:27:19Z

Baseline command policy: final merge analysis uses `git diff origin/dev...HEAD`.

Branch: `stabilization/stab-002-bmad-method-current-sync`

Remotes:

```txt
fork    https://github.com/edamlmmv/Archon.git
origin  https://github.com/edamlmmv/Archon.git
sqcoot  https://github.com/Sqcoot/Archon.git
upstream https://github.com/coleam00/Archon.git
```

origin/dev commit: `7bdf931aad5adecc862c30f54584ede8d8c86a21`

merge base: `7bdf931aad5adecc862c30f54584ede8d8c86a21`

HEAD commit: `4be5764ed516ac4fca88dc447af0d847f2f9e2f2`

commit count: `56`

changed file count: `367`

shortstat:

```txt
367 files changed, 43318 insertions(+), 1249 deletions(-)
```

top changed directories:

```txt
23.9% docs/context-orchestrator/
28.0% docs/
11.1% packages/context-orchestrator/src/
14.7% packages/context-orchestrator/
41.1% packages/
```

Recent branch commits:

```txt
4be5764e (HEAD -> stabilization/stab-002-bmad-method-current-sync, sqcoot/stabilization/stab-002-bmad-method-current-sync) docs(ai): add runtime enforcement v1
60dd4e18 (origin/stabilization/stab-002-bmad-method-current-sync, fork/stabilization/stab-002-bmad-method-current-sync) docs: operationalize agentic coding guide
4d930589 docs: add agentic coding operating guide
daa793bf Resolve ACO PR hygiene blockers
02177246 Record ACO waiver approval
10ded6eb Stabilize ACO readiness slice
58752cae wip
ad799004 fix(aco): align BMAD route with current install
2d909d52 chore(bmad): sync BMAD Method installation
7fa37b78 Add AI layer bootstrap workflow
```

Uncommitted worktree status at preflight:

```txt
?? docs/ai/goals/stab-002-phase-gated-cleanup-and-verification.goal.md
?? docs/context-orchestrator/stabilization/stab-002-checkpoint-log.md
?? docs/context-orchestrator/stabilization/stab-002-goal-state.md
```

Note: uncommitted files above were created for this Evidence-Locked Checkpoint Loop run before Phase 1 recording. They are not included in `git diff origin/dev...HEAD` because they are not committed to HEAD.

## Diff Shape

High-volume buckets from `git diff --stat origin/dev...HEAD`:

```txt
.archon/commands/defaults/ai-layer-*.md: 17 added files, branch/bootstrap command candidates
.archon/commands/defaults/goal.md: added, 186 lines
.archon/workflows/defaults/archon-aco-adversarial-loop.yaml: added, 356 lines
.archon/workflows/defaults/archon-ai-layer-bootstrap.yaml: added, 101 lines
.archon/workflows/defaults/context-orchestrate.yaml: added, 188 lines
.codex/: added README, agents, hooks.json, hook script
_bmad/: added config, manifests, module metadata, scripts
docs/ai/: added governance, BMAD mapping, validation, runtime-enforcement docs
docs/context-orchestrator/: added ADRs, BMAD docs, research, specs, stabilization evidence
packages/context-orchestrator/: added package, implementation, policy, fixtures, tests
tests/acceptance/context-orchestrator/: added acceptance coverage
```

Full path inventory is deferred to Phase 3 so each changed path can be classified, reference-checked, and assigned a cleanup decision.

## Commands Run

```txt
git status --short
git branch --show-current
git remote -v
git fetch origin
git rev-parse --verify origin/dev
git merge-base origin/dev HEAD
git rev-parse HEAD
git log --oneline --decorate --max-count=10
git log --oneline --decorate origin/dev..HEAD | wc -l
git diff --shortstat origin/dev...HEAD
git diff --stat origin/dev...HEAD
git diff --dirstat=files,10,cumulative origin/dev...HEAD
git diff --name-status origin/dev...HEAD
git diff --numstat origin/dev...HEAD
git diff --name-only origin/dev...HEAD
```

## Phase 3 Exact Changed-File Inventory

Timestamp: 2026-05-22T18:30:23Z

Source commands: `git diff --name-status origin/dev...HEAD`; `git diff --numstat origin/dev...HEAD`; `git diff --summary origin/dev...HEAD`; `git diff --name-only origin/dev...HEAD`.

Changed paths parsed: 367

Name-only coverage: pass (367 paths from name-only).

Summary output:

```txt
create mode 100644 .archon/commands/defaults/ai-layer-audit.md
 create mode 100644 .archon/commands/defaults/ai-layer-branch-gate.md
 create mode 100644 .archon/commands/defaults/ai-layer-completion-audit.md
 create mode 100644 .archon/commands/defaults/ai-layer-design-lsp-navigation.md
 create mode 100644 .archon/commands/defaults/ai-layer-design.md
 create mode 100644 .archon/commands/defaults/ai-layer-endgoal-gate.md
 create mode 100644 .archon/commands/defaults/ai-layer-goal.md
 create mode 100644 .archon/commands/defaults/ai-layer-implement.md
 create mode 100644 .archon/commands/defaults/ai-layer-map-codebase.md
 create mode 100644 .archon/commands/defaults/ai-layer-preflight.md
 create mode 100644 .archon/commands/defaults/ai-layer-review.md
 create mode 100644 .archon/commands/defaults/ai-layer-sdd-atdd-audit.md
 create mode 100644 .archon/commands/defaults/ai-layer-stop-gate.md
 create mode 100644 .archon/commands/defaults/ai-layer-study-helpline-lsp.md
 create mode 100644 .archon/commands/defaults/ai-layer-study-reference.md
 create mode 100644 .archon/commands/defaults/ai-layer-validate-lsp-navigation.md
 create mode 100644 .archon/commands/defaults/ai-layer-validate.md
 create mode 100644 .archon/commands/defaults/goal.md
 create mode 100644 .archon/commands/defaults/solidify-poc.md
 create mode 100644 .archon/scripts/check-artifact-completeness.ts
 create mode 100644 .archon/scripts/check-complete-preconditions.ts
 create mode 100644 .archon/scripts/validate-branch-name.ts
 create mode 100644 .archon/workflows/defaults/archon-aco-adversarial-loop.yaml
 create mode 100644 .archon/workflows/defaults/archon-ai-layer-bootstrap.yaml
 create mode 100644 .archon/workflows/defaults/context-orchestrate.yaml
 create mode 100644 .claude/agents/ai-layer-explorer.md
 create mode 100644 .claude/skills/scoped-tests/SKILL.md
 create mode 100644 .codex/README.md
 create mode 100644 .codex/agents/ai-layer-explorer.toml
 create mode 100644 .codex/agents/code-reviewer.toml
 create mode 100644 .codex/agents/code-simplifier.toml
 create mode 100644 .codex/agents/codebase-analyst.toml
 create mode 100644 .codex/agents/codebase-explorer.toml
 create mode 100644 .codex/agents/comment-analyzer.toml
 create mode 100644 .codex/agents/docs-impact.toml
 create mode 100644 .codex/agents/pr-test-analyzer.toml
 create mode 100644 .codex/agents/rulecheck-agent.toml
 create mode 100644 .codex/agents/sdk-verifier.toml
 create mode 100644 .codex/agents/silent-failure-hunter.toml
 create mode 100644 .codex/agents/triage-agent.toml
 create mode 100644 .codex/agents/type-design-analyzer.toml
 create mode 100644 .codex/agents/web-researcher.toml
 create mode 100644 .codex/hooks.json
 create mode 100755 .codex/hooks/verify-task-list.sh
 create mode 100644 AGENTS.md
 create mode 100644 CODEBASE_MAP.md
 create mode 100644 _bmad/_config/bmad-help.csv
 create mode 100644 _bmad/_config/files-manifest.csv
 create mode 100644 _bmad/_config/manifest.yaml
 create mode 100644 _bmad/_config/skill-manifest.csv
 create mode 100644 _bmad/bmm/config.yaml
 create mode 100644 _bmad/bmm/module-help.csv
 create mode 100644 _bmad/config.toml
 create mode 100644 _bmad/core/config.yaml
 create mode 100644 _bmad/core/module-help.csv
 create mode 100644 _bmad/custom/.gitignore
 create mode 100644 _bmad/custom/config.toml
 create mode 100644 _bmad/scripts/resolve_config.py
 create mode 100755 _bmad/scripts/resolve_customization.py
 create mode 100644 docs/ai/README.md
 create mode 100644 docs/ai/agentic-coding-operating-guide.md
 create mode 100644 docs/ai/artifact-schema.md
 create mode 100644 docs/ai/bmad-to-archon-mapping.md
 create mode 100644 docs/ai/dri-ownership.md
 create mode 100644 docs/ai/goals/stab-002-runtime-enforcement.goal.md
 create mode 100644 docs/ai/runtime-enforcement-decision.md
 create mode 100644 docs/ai/runtime-enforcement-ledger.md
 create mode 100644 docs/ai/security-and-secrets.md
 create mode 100644 docs/ai/source-traceability.md
 create mode 100644 docs/ai/stab-002-runtime-validation-report.md
 create mode 100644 docs/ai/stab-002-validation-report.md
 create mode 100644 docs/ai/workflow-compliance-matrix.md
 create mode 100644 docs/ai/workflow-validation.md
 create mode 100644 docs/ai/worktree-and-branch-lifecycle.md
 create mode 100644 docs/context-orchestrator/aco-status-demo.md
 create mode 100644 docs/context-orchestrator/adr/0001-implementation-host.md
 create mode 100644 docs/context-orchestrator/adr/0002-package-boundary.md
 create mode 100644 docs/context-orchestrator/adr/0003-artifact-storage.md
 create mode 100644 docs/context-orchestrator/adr/0004-graphify-mode.md
 create mode 100644 docs/context-orchestrator/adr/0005-docs-mcp-strategy.md
 create mode 100644 docs/context-orchestrator/adr/0006-bmad-routing-model.md
 create mode 100644 docs/context-orchestrator/adr/0007-atdd-sdd-gates.md
 create mode 100644 docs/context-orchestrator/adr/0008-security-model.md
 create mode 100644 docs/context-orchestrator/adr/0009-first-mvp-scope.md
 create mode 100644 docs/context-orchestrator/adr/0010-observability-events.md
 create mode 100644 docs/context-orchestrator/adr/0011-db-migration-not-needed-or-needed.md
 create mode 100644 docs/context-orchestrator/adr/0012-package-json-research-scripts.md
 create mode 100644 docs/context-orchestrator/baseline.md
 create mode 100644 docs/context-orchestrator/bmad/adversarial-review.md
 create mode 100644 docs/context-orchestrator/bmad/architecture-options.md
 create mode 100644 docs/context-orchestrator/bmad/architecture.md
 create mode 100644 docs/context-orchestrator/bmad/bmad-method-6-7-sync-review.md
 create mode 100644 docs/context-orchestrator/bmad/current-project-docs.md
 create mode 100644 docs/context-orchestrator/bmad/domain-research.md
 create mode 100644 docs/context-orchestrator/bmad/edge-case-review.md
 create mode 100644 docs/context-orchestrator/bmad/epics-and-features.md
 create mode 100644 docs/context-orchestrator/bmad/implementation-readiness.md
 create mode 100644 docs/context-orchestrator/bmad/prd-validation.md
 create mode 100644 docs/context-orchestrator/bmad/prd.md
 create mode 100644 docs/context-orchestrator/bmad/problem-solving.md
 create mode 100644 docs/context-orchestrator/bmad/product-brief.md
 create mode 100644 docs/context-orchestrator/bmad/project-context.md
 create mode 100644 docs/context-orchestrator/bmad/retrospective.md
 create mode 100644 docs/context-orchestrator/bmad/sprint-plan.md
 create mode 100644 docs/context-orchestrator/bmad/technical-research.md
 create mode 100644 docs/context-orchestrator/confidence-closure-pr-notes.md
 create mode 100644 docs/context-orchestrator/current-test-baseline.md
 create mode 100644 docs/context-orchestrator/final-validation-report.md
 create mode 100644 docs/context-orchestrator/observability.md
 create mode 100644 docs/context-orchestrator/research/archon-graph-report.md
 create mode 100644 docs/context-orchestrator/research/bmad-graph-report.md
 create mode 100644 docs/context-orchestrator/research/bootstrap-acceptance-scenarios.md
 create mode 100644 docs/context-orchestrator/research/caveman-graph-report.md
 create mode 100644 docs/context-orchestrator/research/caveman-principles.md
 create mode 100644 docs/context-orchestrator/research/codex-graph-report.md
 create mode 100644 docs/context-orchestrator/research/codex-official-docs.md
 create mode 100644 docs/context-orchestrator/research/context7-graph-report.md
 create mode 100644 docs/context-orchestrator/research/context7-mcp.md
 create mode 100644 docs/context-orchestrator/research/graph-evidence-index.md
 create mode 100644 docs/context-orchestrator/research/graph-open-questions.md
 create mode 100644 docs/context-orchestrator/research/merged-ecosystem-report.md
 create mode 100644 docs/context-orchestrator/research/openai-docs-mcp.md
 create mode 100644 docs/context-orchestrator/research/upstream-manifest.json
 create mode 100644 docs/context-orchestrator/research/waivers.md
 create mode 100644 docs/context-orchestrator/specs/000-product-charter.md
 create mode 100644 docs/context-orchestrator/specs/001-domain-glossary.md
 create mode 100644 docs/context-orchestrator/specs/002-capability-model.md
 create mode 100644 docs/context-orchestrator/specs/003-evidence-model.md
 create mode 100644 docs/context-orchestrator/specs/004-graph-context-spec.md
 create mode 100644 docs/context-orchestrator/specs/005-documentation-resolution-spec.md
 create mode 100644 docs/context-orchestrator/specs/006-bmad-routing-spec.md
 create mode 100644 docs/context-orchestrator/specs/007-caveman-policy-spec.md
 create mode 100644 docs/context-orchestrator/specs/008-prompt-package-spec.md
 create mode 100644 docs/context-orchestrator/specs/009-archive-artifact-spec.md
 create mode 100644 docs/context-orchestrator/specs/010-codex-readiness-spec.md
 create mode 100644 docs/context-orchestrator/specs/011-command-contract.md
 create mode 100644 docs/context-orchestrator/specs/012-cli-contract.md
 create mode 100644 docs/context-orchestrator/specs/013-api-contract.openapi.yaml
 create mode 100644 docs/context-orchestrator/specs/014-workflow-contracts.md
 create mode 100644 docs/context-orchestrator/specs/015-security-threat-model.md
 create mode 100644 docs/context-orchestrator/specs/016-acceptance-test-plan.md
 create mode 100644 docs/context-orchestrator/specs/017-implementation-discovery-protocol.md
 create mode 100644 docs/context-orchestrator/specs/018-release-readiness-spec.md
 create mode 100644 docs/context-orchestrator/specs/019-observability-and-events-spec.md
 create mode 100644 docs/context-orchestrator/specs/020-package-scripts-and-research-corpus-spec.md
 create mode 100644 docs/context-orchestrator/specs/021-opa-prompt-package-policy-spec.md
 create mode 100644 docs/context-orchestrator/specs/022-sdd-atdd-traceability-gate-spec.md
 create mode 100644 docs/context-orchestrator/specs/023-decision-dossier-gate-spec.md
 create mode 100644 docs/context-orchestrator/specs/024-approval-capsule-spec.md
 create mode 100644 docs/context-orchestrator/specs/025-goal-bound-evidence-gate-spec.md
 create mode 100644 docs/context-orchestrator/specs/026-next-decision-engine-spec.md
 create mode 100644 docs/context-orchestrator/specs/027-route-analytics-ledger-spec.md
 create mode 100644 docs/context-orchestrator/specs/028-adversarial-contract-loop-spec.md
 create mode 100644 docs/context-orchestrator/specs/029-target-intent-boundary-spec.md
 create mode 100644 docs/context-orchestrator/specs/030-ai-layer-bootstrap-spec.md
 create mode 100644 docs/context-orchestrator/specs/assumption-evidence-register.md
 create mode 100644 docs/context-orchestrator/specs/spec-traceability-matrix.md
 create mode 100644 docs/context-orchestrator/specs/traceability/aco-traceability.json
 create mode 100644 docs/context-orchestrator/stabilization/aco-pr-hygiene-report.md
 create mode 100644 docs/context-orchestrator/stabilization/aco-stabilization-scorecard.json
 create mode 100644 docs/context-orchestrator/stabilization/aco-stabilization-scorecard.md
 create mode 100644 docs/context-orchestrator/stabilization/context7-mcp-setup-notes.md
 create mode 100644 packages/adapters/AGENTS.md
 create mode 100644 packages/adapters/CLAUDE.md
 create mode 100644 packages/cli/AGENTS.md
 create mode 100644 packages/cli/CLAUDE.md
 create mode 100644 packages/cli/src/commands/aco.test.ts
 create mode 100644 packages/cli/src/commands/aco.ts
 create mode 100644 packages/cli/src/commands/context.test.ts
 create mode 100644 packages/cli/src/commands/context.ts
 create mode 100644 packages/context-orchestrator/AGENTS.md
 create mode 100644 packages/context-orchestrator/CLAUDE.md
 create mode 100644 packages/context-orchestrator/package.json
 create mode 100644 packages/context-orchestrator/policies/prompt-package/fixtures/invalid-malformed-shape.json
 create mode 100644 packages/context-orchestrator/policies/prompt-package/fixtures/invalid-missing-acceptance.json
 create mode 100644 packages/context-orchestrator/policies/prompt-package/fixtures/invalid-missing-security.json
 create mode 100644 packages/context-orchestrator/policies/prompt-package/fixtures/invalid-secret-like-value.json
 create mode 100644 packages/context-orchestrator/policies/prompt-package/fixtures/valid-minimal.json
 create mode 100644 packages/context-orchestrator/policies/prompt-package/fixtures/warn-graph-waiver.json
 create mode 100644 packages/context-orchestrator/policies/prompt-package/fixtures/warn-unresolved-docs.json
 create mode 100644 packages/context-orchestrator/policies/prompt-package/prompt_package.rego
 create mode 100644 packages/context-orchestrator/policies/prompt-package/prompt_package_test.rego
 create mode 100644 packages/context-orchestrator/src/acceptance.ts
 create mode 100644 packages/context-orchestrator/src/approval-capsule.test.ts
 create mode 100644 packages/context-orchestrator/src/approval-capsule.ts
 create mode 100644 packages/context-orchestrator/src/artifact-package.ts
 create mode 100644 packages/context-orchestrator/src/bmad.ts
 create mode 100644 packages/context-orchestrator/src/capabilities.ts
 create mode 100644 packages/context-orchestrator/src/caveman.ts
 create mode 100644 packages/context-orchestrator/src/compiler.ts
 create mode 100644 packages/context-orchestrator/src/context-orchestrator.test.ts
 create mode 100644 packages/context-orchestrator/src/decision-dossier.test.ts
 create mode 100644 packages/context-orchestrator/src/decision-dossier.ts
 create mode 100644 packages/context-orchestrator/src/docs.ts
 create mode 100644 packages/context-orchestrator/src/evidence-closure.test.ts
 create mode 100644 packages/context-orchestrator/src/evidence-closure.ts
 create mode 100644 packages/context-orchestrator/src/graph-waiver-closure.test.ts
 create mode 100644 packages/context-orchestrator/src/graph-waiver-closure.ts
 create mode 100644 packages/context-orchestrator/src/graph.ts
 create mode 100644 packages/context-orchestrator/src/index.ts
 create mode 100644 packages/context-orchestrator/src/intent.ts
 create mode 100644 packages/context-orchestrator/src/ledgers.test.ts
 create mode 100644 packages/context-orchestrator/src/ledgers.ts
 create mode 100644 packages/context-orchestrator/src/next-decision.test.ts
 create mode 100644 packages/context-orchestrator/src/next-decision.ts
 create mode 100644 packages/context-orchestrator/src/policy-decision.ts
 create mode 100644 packages/context-orchestrator/src/route-analytics.test.ts
 create mode 100644 packages/context-orchestrator/src/route-analytics.ts
 create mode 100644 packages/context-orchestrator/src/schemas/adversarial-contract-loop.ts
 create mode 100644 packages/context-orchestrator/src/schemas/approval-capsule.ts
 create mode 100644 packages/context-orchestrator/src/schemas/approval-contract.test.ts
 create mode 100644 packages/context-orchestrator/src/schemas/approval-contract.ts
 create mode 100644 packages/context-orchestrator/src/schemas/next-decision.ts
 create mode 100644 packages/context-orchestrator/src/schemas/route-analytics.ts
 create mode 100644 packages/context-orchestrator/src/schemas/target-intent-boundary.ts
 create mode 100644 packages/context-orchestrator/src/security.ts
 create mode 100644 packages/context-orchestrator/src/status.test.ts
 create mode 100644 packages/context-orchestrator/src/status.ts
 create mode 100644 packages/context-orchestrator/src/target-intent-boundary.ts
 create mode 100644 packages/context-orchestrator/src/telemetry.test.ts
 create mode 100644 packages/context-orchestrator/src/telemetry.ts
 create mode 100644 packages/context-orchestrator/src/types.ts
 create mode 100644 packages/context-orchestrator/src/validation.ts
 create mode 100644 packages/context-orchestrator/tsconfig.json
 create mode 100644 packages/core/AGENTS.md
 create mode 100644 packages/core/CLAUDE.md
 create mode 100644 packages/core/src/config/resolve-assistant.test.ts
 create mode 100644 packages/core/src/config/resolve-assistant.ts
 delete mode 100644 packages/core/tsconfig.tsbuildinfo
 create mode 100644 packages/docs-web/AGENTS.md
 create mode 100644 packages/docs-web/CLAUDE.md
 create mode 100644 packages/docs-web/src/content/docs/book/solidification-review-ledgers.md
 create mode 100644 packages/docs-web/src/content/docs/guides/ai-layer-bootstrap.md
 create mode 100644 packages/git/AGENTS.md
 create mode 100644 packages/git/CLAUDE.md
 create mode 100644 packages/isolation/AGENTS.md
 create mode 100644 packages/isolation/CLAUDE.md
 create mode 100644 packages/paths/AGENTS.md
 create mode 100644 packages/paths/CLAUDE.md
 create mode 100644 packages/providers/AGENTS.md
 create mode 100644 packages/providers/CLAUDE.md
 create mode 100644 packages/server/AGENTS.md
 create mode 100644 packages/server/CLAUDE.md
 create mode 100644 packages/server/src/routes/api.aco.test.ts
 create mode 100644 packages/server/src/routes/schemas/aco.schemas.test.ts
 create mode 100644 packages/server/src/routes/schemas/aco.schemas.ts
 delete mode 100644 packages/server/tsconfig.tsbuildinfo
 create mode 100644 packages/web/AGENTS.md
 create mode 100644 packages/web/CLAUDE.md
 create mode 100644 packages/web/src/lib/aco-readiness.test.ts
 create mode 100644 packages/web/src/lib/aco-readiness.ts
 create mode 100644 packages/web/src/lib/aco-status.test.ts
 create mode 100644 packages/web/src/routes/AcoStatusPage.test.ts
 create mode 100644 packages/web/src/routes/AcoStatusPage.tsx
 create mode 100644 packages/workflows/AGENTS.md
 create mode 100644 packages/workflows/CLAUDE.md
 create mode 100644 scripts/context-orchestrator/validate-traceability.ts
 create mode 100644 scripts/policy/validate-aco-policy.ts
 create mode 100644 scripts/research/bootstrap-upstreams.ts
 create mode 100644 scripts/research/common.ts
 create mode 100644 scripts/research/graph-upstreams.ts
 create mode 100644 scripts/research/merge-graphs.ts
 create mode 100644 scripts/research/render-graph-evidence-docs.ts
 create mode 100644 scripts/research/render-sdd-scaffold.ts
 create mode 100644 scripts/research/validate-research-corpus.ts
 create mode 100644 scripts/validate-ts-navigation.ts
 create mode 100644 tests/acceptance/context-orchestrator/acceptance-planner.acceptance.test.ts
 create mode 100644 tests/acceptance/context-orchestrator/adversarial-contract-loop.acceptance.test.ts
 create mode 100644 tests/acceptance/context-orchestrator/ai-layer-bootstrap.acceptance.test.ts
 create mode 100644 tests/acceptance/context-orchestrator/api.acceptance.test.ts
 create mode 100644 tests/acceptance/context-orchestrator/approval-capsule.acceptance.test.ts
 create mode 100644 tests/acceptance/context-orchestrator/archive.acceptance.test.ts
 create mode 100644 tests/acceptance/context-orchestrator/bmad.acceptance.test.ts
 create mode 100644 tests/acceptance/context-orchestrator/bootstrap.acceptance.test.ts
 create mode 100644 tests/acceptance/context-orchestrator/caveman.acceptance.test.ts
 create mode 100644 tests/acceptance/context-orchestrator/cli.acceptance.test.ts
 create mode 100644 tests/acceptance/context-orchestrator/codex-hook.acceptance.test.ts
 create mode 100644 tests/acceptance/context-orchestrator/command.acceptance.test.ts
 create mode 100644 tests/acceptance/context-orchestrator/compile.acceptance.test.ts
 create mode 100644 tests/acceptance/context-orchestrator/discovery.acceptance.test.ts
 create mode 100644 tests/acceptance/context-orchestrator/docs.acceptance.test.ts
 create mode 100644 tests/acceptance/context-orchestrator/dossier.acceptance.test.ts
 create mode 100644 tests/acceptance/context-orchestrator/events.acceptance.test.ts
 create mode 100644 tests/acceptance/context-orchestrator/goal-bound-evidence.acceptance.test.ts
 create mode 100644 tests/acceptance/context-orchestrator/graph-waiver-closure.acceptance.test.ts
 create mode 100644 tests/acceptance/context-orchestrator/graph.acceptance.test.ts
 create mode 100644 tests/acceptance/context-orchestrator/next-decision.acceptance.test.ts
 create mode 100644 tests/acceptance/context-orchestrator/release.acceptance.test.ts
 create mode 100644 tests/acceptance/context-orchestrator/route-analytics.acceptance.test.ts
 create mode 100644 tests/acceptance/context-orchestrator/route.acceptance.test.ts
 create mode 100644 tests/acceptance/context-orchestrator/security.acceptance.test.ts
 create mode 100644 tests/acceptance/context-orchestrator/specs.acceptance.test.ts
 create mode 100644 tests/acceptance/context-orchestrator/target-intent-boundary.acceptance.test.ts
 create mode 100644 tests/acceptance/context-orchestrator/workflow.acceptance.test.ts
```

Reference and validation fields are `unknown` until Phase 5-8 evidence is recorded. Initial decisions are provisional and must be reconciled in the keep/move/remove/split matrix before any move or removal.

| Path | Git status | Insertions | Deletions | Extension | Top-level directory | Primary classification | Secondary classification | Generated/transient | Local leakage risk | Referenced elsewhere | Validation coverage | Cleanup candidate | Risk | Initial decision | Notes |
| --- | --- | ---: | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| .archon/commands/defaults/ai-layer-audit.md | A | 38 | 0 | .md | .archon | ARCHON_COMMAND | AI_LAYER | no | no | unknown | unknown | yes | high | REQUIRES_HUMAN_DECISION | AI-layer default command candidate; needs workflow/reference check. |
| .archon/commands/defaults/ai-layer-branch-gate.md | A | 39 | 0 | .md | .archon | ARCHON_COMMAND | AI_LAYER | no | no | unknown | unknown | yes | high | REQUIRES_HUMAN_DECISION | AI-layer default command candidate; needs workflow/reference check. |
| .archon/commands/defaults/ai-layer-completion-audit.md | A | 50 | 0 | .md | .archon | ARCHON_COMMAND | AI_LAYER | no | no | unknown | unknown | yes | high | REQUIRES_HUMAN_DECISION | AI-layer default command candidate; needs workflow/reference check. |
| .archon/commands/defaults/ai-layer-design-lsp-navigation.md | A | 39 | 0 | .md | .archon | ARCHON_COMMAND | AI_LAYER | no | no | unknown | unknown | yes | high | REQUIRES_HUMAN_DECISION | AI-layer default command candidate; needs workflow/reference check. |
| .archon/commands/defaults/ai-layer-design.md | A | 43 | 0 | .md | .archon | ARCHON_COMMAND | AI_LAYER | no | no | unknown | unknown | yes | high | REQUIRES_HUMAN_DECISION | AI-layer default command candidate; needs workflow/reference check. |
| .archon/commands/defaults/ai-layer-endgoal-gate.md | A | 48 | 0 | .md | .archon | ARCHON_COMMAND | AI_LAYER | no | no | unknown | unknown | yes | high | REQUIRES_HUMAN_DECISION | AI-layer default command candidate; needs workflow/reference check. |
| .archon/commands/defaults/ai-layer-goal.md | A | 47 | 0 | .md | .archon | ARCHON_COMMAND | AI_LAYER | no | no | unknown | unknown | yes | high | REQUIRES_HUMAN_DECISION | AI-layer default command candidate; needs workflow/reference check. |
| .archon/commands/defaults/ai-layer-implement.md | A | 44 | 0 | .md | .archon | ARCHON_COMMAND | AI_LAYER | no | no | unknown | unknown | yes | high | REQUIRES_HUMAN_DECISION | AI-layer default command candidate; needs workflow/reference check. |
| .archon/commands/defaults/ai-layer-map-codebase.md | A | 38 | 0 | .md | .archon | ARCHON_COMMAND | AI_LAYER | no | no | unknown | unknown | yes | high | REQUIRES_HUMAN_DECISION | AI-layer default command candidate; needs workflow/reference check. |
| .archon/commands/defaults/ai-layer-preflight.md | A | 42 | 0 | .md | .archon | ARCHON_COMMAND | AI_LAYER | no | no | unknown | unknown | yes | high | REQUIRES_HUMAN_DECISION | AI-layer default command candidate; needs workflow/reference check. |
| .archon/commands/defaults/ai-layer-review.md | A | 39 | 0 | .md | .archon | ARCHON_COMMAND | AI_LAYER | no | no | unknown | unknown | yes | high | REQUIRES_HUMAN_DECISION | AI-layer default command candidate; needs workflow/reference check. |
| .archon/commands/defaults/ai-layer-sdd-atdd-audit.md | A | 38 | 0 | .md | .archon | ARCHON_COMMAND | AI_LAYER | no | no | unknown | unknown | yes | high | REQUIRES_HUMAN_DECISION | AI-layer default command candidate; needs workflow/reference check. |
| .archon/commands/defaults/ai-layer-stop-gate.md | A | 40 | 0 | .md | .archon | ARCHON_COMMAND | AI_LAYER | no | no | unknown | unknown | yes | high | REQUIRES_HUMAN_DECISION | AI-layer default command candidate; needs workflow/reference check. |
| .archon/commands/defaults/ai-layer-study-helpline-lsp.md | A | 51 | 0 | .md | .archon | ARCHON_COMMAND | AI_LAYER | no | no | unknown | unknown | yes | high | REQUIRES_HUMAN_DECISION | AI-layer default command candidate; needs workflow/reference check. |
| .archon/commands/defaults/ai-layer-study-reference.md | A | 38 | 0 | .md | .archon | ARCHON_COMMAND | AI_LAYER | no | no | unknown | unknown | yes | high | REQUIRES_HUMAN_DECISION | AI-layer default command candidate; needs workflow/reference check. |
| .archon/commands/defaults/ai-layer-validate-lsp-navigation.md | A | 40 | 0 | .md | .archon | ARCHON_COMMAND | AI_LAYER | no | no | unknown | unknown | yes | high | REQUIRES_HUMAN_DECISION | AI-layer default command candidate; needs workflow/reference check. |
| .archon/commands/defaults/ai-layer-validate.md | A | 50 | 0 | .md | .archon | ARCHON_COMMAND | AI_LAYER | no | no | unknown | unknown | yes | high | REQUIRES_HUMAN_DECISION | AI-layer default command candidate; needs workflow/reference check. |
| .archon/commands/defaults/goal.md | A | 186 | 0 | .md | .archon | ARCHON_COMMAND | none | no | no | unknown | unknown | yes | high | REQUIRES_HUMAN_DECISION | Goal command candidate; verify product default vs branch scaffolding. |
| .archon/commands/defaults/solidify-poc.md | A | 113 | 0 | .md | .archon | ARCHON_COMMAND | none | no | no | unknown | unknown | yes | high | REQUIRES_HUMAN_DECISION | Initial Phase 3 classification; Phase 4/6 must verify. |
| .archon/commands/maintainer-review-docs-impact.md | M | 3 | 3 | .md | .archon | ARCHON_COMMAND | none | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| .archon/config.yaml | M | 3 | 0 | .yaml | .archon | UNKNOWN | none | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| .archon/maintainer-standup/direction.md | M | 18 | 0 | .md | .archon | UNKNOWN | none | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| .archon/scripts/check-artifact-completeness.ts | A | 162 | 0 | .ts | .archon | ARCHON_SCRIPT | none | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| .archon/scripts/check-complete-preconditions.ts | A | 103 | 0 | .ts | .archon | ARCHON_SCRIPT | none | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| .archon/scripts/validate-branch-name.ts | A | 136 | 0 | .ts | .archon | ARCHON_SCRIPT | none | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| .archon/workflows/defaults/archon-aco-adversarial-loop.yaml | A | 356 | 0 | .yaml | .archon | ARCHON_WORKFLOW | ACO | no | no | unknown | unknown | yes | high | REQUIRES_HUMAN_DECISION | ACO adversarial workflow candidate; verify product-facing status. |
| .archon/workflows/defaults/archon-ai-layer-bootstrap.yaml | A | 101 | 0 | .yaml | .archon | ARCHON_WORKFLOW | AI_LAYER | no | no | unknown | unknown | yes | high | REQUIRES_HUMAN_DECISION | Bootstrap workflow candidate; verify default suitability. |
| .archon/workflows/defaults/archon-refactor-safely.yaml | M | 32 | 4 | .yaml | .archon | ARCHON_WORKFLOW | none | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| .archon/workflows/defaults/archon-workflow-builder.yaml | M | 5 | 0 | .yaml | .archon | ARCHON_WORKFLOW | none | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| .archon/workflows/defaults/context-orchestrate.yaml | A | 188 | 0 | .yaml | .archon | ARCHON_WORKFLOW | none | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| .claude/agents/ai-layer-explorer.md | A | 19 | 0 | .md | .claude | CLAUDE_CONFIG | AI_LAYER | no | unknown | unknown | unknown | yes | medium | REQUIRES_HUMAN_DECISION | Initial Phase 3 classification; Phase 4/6 must verify. |
| .claude/skills/scoped-tests/SKILL.md | A | 19 | 0 | .md | .claude | CLAUDE_CONFIG | none | no | unknown | unknown | unknown | yes | medium | REQUIRES_HUMAN_DECISION | Initial Phase 3 classification; Phase 4/6 must verify. |
| .codex/README.md | A | 9 | 0 | .md | .codex | CODEX_CONFIG | none | no | unknown | unknown | unknown | yes | medium | REQUIRES_HUMAN_DECISION | Initial Phase 3 classification; Phase 4/6 must verify. |
| .codex/agents/ai-layer-explorer.toml | A | 18 | 0 | .toml | .codex | CODEX_CONFIG | AI_LAYER | no | unknown | unknown | unknown | yes | medium | REQUIRES_HUMAN_DECISION | Initial Phase 3 classification; Phase 4/6 must verify. |
| .codex/agents/code-reviewer.toml | A | 148 | 0 | .toml | .codex | CODEX_CONFIG | none | no | unknown | unknown | unknown | yes | medium | REQUIRES_HUMAN_DECISION | Initial Phase 3 classification; Phase 4/6 must verify. |
| .codex/agents/code-simplifier.toml | A | 114 | 0 | .toml | .codex | CODEX_CONFIG | none | no | unknown | unknown | unknown | yes | medium | REQUIRES_HUMAN_DECISION | Initial Phase 3 classification; Phase 4/6 must verify. |
| .codex/agents/codebase-analyst.toml | A | 126 | 0 | .toml | .codex | CODEX_CONFIG | none | no | unknown | unknown | unknown | yes | medium | REQUIRES_HUMAN_DECISION | Initial Phase 3 classification; Phase 4/6 must verify. |
| .codex/agents/codebase-explorer.toml | A | 163 | 0 | .toml | .codex | CODEX_CONFIG | none | no | unknown | unknown | unknown | yes | medium | REQUIRES_HUMAN_DECISION | Initial Phase 3 classification; Phase 4/6 must verify. |
| .codex/agents/comment-analyzer.toml | A | 113 | 0 | .toml | .codex | CODEX_CONFIG | none | no | unknown | unknown | unknown | yes | medium | REQUIRES_HUMAN_DECISION | Initial Phase 3 classification; Phase 4/6 must verify. |
| .codex/agents/docs-impact.toml | A | 95 | 0 | .toml | .codex | CODEX_CONFIG | none | no | unknown | unknown | unknown | yes | medium | REQUIRES_HUMAN_DECISION | Initial Phase 3 classification; Phase 4/6 must verify. |
| .codex/agents/pr-test-analyzer.toml | A | 128 | 0 | .toml | .codex | CODEX_CONFIG | none | no | unknown | unknown | unknown | yes | medium | REQUIRES_HUMAN_DECISION | Initial Phase 3 classification; Phase 4/6 must verify. |
| .codex/agents/rulecheck-agent.toml | A | 150 | 0 | .toml | .codex | CODEX_CONFIG | none | no | unknown | unknown | unknown | yes | medium | REQUIRES_HUMAN_DECISION | Initial Phase 3 classification; Phase 4/6 must verify. |
| .codex/agents/sdk-verifier.toml | A | 142 | 0 | .toml | .codex | CODEX_CONFIG | none | no | unknown | unknown | unknown | yes | medium | REQUIRES_HUMAN_DECISION | Initial Phase 3 classification; Phase 4/6 must verify. |
| .codex/agents/silent-failure-hunter.toml | A | 137 | 0 | .toml | .codex | CODEX_CONFIG | none | no | unknown | unknown | unknown | yes | medium | REQUIRES_HUMAN_DECISION | Initial Phase 3 classification; Phase 4/6 must verify. |
| .codex/agents/triage-agent.toml | A | 53 | 0 | .toml | .codex | CODEX_CONFIG | none | no | unknown | unknown | unknown | yes | medium | REQUIRES_HUMAN_DECISION | Initial Phase 3 classification; Phase 4/6 must verify. |
| .codex/agents/type-design-analyzer.toml | A | 183 | 0 | .toml | .codex | CODEX_CONFIG | none | no | unknown | unknown | unknown | yes | medium | REQUIRES_HUMAN_DECISION | Initial Phase 3 classification; Phase 4/6 must verify. |
| .codex/agents/web-researcher.toml | A | 114 | 0 | .toml | .codex | CODEX_CONFIG | none | no | unknown | unknown | unknown | yes | medium | REQUIRES_HUMAN_DECISION | Initial Phase 3 classification; Phase 4/6 must verify. |
| .codex/hooks.json | A | 15 | 0 | .json | .codex | HOOK_ASSET | HOOK | no | unknown | unknown | unknown | yes | high | REQUIRES_HUMAN_DECISION | Hook/config safety requires explicit inspection. |
| .codex/hooks/verify-task-list.sh | A | 57 | 0 | .sh | .codex | HOOK_ASSET | HOOK | no | unknown | unknown | unknown | yes | high | REQUIRES_HUMAN_DECISION | Hook/config safety requires explicit inspection. |
| .env.example | M | 1 | 0 | .example | (root) | PACKAGE_BUILD_CONFIG | BUILD_CONFIG | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| .github/workflows/test.yml | M | 21 | 0 | .yml | .github | PACKAGE_BUILD_CONFIG | BUILD_CONFIG | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| .gitignore | M | 12 | 0 | (none) | (root) | PACKAGE_BUILD_CONFIG | BUILD_CONFIG | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| .prettierignore | M | 2 | 0 | (none) | (root) | PACKAGE_BUILD_CONFIG | BUILD_CONFIG | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| AGENTS.md | A | 73 | 0 | .md | (root) | AI_GOVERNANCE_DOC | none | no | unknown | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| CLAUDE.md | M | 17 | 823 | .md | (root) | AI_GOVERNANCE_DOC | none | no | unknown | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| CODEBASE_MAP.md | A | 132 | 0 | .md | (root) | AI_GOVERNANCE_DOC | none | no | unknown | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| Dockerfile | M | 3 | 0 | (none) | (root) | PACKAGE_BUILD_CONFIG | BUILD_CONFIG | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| README.md | M | 18 | 1 | .md | (root) | AI_GOVERNANCE_DOC | none | no | unknown | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| _bmad/_config/bmad-help.csv | A | 44 | 0 | .csv | _bmad | BMAD_ASSET | BMAD | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| _bmad/_config/files-manifest.csv | A | 231 | 0 | .csv | _bmad | BMAD_ASSET | BMAD | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| _bmad/_config/manifest.yaml | A | 21 | 0 | .yaml | _bmad | BMAD_ASSET | BMAD | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| _bmad/_config/skill-manifest.csv | A | 45 | 0 | .csv | _bmad | BMAD_ASSET | BMAD | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| _bmad/bmm/config.yaml | A | 16 | 0 | .yaml | _bmad | BMAD_ASSET | BMAD | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| _bmad/bmm/module-help.csv | A | 32 | 0 | .csv | _bmad | BMAD_ASSET | BMAD | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| _bmad/config.toml | A | 69 | 0 | .toml | _bmad | BMAD_ASSET | BMAD | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| _bmad/core/config.yaml | A | 10 | 0 | .yaml | _bmad | BMAD_ASSET | BMAD | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| _bmad/core/module-help.csv | A | 13 | 0 | .csv | _bmad | BMAD_ASSET | BMAD | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| _bmad/custom/.gitignore | A | 1 | 0 | (none) | _bmad | BMAD_ASSET | BMAD | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| _bmad/custom/config.toml | A | 7 | 0 | .toml | _bmad | BMAD_ASSET | BMAD | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| _bmad/scripts/resolve_config.py | A | 176 | 0 | .py | _bmad | BMAD_ASSET | BMAD | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| _bmad/scripts/resolve_customization.py | A | 230 | 0 | .py | _bmad | BMAD_ASSET | BMAD | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| bun.lock | M | 34 | 2 | .lock | (root) | PACKAGE_BUILD_CONFIG | BUILD_CONFIG | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/ai/README.md | A | 19 | 0 | .md | docs | AI_GOVERNANCE_DOC | none | no | unknown | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/ai/agentic-coding-operating-guide.md | A | 1712 | 0 | .md | docs | AI_GOVERNANCE_DOC | none | no | unknown | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/ai/artifact-schema.md | A | 86 | 0 | .md | docs | AI_GOVERNANCE_DOC | none | no | unknown | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/ai/bmad-to-archon-mapping.md | A | 95 | 0 | .md | docs | AI_GOVERNANCE_DOC | BMAD | no | unknown | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/ai/dri-ownership.md | A | 24 | 0 | .md | docs | AI_GOVERNANCE_DOC | none | no | unknown | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/ai/goals/stab-002-runtime-enforcement.goal.md | A | 491 | 0 | .md | docs | STABILIZATION_EVIDENCE | AI_LAYER | no | unknown | unknown | unknown | yes | medium | MOVE_TO_STABILIZATION | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/ai/runtime-enforcement-decision.md | A | 131 | 0 | .md | docs | AI_GOVERNANCE_DOC | AI_LAYER | no | unknown | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/ai/runtime-enforcement-ledger.md | A | 100 | 0 | .md | docs | AI_GOVERNANCE_DOC | AI_LAYER | no | unknown | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/ai/security-and-secrets.md | A | 70 | 0 | .md | docs | AI_GOVERNANCE_DOC | none | no | unknown | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/ai/source-traceability.md | A | 31 | 0 | .md | docs | AI_GOVERNANCE_DOC | none | no | unknown | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/ai/stab-002-runtime-validation-report.md | A | 148 | 0 | .md | docs | STABILIZATION_EVIDENCE | none | no | unknown | unknown | unknown | yes | medium | MOVE_TO_STABILIZATION | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/ai/stab-002-validation-report.md | A | 116 | 0 | .md | docs | STABILIZATION_EVIDENCE | none | no | unknown | unknown | unknown | yes | medium | MOVE_TO_STABILIZATION | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/ai/workflow-compliance-matrix.md | A | 137 | 0 | .md | docs | AI_GOVERNANCE_DOC | none | no | unknown | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/ai/workflow-validation.md | A | 142 | 0 | .md | docs | AI_GOVERNANCE_DOC | none | no | unknown | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/ai/worktree-and-branch-lifecycle.md | A | 146 | 0 | .md | docs | AI_GOVERNANCE_DOC | none | no | unknown | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/aco-status-demo.md | A | 44 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/adr/0001-implementation-host.md | A | 37 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/adr/0002-package-boundary.md | A | 34 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/adr/0003-artifact-storage.md | A | 36 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/adr/0004-graphify-mode.md | A | 35 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/adr/0005-docs-mcp-strategy.md | A | 36 | 0 | .md | docs | ACO_DOC_SPEC | ACO, MCP | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/adr/0006-bmad-routing-model.md | A | 41 | 0 | .md | docs | ACO_DOC_SPEC | BMAD, ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/adr/0007-atdd-sdd-gates.md | A | 35 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/adr/0008-security-model.md | A | 35 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/adr/0009-first-mvp-scope.md | A | 46 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/adr/0010-observability-events.md | A | 33 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/adr/0011-db-migration-not-needed-or-needed.md | A | 35 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/adr/0012-package-json-research-scripts.md | A | 35 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/baseline.md | A | 51 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/bmad/adversarial-review.md | A | 18 | 0 | .md | docs | BMAD_ASSET | BMAD, ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/bmad/architecture-options.md | A | 65 | 0 | .md | docs | BMAD_ASSET | BMAD, ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/bmad/architecture.md | A | 64 | 0 | .md | docs | BMAD_ASSET | BMAD, ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/bmad/bmad-method-6-7-sync-review.md | A | 143 | 0 | .md | docs | BMAD_ASSET | BMAD, ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/bmad/current-project-docs.md | A | 33 | 0 | .md | docs | BMAD_ASSET | BMAD, ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/bmad/domain-research.md | A | 41 | 0 | .md | docs | BMAD_ASSET | BMAD, ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/bmad/edge-case-review.md | A | 21 | 0 | .md | docs | BMAD_ASSET | BMAD, ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/bmad/epics-and-features.md | A | 37 | 0 | .md | docs | BMAD_ASSET | BMAD, ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/bmad/implementation-readiness.md | A | 30 | 0 | .md | docs | BMAD_ASSET | BMAD, ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/bmad/prd-validation.md | A | 26 | 0 | .md | docs | BMAD_ASSET | BMAD, ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/bmad/prd.md | A | 82 | 0 | .md | docs | BMAD_ASSET | BMAD, ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/bmad/problem-solving.md | A | 27 | 0 | .md | docs | BMAD_ASSET | BMAD, ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/bmad/product-brief.md | A | 50 | 0 | .md | docs | BMAD_ASSET | BMAD, ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/bmad/project-context.md | A | 65 | 0 | .md | docs | BMAD_ASSET | BMAD, ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/bmad/retrospective.md | A | 66 | 0 | .md | docs | BMAD_ASSET | BMAD, ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/bmad/sprint-plan.md | A | 23 | 0 | .md | docs | BMAD_ASSET | BMAD, ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/bmad/technical-research.md | A | 41 | 0 | .md | docs | BMAD_ASSET | BMAD, ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/confidence-closure-pr-notes.md | A | 38 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/current-test-baseline.md | A | 44 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/final-validation-report.md | A | 250 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/observability.md | A | 56 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/research/archon-graph-report.md | A | 29 | 0 | .md | docs | RESEARCH_EVIDENCE | ACO | no | unknown | unknown | unknown | yes | medium | UNKNOWN_KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/research/bmad-graph-report.md | A | 19 | 0 | .md | docs | RESEARCH_EVIDENCE | BMAD, ACO | no | unknown | unknown | unknown | yes | medium | UNKNOWN_KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/research/bootstrap-acceptance-scenarios.md | A | 38 | 0 | .md | docs | RESEARCH_EVIDENCE | ACO | no | unknown | unknown | unknown | yes | medium | UNKNOWN_KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/research/caveman-graph-report.md | A | 29 | 0 | .md | docs | RESEARCH_EVIDENCE | ACO | no | unknown | unknown | unknown | yes | medium | UNKNOWN_KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/research/caveman-principles.md | A | 100 | 0 | .md | docs | RESEARCH_EVIDENCE | ACO | no | unknown | unknown | unknown | yes | medium | UNKNOWN_KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/research/codex-graph-report.md | A | 29 | 0 | .md | docs | RESEARCH_EVIDENCE | ACO | no | unknown | unknown | unknown | yes | medium | UNKNOWN_KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/research/codex-official-docs.md | A | 85 | 0 | .md | docs | RESEARCH_EVIDENCE | ACO | no | unknown | unknown | unknown | yes | medium | UNKNOWN_KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/research/context7-graph-report.md | A | 29 | 0 | .md | docs | RESEARCH_EVIDENCE | ACO | no | unknown | unknown | unknown | yes | medium | UNKNOWN_KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/research/context7-mcp.md | A | 64 | 0 | .md | docs | RESEARCH_EVIDENCE | ACO, MCP | no | unknown | unknown | unknown | yes | medium | UNKNOWN_KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/research/graph-evidence-index.md | A | 24 | 0 | .md | docs | RESEARCH_EVIDENCE | ACO | no | unknown | unknown | unknown | yes | medium | UNKNOWN_KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/research/graph-open-questions.md | A | 7 | 0 | .md | docs | RESEARCH_EVIDENCE | ACO | no | unknown | unknown | unknown | yes | medium | UNKNOWN_KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/research/merged-ecosystem-report.md | A | 23 | 0 | .md | docs | RESEARCH_EVIDENCE | ACO | no | unknown | unknown | unknown | yes | medium | UNKNOWN_KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/research/openai-docs-mcp.md | A | 63 | 0 | .md | docs | RESEARCH_EVIDENCE | ACO, MCP | no | unknown | unknown | unknown | yes | medium | UNKNOWN_KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/research/upstream-manifest.json | A | 253 | 0 | .json | docs | RESEARCH_EVIDENCE | ACO | unknown | unknown | unknown | unknown | yes | medium | UNKNOWN_KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/research/waivers.md | A | 49 | 0 | .md | docs | RESEARCH_EVIDENCE | ACO | no | unknown | unknown | unknown | yes | medium | UNKNOWN_KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/000-product-charter.md | A | 68 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/001-domain-glossary.md | A | 60 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/002-capability-model.md | A | 63 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/003-evidence-model.md | A | 63 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/004-graph-context-spec.md | A | 74 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/005-documentation-resolution-spec.md | A | 130 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/006-bmad-routing-spec.md | A | 69 | 0 | .md | docs | ACO_DOC_SPEC | BMAD, ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/007-caveman-policy-spec.md | A | 114 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/008-prompt-package-spec.md | A | 100 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/009-archive-artifact-spec.md | A | 72 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/010-codex-readiness-spec.md | A | 123 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/011-command-contract.md | A | 59 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/012-cli-contract.md | A | 96 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/013-api-contract.openapi.yaml | A | 103 | 0 | .yaml | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/014-workflow-contracts.md | A | 68 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/015-security-threat-model.md | A | 61 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/016-acceptance-test-plan.md | A | 71 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/017-implementation-discovery-protocol.md | A | 154 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/018-release-readiness-spec.md | A | 68 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/019-observability-and-events-spec.md | A | 99 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/020-package-scripts-and-research-corpus-spec.md | A | 60 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/021-opa-prompt-package-policy-spec.md | A | 100 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/022-sdd-atdd-traceability-gate-spec.md | A | 93 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/023-decision-dossier-gate-spec.md | A | 92 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/024-approval-capsule-spec.md | A | 107 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/025-goal-bound-evidence-gate-spec.md | A | 101 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/026-next-decision-engine-spec.md | A | 104 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/027-route-analytics-ledger-spec.md | A | 101 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/028-adversarial-contract-loop-spec.md | A | 127 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/029-target-intent-boundary-spec.md | A | 117 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/030-ai-layer-bootstrap-spec.md | A | 125 | 0 | .md | docs | ACO_DOC_SPEC | AI_LAYER, ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/assumption-evidence-register.md | A | 12 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/spec-traceability-matrix.md | A | 30 | 0 | .md | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/specs/traceability/aco-traceability.json | A | 1856 | 0 | .json | docs | ACO_DOC_SPEC | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/stabilization/aco-pr-hygiene-report.md | A | 111 | 0 | .md | docs | STABILIZATION_EVIDENCE | ACO | no | unknown | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/stabilization/aco-stabilization-scorecard.json | A | 296 | 0 | .json | docs | STABILIZATION_EVIDENCE | ACO | no | unknown | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/stabilization/aco-stabilization-scorecard.md | A | 154 | 0 | .md | docs | STABILIZATION_EVIDENCE | ACO | no | unknown | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| docs/context-orchestrator/stabilization/context7-mcp-setup-notes.md | A | 55 | 0 | .md | docs | STABILIZATION_EVIDENCE | ACO, MCP | no | unknown | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| eslint.config.mjs | M | 5 | 1 | .mjs | (root) | PACKAGE_BUILD_CONFIG | BUILD_CONFIG | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| package.json | M | 23 | 2 | .json | (root) | PACKAGE_BUILD_CONFIG | BUILD_CONFIG | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| packages/adapters/AGENTS.md | A | 9 | 0 | .md | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/adapters/CLAUDE.md | A | 3 | 0 | .md | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/adapters/package.json | M | 1 | 1 | .json | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/adapters/src/chat/telegram/markdown.test.ts | M | 18 | 0 | .ts | packages | TEST | none | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/adapters/src/community/forge/gitea/adapter.test.ts | M | 4 | 0 | .ts | packages | TEST | none | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/adapters/src/community/forge/gitea/adapter.ts | M | 16 | 3 | .ts | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/adapters/src/community/forge/gitlab/adapter.test.ts | M | 4 | 0 | .ts | packages | TEST | none | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/adapters/src/community/forge/gitlab/adapter.ts | M | 26 | 2 | .ts | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/adapters/src/forge/github/adapter.test.ts | M | 5 | 0 | .ts | packages | TEST | none | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/adapters/src/forge/github/adapter.ts | M | 16 | 4 | .ts | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/cli/AGENTS.md | A | 8 | 0 | .md | packages | CLI_SURFACE | none | no | no | unknown | unknown | no | high | KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| packages/cli/CLAUDE.md | A | 3 | 0 | .md | packages | CLI_SURFACE | none | no | no | unknown | unknown | no | high | KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| packages/cli/package.json | M | 2 | 1 | .json | packages | CLI_SURFACE | none | no | no | unknown | unknown | no | high | KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| packages/cli/src/cli.ts | M | 254 | 0 | .ts | packages | CLI_SURFACE | none | no | no | unknown | unknown | no | high | KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| packages/cli/src/commands/aco.test.ts | A | 141 | 0 | .ts | packages | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/cli/src/commands/aco.ts | A | 60 | 0 | .ts | packages | CLI_SURFACE | ACO | no | no | unknown | unknown | no | high | KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| packages/cli/src/commands/context.test.ts | A | 337 | 0 | .ts | packages | TEST | none | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/cli/src/commands/context.ts | A | 367 | 0 | .ts | packages | CLI_SURFACE | none | no | no | unknown | unknown | no | high | KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| packages/cli/tsconfig.json | M | 4 | 0 | .json | packages | CLI_SURFACE | none | no | no | unknown | unknown | no | high | KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| packages/context-orchestrator/AGENTS.md | A | 9 | 0 | .md | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/CLAUDE.md | A | 3 | 0 | .md | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/package.json | A | 26 | 0 | .json | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/policies/prompt-package/fixtures/invalid-malformed-shape.json | A | 14 | 0 | .json | packages | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/context-orchestrator/policies/prompt-package/fixtures/invalid-missing-acceptance.json | A | 44 | 0 | .json | packages | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/context-orchestrator/policies/prompt-package/fixtures/invalid-missing-security.json | A | 48 | 0 | .json | packages | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/context-orchestrator/policies/prompt-package/fixtures/invalid-secret-like-value.json | A | 53 | 0 | .json | packages | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/context-orchestrator/policies/prompt-package/fixtures/valid-minimal.json | A | 62 | 0 | .json | packages | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/context-orchestrator/policies/prompt-package/fixtures/warn-graph-waiver.json | A | 52 | 0 | .json | packages | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/context-orchestrator/policies/prompt-package/fixtures/warn-unresolved-docs.json | A | 58 | 0 | .json | packages | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/context-orchestrator/policies/prompt-package/prompt_package.rego | A | 176 | 0 | .rego | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/policies/prompt-package/prompt_package_test.rego | A | 128 | 0 | .rego | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/src/acceptance.ts | A | 47 | 0 | .ts | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/src/approval-capsule.test.ts | A | 206 | 0 | .ts | packages | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/context-orchestrator/src/approval-capsule.ts | A | 716 | 0 | .ts | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/src/artifact-package.ts | A | 63 | 0 | .ts | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/src/bmad.ts | A | 210 | 0 | .ts | packages | PRODUCT_CODE | BMAD, ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/src/capabilities.ts | A | 43 | 0 | .ts | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/src/caveman.ts | A | 17 | 0 | .ts | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/src/compiler.ts | A | 754 | 0 | .ts | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/src/context-orchestrator.test.ts | A | 662 | 0 | .ts | packages | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/context-orchestrator/src/decision-dossier.test.ts | A | 267 | 0 | .ts | packages | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/context-orchestrator/src/decision-dossier.ts | A | 642 | 0 | .ts | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/src/docs.ts | A | 194 | 0 | .ts | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/src/evidence-closure.test.ts | A | 209 | 0 | .ts | packages | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/context-orchestrator/src/evidence-closure.ts | A | 236 | 0 | .ts | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/src/graph-waiver-closure.test.ts | A | 229 | 0 | .ts | packages | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/context-orchestrator/src/graph-waiver-closure.ts | A | 822 | 0 | .ts | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/src/graph.ts | A | 124 | 0 | .ts | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/src/index.ts | A | 264 | 0 | .ts | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/src/intent.ts | A | 66 | 0 | .ts | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/src/ledgers.test.ts | A | 515 | 0 | .ts | packages | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/context-orchestrator/src/ledgers.ts | A | 1791 | 0 | .ts | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/src/next-decision.test.ts | A | 179 | 0 | .ts | packages | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/context-orchestrator/src/next-decision.ts | A | 346 | 0 | .ts | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/src/policy-decision.ts | A | 353 | 0 | .ts | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/src/route-analytics.test.ts | A | 319 | 0 | .ts | packages | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/context-orchestrator/src/route-analytics.ts | A | 363 | 0 | .ts | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/src/schemas/adversarial-contract-loop.ts | A | 210 | 0 | .ts | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/src/schemas/approval-capsule.ts | A | 135 | 0 | .ts | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/src/schemas/approval-contract.test.ts | A | 162 | 0 | .ts | packages | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/context-orchestrator/src/schemas/approval-contract.ts | A | 328 | 0 | .ts | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/src/schemas/next-decision.ts | A | 81 | 0 | .ts | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/src/schemas/route-analytics.ts | A | 61 | 0 | .ts | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/src/schemas/target-intent-boundary.ts | A | 219 | 0 | .ts | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/src/security.ts | A | 161 | 0 | .ts | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/src/status.test.ts | A | 105 | 0 | .ts | packages | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/context-orchestrator/src/status.ts | A | 189 | 0 | .ts | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/src/target-intent-boundary.ts | A | 580 | 0 | .ts | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/src/telemetry.test.ts | A | 218 | 0 | .ts | packages | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/context-orchestrator/src/telemetry.ts | A | 208 | 0 | .ts | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/src/types.ts | A | 541 | 0 | .ts | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/src/validation.ts | A | 259 | 0 | .ts | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/context-orchestrator/tsconfig.json | A | 8 | 0 | .json | packages | PRODUCT_CODE | ACO | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/core/AGENTS.md | A | 9 | 0 | .md | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/core/CLAUDE.md | A | 3 | 0 | .md | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/core/package.json | M | 2 | 0 | .json | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/core/src/config/config-loader.test.ts | M | 62 | 62 | .ts | packages | TEST | none | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/core/src/config/index.ts | M | 1 | 0 | .ts | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/core/src/config/resolve-assistant.test.ts | A | 108 | 0 | .ts | packages | TEST | none | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/core/src/config/resolve-assistant.ts | A | 63 | 0 | .ts | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/core/src/db/workflow-events.test.ts | M | 40 | 0 | .ts | packages | TEST | none | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/core/src/db/workflow-events.ts | M | 1 | 1 | .ts | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/core/src/handlers/clone.test.ts | M | 69 | 0 | .ts | packages | TEST | none | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/core/src/handlers/clone.ts | M | 23 | 22 | .ts | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/core/src/handlers/command-handler.test.ts | M | 220 | 0 | .ts | packages | TEST | none | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/core/src/handlers/command-handler.ts | M | 225 | 0 | .ts | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/core/src/orchestrator/orchestrator-agent.ts | M | 1 | 0 | .ts | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/core/tsconfig.tsbuildinfo | D | 0 | 1 | .tsbuildinfo | packages | GENERATED_TRANSIENT | none | yes | no | unknown | unknown | yes | low | REMOVE_TRANSIENT | Generated/transient tracked artifact candidate. |
| packages/docs-web/AGENTS.md | A | 8 | 0 | .md | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/docs-web/CLAUDE.md | A | 3 | 0 | .md | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/docs-web/src/content/docs/book/quick-reference.md | M | 16 | 0 | .md | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/docs-web/src/content/docs/book/solidification-review-ledgers.md | A | 159 | 0 | .md | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/docs-web/src/content/docs/getting-started/ai-assistants.md | M | 6 | 3 | .md | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/docs-web/src/content/docs/getting-started/configuration.md | M | 1 | 1 | .md | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/docs-web/src/content/docs/guides/ai-layer-bootstrap.md | A | 141 | 0 | .md | packages | PRODUCT_CODE | AI_LAYER | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/docs-web/src/content/docs/guides/authoring-workflows.md | M | 22 | 0 | .md | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/docs-web/src/content/docs/guides/mcp-servers.md | M | 3 | 3 | .md | packages | PRODUCT_CODE | MCP | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/docs-web/src/content/docs/reference/commands.md | M | 64 | 0 | .md | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/docs-web/src/content/docs/reference/configuration.md | M | 4 | 2 | .md | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/git/AGENTS.md | A | 9 | 0 | .md | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/git/CLAUDE.md | A | 3 | 0 | .md | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/isolation/AGENTS.md | A | 9 | 0 | .md | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/isolation/CLAUDE.md | A | 3 | 0 | .md | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/paths/AGENTS.md | A | 8 | 0 | .md | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/paths/CLAUDE.md | A | 3 | 0 | .md | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/providers/AGENTS.md | A | 10 | 0 | .md | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/providers/CLAUDE.md | A | 3 | 0 | .md | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/providers/src/claude/binary-resolver-dev.test.ts | M | 39 | 7 | .ts | packages | TEST | none | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/providers/src/claude/binary-resolver.test.ts | M | 139 | 23 | .ts | packages | TEST | none | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/providers/src/claude/binary-resolver.ts | M | 69 | 25 | .ts | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/providers/src/codex/binary-resolver.test.ts | M | 30 | 2 | .ts | packages | TEST | none | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/providers/src/codex/binary-resolver.ts | M | 8 | 0 | .ts | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/providers/src/codex/provider.test.ts | M | 148 | 7 | .ts | packages | TEST | none | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/providers/src/codex/provider.ts | M | 83 | 46 | .ts | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/providers/src/community/pi/provider.test.ts | M | 19 | 0 | .ts | packages | TEST | none | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/providers/src/community/pi/provider.ts | M | 16 | 9 | .ts | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/providers/src/mcp/config.ts | M | 12 | 8 | .ts | packages | PRODUCT_CODE | MCP | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/server/AGENTS.md | A | 8 | 0 | .md | packages | SERVER_API_SURFACE | none | no | no | unknown | unknown | no | high | KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| packages/server/CLAUDE.md | A | 3 | 0 | .md | packages | SERVER_API_SURFACE | none | no | no | unknown | unknown | no | high | KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| packages/server/package.json | M | 2 | 1 | .json | packages | SERVER_API_SURFACE | none | no | no | unknown | unknown | no | high | KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| packages/server/src/routes/api.aco.test.ts | A | 596 | 0 | .ts | packages | TEST | none | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/server/src/routes/api.ts | M | 295 | 0 | .ts | packages | SERVER_API_SURFACE | none | no | no | unknown | unknown | no | high | KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| packages/server/src/routes/schemas/aco.schemas.test.ts | A | 15 | 0 | .ts | packages | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/server/src/routes/schemas/aco.schemas.ts | A | 305 | 0 | .ts | packages | SERVER_API_SURFACE | ACO | no | no | unknown | unknown | no | high | KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| packages/server/tsconfig.tsbuildinfo | D | 0 | 1 | .tsbuildinfo | packages | GENERATED_TRANSIENT | none | yes | no | unknown | unknown | yes | low | REMOVE_TRANSIENT | Generated/transient tracked artifact candidate. |
| packages/web/AGENTS.md | A | 8 | 0 | .md | packages | WEB_UI_SURFACE | none | no | no | unknown | unknown | no | high | KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| packages/web/CLAUDE.md | A | 3 | 0 | .md | packages | WEB_UI_SURFACE | none | no | no | unknown | unknown | no | high | KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| packages/web/src/App.tsx | M | 2 | 0 | .tsx | packages | WEB_UI_SURFACE | none | no | no | unknown | unknown | no | high | KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| packages/web/src/components/dashboard/WorkflowRunCard.tsx | M | 25 | 1 | .tsx | packages | WEB_UI_SURFACE | none | no | no | unknown | unknown | no | high | KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| packages/web/src/components/layout/TopNav.tsx | M | 2 | 1 | .tsx | packages | WEB_UI_SURFACE | none | no | no | unknown | unknown | no | high | KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| packages/web/src/components/workflows/WorkflowExecution.tsx | M | 137 | 5 | .tsx | packages | WEB_UI_SURFACE | none | no | no | unknown | unknown | no | high | KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| packages/web/src/lib/aco-readiness.test.ts | A | 200 | 0 | .ts | packages | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/web/src/lib/aco-readiness.ts | A | 114 | 0 | .ts | packages | WEB_UI_SURFACE | ACO | no | no | unknown | unknown | no | high | KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| packages/web/src/lib/aco-status.test.ts | A | 139 | 0 | .ts | packages | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/web/src/lib/api.generated.d.ts | M | 596 | 4 | .ts | packages | WEB_UI_SURFACE | none | yes | no | unknown | unknown | no | high | KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| packages/web/src/lib/api.ts | M | 43 | 0 | .ts | packages | WEB_UI_SURFACE | none | no | no | unknown | unknown | no | high | KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| packages/web/src/routes/AcoStatusPage.test.ts | A | 26 | 0 | .ts | packages | TEST | none | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/web/src/routes/AcoStatusPage.tsx | A | 561 | 0 | .tsx | packages | WEB_UI_SURFACE | none | no | no | unknown | unknown | no | high | KEEP | Initial Phase 3 classification; Phase 4/6 must verify. |
| packages/workflows/AGENTS.md | A | 9 | 0 | .md | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/workflows/CLAUDE.md | A | 3 | 0 | .md | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/workflows/src/dag-executor.test.ts | M | 418 | 5 | .ts | packages | TEST | none | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/workflows/src/dag-executor.ts | M | 97 | 59 | .ts | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/workflows/src/defaults/bundled-defaults.generated.ts | M | 26 | 4 | .ts | packages | PRODUCT_CODE | none | yes | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/workflows/src/executor-shared.test.ts | M | 133 | 0 | .ts | packages | TEST | none | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/workflows/src/executor-shared.ts | M | 80 | 1 | .ts | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/workflows/src/executor.ts | M | 10 | 96 | .ts | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/workflows/src/loader.test.ts | M | 25 | 0 | .ts | packages | TEST | none | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/workflows/src/schemas/dag-node.ts | M | 5 | 0 | .ts | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/workflows/src/store.ts | M | 1 | 0 | .ts | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| packages/workflows/src/validator.test.ts | M | 38 | 0 | .ts | packages | TEST | none | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| packages/workflows/src/validator.ts | M | 26 | 1 | .ts | packages | PRODUCT_CODE | none | no | no | unknown | unknown | no | high | KEEP | Product code kept by default; analyze coverage later. |
| scripts/context-orchestrator/validate-traceability.ts | A | 543 | 0 | .ts | scripts | UNKNOWN | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| scripts/policy/validate-aco-policy.ts | A | 178 | 0 | .ts | scripts | UNKNOWN | ACO | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| scripts/research/bootstrap-upstreams.ts | A | 452 | 0 | .ts | scripts | UNKNOWN | none | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| scripts/research/common.ts | A | 490 | 0 | .ts | scripts | UNKNOWN | none | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| scripts/research/graph-upstreams.ts | A | 250 | 0 | .ts | scripts | UNKNOWN | none | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| scripts/research/merge-graphs.ts | A | 188 | 0 | .ts | scripts | UNKNOWN | none | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| scripts/research/render-graph-evidence-docs.ts | A | 294 | 0 | .ts | scripts | UNKNOWN | none | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| scripts/research/render-sdd-scaffold.ts | A | 756 | 0 | .ts | scripts | UNKNOWN | none | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| scripts/research/validate-research-corpus.ts | A | 152 | 0 | .ts | scripts | UNKNOWN | none | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| scripts/tsconfig.json | M | 1 | 1 | .json | scripts | PACKAGE_BUILD_CONFIG | BUILD_CONFIG | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| scripts/validate-ts-navigation.ts | A | 107 | 0 | .ts | scripts | UNKNOWN | none | no | no | unknown | unknown | no | medium | KEEP_WITH_NOTE | Initial Phase 3 classification; Phase 4/6 must verify. |
| tests/acceptance/context-orchestrator/acceptance-planner.acceptance.test.ts | A | 14 | 0 | .ts | tests | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| tests/acceptance/context-orchestrator/adversarial-contract-loop.acceptance.test.ts | A | 234 | 0 | .ts | tests | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| tests/acceptance/context-orchestrator/ai-layer-bootstrap.acceptance.test.ts | A | 135 | 0 | .ts | tests | TEST | AI_LAYER, ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| tests/acceptance/context-orchestrator/api.acceptance.test.ts | A | 42 | 0 | .ts | tests | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| tests/acceptance/context-orchestrator/approval-capsule.acceptance.test.ts | A | 137 | 0 | .ts | tests | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| tests/acceptance/context-orchestrator/archive.acceptance.test.ts | A | 88 | 0 | .ts | tests | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| tests/acceptance/context-orchestrator/bmad.acceptance.test.ts | A | 98 | 0 | .ts | tests | TEST | BMAD, ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| tests/acceptance/context-orchestrator/bootstrap.acceptance.test.ts | A | 39 | 0 | .ts | tests | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| tests/acceptance/context-orchestrator/caveman.acceptance.test.ts | A | 22 | 0 | .ts | tests | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| tests/acceptance/context-orchestrator/cli.acceptance.test.ts | A | 97 | 0 | .ts | tests | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| tests/acceptance/context-orchestrator/codex-hook.acceptance.test.ts | A | 66 | 0 | .ts | tests | TEST | ACO, HOOK | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| tests/acceptance/context-orchestrator/command.acceptance.test.ts | A | 37 | 0 | .ts | tests | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| tests/acceptance/context-orchestrator/compile.acceptance.test.ts | A | 60 | 0 | .ts | tests | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| tests/acceptance/context-orchestrator/discovery.acceptance.test.ts | A | 15 | 0 | .ts | tests | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| tests/acceptance/context-orchestrator/docs.acceptance.test.ts | A | 44 | 0 | .ts | tests | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| tests/acceptance/context-orchestrator/dossier.acceptance.test.ts | A | 31 | 0 | .ts | tests | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| tests/acceptance/context-orchestrator/events.acceptance.test.ts | A | 35 | 0 | .ts | tests | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| tests/acceptance/context-orchestrator/goal-bound-evidence.acceptance.test.ts | A | 73 | 0 | .ts | tests | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| tests/acceptance/context-orchestrator/graph-waiver-closure.acceptance.test.ts | A | 73 | 0 | .ts | tests | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| tests/acceptance/context-orchestrator/graph.acceptance.test.ts | A | 24 | 0 | .ts | tests | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| tests/acceptance/context-orchestrator/next-decision.acceptance.test.ts | A | 234 | 0 | .ts | tests | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| tests/acceptance/context-orchestrator/release.acceptance.test.ts | A | 10 | 0 | .ts | tests | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| tests/acceptance/context-orchestrator/route-analytics.acceptance.test.ts | A | 191 | 0 | .ts | tests | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| tests/acceptance/context-orchestrator/route.acceptance.test.ts | A | 21 | 0 | .ts | tests | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| tests/acceptance/context-orchestrator/security.acceptance.test.ts | A | 108 | 0 | .ts | tests | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| tests/acceptance/context-orchestrator/specs.acceptance.test.ts | A | 234 | 0 | .ts | tests | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| tests/acceptance/context-orchestrator/target-intent-boundary.acceptance.test.ts | A | 239 | 0 | .ts | tests | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |
| tests/acceptance/context-orchestrator/workflow.acceptance.test.ts | A | 70 | 0 | .ts | tests | TEST | ACO | no | no | unknown | unknown | no | medium | KEEP | Test/fixture kept by default; analyze determinism later. |

## Phase 4 Classification Audit

Timestamp: 2026-05-22T18:31:11Z

Allowed-class validation: pass. Every inventory row has exactly one primary classification from the allowed set.

Classification counts:

```txt
ACO_DOC_SPEC: 52
AI_GOVERNANCE_DOC: 16
ARCHON_COMMAND: 20
ARCHON_SCRIPT: 3
ARCHON_WORKFLOW: 5
BMAD_ASSET: 30
CLAUDE_CONFIG: 2
CLI_SURFACE: 7
CODEX_CONFIG: 15
GENERATED_TRANSIENT: 2
HOOK_ASSET: 2
PACKAGE_BUILD_CONFIG: 9
PRODUCT_CODE: 84
RESEARCH_EVIDENCE: 15
SERVER_API_SURFACE: 5
STABILIZATION_EVIDENCE: 7
TEST: 71
UNKNOWN: 12
WEB_UI_SURFACE: 10
```

UNKNOWN paths and reason:

```txt
.archon/config.yaml - Archon config surface has no explicit classification bucket; needs Phase 5/6 inspection.
.archon/maintainer-standup/direction.md - maintainer operational doc outside defaults; needs Phase 5/6 inspection.
scripts/context-orchestrator/validate-traceability.ts - repo validation script outside .archon/scripts; classify after package-script/reference inspection.
scripts/policy/validate-aco-policy.ts - repo policy script outside .archon/scripts; classify after package-script/reference inspection.
scripts/research/bootstrap-upstreams.ts - research script outside .archon/scripts; classify after package-script/reference inspection.
scripts/research/common.ts - shared research script outside .archon/scripts; classify after package-script/reference inspection.
scripts/research/graph-upstreams.ts - research script outside .archon/scripts; classify after package-script/reference inspection.
scripts/research/merge-graphs.ts - research script outside .archon/scripts; classify after package-script/reference inspection.
scripts/research/render-graph-evidence-docs.ts - research script outside .archon/scripts; classify after package-script/reference inspection.
scripts/research/render-sdd-scaffold.ts - research script outside .archon/scripts; classify after package-script/reference inspection.
scripts/research/validate-research-corpus.ts - research validation script outside .archon/scripts; classify after package-script/reference inspection.
scripts/validate-ts-navigation.ts - repo validation script outside .archon/scripts; classify after package-script/reference inspection.
```
