# Worktree and Branch Lifecycle

## Policy

Use isolated worktrees for non-trivial implementation, refactor, validation, or PR-producing workflows. Use the live checkout only for read-only inspection, small docs-only edits, or workflows that explicitly pin `worktree.enabled: false`.

This repo sets:

```yaml
worktree:
  baseBranch: dev
```

That means stabilization work should not assume `main` or `dev` without checking current branch and task context.

## When to use isolated worktrees

Use a worktree when a workflow may:

- Edit tracked files.
- Run for a long time.
- Create commits, branches, or PRs.
- Start services or E2E tests.
- Touch workflows, commands, generated defaults, provider boundaries, or shared packages.
- Need resume/abandon/complete lifecycle records.

Typical invocation:

```bash
bun run cli workflow run archon-plan-to-pr --branch codex/task-operating-layer "Implement the approved plan"
```

## When `--no-worktree` is acceptable

`--no-worktree` is acceptable only when:

- The workflow is read-only.
- The requested change is a small live-checkout edit and the user expects it here.
- The workflow itself pins `worktree.enabled: false`, such as `archon-assist`.
- You have checked `git status --short` and can avoid overwriting user changes.

Record this choice in the validation report when it matters.

## Branch naming

Use predictable names:

- `codex/task/<slug>`
- `codex/fix/<issue-number>-<slug>`
- `codex/refactor/<area>-<slug>`
- `codex/review/<pr-number>`
- `codex/workflow/<workflow-name>-<slug>`

Validate branch names before passing them to shell commands. Treat branch names, issue titles, PR titles, artifact content, and user strings as untrusted shell input.

## Handling uncommitted work

Before starting a workflow or editing files:

```bash
git status --short
```

If unrelated user changes exist:

- Do not revert them.
- Do not stage them.
- Work around them when possible.
- If they affect the same file, inspect and preserve them.
- If they make the task impossible, stop and ask.

Avoid blind `git add .`, `git add -A`, and `git add -u`. Stage intended files by name only when staging is explicitly requested.

## Handling conflicts

Use:

```bash
bun run cli workflow run archon-resolve-conflicts --branch codex/resolve/<slug> "Resolve conflicts for PR ..."
```

Review conflict resolutions before pushing. Do not assume an automatic merge preserved intent.

## Resume policy

Use resume only after inspecting run status and confirming the prior run is the right one:

```bash
bun run cli workflow status --cwd .
bun run cli workflow run <workflow-name> --resume --cwd .
```

If the failed state is stale or the workspace changed substantially, start a new isolated run instead.

## Abandon policy

Use abandon for stuck, unwanted, or superseded runs:

```bash
bun run cli workflow abandon <run-id> --cwd .
```

Abandon does not mean discard useful artifacts. Inspect handoff, validation, and logs first when possible.

## Complete policy

Use complete only after merge or approved discard:

```bash
bun run cli complete <branch>
```

This is a branch lifecycle action. Verify the branch, PR state, and worktree before running it.

## Cleanup policy

Cleanup commands can remove worktrees. They require explicit approval when the target is not obvious:

```bash
bun run cli isolation cleanup 7
bun run cli isolation cleanup --merged
```

Never run destructive cleanup to "make things tidy" during investigation.

## Worktree copy files

Use `worktree.copyFiles` only for required gitignored files that are safe to copy into isolated worktrees. Do not copy secrets unless the workflow truly needs them and policy allows it.

Do not list `.archon/` in `worktree.copyFiles`; Archon-managed project assets are already part of the repository/workflow context.

## Server/Web UI caveat

Server and Web UI execution may require workflow, command, and script assets to be committed and pushed before the server sees them. Local uncommitted workflow edits can validate locally but still be invisible to a remote runner.

## Safety rule

No destructive cleanup, branch deletion, force push, graph refresh, waiver cleanup, or runtime artifact removal should run without explicit approval and a clear target.
