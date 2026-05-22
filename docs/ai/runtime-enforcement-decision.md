# Runtime Enforcement Decision

## Scope

This decision records the runtime-enforcement follow-up after commit `60dd4e18a0c6fd8c0f6c98d25f96c2fbfd5840c9`.

The prior governance patch is sufficient for documentation/config operationalization. This patch answers the next question: which parts of the AI operating model should be mechanically enforced now?

## Decision Summary

Runtime-enforcement v1 should implement small, read-only checks now and defer first-class BMAD workflows and repo-local MCP templates until stronger evidence exists.

Implemented now:

- Artifact schema documentation: `docs/ai/artifact-schema.md`
- Artifact completeness checker: `.archon/scripts/check-artifact-completeness.ts`
- Branch-name checker: `.archon/scripts/validate-branch-name.ts`
- Complete/cleanup precondition checker: `.archon/scripts/check-complete-preconditions.ts`
- Package script aliases: `ai:check-artifacts`, `ai:validate-branch`, `ai:check-complete`
- Ownership placeholder: `docs/ai/dri-ownership.md`
- Runtime decision ledger: `docs/ai/runtime-enforcement-ledger.md`
- Runtime validation report: `docs/ai/stab-002-runtime-validation-report.md`

Deferred now:

- BMAD-native Archon workflow
- Repo-local `.archon/mcp/*.example.json` templates
- Any graph refresh, waiver cleanup, destructive branch/worktree cleanup, PR creation, or production-write MCP config

## Artifact Enforcement

Decision: implement now.

Evidence:

- The compliance matrix previously marked artifact coverage partial.
- ACO artifacts and `$ARTIFACTS_DIR` already exist, but there was no repo-wide artifact handoff schema.
- A generic Markdown checker can enforce headings without changing workflow engine behavior.

Runtime mechanism:

```bash
bun run ai:check-artifacts <artifact-file-or-directory>
```

The checker is read-only and intentionally ignores Markdown files that are clearly not workflow artifacts.

## Branch Lifecycle Enforcement

Decision: implement now.

Evidence:

- Branch naming was documented but not mechanically checkable.
- Worktree/complete/cleanup policy needs a local preflight that does not delete anything.

Runtime mechanisms:

```bash
bun run ai:validate-branch
bun run ai:check-complete
```

`ai:check-complete` fails when the worktree is dirty or the branch is invalid, warns about upstream ambiguity, and prints follow-up commands for humans to run only after approval.

## BMAD-Native Workflow Decision

Decision: do not add a BMAD-native Archon workflow in this patch.

Evidence:

- `_bmad` contains install metadata, module config, output-folder policy, and resolver scripts.
- Executable BMAD workflows are installed as `.agents/skills/bmad-*`, not as Archon workflow nodes.
- `bun run cli context route --cwd . --json "<runtime objective>"` selected `unknown-help` with low confidence and `requiresDecision: true`.
- Existing Archon workflows already cover planning, implementation, validation, review, ACO orchestration, and PR flows.

Evidence needed before adding `.archon/workflows/archon-bmad-story-to-plan.yaml`:

- A concrete BMAD story/phase artifact path under `_bmad-output`.
- Repeated use where `archon-plan-to-pr`, `archon-ralph-dag`, or `context-orchestrate` is insufficient.
- A stable mapping from BMAD skill input/output to `$ARTIFACTS_DIR`.
- A validation gate that can run without broad product-code side effects.
- A human approval gate for story readiness or phase promotion.

## MCP Policy Decision

Decision: keep MCP user/global only for this patch.

Evidence:

- No `.archon/mcp` directory exists in the repo.
- Workflow validation has one guarded optional notification reference to `.archon/mcp/ntfy.json`.
- The operating guide and security policy already require env vars and approval for write-capable MCP access.

Repo-local MCP templates should be added only when:

- A workflow has an unguarded, validated need for a specific MCP server.
- The template is read-only by default.
- Secrets are environment variable placeholders only.
- Write-capable tools have explicit approval and audit policy.

## Ledger / Run-History Decision

Decision: use the real ACO ledger surface for runtime evidence and create a docs ledger for this patch's source decisions.

Evidence:

- `packages/context-orchestrator/src/ledgers.ts` defines `aco.ledger-bundle.v1`.
- `packages/cli/src/commands/context.ts` exposes `context ledgers`.
- `bun run cli context ledgers --cwd . --json "<runtime objective>"` returned a ledger bundle.
- Generated ledger artifacts under `.archon/artifacts/context-orchestrator/*` are runtime artifacts and must not be committed.

`docs/ai/runtime-enforcement-ledger.md` is a reviewable docs ledger for this patch. It is not a replacement for the ACO runtime ledger.

## DRI Ownership

Decision: document ownership placeholders, do not invent names.

See `docs/ai/dri-ownership.md`.

## README Count Precision

Decision: update README count wording.

Evidence:

- README said Archon ships 17 default workflows.
- Local `bun run cli workflow list --cwd . --json` previously reported 42 workflows in this checkout.
- The repo also distinguishes public defaults from bundled, test, internal, and repo-local workflows.

The README now directs readers to list local workflows for the exact count.
