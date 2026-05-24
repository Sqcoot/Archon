# Always-On ACO Bootstrap and Capability Discovery

ACO-BOOTSTRAP-001 through ACO-BOOTSTRAP-005 cover the first always-on ACO bootstrap slice. The slice makes Context Orchestrator loadable from a compact prompt/session context by producing an evidence-backed `CapabilitySnapshot` and event-specific bootstrap context. It does not activate hooks, mutate active provider configuration, refresh graph evidence, or read credentials.

## Goals

- Provide a compact ACO bootstrap context that can be injected or handed off at session, prompt, tool, compaction, subagent, and stop boundaries.
- Discover capabilities through typed read-only adapters, manifests, ledgers, MCP/plugin evidence, workflow artifacts, docs targets, and provider registries.
- Keep new capability registration outside hard-coded routing logic. Router behavior may consume the snapshot, but new providers/tools must appear through manifests, adapters, ledgers, MCP registries, or plugins.
- Treat every capability claim as verified by repo/config evidence, a command result, or an explicit `unknown`, `blocked`, or `deferred` status.
- Preserve current graph evidence and graph waivers; graph refresh and hook activation remain explicit-approval actions.

## CapabilitySnapshot Contract

`CapabilitySnapshot` has schema version `aco.capability-snapshot.v1` and includes:

- `schemaVersion`
- `generatedAt`
- `sourceRefs`
- `providers`
- `commands`
- `workflows`
- `mcpServers`
- `plugins`
- `hooks`
- `roles`
- `ledgers`
- `artifacts`
- `graph`
- `docsTargets`
- `risks`
- `unknowns`
- `evidenceClaims`

Each evidence claim includes:

- `status`: one of `verified`, `unknown`, `blocked`, or `deferred`
- `confidence`: one of `high`, `medium`, `low`, or `unknown`
- `verificationSource`
- `sourceArtifact` or `command`
- optional `lastVerifiedAt`
- `safeToInject`
- compact context budget metadata

Claims with `verified` status require concrete repo/config evidence or command evidence. Claims without evidence must be marked `unknown`, `blocked`, or `deferred`. Secret-like values are redacted before insertion into the snapshot, bootstrap context, compile artifacts, status output, ledgers, telemetry attributes, or handoff artifacts.

## Read-Only Adapters

Adapters are deterministic and fixture-testable. They may read committed repository files and caller-supplied fixture paths. They must not read active auth stores, provider credentials, MCP OAuth tokens, or active user-level configuration.

Required adapter coverage:

- Codex config and hook structure: report active user config as `unknown` unless a safe committed manifest is present.
- Plugin manifests: read plugin, MCP, hook, and app manifests when present; otherwise emit unknown evidence.
- Codex MCP evidence: read committed MCP registry/config evidence only; do not inspect OAuth state.
- Archon commands, workflows, artifacts, and ledgers: discover `.archon/commands`, `.archon/workflows`, package scripts, and ACO ledger artifacts.
- BMAD roles: discover BMAD manifests and skill/role manifests when present.
- Graph/Graphify evidence: summarize committed graph evidence and waivers without refreshing graphs.
- Context7/docs: use docs-plan targets and committed docs evidence; unresolved targets remain unknown.
- Provider and future-provider manifests: discover providers from provider registry files and generic capability manifests so new providers do not require router rewrites.

## Lifecycle Event Mapping

The bootstrap context supports these events:

- `SessionStart`: include bootstrap status, snapshot summary, source refs, and unknowns.
- `UserPromptSubmit`: route the prompt and attach compact ACO context, docs targets, role hints, and evidence constraints.
- `PreToolUse`: guard forbidden ledger commands, graph refreshes, destructive operations, hook activation, auth mutation, and secret exposure.
- `PermissionRequest`: provide an approval capsule summary and ledger-backed reason before any approval-sensitive action.
- `PostToolUse`: capture command/tool evidence, exit status, artifacts, and new unknowns.
- `PreCompact`: emit a durable summary with decisions, open questions, changed files, outputs, and next actions.
- `PostCompact`: reload the latest handoff, snapshot, bootstrap context, and ledger summaries.
- `SubagentStart`: provide snapshot summary, role contract, allowed evidence sources, and artifact expectations.
- `SubagentStop`: collect role artifacts, evidence claims, unknowns, and evaluator notes.
- `Stop`: run evaluator continuation logic; if the goal is incomplete, emit a next `/goal` handoff instead of claiming completion.

A hook event such as PreToolUse, PostToolUse, PreCompact, SubagentStart, or Stop.

Hook coverage is opportunistic. Unsupported lifecycle handlers must degrade to sidecar artifacts, explicit bootstrap context, ledgers, and handoffs instead of prompt mutation or active hook installation.

## Compile, Status, Ledgers, And Artifacts

`compilePromptPackage()` includes:

- `capability-snapshot.json`
- `aco-bootstrap-context.json`
- `aco-bootstrap-context.md`
- manifest references to the bootstrap artifacts
- policy input evidence for snapshot/bootstrap claims

`getContextOrchestratorStatus()` includes compact capability discovery summary, bootstrap event coverage, and evidence counts. Ledgers include rows for capability discovery and bootstrap context generation, with safety classifications and evidence sources.

## Security

- Do not read `.env` files, auth stores, MCP OAuth state, provider credential files, or active user-level Codex configuration.
- Do not archive raw secret-like values.
- Redact prompt text, command strings, source excerpts, and manifest values before output.
- Keep hook activation approval-gated. Inert hook docs/templates may exist, but no active hook install occurs in this slice.

## Acceptance

- ACO-BOOTSTRAP-001: every capability claim is evidence-backed or marked unknown/blocked/deferred.
- ACO-BOOTSTRAP-002: hook events map to compact event-specific ACO context.
- ACO-BOOTSTRAP-003: new capabilities register through manifests/adapters/ledgers, not router rewrites.
- ACO-BOOTSTRAP-004: no auth/secrets are archived or emitted.
- ACO-BOOTSTRAP-005: Stop/evaluator can emit continuation when the goal is incomplete.

## Future Providers

Future providers, plugins, tools, MCP servers, and app integrations register through manifests and adapters. The snapshot model treats unknown provider features as discoverable entries with explicit evidence state. The route layer must not require a source edit just to make a new capability visible.
