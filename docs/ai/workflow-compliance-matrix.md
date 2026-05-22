# Workflow Compliance Matrix

This matrix maps the operating guide to current repository assets. It is intentionally asset-first: existing workflows, commands, scripts, skills, agents, and ledgers are reused before adding new files.

## Summary

| Area | Status | Evidence | Gap |
| --- | --- | --- | --- |
| Workflow coverage | Partial | `.archon/workflows/defaults/*` covers assist, issue fixing, PR flow, review, validation, refactor, architecture, AI-layer bootstrap, ACO orchestration, and workflow builder. | Some guide-only examples use short illustrative names and are not installed workflows. |
| Command coverage | Covered for bundled Archon commands, partial for guide placeholders | `.archon/commands/defaults/*` contains `archon-*` and `ai-layer-*` commands. | No installed short commands named `classify`, `plan`, `review`, `summarize-run`, or `parse-validation-output`. |
| Script coverage | Partial | `scripts/*`, `.archon/scripts/*`, and `package.json` validation scripts exist. | Guide examples reference deterministic scripts that do not all exist. |
| Claude/Codex asset coverage | Covered | `.claude/settings.json`, `.claude/skills`, `.claude/agents`, `.agents/skills`, `.codex/agents`, `.codex/hooks.json`. | Trust-sensitive config should be proposed first, not edited blindly. |
| Artifact coverage | Partial | ACO and workflow prompts use `$ARTIFACTS_DIR`; `.archon/artifacts/` is gitignored; context-orchestrator artifacts already include ledgers and route reports. | No single repo-wide artifact schema file enforces all guide artifacts. |
| Loop and approval coverage | Partial | `context-orchestrate`, `archon-aco-adversarial-loop`, `archon-piv-loop`, `archon-ralph-dag`, `archon-adversarial-dev`, `archon-interactive-prd`, and `archon-validate-pr` exercise gates, loops, and all-done joins. | Most production workflows rely on commands and prompts rather than a uniform loop/gate rubric. |
| Worktree and lifecycle coverage | Partial | CLI supports `--branch`, `--from`, `--no-worktree`, `--resume`, `workflow status`, `workflow abandon`, `complete`, and `isolation cleanup`; config sets `worktree.baseBranch: dev`. | Policy is now documented in `worktree-and-branch-lifecycle.md`; no new enforcement added. |
| BMAD coverage | Partial | `_bmad` install/config manifests and `.agents/skills/bmad-*` are present; ACO route/ledger commands surface BMAD route decisions. | BMAD phases are not yet first-class Archon workflow nodes for every phase. |
| MCP coverage | Illustrative only | Provider MCP loading exists in `packages/providers/src/mcp/`; optional workflow references guard `.archon/mcp/ntfy.json`. | No repo-local `.archon/mcp/*.json` files exist. |
| Config intent | Covered | `.archon/config.yaml` remains minimal with comments. | Broader config keys are intentionally inherited or omitted until locally verified and needed. |

## Workflow coverage

