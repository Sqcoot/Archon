# Goal: Runtime-enforce the STAB-002 AI operating layer

## Objective

Move branch `stabilization/stab-002-bmad-method-current-sync` from "governance sufficient" to "runtime enforcement partially implemented and validated" without destabilizing existing Archon workflows.

The prior commit `60dd4e18a0c6fd8c0f6c98d25f96c2fbfd5840c9` is considered sufficient for the documentation/config/governance operationalization goal. Do not redo that work. Build on it.

Use Archon's existing workflows, commands, validation commands, scripts, and any existing ledger/run-history mechanism in the repo. If "ledger" is not a concrete local feature, do not invent false support; create or update a repo-visible enforcement ledger document and record that no concrete Archon ledger primitive was found.

## Core question

The governance layer is sufficient. The next question is:

Should the repo now enforce the AI operating model mechanically?

Your task is to answer that by implementing the smallest safe runtime-enforcement patch.

## Do not do

- Do not delete existing workflows, commands, scripts, docs, BMAD files, skills, agents, or MCP config.
- Do not run destructive cleanup.
- Do not refresh ACO graph or remove waivers without explicit approval.
- Do not create broad production-write MCP access.
- Do not blindly create BMAD-native workflows if the repo's existing BMAD/Archon mapping does not justify them.
- Do not commit secrets.
- Do not use `git add .`.
- Do not open a PR.
- Do not commit unless explicitly instructed.

## Required preflight

Run or inspect:

```bash
git status --short
git branch --show-current
git log --oneline -5
find docs/ai -maxdepth 3 -type f | sort || true
find .archon -maxdepth 5 -type f | sort || true
find .claude -maxdepth 5 -type f | sort || true
find .agents -maxdepth 5 -type f | sort || true
find _bmad -maxdepth 5 -type f | sort || true
grep -R "ledger" -n .archon docs _bmad .claude .agents package.json 2>/dev/null | head -100 || true
sed -n '1,240p' docs/ai/workflow-compliance-matrix.md
sed -n '1,240p' docs/ai/bmad-to-archon-mapping.md
sed -n '1,240p' docs/ai/stab-002-validation-report.md
sed -n '1,240p' package.json
```

If there are uncommitted user changes, preserve them and record them in the final report.

## Required decision outputs

Create or update:

```txt
docs/ai/runtime-enforcement-decision.md
docs/ai/runtime-enforcement-ledger.md
docs/ai/artifact-schema.md
docs/ai/dri-ownership.md
docs/ai/stab-002-runtime-validation-report.md
```

If the repo already has equivalent files, update them instead of duplicating.

## Required implementation outputs

Implement the smallest safe subset of runtime enforcement.

Prefer these files if they do not already exist:

```txt
.archon/scripts/check-artifact-completeness.ts
.archon/scripts/validate-branch-name.ts
.archon/scripts/check-complete-preconditions.ts
```

Only add package scripts if repo style supports them and they are useful:

```json
{
  "ai:check-artifacts": "bun .archon/scripts/check-artifact-completeness.ts",
  "ai:validate-branch": "bun .archon/scripts/validate-branch-name.ts",
  "ai:check-complete": "bun .archon/scripts/check-complete-preconditions.ts"
}
```

If package scripts are not appropriate, document how to run the scripts directly.

## Runtime enforcement priorities

Implement in this order.

### 1. Artifact schema enforcement

Create `docs/ai/artifact-schema.md`.

It must define required sections for workflow artifacts:

- source request
- workflow run
- scope
- out of scope
- relevant files
- decision or root cause
- implementation plan
- validation commands
- validation result
- risks
- next-node instructions
- failure mode, if any

Create `.archon/scripts/check-artifact-completeness.ts`.

The script should:

- accept file paths or a directory argument
- scan Markdown artifacts
- check for required headings
- print pass/fail output
- exit nonzero on missing required sections
- ignore files clearly not intended as workflow artifacts
- avoid network access
- avoid destructive writes
- include helpful messages

