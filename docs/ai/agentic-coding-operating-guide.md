# Agentic Coding Operating Guide

This guide is the operating model. The compliance matrix is the current source of truth for repo coverage.

Start here for operational status:

- [AI operating layer index](README.md)
- [Workflow compliance matrix](workflow-compliance-matrix.md)
- [BMAD to Archon mapping](bmad-to-archon-mapping.md)
- [STAB-002 validation report](stab-002-validation-report.md)

## 1. Operating principle

A reliable AI coding workflow is not "ask the model better." It is "encode the development process as version-controlled workflow assets with scoped context, deterministic gates, isolated execution, explicit artifacts, bounded loops, human approvals, and outcome-based validation."

Prompts describe intent; workflows enforce process.

The original recommendations remain useful: use scoped context, lean repo instructions, ownership, tests, LSP, MCP, skills, hooks, subagents, traces, and maintenance. They are incomplete unless the team turns them into assets that can be committed, reviewed, validated, and run the same way twice.

The operating system has three layers:

1. Context layer
2. Process layer
3. Assurance layer

The context layer helps the agent understand. The process layer makes the work repeatable. The assurance layer proves the outcome is acceptable.

## 2. Ubiquitous language

Agent: An AI coding worker that can read, edit, run tools, and report results.

Harness: The runtime around the agent: instructions, tools, permissions, workflows, hooks, MCP, skills, logs, and isolation.

Workflow: A named, runnable process made of ordered or parallel nodes.

Workflow-as-code: Workflow definitions stored as version-controlled files.

Command: A reusable markdown prompt loaded by a workflow node.

Command frontmatter: Metadata at the top of a command file, such as `description` and `argument-hint`.

Node: One executable unit in a workflow.

Node type: The single execution kind on a node: `command`, `prompt`, `bash`, `script`, `loop`, `approval`, or `cancel`.

DAG: Directed acyclic graph; workflow shape where nodes declare dependencies and cannot form cycles.

Dependency: A node listed in `depends_on` that must reach the required state before another node runs.

Condition: A `when` expression that decides whether a node runs.

Trigger rule: Join behavior for dependencies, such as `all_success`, `one_success`, `none_failed_min_one_success`, or `all_done`.

Structured output: JSON output constrained by `output_format` so downstream nodes can branch on fields.

Artifact: A durable file written by a node for downstream nodes, reviewers, and run history.

Artifact chain: The sequence of artifacts that carries state from request to final outcome.

Context: Information given to the agent for one node or run.

Fresh context: A new agent session with no hidden memory from prior nodes or iterations.

Shared context: A continued session where prior conversation may remain available.

Context pack: A curated bundle of files, symbols, evidence, and instructions for one task.

Contract: The explicit agreement for scope, inputs, outputs, validation, risks, and done criteria.

Gate: A required checkpoint before the workflow can continue.

Approval gate: A human gate implemented with an `approval` node.

Rejection reason: Human feedback captured as `$REJECTION_REASON` after an approval rejection.

Loop: A node that repeats an AI prompt until a completion signal, deterministic exit, or max iteration failure.

Completion signal: The text that marks loop completion, preferably `<promise>SIGNAL</promise>`.

Deterministic check: A non-AI check with repeatable pass/fail semantics.

Deterministic node: A `bash` or `script` node that executes without AI judgment.

AI node: A `command`, `prompt`, or `loop` node that invokes an AI provider.

Script node: A deterministic node that runs TypeScript, JavaScript, or Python with `runtime: bun` or `runtime: uv`.

Bash node: A deterministic node that runs a shell command and captures stdout.

Cancel node: A node that intentionally stops the workflow with a reason.

Worktree: A separate git checkout used by one workflow run.

Isolation: Keeping workflow writes away from the live checkout and other runs.

Branch lifecycle: The rules for branch naming, pushing, PRs, resume, abandon, complete, and cleanup.

Router: Logic that selects the right workflow or BMAD route for a request.

Provider: The AI backend adapter, such as Claude, Codex, or Pi.

Platform adapter: The surface that starts or receives workflow messages, such as CLI, Web UI, GitHub, Slack, Telegram, or Discord.

Isolation provider: The component that creates safe execution environments, usually git worktrees.

Hook: Runtime interception for tool use, prompts, sessions, or other provider events.

Skill: Reusable specialist knowledge loaded into selected nodes.

Plugin: An organization package for approved skills, hooks, MCP configs, and related assets.

Subagent: A role-specific helper agent spawned by the main agent.

Inline agent: A subagent defined inside one workflow YAML.

Reusable agent: A shared role stored in `.claude/agents/*.md`.

MCP server: A Model Context Protocol server that exposes external tools or data.

Tool restriction: Per-node `allowed_tools` or `denied_tools` limits on provider tools.

Sandbox: Runtime filesystem and network restrictions around an AI node.

Budget cap: A max cost setting, such as `maxBudgetUsd`, that stops expensive nodes.

Trace: A record of agent messages, tool calls, and execution flow.

Workflow event: A durable lifecycle event such as node start, completion, failure, approval, or summary.

Workflow run: One execution of a workflow with a run ID, branch, worktree, events, logs, and artifacts.

Run history: Stored records for completed, failed, paused, resumed, abandoned, and cleaned-up runs.

Outcome: The final result: PR created, validation passed, review failed, cancelled, abandoned, or completed.

Grader: A deterministic or human evaluator that scores an outcome.

Rubric: The explicit criteria a grader or reviewer uses.

Retry: Re-executing a failed node under policy.

Resume: Restarting a failed or paused workflow from saved run state.

Abandon: Cancelling a stuck or unwanted run and releasing its lock.

Complete: Closing a branch lifecycle after merge or deliberate discard.

DRI: Directly responsible individual who owns the harness, workflows, docs, and maintenance.

## 3. What to keep from the original guide

DRI ownership: Keep one accountable owner for the harness. In workflow-as-code, the DRI owns workflow catalog review, schema upgrades, permission audits, and eval cadence.

Codebase map: Keep a concise map of packages, owners, commands, and risk areas. Use it as context input for investigation and planning commands instead of forcing every node to rediscover the repo.

CLAUDE.md: Keep durable repo rules and high-level project context. Move procedures into `.archon/commands/` and `.archon/workflows/`.

Subdirectory context files: Keep package-specific instructions near the code. Workflow investigation nodes must read the nearest context file before editing that package.

Task contracts: Convert them into workflow inputs plus artifact schemas. A contract should name scope, output, validation, risks, approval gates, and branch policy.

Scoped context: Keep context small and relevant. Use context packs and artifacts instead of pasting broad repo state into every node.

Ignore rules and permissions: Keep deny defaults in `.claude/settings.json`, `.gitignore`, sandbox policy, and per-node tool restrictions.

Hooks: Keep hooks for tool-time enforcement. Workflows sequence the process; hooks intercept, deny, modify, or observe tool calls at runtime.

Skills: Keep reusable specialist knowledge, but scope skills to nodes. Skills are not global prompt clutter.

LSP: Keep symbol-level navigation for definitions and references. Use grep for broad discovery, not as the primary navigation mechanism.

MCP: Keep MCP for external tools or data. Attach MCP only to the node that needs the external capability.

Subagents: Keep role separation. Use inline workflow agents for one-off workflow roles and reusable `.claude/agents` for shared roles.

Outcome-based evals: Keep evals, but build them from repeated workflow failures and real review findings.

Trace review: Expand it into review of traces, artifacts, logs, workflow events, approval decisions, validation output, and final outcomes.

Quarterly maintenance: Keep cadence. Remove obsolete model hacks, retest provider compatibility, validate workflows, and refresh rubrics.

## 4. What was missing

The missing layer is operationalization. The guide needs assets and rules that a team can run, not only advice.

Add a workflow catalog, YAML DAG workflows, reusable command prompts, command frontmatter, explicit artifact schemas, `$ARTIFACTS_DIR` conventions, worktree isolation, branch lifecycle, Archon config files, global versus repo-specific workflow assets, CLI versus Server/Web UI discovery differences, deterministic bash nodes, deterministic script nodes, structured JSON outputs, conditional routing, trigger rules, cancel nodes, loop nodes, max iteration limits, fresh-context loops, `$LOOP_PREV_OUTPUT`, `$LOOP_USER_INPUT`, deterministic loop exits with `until_bash`, loop limitations, human approval gates, approval rejection and rework flow, `$REJECTION_REASON`, retry policy, resume policy, abandon policy, complete policy, workflow validation, command validation, per-node tool restrictions, per-node MCP, per-node skills, per-node hooks, inline agents, reusable agents, global workflows, commands, and scripts, workflow events, logs, dashboard or run history, CLI lifecycle commands, PR creation and review automation, security and secret handling, platform adapters, provider selection, streaming versus batch mode, and fork/upstream verification.

