# STAB-002 Validation Report

## Scope

This report validates the operationalization patch after commit `4d9305890be999c82a64231a2fbcb94d2a982448`.

## Environment

Initial environment captured before edits:

| Command | Result | Output excerpt |
| --- | --- | --- |
| `date` | Passed | `Fri May 22 06:34:51 EDT 2026` |
| `git branch --show-current` | Passed | `stabilization/stab-002-bmad-method-current-sync` |
| `git rev-parse HEAD` | Passed | `4d9305890be999c82a64231a2fbcb94d2a982448` |
| `git status --short` | Passed | Clean output before edits. |

## Archon context and ledger evidence

| Command | Result | Output excerpt | Classification |
| --- | --- | --- | --- |
| `bun run cli context route --cwd . --json "<objective>"` | Passed | Route `unknown-help`; rationale: prompt lacks enough route evidence for production BMAD path; confidence `low`; requires decision `true`. | Route ambiguity, handled by explicit BMAD mapping. |
| `bun run cli context ledgers --cwd . --json "<objective>"` | Passed | Ledger schema `aco.ledger-bundle.v1`; intent commit `4d930589...`; combined counts: available 29, deferred 3, forbidden 8. | Ledger evidence available. |
| `bun run cli context status --cwd . --json "<objective>"` | Passed | `graphStatus: forbidden`; `readiness: needs_approval`; `validationStatus: passed`; waivers: `graph-waiver.bmad-plugins-marketplace`, `graph-waiver.bmad-sample-data`. | Approval required to preserve current graph waivers; no graph refresh run. |
| `npx ctx7@latest library Archon "<question>"` | Failed | `Monthly quota exceeded. Create a free API key at https://context7.com/dashboard for more requests.` | Environment/quota issue. |

## Commands attempted

| Command | Timestamp | Result | Output excerpt | Classification | Follow-up |
| --- | --- | --- | --- | --- | --- |
| `archon doctor` | 2026-05-22 06:34 EDT | Passed | Database reachable; workspace writable; bundled defaults loaded; GitHub/Slack/Telegram/Pi not configured; `All checks passed.` | Environment ok with optional integrations absent. | Configure `GITHUB_TOKEN` or `gh auth` only when GitHub workflows need it. |
| `archon workflow list --cwd .` | 2026-05-22 06:34 EDT | Passed | Found 42 workflows. Loader warned that one loop node ignores `allowed_tools`/`effort`; discovery warned `.archon/workflows/defaults` is deprecated repo defaults path. | Workflow discovery ok with warnings. | Warnings are existing asset behavior; no new workflow added. |
| `bun run cli workflow list --cwd . --json` | 2026-05-22 06:35 EDT | Passed | JSON returned 42 workflows and `errors: []`. | Workflow loading ok. | None. |
| `bun run cli validate workflows --cwd .` | 2026-05-22 06:35 EDT | Passed with warning | `Results: 42 valid, 0 with errors, 1 with warnings`; warning: optional `.archon/mcp/ntfy.json` missing and guarded by upstream check. | Workflow/schema ok; optional MCP absent. | Keep MCP path documented as optional/illustrative unless file is added. |
| `bun run cli validate commands --cwd .` | 2026-05-22 06:35 EDT | Passed | `Results: 78 valid, 0 with errors`. | Commands/scripts ok. | None. |
| `bun run check:bundled` | 2026-05-22 06:35 EDT | Passed | `bundled-defaults.generated.ts is up to date (55 commands, 23 workflows).` | Generated defaults ok. | None. |
| `bun run check:bundled-skill` | 2026-05-22 06:35 EDT | Passed | `bundled-skill.ts is up to date (21 files).` | Bundled skill ok. | None. |
| `bun run aco:traceability` | 2026-05-22 06:35 EDT | Passed | `ACO traceability validation passed.` | ACO traceability ok. | None. |
| `bun run format:check` | 2026-05-22 06:35 EDT | Passed | `All matched files use Prettier code style!` | Formatting ok. | None. |
| `bun run validate` | 2026-05-22 06:38 EDT | Passed | Ran `check:bundled`, `check:bundled-skill`, `aco:traceability`, type-check, lint, format check, and workspace tests; command exited 0. | Full repo validation ok. | None. |
| `git diff --check` | 2026-05-22 06:36 EDT | Passed | No output. | Whitespace ok. | None. |

## Validation findings

Passed:

