# STAB-002 File Analysis Matrix

## Phase 5 Asset Discovery

Timestamp: 2026-05-22T18:32:24Z

Purpose: record actual repo surfaces before file/group analysis, cleanup decisions, or move/remove actions.

Runtime artifact note: raw `rg` searches against `.archon` also matched `.archon/artifacts/**`. Those are runtime artifacts and are excluded from actionable Phase 5 findings unless specifically called out by tracked diff commands.

## Surface Counts

| Surface | Count | Evidence command | Notes |
| --- | ---: | --- | --- |
| Default workflows | 23 | `find .archon/workflows/defaults -maxdepth 1 -type f \| sort` | Includes changed ACO/AI-layer workflow candidates. |
| Default commands | 55 | `find .archon/commands/defaults -maxdepth 1 -type f \| sort` | Includes 17 `ai-layer-*` commands, `goal.md`, and `solidify-poc.md` candidates. |
| Archon scripts | 15 | `find .archon/scripts -maxdepth 3 -type f \| sort` | 3 changed scripts are AI-layer validation helpers. |
| `_bmad` files | 15 present | `find _bmad -maxdepth 5 -type f \| sort` | 13 changed/tracked candidates; 2 user-local ignored configs present. |
| `.agents` files | 323 | `find .agents -maxdepth 5 -type f \| sort` | 117 files under `.agents/skills/bmad-*` at maxdepth 2. |
| `.codex` files | 17 | `find .codex -maxdepth 5 -type f \| sort` | Added agents, README, hooks.json, and hook script. |
| `.claude` files | 154 | `find .claude -maxdepth 5 -type f \| sort` | Existing Claude assets plus changed `ai-layer-explorer` agent and `scoped-tests` skill. |
| Root package scripts | 44 keys | `node -e "const p=require('./package.json'); console.log(JSON.stringify(p.scripts,null,2))"` | Adds bundled, AI-layer, research, ACO policy, traceability, and acceptance scripts. |

## Changed Asset Surfaces

Changed asset paths from `git diff --name-only origin/dev...HEAD`:

```txt
.archon/commands/defaults/ai-layer-audit.md
.archon/commands/defaults/ai-layer-branch-gate.md
.archon/commands/defaults/ai-layer-completion-audit.md
.archon/commands/defaults/ai-layer-design-lsp-navigation.md
.archon/commands/defaults/ai-layer-design.md
.archon/commands/defaults/ai-layer-endgoal-gate.md
.archon/commands/defaults/ai-layer-goal.md
.archon/commands/defaults/ai-layer-implement.md
.archon/commands/defaults/ai-layer-map-codebase.md
.archon/commands/defaults/ai-layer-preflight.md
.archon/commands/defaults/ai-layer-review.md
.archon/commands/defaults/ai-layer-sdd-atdd-audit.md
.archon/commands/defaults/ai-layer-stop-gate.md
.archon/commands/defaults/ai-layer-study-helpline-lsp.md
.archon/commands/defaults/ai-layer-study-reference.md
.archon/commands/defaults/ai-layer-validate-lsp-navigation.md
.archon/commands/defaults/ai-layer-validate.md
.archon/commands/defaults/goal.md
.archon/commands/defaults/solidify-poc.md
.archon/scripts/check-artifact-completeness.ts
.archon/scripts/check-complete-preconditions.ts
.archon/scripts/validate-branch-name.ts
.archon/workflows/defaults/archon-aco-adversarial-loop.yaml
.archon/workflows/defaults/archon-ai-layer-bootstrap.yaml
.archon/workflows/defaults/archon-refactor-safely.yaml
.archon/workflows/defaults/archon-workflow-builder.yaml
.archon/workflows/defaults/context-orchestrate.yaml
.claude/agents/ai-layer-explorer.md
.claude/skills/scoped-tests/SKILL.md
.codex/README.md
.codex/agents/ai-layer-explorer.toml
.codex/agents/code-reviewer.toml
.codex/agents/code-simplifier.toml
.codex/agents/codebase-analyst.toml
.codex/agents/codebase-explorer.toml
.codex/agents/comment-analyzer.toml
.codex/agents/docs-impact.toml
.codex/agents/pr-test-analyzer.toml
.codex/agents/rulecheck-agent.toml
.codex/agents/sdk-verifier.toml
.codex/agents/silent-failure-hunter.toml
.codex/agents/triage-agent.toml
.codex/agents/type-design-analyzer.toml
.codex/agents/web-researcher.toml
.codex/hooks.json
.codex/hooks/verify-task-list.sh
_bmad/_config/bmad-help.csv
_bmad/_config/files-manifest.csv
_bmad/_config/manifest.yaml
_bmad/_config/skill-manifest.csv
_bmad/bmm/config.yaml
_bmad/bmm/module-help.csv
_bmad/config.toml
_bmad/core/config.yaml
_bmad/core/module-help.csv
_bmad/custom/.gitignore
_bmad/custom/config.toml
_bmad/scripts/resolve_config.py
_bmad/scripts/resolve_customization.py
package.json
```

## Workflow Findings

Default workflow catalog has 23 files. Changed default workflows are:

| Workflow | Diff status | Phase 5 finding | Cleanup relevance |
| --- | --- | --- | --- |
| `.archon/workflows/defaults/archon-aco-adversarial-loop.yaml` | Added | Present in defaults; needs command/script/hook/MCP inspection. | Candidate default workflow; requires Phase 6/8 evidence. |
| `.archon/workflows/defaults/archon-ai-layer-bootstrap.yaml` | Added | Present in defaults; references `ai-layer-*` command family by name in generated bundle evidence. | Branch/bootstrap default candidate; high cleanup relevance. |
| `.archon/workflows/defaults/context-orchestrate.yaml` | Added | Present in defaults; likely ACO product workflow. | Keep candidate if validation/reference evidence supports it. |
| `.archon/workflows/defaults/archon-refactor-safely.yaml` | Modified | Contains per-node `hooks:` blocks. | Hook safety and validation needed. |
| `.archon/workflows/defaults/archon-workflow-builder.yaml` | Modified | Present in defaults; changed lines need Phase 6 inspection. | Validate with workflow checks. |