Sqcoot or any fork may differ from upstream Archon. Verify the installed source and schema before copying examples.

## 5. What to edit

| Original idea | Edit to make | Reason |
| --- | --- | --- |
| Task contract | Contract + workflow selection + artifact schema. | Makes scope and handoff executable. |
| Use hooks | Use hooks for tool-time enforcement; use workflows for process sequencing. | Hooks and workflows solve different problems. |
| Use skills | Use skills only where specialist knowledge is needed. | Prevents context bloat and role confusion. |
| Use MCP | Attach MCP only to the node that needs external tools. | Reduces permission and secret exposure. |
| Use subagents | Choose inline agents for one workflow; reusable agents for shared roles. | Keeps local roles close and shared roles reusable. |
| Run tests | Use deterministic validation nodes and loop exits. | Prevents unverifiable "tests passed" claims. |
| Review traces weekly | Review traces, artifacts, logs, workflow events, and outcomes. | Traces alone miss validation and artifact quality. |
| Create evals | Validate workflows first, then build eval suites from repeated failures. | Workflow correctness comes before agent quality scoring. |
| Keep CLAUDE.md lean | Keep CLAUDE.md durable; move procedures into commands and workflows. | Durable context should not become a process script. |
| Let agent iterate | Use bounded loops with completion signals, disk state, and deterministic exits. | Avoids context rot and runaway work. |
| Use worktrees | Define branch lifecycle, cleanup, resume, abandon, and complete policies. | Isolation needs operational ownership. |
| Use Archon | Verify the installed fork/upstream version and schema before copying examples. | Workflow fields and provider support can drift. |

## 6. What to add

```text
docs/ai/
  README.md
  agentic-coding-operating-guide.md
  workflow-compliance-matrix.md
  bmad-to-archon-mapping.md
  workflow-validation.md
  worktree-and-branch-lifecycle.md
  security-and-secrets.md
  source-traceability.md
  stab-002-validation-report.md

CLAUDE.md

.claude/
  settings.json
  skills/
    archon/SKILL.md
    scoped-tests/SKILL.md
    rulecheck/SKILL.md
  agents/
    code-reviewer.md
    codebase-analyst.md
    pr-test-analyzer.md
    silent-failure-hunter.md

.agents/
  skills/
    bmad-help/SKILL.md
    bmad-investigate/SKILL.md
    bmad-prd/SKILL.md
    bmad-code-review/SKILL.md
    bmad-review-adversarial-general/SKILL.md

.archon/
  config.yaml
  workflows/
    defaults/
      archon-assist.yaml
      archon-idea-to-pr.yaml
      archon-fix-github-issue.yaml
      archon-plan-to-pr.yaml
      archon-refactor-safely.yaml
      archon-smart-pr-review.yaml
      archon-validate-pr.yaml
      archon-resolve-conflicts.yaml
      archon-architect.yaml
      archon-ai-layer-bootstrap.yaml
      context-orchestrate.yaml
  commands/
    defaults/
      archon-create-plan.md
      archon-implement.md
      archon-validate.md
      archon-code-review-agent.md
      archon-create-pr.md
      archon-workflow-summary.md
      ai-layer-*.md
  scripts/
    maintainer-standup-*.ts
    marketplace-*.ts
  mcp/
    # No repo-local MCP configs were found for this patch.
    # Treat guide MCP paths as illustrative until files exist.
  state/
    stabilization-ledger.json
```

`docs/ai/` contains policy, catalog, schemas, rubrics, and eval definitions. It must not contain secrets or transient run output.

`CLAUDE.md` contains durable project rules and repo context. It must not contain procedural workflow steps, reusable specialist knowledge, or workflow YAML.

`.claude/settings.json` contains Claude permissions and safety defaults. Treat it as trust-sensitive; prefer proposed changes when merge safety is unclear.

`.claude/skills/` contains reusable specialist knowledge. It must not become a dumping ground for one-off task instructions.

`.claude/agents/` contains reusable role definitions. It must not duplicate inline agents that are only relevant to one workflow.

`.archon/config.yaml` contains repo-specific Archon defaults. It must not contain secrets.

`.archon/.env.example`, if added, lists required variable names and descriptions only. It must not contain real tokens, keys, URLs with credentials, or provider auth config.

`.archon/workflows/` contains deterministic process orchestration. Do not use removed `steps:` workflows.

`.archon/commands/` contains reusable AI prompts. Each command must know inputs, outputs, artifact format, validation, and reporting.

`.archon/scripts/` contains deterministic TypeScript, JavaScript, or Python logic. Use it for parsing and transformations that would be brittle in bash.

`.archon/mcp/`, if present, contains MCP config files referenced by nodes. Use env vars for secrets and consider gitignore policy before committing.

`.archon/state/` contains cross-run state when needed. Keep it gitignored unless the state is deliberately versioned.

Do not put secrets in workflow YAML. Do not commit transient artifacts from `$ARTIFACTS_DIR`. Commit workflow files, command files, scripts, docs, skills, agents, and safe config defaults.

## 7. Workflow catalog

Default naming guidance:

- Repo workflows may be named without the `archon-` prefix if the team prefers.
- If overriding bundled defaults, use exact names intentionally.
- Keep workflow names unambiguous because workflow name matching may support exact, case-insensitive, suffix, and substring matching depending on platform/version.

