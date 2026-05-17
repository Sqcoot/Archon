# ADR 0006: BMAD Routing Model

Status: accepted

## Context

ACO must route work through BMAD without overfitting to one request.

## Decision

Use a small deterministic route catalog for MVP:

- brownfield architecture-sensitive route
- quick contained change route
- correct-course route
- unknown/help route

## Alternatives Considered

- Free-form LLM route generation.
- Full BMAD automation.

## Consequences

- Routes are auditable and testable.
- Human can follow returned BMAD steps.

## Evidence

- `research/upstreams/bmad-method/src/bmm-skills/module-help.csv`
- `research/upstreams/bmad-method/src/core-skills/module-help.csv`
- `research/upstreams/bmad-tea/src/module-help.csv`

## Acceptance Tests Required

- BMAD acceptance.
- Route acceptance.

## Rollback Or Correct-Course Trigger

If route catalog cannot classify a prompt, return `bmad-help` route and document uncertainty.
