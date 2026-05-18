# 008 Prompt Package Spec

## Purpose

Define the ACO prompt package, first-class ledger artifacts, and its derived policy-decision artifact.

## Scope

Prompt package fields, renderers, traceability, validation report, Tool Availability and Commands ledger evidence, archived OPA policy decision evidence, and Codex handoff.

## Non-Goals

- Do not execute the prompt package automatically unless ADR selects that surface.
- Do not treat the derived `policy-decision.json` artifact as an input to OPA policy evaluation.
- Do not treat ledger command safety classification as runtime permission enforcement.

## Generic Behavior

- PromptPackage includes runId, timestamp, original prompt, target codebase, intent, evidence, GraphContext, DocumentationPlan, MCP readiness, BmadRoute, AcceptancePlan, capabilities, CavemanPolicy, security constraints, unknowns, human prompt, Codex prompt, structured next command argv, validation report, and `ledgerBundle`.
- `ledgerBundle` is a generic, code-level evidence bundle with `schemaVersion: "aco.ledger-bundle.v1"`, deterministic Tool Availability and Commands ledgers, and summaries by exact ledger status.
- Ledger JSON artifacts are source of truth; Markdown ledger artifacts are derived human views.

## Archon-Specific Behavior

- Archive prompt packages under `$ARTIFACTS_DIR/context-orchestrator/<run-id>/` for workflow runs or selected equivalent artifact surface.

## Inputs

- PromptRequest
- CapabilityRoute
- EvidencePacket
- DocumentationPlan
- BmadRoute
- AcceptancePlan

## Outputs

- manifest.json
- prompt-package.json
- policy-decision.json
- tool-availability-ledger.json
- tool-availability-ledger.md
- commands-ledger.json
- commands-ledger.md
- final-prompt-package.md
- codex-prompt.md
- validation-report.md

`prompt-package.json` is the stable machine-readable policy input for ACO prompt-package validation. It includes `schema_version`, `package_id`, `generated_at`, `source_request`, `manifest`, artifact references, graph/docs/BMAD/acceptance/security evidence, and the validation report.

`prompt-package.json.evidence.ledgers` contains the combined `LedgerBundle`. `tool-availability-ledger.json` and `commands-ledger.json` contain matching per-ledger sections with the same schema version and summary.

`policy-decision.json` is the deterministic machine-readable OPA decision artifact derived from the archived `prompt-package.json` bytes. It records the normalized allow/deny/warn decision, stable finding codes, counts, duplicate suppression count, SHA-256 hashes for the input and policy files, and OPA CLI version metadata. It must not contain wall-clock evaluation time.

## Known Unknowns

- final archive root for CLI-only MVP

## Evidence References

- docs/context-orchestrator/specs/005-documentation-resolution-spec.md

## Acceptance Scenarios

- Given a compiled prompt package, when final-prompt-package.md is opened, then it references specs, acceptance criteria, graph status, docs plan, BMAD route, capabilities, and unknowns.
- Given a compiled prompt package, when prompt-package.json is opened, then it exposes the archived evidence contract consumed by the OPA prompt-package policy.
- ACO-POLICY-DECISION-001: Given a compiled prompt package, when policy-decision.json is opened, then it exposes the deterministic OPA decision derived from the archived prompt-package.json artifact.
- AC-LEDGER-001: Given ledger engine output, when the bundle is inspected, then it uses a generic schema with no BMAD or `.history` runtime dependency.
- AC-LEDGER-002: Given equivalent inputs, when ledger JSON and Markdown render, then entries are deterministically ordered by stable IDs.
- AC-LEDGER-003: Given evidence is missing, blocked, or partial, when ledgers are normalized, then `unknown`, `blocked`, and `partial` are preserved rather than collapsed to `available`.
- AC-LEDGER-004: Given `context compile` succeeds, when the archive is inspected, then exactly four new ledger artifacts are present in the prompt-package archive contract.
- AC-LEDGER-006: Given source evidence contains secret-like values, when ledgers serialize, then secrets are redacted from JSON and Markdown artifacts.

## Failure Behavior

- Compilation fails if acceptance plan or security constraints are missing.
- Compilation fails for malformed ledger rows or invalid ledger statuses.
- Missing ledger evidence becomes `unknown` unless concrete partial or blocked evidence exists.
- Compilation fails if archive-time OPA admission denies the archived prompt-package.json.
- Compilation fails with a clear diagnostic and writes no policy-decision.json if OPA is unavailable, OPA evaluation fails, or OPA output is malformed.

## Security Constraints

- Redact secrets, validate all paths before writing, and represent follow-up commands as argv arrays rather than shell-interpolated strings.

## Open Questions

- Should prompt package JSON schema live in a new package or server schemas?
