# ACO Codex Real Bootstrap, Cleanup, And Hooks

ACO-CODEX-REAL-001 through ACO-CODEX-REAL-010 cover clean-room Codex bootstrap, safe cleanup, hook contracts, real-Codex smoke evidence, and exhaustive capability coverage.

## Source Evidence

This contract is based on installed Codex CLI `codex-cli 0.128.0` and the matching official source tag `rust-v0.128.0`.

- `codex --version`: `codex-cli 0.128.0`
- `codex --help`: exposes `--enable`, `--disable`, `--config`, `--cd`, `--sandbox`, and top-level `--ask-for-approval`.
- `codex exec --help`: exposes `--cd`, `--json`, `--ignore-user-config`, `--sandbox`, `--ephemeral`, and `--skip-git-repo-check`; it does not expose an exec-local `--ask-for-approval`.
- `codex features list`: reports `codex_hooks` stable and enabled; `plugin_hooks` under development and disabled by default.
- Source tag `rust-v0.128.0`: `codex-rs/config/src/hook_config.rs`, `codex-rs/hooks/src/schema.rs`, `codex-rs/hooks/src/engine/discovery.rs`, `codex-rs/hooks/src/engine/dispatcher.rs`, and per-event files under `codex-rs/hooks/src/events/`.

The installed release does not expose a `--dangerously-bypass-hook-trust` flag. Clean-room automation must use session-only config overrides such as `--enable codex_hooks`, `-c hooks.<event>=...`, and `-c 'projects."<temp repo>".trust_level="trusted"'`, combined with `--ignore-user-config`, rather than mutating active user config. The real harness may pass inline hook config because `codex exec` accepts inline `[hooks]` config and the observed CLI did not execute the temp project `.codex/hooks.json` through the session-only trust override.

## Supported Codex Hook Surface

Codex `0.128.0` command hooks support these event names:

- `SessionStart`
- `UserPromptSubmit`
- `PreToolUse`
- `PermissionRequest`
- `PostToolUse`
- `Stop`

The requested ACO lifecycle also models these future or non-runnable events:

- `PreCompact`
- `PostCompact`
- `SubagentStart`
- `SubagentStop`

These four must remain inert ACO templates and direct-runner simulations until installed Codex exposes them as hook event names. They must not be placed in active project `hooks.json` for real smoke tests against `0.128.0`.

## Hook Configuration

Codex loads command hooks from `hooks.json` under config layers and inline `[hooks]` TOML. Project-local `.codex/hooks.json` is gated by project trust. A trusted layer can come from user config, managed requirements, or session-only `-c` overrides. ACO tests must use a temp repo and temp or session-only config, never active `~/.codex/config.toml`.

