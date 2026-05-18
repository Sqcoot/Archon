# 019 Observability and Events Spec

## Purpose

Define ACO event and observability behavior.

## Scope

Workflow events, stage names, redaction, runId, and failure reporting.

## Non-Goals

- Do not add database migrations until artifacts/events are proven insufficient.
- Do not initialize an OpenTelemetry SDK, exporter, collector, or runtime bootstrap inside
  `@archon/context-orchestrator`.
- Do not emit OpenTelemetry metrics or logs in the CLI MVP.

## Generic Behavior

- ACO emits stage transitions for route, graph, docs, BMAD, acceptance, compile, archive, validate, completion, and failure.
- ACO may create OpenTelemetry API spans for the highest-value orchestration boundaries.
- OpenTelemetry spans are no-op unless the host runtime installs a global tracer provider.

## Archon-Specific Behavior

- If workflow integration is selected, use existing workflow event tables and event emitter patterns.
- ACO Status workflow visibility is read-only UI context sourced from the canonical status endpoint. It must not create new workflow events, persist readiness snapshots, or reinterpret workflow status.

## Inputs

- runId
- stage
- status
- safe metadata

## Outputs

- workflow events
- log entries
- validation report entries
- read-only readiness display in workflow UI and PR/handoff text
- OpenTelemetry API spans:
  - `archon.aco.compile`
  - `archon.aco.policy.archive`

## OpenTelemetry Trace Contract

The context orchestrator owns instrumentation only. It does not own provider lifecycle,
exporter configuration, sampling, collectors, or backend selection.

Allowed span attributes are low-cardinality operational metadata only:

- `archon.aco.operation`
- `archon.aco.result`
- `archon.aco.error.kind`
- `archon.aco.bmad.route`
- graph, docs, capability, acceptance, validation, policy, traceability, and archive counts
- policy gate outcome, policy version, OPA availability, and OPA version

Unknown attribute keys are dropped. Attribute values must be booleans, finite non-negative
numbers, or bounded strings. Objects, arrays, long strings, secret-like strings, and dynamic
attribute names are not allowed.

## Known Unknowns

- whether non-workflow CLI MVP needs event persistence

## Evidence References

- packages/workflows/src/event-emitter.ts
- packages/workflows/src/store.ts

## Acceptance Scenarios

- ACO-EVENTS-001: Given workflow integration is included, when `context-orchestrate` runs through status, ledgers, compile, graph-validation, approval, handoff, and summary stages, then it uses existing workflow event and approval observability instead of adding a separate ACO event store.
- AC-P3-WF: Given ACO readiness is shown on workflow surfaces, when the dashboard or run detail renders it, then no workflow event or persisted run metadata is added for the status snapshot.
- Given no OpenTelemetry tracer provider is installed, when ACO compiles a prompt package, then
  functional output is unchanged and telemetry remains no-op.
- Given an OpenTelemetry tracer provider is installed by the host runtime, when ACO compiles a
  prompt package and archives its policy decision, then `archon.aco.compile` and
  `archon.aco.policy.archive` spans are emitted with only allowlisted attributes.
- Given compilation or policy archival fails, when the span is ended, then span status is error
  and only a sanitized `archon.aco.error.kind` is recorded.

## Failure Behavior

- Event emission failure should be explicit; do not silently mark workflow success if archive validation failed.
- Telemetry must not mask, wrap, or replace the original compile/archive error.

## Security Constraints

- No raw secrets or `.env` values in events.
- No raw prompts, compiled prompt packages, context content, document chunks, user messages,
  model output, tool output, OPA input/output bodies, environment variables, credentials,
  absolute filesystem paths, branch names, remotes, or unbounded user strings in spans.

## Open Questions

- Should prompt text be omitted, redacted, or hashed in events?
