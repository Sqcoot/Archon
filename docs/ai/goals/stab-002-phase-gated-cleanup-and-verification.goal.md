# Goal: Phase-gated cleanup and verification before merging STAB-002 to dev

## Objective

Compare branch `stabilization/stab-002-bmad-method-current-sync` against `origin/dev`, inventory every changed file, inspect the actual Archon workflows/commands/scripts, BMAD assets, MCP references, Codex hooks, Claude hooks/settings, and Archon per-node hooks, clean up branch-specific pollution safely, validate the result, and stop only when the merge-hygiene acceptance gate is satisfied.

This is a cleanup and verification goal, not a feature-building goal.

The branch is large and may pollute context if branch-specific workflows, commands, docs, generated research, local hooks, or stabilization reports are merged as product defaults. The goal is to keep product value while moving, removing, or deferring branch-specific scaffolding.

## Explicit strategy: Evidence-Locked Checkpoint Loop

Codex must use the **Evidence-Locked Checkpoint Loop** strategy.

This means:

1. Keep a visible progress state file.
2. Re-read that progress state at the start of every continuation.
3. Never rely on hidden chat memory.
4. Work in small batches.
5. Update artifacts after every phase and batch.
6. Run reference checks before moving or removing files.
7. Run targeted validation after cleanup batches.
8. Reconcile the inventory after cleanup.
9. Maintain a human decision queue.
10. Complete the goal only after the final acceptance audit passes.

Codex must not declare the goal complete merely because files were written.

Codex must declare completion only after:

- the diff is compared against `origin/dev`
- every changed file is inventoried or explicitly grouped
- every cleanup candidate has a reference check
- the party-mode consensus exists
- the keep/move/remove/split matrix exists
- safe cleanup has been applied or consciously deferred
- validation has been attempted
- final artifacts prove the state
- no blocking issue remains undocumented

## Goal mode

Use this file as the durable `/goal` contract.

If `/goal` is unavailable, enable it only if safe:

```bash
codex features enable goals
```

If goal mode cannot be enabled, continue using this file as the task contract and record that in the final report.

## Branch and baseline

Current branch:

```txt
stabilization/stab-002-bmad-method-current-sync
```

Target baseline:

```txt
origin/dev
```

Use only three-dot comparison for final merge analysis:

```bash
git diff origin/dev...HEAD
```

Do not use another stabilization branch as the final baseline.

## Mission-control artifacts

Create or update these state artifacts first:

```txt
docs/context-orchestrator/stabilization/stab-002-goal-state.md
docs/context-orchestrator/stabilization/stab-002-checkpoint-log.md
docs/context-orchestrator/stabilization/stab-002-dev-diff-inventory.md
docs/context-orchestrator/stabilization/stab-002-file-analysis-matrix.md
docs/context-orchestrator/stabilization/stab-002-cleanup-decision-ledger.md
docs/context-orchestrator/stabilization/stab-002-party-mode-consensus.md
docs/context-orchestrator/stabilization/stab-002-keep-move-remove-split-matrix.md
docs/context-orchestrator/stabilization/stab-002-cleanup-validation-report.md
```

If equivalent files already exist, update them instead of duplicating.

Do not place branch-specific reports at top-level `docs/ai` unless they are evergreen governance docs.

## Goal state file contract

`stab-002-goal-state.md` is the single source of truth for Codex continuation.

At the start of every continuation turn, Codex must read this file before doing more work.

It must contain:

```txt
Current phase:
Current checkpoint:
Last completed phase:
Next required action:
Changed files total:
Changed files inventoried:
Files analyzed:
Cleanup candidates:
Cleanup actions completed:
Cleanup actions pending:
Human decisions pending:
Validation last run:
Validation status:
Blockers:
No-progress counter:
Completion status:
```

Update it:

* after each phase
* after every cleanup batch
* after every validation run
* before pausing
* before declaring completion

If Codex resumes after compaction, interruption, budget limit, or user steering, it must first read:

```txt
docs/context-orchestrator/stabilization/stab-002-goal-state.md
docs/context-orchestrator/stabilization/stab-002-checkpoint-log.md
docs/context-orchestrator/stabilization/stab-002-keep-move-remove-split-matrix.md
docs/context-orchestrator/stabilization/stab-002-cleanup-validation-report.md
```

Then continue from the recorded `Next required action`.

## Checkpoint log contract

`stab-002-checkpoint-log.md` must record every phase transition.

Each entry must use this format:

```txt
## Checkpoint <number>: <name>

Timestamp:
Current phase:
Action taken:
Files inspected:
Files changed:
Commands run:
Evidence produced:
Validation result:
Next checkpoint:
Blocked: yes/no
Blocker, if any:
```

Codex must add a checkpoint entry after every phase and after every batch of cleanup edits.

## Batch size rule

Codex must not try to clean the entire branch in one edit pass.

Use batches:

* batch size: at most 20 files or 1 cleanup category
* after each batch, update the state file
* after each batch, update the matrix
* after each batch, run targeted reference checks
* after each batch, run appropriate validation

If a batch touches default workflows or default commands, run generated default validation before continuing.

## No-progress rule

If Codex has two continuation turns in a row where it:

* does not inspect new evidence
* does not update artifacts
* does not make safe progress
* does not run validation
* or repeats the same plan without changing state

then Codex must stop substantive work and write a blocker entry in:

```txt
docs/context-orchestrator/stabilization/stab-002-cleanup-decision-ledger.md
```

Do not spin.

## Core cleanup rule

Do not clean by intuition. Clean by evidence.

Every cleanup candidate must pass these three gates:

1. **Classification gate** -- identify what type of file or asset it is.
2. **Reference gate** -- prove whether it is referenced by workflows, commands, hooks, generated bundles, docs, package scripts, tests, BMAD assets, or CI.
3. **Validation gate** -- run the relevant Archon/repo validation after any move/remove/edit.

If a candidate cannot pass these gates, mark it:

```txt
REQUIRES_HUMAN_DECISION
```

## Allowed decisions

Every changed file or explicitly grouped file set must receive exactly one final decision:

```txt
KEEP
KEEP_WITH_NOTE
MOVE_TO_STABILIZATION
MOVE_TO_HISTORY
MOVE_TO_EXAMPLES
REMOVE_TRANSIENT
REMOVE_LOCAL_LEAKAGE
SPLIT_TO_LATER_PR
REQUIRES_HUMAN_DECISION
UNKNOWN_KEEP
```

Definitions:

* `KEEP`: durable product/contributor asset.
* `KEEP_WITH_NOTE`: keep, but document why it may look branch-specific.
* `MOVE_TO_STABILIZATION`: branch evidence or operational artifact that should live under `docs/context-orchestrator/stabilization/`.
* `MOVE_TO_HISTORY`: historical validation or one-time scorecard that should not sit in evergreen docs.
* `MOVE_TO_EXAMPLES`: useful template, not product default.
* `REMOVE_TRANSIENT`: generated/local artifact that should not be tracked.
* `REMOVE_LOCAL_LEAKAGE`: local path, local machine data, or accidental local-only reference.
* `SPLIT_TO_LATER_PR`: valuable but not needed for this merge.
* `REQUIRES_HUMAN_DECISION`: policy-sensitive or insufficient evidence.
* `UNKNOWN_KEEP`: unclear but safer to keep than delete.

Default bias:

* Keep product code with tests.
* Keep traceability-required docs/specs.
* Keep required BMAD sync assets.
* Move branch-specific evidence instead of deleting it.
* Move branch/bootstrap commands out of product defaults only if validation proves safe.
* Remove local leakage and clearly accidental transient files.
* Ask the user for policy-sensitive choices.

## Do not do

Do not:

* delete product code
* delete tests
* delete ACO/context-orchestrator specs required by traceability
* delete BMAD sync assets without proof
* delete workflows or commands still referenced by workflows, commands, generated bundles, docs, package scripts, or tests
* refresh ACO graph
* remove waivers
* run destructive worktree cleanup
* change required CI gates to optional without explicit approval
* commit secrets
* stage files
* commit
* push
* open a PR
* use `git add .`
* fake validation results
* claim sufficiency without validation evidence

If a cleanup action is destructive, policy-sensitive, or irreversible, record it in the human decision queue and do not perform it.

## Known current branch assets to verify

These are not assumptions. They are known candidates that must be verified locally before use.

### Archon workflows to inspect

Inspect these workflow files if present:

```txt
.archon/workflows/defaults/archon-aco-adversarial-loop.yaml
.archon/workflows/defaults/archon-adversarial-dev.yaml
.archon/workflows/defaults/archon-ai-layer-bootstrap.yaml
.archon/workflows/defaults/archon-architect.yaml
.archon/workflows/defaults/archon-assist.yaml
.archon/workflows/defaults/archon-comprehensive-pr-review.yaml
.archon/workflows/defaults/archon-create-issue.yaml
.archon/workflows/defaults/archon-feature-development.yaml
.archon/workflows/defaults/archon-fix-github-issue.yaml
.archon/workflows/defaults/archon-idea-to-pr.yaml
.archon/workflows/defaults/archon-interactive-prd.yaml
.archon/workflows/defaults/archon-issue-review-full.yaml
.archon/workflows/defaults/archon-piv-loop.yaml
.archon/workflows/defaults/archon-plan-to-pr.yaml
.archon/workflows/defaults/archon-ralph-dag.yaml
.archon/workflows/defaults/archon-refactor-safely.yaml
.archon/workflows/defaults/archon-remotion-generate.yaml
.archon/workflows/defaults/archon-resolve-conflicts.yaml
.archon/workflows/defaults/archon-smart-pr-review.yaml
.archon/workflows/defaults/archon-test-loop-dag.yaml
.archon/workflows/defaults/archon-validate-pr.yaml
.archon/workflows/defaults/archon-workflow-builder.yaml
.archon/workflows/defaults/context-orchestrate.yaml
```

For each workflow, answer:

```txt
Is it present?
Is it product-facing?
Is it branch/stabilization-only?
Is it bootstrap-only?
Is it test/demo-only?
Which commands does it reference?
Which scripts does it reference?
Does it use hooks?
Does it use MCP?
Does it use skills?
Does it use agents?
Does it use approvals?
Does it use loops?
Does it write artifacts?
Does it validate locally?
Should it stay in defaults?
Should it move to examples/stabilization?
Should it be split to another PR?
Does moving it require bundled default regeneration?
```

### Workflows to consider using

Use these workflows only if safe and available.

#### `archon-assist`

Use only for read-only or no-edit smoke testing.

Possible safe command:

```bash
bun run cli workflow run archon-assist --cwd . --no-worktree "Read docs/ai/README.md and summarize its purpose. Do not edit files."
```

Do not run edit-style `archon-assist` if it may mutate the checkout.

#### `archon-validate-pr`

Use as a reference validation workflow if it can run without opening PRs or making changes. Prefer schema validation over execution unless safe.

#### `archon-smart-pr-review`

Use for reference only unless the repo has a local PR context and execution is safe. Do not run against a live PR without approval.

#### `context-orchestrate`

Inspect as likely product-facing ACO workflow. Use for mapping and validation. Do not run unless it has a safe no-edit mode.

#### `archon-aco-adversarial-loop`

Inspect as likely ACO product or quality workflow. Use for party-mode/adversarial analysis conceptually. Do not execute unless it is safe and non-destructive.

#### `archon-ai-layer-bootstrap`

Inspect as likely branch/bootstrap workflow. Treat as a cleanup candidate. Do not assume it belongs in defaults.

### Archon commands to inspect

Inspect these command files if present.

#### Candidate branch/bootstrap commands

```txt
.archon/commands/defaults/goal.md
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
```

For each, answer:

```txt
Is it present?
Is it referenced by a kept workflow?
Is it product-facing?
Is it branch/stabilization-only?
Is it bootstrap-only?
Is it one-time task scaffolding?
Does it mention STAB, ACO stabilization, merge readiness, branch gates, stop gates, or local artifacts?
Should it stay in defaults?
Should it move to docs/context-orchestrator/stabilization/commands?
Should it move to docs/context-orchestrator/examples/commands?
Would moving it break validation?
Would moving it require bundled default regeneration?
```

#### Core Archon commands likely to keep

Inspect but do not move unless there is strong evidence:

```txt
.archon/commands/defaults/archon-assist.md
.archon/commands/defaults/archon-create-plan.md
.archon/commands/defaults/archon-create-pr.md
.archon/commands/defaults/archon-fix-issue.md
.archon/commands/defaults/archon-implement.md
.archon/commands/defaults/archon-implement-tasks.md
.archon/commands/defaults/archon-validate.md
.archon/commands/defaults/archon-workflow-summary.md
.archon/commands/defaults/archon-code-review-agent.md
.archon/commands/defaults/archon-synthesize-review.md
.archon/commands/defaults/archon-self-fix-all.md
.archon/commands/defaults/archon-resolve-merge-conflicts.md
```

These should generally be kept if they validate and are part of upstream/product defaults.

### Archon scripts to inspect

Inspect:

```bash
find .archon/scripts -maxdepth 3 -type f | sort
```

Specifically inspect if present:

```txt
.archon/scripts/maintainer-standup-backfill-reviews.ts
.archon/scripts/maintainer-standup-gh-data.ts
.archon/scripts/maintainer-standup-git-status.ts
.archon/scripts/maintainer-standup-persist.test.ts
.archon/scripts/maintainer-standup-persist.ts
.archon/scripts/maintainer-standup-read-context.ts
.archon/scripts/marketplace-fetch-source.ts
.archon/scripts/marketplace-security-scan.ts
.archon/scripts/marketplace-validate-schema.ts
.archon/scripts/echo-args.js
.archon/scripts/echo-py.py
```

For each script, answer:

```txt
Is it referenced by a workflow?
Is it referenced by a command?
Is it referenced by package.json?
Is it product validation logic?
Is it marketplace/product logic?
Is it demo/test-only?
Is it branch/stabilization-only?
Is it safe and non-destructive?
Should it stay, move, split, or require human decision?
```

### BMAD assets to inspect

Inspect all BMAD-related assets before making BMAD decisions.

Run:

```bash
find _bmad -maxdepth 5 -type f | sort || true
find .agents -maxdepth 5 -type f | sort || true
rg -n "_bmad|bmad|BMAD|bmm|correct-course|prd|story|architect" _bmad .agents .archon docs packages scripts tests package.json || true
```

Inspect if present:

```txt
_bmad/config.toml
_bmad/_config/
_bmad/bmm/
_bmad/core/
_bmad/custom/
_bmad/scripts/
.agents/skills/bmad-*
docs/ai/bmad-to-archon-mapping.md
```

For each BMAD asset, answer:

```txt
Is it required BMAD sync config?
Is it a generated manifest intentionally tracked?
Is it a user-local or machine-local artifact?
Is it referenced by Archon workflows?
Is it referenced by Archon commands?
Is it referenced by ACO/context-orchestrator?
Is it referenced by docs?
Is it referenced by package scripts?
Does it need a native Archon workflow now?
Should BMAD stay mapped/advisory?
Should BMAD move toward first-class workflows later?
```

Do not invent BMAD assets or methods not found locally.

### BMAD decision points

Codex must answer, using evidence:

```txt
Should BMAD remain advisory/mapped for this merge?
Should BMAD native workflows be deferred?
Should any BMAD workflow be added now?
Should .agents/skills/bmad-* stay as Codex/agent skills?
Should BMAD skills be mirrored into .claude/skills?
Are any _bmad files user-local and unsafe to merge?
Are any _bmad generated files required by sync and safe to keep?
```

Default if evidence is insufficient:

```txt
Keep BMAD sync assets that are validated or documented.
Do not add BMAD-native workflows in this cleanup.
Record the native-workflow decision as a human/future-work item.
```

### Hooks to inspect

Inspect all hook surfaces. Do not assume only one hook system exists.

#### Codex project hooks

Inspect:

```txt
.codex/hooks.json
.codex/hooks/
.codex/README.md
.codex/agents/
```

Run:

```bash
find .codex -maxdepth 5 -type f -print -exec sed -n '1,220p' {} \; 2>/dev/null || true
```

For each Codex hook, answer:

```txt
What event triggers it?
Does it mutate files?
Does it call private/local tools?
Does it depend on user-local paths?
Does it validate untrusted input?
Does it fail safely?
Is it contributor-facing?
Could it surprise contributors?
Should it stay in .codex?
Should it move to .codex.example or docs?
Should it require human decision?
```

Known candidate:

```txt
SessionStart hook that verifies CODEX_TASK_LIST_ID
```

Require verification that:

```txt
CODEX_TASK_LIST_ID is treated as untrusted input.
IDs are constrained to safe characters.
Resolved paths remain under CODEX_TASKS_DIR or ~/.codex/tasks.
Private local tools are not called by default.
Optional integrations are environment-gated and command-v checked.
```

#### Archon per-node hooks in workflows

Search:

```bash
rg -n "hooks:|PreToolUse|PostToolUse|Stop|SessionStart|SessionEnd|Notification|UserPromptSubmit" .archon docs packages scripts tests .claude .codex .agents || true
```

For each workflow hook reference, answer:

```txt
Which workflow/node uses it?
Which event does it hook?
Does it enforce validation?
Does it block dangerous actions?
Does it mutate files?
Is it supported by the installed provider?
Is it safe as a default?
Does it require docs?
```

If a workflow uses hooks, validate that `bun run cli validate workflows --cwd .` still passes after any movement or edits.

#### Claude hooks/settings

Inspect:

```txt
.claude/settings.json
.claude/settings.local.json
.claude/hooks/
.claude/skills/
.claude/agents/
CLAUDE.md
```

Run:

```bash
find .claude -maxdepth 5 -type f -print -exec sed -n '1,180p' {} \; 2>/dev/null || true
```

For Claude hook/settings assets, answer:

```txt
Are they version-controlled intentionally?
Are they safe for all contributors?
Do they deny generated/transient paths?
Do they enforce any AI workflow behavior?
Are local settings accidentally committed?
Should any hook move to examples?
```

#### Git hooks

Inspect:

```bash
find .githooks .husky .git/hooks -maxdepth 3 -type f -print 2>/dev/null || true
rg -n "pre-commit|pre-push|commit-msg|husky|lint-staged" package.json .github scripts . || true
```

Do not modify `.git/hooks`. Only inspect and document.

### MCP assets to inspect

Inspect:

