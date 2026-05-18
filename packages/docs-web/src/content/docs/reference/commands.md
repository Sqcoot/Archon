---
title: Commands Reference
description: All slash commands available in Archon adapters including Web UI, Telegram, Slack, Discord, and GitHub.
category: reference
area: handlers
audience: [user]
status: current
sidebar:
  order: 4
---

All slash commands available in Archon. Type `/help` in any platform adapter (Web UI, Telegram, Slack, Discord, GitHub) to see this list.

---

## Deterministic Commands

These commands are handled deterministically by the orchestrator — they always execute the same way regardless of AI state:

## Project Management

| Command | Description |
|---------|-------------|
| `/register-project <path>` | Register a local directory as a project |
| `/update-project <name> <path>` | Update a project's directory path |
| `/remove-project <name>` | Remove a project registration |

## Workflows

| Command | Description |
|---------|-------------|
| `/workflow list` | Show available workflows |
| `/workflow reload` | Reload workflow definitions |
| `/workflow status` | Show active workflows |
| `/workflow cancel` | Cancel running workflow |
| `/workflow resume <id>` | Resume a failed run (re-runs, skipping completed nodes) |
| `/workflow abandon <id>` | Discard a non-terminal run |
| `/workflow approve <id> [comment]` | Approve a paused workflow run at an approval gate |
| `/workflow reject <id> [reason]` | Reject a paused workflow run at an approval gate |
| `/workflow run <name> [args]` | Run a workflow directly |
| `/workflow cleanup [days]` | CLI only -- delete old run records (default: 7 days) |

> **Note:** Workflows are YAML files in `.archon/workflows/`

## Session Management

| Command | Description |
|---------|-------------|
| `/status` | Show conversation state |
| `/reset` | Clear session completely |
| `/help` | Show all commands |

---

## AI-Routed Commands

The following commands exist in the command handler but are **not** deterministically routed. Instead, they are routed through the AI orchestrator, which decides whether to invoke them based on context. They work when the AI routes a message to them:

| Command | Description |
|---------|-------------|
| `/clone <repo-url>` | Clone repository |
| `/repos` | List repositories (numbered) |
| `/repo <#\|name> [pull]` | Switch repo (auto-loads commands) |
| `/repo-remove <#\|name>` | Remove repo and codebase record |
| `/getcwd` | Show working directory |
| `/setcwd <path>` | Set working directory |
| `/command-set <name> <path> [text]` | Register a command from file |
| `/load-commands <folder>` | Bulk load commands (recursive) |
| `/commands` | List registered commands |
| `/worktree create <branch>` | Create isolated worktree |
| `/worktree list` | Show worktrees for this repo |
| `/worktree remove [--force]` | Remove current worktree |
| `/worktree cleanup merged\|stale` | Clean up worktrees |
| `/worktree orphans` | Show all worktrees from git |
| `/init` | Create `.archon` structure in current repo |
| `/reset-context` | Reset AI context, keep worktree |

> **Note:** In practice, you rarely need to type these commands directly. Describe what you want in natural language and the AI router will invoke the appropriate command or workflow.

---

## Read-Only Solidification Review

Use `solidify-poc` when the current technology choices are accepted and the goal is to make an existing POC more reliable, observable, repeatable, or easier to operate without adding features.

This is a prompt command, not an implementation workflow. It must produce evidence-backed ledgers before recommending any hardening work.

| Command | Description |
|---------|-------------|
| `solidify-poc "<goal>"` | Runs a read-only POC stabilization review using a Tool Availability Ledger and Commands Ledger |
| `archon context status --cwd . --json` | Emits graph status, named graph waiver IDs, validation status, and ledger summary |
| `archon context ledgers --cwd .` | Renders ACO Tool Availability and Commands ledgers without archive writes |
| `archon context ledgers --cwd . --json` | Emits the combined `aco.ledger-bundle.v1` JSON bundle |

### Inputs

| Input | Description |
|-------|-------------|
| POC goal | The stabilization goal or concern to review |
| Current working directory | The repository or project being reviewed |
| Accepted technology constraint | The assumption that current technology choices should be assessed, not replaced |

### Outputs

| Output | Description |
|--------|-------------|
| Tool Availability Ledger | Tool inventory with source, invocation path, status, preconditions, verification check, failure mode, fallback, owner, and last-verified date |
| Commands Ledger | Command inventory with location, invocation, purpose, inputs, outputs, preconditions, status, validation check, failure mode, owner, and last-verified date |
| ACO ledger bundle | Code-level JSON bundle with `toolAvailability`, `commands`, and summaries by exact ledger status |
| Validation and waiver summary | Explicit pass, partial, blocked, or unknown evidence for relevant gates, including named graph waiver IDs when present |
| Final status | `Blocked`, `Partial`, or `Ready` |

### Failure Modes

| Failure Mode | Required Handling |
|--------------|-------------------|
| Missing tool | Mark the related ledger row `blocked` and record the missing prerequisite |
| Partial graph or waived source | Mark the related ledger row `partial` and limit confidence claims |
| Stale evidence | Mark the related ledger row `partial` or `unknown` until rechecked |
| Unsafe mutation request | Stop and ask for explicit approval before writing files, generating artifacts, committing, pushing, or opening a PR |

### Forbidden By Default

These actions are outside a read-only solidification review unless the user explicitly approves them:

- Editing files
- Running `archon context compile` when it writes artifacts
- Treating command safety classification as permission to run a command
- Running graph regeneration such as `bun run research:graph` or `bun run aco:research`
- Installing dependencies
- Running migrations
- Running formatters or linters in write mode, such as `bun run format` or `bun run lint:fix`
- Running code generation
- Staging or committing
- Pushing
- Opening a PR

See [Solidification Review Ledgers](/book/solidification-review-ledgers/) for the ledger schemas and status rules.

---

## Example Workflow (Telegram)

### Ask Questions Directly

```
You: What's the structure of this repo?

Bot: [Claude analyzes and responds...]
```

### Check Status

```
You: /status

Bot: Platform: telegram
     AI Assistant: claude

     Codebase: my-project
     Repository: https://github.com/user/my-project

     Repository: my-project @ main

     Worktrees: 0/10
```

### Reset Session

```
You: /reset

Bot: Session cleared. Starting fresh on next message.

     Codebase configuration preserved.
```

---

## Example Workflow (GitHub)

Create an issue or comment on an existing issue/PR:

```
@your-bot-name can you help me understand the authentication flow?
```

Bot responds with analysis. Continue the conversation:

```
@your-bot-name can you create a sequence diagram for this?
```

Bot maintains context and provides the diagram.