| Workflow | Use when | Do not use when | Main phases | Required artifacts | Required validation | Human gates | Risk | Worktree policy | Provider/model class | Tools/MCP | Expected CLI command |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `assist` | Triage, Q&A, one-off exploration. | Code-changing work with unclear scope. | Load, explore, answer or route. | Optional notes artifact for non-trivial findings. | None or read-only checks. | None by default. | Low. | `--no-worktree` for read-only; worktree for writes. | Fast general model. | Repo read tools; no MCP unless external context needed. | `archon workflow run assist --no-worktree "question"` |
| `idea-to-pr` | Feature idea needs plan through PR. | Existing approved plan exists. | Classify, investigate, plan, approve, implement loop, validate, review, fix, PR, report. | Classification, investigation, plan, validation, review, PR summary. | Type, lint, tests, build, artifact completeness. | Plan approval, final approval, PR policy. | High. | Required isolated worktree. | Strong coding model; fallback model. | GitHub MCP for PR; docs MCP only for external docs. | `archon workflow run idea-to-pr --branch archon/task/<slug> "idea"` |
| `fix-issue` | GitHub/Linear issue or manual bug report needs fix. | Broad feature discovery or pure review. | Fetch context, investigate, root cause, plan, gate if risky, implement, validate, review, fix, PR, report. | Issue context, root cause, plan, validation, review, PR summary. | Repro test, focused package tests, type/lint. | Risky fix gate; PR gate if policy. | Medium to high. | Isolated worktree. | Strong coding model. | GitHub/Linear MCP only on fetch/PR nodes. | `archon workflow run fix-issue --branch archon/fix/123-login "Fix #123"` |
| `plan-to-pr` | Approved plan artifact should be executed. | Plan is missing or stale. | Load plan, drift check, approve drift, implement, validate, review, PR, report. | Plan intake, drift report, implementation notes, validation, review. | Plan completeness, type/lint/tests. | Drift or scope-change approval. | Medium. | Isolated worktree. | Strong coding model. | None unless PR/ticket creation. | `archon workflow run plan-to-pr --branch archon/task/<slug> "$ARTIFACTS_DIR/plan.md"` |
| `refactor-safely` | Behavior-preserving refactor. | User asks for behavior change. | Scope, public API check, approve, batch edits, per-batch type check, behavior validation, review, report. | Scope, API impact, batch tracker, validation, review. | Type after each batch, tests before/after, diff summary. | Broad edit/public API gate, final approval. | High. | Isolated worktree required. | Strong coding model; high effort. | No MCP unless external API contract needed. | `archon workflow run refactor-safely --branch archon/refactor/<area>-<slug> "scope"` |
| `smart-pr-review` | Review PR efficiently with adaptive reviewers. | Need full exhaustive audit regardless of scope. | Gather diff, classify, parallel reviews, synthesize, optional fix, report. | PR scope, reviewer artifacts, synthesis, optional fix summary. | Deterministic diff/test checks where feasible. | Optional self-fix approval. | Medium. | Usually read-only `--no-worktree`; worktree if self-fix. | Fast classifier + strong reviewers. | GitHub MCP for PR metadata; security/docs MCP only when needed. | `archon workflow run smart-pr-review --no-worktree "PR 123"` |
| `validate-pr` | PR needs deterministic validation matrix. | User wants qualitative code review only. | Diff, classify areas, choose checks, run checks, parse, artifact, cancel/fail, report. | Diff summary, validation plan, raw outputs, parsed artifact. | Selected Level 1-5 checks. | None unless rerun/destructive checks. | Medium. | Read-only worktree or PR branch worktree. | Script/bash first; AI only for summary. | No MCP unless fetching PR metadata. | `archon workflow run validate-pr --branch archon/review/123 "PR 123"` |
| `resolve-conflicts` | Branch or PR has merge conflicts. | No conflicts or semantic redesign needed. | Fetch, detect conflicts, analyze intent, approve complex choices, resolve, validate, report. | Conflict map, resolution plan, validation, summary. | Type/lint/tests touching conflicted areas. | Complex conflict approval. | High. | Isolated worktree on conflict branch. | Strong coding model. | GitHub MCP optional for PR context. | `archon workflow run resolve-conflicts --branch archon/fix/conflicts-123 "PR 123"` |
| `architectural-sweep` | Repo health, complexity, or architecture review. | Single bug or feature. | Inventory, metrics, risk classify, proposal, approval, limited edits, validation, report. | Architecture findings, proposal, edit plan, validation, review. | Package-level validation plus targeted architecture checks. | Approval before edits. | High. | Isolated worktree for edits; read-only otherwise. | Strong reviewer/planner model. | Docs/design-system MCP if needed. | `archon workflow run architectural-sweep --branch archon/refactor/arch-sweep "area"` |
| `workflow-self-improve` | Prior workflow runs show repeated failures. | No run evidence exists. | Read run summary, inspect artifacts/logs, identify patterns, propose changes, approve, edit assets, validate, report. | Failure analysis, proposal, changed asset list, validation, summary. | `archon validate workflows`, `archon validate commands`, sample dry run. | Required before workflow asset edits. | High. | Isolated worktree. | Strong workflow architect model. | None unless reading remote PR/issue data. | `archon workflow run workflow-self-improve --branch archon/workflow/self-improve "run-id"` |

## 8. Standard workflow shape

Standard shape for non-trivial work:

1. Classify
2. Investigate
3. Plan
4. Approval gate
5. Implement
6. Validate
7. Review
8. Self-fix
9. Final approval
10. Create PR
11. Report
12. Emit run summary event

Classify should be an AI node with `output_format`, or a deterministic script node when rules are clear. Investigate is an AI command node with read-only tools. Plan is an AI command node that writes an artifact. Approval gate is an `approval` node. Implement is an AI command node or loop node. Validate is `bash` or `script`. Review is an AI command node, often parallel reviewers. Self-fix is an AI loop or command node gated by review findings. Final approval is an `approval` node. Create PR is an AI command using `gh` or a deterministic script if the PR body is fully defined. Report is a prompt or script node. Emit event is a CLI command or deterministic node where appropriate.

Every non-trivial workflow must produce at least:

- investigation artifact
- plan artifact
- validation artifact
- review artifact
- final run summary artifact

## 9. Artifact contract

Artifacts are the handoff between workflow nodes.

- Artifacts live in `$ARTIFACTS_DIR`.
- `$ARTIFACTS_DIR` is outside the repo.
- Artifacts should not depend on hidden conversation memory.
- Every downstream node must be able to work from the artifact and the current repository state.
- Every artifact must include file paths, evidence, decisions, validation, risks, and next-node instructions.
- If a node changes code, it must write what changed and how to verify it.
- If a node cannot complete, it must write a failure artifact explaining why.

```markdown
# Artifact: <name>

## Source request

## Workflow run

- Workflow ID:
- Workflow name:
- Node ID:
- Branch:
- Worktree path:
- Base branch:
- Created at:

## Problem statement

## Scope

## Out of scope

## Relevant files

For each file include:
- Path
- Why it matters
- Relevant lines or symbols
- Current behavior
- Evidence

## Root cause or design decision

## Implementation plan

For each task include:
- File
- Action
- Exact change
- Risk
- Validation

## Edge cases

## Validation commands

## Validation result

## Open questions

## Next node instructions

## Failure mode, if any
```

Every downstream node must be able to work from the artifact without relying on hidden chat memory.

## 10. Command template

```markdown
---
description: One-line description shown in command/workflow lists
argument-hint: <expected-input-format>
---

# Command Name

## Inputs

- User message: $USER_MESSAGE
- Arguments: $ARGUMENTS
- Workflow ID: $WORKFLOW_ID
- Artifacts directory: $ARTIFACTS_DIR
- Base branch: $BASE_BRANCH
- Docs directory: $DOCS_DIR
- Workflow context: $CONTEXT
- External context: $EXTERNAL_CONTEXT
- Issue context: $ISSUE_CONTEXT
- Upstream node output: $nodeId.output
- Upstream node field: $nodeId.output.field
- Previous loop output: $LOOP_PREV_OUTPUT
- Loop user input: $LOOP_USER_INPUT
- Rejection reason: $REJECTION_REASON

## Output

Write the artifact to `$ARTIFACTS_DIR/<category>/<node-id>.md`.
Use the artifact template from `docs/ai/artifact-schema.md`.
Create parent directories before writing.
If the input artifact is missing, stop and write `$ARTIFACTS_DIR/failures/<node-id>.md` with the missing path, expected producer, and next action.
If code drift is detected, stop unless the drift is trivial; write the expected snippet, actual snippet, affected file, and recommendation.

## Phase 1: LOAD

Read the request, relevant upstream artifacts, `CLAUDE.md`, nearest package context file, and `CODEBASE_MAP.md`.

Checkpoint:
- [ ] Source request loaded
- [ ] Required upstream artifacts loaded or failure artifact written
- [ ] Relevant repo rules loaded
- [ ] Scope and out-of-scope recorded

## Phase 2: EXPLORE

Use symbol navigation where possible. Use broad text search only for discovery. Record file paths, symbols, and evidence.

Checkpoint:
- [ ] Relevant files identified
- [ ] Relevant symbols or lines captured
- [ ] Existing behavior understood
- [ ] External context used only when needed

## Phase 3: ANALYZE

Determine root cause, design decision, risk level, required validation, and whether approval is needed.

Checkpoint:
- [ ] Root cause or decision stated
- [ ] Risks listed
- [ ] Validation plan selected
- [ ] Approval need stated

## Phase 4: PRODUCE

Create or update only the intended files. Keep edits scoped. Do not perform unrelated refactors.

Checkpoint:
- [ ] Intended files only changed
- [ ] Changes match plan
- [ ] No secrets or transient artifacts added
- [ ] If staging is needed, stage only intended files by name; never run blind `git add .`

## Phase 5: VALIDATE

Run scoped validation first. Use the commands named in the plan. For a TypeScript repo, prefer type check, lint, focused tests, and relevant build checks before broad validation.

Checkpoint:
- [ ] Validation commands run or blocker recorded
- [ ] Raw output captured or summarized with path to logs
- [ ] Failures classified
- [ ] Success criteria checked

## Phase 6: WRITE ARTIFACT

Write the artifact to `$ARTIFACTS_DIR/<category>/<node-id>.md`.
Include source request, workflow run metadata, scope, files, evidence, decisions, implementation plan, validation commands, validation result, risks, open questions, next node instructions, and failure mode.

Checkpoint:
- [ ] Artifact exists
- [ ] Artifact is complete enough for fresh context
- [ ] Next node can act without hidden memory
- [ ] Failure artifact written if incomplete

## Phase 7: REPORT

Report concise result, artifact path, changed files, validation result, blockers, and next action.

Checkpoint:
- [ ] Summary names artifact path
- [ ] Validation result included
- [ ] Intended staged files named if staging occurred
- [ ] Next action clear

## Success criteria

- Artifact written to `$ARTIFACTS_DIR`
- No hidden-memory dependency
- Validation output captured
- Only intended files changed
- No secrets in YAML or docs
- Downstream node instructions complete
```