Existing default workflows with hook blocks:

```txt
.archon/workflows/defaults/archon-refactor-safely.yaml:283,389,532
.archon/workflows/defaults/archon-architect.yaml:102,181,278,345
```

MCP in default workflows:

```txt
.archon/workflows/defaults/archon-smart-pr-review.yaml:126 mcp: .archon/mcp/ntfy.json
```

Phase 5 MCP finding: `.archon/mcp/ntfy.json` is optional and guarded by a `check-ntfy` node according to adjacent workflow text and docs. No repo-local `.archon/mcp/*.json` file was found in this discovery pass.

## Command Findings

Default command catalog has 55 files. Changed command candidates:

| Command/group | Count | Phase 5 finding | Cleanup relevance |
| --- | ---: | --- | --- |
| `.archon/commands/defaults/ai-layer-*.md` | 17 | Added default commands. Search hits show generated bundle includes them and `archon-ai-layer-bootstrap` references them. | High. Needs reference checks before any move. |
| `.archon/commands/defaults/goal.md` | 1 | Added default command for `/goal stabilize-aco-merge-ready` per generated bundle evidence. | High. Branch-specific default candidate. |
| `.archon/commands/defaults/solidify-poc.md` | 1 | Added default command outside named AI-layer list. | Medium/high. Needs product/default intent check. |

## Script Findings

Changed `.archon/scripts`:

| Script | Phase 5 finding | Cleanup relevance |
| --- | --- | --- |
| `.archon/scripts/check-artifact-completeness.ts` | Package script `ai:check-artifacts` references it. | Keep candidate if validation supports. |
| `.archon/scripts/check-complete-preconditions.ts` | Package script `ai:check-complete` references it. | Keep candidate if validation supports. |
| `.archon/scripts/validate-branch-name.ts` | Package script `ai:validate-branch` references it. | Keep candidate if validation supports. |

Package scripts also reference repo-level ACO/research scripts:

```txt
validate:ts-navigation
research:bootstrap
research:update-upstreams
research:ff-upstreams
research:validate-upstreams
research:graph
research:merge-graphs
research:render-graph-docs
research:render-sdd
research:validate-sdd
research:validate-corpus
aco:research
aco:policy:test
aco:policy:fixtures
aco:policy
aco:traceability
aco:test:acceptance
```

## BMAD Findings

Tracked changed `_bmad` paths: 13.

Present but ignored/user-local:

```txt
!! _bmad/config.user.toml
!! _bmad/custom/config.user.toml
```

Phase 5 BMAD evidence:

- `_bmad` contains config, manifests, module help, custom config template, and resolver scripts.
- `.agents/skills/bmad-*` assets are present and numerous; discovery counted 117 files at maxdepth 2.
- `docs/ai/runtime-enforcement-decision.md` explicitly says BMAD-native Archon workflow is deferred for this patch.
- Tests and product code reference BMAD routing and graph waiver IDs such as `graph-waiver.bmad-plugins-marketplace` and `graph-waiver.bmad-sample-data`.

Initial BMAD cleanup posture: keep tracked BMAD sync/config assets unless Phase 6/8 proves local leakage or unsafe generated state. Do not add native BMAD workflows in cleanup.

## Hook Findings

Project Codex hook:

```txt
.codex/hooks.json: SessionStart
.codex/hooks/verify-task-list.sh: verifies CODEX_TASK_LIST_ID task list
.codex/README.md: documents safe character constraint and path containment
```

Claude settings/hooks surfaces:

```txt
.claude/settings.json: SessionStart, UserPromptSubmit, Stop, SubagentStop, Notification
.claude/agents/rulecheck-agent.md: PreToolUse, PostToolUse, Stop
.claude/agents/triage-agent.md: PostToolUse
.claude/skills/save-task-list/SKILL.md: Stop, PostToolUse
.claude/skills/rulecheck/*: hook examples/scripts
```

Archon per-node hook surfaces:

```txt
.archon/workflows/defaults/archon-refactor-safely.yaml
.archon/workflows/defaults/archon-architect.yaml
```

Hook cleanup posture: contributor-facing hooks and settings are policy-sensitive. Document and likely queue human decision unless evidence proves they are safe defaults.

## MCP Findings

Actionable MCP references:

```txt
.archon/workflows/defaults/archon-smart-pr-review.yaml -> optional .archon/mcp/ntfy.json
docs/ai/agentic-coding-operating-guide.md -> illustrative .archon/mcp/*.json examples
docs/ai/runtime-enforcement-decision.md -> keep MCP user/global only for this patch
docs/ai/bmad-to-archon-mapping.md -> no repo-local MCP configs exist for BMAD or external docs
packages/providers/src/claude/capabilities.ts -> mcp true
packages/providers/src/codex/capabilities.ts -> mcp true
packages/providers/src/community/pi/capabilities.ts -> mcp false
packages/workflows/src/schemas/dag-node.ts -> `mcp` schema field
packages/workflows/src/validator.test.ts -> missing/optional MCP validation behavior
```

No live repo-local `.archon/mcp/*.json` config was discovered. Treat MCP examples as illustrative or guarded optional until validation says otherwise.

## Package Script Findings

New or relevant root scripts from package discovery:

```txt
generate:bundled
check:bundled
check:bundled-skill
validate:ts-navigation
ai:check-artifacts
ai:validate-branch
ai:check-complete
validate
research:*
aco:policy:*
aco:traceability
aco:test:acceptance
```

Validation implication: workflow/default changes require `generate:bundled`, `check:bundled`, `check:bundled-skill`, workflow validation, and command validation. ACO/spec/policy changes require `aco:traceability` and policy checks when policy files remain.

## Phase 6 Early Validation Evidence

Timestamp: 2026-05-22T18:35:43Z

