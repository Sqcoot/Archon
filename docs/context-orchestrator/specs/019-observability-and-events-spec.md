# 019 Observability and Events Spec

## Purpose

Define ACO event and observability behavior.

## Scope

Workflow events, stage names, redaction, runId, and failure reporting.

## Non-Goals

- Do not add database migrations until artifacts/events are proven insufficient.

## Generic Behavior

- ACO emits stage transitions for route, graph, docs, BMAD, acceptance, compile, archive, validate, completion, and failure.

## Archon-Specific Behavior

- If workflow integration is selected, use existing workflow event tables and event emitter patterns.

## Inputs

- runId
- stage
- status
- safe metadata

## Outputs

- workflow events
- log entries
- validation report entries

## Known Unknowns

- whether non-workflow CLI MVP needs event persistence

## Evidence References

- packages/workflows/src/event-emitter.ts
- packages/workflows/src/store.ts

## Acceptance Scenarios

- Given workflow integration is included, when route, graph, docs, BMAD, compile, and archive stages complete, then events contain runId and stage and no raw secrets.

## Failure Behavior

- Event emission failure should be explicit; do not silently mark workflow success if archive validation failed.

## Security Constraints

- No raw secrets or `.env` values in events.

## Open Questions

- Should prompt text be omitted, redacted, or hashed in events?