## 11. Workflow YAML templates

These examples are illustrative only; validate against the installed Archon fork before copying. This repo's real assets use `archon-*` and `ai-layer-*` workflow and command names; see `workflow-compliance-matrix.md` for current coverage. Short command names such as `classify`, `plan`, `review`, `summarize-run`, and sample `.archon/mcp/*.json` paths are placeholders unless a file exists.

The examples use `nodes:`, not `steps:`. Every node specifies exactly one node type. Loop nodes avoid `retry`, `hooks`, `mcp`, `skills`, `allowed_tools`, `denied_tools`, `output_format`, and per-node provider/model overrides. If iteration needs those capabilities, use normal command nodes or restructure the workflow. Current condition expressions compare against quoted literals, so boolean structured outputs are commonly checked as `== 'true'` or `== 'false'`. The installed fork supports `always_run` on nodes in `packages/workflows/src/schemas/dag-node.ts`; verify upstream before relying on it elsewhere.

### 11.1 idea-to-pr.yaml

```yaml
name: idea-to-pr
description: Turn a feature idea into a validated PR with artifacts, gates, loops, review, and report.
provider: claude
model: sonnet
interactive: true
worktree:
  enabled: true
tags: [Feature, PR]

nodes:
  - id: classify
    command: classify
    output_format:
      type: object
      properties:
        risk: { type: string, enum: [low, medium, high] }
        touches_ui: { type: boolean }
        needs_external_docs: { type: boolean }
      required: [risk, touches_ui, needs_external_docs]
    allowed_tools: [Read, Grep, Glob]

  - id: investigate
    command: investigate
    depends_on: [classify]
    context: fresh
    allowed_tools: [Read, Grep, Glob, Bash]
    denied_tools: [WebSearch, WebFetch]

  - id: docs-context
    prompt: |
      Fetch only external docs needed for this request.
      Request: $ARGUMENTS
      Classification: $classify.output
      Write findings to $ARTIFACTS_DIR/docs-context.md.
    depends_on: [classify]
    when: "$classify.output.needs_external_docs == 'true'"
    mcp: .archon/mcp/docs.json
    allowed_tools: []

  - id: plan
    command: plan
    depends_on: [investigate, docs-context]
    trigger_rule: none_failed_min_one_success
    context: fresh
    skills: [api-client-update, test-generation]

  - id: plan-gate
    approval:
      message: "Review `$ARTIFACTS_DIR/plan.md` before implementation."
      capture_response: true
      on_reject:
        prompt: |
          Revise the plan using this rejection reason:
          $REJECTION_REASON
          Write the revised plan to $ARTIFACTS_DIR/plan.md.
        max_attempts: 3
    depends_on: [plan]

  - id: implement-loop
    depends_on: [plan-gate]
    idle_timeout: 1800000
    loop:
      prompt: |
        You are in a fresh implementation iteration when configured so. Do not rely on hidden memory.
        Read $ARTIFACTS_DIR/plan.md and $ARTIFACTS_DIR/implementation-progress.md.
        Previous iteration output:
        $LOOP_PREV_OUTPUT

        Implement the next unfinished task, update $ARTIFACTS_DIR/implementation-progress.md,
        and record changed files and validation attempted.

        When every planned task is implemented and local validation passes, output:
        <promise>IMPLEMENTED</promise>
      until: IMPLEMENTED
      max_iterations: 6
      fresh_context: true
      until_bash: |
        test -f "$ARTIFACTS_DIR/implementation-progress.md" &&
        bun run type-check >/tmp/archon-typecheck.log 2>&1

  - id: validate
    bash: |
      set -euo pipefail
      mkdir -p "$ARTIFACTS_DIR/validation"
      bun run type-check 2>&1 | tee "$ARTIFACTS_DIR/validation/type-check.log"
      bun run lint 2>&1 | tee "$ARTIFACTS_DIR/validation/lint.log"
      bun run test 2>&1 | tee "$ARTIFACTS_DIR/validation/test.log"
    depends_on: [implement-loop]
    timeout: 1800000

  - id: review
    command: review
    depends_on: [validate]
    context: fresh
    allowed_tools: [Read, Grep, Glob, Bash]
    agents:
      adversarial-reviewer:
        description: Finds missing requirements, untested behavior, and unsafe assumptions.
        prompt: |
          Review the diff and artifacts adversarially. Cite evidence and required fixes.
        model: haiku
        tools: [Read, Grep, Glob, Bash]

  - id: self-fix
    command: implement
    depends_on: [review]
    when: "$review.output != 'APPROVE'"
    context: fresh
    allowed_tools: [Read, Grep, Glob, Edit, MultiEdit, Write, Bash]
    hooks:
      PreToolUse:
        - matcher: "Write|Edit|MultiEdit"
          response:
            hookSpecificOutput:
              hookEventName: PreToolUse
              additionalContext: "Only edit files named in the review artifact or plan."

  - id: final-approval
    approval:
      message: "Review validation and review artifacts before PR creation."
      capture_response: true
    depends_on: [review, self-fix]
    trigger_rule: none_failed_min_one_success

  - id: create-pr
    command: create-pr
    depends_on: [final-approval]
    context: fresh
    mcp: .archon/mcp/github.json
    allowed_tools: [Read, Grep, Glob, Bash]

  - id: report
    command: summarize-run
    depends_on: [create-pr]
    context: fresh

  - id: emit-summary-event
    bash: |
      archon workflow event emit --run-id "$WORKFLOW_ID" --type run_summary --data "$(cat "$ARTIFACTS_DIR/final-summary.json")"
    depends_on: [report]
```

### 11.2 fix-issue.yaml

```yaml
name: fix-issue
description: Fix an issue using issue context, root cause artifact, validation, review, and PR creation.
provider: claude
model: sonnet
interactive: true
worktree:
  enabled: true
tags: [Issue, Fix]

nodes:
  - id: issue-context
    prompt: |
      Use $CONTEXT when present. If empty, parse issue details from $ARGUMENTS.
      Write $ARTIFACTS_DIR/issue-context.md.
    output_format:
      type: object
      properties:
        source: { type: string, enum: [github, manual] }
        issue_number: { type: string }
        risky: { type: boolean }
      required: [source, risky]
    mcp: .archon/mcp/github.json

  - id: investigate
    command: investigate
    depends_on: [issue-context]
    allowed_tools: [Read, Grep, Glob, Bash]

  - id: root-cause
    prompt: |
      Read $ARTIFACTS_DIR/issue-context.md and $ARTIFACTS_DIR/investigation.md.
      Write root cause, exact files, and validation plan to $ARTIFACTS_DIR/root-cause.md.
    depends_on: [investigate]
    allowed_tools: [Read, Grep, Glob]

  - id: plan
    command: plan
    depends_on: [root-cause]

  - id: risky-fix-gate
    approval:
      message: "Risky fix detected. Review `$ARTIFACTS_DIR/plan.md`."
      capture_response: true
      on_reject:
        prompt: "Revise `$ARTIFACTS_DIR/plan.md` using: $REJECTION_REASON"
        max_attempts: 2
    depends_on: [plan]
    when: "$issue-context.output.risky == 'true'"

  - id: implement
    command: implement
    depends_on: [plan, risky-fix-gate]
    trigger_rule: none_failed_min_one_success
    allowed_tools: [Read, Grep, Glob, Edit, MultiEdit, Write, Bash]

  - id: validate
    bash: |
      set -euo pipefail
      mkdir -p "$ARTIFACTS_DIR/validation"
      bun run type-check 2>&1 | tee "$ARTIFACTS_DIR/validation/type-check.log"
      bun run test 2>&1 | tee "$ARTIFACTS_DIR/validation/test.log"
    depends_on: [implement]

  - id: review
    command: review
    depends_on: [validate]
    context: fresh

  - id: self-fix
    command: implement
    depends_on: [review]
    when: "$review.output != 'APPROVE'"

  - id: create-pr
    command: create-pr
    depends_on: [review, self-fix]
    trigger_rule: none_failed_min_one_success
    mcp: .archon/mcp/github.json

  - id: report
    command: summarize-run
    depends_on: [create-pr]
```