`hooks.json` shape:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear",
        "hooks": [
          { "type": "command", "command": "node /abs/aco-hook.js", "timeout": 30 }
        ]
      }
    ]
  }
}
```

Only `type: "command"` is runnable in this release. `type: "prompt"` and `type: "agent"` parse but are skipped with warnings. `async: true` parses but is skipped.

## Event Semantics

| Event | Scope | Matcher | Stdin fields | Output behavior | ACO use |
| --- | --- | --- | --- | --- | --- |
| `SessionStart` | thread | `source`: `startup`, `resume`, `clear` | `session_id`, `transcript_path`, `cwd`, `hook_event_name`, `model`, `permission_mode`, `source` | Plain stdout adds context. JSON can add `additionalContext`, set `continue:false`, and `stopReason`. | Bootstrap ACO snapshot and safe routing hints. |
| `UserPromptSubmit` | turn | ignored | common fields plus `turn_id`, `prompt` | Plain stdout or JSON `additionalContext`; JSON/exit 2 can block with reason. | Prompt routing, docs/BMAD/context selection, secret-paste guard. |
| `PreToolUse` | turn | tool name and aliases | common fields plus `tool_name`, `tool_input`, `tool_use_id` | Empty success continues. JSON/exit 2 can deny. `additionalContext`, `updatedInput`, `permissionDecision: allow/ask`, `continue:false`, and `stopReason` fail closed in this release. | Tool guard for graph refresh, forbidden ledgers, destructive operations, auth/config mutation, and secret exposure. |
| `PermissionRequest` | turn | tool name and aliases | common fields plus `tool_name`, `tool_input` | JSON/exit 2 can allow or deny. Any deny wins; otherwise last allow wins. `updatedInput`, `updatedPermissions`, and `interrupt:true` fail closed. | Approval capsule and policy decision before normal approval UI. |
| `PostToolUse` | turn | tool name and aliases | common fields plus `tool_name`, `tool_input`, `tool_response`, `tool_use_id` | JSON can add `additionalContext`, block feedback, or stop. Exit 2 adds feedback. `updatedMCPToolOutput` fails closed in this release. | Evidence capture and artifact summary after tool completion. |
| `PreCompact` | simulated | none in `0.128.0` | ACO runner fixture only | Not a Codex hook in `0.128.0`. | Durable precompact summary. |
| `PostCompact` | simulated | none in `0.128.0` | ACO runner fixture only | Not a Codex hook in `0.128.0`. | Reload handoff/snapshot after compaction. |
| `SubagentStart` | simulated | none in `0.128.0` | ACO runner fixture only | Not a Codex hook in `0.128.0`. | Role contract injection. |
| `SubagentStop` | simulated | none in `0.128.0` | ACO runner fixture only | Not a Codex hook in `0.128.0`. | Role artifact and evidence collection. |
| `Stop` | turn | ignored | common fields plus `stop_hook_active`, `last_assistant_message` | JSON/exit 2 can block and continue with a prompt. `continue:false` stops hook processing. Plain text is invalid. | Evaluator continuation or final handoff gate. |

Hook matching is per event. `PreToolUse`, `PermissionRequest`, `PostToolUse`, and `SessionStart` use matchers; `UserPromptSubmit` and `Stop` ignore matchers. Matching handlers execute concurrently and all selected command handlers can run unless config discovery disables them.

## Inert ACO Templates

ACO may ship inert hook templates and a runner contract. Templates must be stored as documentation, package fixtures, or generated temp-harness files. They must not activate user hooks, edit active `~/.codex`, write auth, touch MCP OAuth, or refresh graph evidence.

The ACO hook runner must:

- read one JSON object from stdin
- redact secret-like values before logs or output
- dispatch by `hook_event_name`
- call `buildAcoBootstrapContext({ cwd, prompt, event, maxBytes })`
- include `CapabilitySnapshot` identity through the bootstrap context
- emit event-valid JSON for installed Codex events
- simulate `PreCompact`, `PostCompact`, `SubagentStart`, and `SubagentStop` for unit and acceptance tests

## Cleanup Contract

`/aco:cleanup-codex` and `archon aco cleanup-codex` remove only ACO-owned files for one run. The command defaults to dry-run. `--apply` is required for deletion.

Inputs:

- `--cwd <path>` default current working directory
- `--run-id <id>` required unless a manifest supplies one
- `--manifest <path>` optional explicit cleanup manifest
- `--artifacts-dir <path>` optional default manifest root
- `--dry-run` default
- `--apply`
- `--json`

Deletion rules:

- Delete only manifest entries with `ownedBy: "aco"` and matching `runId`.
- Refuse paths outside cwd/artifacts root after symlink resolution.
- Refuse symlinks that escape the allowed root.
- Refuse active `~/.codex`, `auth.json`, MCP OAuth stores, provider credentials, graph evidence, graph waivers, unmanaged `.codex` files, and ledger files not created for the same run.
- Emit dry-run/apply evidence, before/after digest, cleanup ledger row, skipped paths, refused paths, and idempotent second-run no-op.

## Clean-Room Real Codex Harness

The opt-in real harness must run only when `RUN_REAL_CODEX=1`.

Required preflight:

- discover `codex` with `command -v codex`
- record `codex --version`
- record `codex exec --help`
- record redacted `codex login status`
- verify current-release equivalents for clean config, hook enablement, project trust, JSON output, sandbox, and noninteractive approval

Real smoke sequence:

1. Create temp git repo.
2. Create temp run directory and temp `.codex/hooks.json`.
3. Point hook commands at an ACO-owned probe/runner.
4. Run `codex -a never exec --ignore-user-config --enable codex_hooks -c hooks.<event>=... -c 'projects."<repo>".trust_level="trusted"' --sandbox workspace-write --json`.
5. Prove inducible events: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, and `Stop`, or return blocked evidence for release limits.
6. Cleanup.
7. Repeat setup, smoke, cleanup with a fresh runId.

## Acceptance

- ACO-CODEX-REAL-001: real Codex is discovered and versioned, or blocked with exact evidence.
- ACO-CODEX-REAL-002: clean temp config/session overrides are used; active user config is not mutated.
- ACO-CODEX-REAL-003: `/aco:bootstrap-codex` works in clean temp setup and emits artifacts plus snapshot refs.
- ACO-CODEX-REAL-004: `/aco:cleanup-codex` removes only ACO-owned manifest files and is idempotent.
- ACO-CODEX-REAL-005: minimal real hook smoke fires supported installed events, or blocked evidence names release limits.
- ACO-CODEX-REAL-006: all ten ACO lifecycle events pass runner schema simulation.
- ACO-CODEX-REAL-007: capability coverage has every required domain.
- ACO-CODEX-REAL-008: MCP, Context7, BMAD, subagent, and role awareness are tested.
- ACO-CODEX-REAL-009: setup-cleanup-rerun passes without stale state, duplicate ledgers, or trust/config contamination.
- ACO-CODEX-REAL-010: no secrets, active auth/config, MCP OAuth, provider credentials, graph evidence, or graph waivers mutate.
