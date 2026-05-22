# STAB-002 Party-Mode Consensus

Timestamp: 2026-05-22T18:47:13Z
Baseline: `origin/dev...HEAD`

## Evidence Inputs

- Changed files inventoried: 367
- Reference checks: completed for non-`KEEP` candidates before move/remove/split
- Workflow validation: `bun run cli validate workflows --cwd .` passed with 1 guarded optional MCP warning
- Command validation: `bun run cli validate commands --cwd .` passed
- MCP: no live repo-local `.archon/mcp/*.json`; optional `.archon/mcp/ntfy.json` is guarded
- Runtime artifacts: `git ls-files .archon/artifacts | wc -l` returned `0`
- Cleanup blockers: default command/workflow movement has live references in tests/docs/generated defaults/traceability; STAB reports under `docs/ai` have live references in governance docs

## Consensus Rules Applied

- Keep validated product code.
- Keep traceability-required specs.
- Keep BMAD sync assets that are required and non-local.
- Keep product-facing workflows only if validated.
- Move branch-specific commands/workflows out of defaults only if references and generated defaults can be updated safely.
- Move or relabel branch-specific evidence instead of deleting it.
- Remove local leakage.
- Remove clearly accidental transient files.
- Require human decision for contributor hooks, CI gate changes, waivers, graph refresh, trust-sensitive config, and branch-specific defaults.

## Role 1: Archon Maintainer

- Workflows staying in defaults: `context-orchestrate`, `archon-aco-adversarial-loop` if product default intent is accepted, existing core `archon-*` workflows.
- Workflows moving to examples/stabilization: `archon-ai-layer-bootstrap` only after coordinated docs/tests/generated-default updates or explicit decision.
- Commands staying in defaults: core `archon-*` commands and `solidify-poc` if accepted as product read-only review command.
- Commands moving: `goal.md` and `ai-layer-*` are branch/bootstrap candidates, but not move-safe without updates.
- BMAD required: `_bmad` sync config/manifests and `.agents/skills/bmad-*`.
- BMAD deferred: native BMAD Archon workflows.
- Hooks safe: Codex task-list hook is hardened, but still trust-sensitive as a project default.
- Hooks requiring decision: `.codex/hooks.json`, `.claude/settings.json` private `kild` hooks, changed Claude/Codex agent defaults.
- MCP safe: guarded optional ntfy warning only; no live configs.
- Evergreen docs: `docs/ai/README.md`, operating guide, security, DRI, compliance matrix, BMAD mapping.
- Branch evidence: older STAB reports and runtime goal/report files.
- Validation required: workflow/command validation, bundled checks after default moves, ACO traceability, repo validation.
- Highest merge risk: accidentally shipping branch-specific defaults as product behavior.
- Track-loss prevention: goal state, checkpoint log, inventory, matrix, decision ledger, and validation report.

## Role 2: Context Orchestrator Product Owner

- Workflows staying in defaults: `context-orchestrate`; it is referenced by slash command handling, specs, traceability, tests, docs, and generated defaults.
- Workflows moving: none from ACO core without replacement.
- Commands staying: ACO CLI/context commands and traceability commands.
- Commands moving: `/goal stabilize-aco-merge-ready` default command if later decoupled from tests/routes.
- BMAD required: mapped advisory inputs used by ACO routing/status.
- BMAD deferred: BMAD-native workflow generation.
- Hooks safe: none required for core ACO runtime.
- Hooks requiring decision: project-level Codex/Claude hooks.
- MCP safe: no live MCP dependency; optional warning is non-blocking.
- Evergreen docs: ACO specs, ADRs, traceability manifest, BMAD mapping.
- Branch evidence: scorecards and hygiene reports from prior stabilization slices.
- Validation required: `bun run aco:traceability`, ACO acceptance tests, workflow validation.
- Highest merge risk: weakening traceability or graph-waiver visibility.
- Track-loss prevention: traceability manifest and state artifacts.

## Role 3: BMAD Method Architect