```bash
find .archon -maxdepth 5 -type f | rg '/mcp/|mcp' || true
rg -n "mcp:|MCP|ntfy|context7|github.*mcp|linear|jira" .archon docs packages scripts tests package.json .claude .codex .agents || true
```

For each MCP reference, answer:

```txt
Is the MCP config file present?
Is it optional/guarded?
Does it contain secrets?
Does it use env vars?
Is it read-only?
Does it require human approval?
Is it product-facing or user-local?
Should it stay illustrative only?
Should a .example.json template exist?
```

Default if evidence is insufficient:

```txt
Do not add live MCP configs.
Keep MCP user/global or illustrative only.
Record any optional warnings as non-blocking if validation passes.
```

## Phase 0: mission-control initialization

Before any analysis, create or update:

```txt
docs/context-orchestrator/stabilization/stab-002-goal-state.md
docs/context-orchestrator/stabilization/stab-002-checkpoint-log.md
```

Initialize the state file with:

```txt
Current phase: Phase 0
Current checkpoint: mission-control initialization
Last completed phase: none
Next required action: Phase 1 preflight
Changed files total: unknown
Changed files inventoried: 0
Files analyzed: 0
Cleanup candidates: unknown
Cleanup actions completed: none
Cleanup actions pending: unknown
Human decisions pending: unknown
Validation last run: none
Validation status: not started
Blockers: none
No-progress counter: 0
Completion status: not complete
```

Add the first checkpoint entry.

## Phase 1: preflight and baseline lock

Run:

