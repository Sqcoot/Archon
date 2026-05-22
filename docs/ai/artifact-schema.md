<!-- archon-workflow-artifact: false -->

# Workflow Artifact Schema

Workflow artifacts are the durable handoff records passed between humans, agents, workflow nodes, and validation/reporting steps. Runtime artifacts normally live in `$ARTIFACTS_DIR`; reviewable policy reports may live under `docs/ai` when they are intentionally committed.

Use this schema for Markdown artifacts that claim to be an Archon workflow handoff, plan, validation, review, or completion artifact.

## Required Sections

| Section | Purpose | Notes |
| --- | --- | --- |
| Source Request | Original user request or normalized workflow input. | Include enough context to route the task without conversation memory. |
| Workflow Run | Workflow name, run ID when available, branch, worktree, and timestamp. | Use `unknown` only when the value cannot be discovered. |
| Scope | What this artifact covers. | Keep this concrete. |
| Out of Scope | What this artifact explicitly does not cover. | Prevents downstream scope creep. |
| Relevant Files | Paths read, changed, or expected to be changed. | Use repo-relative paths in artifacts. |
| Decision or Root Cause | Main decision, diagnosis, or reason for the plan. | Use `Root Cause` for bug artifacts when clearer. |
| Implementation Plan | Ordered implementation or follow-up plan. | Include owner/node handoff when useful. |
| Validation Commands | Commands to run or already run. | Use exact commands, not summaries. |
| Validation Result | Pass/fail/skipped result and key output. | Do not claim success without output. |
| Risks | Known risks, residual uncertainty, or blast radius. | Include security and lifecycle risks. |
| Next-Node Instructions | What the next workflow node or human should do. | Should be actionable without hidden context. |
| Failure Mode | Failure mode if applicable, or `None observed`. | Required even when no failure occurred. |

## Marker

Artifacts outside `.archon/artifacts/` should include one of these markers so `.archon/scripts/check-artifact-completeness.ts` can detect them deliberately:

```md
<!-- archon-workflow-artifact -->
```

or:

```yaml
workflow-artifact: true
```

Non-artifact docs that discuss this schema may opt out:

```md
<!-- archon-workflow-artifact: false -->
```

## Template

```md
<!-- archon-workflow-artifact -->

# <Artifact Title>

## Source Request

## Workflow Run

## Scope

## Out of Scope

## Relevant Files

## Decision or Root Cause

## Implementation Plan

## Validation Commands

## Validation Result

## Risks

## Next-Node Instructions

## Failure Mode
```

## Mechanical Check

Run:

```bash
bun .archon/scripts/check-artifact-completeness.ts <artifact-file-or-directory>
```

The script is read-only. It recursively scans Markdown files, treats direct file arguments and `.archon/artifacts/**/*.md` as artifact candidates, respects explicit markers, and exits nonzero when required headings are missing.