| Guide requirement | Existing file | Status | Evidence | Gap | Next action |
| --- | --- | --- | --- | --- | --- |
| Assist workflow | `.archon/workflows/defaults/archon-assist.yaml` | Covered | Single command node `archon-assist`; `worktree.enabled: false` for live checkout assist. | None for fallback assist. | Keep live-checkout rationale documented. |
| Idea-to-PR workflow | `.archon/workflows/defaults/archon-idea-to-pr.yaml` | Covered | Plan, setup, confirm, implement, validate, finalize PR, multi-agent review, synthesis, fixes, summary. | No explicit approval node in current default. | Use worktree isolation at invocation and review artifacts before PR readiness. |
| Fix issue workflow | `.archon/workflows/defaults/archon-fix-github-issue.yaml` | Covered | Extract/fetch/classify GitHub issue, route bug vs non-bug, implement, validate, create draft PR, review, self-fix. | Depends on `gh` and GitHub context. | Use for GitHub issue work only. |
| Plan-to-PR workflow | `.archon/workflows/defaults/archon-plan-to-pr.yaml` | Covered | Existing plan to implementation, validation, PR, review, fixes, summary. | No separate BMAD story gate. | Pair with BMAD story artifacts when plan originates from BMAD. |
| Refactor safely workflow | `.archon/workflows/defaults/archon-refactor-safely.yaml` | Covered | Scope scan, read-only impact analysis, plan, guarded execution, validation, behavior verification. | Long workflow, best run isolated. | Use for structural code changes. |
| Smart PR review workflow | `.archon/workflows/defaults/archon-smart-pr-review.yaml` | Covered | Scope, sync, classifier prompt, conditional review agents, synthesize, implement fixes, optional notification MCP. | Optional `.archon/mcp/ntfy.json` absent. | Treat notification node as guarded optional. |
| Validate PR workflow | `.archon/workflows/defaults/archon-validate-pr.yaml` | Covered | Fetch PR, allocate ports, code review main/feature, E2E conditionals, cleanup with `trigger_rule: all_done`, final report. | Browser/E2E path may require local services and ports. | Run only when PR validation context is available. |
| Resolve conflicts workflow | `.archon/workflows/defaults/archon-resolve-conflicts.yaml` | Covered | Delegates to `archon-resolve-merge-conflicts`. | Single command node; policy lives in command prompt. | Review conflicts and commits before push. |
| Architectural sweep workflow | `.archon/workflows/defaults/archon-architect.yaml` | Covered | Measures complexity, analyzes architecture, plans simplification, hooks validation, creates PR. | Broad code edits; high review need. | Use only on non-main branch/worktree. |
| Workflow self-improve workflow | `.archon/workflows/defaults/archon-workflow-builder.yaml`, `.archon/workflows/defaults/archon-ai-layer-bootstrap.yaml` | Partial | Builder can create workflows; AI-layer bootstrap refreshes harness artifacts. | No dedicated workflow that reads prior run failures and patches workflows after approval. | Add only if recurring failure evidence justifies it. |
| ACO context orchestration | `.archon/workflows/defaults/context-orchestrate.yaml` | Covered | Reads status and ledgers, compiles package, gates graph approval, writes handoff. | Active graph waivers require explicit preservation. | Preserve waivers unless user approves graph refresh. |
| ACO adversarial loop | `.archon/workflows/defaults/archon-aco-adversarial-loop.yaml` | Covered | ACO status/ledgers/compile, readiness gate, approval capsule, planner, contract, generator, evaluator, feedback, handoff. | Generator path waits on approval when graph readiness requires it. | Use for high-risk contracted implementation loops. |
| AI-layer bootstrap | `.archon/workflows/defaults/archon-ai-layer-bootstrap.yaml` | Covered | Branch gate, goal, preflight, SDD/ATDD audit, AI-layer audit, design, implement/propose, validation, review, gates. | Running full workflow would spawn AI agents; not needed for this docs-only patch. | Use as model for future AI-layer refresh work. |

## Command coverage

| Guide command responsibility | Existing file | Status | Evidence | Gap | Next action |
| --- | --- | --- | --- | --- | --- |
| Classify | Prompt nodes in `archon-fix-github-issue.yaml`, `archon-smart-pr-review.yaml`, `archon-validate-pr.yaml` | Partial | Classifiers use `output_format` and `allowed_tools: []`. | No reusable `.archon/commands/defaults/classify.md`. | Keep guide short-name examples illustrative. |
| Investigate | `.archon/commands/defaults/archon-investigate-issue.md`, `.archon/commands/defaults/ai-layer-audit.md`, `.agents/skills/bmad-investigate/SKILL.md` | Covered | Issue and AI-layer investigation assets exist. | BMAD investigate is a skill, not an Archon command. | Pick by route: issue, AI-layer, or BMAD case file. |
| Plan | `.archon/commands/defaults/archon-create-plan.md`, `.archon/commands/defaults/archon-plan-setup.md`, `.archon/commands/defaults/ai-layer-design.md` | Covered | Plan commands feed PR and AI-layer workflows. | No short `plan.md` command. | Use `archon-create-plan` in real workflows. |
| Implement | `.archon/commands/defaults/archon-implement.md`, `archon-implement-tasks.md`, `archon-fix-issue.md`, `ai-layer-implement.md` | Covered | Separate general, task, issue, and AI-layer implementation commands. | None. | Keep implementation commands scoped. |
| Validate | `.archon/commands/defaults/archon-validate.md`, `ai-layer-validate.md`, package scripts in `package.json` | Covered | Validation command and deterministic scripts exist. | Full validation can be expensive. | Use scoped tests first. |
| Review | `.archon/commands/defaults/archon-code-review-agent.md`, `archon-synthesize-review.md`, `ai-layer-review.md`, `.claude/agents/code-reviewer.md` | Covered | Bundled review agents and Claude subagents exist. | No short `review.md`. | Map guide examples to `archon-*` commands. |
| Adversarial review | `.archon/workflows/defaults/archon-adversarial-dev.yaml`, `.archon/workflows/defaults/archon-aco-adversarial-loop.yaml`, `.agents/skills/bmad-review-adversarial-general/SKILL.md` | Partial | Workflow and BMAD skill exist. | No reusable `.archon/commands/defaults/adversarial-review.md`. | Use BMAD AR skill or ACO adversarial loop. |
| Create PR | `.archon/commands/defaults/archon-create-pr.md`, `.archon/commands/defaults/archon-finalize-pr.md` | Covered | PR creation/finalization commands exist. | Requires GitHub auth and branch context. | Validate branch/PR base before use. |
| Workflow summary | `.archon/commands/defaults/archon-workflow-summary.md` | Covered | Default workflows end with summary command. | No short `summarize-run.md`. | Use `archon-workflow-summary`. |
| Fix issue | `.archon/commands/defaults/archon-fix-issue.md`, workflow `archon-fix-github-issue.yaml` | Covered | Issue implementation and workflow route exist. | GitHub-only workflow needs issue number. | Use manual plan-to-pr for non-GitHub issues. |
| Assist | `.archon/commands/defaults/archon-assist.md`, workflow `archon-assist.yaml` | Covered | General fallback. | Live checkout by design. | Check `git status` before edits. |