If there is an existing artifact checker, improve it instead of creating a duplicate.

### 2. Branch lifecycle enforcement

Create `.archon/scripts/validate-branch-name.ts`.

The script should:

- detect the current branch by default
- optionally accept a branch name argument
- validate against documented branch patterns
- reject unsafe shell characters
- reject empty names
- reject branch names with spaces or command injection hazards
- print actionable guidance

Create `.archon/scripts/check-complete-preconditions.ts`.

The script should:

- check that the working tree is clean or explain why not
- check the current branch name
- warn if branch appears unmerged when detectable
- never delete anything
- never run cleanup
- print commands the human may run after approval

If existing lifecycle scripts already exist, map to them instead of duplicating.

### 3. BMAD-native workflow decision

Use `docs/ai/bmad-to-archon-mapping.md`, `_bmad`, `.agents/skills/bmad-*`, `.archon/workflows`, and `.archon/commands`.

Decide whether to add a BMAD-native workflow now.

Possible outcomes:

#### Outcome A: add one low-risk BMAD workflow

Only do this if the local repo has enough concrete BMAD assets to support it.

Preferred minimal workflow:

```txt
.archon/workflows/archon-bmad-story-to-plan.yaml
```

It should be read-only or planning-only.

It should:

- inspect BMAD context
- produce an artifact in `$ARTIFACTS_DIR`
- map BMAD story/phase input to an Archon plan
- avoid editing product code
- include deterministic validation where possible
- use existing commands where possible
- validate with local Archon validation

Do not create a PR-producing BMAD workflow yet unless the repo already has strong support.

#### Outcome B: do not add BMAD workflow yet

If not enough evidence exists, do not create a workflow. Instead, document why in:

```txt
docs/ai/runtime-enforcement-decision.md
docs/ai/runtime-enforcement-ledger.md
docs/ai/bmad-to-archon-mapping.md
```

The decision must say what evidence is needed before creating first-class BMAD workflows.

### 4. MCP policy decision

Inspect existing `.archon/mcp`, workflow MCP references, and config.

Decide whether repo-local MCP templates should exist.

Possible outcomes:

#### Outcome A: add safe MCP templates

Only add templates if useful and safe.

Allowed template format:

```txt
.archon/mcp/*.example.json
```

Templates must:

- contain no secrets
- use environment variable placeholders
- be read-only by default
- document approval requirements for write-capable tools

Candidate templates:

```txt
.archon/mcp/github.example.json
.archon/mcp/context7.example.json
.archon/mcp/ntfy.example.json
```

Only add templates justified by existing workflow references or docs.

#### Outcome B: keep MCP user/global only

If repo-local MCP would be premature, document that decision and explain which MCPs remain user/global.

### 5. Ledger/run-history decision

Search for a real local Archon ledger or run-history mechanism.

If found:

- document how to use it
- add a runtime-enforcement entry if safe
- do not corrupt or fabricate run history

If not found:

- create `docs/ai/runtime-enforcement-ledger.md`
- use it as a human-readable ledger for decisions, validations, and remaining gaps
- state clearly that this is a docs ledger, not a hidden Archon runtime ledger

The ledger must include:

- date
- branch
- commit being built on
- decision
- files changed
- validation commands
- pass/fail status
- remaining gaps
- approval-sensitive items

### 6. DRI ownership

Create `docs/ai/dri-ownership.md`.

Include:

```txt
AI operating layer DRI: TBD
Backup: TBD
Validation report owner: TBD
BMAD mapping owner: TBD
MCP/config approval owner: TBD
ACO graph/waiver approval owner: TBD
Review cadence: quarterly or after major model/tool releases
```

Do not invent names. Use `TBD` unless the repo already declares owners.

Link this file from:

```txt
docs/ai/README.md
docs/ai/source-traceability.md
docs/ai/runtime-enforcement-decision.md
```

### 7. README/count precision

Inspect README workflow count language.

If README says a fixed number of workflows that conflicts with validation output, clarify wording without overhauling the README.

Preferred wording:

```md
Archon ships a curated set of public default workflows. Local development checkouts may load additional bundled, test, internal, or repo-local workflows; use `bun run cli workflow list --cwd .` for the exact current count.
```

Only edit if there is actual count drift.

## Required validation

Run or attempt:

```bash
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

Also run new scripts if added, for example:

```bash
bun .archon/scripts/check-artifact-completeness.ts docs/ai
bun .archon/scripts/validate-branch-name.ts
bun .archon/scripts/check-complete-preconditions.ts
```

If package scripts were added, run those instead or in addition.

If a command fails, do not hide it. Capture:

- command
- result
- output excerpt
- failure classification
- follow-up action

## Optional runtime smoke test

If safe and supported, run one no-edit or read-only workflow smoke test.

Candidate:

```bash
bun run cli workflow run archon-assist --no-worktree "Read docs/ai/README.md and summarize it without editing files."
```

Only run if it will not create unwanted side effects. If not run, document why.

Do not run PR-producing workflows without explicit approval.

## Required doc updates

Update these files as needed:

```txt
docs/ai/README.md
docs/ai/workflow-compliance-matrix.md
docs/ai/bmad-to-archon-mapping.md
docs/ai/source-traceability.md
docs/ai/workflow-validation.md
docs/ai/worktree-and-branch-lifecycle.md
docs/ai/security-and-secrets.md
docs/ai/stab-002-validation-report.md
```

Do not rewrite them wholesale. Add targeted runtime-enforcement sections and links.

## Required validation report

Create `docs/ai/stab-002-runtime-validation-report.md`.

It must include:

### Scope

State this validates the runtime-enforcement follow-up after commit `60dd4e18`.

### Environment

Capture:

```bash
date
git branch --show-current
git rev-parse HEAD
git status --short
```

### Commands attempted

List every command run.

### Results

For each command:

- pass/fail/skipped
- output excerpt
- classification
- next action

### New enforcement assets

List added scripts, docs, workflows, MCP templates, or package scripts.

### BMAD decision

State whether BMAD remains mapped/advisory or now has a native workflow.

### MCP decision

State whether MCP remains user/global or now has repo-local templates.

### Ledger decision

State whether a real Archon ledger was found or a docs ledger was created.

### Runtime smoke test

State whether it ran, result, and artifact/log output if available.

### Acceptance checklist

Use pass/partial/fail:

```txt
- Artifact schema documented.
- Artifact schema mechanically checkable.
- Branch naming mechanically checkable.
- Complete/cleanup preconditions mechanically checkable.
- BMAD-native workflow decision recorded.
- MCP repo-local vs user/global decision recorded.
- Ledger/run-history decision recorded.
- DRI ownership documented.
- README count drift checked.
- Compliance matrix updated.
- BMAD mapping updated.
- Workflow validation passed or failures documented.
- Command validation passed or failures documented.
- Repo validation passed or failures documented.
- New scripts validated or failures documented.
- Runtime smoke test run or explicitly skipped with reason.
```

### Sufficiency verdict

Use one of:

- `Sufficient for runtime-enforcement v1`
- `Partially sufficient for runtime-enforcement v1`
- `Not sufficient for runtime-enforcement v1`

Do not say "Sufficient" unless:

- the new enforcement assets exist or are explicitly ruled out with evidence
- validation was attempted
- failures are documented
- no critical validation blocker remains
- no destructive/approval-sensitive action was taken without approval

## Final response required

When done, report:

1. Files added
2. Files edited
3. Enforcement mechanisms added
4. BMAD decision
5. MCP decision
6. Ledger decision
7. Validation commands run
8. Failures or skipped commands
9. Remaining gaps
10. Sufficiency verdict

## Completion condition

Complete the goal only when:

- runtime-enforcement decisions are documented
- at least one concrete enforcement mechanism is implemented or explicitly deferred with evidence
- validation has been attempted
- the runtime validation report is complete
- final response gives a clear sufficiency verdict

Do not declare completion merely because more prose was added.