- Workflows staying in defaults: `context-orchestrate` as Archon-side route/status/compile carrier; `archon-aco-adversarial-loop` if accepted as Archon quality loop.
- Workflows moving: no BMAD-native workflow should be added in cleanup.
- Commands staying: only Archon commands with product purpose.
- Commands moving: branch-specific BMAD/AI-layer bootstrap commands if decoupled later.
- BMAD required: `_bmad/config.toml`, `_bmad/_config/*`, `_bmad/bmm/*`, `_bmad/core/*`, `_bmad/scripts/*`, `.agents/skills/bmad-*`, `docs/ai/bmad-to-archon-mapping.md`.
- BMAD deferred: first-class native workflows and mirroring `.agents/skills/bmad-*` into `.claude/skills`.
- Hooks safe: none needed for BMAD mapping.
- Hooks requiring decision: `.claude/settings.json` and `.codex/hooks.json`.
- MCP safe: illustrative/user-global only.
- Evergreen docs: BMAD mapping and runtime-enforcement decision.
- Branch evidence: generated research and scorecards.
- Validation required: ACO traceability plus BMAD acceptance tests where available.
- Highest merge risk: confusing mapped/advisory BMAD with implemented workflow parity.
- Track-loss prevention: BMAD mapping table and human decision queue.

## Role 4: Minimal Merge Reviewer

- Workflows staying in defaults: only workflows with product tests and validation evidence.
- Workflows moving: anything branch-only if references can be updated.
- Commands staying: minimal product command set.
- Commands moving: `goal.md`, `ai-layer-*`, possibly `solidify-poc` unless product intent is explicit.
- BMAD required: keep non-local sync assets.
- BMAD deferred: new workflows.
- Hooks safe: none without explicit approval.
- Hooks requiring decision: all contributor-facing live hooks.
- MCP safe: no live configs.
- Evergreen docs: root instructions and durable governance docs.
- Branch evidence: all STAB scorecards/reports.
- Validation required: command/workflow validation, bundled checks, `git diff --check`, repo validation if cleanup touches shared surfaces.
- Highest merge risk: branch surface too broad for a single PR.
- Track-loss prevention: PR split recommendation.

## Role 5: Security Reviewer

- Workflows staying in defaults: those that validate and do not require private local state.
- Workflows moving: workflows requiring unreviewed hooks/MCP/private tools.
- Commands staying: commands without secrets/local path assumptions.
- Commands moving: branch-gated default command if retained as live product command.
- BMAD required: tracked configs only; ignored user configs must remain ignored.
- BMAD deferred: user-local/generated files.
- Hooks safe: Codex task-list hook passes input sanitization/containment checks but still needs default-policy approval.
- Hooks requiring decision: `.claude/settings.json` `kild` commands and Slack notify hook.
- MCP safe: no live config; docs require env vars and approval for write-capable access.
- Evergreen docs: `docs/ai/security-and-secrets.md`.
- Branch evidence: any report containing `/Users/...` path.
- Validation required: local leakage scan, `git diff --check`, policy validation if CI policy stays.
- Highest merge risk: contributor-surprising live hooks or local machine leakage.
- Track-loss prevention: human decision queue for hooks/MCP/CI.

## Role 6: Docs Maintainer

- Workflows staying in defaults: document exact product-facing workflows.
- Workflows moving: branch/bootstrap workflows only after docs updates.
- Commands staying: documented command references only when product accepted.
- Commands moving: branch-specific `/goal` and `ai-layer-*` unless product docs clearly explain them.
- BMAD required: mapping docs and sync review docs.
- BMAD deferred: duplicate Claude skill mirror docs until decided.
- Hooks safe: document if shipped; otherwise examples only.
- Hooks requiring decision: Codex/Claude live hooks.
- MCP safe: illustrative examples with no live config.
- Evergreen docs: operating guide, compliance matrix, security, DRI, source traceability, workflow validation.
- Branch evidence: STAB reports should live under stabilization or be labeled historical.
- Validation required: link/reference checks after moves, docs grep for old paths.
- Highest merge risk: stale counts, stale baseline claims, old paths.
- Track-loss prevention: matrix rows and post-cleanup reconciliation.

## Role 7: Test/CI Owner

- Workflows staying in defaults: anything required by acceptance tests and command handler tests.
- Workflows moving: only after test updates and generated defaults regeneration.
- Commands staying: commands used by kept workflows/tests.
- Commands moving: none until references are updated.
- BMAD required: assets covered by acceptance and mapping tests.
- BMAD deferred: native workflow tests.
- Hooks safe: Codex hook has acceptance coverage.
- Hooks requiring decision: live hook policy remains outside test sufficiency.
- MCP safe: guarded optional ntfy warning accepted only with documented warning.
- Evergreen docs: validation reports with exact command output.
- Branch evidence: prior validation reports must not be presented as final evidence.
- Validation required: `bun run generate:bundled`, `bun run check:bundled`, `bun run check:bundled-skill`, workflow/command validation, `bun run aco:traceability`, `bun run validate`.
- Highest merge risk: changing defaults without regenerating bundles.
- Track-loss prevention: validation report command table.

