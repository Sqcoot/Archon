# ACO Codex Bootstrap Command

ACO-CODEX-CMD-001 through ACO-CODEX-CMD-010 cover the first-class command that emits a Codex-ready ACO bootstrap capsule. This command promotes the always-on bootstrap slice from package API to registered Archon command, CLI, slash, help, docs, artifacts, and ledger evidence without adding a parallel command system.

## Command Contract

Canonical slash command:

- `/aco:bootstrap-codex`

Registered Archon command/default:

- `aco-bootstrap-codex`

Aliases:

- `aco bootstrap-codex`
- `aco bootstrap codex`
- `bootstrap-codex`

The command must be registered only through existing Archon command defaults, bundled default generation, CLI routing, slash command handling, help/catalog docs, and validators. It must not rewrite the ACO router or maintain a separate slash command registry just to add this command.

## Inputs

- `cwd`: repository root for read-only discovery; default is the effective CLI or registered-project cwd.
- `event`: one of `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PreCompact`, `PostCompact`, `SubagentStart`, `SubagentStop`, or `Stop`; default `SessionStart`.
- `prompt`: optional route/context hint; secret-like values are redacted before output or artifact writes.
- `maxBytes`: compact capsule budget; default `4000`; minimum `500`.
- `format`: `markdown` or `json`; default `markdown`.
- `writeArtifact`: boolean; default `true`; writes only repo-conventional ACO artifacts.
- `strict`: boolean; default `false`; when true, unsafe output or unbacked verified claims fail closed.
- `evaluator`: boolean; default `true`; controls Stop continuation behavior.

Exact usage:

```bash
/aco:bootstrap-codex --event SessionStart --max-bytes 4000 --format markdown --write-artifact
archon aco bootstrap-codex --event SessionStart --max-bytes 4000 --format markdown --write-artifact
archon aco bootstrap-codex --event Stop --format json --evaluator "Continue validation and handoff"
```

## Outputs

The command emits either:

- Markdown paste mode: compact ACO bootstrap capsule suitable for Codex prompt/session/subagent injection.
- JSON attach mode: schema-valid payload containing the same event, snapshot identity, evidence summary, risks/unknowns, artifact refs, and continuation status.

All outputs include:

- command identity and aliases
- event and max-byte budget
- CapabilitySnapshot reference
- compact bootstrap context
- evidence summary with claim status, confidence, source/command metadata, safe-to-inject flag, and budget metadata
- risks, unknowns, blocked, or deferred claims
- artifact refs when writing is enabled
- Stop/evaluator continuation with a next `/goal` when completion is incomplete or unknown

## Reuse And Extensibility

The handler delegates to `buildCapabilitySnapshot()` and `buildAcoBootstrapContext({ cwd, prompt, event, maxBytes })`. It may render, redact, validate, and write command artifacts, but it must not duplicate capability discovery, hard-code future providers, or keep its own router tool list.

New capabilities register through manifests, read-only adapters, ledgers, MCP/plugin registries, or bundled/default command discovery. A new mock provider manifest must appear in the emitted CapabilitySnapshot without editing the router source.

## Artifact And Ledger Writes

When `writeArtifact` is enabled, the command writes under the repo-conventional ACO artifact root:

- `.archon/artifacts/context-orchestrator/<runId>/aco-codex-bootstrap-<timestamp>.md`
- `.archon/artifacts/context-orchestrator/<runId>/aco-codex-bootstrap-<timestamp>.json`
- `.archon/artifacts/context-orchestrator/<runId>/capability-snapshot-<timestamp>.json`
- `.archon/artifacts/context-orchestrator/<runId>/bootstrap-command-evidence-<timestamp>.jsonl`

Reported artifact paths are repo-relative. Evidence rows record command, event, snapshot ref, capsule refs, claim counts, status counts, risks/unknowns, and continuation state. The command may write these artifacts and ledger rows by default; all other behavior remains read-only.

## Event Mapping

- `SessionStart`: bootstrap status, snapshot summary, command/workflow/docs targets, and risks.
- `UserPromptSubmit`: route hints, prompt-scoped ACO context, and sidecar refs.
- `PreToolUse`: guard forbidden ledgers, graph refreshes, destructive operations, hook activation, auth mutation, and secret exposure.
- `PermissionRequest`: approval capsule summary with reason, risk, exact command/surface, and ledger-backed reason.
- `PostToolUse`: evidence capture summary for safe command output, changed artifacts, and unresolved claims.
- `PreCompact`: durable summary with decisions, changed files, outputs, validation state, questions, and next actions.
- `PostCompact`: reload instructions for latest handoff, snapshot, capsule, and ledger refs.
- `SubagentStart`: role contract, minimal capability snapshot, allowed evidence sources, and artifact expectations.
- `SubagentStop`: role output/evidence capture and next responsibility.
- `Stop`: evaluator continuation and next `/goal` if work is incomplete.

## Safety

- Do not mutate auth, provider credentials, MCP OAuth state, `.env`, private keys, active user-level Codex config, or active hooks.
- Do not install or activate hooks without explicit approval.
- Do not refresh graph/Graphify evidence; preserve committed graph evidence and graph waivers.
- Do not run forbidden ledger commands.
- Do not print, archive, or persist unredacted secret-like values.
- Redact prompt text, source refs, command strings, manifest values, and artifact content before output.
- Verified claims require source artifact, command evidence, or committed config evidence; unsupported claims must be `unknown`, `blocked`, or `deferred`.

## Acceptance

- ACO-CODEX-CMD-001: command is discoverable in the existing Archon registry/catalog/help and validates with a slash-compatible name.
- ACO-CODEX-CMD-002: handler delegates to `buildAcoBootstrapContext()` and CapabilitySnapshot builder/adapters; it does not duplicate router logic.
- ACO-CODEX-CMD-003: `--max-bytes 4000` emits event-specific markdown within budget, with snapshot ref, evidence summary, risks/unknowns, and budget metadata.
- ACO-CODEX-CMD-004: `--write-artifact` writes capsule, snapshot, and evidence row without secrets or auth/config mutation.
- ACO-CODEX-CMD-005: verified claims carry evidence metadata; uncertain claims are `unknown`, `blocked`, or `deferred`.
- ACO-CODEX-CMD-006: markdown and JSON modes represent the same event and snapshot identity.
- ACO-CODEX-CMD-007: `Stop` with evaluator enabled emits continuation and a next `/goal` when incomplete.
- ACO-CODEX-CMD-008: `PreToolUse` and `PermissionRequest` emit guard/approval capsules for forbidden ledgers, graph refresh, destructive operations, and secret exposure.
- ACO-CODEX-CMD-009: manifest-registered capabilities appear in the snapshot without router source edits.
- ACO-CODEX-CMD-010: docs include exact usage and bundled/generated command defaults remain synchronized.