```txt
bun run cli validate workflows --cwd .
Result: pass with warning.
Excerpt: Results: 42 valid, 0 with errors, 1 with warnings.
Warning: archon-smart-pr-review notify node references optional .archon/mcp/ntfy.json; validator reports it guarded by upstream file-existence check.

bun run cli validate commands --cwd .
Result: pass.
Excerpt: Results: 81 valid, 0 with errors.
```

## Phase 6 Bucket-Specific Analysis

Exact group membership: use the Phase 3 inventory table in `stab-002-dev-diff-inventory.md`; each group below is the exact set of rows matching the named primary classification unless specific paths are listed.

### PRODUCT_CODE

Exact grouped set: Phase 3 rows with `Primary classification = PRODUCT_CODE` (84 paths).

Answers:

- Feature/behavior: adds ACO/context-orchestrator core package behavior, workflow execution/hook/MCP support changes, provider resolver/config behavior, adapter fixes, and supporting shared logic.
- ACO/context-orchestrator: yes for `packages/context-orchestrator/**` and related `packages/core`, CLI/server/web integration.
- BMAD sync: indirect for route/ledger/waiver logic and BMAD route exposure.
- General Archon fix: yes for provider/adapters/workflow/runtime changes outside ACO.
- Unrelated scope creep: possible PR-split risk for non-ACO provider/adapter/web/docs-web changes; not a cleanup-delete candidate.
- Tests cover it: package tests and acceptance tests are present in changed TEST group.
- Package script validation: `bun run test`, `bun run type-check`, `bun run validate`, package-specific Bun tests, `aco:test:acceptance`.
- Public API: yes, CLI/server/web API and generated web types changed.
- New dependencies: `bun.lock` and package manifests changed; verify in PACKAGE_BUILD_CONFIG analysis.
- Decision: `KEEP`, with PR-split review later for broad non-ACO fixes.

### TEST

Exact grouped set: Phase 3 rows with `Primary classification = TEST` (71 paths).

Answers:

- Product code covered: ACO package, CLI context/aco commands, server ACO routes/schemas, web ACO readiness/status, workflow hooks/executor/validator, providers/adapters, acceptance scenarios.
- Determinism: mostly deterministic local tests; fixtures under policy prompt-package are static JSON/Rego inputs.
- Type: mix of unit, integration, acceptance, and fixtures.
- Local/generated data: no evidence of machine-local data in test paths from Phase 5; graph waiver IDs are explicit fixtures/evidence.
- Does it pass: not yet fully run; workflow/command validation passed. Full test validation deferred to Phase 14.
- Decision: `KEEP`.

### CLI_SURFACE

Exact grouped set: Phase 3 rows with `Primary classification = CLI_SURFACE` (7 paths).

Answers:

- Behavior: adds/changes CLI context and ACO commands plus package wiring.
- ACO: yes, direct context-orchestrator surface.
- Tests: `packages/cli/src/commands/aco.test.ts`, `packages/cli/src/commands/context.test.ts`, acceptance CLI tests.
- Public API: yes, CLI command contract changes.
- Dependencies: package manifest changed; package config validation needed.
- Decision: `KEEP`.

### SERVER_API_SURFACE

Exact grouped set: Phase 3 rows with `Primary classification = SERVER_API_SURFACE` (5 paths).

Answers:

- Behavior: adds ACO API routes and OpenAPI schemas.
- Tests: `packages/server/src/routes/api.aco.test.ts`, `packages/server/src/routes/schemas/aco.schemas.test.ts`.
- Public API: yes, API schema and web generated type surface changed.
- Validation: server tests, type-check, OpenAPI/generated type drift checks in full validation.
- Decision: `KEEP`.

### WEB_UI_SURFACE

Exact grouped set: Phase 3 rows with `Primary classification = WEB_UI_SURFACE` (10 paths).

Answers:

- Behavior: adds ACO status/readiness UI and wiring.
- Tests: `packages/web/src/lib/aco-readiness.test.ts`, `packages/web/src/lib/aco-status.test.ts`, `packages/web/src/routes/AcoStatusPage.test.ts`.
- Public API: consumes generated API types.
- Validation: web tests, type-check, build if required by full validation.
- Decision: `KEEP`.

### PACKAGE_BUILD_CONFIG

Exact grouped set: Phase 3 rows with `Primary classification = PACKAGE_BUILD_CONFIG` (9 paths), plus Phase 4 UNKNOWN paths resolved by Phase 6 evidence as repo validation/config script surfaces.

Answers:

- Changed config/scripts: `.github/workflows/test.yml`, root `package.json`, `bun.lock`, `.env.example`, `.gitignore`, `.prettierignore`, `eslint.config.mjs`, package manifests/tsconfigs, `.archon/config.yaml`, and repo scripts under `scripts/**`.
- Required by product code: yes for ACO/package scripts, generated/bundled checks, policy, traceability, TS navigation.
- Affects contributors: yes, root scripts, CI, `.gitignore`, and package configs.
- OPA/policy: yes, `aco:policy:*` and `packages/context-orchestrator/policies/**`.
- Global vs path-scoped: CI/policy scope needs later human decision; do not weaken gates without approval.
- Validated: command/workflow validation passed; full `bun run validate`, policy, traceability, and format checks deferred.
- Decision: `KEEP_WITH_NOTE`; CI/OPA gate scope goes to human decision queue.

### ARCHON_WORKFLOW

Exact grouped set: changed workflow paths listed in Phase 5 Workflow Findings.

Answers:

| Workflow | Product-facing | Bootstrap/stabilization-only | Commands/scripts | Hooks | MCP | Approvals/loops/artifacts | Validation | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `.archon/workflows/defaults/context-orchestrate.yaml` | yes, ACO product workflow | no | `bun run cli context status/ledgers/compile/approval-capsule` | no | no | approvals for graph readiness; writes `$ARTIFACTS_DIR/context-orchestrator` | ok | `KEEP` |
| `.archon/workflows/defaults/archon-aco-adversarial-loop.yaml` | likely yes, ACO quality workflow | no/unknown | `bun run cli context *`; prompt nodes | no | no | approval gate; planner/contract/generator/evaluator loop artifacts | ok | `KEEP_WITH_NOTE`, confirm default intent later |
| `.archon/workflows/defaults/archon-ai-layer-bootstrap.yaml` | operational/bootstrap-facing | likely bootstrap-only | 17 `ai-layer-*` commands | no | no | writes `$ARTIFACTS_DIR/ai-layer` | ok | `REQUIRES_HUMAN_DECISION` for default status |
| `.archon/workflows/defaults/archon-refactor-safely.yaml` | yes, existing product default | no | Bash/prompt nodes | yes | no | PR creation path, validation, hooks | ok | `KEEP` |
| `.archon/workflows/defaults/archon-workflow-builder.yaml` | yes, existing product default | no | Bash/prompt nodes | no | no | validates generated YAML | ok | `KEEP` |

