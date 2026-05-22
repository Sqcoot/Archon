# Runtime Enforcement Ledger

This is a reviewable docs ledger for the STAB-002 runtime-enforcement patch. It is not the hidden Archon runtime ledger.

The concrete local ledger mechanism found in this repo is the ACO ledger surface:

```bash
bun run cli context ledgers --cwd . --json "<objective>"
```

It is implemented by `packages/context-orchestrator/src/ledgers.ts` and exposed by `packages/cli/src/commands/context.ts`.

## Entry: 2026-05-22 Runtime-Enforcement V1

| Field | Value |
| --- | --- |
| Date | 2026-05-22 |
| Branch | `stabilization/stab-002-bmad-method-current-sync` |
| Built on commit | `60dd4e18a0c6fd8c0f6c98d25f96c2fbfd5840c9` |
| Decision | Implement minimal read-only enforcement scripts and document deferrals for BMAD workflow and MCP templates. |
| Runtime ledger found | Yes: ACO `aco.ledger-bundle.v1` via `bun run cli context ledgers --cwd . --json`. |
| Docs ledger created | Yes: this file. |
| BMAD decision | BMAD remains mapped/advisory; first-class BMAD workflow deferred pending concrete story artifacts and repeatable workflow need. |
| MCP decision | Repo-local MCP templates deferred; MCP remains user/global or guarded optional workflow config. |
| Approval-sensitive items | Graph refresh, waiver cleanup, destructive cleanup, branch deletion, PR creation, production-write MCP, broad format/lint rewrite. |

## Files Changed

Expected files for this patch:

- `.archon/scripts/check-artifact-completeness.ts`
- `.archon/scripts/validate-branch-name.ts`
- `.archon/scripts/check-complete-preconditions.ts`
- `package.json`
- `docs/ai/goals/stab-002-runtime-enforcement.goal.md`
- `docs/ai/artifact-schema.md`
- `docs/ai/dri-ownership.md`
- `docs/ai/runtime-enforcement-decision.md`
- `docs/ai/runtime-enforcement-ledger.md`
- `docs/ai/stab-002-runtime-validation-report.md`
- Targeted updates to existing `docs/ai/*` docs and `README.md`

## Validation Commands

Validation evidence is recorded in `docs/ai/stab-002-runtime-validation-report.md`.

Planned commands:

```bash
bun run cli context route --cwd . --json "<runtime objective>"
bun run cli context ledgers --cwd . --json "<runtime objective>"
bun run cli context status --cwd . --json "<runtime objective>"
bun run cli context validate --cwd . --json
bun run ai:check-artifacts docs/ai
bun run ai:validate-branch
bun run ai:check-complete
bun run cli workflow list --cwd . --json
bun run cli validate workflows --cwd .
bun run cli validate commands --cwd .
bun run check:bundled
bun run check:bundled-skill
bun run aco:traceability
bun run format:check
bun run validate
git diff --check
```

## Current Pass / Fail Status

Runtime validation status: sufficient for v1.

Passed:

- `bun run cli context validate --cwd . --json`
- `bun run ai:check-artifacts docs/ai`
- `bun run ai:validate-branch`
- `bun run cli workflow list --cwd . --json`
- `bun run cli validate workflows --cwd .`
- `bun run cli validate commands --cwd .`
- `bun run check:bundled`
- `bun run check:bundled-skill`
- `bun run aco:traceability`
- `bun run format:check`
- `bun run validate`
- `git diff --check`

Expected fail-closed result:

- `bun run ai:check-complete` failed while this implementation patch was uncommitted, because complete/cleanup preconditions require a clean working tree.

Skipped:

- Runtime smoke workflow was skipped to avoid creating workflow run state or invoking an AI provider for a docs/scripts-only enforcement patch.

## Remaining Gaps

- BMAD story artifacts are not automatically passed into Archon workflows.
- No repo-local MCP templates exist.
- DRI owner names remain `TBD`.
- Runtime smoke workflow is optional and should be skipped unless it is confirmed to avoid side effects.
