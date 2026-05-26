---
description: Improve Archon itself in explicit repo-local meta mode with one slice per commit
argument-hint: "[specific self-improvement goal | empty to use .archon/self-improvement/default-goal.md]"
---

# Archon Self-Improvement Mode

**Input**: $ARGUMENTS
**Workflow ID**: $WORKFLOW_ID

---

## Mode Boundary

This command is for Archon meta-work only. Use it when the user explicitly asks
to improve Archon itself, improve Archon workflows, commands, or ACO, repair
Archon, or improve this self-improvement loop.

Do not use this command for ordinary Archon usage in another repository, such as
fixing that repository's bug, implementing its feature, reviewing its PR, or
answering normal coding questions. For non-meta work, route to the ordinary
Archon workflow or command that matches the user's task.

## Goal Source

Before writing anything, verify the current checkout is the Archon source repo.
Expected markers:

```bash
test -f package.json
test -d packages/cli
test -d packages/workflows
test -d packages/aco-core
test -f .archon/self-improvement/default-goal.md
```

If these markers are absent, stop with a clear message: self-improvement must
run from the Archon source checkout, not from an ordinary project using Archon.

If `$ARGUMENTS` is non-empty, treat it as the specific self-improvement goal for
this run. If `$ARGUMENTS` is empty, read the repo-local default goal from:

```bash
.archon/self-improvement/default-goal.md
```

Maintain a compact mutable current-goal handoff at:

```bash
.archon/state/self-improvement/current_goal_4000chars.txt
```

The state path is intentionally ignored. It may be updated during runs, but it
must not be committed.

## Artifact Discipline

Write run artifacts under `$ARTIFACTS_DIR`. Use `.archon/artifacts/` only for
repo-local handoff bundles that should be visible to later local Archon sessions.
Do not scatter meta notes into product docs unless the selected slice is a docs
change.

Recommended artifact names:

- `$ARTIFACTS_DIR/self-improve-goal.md`
- `$ARTIFACTS_DIR/scope-contract.md`
- `$ARTIFACTS_DIR/slice-plan.md`
- `$ARTIFACTS_DIR/decision-log.md`
- `$ARTIFACTS_DIR/cleanup-opportunities.md`
- `$ARTIFACTS_DIR/validation.md`
- `$ARTIFACTS_DIR/handoff.md`
- `$ARTIFACTS_DIR/candidate-ranking.md`
- `$ARTIFACTS_DIR/next_goal_4000chars.txt`

## Product and Self-Editing Surface

Archon self-improvement may edit Archon product surfaces when they are part of
the selected slice:

- Default and repo-local workflows under `.archon/workflows/`
- Default and repo-local commands under `.archon/commands/`
- ACO packages, contracts, gates, renderers, fixtures, workflows, CLI routes,
  server routes, docs, and tests
- Workflow engine, provider, CLI, server, docs, tests, and generated defaults
  needed to prove the selected slice

The self-improvement loop may also edit itself when that is the selected slice:

- `.archon/self-improvement/default-goal.md`
- `.archon/commands/defaults/archon-self-improve.md`
- `.archon/workflows/defaults/archon-self-improve.yaml`
- Generated bundled defaults required by those files
- Focused tests or docs needed to validate the selected change

Preserve the explicit meta-mode boundary. Never make the self-improvement goal a
global instruction that affects normal Archon use outside this repository.

## Operating Loop

1. Confirm this is Archon meta-work. If it is normal project work, stop and
   redirect to the appropriate non-meta workflow.
2. Load the specific goal from `$ARGUMENTS` or the default goal document.
3. Read the mutable current goal if it exists, then reconcile it with the loaded
   goal. The specific user goal wins over the mutable default.
4. Inspect the current repo state with `git status --short` and recent commits.
5. Select one coherent slice that can be implemented, validated, and committed.
   Explicitly classify the slice as Add, Remove, Consolidate, Stabilize, or
   Clarify. Related tests, generated files, docs, and handoff updates belong to
   the same slice when they are necessary for completion.
6. Use Archon commands, workflows, BMAD skills, source-command handoffs, focused
   tests, and code review as appropriate for that slice.
7. Implement only the selected slice.
8. Validate with the narrowest checks that prove the slice, then broaden when the
   touched surface is shared.
9. Regenerate bundled defaults when default commands or workflows changed:

   ```bash
   bun run generate:bundled
   ```

10. Stage only intentional tracked files and commit the slice.
11. Write a handoff and next-run candidate list capped near 4000 characters.
12. Update the ignored current-goal file with the top candidate plus the
    instruction to re-rank from fresh evidence at the start of the next run.

## Subtractive and Triage Discipline

Do not assume improvement means adding more. At slice selection time, actively
look for evidence that the best move is to remove, narrow, consolidate, or
stabilize existing material:

- stale workflow or command defaults
- duplicated prompts, schemas, tests, or generated artifacts
- ACO contracts or fixtures that no longer prove useful behavior
- noisy validation paths that obscure the selected target
- controls that look enforced but are not wired to runtime behavior

If removal wins the ranking, be direct: delete the bad surface, update callers or
tests, validate the absence of the old behavior, and commit that smaller system.
If addition wins, justify why cleanup was not the better slice.

## Next-Run Recommendation Discipline

Do not let the just-completed slice pollute the next recommendation. The next
run should not automatically continue nearby work unless that work is still one
of the best slices after a fresh ranking.

At the end of every run:

1. Generate 3-5 candidate next slices from current evidence:
   - user-stated priorities
   - failing or blocked validations
   - open handoffs and artifacts
   - stale or removable workflow, command, or ACO surfaces
   - workflow behavior that risks infinite, degrading, or ambiguous runs
   - product impact and ease of validation
2. Rank candidates by expected value, unblock power, risk reduction, and
   validation clarity.
3. Perform a Recency Bias Check for the top candidate:
   "Would this still be top-ranked if the previous slice had touched a different
   part of Archon?"
4. If the answer is no, demote it and choose the best evidence-backed
   candidate instead.
5. Write the top candidate and the short ranked list to
   `$ARTIFACTS_DIR/next_goal_4000chars.txt`, preserving the instruction to
   re-rank on the next run.

## Preferred Validation

Use the checks that match the slice:

```bash
bun run cli validate commands archon-self-improve
bun run cli validate workflows archon-self-improve
bun run check:bundled
bun test packages/workflows/src/defaults/bundled-defaults.test.ts
```

For ACO slices, prefer the narrow package checks first, for example:

```bash
bun --filter @archon/aco-core test
bun --filter @archon/aco-workflows test
bun run cli aco --help
```

For broader workflow, ACO, CLI, or provider changes, add:

```bash
bun run type-check
bun test packages/workflows/src/validator.test.ts
bun test packages/workflows/src/loader.test.ts
```

## BMAD and Handoff Usage

Use BMAD skills when they fit the selected slice:

- `bmad-investigate` for unclear failures or infinite loops.
- `bmad-correct-course` when the current direction conflicts with the goal.
- `bmad-quick-dev` or `bmad-dev-story` for implementation slices.
- `bmad-code-review` for adversarial review before commit.
- `bmad-checkpoint-preview` or source-command handoff for resumable artifacts.

Use source-command handoffs for long-running, interrupted, or multi-session work.
The handoff must say what was committed, what remains, how to validate, and what
the next slice should be.

## Completion Output

End with:

- Selected slice
- Commit hash, or the exact reason no commit was made
- Validation run and result
- Artifact and handoff paths
- Ranked next-run candidates with the Recency Bias Check result
