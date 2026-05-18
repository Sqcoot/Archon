# Context Orchestrator Observability

The Agentic Context Orchestrator uses OpenTelemetry API instrumentation for trace metadata.
The package does not initialize an SDK, exporter, collector, sampler, or backend. Spans are
no-op until a host runtime installs an OpenTelemetry tracer provider.

## Traced Boundaries

- `archon.aco.compile` covers prompt package compilation.
- `archon.aco.policy.archive` covers OPA prompt-package policy decision archival.

These spans expose output-quality signals such as BMAD route, graph/document counts,
selected capability count, acceptance scenario count, validation status, policy outcome,
traceability status, and archive file count.

## Privacy Rules

ACO spans record operational metadata only. They must not record raw prompts, compiled prompt
packages, context content, document chunks, user messages, model output, tool output, policy
input/output bodies, environment variables, secrets, credentials, absolute filesystem paths,
branch names, remotes, or unbounded user-provided strings.

Attributes use an allowlist. Unknown keys, arrays, objects, long strings, negative counts,
and secret-like strings are dropped before they reach OpenTelemetry.

Errors are recorded as sanitized `archon.aco.error.kind` values. Raw exception messages and
stacks are not recorded.

## Runtime Behavior

`@archon/context-orchestrator` depends on `@opentelemetry/api` only for runtime tracing. A host
application that wants exported spans must configure the OpenTelemetry SDK before calling ACO.
This package intentionally does not read `OTEL_*` environment variables or configure exporters.

## Validation

Run the focused package checks:

```bash
bun --filter @archon/context-orchestrator type-check
bun --filter @archon/context-orchestrator test
```

Run the ACO gates with the pinned local OPA binary on `PATH`:

```bash
bun run aco:traceability
bun run aco:policy
bun run aco:test:acceptance
```

The full pre-PR gate remains:

```bash
bun run validate
```
