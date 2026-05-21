---
description: Execute a named measurable Archon stabilization goal
argument-hint: "<goal-id>"
---

# Goal

Request: $ARGUMENTS

## Supported Invocation

`/goal stabilize-aco-merge-ready`

Execute the ACO stabilization goal.

## Objective

Convert the current ACO stabilization branch into a small, safe, typed, tested,
deterministic, reviewable product slice without preserving branch-local
scaffolding as product behavior.

## Scope

Allowed surfaces:

- `.archon/commands/defaults/**`
- `.archon/workflows/defaults/**`
- `docs/context-orchestrator/**`
- `packages/context-orchestrator/**`
- `packages/cli/src/commands/context.ts`
- `packages/cli/src/commands/aco.ts`
- `packages/server/src/routes/api.ts`
- `packages/server/src/routes/schemas/aco.schemas.ts`
- `packages/web/src/routes/AcoStatusPage.tsx`
- `packages/web/src/lib/api.generated.d.ts`
- `packages/web/src/lib/aco-readiness.ts`
- `tests/acceptance/context-orchestrator/**`
- `scripts/context-orchestrator/**`
- `scripts/policy/**`

## Non-Goals

- Do not add documentation as a substitute for working code, tests, workflow
  safety, generated-file drift checks, or validation results.
- Do not mark provider tools available from prompt text.
- Do not preserve non-reproducible generated artifacts in product source.
- Do not mutate live Codex, Claude, MCP, or local provider config without
  explicit opt-in.
- Do not widen the slice beyond ACO stabilization needs.

## Safety Rules

- Record comparison baseline before classifying files.
- Preserve graph waivers unless user explicitly approves graph refresh or waiver cleanup.
- Replace developer-local paths, hard-coded branch gates, and undeclared private
  tools with repository-root-relative parameters or explicit opt-in variables.
- Return `blocked`, `needs_approval`, `needs_decision`, or `unknown` when
  required evidence is missing.
- Prefer `bun run cli validate workflows <name>`, `bun run cli validate commands
  <name>`, package tests, and targeted acceptance tests before full validation.

## Required Outputs

1. comparison baseline
2. stabilization inventory
3. applied code/file/test/workflow/doc changes
4. generated-file reproducibility report
5. validation command report
6. security hardening report
7. graph-waiver approval report, if waivers remain
8. final scorecard
9. final PR hygiene report
10. final merge recommendation

## Baseline Requirements

Record:

- current branch
- target branch
- merge base
- compare command
- changed-file command
- timestamp of inventory generation
- initial changed-file count
- final changed-file count
- open PR or compare URL when available
- current head commit
- current base commit

## Evidence Rules

Hard gates may pass only with at least one evidence type:

- code
- test
- workflow
- generated drift check
- validation command
- removal
- not-applicable rationale

Documentation-only changes cannot satisfy runtime hard gates.

## Not-Applicable Rules

Every `not_applicable` gate must include:

- reason
- verification method
- readiness impact
- reactivation condition
- reviewer-facing explanation

## Measurable Done Gates

- 100% changed files classified.
- 0 hard-coded developer-local paths in retained product source.
- 0 stale branch gates in bundled defaults.
- 0 missing required fixtures.
- 0 ignored local fixture dependencies, including `.agents/**`, in retained tests.
- 0 default Codex hooks invoke `kild` or undeclared private local tools.
- 0 tracked local MCP setup artifacts contain developer-local paths, private
  credential-store names, or machine-local wrapper paths.
- 0 unreproducible retained generated files.
- 5/5 readiness states represented and behavior-tested: `ready`, `blocked`,
  `needs_approval`, `needs_decision`, `unknown`.
- 100% retained integrations use `verified_available`,
  `configured_but_not_reachable`, `not_configured`, `unavailable`, `unknown`,
  or `deferred_by_design` with reasons.
- 0 retained integrations report availability from prompt text only.
- 0 critical text-only tests remain without paired behavior coverage.
- 12/12 minimum security scenarios pass or are `not_applicable` with evidence.
- 100% retained ACO API routes, CLI commands, web states, workflows, policy
  gates, traceability gates, and generated files have evidence.
- 0 hard gates are `unknown`.
- 100% hard gates include evidence.
- Graph waivers, if retained, remain visible with waiver IDs, approval scope,
  approval evidence, and runtime readiness impact.

## Final Recommendation States

Final recommendation must be exactly one of:

- `ready`
- `ready_with_approved_graph_waivers`
- `blocked`
- `needs_approval`
- `needs_decision`

Plain `ready` requires every hard gate to pass or be explicitly
`not_applicable` with evidence and runtime ACO status must not be
approval-dependent.

If runtime ACO status is `needs_approval` only because graph waivers are
preserved by explicit user approval, the final recommendation must be
`ready_with_approved_graph_waivers`, not plain `ready`.

Failed, skipped, unknown, or evidence-free hard gates force `blocked`,
`needs_approval`, or `needs_decision`.

## Validation Expectations

Run or record blockers for:

- install/bootstrap
- typecheck
- lint
- unit tests
- acceptance tests
- package tests for `@archon/context-orchestrator`
- server route tests
- CLI tests
- web build or relevant web tests
- API schema generation and generated type drift
- bundled-defaults generation and drift
- policy validation when policy remains
- traceability validation when traceability remains
- security/path traversal tests
- artifact write/read tests
- graph validation tests
- readiness state tests
- workflow smoke tests
- telemetry no-leak tests when telemetry remains
- slash goal command contract check
- scorecard completeness check