### 11.3 smart-pr-review.yaml

```yaml
name: smart-pr-review
description: Adapt review depth to PR complexity and synthesize findings.
provider: claude
model: sonnet
worktree:
  enabled: false
tags: [Review]

nodes:
  - id: classify-pr
    command: classify
    mcp: .archon/mcp/github.json
    output_format:
      type: object
      properties:
        reviewable: { type: boolean }
        complexity: { type: string, enum: [small, medium, high] }
        touches_ui: { type: boolean }
        touches_security: { type: boolean }
        touches_tests: { type: boolean }
      required: [reviewable, complexity, touches_ui, touches_security, touches_tests]

  - id: cancel-unreviewable
    cancel: "PR cannot be reviewed safely from available diff or context."
    depends_on: [classify-pr]
    when: "$classify-pr.output.reviewable == 'false'"

  - id: standard-reviewer
    command: review
    depends_on: [classify-pr]
    allowed_tools: [Read, Grep, Glob, Bash]

  - id: adversarial-reviewer
    command: adversarial-review
    depends_on: [classify-pr]
    when: "$classify-pr.output.complexity != 'small'"
    allowed_tools: [Read, Grep, Glob, Bash]

  - id: security-reviewer
    prompt: "Review the PR for security risk. Cite exact evidence. Write $ARTIFACTS_DIR/review/security.md."
    depends_on: [classify-pr]
    when: "$classify-pr.output.touches_security == 'true'"
    allowed_tools: [Read, Grep, Glob, Bash]

  - id: accessibility-reviewer
    prompt: "Review UI changes for accessibility. Write $ARTIFACTS_DIR/review/accessibility.md."
    depends_on: [classify-pr]
    when: "$classify-pr.output.touches_ui == 'true'"
    skills: [accessibility-review]

  - id: test-reviewer
    prompt: "Review test adequacy. Write $ARTIFACTS_DIR/review/tests.md."
    depends_on: [classify-pr]
    when: "$classify-pr.output.touches_tests == 'true' || $classify-pr.output.complexity == 'high'"

  - id: synthesize-findings
    command: summarize-run
    depends_on: [standard-reviewer, adversarial-reviewer, security-reviewer, accessibility-reviewer, test-reviewer]
    trigger_rule: none_failed_min_one_success

  - id: optional-self-fix
    command: implement
    depends_on: [synthesize-findings]
    when: "$synthesize-findings.output.requiredFixes == 'true'"

  - id: report
    command: summarize-run
    depends_on: [synthesize-findings, optional-self-fix]
    trigger_rule: none_failed_min_one_success
```

### 11.4 refactor-safely.yaml

```yaml
name: refactor-safely
description: Refactor in small batches with API detection, validation, and approval gates.
provider: claude
model: sonnet
interactive: true
worktree:
  enabled: true
tags: [Refactor]

nodes:
  - id: scope-detection
    command: investigate
    allowed_tools: [Read, Grep, Glob, Bash]

  - id: public-api-detection
    script: classify-risk
    runtime: bun
    depends_on: [scope-detection]

  - id: broad-edit-gate
    approval:
      message: "Review scope and public API impact before broad edits."
      capture_response: true
    depends_on: [public-api-detection]
    when: "$public-api-detection.output.risk == 'high'"

  - id: initialize-batches
    bash: |
      mkdir -p "$ARTIFACTS_DIR/refactor"
      printf '{"nextBatch":1,"complete":false}\n' > "$ARTIFACTS_DIR/refactor/batches.json"
    depends_on: [scope-detection, broad-edit-gate]
    trigger_rule: none_failed_min_one_success

  - id: implement-batches
    depends_on: [initialize-batches]
    loop:
      prompt: |
        Read $ARTIFACTS_DIR/refactor/batches.json and implement the next small batch only.
        Run type-check after the batch and update the batch tracking artifact.
        Previous iteration output:
        $LOOP_PREV_OUTPUT
        When all batches are complete, output <promise>REFACTOR_COMPLETE</promise>.
      until: REFACTOR_COMPLETE
      max_iterations: 10
      fresh_context: true
      until_bash: |
        test -f "$ARTIFACTS_DIR/refactor/batches.json" &&
        bun run type-check >/tmp/refactor-typecheck.log 2>&1 &&
        grep -q '"complete":true' "$ARTIFACTS_DIR/refactor/batches.json"

  - id: behavior-validation
    bash: |
      set -euo pipefail
      mkdir -p "$ARTIFACTS_DIR/validation"
      bun run type-check 2>&1 | tee "$ARTIFACTS_DIR/validation/type-check.log"
      bun run test 2>&1 | tee "$ARTIFACTS_DIR/validation/test.log"
    depends_on: [implement-batches]

  - id: review
    command: review
    depends_on: [behavior-validation]

  - id: final-approval
    approval:
      message: "Review behavior validation and refactor diff before PR."
      capture_response: true
    depends_on: [review]

  - id: report
    command: summarize-run
    depends_on: [final-approval]
```

### 11.5 validate-pr.yaml

```yaml
name: validate-pr
description: Select and run deterministic PR validation checks.
provider: claude
model: haiku
worktree:
  enabled: false
tags: [Validation]

nodes:
  - id: gather-diff
    bash: |
      set -euo pipefail
      mkdir -p "$ARTIFACTS_DIR/pr"
      git diff --stat "$BASE_BRANCH"...HEAD | tee "$ARTIFACTS_DIR/pr/diff-stat.txt"
      git diff --name-only "$BASE_BRANCH"...HEAD | tee "$ARTIFACTS_DIR/pr/files.txt"

  - id: classify-areas
    script: |
      const fs = require("fs");
      const files = fs.readFileSync(process.env.ARTIFACTS_DIR + "/pr/files.txt", "utf8").trim().split(/\n/).filter(Boolean);
      const result = {
        ui: files.some(f => f.includes("/screens/") || f.endsWith(".tsx")),
        api: files.some(f => f.includes("api") || f.includes("client")),
        tests: files.some(f => f.includes(".test.") || f.includes("__tests__")),
        docsOnly: files.length > 0 && files.every(f => f.endsWith(".md"))
      };
      console.log(JSON.stringify(result));
    runtime: bun
    depends_on: [gather-diff]

  - id: choose-validation
    prompt: |
      Choose required validation commands from changed areas:
      $classify-areas.output
      Write $ARTIFACTS_DIR/validation/plan.md.
    depends_on: [classify-areas]
    output_format:
      type: object
      properties:
        requires_app_checks: { type: boolean }
        requires_e2e: { type: boolean }
      required: [requires_app_checks, requires_e2e]

  - id: run-checks
    bash: |
      set -euo pipefail
      mkdir -p "$ARTIFACTS_DIR/validation"
      bun run type-check 2>&1 | tee "$ARTIFACTS_DIR/validation/type-check.log"
      bun run lint 2>&1 | tee "$ARTIFACTS_DIR/validation/lint.log"
      bun run test 2>&1 | tee "$ARTIFACTS_DIR/validation/test.log"
    depends_on: [choose-validation]

  - id: parse-validation
    script: parse-validation-output
    runtime: bun
    depends_on: [run-checks]
    always_run: true

  - id: cancel-on-required-failure
    cancel: "Required validation failed. See $ARTIFACTS_DIR/validation/summary.json."
    depends_on: [parse-validation]
    when: "$parse-validation.output.status == 'failed'"

  - id: report
    command: summarize-run
    depends_on: [parse-validation]
```

### 11.6 workflow-self-improve.yaml

