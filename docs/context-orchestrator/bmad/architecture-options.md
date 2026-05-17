# ACO Architecture Options

Date: 2026-05-17

## Option A: New Isolated Package

Generic ACO core in `packages/context-orchestrator`, with CLI, workflow, slash command, and API adapters added over time.

Pros:

- Clean package boundary.
- Generic domain model is testable without Archon runtime.
- Avoids coupling to server or workflow internals.

Cons:

- Adds workspace package.
- CLI dependency must be wired.

Decision: selected.

## Option B: Existing Core Module

ACO lives under `packages/core/src/context-orchestrator`.

Pros:

- Easy slash command and database access.

Cons:

- Couples generic ACO to core orchestration and DB.
- Harder to reuse from workflows without reverse dependencies.

Decision: rejected for MVP.

## Option C: Workflow-First Implementation

ACO starts as bundled workflows and commands with minimal internal code.

Pros:

- Native to Archon workflows.
- Fast to expose multi-stage route.

Cons:

- Prompt compiler and archive writer become harder to contract-test.
- Workflow validation currently has a baseline optional MCP issue.

Decision: deferred.

## Option D: API/CLI-First Implementation

ACO starts as a programmatic service exposed through CLI/API.

Pros:

- Good contract-first direction.

Cons:

- API requires schemas, generated web types, and broader validation surface.

Decision: split. CLI first, API later.