```bash
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

Record concise outputs in:

```txt
docs/context-orchestrator/stabilization/stab-002-dev-diff-inventory.md
```

Record:

```txt
origin/dev commit:
merge base:
HEAD commit:
commit count:
changed file count:
shortstat:
top changed directories:
```

If there are uncommitted user changes, preserve them and record them before editing.

Update the state file and checkpoint log.

## Phase 2: goal re-entry and context reacquisition rule

Before each continuation turn, Codex must perform this mini-phase:

```bash
sed -n '1,220p' docs/context-orchestrator/stabilization/stab-002-goal-state.md 2>/dev/null || true
sed -n '1,220p' docs/context-orchestrator/stabilization/stab-002-checkpoint-log.md 2>/dev/null || true
sed -n '1,220p' docs/context-orchestrator/stabilization/stab-002-keep-move-remove-split-matrix.md 2>/dev/null || true
git status --short
```

If the state file says the goal is not complete, continue from `Next required action`.

If state and git status disagree, reconcile before editing.

Update the checkpoint log if resuming after compaction, interruption, pause, or budget limit.

## Phase 3: exact changed-file inventory

Create a complete inventory from:

```bash
git diff --name-status origin/dev...HEAD
git diff --numstat origin/dev...HEAD
git diff --summary origin/dev...HEAD
```

For every changed path, record:

```txt
Path
Git status: A / M / D / R / C
Insertions
Deletions
Extension
Top-level directory
Primary classification
Secondary classification
Generated/transient: yes/no/unknown
Local leakage risk: yes/no/unknown
Referenced elsewhere: yes/no/unknown
Validation coverage: yes/no/unknown
Cleanup candidate: yes/no
Risk: low/medium/high
Initial decision
Notes
```

Every changed path from `git diff --name-only origin/dev...HEAD` must appear in the inventory.

Grouping is allowed only for low-risk homogeneous groups, but the group must list every exact path.

Update state:

```txt
Changed files total:
Changed files inventoried:
Next required action: Phase 4 classification
```

## Phase 4: classification

Assign exactly one primary classification to each file:

```txt
PRODUCT_CODE
TEST
CLI_SURFACE
SERVER_API_SURFACE
WEB_UI_SURFACE
PACKAGE_BUILD_CONFIG
ARCHON_WORKFLOW
ARCHON_COMMAND
ARCHON_SCRIPT
CLAUDE_CONFIG
CODEX_CONFIG
AGENT_CONFIG
BMAD_ASSET
MCP_ASSET
HOOK_ASSET
ACO_DOC_SPEC
AI_GOVERNANCE_DOC
STABILIZATION_EVIDENCE
RESEARCH_EVIDENCE
GENERATED_TRANSIENT
LOCAL_MACHINE_LEAKAGE
UNKNOWN
```

Use these path heuristics, but verify:

```txt
packages/context-orchestrator/** -> PRODUCT_CODE or TEST
packages/cli/** -> CLI_SURFACE
packages/server/** -> SERVER_API_SURFACE
packages/web/** -> WEB_UI_SURFACE
tests/** -> TEST
.archon/workflows/** -> ARCHON_WORKFLOW
.archon/commands/** -> ARCHON_COMMAND
.archon/scripts/** -> ARCHON_SCRIPT
.claude/** -> CLAUDE_CONFIG or HOOK_ASSET
.codex/** -> CODEX_CONFIG or HOOK_ASSET
.agents/** -> AGENT_CONFIG or BMAD_ASSET
_bmad/** -> BMAD_ASSET
docs/context-orchestrator/specs/** -> ACO_DOC_SPEC
docs/context-orchestrator/stabilization/** -> STABILIZATION_EVIDENCE
docs/context-orchestrator/research/** -> RESEARCH_EVIDENCE
docs/ai/** -> AI_GOVERNANCE_DOC or STABILIZATION_EVIDENCE
.github/** -> PACKAGE_BUILD_CONFIG
package.json -> PACKAGE_BUILD_CONFIG
bun.lock -> PACKAGE_BUILD_CONFIG
tsconfig* -> PACKAGE_BUILD_CONFIG
```

If classification is unclear, mark `UNKNOWN` and explain why.

Update state and checkpoint log.

## Phase 5: asset discovery

Inspect actual Archon, BMAD, MCP, hook, and package surfaces.

Run:

```bash
find .archon/workflows/defaults -maxdepth 1 -type f | sort || true
find .archon/commands/defaults -maxdepth 1 -type f | sort || true
find .archon/scripts -maxdepth 3 -type f | sort || true
find _bmad -maxdepth 5 -type f | sort || true
find .agents -maxdepth 5 -type f | sort || true
find .codex -maxdepth 5 -type f | sort || true
find .claude -maxdepth 5 -type f | sort || true
node -e "const p=require('./package.json'); console.log(JSON.stringify(p.scripts,null,2))" 2>/dev/null || sed -n '1,260p' package.json
```

Also run:

```bash
rg -n "hooks:|PreToolUse|PostToolUse|Stop|SessionStart|SessionEnd|Notification|UserPromptSubmit" .archon docs packages scripts tests .claude .codex .agents || true
rg -n "mcp:|MCP|ntfy|context7|github.*mcp|linear|jira" .archon docs packages scripts tests package.json .claude .codex .agents || true
rg -n "_bmad|bmad|BMAD|bmm|correct-course|prd|story|architect" _bmad .agents .archon docs packages scripts tests package.json || true
```

Record findings in:

```txt
docs/context-orchestrator/stabilization/stab-002-file-analysis-matrix.md
```

Update state and checkpoint log.

## Phase 6: bucket-specific analysis

For each file or exact grouped set, answer the relevant questions.

### PRODUCT_CODE

```txt
What feature or behavior does this file add/change?
Is it part of ACO/context-orchestrator?
Is it part of BMAD sync?
Is it general Archon fix?
Is it unrelated scope creep?
What tests cover it?
What package script validates it?
Does it change public API?
Does it introduce new dependencies?
Decision:
```

Allowed decisions:

```txt
KEEP
SPLIT_TO_LATER_PR
REQUIRES_HUMAN_DECISION
```

Do not remove product code in this cleanup unless the user explicitly approves.

### TEST

```txt
Which product code does this test cover?
Is it deterministic?
Is it unit, integration, acceptance, or fixture?
Does it depend on local/generated data?
Does it still pass?
Decision:
```

Allowed decisions:

```txt
KEEP
SPLIT_TO_LATER_PR
REQUIRES_HUMAN_DECISION
```

### ARCHON_WORKFLOW

```txt
Is this product-facing?
Is this bootstrap-only?
Is this branch/stabilization-only?
Which commands does it reference?
Which scripts does it reference?
Does it use hooks?
Does it use MCP?
Does it use skills?
Does it use agents?
Is it listed by workflow discovery?
Does workflow validation pass with it?
Would moving it break bundled defaults?
Decision:
```

Cleanup rules:

* Keep `context-orchestrate` if it is the ACO product workflow and validates.
* Keep `archon-aco-adversarial-loop` only if it is product-facing, documented, and validates.
* Move `archon-ai-layer-bootstrap` out of defaults if it is bootstrap/stabilization-only and not required by product workflows.
* If moving any default workflow, regenerate bundled defaults and run workflow validation.
* If evidence is unclear, mark `REQUIRES_HUMAN_DECISION`.

### ARCHON_COMMAND

```txt
Is this command product-facing?
Is it used by a default workflow?
Is it branch-specific?
Is it bootstrap-only?
Is it stabilization-only?
Is it referenced by generated bundles?
Can it move without breaking workflow validation?
Decision:
```

Cleanup rules:

* If `goal.md` is only `/goal stabilize-aco-merge-ready`, move it out of defaults unless party-mode consensus says it is a product default.
* Keep `ai-layer-*` commands only if referenced by product workflows or intended as product-facing commands.
* Move bootstrap/stabilization commands to stabilization docs or examples.
* If moving default commands, update references and regenerate bundled defaults.
* If unclear, mark `REQUIRES_HUMAN_DECISION`.

### ARCHON_SCRIPT

```txt
Which workflow or package script uses it?
Is it deterministic?
Is it non-destructive?
Does it validate product behavior?
Does it parse artifacts, traceability, or policy?
Decision:
```

### AI_GOVERNANCE_DOC

```txt
Is this evergreen governance?
Is this branch-specific validation evidence?
Is this commit-specific report?
Is it linked from README/AGENTS/CLAUDE/CODEBASE_MAP?
Should it stay in docs/ai?
Decision:
```

### STABILIZATION_EVIDENCE

```txt
Does it compare against origin/dev?
Does it contain local machine paths?
Is it useful PR evidence?
Is it intended to survive after merge?
Decision:
```

### RESEARCH_EVIDENCE

```txt
Is it referenced by specs, tests, scripts, traceability, or docs?
Is it canonical evidence?
Is it generated research output?
Can it be regenerated?
Does it bloat context?
Decision:
```

### BMAD_ASSET

```txt
Is it required BMAD sync config?
Is it generated manifest intentionally tracked?
Is it user-local?
Is it machine-local?
Is it referenced by docs/scripts/workflows?
Does .gitignore protect user-local BMAD files?
Decision:
```

### CODEX_CONFIG / CLAUDE_CONFIG / AGENT_CONFIG / HOOK_ASSET

```txt
Is it safe?
Is it read-only?
Is it contributor-facing?
Could it surprise contributors?
Is it needed by workflows or validation?
Does it validate untrusted input?
Should it be example-only?
Decision:
```

### MCP_ASSET

```txt
Is the MCP config file present?
Is it optional/guarded?
Does it contain secrets?
Does it use env vars?
Is it read-only?
Does it require human approval?
Is it product-facing or user-local?
Should it stay illustrative only?
Decision:
```

### PACKAGE_BUILD_CONFIG

```txt
What scripts/dependencies/config changed?
Is it required by product code?
Does it affect all contributors?
Does it add OPA or policy validation?
Should it be global or path-scoped?
Is it validated?
Decision:
```

### GENERATED_TRANSIENT

```txt
Is this intentionally versioned?
Is it required by tests?
Is it ignored by .gitignore?
Can it be regenerated?
Decision:
```

### LOCAL_MACHINE_LEAKAGE

```txt
What local path, host, or user-specific value appears?
Can it be replaced with repo-relative path?
Is it accidental evidence?
Decision:
```

### UNKNOWN

```txt
Why is this unclear?
What evidence is missing?
Should it be kept until human review?
Decision:
```

Update state and checkpoint log.

## Phase 7: specific candidate searches

Run and record findings.

### Branch-specific goal/default commands

```bash
test -f .archon/commands/defaults/goal.md && sed -n '1,260p' .archon/commands/defaults/goal.md || true
find .archon/commands/defaults -maxdepth 1 -type f -name 'ai-layer-*.md' -print | sort || true
for f in .archon/commands/defaults/ai-layer-*.md; do
  [ -f "$f" ] || continue
  echo "===== $f ====="
  sed -n '1,140p' "$f"
done
rg -n "stabilize-aco-merge-ready|/goal|goal.md|ai-layer-|AI Layer|bootstrap|branch gate|endgoal|stop gate" .archon docs packages tests scripts package.json .claude .codex .agents _bmad || true
```

### Branch-specific workflows

```bash
test -f .archon/workflows/defaults/archon-ai-layer-bootstrap.yaml && sed -n '1,320p' .archon/workflows/defaults/archon-ai-layer-bootstrap.yaml || true
test -f .archon/workflows/defaults/context-orchestrate.yaml && sed -n '1,320p' .archon/workflows/defaults/context-orchestrate.yaml || true
test -f .archon/workflows/defaults/archon-aco-adversarial-loop.yaml && sed -n '1,320p' .archon/workflows/defaults/archon-aco-adversarial-loop.yaml || true
rg -n "archon-ai-layer-bootstrap|context-orchestrate|archon-aco-adversarial-loop|ai-layer-bootstrap|bootstrap" .archon docs packages tests scripts package.json || true
```

### Local leakage and wrong baseline evidence

```bash
rg -n "/Users/|Downloads/|file://|localhost:[0-9]+|/tmp/" . || true
rg -n "stab-002-sdd-atdd-alignment-upstream-dev|target branch|baseline|origin/dev|dev\\.\\.\\." docs/context-orchestrator docs/ai . || true
```

### Transient/generated tracked files

```bash
git ls-files | rg '(^_bmad-output/|^\.history/|tsconfig\.tsbuildinfo|/\.archon/artifacts/|/research/upstreams/|graphify-out/|\.DS_Store|\.log$)' || true
```

### Research evidence bloat

```bash
find docs/context-orchestrator/research -maxdepth 2 -type f | sort || true

for f in docs/context-orchestrator/research/*; do
  [ -f "$f" ] || continue
  base="$(basename "$f")"
  if rg -q "$base" docs packages scripts tests .archon _bmad package.json; then
    echo "referenced: $f"
  else
    echo "possibly-unreferenced: $f"
  fi
done
```

### BMAD assets

```bash
find _bmad -maxdepth 5 -type f | sort || true
find .agents -maxdepth 5 -type f | sort || true
git diff --name-status origin/dev...HEAD -- _bmad .agents || true
rg -n "_bmad|bmad|BMAD|bmm|story|prd|architect|correct-course" _bmad .agents .archon docs packages scripts tests package.json || true
```

### Codex/Claude/agent config

```bash
find .codex -maxdepth 5 -type f -print -exec sed -n '1,220p' {} \; 2>/dev/null || true
find .claude -maxdepth 5 -type f -print -exec sed -n '1,180p' {} \; 2>/dev/null || true
find .agents -maxdepth 5 -type f -print | sort || true
rg -n "CODEX_TASK_LIST_ID|SessionStart|hooks.json|verify-task-list|private local tools|hooks|permissions|deny|skills|agents|PreToolUse|PostToolUse" .codex .claude CLAUDE.md docs .archon package.json || true
```

### MCP

```bash
find .archon -maxdepth 5 -type f | rg '/mcp/|mcp' || true
rg -n "mcp:|MCP|ntfy|context7|github.*mcp|linear|jira" .archon docs packages scripts tests package.json .claude .codex .agents || true
```

### CI/policy/package scripts

```bash
git diff origin/dev...HEAD -- .github/workflows package.json scripts packages tests | sed -n '1,420p'
rg -n "opa|aco:policy|aco:traceability|aco:test|check:bundled|validate" .github package.json scripts packages tests || true
```

### README/workflow count drift

```bash
rg -n "workflow|workflows|default workflows|42|55|23|17|bundled" README.md docs package.json .archon packages || true
```

Update state and checkpoint log.

## Phase 8: reference checks before move/remove/split

For every file or group whose proposed decision is not `KEEP`, run reference checks.

Use:

```bash
path="<file-path>"
base="$(basename "$path")"
stem="${base%.*}"

rg -n --fixed-strings "$path" . || true
rg -n --fixed-strings "$base" . || true
rg -n --fixed-strings "$stem" . || true
```

For commands/workflows, also search logical names:

```bash
rg -n "archon-ai-layer-bootstrap|context-orchestrate|archon-aco-adversarial-loop|stabilize-aco-merge-ready|ai-layer-" .archon docs packages tests scripts package.json .claude .codex .agents _bmad || true
```

For moved/removed docs, search old links and filenames.

Record reference status in:

```txt
docs/context-orchestrator/stabilization/stab-002-file-analysis-matrix.md
```

If references exist, either update them or do not move/remove the file.

Update state and checkpoint log.

## Phase 9: party-mode consensus

Create:

```txt
docs/context-orchestrator/stabilization/stab-002-party-mode-consensus.md
```

Use these roles:

1. Archon maintainer
2. Context Orchestrator product owner
3. BMAD method architect
4. Minimal merge reviewer
5. Security reviewer
6. Docs maintainer
7. Test/CI owner
8. Contributor-experience reviewer
9. Release manager
10. Hook/MCP safety reviewer
11. Artifact/traceability reviewer
12. Goal-continuation reviewer

Each role must answer:

```txt
Which Archon workflows should stay in defaults?
Which Archon workflows should move to examples/stabilization?
Which Archon commands should stay in defaults?
Which Archon commands should move?
Which BMAD assets are required?
Which BMAD assets should be deferred?
Which hooks are safe to ship?
Which hooks should move to examples or require human decision?
Which MCP references are safe?
Which docs are evergreen?
Which docs are branch-specific evidence?
What validation is required?
What is the highest merge risk?
What would cause Codex to lose track, and how is that prevented?
```

Consensus rules:

```txt
- Keep validated product code.
- Keep traceability-required specs.
- Keep BMAD sync assets that are required and non-local.
- Keep product-facing workflows only if validated.
- Move branch-specific commands/workflows out of defaults if safe.
- Move branch-specific evidence to stabilization/history.
- Remove local leakage.
- Remove clearly accidental transient files.
- Require human decision for contributor hooks, CI gate changes, waivers, graph refresh, or destructive cleanup.
```

Update state and checkpoint log.

## Phase 10: keep/move/remove/split matrix

Create or update:

```txt
docs/context-orchestrator/stabilization/stab-002-keep-move-remove-split-matrix.md
```

Every cleanup decision must use one of:

```txt
KEEP
KEEP_WITH_NOTE
MOVE_TO_STABILIZATION
MOVE_TO_HISTORY
MOVE_TO_EXAMPLES
REMOVE_TRANSIENT
REMOVE_LOCAL_LEAKAGE
SPLIT_TO_LATER_PR
REQUIRES_HUMAN_DECISION
UNKNOWN_KEEP
```

Each row must include:

```txt
Path or group
Current location
Classification
Evidence
Reference status
Decision
Rationale
Action taken
Validation needed
Rollback plan
```

No file may be moved or removed unless it appears in this matrix.

Update state and checkpoint log.

## Phase 11: pre-edit dry-run plan

Before editing files, produce a dry-run cleanup plan in:

```txt
docs/context-orchestrator/stabilization/stab-002-cleanup-decision-ledger.md
```

It must include:

```txt
Planned safe edits:
Planned moves:
Planned removals:
Files requiring human decision:
Validation required after each batch:
Rollback plan:
```

Do not edit before this dry-run plan exists.

Update state and checkpoint log.

## Phase 12: apply safe cleanup in batches

Allowed without additional approval if the matrix supports it:

```txt
- replace local absolute paths with repo-relative paths
- label old reports as historical
- move STAB-specific docs to stabilization/history
- move branch-specific command/workflow examples out of defaults if references are updated
- remove accidental transient tracked files that are unreferenced
- update README count drift with durable wording
- update links after moves
- regenerate bundled defaults after default command/workflow changes
```

Not allowed without approval:

```txt
- delete product code
- delete tests
- delete ACO specs required by traceability
- delete BMAD sync assets
- remove graph waivers
- refresh graph state
- change required CI gates to optional
- remove .codex hooks if they may be contributor policy
- remove loaded workflows/commands with unresolved references
- run destructive cleanup
- stage, commit, push, or open a PR
```

Batch rules:

```txt
Batch size: at most 20 files or 1 cleanup category.
After every batch:
- update goal state
- update checkpoint log
- update matrix action taken
- run targeted reference checks
- run relevant validation
```

If any default workflow or command changed under:

```txt
.archon/workflows/defaults/
.archon/commands/defaults/
```

run:

```bash
bun run generate:bundled
bun run check:bundled
bun run check:bundled-skill
bun run cli validate workflows --cwd .
bun run cli validate commands --cwd .
```

Update state and checkpoint log after each batch.

## Phase 13: post-cleanup reconciliation

After cleanup, rerun:

```bash
git diff --name-only origin/dev...HEAD > /tmp/stab-002-after-cleanup-files.txt
git diff --shortstat origin/dev...HEAD
git diff --stat origin/dev...HEAD
git diff --dirstat=files,10,cumulative origin/dev...HEAD
```

Verify:

```txt
- inventory still covers all changed files
- moved files have updated links
- removed files no longer appear in git diff --name-only
- no old paths remain outside historical notes
```

If the changed-file set differs from the original inventory, update the inventory and matrix.

Update state and checkpoint log.

## Phase 14: verification ladder

After cleanup, run or attempt in this order.

### 14.1 Local leakage verification

```bash
rg -n "/Users/|Downloads/|file://|localhost:[0-9]+|/tmp/" docs .archon .claude .codex .agents packages scripts tests package.json || true
```

### 14.2 Transient file verification

```bash
git ls-files | rg '(^_bmad-output/|^\.history/|tsconfig\.tsbuildinfo|/\.archon/artifacts/|/research/upstreams/|graphify-out/|\.DS_Store|\.log$)' || true
```

### 14.3 Archon validation

```bash
bun run cli workflow list --cwd . --json
bun run cli validate workflows --cwd .
bun run cli validate commands --cwd .
```

If `archon` is available, optional duplicate check:

```bash
archon workflow list --cwd . --json || true
archon validate workflows --cwd . || true
archon validate commands --cwd . || true
```

### 14.4 Bundle validation

If defaults changed, run generation first:

```bash
bun run generate:bundled
```

Then always run:

```bash
bun run check:bundled
bun run check:bundled-skill
```

### 14.5 ACO/BMAD validation

Run:

```bash
bun run aco:traceability
```

If package.json exposes BMAD-specific validation scripts, run them. If not, record that no BMAD-specific script was found.

If policy/OPA files changed and scripts exist, run:

```bash
bun run aco:policy
bun run aco:policy:test
```

### 14.6 Repo validation

Run:

```bash
bun run format:check
bun run validate
git diff --check
```

Run tests if touched files require it or package scripts make it expected:

```bash
bun run test
```

Do not fake output. Record failures honestly.

Update state and checkpoint log.

## Phase 15: optional no-edit workflow smoke test

Only run if all conditions are true:

```txt
- no uncommitted user changes would be overwritten
- command is read-only
- workflow is safe with --no-worktree
- prompt explicitly says do not edit files
```

Candidate:

```bash
bun run cli workflow run archon-assist --cwd . --no-worktree "Read docs/ai/README.md and summarize its purpose. Do not edit files."
```

If not run, document why.

Do not run edit-style workflows, PR workflows, cleanup workflows, graph refresh, waiver cleanup, or destructive commands.

Update state and checkpoint log.

## Phase 16: cleanup validation report

Create or update:

```txt
docs/context-orchestrator/stabilization/stab-002-cleanup-validation-report.md
```

Include:

```txt
Scope
Environment
Commands attempted
Results
Files added
Files edited
Files moved
Files removed
Files intentionally kept
Files requiring human decision
Archon workflows inspected
Archon commands inspected
Archon scripts inspected
BMAD assets inspected
Hooks inspected
MCP references inspected
Generated defaults regenerated: yes/no/not needed
Validation warnings
Sufficiency verdict
```

For each command result:

```txt
Command
Status: pass / fail / skipped
Output excerpt
Failure classification
Follow-up
```

Acceptance checklist, pass/partial/fail:

```txt
- Comparison uses origin/dev baseline.
- Every changed file is inventoried or explicitly grouped.
- Every changed file/group has a classification.
- Archon workflows inspected.
- Archon commands inspected.
- Archon scripts inspected.
- BMAD assets inspected.
- Codex hooks inspected.
- Claude hooks/settings inspected.
- Archon per-node hooks inspected.
- MCP references inspected.
- Reference checks were run for move/remove/split candidates.
- Party-mode consensus exists.
- Keep/move/remove/split matrix exists.
- Dry-run cleanup plan exists.
- Cleanup was applied in batches or consciously deferred.
- Post-cleanup reconciliation was completed.
- Local path leakage removed or justified.
- Wrong-baseline evidence corrected or labeled historical.
- STAB-specific docs moved or intentionally kept.
- Branch-specific default commands reviewed.
- Branch-specific default workflows reviewed.
- Generated defaults regenerated if needed.
- Workflow validation passed or failure documented.
- Command validation passed or failure documented.
- Bundle checks passed or failure documented.
- ACO traceability passed or failure documented.
- Repo validation passed or failure documented.
- git diff --check passed or failure documented.
- Human decision queue exists.
- Goal state file is up to date.
- Checkpoint log is up to date.
```

Update state and checkpoint log.

## Phase 17: human decision queue

Add to:

```txt
docs/context-orchestrator/stabilization/stab-002-cleanup-decision-ledger.md
```

Use this format:

```txt
Question
Why it matters
Options
Recommended default
Risk
Files affected
Evidence
```

At minimum include:

```txt
Should .codex project hooks ship to dev?
Should Claude hooks/settings ship as project defaults?
Should ACO policy/OPA be required in main CI or path-scoped?
Should BMAD remain mapped/advisory or become native Archon workflows?
Should .agents/skills/bmad-* be mirrored into .claude/skills?
Should branch-specific /goal commands ship as defaults?
Should ai-layer-* commands ship as defaults?
Should archon-ai-layer-bootstrap ship as a default workflow?
Should context-orchestrate ship as a default workflow?
Should archon-aco-adversarial-loop ship as a default workflow?
Should STAB-specific validation reports remain under docs/ai or move to stabilization/history?
Should generated research reports be retained, pruned, or moved?
Should graph waivers remain, be refreshed, or require approval?
Should repo-local MCP templates exist?
Should README include exact workflow counts?
Should this branch be split into multiple PRs?
Who is DRI for AI governance/BMAD mapping/hooks after merge?
```

Codex may answer questions only when repo evidence is sufficient. Otherwise leave them for the user.

Update state and checkpoint log.

## Phase 18: PR split recommendation

In the decision ledger, recommend whether this should merge as one PR or split into:

```txt
1. General Archon fixes
2. ACO/context-orchestrator product slice
3. BMAD sync assets
4. AI governance docs
5. Codex/Claude/agent config and hooks
6. Stabilization evidence
7. CI/policy changes
8. Default workflows and commands
```

For each slice:

```txt
Files/directories included
Validation proof
Merge risk
Should be included now: yes/no/human decision
```

Do not actually split the branch.

Update state and checkpoint log.

## Phase 19: final adversarial audit

Before declaring completion, perform a final adversarial audit.

Create a section in:

```txt
docs/context-orchestrator/stabilization/stab-002-party-mode-consensus.md
```

Called:

```txt
Final adversarial audit
```

Answer:

```txt
What evidence would prove this cleanup is incomplete?
Are any files un-inventoried?
Are any moved/removed files still referenced?
Are any validation commands skipped without explanation?
Are any branch-specific defaults still present without rationale?
Are any local paths still present?
Are any wrong-baseline reports still presented as final evidence?
Are any destructive or approval-sensitive actions performed?
Is the human decision queue complete?
Could Codex be claiming success because artifacts exist rather than because validation passed?
```

If the adversarial audit finds a blocker, do not complete the goal. Update state with the blocker and next required action.

## Phase 20: final completion gate

Use exactly one sufficiency verdict:

```txt
Sufficient for merge hygiene
Partially sufficient for merge hygiene
Not sufficient for merge hygiene
```

Only say `Sufficient for merge hygiene` if:

```txt
- comparison is against origin/dev
- all changed files are inventoried or explicitly grouped
- Archon workflows/commands/scripts were inspected
- BMAD assets were inspected
- hooks were inspected
- cleanup decisions are recorded
- safe cleanup was applied or intentionally deferred
- post-cleanup reconciliation was completed
- validation was attempted
- no blocking validation issue remains undocumented
- no destructive action was taken without approval
- goal state file is up to date
- checkpoint log is up to date
- final adversarial audit found no blocker
```

If any of these are false, use `Partially sufficient` or `Not sufficient` and explain exactly what remains.

Update `stab-002-goal-state.md`:

```txt
Completion status:
Sufficiency verdict:
Final blocker:
Recommended next step:
```

## Final response required from Codex

At completion, report:

1. Commands used
2. Workflows inspected
3. Workflows executed, if any
4. Archon commands inspected
5. BMAD assets inspected
6. Hooks inspected
7. MCP references inspected
8. Files added
9. Files edited
10. Files moved
11. Files removed
12. Generated defaults regenerated: yes/no/not needed
13. Validation commands run
14. Validation failures or warnings
15. Human decisions still required
16. Whether accidental local leakage remains
17. Whether accidental transient files remain
18. Whether branch-specific defaults remain and why
19. Whether the goal state file is up to date
20. Whether the checkpoint log is up to date
21. Whether the final adversarial audit passed
22. Whether the branch is sufficient for merge hygiene
23. Recommended next step before merge

## Completion condition

Do not declare completion until:

```txt
- goal state file exists
- checkpoint log exists
- diff inventory exists
- file analysis matrix exists
- party-mode consensus exists
- keep/move/remove/split matrix exists
- decision ledger exists
- validation report exists
- Archon workflows were inspected
- Archon commands were inspected
- BMAD assets were inspected
- hooks were inspected
- reference checks were run for cleanup candidates
- dry-run cleanup plan exists
- cleanup was applied or consciously deferred
- post-cleanup reconciliation completed
- validation attempted
- final adversarial audit completed
- final response gives a clear sufficiency verdict
```

Do not declare completion merely because artifacts were written.