Moving any default workflow requires bundled regeneration and workflow/command validation.

### ARCHON_COMMAND

Exact grouped set: Phase 3 rows with `Primary classification = ARCHON_COMMAND` (20 paths).

Answers:

- Product-facing: core `archon-*` commands are product-facing; `ai-layer-*`, `goal.md`, and `solidify-poc.md` need default-intent review.
- Used by default workflow: all 17 `ai-layer-*` commands are referenced by `archon-ai-layer-bootstrap`.
- Branch-specific/bootstrap-only: `goal.md` explicitly supports `/goal stabilize-aco-merge-ready`; `ai-layer-*` commands are AI-layer bootstrap operational scaffolding; `solidify-poc` is read-only POC review command.
- Referenced by generated bundles: yes, generated defaults include `ai-layer-*`, `goal`, and workflow references.
- Can move without breaking validation: not without updating/removing `archon-ai-layer-bootstrap` references and regenerating bundled defaults.
- Decision: core command additions remain `KEEP_WITH_NOTE`; `ai-layer-*`, `goal.md`, and `solidify-poc.md` are `REQUIRES_HUMAN_DECISION` until Phase 8/9/10 decide default vs example/stabilization.

### ARCHON_SCRIPT

Exact grouped set: Phase 3 rows with `Primary classification = ARCHON_SCRIPT` (3 paths).

Answers:

| Script | Referenced by package script | Purpose | Destructive | Decision |
| --- | --- | --- | --- | --- |
| `.archon/scripts/check-artifact-completeness.ts` | `ai:check-artifacts` | Read-only artifact heading validation. | no | `KEEP` |
| `.archon/scripts/check-complete-preconditions.ts` | `ai:check-complete` | Branch/worktree precondition check; no cleanup run. | no | `KEEP` |
| `.archon/scripts/validate-branch-name.ts` | `ai:validate-branch` | Branch-name safety validation. | no | `KEEP` |

### AI_GOVERNANCE_DOC

Exact grouped set: Phase 3 rows with `Primary classification = AI_GOVERNANCE_DOC` (16 paths).

Answers:

- Evergreen governance: README, operating guide, compliance matrix, BMAD mapping, workflow validation, security, worktree lifecycle, source traceability, artifact schema, DRI ownership, runtime decision/ledger.
- Branch-specific evidence: `docs/ai/stab-002-validation-report.md`, `docs/ai/stab-002-runtime-validation-report.md`, and `docs/ai/goals/stab-002-runtime-enforcement.goal.md` are branch/run evidence candidates already classified as stabilization evidence in Phase 3.
- Links: `docs/ai/README.md` indexes evergreen docs and validation reports.
- Decision: `KEEP_WITH_NOTE` for evergreen docs; STAB reports/goals remain cleanup candidates for move-to-stabilization/history review.

### STABILIZATION_EVIDENCE

Exact grouped set: Phase 3 rows with `Primary classification = STABILIZATION_EVIDENCE` (7 paths).

Answers:

- Compares against origin/dev: Phase 1 inventory now does; older reports require wrong-baseline/historical review in Phase 7.
- Local paths: not yet fully checked; Phase 7 local leakage search required.
- PR evidence: yes for stabilization scorecards/reports and this goal's state artifacts once complete.
- Intended to survive merge: likely as stabilization/history evidence, not evergreen docs.
- Decision: `KEEP_WITH_NOTE` pending Phase 7 leakage/baseline review.

### RESEARCH_EVIDENCE

Exact grouped set: Phase 3 rows with `Primary classification = RESEARCH_EVIDENCE` (15 paths).

Answers:

- Referenced by specs/tests/docs: likely yes for graph evidence, OpenAI/Context7 docs, waivers, upstream manifest; Phase 7 reference check must prove per file.
- Canonical vs generated: mixed; upstream manifest and graph reports look generated evidence; waivers are canonical approval evidence.
- Regenerable: research scripts exist, but graph refresh/waiver cleanup is forbidden without approval.
- Context bloat risk: medium/high.
- Decision: `UNKNOWN_KEEP`; do not remove or refresh without reference checks and user approval where waivers/graph involved.

### BMAD_ASSET

Exact grouped set: Phase 3 rows with `Primary classification = BMAD_ASSET` (30 paths), plus ignored user-local BMAD configs discovered in Phase 5.

Answers:

- Required sync config: `_bmad/config.toml`, `_bmad/_config/*`, `_bmad/bmm/*`, `_bmad/core/*`, resolver scripts.
- Generated manifest intentionally tracked: likely yes; installer-managed and versioned BMAD metadata.
- User-local/machine-local: `_bmad/config.user.toml` and `_bmad/custom/config.user.toml` are present but ignored, not in branch diff.
- Referenced by docs/scripts/workflows: docs mapping and tests reference BMAD; `.agents/skills/bmad-*` executable skill assets are present.
- Need native Archon workflow now: no, runtime decision says defer.
- BMAD mapped/advisory: yes for this merge unless later evidence changes.
- Decision: `KEEP_WITH_NOTE`; keep sync assets, defer BMAD-native workflow, do not mirror into `.claude/skills` without human decision.

### CODEX_CONFIG / CLAUDE_CONFIG / AGENT_CONFIG / HOOK_ASSET

Exact grouped set: Phase 3 rows with `Primary classification in CODEX_CONFIG, CLAUDE_CONFIG, AGENT_CONFIG, HOOK_ASSET` plus inspected `.claude/settings.json` and existing Claude hook surfaces.