```yaml
name: workflow-self-improve
description: Improve workflow assets from prior run failures after approval.
provider: claude
model: sonnet
interactive: true
worktree:
  enabled: true
tags: [Workflow, Maintenance]

nodes:
  - id: read-prior-run
    prompt: |
      Read the prior workflow run summary named in $ARGUMENTS.
      Inspect available artifacts and logs. Write $ARTIFACTS_DIR/self-improve/prior-run.md.
    allowed_tools: [Read, Grep, Glob, Bash]

  - id: inspect-failures
    command: investigate
    depends_on: [read-prior-run]
    allowed_tools: [Read, Grep, Glob, Bash]

  - id: propose-edits
    prompt: |
      Identify repeated failure modes and propose edits to workflows, commands, scripts, skills, or docs.
      Do not edit files yet. Write $ARTIFACTS_DIR/self-improve/proposal.md.
    depends_on: [inspect-failures]
    allowed_tools: [Read, Grep, Glob]

  - id: asset-edit-gate
    approval:
      message: "Review workflow asset change proposal before edits."
      capture_response: true
      on_reject:
        prompt: "Revise $ARTIFACTS_DIR/self-improve/proposal.md using $REJECTION_REASON."
        max_attempts: 3
    depends_on: [propose-edits]

  - id: edit-assets
    command: implement
    depends_on: [asset-edit-gate]
    allowed_tools: [Read, Grep, Glob, Edit, MultiEdit, Write, Bash]

  - id: validate-assets
    bash: |
      set -euo pipefail
      mkdir -p "$ARTIFACTS_DIR/self-improve"
      archon validate workflows 2>&1 | tee "$ARTIFACTS_DIR/self-improve/workflows-validation.log"
      archon validate commands 2>&1 | tee "$ARTIFACTS_DIR/self-improve/commands-validation.log"
    depends_on: [edit-assets]

  - id: report
    command: summarize-run
    depends_on: [validate-assets]
```

## 12. Loop rules

Use loops when the work is naturally iterative, validation can fail and feed rework, or a long-running task must survive context-window pressure. Do not use loops for one deterministic command, one approval gate, or a node that requires per-iteration MCP, skills, hooks, structured output, or tool restrictions.

Rules:

- Every loop needs `max_iterations`.
- Every loop needs a completion signal.
- Prefer `<promise>SIGNAL</promise>` over plain signal text.
- Prefer deterministic exits with `until_bash` using tests, type checks, lint, build checks, or scripts.
- Use `fresh_context: true` when context rot or context-window exhaustion is likely.
- If `fresh_context: true`, the agent must read state from disk and artifacts.
- The loop prompt must say the agent has no memory when using fresh context.
- The loop must write progress to disk.
- The loop must not rely on hidden conversation memory.
- Failed validation should feed the next iteration through `$LOOP_PREV_OUTPUT`, artifacts, or previous validation output.
- A loop that reaches `max_iterations` fails; it does not silently succeed.
- A loop's downstream output is the last iteration's output only.
- Accumulated loop history must be written to `$ARTIFACTS_DIR`.
- Do not attach unsupported normal-node fields to loop nodes.
- If you need MCP, skills, hooks, structured output, or tool restrictions during iteration, use a command node or restructure the workflow.

Pattern 1, stateless long-running implementation loop: set `fresh_context: true`, instruct the agent to read a progress artifact, do one unit of work, validate, update progress, and signal only when all work is done.

Pattern 2, retry-on-failure loop with `$LOOP_PREV_OUTPUT`: include prior output in the prompt and ask the agent to focus the next pass on the failed checks or review findings.

Pattern 3, deterministic exit loop with `until_bash`: let the AI attempt fixes, but stop only when a test, type check, lint, build, or script exits successfully.

```yaml
- id: fix-tests-loop
  loop:
    prompt: |
      Read validation output in $ARTIFACTS_DIR/validation.
      Previous iteration:
      $LOOP_PREV_OUTPUT
      Fix one failure class, update $ARTIFACTS_DIR/loop-history.md,
      and output <promise>TESTS_PASS</promise> only when tests pass.
    until: TESTS_PASS
    max_iterations: 4
    fresh_context: true
    until_bash: "bun run test"
```

## 13. Approval gate rules

Use approval gates before public API changes, data model changes, dependency additions, large refactors, security-sensitive changes, destructive git operations, PR creation if required by team policy, production-impacting configuration changes, workflow asset changes, MCP changes, and permission changes.

Capture the human response when useful with `capture_response: true`. Feed rejection reason into the rework node or `approval.on_reject.prompt`. Use `$REJECTION_REASON`. Re-pause after rework. Limit rejection attempts with `max_attempts`. Cancel when unresolved.

Use `approval.on_reject` for gate-then-fix behavior. Use `loop.interactive: true` for conversational refinement. Use workflow-level `interactive: true` when Web UI needs foreground approval or gate messages.

```yaml
- id: plan-gate
  approval:
    message: "Review `$ARTIFACTS_DIR/plan.md` before implementation."
    capture_response: true
    on_reject:
      prompt: |
        Revise the plan using this rejection reason:
        $REJECTION_REASON
        Write the revision to $ARTIFACTS_DIR/plan.md.
      max_attempts: 3
```

## 14. Tool and permission model

Scope capabilities by default:

- Global deny rules in `.claude/settings.json`
- Per-node `allowed_tools`
- Per-node `denied_tools`
- MCP-only nodes using `allowed_tools: []` and `mcp`
- Read-only analysis nodes
- Hooks for enforcing tool behavior
- Sandbox for filesystem/network restrictions
- Budget caps for expensive nodes
- Fallback models for resilience
- Provider compatibility limits
- Loop node limitations

Broad permissions should be the exception.

Examples:

```yaml
# Explorer node
allowed_tools: [Read, Grep, Glob]

# Reviewer node
allowed_tools: [Read, Grep, Glob, Bash]

# Implementer node
allowed_tools: [Read, Grep, Glob, Edit, MultiEdit, Write, Bash]

# MCP-only triage node
allowed_tools: []
mcp: .archon/mcp/github.json

# No-web coding node
denied_tools: [WebSearch, WebFetch]
```

Tool restrictions decide what tools are available. Hooks intercept, deny, modify, or observe tool use at runtime. Bash/script nodes are deterministic and do not need AI tool permissions.

## 15. MCP model

Add MCP only when the workflow needs external tools or data.

Good MCP use cases: GitHub issue and PR context, Linear or Jira tickets, internal docs, database schema, analytics events, feature flags, error monitoring, design-system metadata, and API schema lookup.

Bad MCP use cases: reading files already in the repo, bypassing normal permissions, production write access by default, secrets embedded in workflow YAML, vague "more context" without a specific node need, and attaching every MCP server to every node.

MCP config should be separate from workflow YAML. MCP config should use environment variables for secrets. Use `.archon/mcp/*.json` for repo MCP definitions when local MCP files exist. This branch currently has no repo-local `.archon/mcp/*.json` files, so MCP paths in examples are illustrative. Use per-node `mcp` only where needed. Prefer read-only MCP access first. Production-write MCP access needs an approval gate and audit trail.

MCP support is provider-specific. Some Archon versions wire MCP for Claude and Codex; other providers may ignore it. Validate provider compatibility before rollout. MCP is not supported on loop nodes in the same way as normal command/prompt nodes; restructure if needed.

For conservative cross-provider guides, treat MCP fields as Claude-specific and potentially ignored by other providers unless the installed version proves otherwise.

```json
{
  "github": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "env": {
      "GITHUB_PERSONAL_ACCESS_TOKEN": "$GITHUB_TOKEN"
    }
  }
}
```

```yaml
- id: fetch-pr-context
  prompt: "Fetch PR context and write $ARTIFACTS_DIR/pr/context.md."
  mcp: .archon/mcp/github.json
  allowed_tools: []
```

## 16. Skills, plugins, and agents model

Skill: reusable knowledge loaded into a node.

Plugin: organization distribution package for approved skills, hooks, and MCP configs.

Inline agent: one workflow's local helper defined in YAML.

Reusable agent: shared role stored on disk in `.claude/agents/*.md`.

Useful skills include `react-native-screen`, `redux-refactor`, `api-client-update`, `accessibility-review`, `test-generation`, `security-review`, and `migration-review`.

Useful agents include `planner`, `explorer`, `reviewer`, `adversarial-reviewer`, `migration-checker`, `accessibility-checker`, and `security-checker`.

Do not use a skill for one-off workflow-specific instructions. Do not use an inline agent for a role shared across many workflows. Do not use a reusable agent when the role is only needed inside one workflow. Do not use plugins as a dumping ground for unreviewed local hacks. Do not load every skill into every node. Do not rely on skills inside loop nodes unless the installed Archon version explicitly supports that behavior; otherwise use command nodes or restructure.

## 17. Worktree and branch lifecycle

Non-trivial workflows should run in isolated git worktrees.

Rules:

