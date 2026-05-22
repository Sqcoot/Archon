# Workflow Validation

Use scoped validation first, then escalate when root instructions, workflows, commands, generated defaults, provider boundaries, SDD/ATDD artifacts, TypeScript config, or shared packages changed.

## Workflow asset validation

Preferred commands from local CLI help:

```bash
bun run cli workflow list --cwd .
bun run cli validate workflows --cwd .
bun run cli validate commands --cwd .
```

The installed source supports `bun run cli ...` as the local substitute for a globally linked `archon` binary. If a global `archon` binary is available, these are equivalent operating checks:

```bash
archon workflow list --cwd .
archon validate workflows --cwd .
archon validate commands --cwd .
```

If syntax differs, run:

```bash
bun run cli --help
bun run cli workflow --help
bun run cli validate --help
```

Record substitutions in the validation report.

## Repo validation

Package scripts present in this repo:

```bash
bun run check:bundled
bun run check:bundled-skill
bun run type-check
bun run lint --max-warnings 0
bun run format:check
bun run test
bun run validate
bun run aco:traceability
bun run validate:ts-navigation
bun run aco:test:acceptance
```

Do not run root `bun test` directly. Use `bun run test` or explicit package/test-file commands.

For docs-only operationalization, the narrow checks are:

```bash
bun run cli validate workflows --cwd .
bun run cli validate commands --cwd .
bun run check:bundled
bun run check:bundled-skill
bun run aco:traceability
bun run format:check
```

Escalate to:

```bash
bun run validate
```

because root entry points and operating docs changed.

## Runtime validation

Validate these behaviors when a workflow changes or a new workflow is added:

- Workflow loads.
- Command files load.
- Named scripts resolve.
- DAG dependencies are acyclic and reference existing node IDs.
- Each node has exactly one node type.
- `when` expressions match actual output types.
- Approval nodes pause and can be approved or rejected.
- Rejection handling writes the expected rework output.
- Loop nodes have bounded `max_iterations`.
- Loop exits are deterministic when `until_bash` is used.
- Resume uses correct failed run state.
- Abandon releases stuck runs.
- Complete runs only after merge or approved discard.
- Cleanup targets only stale/merged worktrees.
- Artifacts are written to `$ARTIFACTS_DIR`.
- Run history records status, events, and summary.
- Worktree isolation creates or reuses the expected branch.

## Evidence standard

Every validation report should include:

- Command
- Timestamp
- Result
- Exit code when available
- Output excerpt
- Failure classification
- Follow-up action

Do not claim validation passed from memory or prompt output. Cite actual command output.

## Config intent

The current `.archon/config.yaml` is intentionally minimal:

```yaml
worktree:
  baseBranch: dev

docs:
  path: packages/docs-web/src/content/docs
```

Other defaults are inherited from global/bundled config or intentionally omitted until support and need are verified locally. Secrets are not configured in YAML.