Answers:

- Codex hook safety: `.codex/hooks/verify-task-list.sh` treats `CODEX_TASK_LIST_ID` as untrusted, rejects slashes/backslashes/dot-dot/unsafe chars, resolves root with `cd -P`, and checks containment under `CODEX_TASKS_DIR` or `~/.codex/tasks`; no private local tool call.
- Contributor-facing: yes, project hook runs on SessionStart when config loaded.
- Claude settings safety: `.claude/settings.json` contains `kild agent-status` commands for UserPromptSubmit/Stop/Notification and Slack notification hook; this is trust-sensitive/private-tool behavior.
- Changed Claude assets: `.claude/agents/ai-layer-explorer.md` and `.claude/skills/scoped-tests/SKILL.md`; broader Claude settings were inspected but not changed in branch diff.
- Needed by workflows/validation: Codex/Claude agents/skills support operating layer, not required by `bun run cli validate workflows/commands`.
- Decision: changed Codex hooks/agents and Claude AI-layer skill/agent are `REQUIRES_HUMAN_DECISION` for default shipping; preexisting `.claude/settings.json` private-tool hooks go to human decision queue, no edit without approval.

### MCP_ASSET

Exact grouped set: no changed live MCP config files; MCP references discovered in docs/workflows/packages.

Answers:

- MCP config present: no `.archon/mcp/*.json` discovered.
- Optional/guarded: `.archon/workflows/defaults/archon-smart-pr-review.yaml` optional `.archon/mcp/ntfy.json` is guarded by `check-ntfy`; validator warns but passes.
- Secrets/env vars: no live repo-local MCP secrets found in Phase 5.
- Read-only/human approval: docs say user/global only and require env vars/approval for write-capable MCP.
- Product-facing vs local: currently illustrative/optional only.
- Decision: `KEEP_WITH_NOTE`; do not add live MCP configs.

### GENERATED_TRANSIENT

Exact grouped set: Phase 3 rows with `Primary classification = GENERATED_TRANSIENT` (2 paths).

Answers:

- Intentionally versioned: no, `packages/core/tsconfig.tsbuildinfo` and `packages/server/tsconfig.tsbuildinfo` are TypeScript build cache files.
- Required by tests: no evidence.
- Ignored by `.gitignore`: branch changes update ignore policy; verify later.
- Can regenerate: yes via TypeScript.
- Decision: `REMOVE_TRANSIENT`; branch already deletes these files relative to `origin/dev`.

### UNKNOWN

Exact grouped set: Phase 4 UNKNOWN paths (12 paths).

Resolved analysis:

- `.archon/config.yaml`: Archon repo config; `KEEP_WITH_NOTE`, package/build config surface.
- `.archon/maintainer-standup/direction.md`: maintainer/product direction doc; `KEEP_WITH_NOTE`.
- `scripts/context-orchestrator/validate-traceability.ts`: ACO traceability validation; `KEEP`.
- `scripts/policy/validate-aco-policy.ts`: ACO policy fixture validator; `KEEP`.
- `scripts/research/*.ts`: research/graph/evidence generation; `KEEP_WITH_NOTE`, graph refresh remains approval-sensitive.
- `scripts/validate-ts-navigation.ts`: TypeScript navigation validation; `KEEP`.

No UNKNOWN path is safe to remove based on Phase 6 evidence.

## Phase 7 Specific Candidate Searches

Timestamp: 2026-05-22T18:41:05Z

### Branch-specific goal/default commands

Commands run:

- `test -f .archon/commands/defaults/goal.md && sed -n '1,260p' .archon/commands/defaults/goal.md || true`
- `find .archon/commands/defaults -maxdepth 1 -type f -name 'ai-layer-*.md' -print | sort || true`
- `sed -n '1,140p'` for each `.archon/commands/defaults/ai-layer-*.md`
- `rg -n "stabilize-aco-merge-ready|/goal|goal.md|ai-layer-|AI Layer|bootstrap|branch gate|endgoal|stop gate" .archon docs packages tests scripts package.json .claude .codex .agents _bmad || true`

Findings:

- `.archon/commands/defaults/goal.md` is present and supports the specific invocation `/goal stabilize-aco-merge-ready`; it describes ACO stabilization gates rather than a general Archon product command.
- Seventeen `.archon/commands/defaults/ai-layer-*.md` files are present.
- `packages/workflows/src/defaults/bundled-defaults.generated.ts` embeds the `goal` and `ai-layer-*` commands, so moving/removing them requires `bun run generate:bundled` plus bundled/command/workflow validation.
- `tests/acceptance/context-orchestrator/ai-layer-bootstrap.acceptance.test.ts`, `docs/ai/bmad-to-archon-mapping.md`, and generated defaults reference `ai-layer-*`; default status cannot be changed without updating those references or deferring to human decision.
- Initial decision remains `REQUIRES_HUMAN_DECISION` for default shipping of `goal.md` and `ai-layer-*`; reference checks continue in Phase 8.

### Branch-specific workflows

Commands run:

- `test -f .archon/workflows/defaults/archon-ai-layer-bootstrap.yaml && sed -n '1,320p' .archon/workflows/defaults/archon-ai-layer-bootstrap.yaml || true`
- `test -f .archon/workflows/defaults/context-orchestrate.yaml && sed -n '1,320p' .archon/workflows/defaults/context-orchestrate.yaml || true`
- `test -f .archon/workflows/defaults/archon-aco-adversarial-loop.yaml && sed -n '1,320p' .archon/workflows/defaults/archon-aco-adversarial-loop.yaml || true`
- `rg -n "archon-ai-layer-bootstrap|context-orchestrate|archon-aco-adversarial-loop|ai-layer-bootstrap|bootstrap" .archon docs packages tests scripts package.json || true`

Findings:

- `archon-ai-layer-bootstrap.yaml` is present and wires the `ai-layer-*` command sequence for bootstrap/study/design/implementation/validation. It is product-adjacent but branch/bootstrap-specific by purpose.
- `context-orchestrate.yaml` is present and is the ACO product workflow. Acceptance tests validate its existence and local workflow validation.
- `archon-aco-adversarial-loop.yaml` is present, has acceptance coverage, and is referenced as an ACO quality/adversarial workflow.
- Moving any default workflow requires generated default regeneration and workflow/command/bundle validation.
- Initial decisions: `context-orchestrate` = `KEEP`; `archon-aco-adversarial-loop` = `KEEP_WITH_NOTE`; `archon-ai-layer-bootstrap` = `REQUIRES_HUMAN_DECISION`.

### Local leakage and wrong-baseline evidence

Commands run:

- `rg -n --hidden --glob '!.git/**' --glob '!node_modules/**' --glob '!**/.archon/artifacts/**' "/Users/|Downloads/|file://|localhost:[0-9]+|/tmp/" . || true`
- `git diff --name-only origin/dev...HEAD | xargs rg -n "/Users/|Downloads/|file://|localhost:[0-9]+|/tmp/" -- || true`
- `rg -n --hidden --glob '!.git/**' --glob '!node_modules/**' --glob '!**/.archon/artifacts/**' "stab-002-sdd-atdd-alignment-upstream-dev|target branch|baseline|origin/dev|dev\\.\\.\\." docs/context-orchestrator docs/ai . || true`
- `git diff --name-only origin/dev...HEAD | xargs rg -n "stab-002-sdd-atdd-alignment-upstream-dev|target branch|baseline|origin/dev|dev\\.\\.\\." -- || true`

Findings:

- Actionable local leakage in changed stabilization evidence:
  - `docs/context-orchestrator/stabilization/aco-stabilization-scorecard.json` contained a machine-local supplemental report path before Batch 1 cleanup.
  - `docs/context-orchestrator/stabilization/aco-stabilization-scorecard.md` cited the same machine-local supplemental report path before Batch 1 cleanup.
  - `docs/context-orchestrator/stabilization/aco-pr-hygiene-report.md` cited the same machine-local supplemental report path before Batch 1 cleanup.
- Wrong-baseline evidence in changed stabilization evidence:
  - `docs/context-orchestrator/stabilization/aco-stabilization-scorecard.json` used an earlier non-`origin/dev` PR review target and commands based on that target before Batch 1 cleanup.
  - `docs/context-orchestrator/stabilization/aco-stabilization-scorecard.md` used the same earlier non-`origin/dev` target and command before Batch 1 cleanup.
  - `docs/context-orchestrator/stabilization/aco-pr-hygiene-report.md` used the same earlier non-`origin/dev` target and command before Batch 1 cleanup.
- Many `/tmp` and `localhost` hits are intentional tests, fixtures, examples, docs, or CI checks. They are not cleanup candidates unless Phase 8 finds a changed branch-specific evidence file using them incorrectly.
- `rg` against changed paths reported missing deleted files for `packages/core/tsconfig.tsbuildinfo` and `packages/server/tsconfig.tsbuildinfo`; those are already deleted in the branch.
- Proposed decisions: local path references above = `REMOVE_LOCAL_LEAKAGE` or replace with repo-relative/historical wording; wrong-baseline reports = `MOVE_TO_HISTORY` or relabel as historical rather than final merge evidence.

### Transient/generated tracked files

Command run:

- `git ls-files | rg '(^_bmad-output/|^\\.history/|tsconfig\\.tsbuildinfo|/\\.archon/artifacts/|/research/upstreams/|graphify-out/|\\.DS_Store|\\.log$)' || true`

Findings:

- No matching tracked transient files are present in the current worktree output.
- The branch deletes two tracked TypeScript build-info files relative to `origin/dev`: `packages/core/tsconfig.tsbuildinfo` and `packages/server/tsconfig.tsbuildinfo`.
- Decision remains `REMOVE_TRANSIENT` for the deleted `tsconfig.tsbuildinfo` files.

### Research evidence bloat

Commands run:

- `find docs/context-orchestrator/research -maxdepth 2 -type f | sort || true`
- For each research file, search its basename across `docs packages scripts tests .archon _bmad package.json`.

Findings:

- Fifteen research files are present:
  - `docs/context-orchestrator/research/archon-graph-report.md`
  - `docs/context-orchestrator/research/bmad-graph-report.md`
  - `docs/context-orchestrator/research/bootstrap-acceptance-scenarios.md`
  - `docs/context-orchestrator/research/caveman-graph-report.md`
  - `docs/context-orchestrator/research/caveman-principles.md`
  - `docs/context-orchestrator/research/codex-graph-report.md`
  - `docs/context-orchestrator/research/codex-official-docs.md`
  - `docs/context-orchestrator/research/context7-graph-report.md`
  - `docs/context-orchestrator/research/context7-mcp.md`
  - `docs/context-orchestrator/research/graph-evidence-index.md`
  - `docs/context-orchestrator/research/graph-open-questions.md`
  - `docs/context-orchestrator/research/merged-ecosystem-report.md`
  - `docs/context-orchestrator/research/openai-docs-mcp.md`
  - `docs/context-orchestrator/research/upstream-manifest.json`
  - `docs/context-orchestrator/research/waivers.md`
- Basename reference search marked all fifteen as referenced.
- Graph refresh and waiver cleanup remain explicitly forbidden without approval.
- Decision remains `UNKNOWN_KEEP`/`KEEP_WITH_NOTE`; no research evidence is safe to remove in this cleanup without a more specific human decision.

### BMAD assets

Commands run:

- `find _bmad -maxdepth 5 -type f | sort || true`
- `find .agents -maxdepth 5 -type f | sort || true`
- `git diff --name-status origin/dev...HEAD -- _bmad .agents || true`
- `rg -n "_bmad|bmad|BMAD|bmm|story|prd|architect|correct-course" _bmad .agents .archon docs packages scripts tests package.json || true`

Findings:

- Tracked changed `_bmad` files are installer/config/manifest assets under `_bmad/_config`, `_bmad/bmm`, `_bmad/core`, `_bmad/custom`, and `_bmad/scripts`.
- `_bmad/config.user.toml` and `_bmad/custom/config.user.toml` exist locally but are ignored and are not part of the branch diff.
- `.agents/skills/bmad-*` executable skill assets are present in repo scope and referenced by `docs/ai/bmad-to-archon-mapping.md`.
- Evidence supports BMAD remaining mapped/advisory for this merge; native BMAD workflows are deferred.
- Decision remains `KEEP_WITH_NOTE` for tracked BMAD sync assets; mirroring into `.claude/skills` is a human decision.

### Codex/Claude/agent config

Commands run:

- `find .codex -maxdepth 5 -type f -print -exec sed -n '1,220p' {} \\; 2>/dev/null || true`
- `find .claude -maxdepth 5 -type f -print | sort || true`
- `sed -n '1,220p' .claude/settings.json 2>/dev/null || true`
- `sed -n '1,220p' .claude/agents/ai-layer-explorer.md 2>/dev/null || true`
- `sed -n '1,220p' .claude/skills/scoped-tests/SKILL.md 2>/dev/null || true`
- `find .agents -maxdepth 5 -type f -print | sort || true`
- `rg -n --hidden --glob '!.git/**' --glob '!node_modules/**' --glob '!**/.archon/artifacts/**' "CODEX_TASK_LIST_ID|SessionStart|hooks.json|verify-task-list|private local tools|hooks|permissions|deny|skills|agents|PreToolUse|PostToolUse" .codex .claude CLAUDE.md docs .archon package.json || true`

Findings:

- `.codex/hooks.json` installs a `SessionStart` command hook pointing at `.codex/hooks/verify-task-list.sh`.
- `.codex/hooks/verify-task-list.sh` treats `CODEX_TASK_LIST_ID` as untrusted input, rejects unsafe characters and path traversal, resolves real paths, and checks containment under `CODEX_TASKS_DIR` or `~/.codex/tasks`.
- `.codex/README.md` documents that default project hooks must not invoke private local tools and optional integrations must be environment-gated and command-checked.
- `.claude/settings.json` contains project hooks that run private/local `kild agent-status` commands on `UserPromptSubmit`, `Stop`, and `Notification`, plus a Slack notification hook on `SubagentStop`.
- `.claude/agents/ai-layer-explorer.md` is read-only and branch/AI-layer specific.
- `.claude/skills/scoped-tests/SKILL.md` is useful validation guidance but shipping it as project default remains contributor-policy sensitive.
- Decisions remain `REQUIRES_HUMAN_DECISION` for `.codex` hook/agent defaults and changed Claude agent/skill defaults. Existing `.claude/settings.json` private hooks must be captured in the human decision queue; no edit without approval.

### MCP

Commands run:

- `find .archon -maxdepth 5 -type f | rg '/mcp/|mcp' || true`
- `rg -n --hidden --glob '!.git/**' --glob '!node_modules/**' --glob '!**/.archon/artifacts/**' "mcp:|MCP|ntfy|context7|github.*mcp|linear|jira" .archon docs packages scripts tests package.json .claude .codex .agents || true`

Findings:

- No live repo-local `.archon/mcp/*.json` config file is present.
- `find .archon ... | rg '/mcp/|mcp'` only surfaced `.archon/artifacts/...` runtime artifacts; those are not product defaults and should not be committed.
- Docs intentionally describe MCP as user/global or illustrative where config files are absent.
- The only validator warning remains guarded optional `.archon/mcp/ntfy.json` in `archon-smart-pr-review`.
- Decision remains `KEEP_WITH_NOTE`; do not add live MCP configs during cleanup.

### CI/policy/package scripts

Commands run:

- `git diff origin/dev...HEAD -- .github/workflows package.json scripts packages tests | sed -n '1,420p'`
- `rg -n "opa|aco:policy|aco:traceability|aco:test|check:bundled|validate" .github package.json scripts packages tests || true`

Findings:

- `.github/workflows/test.yml` adds OPA setup, rejects `ARCHON_SKIP_OPA=1` in CI, runs `bun run aco:policy`, and runs `bun run aco:traceability` before typecheck.
- `package.json` adds `validate:ts-navigation`, AI check scripts, ACO policy/traceability/acceptance scripts, and research scripts; `bun run validate` now includes `aco:traceability`.
- Policy/traceability scripts and acceptance tests are present under `scripts/policy`, `scripts/context-orchestrator`, `packages/context-orchestrator`, and `tests/acceptance/context-orchestrator`.
- CI gate scope is policy-sensitive. Decision: `KEEP_WITH_NOTE` for scripts/config while adding CI/OPA required-vs-path-scoped question to the human decision queue.

### README/workflow count drift

Command run:

- `rg -n --hidden --glob '!.git/**' --glob '!node_modules/**' --glob '!**/.archon/artifacts/**' "workflow|workflows|default workflows|42|55|23|17|bundled" README.md docs package.json .archon packages || true`

Findings:

- `README.md` avoids a hardcoded exact workflow count and says local checkouts may load bundled, test, internal, or repo-local workflows; use `bun run cli workflow list --cwd .` for the exact current count.
- Current asset discovery found 23 repo default workflow files and 55 repo default command files, while validation reports 42 workflows and 81 commands after bundled/global discovery.
- No README count cleanup is required at this phase.

## Phase 8 Reference Checks Before Move/Remove/Split

Timestamp: 2026-05-22T18:46:00Z

### Commands run

