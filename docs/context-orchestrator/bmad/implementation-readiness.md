# ACO Implementation Readiness

Date: 2026-05-17
BMAD action: `bmad-check-implementation-readiness`

## Status

Ready for acceptance test harness.

## Required Before Production Code

- Acceptance test files created.
- ADRs 0001 through 0012 created.
- CLI MVP scope confirmed.

## Story Readiness

| Story | Specs | Acceptance tests | Ready |
| --- | --- | --- | --- |
| Generic core models | 002, 003, 008, 016 | route, docs, bmad, acceptance-planner, compile | yes |
| Archive writer | 009, 015 | archive, security | yes |
| CLI MVP | 012, 018 | cli, release | yes |
| Caveman policy | 007 | caveman | yes |

## Blocked Or Deferred

- API surface is deferred.
- Slash command surface is deferred.
- Workflow surface is deferred.
- Full all-workflow validation remains blocked by baseline optional ntfy issue.