## Script coverage

| Deterministic need | Existing asset | Status | Evidence | Gap | Next action |
| --- | --- | --- | --- | --- | --- |
| Parse validation output | `.archon/workflows/defaults/archon-validate-pr.yaml`, `scripts/context-orchestrator/validate-traceability.ts` | Partial | PR validation has report command; traceability parser exists. | No `.archon/scripts/parse-validation-output.ts`. | Add only when workflow requires machine parsing beyond existing commands. |
| Artifact completeness | `archon-ai-layer-bootstrap.yaml` gate commands, `context-orchestrate.yaml`, `packages/context-orchestrator/src/artifact-package.ts` | Partial | ACO compiler writes manifests and artifacts. | No generic artifact completeness script. | Prefer context-orchestrator package for ACO artifacts. |
| Risk classification | Prompt classifiers in workflows; `.agents/skills/bmad-check-implementation-readiness` | Partial | Classifier prompts and BMAD readiness skill exist. | No deterministic risk script for all workflows. | Keep as AI classification unless a repeatable schema emerges. |
| Diff summarization | `.archon/commands/defaults/archon-pr-review-scope.md`, `archon-workflow-summary.md` | Covered | Review scope and summary commands summarize diffs. | None. | Use existing commands. |
| Traceability checks | `scripts/context-orchestrator/validate-traceability.ts`, `bun run aco:traceability` | Covered | Package script exists and validation report records it. | None. | Run before PR. |
| Bundled workflow checks | `scripts/generate-bundled-defaults.ts`, `bun run check:bundled` | Covered | Check mode detects generated default drift. | None. | Run after workflow/command edits. |
| Acceptance tests | `tests/acceptance/context-orchestrator/*.test.ts`, `bun run aco:test:acceptance` | Covered for ACO | Acceptance suite exists for Context Orchestrator. | No acceptance suite for this docs-only layer. | Use docs validation and full repo validation. |

## Claude and Codex asset coverage

| Asset | Existing file | Status | Evidence | Gap | Next action |
| --- | --- | --- | --- | --- | --- |
| Claude settings | `.claude/settings.json` | Covered | Hooks and environment flags exist. | Trust-sensitive; do not edit blindly. | Prefer proposed changes. |
| Claude skills | `.claude/skills/*`, `.agents/skills/*` | Covered | Archon, BMAD, scoped-tests, browser, release, and validation skills exist. | Duplicate skill roots can diverge. | Keep manifests and docs aligned. |
| Claude agents | `.claude/agents/*.md` | Covered | Review, docs, triage, type-design, web research agents exist. | No BMAD-specific Claude agent wrappers beyond skills. | Use BMAD skills directly unless wrappers are needed. |
| Codex hooks and agents | `.codex/hooks.json`, `.codex/agents/*.toml` | Covered | Project hooks and agent profiles exist. | Trust-sensitive config. | Avoid live config edits without explicit need. |
| Root instructions | `AGENTS.md`, `CLAUDE.md`, `CODEBASE_MAP.md` | Covered | Entry points now point to `docs/ai`. | Keep lean. | Update docs matrix when assets change. |

## Artifact coverage

| Artifact class | Enforcement | Status | Evidence | Gap | Next action |
| --- | --- | --- | --- | --- | --- |
| ACO ledgers and prompt packages | Package schemas and CLI commands | Covered | `packages/context-orchestrator/src/ledgers.ts`, `compiler.ts`, `artifact-package.ts`; `context-orchestrate.yaml`. | Active graph waiver approval remains required. | Preserve waivers unless approved. |
| Workflow run artifacts | Workflow prompts and `$ARTIFACTS_DIR` | Partial | Defaults write validation, plan, review, handoff, and summary artifacts. | No repo-wide artifact-schema doc yet. | Add only if enforcement scripts will consume it. |
| BMAD planning/implementation artifacts | `_bmad/config.toml` output folders | Partial | `_bmad-output/planning-artifacts` and `_bmad-output/implementation-artifacts` configured and gitignored. | Not automatically passed into Archon workflows. | Pass explicit paths in workflow inputs or ACO compile context. |
| Validation report | `docs/ai/stab-002-validation-report.md` | Covered | Created as reviewable docs evidence. | Must be updated when validation changes. | Do not claim validation passed without updating it. |