## Role 8: Contributor-Experience Reviewer

- Workflows staying in defaults: predictable product workflows with clear trigger descriptions.
- Workflows moving: branch/bootstrap workflows that surprise ordinary contributors.
- Commands staying: product commands with clear invocation and low surprise.
- Commands moving: branch-specific `/goal` command unless accepted as product command.
- BMAD required: advisory skills remain available for agents.
- BMAD deferred: duplicative skill mirrors.
- Hooks safe: only hooks that are transparent, documented, non-mutating, and non-private.
- Hooks requiring decision: `.codex/hooks.json` and `.claude/settings.json`.
- MCP safe: none by default.
- Evergreen docs: contributor-facing README and docs-web guide updates.
- Branch evidence: stabilization reports should not dominate normal contributor docs.
- Validation required: command/workflow list and docs references.
- Highest merge risk: a contributor starts a session and gets unexpected hook behavior.
- Track-loss prevention: explicit hook decision queue.

## Role 9: Release Manager

- Workflows staying in defaults: only validation-passing, bundled-regenerated workflows.
- Workflows moving: default changes not required for release slice.
- Commands staying: only if bundle checks pass.
- Commands moving: branch defaults after separate PR or explicit approval.
- BMAD required: sync assets if non-local and documented.
- BMAD deferred: first-class workflows.
- Hooks safe: only after policy decision.
- Hooks requiring decision: Codex/Claude project defaults.
- MCP safe: no live configs.
- Evergreen docs: release readiness and validation reports.
- Branch evidence: historical reports must be labeled.
- Validation required: full ladder in Phase 14.
- Highest merge risk: merging one large branch without PR split.
- Track-loss prevention: PR split recommendation and final acceptance audit.

## Role 10: Hook/MCP Safety Reviewer

- Workflows staying in defaults: those not requiring unguarded MCP or hooks.
- Workflows moving: workflows whose safe execution depends on private config.
- Commands staying: commands that propose risky config instead of mutating it.
- Commands moving: live trust-sensitive config commands if default status unclear.
- BMAD required: no hook dependency.
- BMAD deferred: MCP-backed BMAD workflows.
- Hooks safe: Codex task hook behavior is sanitized and non-private; still needs default-ship decision.
- Hooks requiring decision: Claude `kild` and Slack hooks; Codex hook default.
- MCP safe: `.archon/mcp/ntfy.json` optional/guarded only; no live templates now.
- Evergreen docs: security/MCP policy docs.
- Branch evidence: MCP setup notes are stabilization guidance.
- Validation required: workflow validation warning remains documented.
- Highest merge risk: implicit local/private hook dependencies.
- Track-loss prevention: no live MCP config additions in cleanup.

## Role 11: Artifact/Traceability Reviewer

- Workflows staying in defaults: ACO workflows referenced by traceability.
- Workflows moving: none with traceability refs until manifest/spec updates.
- Commands staying: commands referenced by traceability or kept workflows.
- Commands moving: not before manifest and acceptance updates.
- BMAD required: sync and mapping assets required by traceability.
- BMAD deferred: graph refresh and waiver cleanup.
- Hooks safe: hook evidence must stay visible if shipped.
- Hooks requiring decision: trust-sensitive configs.
- MCP safe: optional warning documented as baseline.
- Evergreen docs: specs, ADRs, traceability matrix, traceability JSON.
- Branch evidence: scorecards and reports under stabilization.
- Validation required: `bun run aco:traceability`.
- Highest merge risk: untracked cleanup breaks traceability refs.
- Track-loss prevention: no file moved unless in matrix with reference status and rollback plan.

## Role 12: Goal-Continuation Reviewer

- Workflows staying in defaults: unresolved until final matrix and validation prove status.
- Workflows moving: only after a checkpointed batch with reference checks and validation.
- Commands staying: unresolved branch defaults go to human queue if not proven.
- Commands moving: only after Phase 10/11/12 artifacts and validation.
- BMAD required: keep evidence-based assets.
- BMAD deferred: native workflows and mirrors.
- Hooks safe: none declared shipped without decision.
- Hooks requiring decision: Codex/Claude project defaults.
- MCP safe: no live configs.
- Evergreen docs: goal state, checkpoint log, validation report.
- Branch evidence: keep under stabilization/history or label historical.
- Validation required: every cleanup batch and final ladder.
- Highest merge risk: claiming success because artifacts exist rather than because gates passed.
- Track-loss prevention: re-read state every continuation and only complete after final adversarial audit.

