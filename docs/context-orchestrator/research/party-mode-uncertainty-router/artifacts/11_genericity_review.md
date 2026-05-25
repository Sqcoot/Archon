# Genericity Review

## Decision

Reusable handoff and template surfaces must not depend on one chat session, local path, backup timestamp, or historical commit unless that value is an explicit placeholder.

Evidence and audit-trail artifacts may keep exact commits, dates, versions, hashes, backup names, and command results when those facts are clearly framed as observed evidence from a specific validation run.

## Consensus

Party-mode review reached the same rule from two angles:

- Generic handoffs should use placeholders such as `<target-commit-or-range>`, `<target-branch>`, `<installed-router-path>`, `<user-hook-config-path>`, `<hooks-json-backup-path>`, and `<config-toml-backup-path>`.
- Evidence reports should keep literal facts such as `codex-cli 0.128.0`, observed hook events, local smoke outcomes, file hashes, and backup suffixes because those are the audit record for one run.

## Applied Policy

Genericized:

- `docs/context-orchestrator/handoffs/026-aco-codex-hook-test-investigation-goal-4000chars.md`
- `README.md`
- `next_goal.md`

Kept literal as evidence:

- `docs/context-orchestrator/research/aco-codex-hook-test-coverage-investigation.md`
- `artifacts/09_live_hook_install_validation.md`
- `artifacts/10_rollout_smoke_decision.md`
- `evidence_manifest.yaml`
- `investigation_report.md`
- `readonly_policy_result.md`

## Future Rule

When uncertainty arises about whether a package artifact is generic enough, run party mode until the reviewers converge on a decision. Then apply the decision without asking the user unless a tool-level sandbox approval is required.

## Autonomy Correction

Do not stop after party-mode consensus to ask whether the agreed cleanup should be applied. Consensus is the decision point. Continue through edits, validation, zip regeneration, and commit.

If a sandbox or command approval blocks one execution path, treat that as an execution constraint, not a product question. Use an already-approved command path or another safe non-destructive route when available, and keep moving.
