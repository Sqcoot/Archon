---
description: Run a read-only POC solidification review using tool and command ledgers
argument-hint: "<POC solidification goal>"
---

# Solidify POC

Run a read-only brownfield stabilization review for:

```text
$ARGUMENTS
```

The user accepts the current technology choices. Do not propose new features,
framework swaps, runtime rewrites, or implementation work unless the finding is
needed to close a named blocker.

## Hard Rules

- Do not edit files.
- Do not use `apply_patch`, shell redirection, or editor write tools.
- Do not generate artifacts unless the user explicitly approves it first.
- Do not run `archon context compile` unless the user explicitly approves artifact writes.
- Do not install dependencies.
- Do not run migrations.
- Do not run code generation.
- Do not run formatters or linters in write mode, including `bun run format` or `bun run lint:fix`.
- Do not stage, commit, push, or open a PR.
- Mark unknowns as `unknown`, `blocked`, or `partial`; do not invent tool availability.

## Read-Only Discovery Sequence

Run only commands that do not intentionally write tracked files or artifacts.

Recommended starting commands:

```bash
git status --short --untracked-files=all
archon context route --cwd . "$ARGUMENTS"
archon context status --cwd .
archon context ledgers --cwd . --json
```

If `archon` is unavailable, mark Archon ACO as `blocked` and record the fallback.
If ACO status is `failed`, graph evidence is partial or forbidden, or waivers
exist, record that as a confidence limit instead of treating the review as
green.

## Tool Availability Ledger

Create this table before making hardening recommendations. Prefer the
code-level ACO ledger bundle from `archon context ledgers --cwd . --json` when
available; otherwise create the table manually.

| Tool / Capability | Source | Invocation Path | Scope | Status | Preconditions | Verification Check | Primary Use | Failure Mode | Fallback | Owner | Last Verified | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

Use only these status values:

- `available`
- `partial`
- `blocked`
- `deferred`
- `forbidden`
- `not used`
- `unknown`

`Last Verified` must be `YYYY-MM-DD`, or `unknown` if not checked during this run.
Every row must cite a source: a file path, command output, tool result, or
explicit `unknown`.

## Commands Ledger

Create this table before running validation gates. Prefer the code-level ACO
ledger bundle from `archon context ledgers --cwd . --json` when available;
otherwise create the table manually.

| Command | File / Location | Invocation | Purpose | Inputs | Outputs | Preconditions | Related Tool | Status | Validation Check | Failure Mode | Owner | Last Verified | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

Mark commands that write tracked files or artifacts as `forbidden` or
approval-required in this read-only review. Examples include:

- `archon context compile`
- `bun run research:graph`
- `bun run aco:research`
- `bun run format`
- `bun run lint:fix`
- code generation
- migrations
- git staging and commits

Command safety classifications are advisory evidence. They do not grant
permission to run a command.

## Review Output

Return these sections:

1. Final status: `Blocked`, `Partial`, or `Ready`
2. Tool Availability Ledger
3. Commands Ledger
4. Validation and waiver summary
5. Architecture hardening findings
6. Required changes before implementation, if any
7. Evidence limits and unresolved unknowns

Use `Ready` only when required tools are available, required validations pass,
and graph/docs waivers do not block readiness. Use `Partial` when useful
evidence exists but waivers, missing prerequisites, stale data, or partial graph
coverage limit confidence. Use `Blocked` when required tools or evidence are not
available. Use `Forbidden` when failed waiver-required graph evidence or unsafe
command evidence blocks readiness claims.