- Never let two workflows edit the same live checkout.
- Default non-trivial work to worktree isolation.
- Use `--no-worktree` only for read-only or trivial workflows.
- Name branches predictably.
- Preserve uncommitted work.
- Surface git conflicts to the user.
- Do not run destructive cleanup commands without explicit policy.
- Clean up completed worktrees.
- Provide a way to abandon failed runs.
- Provide a way to resume failed runs.
- Provide a way to complete and remove merged branches.
- Use `archon workflow status` to inspect running runs.
- Use `archon workflow resume <run-id>` for failed resumable runs.
- Use `archon workflow abandon <run-id>` to cancel a stuck or unwanted run.
- Use `archon complete <branch>` only after the branch is merged or intentionally discarded according to policy.
- Use `archon isolation cleanup` according to stale-worktree policy.
- Use `worktree.copyFiles` for required gitignored files.
- Do not list `.archon/` in `worktree.copyFiles` because it is automatically copied.
- If using Web UI/server mode, remember local workflow edits may need to be committed and pushed before the server sees them.

Branch naming examples:

- `archon/task/<slug>`
- `archon/fix/<issue-number>-<slug>`
- `archon/refactor/<area>-<slug>`
- `archon/review/<pr-number>`
- `archon/workflow/<workflow-name>-<slug>`

Worktree lifecycle checklist:

- [ ] Choose workflow and branch name.
- [ ] Verify current checkout status.
- [ ] Start workflow in worktree.
- [ ] Record run ID, branch, and worktree path.
- [ ] Inspect status on failure or pause.
- [ ] Resume, reject, approve, or abandon according to policy.
- [ ] Create PR only after validation and review.
- [ ] Complete branch only after merge or approved discard.
- [ ] Clean up stale worktrees on cadence.

## 18. Configuration and environment model

`~/.archon/config.yaml` is user-wide. `.archon/config.yaml` is repo-specific. Environment variables override config. `<repo>/.archon/.env` and `~/.archon/.env` are Archon-owned. Root `.env` is application-owned and should not be overwritten by Archon setup.

`defaultAssistant` or repo `assistant` controls default provider. `assistants.claude.model` controls Claude default model. `assistants.claude.settingSources` controls whether project/user Claude settings are loaded. `assistants.codex.model`, `modelReasoningEffort`, `webSearchMode`, and `additionalDirectories` are Codex settings. `worktree.baseBranch` controls base branch if auto-detection is not enough. `worktree.copyFiles` copies required gitignored files into worktrees. `worktree.initSubmodules` controls submodule initialization. `worktree.path` can co-locate worktrees. `docs.path` controls `$DOCS_DIR`. `defaults.loadDefaultCommands` and `defaults.loadDefaultWorkflows` control bundled defaults. `commands.folder` can add another command folder. Global workflows, commands, and scripts can live in `~/.archon/workflows/`, `~/.archon/commands/`, and `~/.archon/scripts/`; repo-local assets override global assets, and global assets override bundled defaults. Secrets should be provided through env vars, secret stores, or platform config, never committed YAML.

This repo's `.archon/config.yaml` is intentionally minimal:

```yaml
worktree:
  baseBranch: dev

docs:
  path: packages/docs-web/src/content/docs
```

Broader assistant settings, command/default loading, MCP credentials, and secrets are intentionally inherited from global/bundled config or omitted until local schema support and repo need are verified. Do not add config fields just because this guide describes them. If `.archon/.env.example` is added later, include variable names and comments only:

```dotenv
# GitHub token for issue/PR MCP or gh operations.
GITHUB_TOKEN=

# Linear token for read-only ticket MCP.
LINEAR_API_KEY=

# Internal docs MCP auth token.
DOCS_MCP_TOKEN=

# Optional provider override for CI or server deployment.
DEFAULT_AI_ASSISTANT=
```

## 19. Deterministic validation

Validation levels:

Level 1: file-level checks.

Level 2: package-level checks.

Level 3: app-level checks.

Level 4: E2E checks.

Level 5: production-safety checks.

For this Bun/TypeScript Archon monorepo, validation examples include bundled default checks, TypeScript type-checking, ESLint, Prettier, workspace tests, ACO traceability, ACO acceptance tests, policy fixtures, docs builds when docs change, and workflow/command validation.

Deterministic validation should be implemented as `bash:` or `script:` nodes, not just prompt instructions. Validation output must be captured in artifacts. Validation failures should feed a self-fix loop or fail the workflow. Do not let the agent claim "tests passed" without captured test output. Use package-level checks first, then broaden. Use `archon validate workflows` and `archon validate commands` for workflow asset validation.

Deterministic bash node example:

```yaml
- id: typecheck
  bash: |
    set -euo pipefail
    mkdir -p "$ARTIFACTS_DIR/validation"
    bun run type-check 2>&1 | tee "$ARTIFACTS_DIR/validation/type-check.log"
  timeout: 600000
```

Deterministic script node example:

```yaml
- id: parse-validation
  script: parse-validation-output
  runtime: bun
  depends_on: [typecheck]
```

## 20. Review model

Review roles:

- standard reviewer
- adversarial reviewer
- security reviewer
- accessibility reviewer
- performance reviewer
- test reviewer
- migration reviewer
- product/UX reviewer where relevant

Use parallel review for medium/high-risk changes.

```markdown
# Review Artifact

## Summary

## Risk rating

## Reviewers run

## Findings

For each finding:
- Severity
- File
- Evidence
- Why it matters
- Suggested fix
- Required or optional

## False positives considered

## Required fixes

## Optional improvements

## Validation gaps

## Approval recommendation
```

A reviewer must cite evidence from files, diffs, logs, artifacts, or validation output. An adversarial reviewer should look for missing requirements, unrelated changes, unsafe assumptions, untested behavior, API breakage, migration risk, and rollback risk. Review findings should feed the self-fix node or final approval gate.

## 21. Eval model

Evals are separate from workflow validation.

Workflow validation asks:

- Does this workflow load?
- Do referenced commands exist?
- Do referenced scripts exist?
- Do referenced MCP config files exist?
- Do referenced skill directories exist?
- Does the DAG have valid dependencies?
- Do gates pause correctly?
- Do loops stop correctly?
- Do checks run correctly?
- Does resume work?
- Does abandon work?
- Does complete/cleanup policy work?
- Does server mode see the committed workflow assets?

Agent evals ask:

- Does the agent solve representative tasks?
- Does quality remain consistent?
- Does it avoid unrelated changes?
- Does it preserve behavior?
- Does it improve with new harness changes?
- Does it use artifacts correctly?
- Does it recover from failed validation?
- Does it avoid false success claims?

Metrics: pass/fail, pass@k, pass^k, files changed, unrelated files changed, validation failures, human review findings, retry count, loop count, approval rejection count, cost, duration, artifact completeness, PR acceptance rate, rollback rate, defect escape rate, and workflow resume success rate.

Eval task template:

```markdown
# Eval Task: <name>

## Fixture

## User request

## Expected workflow

## Expected artifacts

## Required validation

## Rubric

- Correctness:
- Scope control:
- Artifact quality:
- Validation honesty:
- Review outcome:

## Pass criteria

## Failure examples
```

## 22. Observability

Observable fields:

- workflow run ID
- workflow name
- node start and stop
- node status
- node output
- artifacts
- tool calls
- validation results
- approval decisions
- rejection reasons
- retries
- resumes
- abandons
- branch name
- worktree path
- PR link
- workflow events
- logs
- final outcome
- cost where available
- duration
- model/provider used

Traces alone are insufficient. Artifacts and deterministic outputs matter. The dashboard/run history should show enough to debug without reading a full chat. Every final report should link or point to the key artifacts. Every workflow should emit or record a final run summary. Stuck running workflows need an abandon/cancel policy. Completed, failed, and cancelled workflow history needs a cleanup policy.

Core lifecycle commands should be part of the operating model: `archon setup`, `archon doctor`, `archon serve`, `archon skill install`, `archon workflow list`, `archon workflow run`, `archon workflow status`, `archon workflow resume`, `archon workflow abandon`, `archon workflow approve`, `archon workflow reject`, `archon workflow cleanup`, `archon workflow event emit`, `archon isolation list`, `archon isolation cleanup`, `archon validate workflows`, `archon validate commands`, and `archon complete`.

Run history should be database-backed or equivalently durable. It must connect workflow runs, messages, events, artifacts, logs, branches, worktrees, approvals, and outcomes.

## 23. Platform and provider model