## Loop and approval coverage

| Capability | Existing file | Status | Evidence | Gap | Next action |
| --- | --- | --- | --- | --- | --- |
| Loop nodes | `archon-piv-loop.yaml`, `archon-ralph-dag.yaml`, `archon-adversarial-dev.yaml`, `archon-test-loop-dag.yaml` | Covered | Loop nodes use `loop.until`, `max_iterations`, `fresh_context`, or `interactive`. | Not every workflow uses loops. | Use loops only when state can live in artifacts. |
| Max iterations | Same loop workflows | Covered | Installed schema requires `loop.max_iterations`. | None. | Keep bounded loops. |
| Deterministic loop exit | Loop examples and `until_bash` support in schema | Partial | Schema supports `until_bash`; guide examples show it. | Existing production workflows vary. | Prefer deterministic exits where feasible. |
| Approval nodes | `context-orchestrate.yaml`, `archon-aco-adversarial-loop.yaml`, `archon-interactive-prd.yaml` | Covered | Approval gates with `capture_response` and graph/PRD review. | Many PR workflows use command review instead of approval node. | Add approvals only at high-risk boundaries. |
| Rejection handling | Schema supports `approval.on_reject` | Partial | Guide examples document `on_reject`; installed schema supports it. | Few defaults use rejection rework. | Add only where human iteration is needed. |
| Final approval gates | ACO and interactive PRD workflows | Partial | Present in approval-heavy workflows. | End-to-end PR workflows do not require final human approval node. | Rely on PR review unless stricter policy needed. |

## Worktree and lifecycle coverage

| Lifecycle item | Existing asset | Status | Evidence | Gap | Next action |
| --- | --- | --- | --- | --- | --- |
| Worktree creation | CLI `workflow run --branch`, default isolation, `.archon/config.yaml` | Covered | Help output lists `--branch`, `--from`, `--no-worktree`; config base branch is `dev`. | Some workflows pin `worktree.enabled: false`. | Use `--branch` for non-trivial edits. |
| Branch naming | Docs policy | Partial | This document and lifecycle doc define branch patterns. | Not enforced by CLI policy here. | Validate branch names before shell use. |
| Resume | CLI `--resume`, docs | Covered | Help output lists resume. | Needs failed run state. | Use run ID/status before resume. |
| Abandon | CLI `workflow abandon` in docs/help references | Covered | Guide and local skill references include abandon. | Not validated in this patch. | Use for stuck/unwanted runs. |
| Complete | CLI `complete <branch>` | Covered | Help output lists complete. | Destructive lifecycle effect. | Use only after merge or approved discard. |
| Cleanup | CLI `isolation cleanup` | Covered | Help output lists cleanup. | Can remove worktrees. | Require explicit approval for destructive cleanup. |
| Conflict handling | `archon-resolve-conflicts.yaml`, `archon-resolve-merge-conflicts.md` | Covered | Dedicated workflow and command exist. | Requires human review of conflict resolution. | Use isolated branch. |

## BMAD coverage

BMAD coverage is partial. `_bmad` contains installer metadata, module config, catalogs, and output folder policy. Actual executable Codex skills are installed under `.agents/skills/bmad-*`; Claude-visible mirrors exist under `.claude/skills` for non-BMAD Archon skills. ACO CLI route/ledger commands can recommend BMAD routes and record route confidence. No direct one-to-one Archon workflow exists for every BMAD phase.

## Final gap list

### Must fix before stabilization

1. Keep `docs/ai/stab-002-validation-report.md` current with real command output.
2. Preserve active Context Orchestrator graph waivers unless explicit approval allows refresh.
3. Do not treat illustrative guide commands or MCP configs as installed assets.

### Should fix soon

1. Add an artifact schema only if workflows/scripts will enforce it.
2. Add a workflow self-improvement workflow only after repeated workflow failure evidence exists.
3. Decide whether BMAD phase outputs should be explicit inputs to `archon-plan-to-pr` or ACO compile.

### Nice to have

1. Add a deterministic artifact completeness script for `$ARTIFACTS_DIR`.
2. Add optional MCP config templates under proposed docs, not live config.
3. Add branch-name validation helper for workflow shell nodes.

### Explicitly out of scope

1. No new `.archon/workflows`, `.archon/commands`, `.archon/scripts`, `.claude/agents`, `.claude/skills`, or `.archon/mcp` assets are added in this patch.
2. No graph refresh or waiver cleanup.
3. No runtime artifacts under `.archon/artifacts/` are committed.
