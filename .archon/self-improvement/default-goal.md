# Archon Self-Improvement Default Goal

This document is the repo-local default goal for Archon self-improvement mode.
It applies only when the user explicitly asks to improve Archon itself, improve
the self-improvement loop, or run the `archon-self-improve` command/workflow. It
is not global guidance for ordinary Archon usage in other repositories.

## Standing Goal

Continuously improve Archon as a product and engineering system through small,
validated, committed slices. Prefer changes that make Archon more reliable,
more inspectable, easier to recover, easier to route, and less likely to create
unbounded or ambiguous agent runs.

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
explicitly asks for more. A slice may include related tests, docs, generated
defaults, validation fixes, and handoff updates needed to make that slice
complete.

Each slice must end with:

1. A clear artifact or note describing what changed and what remains.
2. Focused validation appropriate to the touched surface.
3. A git commit for successful tracked changes.
4. A fresh ranked set of next-slice candidates, not a continuation chosen only
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
- Tighten workflow and command contracts that cause infinite or degrading runs.
- Prefer one-slice-per-commit loops with current goal summaries capped near
  4000 characters for handoffs.
- Use Archon workflows, commands, BMAD skills, and source-command handoffs when
  they fit the slice, but keep the chosen slice concrete and committable.