Platform adapters connect Archon to CLI, Web UI, GitHub, Slack, Telegram, Discord, or other platforms. Providers connect Archon to AI coding assistants such as Claude or Codex. Isolation providers create safe execution environments such as git worktrees.

Platform choice affects interaction style. Web UI background mode may hide approval prompts unless workflow-level `interactive: true` is set. CLI, Slack, Telegram, and GitHub may stream or batch differently depending on configuration.

Provider choice affects available features. Claude-only fields may be ignored or warned by other providers. Workflow YAML should not assume every provider supports the same tools, hooks, MCP, skills, or structured output. Always validate provider compatibility before rollout.

## 24. Rollout plan

Milestone 1: repo legibility.

Deliver: `CLAUDE.md`, codebase map, ubiquitous language, package-level validation commands, `.claude/settings.json`.

Milestone 2: Archon setup.

Deliver: `.archon/config.yaml`, `.archon/.env.example`, workflow catalog, command catalog, worktree policy, branch lifecycle policy.

Milestone 3: workflow skeletons.

Deliver: assist workflow, idea-to-pr workflow, fix-issue workflow, validate-pr workflow, artifact schema, command template.

Milestone 4: deterministic validation.

Deliver: validation commands, validation workflow, bash nodes, script nodes, loop exits, validation artifact parser.

Milestone 5: review and approvals.

Deliver: approval gates, review commands, adversarial reviewer, PR workflow, rejection/rework flow.

Milestone 6: isolation and lifecycle.

Deliver: worktree config, branch naming policy, resume policy, abandon policy, complete policy, cleanup policy.

Milestone 7: advanced capabilities.

Deliver: node-scoped MCP, node-scoped skills, inline agents, reusable agents, hooks, sandbox, budget caps, dashboard/run history review, eval suite.

Milestone 8: self-improvement.

Deliver: workflow-self-improve workflow, trace/artifact review cadence, recurring cleanup of obsolete model-specific hacks, quarterly harness review.

## 25. Anti-patterns

- Asking the model to remember the process
- Giant CLAUDE.md with procedural workflows
- No artifact handoff
- Hidden chat memory between phases
- Unbounded loops
- No deterministic exit
- Loop nodes with unsupported fields
- No approval before risky work
- One agent doing planning, implementation, and review with no separation
- MCP everywhere
- Broad tool permissions
- Running in the live checkout by default
- Fire-and-forget without observability
- "Tests passed" claims without test output
- PR creation before validation
- Workflow files that are not version controlled
- Human review with no rubric
- Evals without real failure cases
- Keeping obsolete model-specific hacks forever
- Secrets in YAML
- Committing transient artifacts
- Blind `git add .`
- Server/Web UI not seeing workflow changes because they were never pushed
- Fork-specific behavior assumed without checking the installed source
- Ignoring provider capability differences
- Using `--no-worktree` for risky writes
- Leaving stale worktrees forever
- Creating workflows that cannot be resumed from artifacts

## 26. Required concrete examples

Root `CLAUDE.md` skeleton:

```markdown
# Claude Code Instructions

Use `AGENTS.md` as the canonical shared project instruction file and `CODEBASE_MAP.md` as the architecture/navigation map.

## Durable Rules

- Keep persistent context lean.
- Read nearest package instructions before editing.
- Prefer symbol navigation for definitions and references.
- Use scoped validation first.
- Do not store secrets in repo files.

## What Belongs Elsewhere

- Procedures belong in `.archon/commands/` and `.archon/workflows/`.
- Specialist knowledge belongs in `.claude/skills/`.
- Reusable roles belong in `.claude/agents/`.
```

Subdirectory `CLAUDE.md` skeleton:

```markdown
# Package Instructions

## Scope

This file applies to files under this package.

## Local Architecture

- Entry points:
- Shared types:
- Risk areas:

## Validation

- Focused type check:
- Focused tests:
- Lint:

## Local Rules

- Keep exports stable unless approved.
- Add or update package tests for behavior changes.
```

`.claude/settings.json` permissions example:

```json
{
  "permissions": {
    "deny": [
      "Bash(git clean:*)",
      "Bash(git reset --hard:*)",
      "Bash(rm -rf:*)",
      "WebFetch(*)"
    ],
    "allow": [
      "Read(*)",
      "Grep(*)",
      "Glob(*)"
    ]
  }
}
```

`.archon/config.yaml` example: see section 18.

`.archon/.env.example` example: see section 18.

Artifact template: see section 9.

Command template with frontmatter and phases: see section 10.

`idea-to-pr.yaml` illustrative workflow: see section 11.1.

`fix-issue.yaml` illustrative workflow: see section 11.2.

`smart-pr-review.yaml` illustrative workflow: see section 11.3.

`refactor-safely.yaml` illustrative workflow: see section 11.4.

`validate-pr.yaml` illustrative workflow: see section 11.5.

`workflow-self-improve.yaml` illustrative workflow: see section 11.6.

Deterministic script node example: see section 19.

Deterministic bash node example: see section 19.

Cancel node example:

```yaml
- id: cancel-unreviewable
  cancel: "PR cannot be reviewed safely from available diff or context."
  depends_on: [classify-pr]
  when: "$classify-pr.output.reviewable == 'false'"
```

Approval node with `on_reject` example: see section 13.

Loop node with `until_bash` example: see section 12.

Loop node using `$LOOP_PREV_OUTPUT`: see section 11.1 and section 12.

Inline agent example: see section 11.1.

Reusable `.claude/agents` example:

```markdown
---
name: adversarial-reviewer
description: Use for high-risk review where missing requirements or unsafe assumptions matter.
tools: Read, Grep, Glob, Bash
---

You are an adversarial reviewer. Review diffs, artifacts, and validation output.
Find missing requirements, unrelated changes, unsafe assumptions, untested behavior,
API breakage, migration risk, and rollback risk. Cite evidence for every finding.
```

Per-node MCP example: see section 15.

Per-node skill example:

```yaml
- id: accessibility-reviewer
  prompt: "Review UI changes for accessibility and write $ARTIFACTS_DIR/review/accessibility.md."
  skills: [accessibility-review]
```

Hook example:

```yaml
hooks:
  PreToolUse:
    - matcher: "Write|Edit|MultiEdit"
      response:
        hookSpecificOutput:
          hookEventName: PreToolUse
          additionalContext: "Only edit files listed in the approved plan artifact."
```

Worktree lifecycle checklist: see section 17.

PR review artifact template: see section 20.

Eval task template: see section 21.

## 27. Accuracy constraints

Archon workflows use `nodes:`, not `steps:`. Every node must specify exactly one node type. Do not put unsupported loop fields on loop nodes. Do not imply loop nodes support `retry`. Do not imply loop nodes support `mcp`, `skills`, `hooks`, `allowed_tools`, `denied_tools`, or `output_format`. Do not imply `context: fresh` controls loop iteration context; use `loop.fresh_context`. Do not imply approval nodes invoke a normal AI node except through `on_reject`. Do not imply `$ARTIFACTS_DIR` is inside the repo. Do not tell users to commit `$ARTIFACTS_DIR`. Do not tell users to store secrets in YAML. Do not tell users to run destructive cleanup commands without policy. Do not tell users to use Web UI approval nodes without workflow-level `interactive: true`. Do not assume Sqcoot's fork is identical to upstream; verify the installed version.

Source checks for this guide used installed Archon source and docs, plus the public Archon pages for authoring workflows and loop nodes:

- https://archon.diy/guides/authoring-workflows/
- https://archon.diy/guides/loop-nodes/

Context7 lookup was attempted for current docs but returned: `Monthly quota exceeded. Create a free API key at https://context7.com/dashboard for more requests.` Use `npx ctx7@latest login` or `CONTEXT7_API_KEY` for higher limits.

## 28. Final operating principle

A mature agentic coding setup has three layers:

1. Context layer: CLAUDE.md, repo maps, docs, skills, plugins, agents, and MCP definitions.
2. Process layer: workflows, commands, artifacts, gates, loops, scripts, worktrees, and branch lifecycle.
3. Assurance layer: validation, review, evals, traces, logs, workflow events, metrics, and human approvals.

The context layer helps the agent understand.
The process layer makes the work repeatable.
The assurance layer proves the outcome is acceptable.

Do not stop at better prompts. Encode the workflow.
