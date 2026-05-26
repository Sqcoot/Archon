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
to improve Archon itself, improve Archon workflows or commands, repair Archon,
or improve this self-improvement loop.

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
- `$ARTIFACTS_DIR/slice-plan.md`
- `$ARTIFACTS_DIR/validation.md`
- `$ARTIFACTS_DIR/handoff.md`
- `$ARTIFACTS_DIR/next_goal_4000chars.txt`

## Allowed Self-Editing Surface

The self-improvement loop may edit itself when that is the selected slice:

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
   Related tests, generated files, docs, and handoff updates belong to the same
   slice when they are necessary for completion.
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
11. Write a handoff and next goal capped near 4000 characters. Update the ignored
    current-goal file from that next goal.

## Preferred Validation

Use the checks that match the slice:

```bash
bun run cli validate commands archon-self-improve
bun run cli validate workflows archon-self-improve
bun run check:bundled
bun test packages/workflows/src/defaults/bundled-defaults.test.ts
```

For broader workflow, CLI, or provider changes, add:

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
- Next recommended self-improvement goal
