# ACO Goal-Bound Evidence Gate

`bun run aco:goal-bound-evidence -- --objective "<task>" --evidence-json '<json>' --json` checks whether supplied evidence is fresh, passed, provenance-bearing, and bound to the same objective hash.

The gate records:

- canonical state: `ready`, `blocked`, `needs_decision`, or `unknown`
- redacted objective, normalized objective, intent hash, and inferred work intent
- required evidence for the work intent
- supplied evidence IDs, statuses, freshness, provenance, and objective hashes
- structured blockers, warnings, closure items, and next action

This gate is read-only. It does not fetch documentation, inspect provider auth, mutate MCP or provider config, clear graph waivers, refresh graph evidence, write artifacts, or grant mutation permission. Approval-required evidence is represented as `approval_required` and maps to `needs_decision`, not a new top-level state.

The gate is objective-specific, so it is not part of default `bun run validate`. Run it before completion, handoff, push, PR, or another ACO stage when explicit evidence records are available.
