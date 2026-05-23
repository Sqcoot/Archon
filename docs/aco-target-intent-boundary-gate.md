# ACO Target Intent Boundary Gate

`bun run aco:target-intent -- --objective "<task>" --json` builds a read-only boundary report for the active ACO work request.

The gate records:

- the raw and normalized objective
- inferred work intent
- harness root, branch, commit, and dirty state
- target relationship and target root
- mutation policy
- source signals, warnings, and baseline evidence
- the canonical gate state: `ready`, `blocked`, `needs_decision`, or `unknown`

The boundary is descriptive. `scope.nonEnforcementBoundary` is always `true`, and the report does not grant mutation permission. External targets, registered-project targets, ambiguous targets, and unknown intent produce decisions instead of assuming that Archon is the target. Bug-fix work blocks until baseline evidence is provided with `--baseline-evidence`.

This gate is objective-specific, so it is not part of the default `bun run validate` chain. Run it before starting or handing off an ACO implementation slice.
