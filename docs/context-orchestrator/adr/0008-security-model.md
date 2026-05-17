# ADR 0008: Security Model

Status: accepted

## Context

ACO handles untrusted prompts, graph text, docs evidence, and archive paths.

## Decision

Fail closed on path traversal, never read target repo `.env` files, redact token-like strings, and avoid shell interpolation of prompt text.

## Alternatives Considered

- Best-effort redaction only.
- Trust generated graph text.

## Consequences

- Some user-provided token-like examples are redacted.
- Archive writer has stricter path constraints.

## Evidence

- `docs/context-orchestrator/specs/015-security-threat-model.md`
- Archon env isolation tests in `packages/paths`.

## Acceptance Tests Required

- Security acceptance.
- Archive acceptance.

## Rollback Or Correct-Course Trigger

If a secret appears in any archive or CLI/API output, block release readiness.
