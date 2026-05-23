# ACO Completion Preconditions Gate

`bun run aco:completion-preconditions --json` checks whether a branch is safe to hand off to final validation, push, PR, or completion flow.

The gate reports the ACO coordination states `ready`, `blocked`, `needs_decision`, and `unknown`. It blocks detached checkouts, unsafe branch names, and dirty worktrees. It returns `needs_decision` when the branch is behind its upstream, because the agent must choose an explicit update or merge strategy before claiming completion. Missing upstream and ahead-of-upstream status are warnings because they may be expected before the branch has been pushed.

This gate is intentionally not part of `bun run validate`: active development normally has a dirty worktree, so wiring it into normal validation would create false failures. Run it near the end of a stabilization pass after changes are committed.
