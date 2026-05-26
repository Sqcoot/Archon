# Archon Self-Improvement Default Goal

This document is the repo-local default goal for Archon self-improvement mode.
It applies only when the user explicitly asks to improve Archon itself, improve
the self-improvement loop, or run the `archon-self-improve` command/workflow. It
is not global guidance for ordinary Archon usage in other repositories.

## Standing Goal

Continuously improve Archon as a product and engineering system through small,
validated, committed slices. This includes Archon workflows, commands, ACO
packages/contracts/workflows, provider behavior, CLI/server surfaces, docs,
tests, and generated defaults when they are part of the selected slice. Prefer
changes that make Archon more reliable, more inspectable, easier to recover,
easier to route, and less likely to create unbounded or ambiguous agent runs.

## Improvement Direction

Self-improvement is not biased toward adding new surfaces. Every run must weigh
addition, removal, consolidation, simplification, stabilization, documentation,
and test hardening as equally valid improvement directions. Bad, obsolete,
duplicative, noisy, misleading, or low-leverage code and workflow material
should be removed or narrowed when evidence supports it.

Treat each line as carrying cost. Keep what is load-bearing, delete what is
not, and prefer deterministic behavior with explicit flexibility over prompt
sprawl or vague agent discretion.

## Capability and Research Awareness

Before selecting a slice, self-improvement must know the tools, workflows,
commands, gates, ledgers, research surfaces, providers, and runtime constraints
available in the current Archon source checkout. Use the ACO ledgers and
reference fixtures as the local source of truth when they exist:

- `tests/fixtures/aco/ledgers/artifact-ledger.csv`
- `tests/fixtures/aco/ledgers/tool-availability-ledger.csv`
- `tests/fixtures/aco/ledgers/capability-inventory.csv`
- `tests/fixtures/aco/ledgers/command-ledger.csv`
- `tests/fixtures/aco/reference-surface-plan.json`

Treat Archon workflows, Archon commands, bash, scripts, BMAD skills, Agentic
Search artifacts, Graphify/graph-waiver evidence, role contracts, gates,
subagent or party-mode capabilities, provider/runtime metadata, and model
reasoning controls as selectable capabilities, not background trivia. Record
which capabilities were considered, chosen, deferred, or unsafe for the slice.

When the selected slice depends on current external practice, retrieve current
evidence with the appropriate research surface before implementing:

- Use repo-local evidence first when the question is about Archon behavior.
- Use Context7 or official docs for library, SDK, API, CLI, or cloud-service
  behavior when the repo instructions require it.
- Use Agentic Search or web research for broader product, research, or
  best-practice questions, and write the sources into an artifact.
- Do not run graph refreshes, network-heavy research, or graph-cache writes
  implicitly. Use existing graph-waiver/readiness artifacts unless the user
  explicitly approves the mutating or networked research step.

## Non-Pollution Boundary

- Do not load or apply this goal for ordinary repo assistance, bug fixes in
  another project, PR review, issue implementation, or non-meta Archon usage.
- Keep mutable self-improvement state under `.archon/state/self-improvement/`.
  That path is ignored and belongs to the local checkout.
- Keep run artifacts, handoffs, dossiers, and zip bundles under
  `$ARTIFACTS_DIR` or `.archon/artifacts/`.
- Commit only intentional source, default command, workflow, docs, test, or
  generated-bundle changes that are part of the current slice.

## Slice Contract

Every self-improvement pass chooses exactly one coherent slice unless the user
explicitly asks for more. A slice may add, remove, simplify, consolidate,
stabilize, document, or test Archon behavior. Related tests, docs, generated
defaults, validation fixes, and handoff updates belong to the same slice when
they are necessary for completion.

Before implementing, state the selected mutation direction:

- Add: introduce missing capability or coverage.
- Remove: delete dead, misleading, duplicated, or harmful surface.
- Consolidate: merge overlapping behavior into one clearer source of truth.
- Stabilize: make existing behavior more deterministic and recoverable.
- Clarify: improve names, docs, contracts, or handoffs without changing runtime
  behavior.

Each slice must end with:

1. A clear artifact or note describing what changed and what remains.
2. Focused validation appropriate to the touched surface.
3. A capability and evidence note for the selected slice.
4. A git commit for successful tracked changes.
5. A fresh ranked set of next-slice candidates, not a continuation chosen only
   because it was adjacent to the just-finished work.

## Next-Slice Selection

After each slice, produce 3-5 candidate next slices from current evidence:
repo status, failing validations, user-stated priorities, open handoffs, risky
workflow behavior, and product impact. Rank them by expected value, unblock
power, risk reduction, and validation clarity.

Do not let the just-finished slice dominate the next recommendation. A nearby
follow-up is valid only when it still ranks highly after asking: "Would this be
one of the best next slices if the previous run had touched a different area?"
If the answer is no, list it as context instead of making it the default next
goal.

The compact current goal may carry the top-ranked candidate and a short
candidate list, but it must preserve the instruction to re-rank from fresh
evidence at the start of the next run.

## Self-Editing Rule

The self-improvement system may edit this file, `archon-self-improve`, and the
`archon-self-improve` workflow when the selected slice is about improving the
self-improvement loop itself. Those edits must be treated like product changes:
inspect current behavior, preserve the non-pollution boundary, validate, and
commit.

## Default Backlog

- Make self-improvement entry points obvious, explicit, and easy to resume.
- Improve artifact and handoff quality so interrupted sessions can recover.
- Make capability, runtime, and best-practice evidence explicit before slice
  selection.
- Tighten workflow and command contracts that cause infinite or degrading runs.
- Improve, simplify, or remove ACO contracts, packages, workflows, commands,
  fixtures, and validation paths when evidence shows they are useful targets.
- Triage stale, duplicated, misleading, or low-leverage workflow/command/ACO
  surfaces instead of defaulting to net-new additions.
- Prefer one-slice-per-commit loops with current goal summaries capped near
  4000 characters for handoffs.
- Use Archon workflows, commands, BMAD skills, and source-command handoffs when
  they fit the slice, but keep the chosen slice concrete and committable.