- Global `archon doctor`.
- Local workflow discovery: 42 workflows, no load errors.
- Local workflow validation: 42 valid, 0 errors, 1 expected optional MCP warning.
- Local command/script validation: 78 valid, 0 errors.
- Bundled defaults and bundled skill checks.
- ACO traceability.
- Full `bun run validate`.
- `git diff --check`.

Warnings and limits:

- `archon workflow list` reports `deprecated_workflow_defaults_found` for `.archon/workflows/defaults`. This predates this patch and matches the repo's current bundled-default source layout.
- Workflow validation warns that `.archon/mcp/ntfy.json` is missing for `archon-smart-pr-review` notify node. The validator classifies it as optional because a file-existence check guards the node.
- ACO status reports `graphStatus: forbidden`, `readiness: needs_approval`, and active waivers `graph-waiver.bmad-plugins-marketplace` and `graph-waiver.bmad-sample-data`. This patch preserved those waivers and did not run graph refresh or waiver cleanup.
- Context7 docs lookup failed with a quota error. Local Archon skill refs, local schemas, and CLI help were used instead.

## Example/schema checks

Inspected `docs/ai/agentic-coding-operating-guide.md` for:

- `always_run: true`
- boolean string comparisons such as `== 'true'`
- accidental `steps:`
- loop nodes with unsupported fields
- multiple node types on one node
- `$ARTIFACTS_DIR` described as inside the repo
- committing transient artifacts

Findings and corrections:

- `steps:` appears only in text warning not to use removed `steps:` workflows.
- `always_run: true` appears in an illustrative `validate-pr` example. Installed fork supports `always_run` in `packages/workflows/src/schemas/dag-node.ts`.
- Boolean `when` comparisons use quoted literals. Installed condition evaluator uses quoted string literals for expressions; comparing structured boolean fields to `'true'` is acceptable in current docs/examples.
- Several short command names and MCP config paths are illustrative, not current repo assets. The guide now says so and points to `workflow-compliance-matrix.md`.
- React Native validation/config examples were replaced with repo-specific Bun/TypeScript Archon validation and minimal config notes.
- `.archon/config.yaml` intent is documented as minimal; comments were added without adding unsupported fields.

## Acceptance checklist

| Item | Status | Evidence |
| --- | --- | --- |
| Guide linked from README/AGENTS/CLAUDE. | Pass | `README.md`, `AGENTS.md`, `CLAUDE.md`. |
| Guide linked from CODEBASE_MAP. | Pass | `CODEBASE_MAP.md`. |
| `docs/ai/README.md` exists. | Pass | Added. |
| Workflow compliance matrix exists. | Pass | Added. |
| BMAD mapping exists. | Pass | Added. |
| Source traceability exists. | Pass | Added. |
| Worktree and branch lifecycle policy exists. | Pass | Added. |
| Security and secrets policy exists. | Pass | Added. |
| Workflow validation policy exists. | Pass | Added. |
| Validation report exists. | Pass | This file. |
| Existing workflows mapped. | Pass | `workflow-compliance-matrix.md`. |
| Existing commands mapped. | Pass | `workflow-compliance-matrix.md`. |
| Existing scripts mapped. | Pass | `workflow-compliance-matrix.md`. |
| Existing agents/skills mapped. | Pass | `workflow-compliance-matrix.md`, `bmad-to-archon-mapping.md`. |
| BMAD mapped or explicitly scoped. | Pass | `bmad-to-archon-mapping.md`. |
| `.archon/config.yaml` intent clarified. | Pass | Config comments plus `workflow-compliance-matrix.md`, `workflow-validation.md`, and this report. |
| Generic React Native examples removed or labeled as generic. | Pass | Guide now uses repo-specific config/validation notes. |
| Unsupported YAML fields fixed or labeled illustrative. | Pass | Guide notes installed support for `always_run`, quoted conditions, placeholder commands, and illustrative MCP paths. |
| Validation commands attempted and output recorded. | Pass | Commands table above. |

## Sufficiency verdict

Sufficient for the operational endgoal of this patch.

The guide is linked, compliance mapping exists, BMAD mapping exists, validation evidence exists, config intent is clarified, and critical validation passed. Remaining gaps are documented in `workflow-compliance-matrix.md` and are not blockers for this docs/config operationalization patch.

## Runtime-enforcement follow-up

The next-stage runtime-enforcement patch is tracked separately in `docs/ai/runtime-enforcement-decision.md`, `docs/ai/runtime-enforcement-ledger.md`, and `docs/ai/stab-002-runtime-validation-report.md`.