## Consensus Verdict

Current consensus: `Sufficient for merge hygiene with documented human policy signoff items`.

Safe cleanup completed:

- Edited the older stabilization reports in place to replace local absolute supplemental report paths with historical wording.
- Relabelled non-`origin/dev` comparison data in older scorecards/hygiene reports as historical and not final merge evidence.
- Kept the deleted `tsconfig.tsbuildinfo` files deleted.

Not safe without human decision or coordinated update:

- Move/remove `archon-ai-layer-bootstrap`.
- Move/remove `ai-layer-*` commands.
- Move/remove `.archon/commands/defaults/goal.md`.
- Move/remove `.archon/commands/defaults/solidify-poc.md`.
- Move `docs/ai/stab-002-validation-report.md`, `docs/ai/stab-002-runtime-validation-report.md`, or `docs/ai/goals/stab-002-runtime-enforcement.goal.md`.
- Remove or materially change Codex/Claude project hooks/config.
- Refresh graph evidence or remove waivers.
- Change required CI/OPA gates to optional.

## Final Adversarial Audit

Timestamp: 2026-05-22T19:04:15Z

Status: passed.

### What evidence would prove this cleanup is incomplete?

Evidence of incompleteness would include an `origin/dev...HEAD` path missing from the inventory or matrix, a moved/removed file still referenced by docs/tests/generated defaults, failed validation without a recorded follow-up, an unlabelled old baseline report, accidental local leakage in branch evidence, or a trust-sensitive default changed without approval. The current artifacts do not show those conditions.

### Are any files un-inventoried?

No for the committed branch diff. Phase 13 reconciliation found 367 paths in `git diff --name-only origin/dev...HEAD`, with 0 missing from the inventory and 0 missing from the keep/move/remove/split matrix.

New goal artifacts are untracked workspace files created by this task and are listed in the validation report as files added. They are not part of `origin/dev...HEAD` until intentionally added later.

### Are any moved/removed files still referenced?

No moved files exist in the cleanup batch. No files were removed by this cleanup batch. The branch already removes two `tsconfig.tsbuildinfo` files; the transient-file scan returned 0 tracked transient hits.

### Are any validation commands skipped without explanation?

No. The optional no-edit `archon-assist --no-worktree` smoke test was skipped by a documented safety condition because the workspace contains uncommitted goal/report artifacts and provider workflow execution was not needed after schema/discovery validation. No BMAD-specific package script was run because package script discovery found none.

### Are any branch-specific defaults still present without rationale?

No. `archon-ai-layer-bootstrap`, `ai-layer-*`, `/goal`, `solidify-poc`, and `archon-aco-adversarial-loop` remain present with reference evidence and human-decision entries. They were not moved because Phase 8 found live tests, docs, generated-default, package-code, or traceability references, and validation passed with them present.

### Are any local paths still present?

No accidental local path from the old supplemental report remains. The targeted fixed-string check for the old machine-local supplemental report path returned no hits after cleanup. The broad leakage scan still finds expected `/tmp`, localhost, and fixture absolute paths in tests/docs, including pre-existing examples, but these are documented as non-accidental fixture or developer-doc examples.

### Are any wrong-baseline reports still presented as final evidence?

No. `aco-stabilization-scorecard.md`, `aco-stabilization-scorecard.json`, and `aco-pr-hygiene-report.md` now label the earlier PR review baseline as historical and state that final merge-hygiene analysis uses `origin/dev...HEAD` in `stab-002-dev-diff-inventory.md`.

### Are any destructive or approval-sensitive actions performed?

No destructive actions were performed. No graph refresh, waiver cleanup, staging, commit, push, PR creation, default workflow removal, command removal, product-code deletion, or test deletion was performed. Approval-sensitive topics are in the human decision queue.

### Is the human decision queue complete?

Yes for this cleanup scope. The queue contains 17 records covering Codex hooks, Claude hooks/settings, CI/OPA scope, BMAD status and mirroring, branch-specific commands/workflows, STAB reports, generated research, graph waivers, MCP templates, README workflow counts, PR split, and DRI ownership.

### Could Codex be claiming success because artifacts exist rather than because validation passed?

No. Success is tied to command evidence: workflow/command validation passed, bundle generation/checks passed, ACO traceability and policy checks passed, format check passed, `bun run validate` passed, `bun run test` passed, `git diff --check` passed, post-cleanup reconciliation passed, and targeted cleanup literal checks passed.

### Final adversarial audit blocker

None.