- Automated reference pass over every Phase 3 row whose initial decision was not `KEEP`, using fixed-string searches for each path, basename, and stem, excluding `.git`, `node_modules`, and `.archon/artifacts`.
- `rg -n --fixed-strings "archon-ai-layer-bootstrap" .archon docs packages tests scripts package.json .claude .codex .agents _bmad || true`
- `rg -n --fixed-strings "ai-layer-" .archon docs packages tests scripts package.json .claude .codex .agents _bmad || true`
- `rg -n --fixed-strings "stabilize-aco-merge-ready" .archon docs packages tests scripts package.json .claude .codex .agents _bmad || true`
- `rg -n --fixed-strings "solidify-poc" .archon docs packages tests scripts package.json .claude .codex .agents _bmad || true`
- `rg -n --fixed-strings "docs/ai/stab-002-validation-report.md" . || true`
- `rg -n --fixed-strings "docs/ai/stab-002-runtime-validation-report.md" . || true`
- `rg -n --fixed-strings "docs/ai/goals/stab-002-runtime-enforcement.goal.md" . || true`
- Fixed-string reference check for the original machine-local supplemental report path in `docs/context-orchestrator/stabilization` and `docs/ai`.
- Fixed-string reference check for the original earlier PR review branch in `docs/context-orchestrator/stabilization` and `docs/ai`.
- `rg -n --fixed-strings ".codex/hooks/verify-task-list.sh" . || true`
- `rg -n --fixed-strings ".codex/hooks.json" . || true`
- `rg -n --fixed-strings ".claude/agents/ai-layer-explorer.md" . || true`
- `rg -n --fixed-strings ".claude/skills/scoped-tests/SKILL.md" . || true`
- `rg -n --fixed-strings "archon-aco-adversarial-loop" .archon docs packages tests scripts package.json || true`
- `rg -n --fixed-strings "context-orchestrate" .archon docs packages tests scripts package.json || true`
- `git ls-files .archon/artifacts | wc -l`

### Reference summary by cleanup group

| Path or group | Reference status | Decision impact |
|---|---|---|
| `context-orchestrate` workflow | Strongly referenced by slash command handler, acceptance tests, specs, traceability, docs, and generated defaults. | Keep as product ACO workflow. Moving would break product behavior and tests. |
| `archon-aco-adversarial-loop` workflow | Referenced by acceptance tests, specs, traceability, `docs/ai` mapping/compliance docs, and generated defaults. | Keep or human-review as product default; do not move without updating traceability/tests/docs and regenerating defaults. |
| `archon-ai-layer-bootstrap` workflow | Referenced by acceptance tests, docs, BMAD mapping, workflow compliance matrix, generated defaults, and docs-web guide. | Not safe to move in this batch. Default status remains `REQUIRES_HUMAN_DECISION`; moving requires coordinated tests/docs/bundle updates. |
| `.archon/commands/defaults/ai-layer-*` | Referenced by `archon-ai-layer-bootstrap`, acceptance tests, docs, generated defaults, and docs-web guide. | Not safe to move independently. Treat as coupled to bootstrap workflow decision. |
| `.archon/commands/defaults/goal.md` | `/goal stabilize-aco-merge-ready` referenced by tests, `packages/context-orchestrator/src/bmad.ts`, stabilization evidence, and generated defaults. | Branch-specific but live-referenced. Moving requires replacing route/test/generated references or human decision. |
| `.archon/commands/defaults/solidify-poc.md` | Referenced by generated defaults and docs-web command reference. | Product/default intent unclear but not safe to move without docs/bundle updates. Human decision. |
| `docs/ai/stab-002-validation-report.md` | Referenced by root `AGENTS.md`, `CLAUDE.md`, `CODEBASE_MAP.md`, workflow compliance matrix, security docs, and runtime goal. | Not safe to move now. Either keep as current governance evidence or update all links in a later batch. |
| `docs/ai/stab-002-runtime-validation-report.md` | Referenced by `CODEBASE_MAP.md`, runtime decision/ledger, workflow compliance matrix, and STAB validation report. | Not safe to move now. Keep or coordinate link updates. |
| `docs/ai/goals/stab-002-runtime-enforcement.goal.md` | Referenced by runtime validation report and runtime ledger. | Not safe to move without link updates. |
| `aco-stabilization-scorecard.md/json` and `aco-pr-hygiene-report.md` | Referenced by each other, this matrix, and diff inventory; they contain local path and wrong-baseline evidence. | Safe cleanup is in-place historical relabel/path replacement rather than move/delete. |
| Original machine-local supplemental report path | Found only in the two older stabilization reports plus JSON scorecard, and in this matrix as evidence before Batch 1 cleanup. | Safe to replace in reports with historical wording that does not preserve the local path. |
| Original earlier PR review baseline | Found in two older stabilization reports plus JSON scorecard, and in this matrix as evidence before Batch 1 cleanup. | Safe to label as historical/non-final evidence; final merge analysis remains `origin/dev...HEAD`. |
| `packages/core/tsconfig.tsbuildinfo`, `packages/server/tsconfig.tsbuildinfo` | Current tree no longer tracks these files; remaining references are reports/inventory/matrix noting deletion. | Deletion remains safe; no file action needed. |
| `.codex/hooks.json` and `.codex/hooks/verify-task-list.sh` | Referenced by docs, workflow compliance matrix, acceptance tests, generated `ai-layer-*` command text, and stabilization evidence. | Do not remove without human decision and test/doc updates. Hook itself remains safety-hardened by inspection. |
| `.claude/agents/ai-layer-explorer.md` and `.claude/skills/scoped-tests/SKILL.md` | Referenced by AI-layer acceptance tests/specs and this evidence. | Do not remove without human decision and test/spec updates. |
| BMAD assets and research evidence | Broadly referenced by docs, scripts, package scripts, specs, traceability, or generated evidence. | Keep/move decisions require human/future-work review; do not delete or refresh graph/waivers. |
| `.archon/artifacts` runtime references | `git ls-files .archon/artifacts` returned `0`. | Runtime artifact references are ignored for merge cleanup unless a tracked file links them. |

### Phase 8 conclusion

No move/remove/split action is safe yet for branch default commands/workflows or `docs/ai` STAB reports because reference checks found live docs, tests, package code, generated defaults, or traceability references. Safe cleanup candidates for Phase 12 are limited to reversible edits:

- replace or relabel the local absolute supplemental report references in older stabilization evidence
- relabel wrong-baseline earlier PR review evidence as historical/non-final
- keep deleted `tsconfig.tsbuildinfo` files deleted
- defer default command/workflow and trust-sensitive hook/config decisions to party-mode consensus and the human decision queue
