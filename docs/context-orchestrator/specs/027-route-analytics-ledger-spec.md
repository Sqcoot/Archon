# 027 Route Analytics Ledger Spec

## Purpose

Define the ACO Route Analytics Ledger so explicit route captures create local feedback evidence without changing routing behavior.

## Scope

Append-only local JSONL records, route analytics schemas, explicit capture command, read-only aggregate report, redaction and hashing rules, malformed-row behavior, and no-implicit-write guardrails.

## Non-Goals

- Do not add a database table or migration.
- Do not add dashboard, Web display, API display, or cross-repo rollups.
- Do not add prediction, route scoring, recommendations, or auto route tuning.
- Do not refresh graph evidence or clean graph waivers.
- Do not automatically capture from existing route, status, ledger, slash, API, Web, or workflow paths.

## Generic Behavior

- A route analytics record has `schemaVersion: "aco.route-analytics.v1"`.
- Each explicit capture appends exactly one UTF-8 JSON object line.
- The ledger path is append-only; report generation never writes files.
- Required malformed rows are skipped during report generation and surfaced in warning metadata.
- Unknown fields on valid v1 rows are ignored for forward compatibility.
- `recordId` is a UUID generated per capture.
- `intentHash` is SHA-256 of the redacted normalized prompt; the raw prompt is never stored or hashed.
- `objectivePreview` is optional, redacted, and capped at 160 characters.
- `ledgerCounts` contains named numeric counts only and never embeds full ledger rows.

## Archon-Specific Behavior

- Archon stores the ledger at `.archon/state/context-orchestrator/route-analytics.jsonl`.
- `archon context analytics capture --cwd <repo> [--json] <prompt>` is the only Archon command that appends to the ledger.
- `archon context analytics report --cwd <repo> [--json] [--limit <n>]` reads the ledger and returns all-time aggregates plus recent records.
- Existing `archon context route`, `status`, `ledgers`, API reads, Web views, slash commands, and workflow paths do not create or append analytics records.
- If the ledger file is missing, report returns zero aggregates and an empty recent-record list.
- `--limit` affects only `recentRecords`; all-time aggregates always scan every valid row.

## Inputs

- user prompt
- cwd
- current route decision
- context readiness
- validation status
- graph status
- next decision kind
- graph waiver IDs
- evidence blocker IDs
- ledger summary counts
- capture source

## Outputs

- `RouteAnalyticsRecordV1`
- `RouteAnalyticsReport`
- local JSONL ledger
- CLI capture JSON/Markdown summary
- CLI report JSON/Markdown summary

## Known Unknowns

- Whether later product surfaces should expose route analytics after enough local capture evidence exists.
- Whether future route quality labels should be derived from explicit user outcome feedback.

## Evidence References

- packages/context-orchestrator/src/route-analytics.ts
- packages/context-orchestrator/src/schemas/route-analytics.ts
- packages/cli/src/commands/context.ts
- packages/cli/src/cli.ts
- tests/acceptance/context-orchestrator/route-analytics.acceptance.test.ts

## Acceptance Scenarios

- AC-RA-001: Given existing context route, status, ledgers, API read, Web view, slash, or workflow paths, when they run without explicit analytics capture, then they do not create or append `.archon/state/context-orchestrator/route-analytics.jsonl`.
- AC-RA-002: Given `archon context analytics capture` runs with a valid prompt, when capture completes, then the parent directory exists and exactly one valid JSONL row is appended.
- AC-RA-003: Given current ACO repository evidence, when capture runs, then the record contains route `brownfield-architecture`, readiness `needs_approval`, next decision `approval_required`, graph `forbidden`, and both graph waiver IDs.
- AC-RA-004: Given semantically equivalent prompts with case and whitespace differences, when analytics hashes are computed, then their hashes match after redaction and normalization.
- AC-RA-005: Given the ledger contains malformed rows, when report runs, then malformed rows are skipped, report still succeeds, and metadata includes malformed/skipped row counts and warnings.
- AC-RA-006: Given the ledger file is absent, when report runs, then it returns zero aggregates, empty `recentRecords`, and no write side effects.

## Failure Behavior

- Invalid capture records fail validation before write.
- Invalid `--limit` values fail with a clear CLI error.
- File read errors other than missing ledger files are surfaced to the caller.
- Malformed JSONL rows do not block report generation.
- Report ignores unknown valid v1 fields.

## Security Constraints

- Redact secrets before hashing or preview generation.
- Do not store raw prompts, raw `.env` values, credential URLs, authorization headers, token-like values, or email addresses.
- Do not write outside `.archon/state/context-orchestrator/route-analytics.jsonl` unless a test-only helper path is explicitly injected.
- Do not use route analytics to execute commands or mutate workflow/session lifecycle state.

## Open Questions

- Should a future explicit outcome-capture command record whether the user accepted, rejected, or overrode the route?
