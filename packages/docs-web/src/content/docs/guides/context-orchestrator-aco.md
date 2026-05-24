---
title: Context Orchestrator (ACO)
description: Use Archon's native context coordination layer to inspect readiness, compile prompt packages, and gate approval-sensitive work.
category: guides
area: orchestrator
audience: [user, developer]
status: current
sidebar:
  order: 2.5
---

The Context Orchestrator, also called ACO, is Archon's coordination layer for
architecture-sensitive work. It gathers local project evidence, routes the
request, compiles a context package, and keeps approval boundaries visible
before another workflow or agent starts implementation.

Use ACO when a task needs more than a direct command or a simple workflow run:

- the next agent needs a durable context package instead of conversation memory
- implementation depends on tool, command, graph, or documentation evidence
- BMAD routing, acceptance coverage, or approval state should be visible first
- a graph waiver or other approval-sensitive state must stay explicit

For smaller tasks, use ordinary [commands](/guides/authoring-commands/) and
[workflows](/guides/authoring-workflows/). ACO is for preparing and governing
the work before execution.

## Quick Start

Inspect ACO status for a repository:

```bash
archon aco status --cwd /path/to/repo --json "Plan the implementation"
```

Run the native orchestration workflow:

```bash
archon workflow run context-orchestrate --cwd /path/to/repo "Plan the implementation"
```

Or from any chat surface with a registered project:

```text
/context status Plan the implementation
/context run Plan the implementation
```

The workflow writes status, ledgers, compiled context, approval-capsule, and
handoff artifacts under `$ARTIFACTS_DIR/context-orchestrator/`.

## What ACO Produces

ACO turns a request into inspectable evidence:

| Output | Purpose |
|--------|---------|
| Status | Current readiness, validation status, graph state, waivers, and next decision |
| Ledgers | Tool availability and command coverage with evidence blockers |
| Route | BMAD advisory route for the request |
| Context package | Prompt package, manifests, evidence, and handoff files for the next agent |
| Approval capsule | Verification artifact for approval-required graph waiver handoff |
| Artifact package | Manifest-backed archive that the UI and API can read later |

The compiled package is intentionally artifact-first. It gives downstream agents
the same context, even when they run with a fresh session.

## CLI Commands

Use `archon aco status` for the productized status view:

```bash
archon aco status --cwd /path/to/repo "Investigate the change"
archon aco status --cwd /path/to/repo --json "Investigate the change"
```

Use `archon aco bootstrap-codex` when a Codex session needs the compact ACO
capsule and durable sidecars:

```bash
archon aco bootstrap-codex --event SessionStart --max-bytes 4000 --format markdown --write-artifact
archon aco bootstrap-codex --event Stop --format json --evaluator "Continue validation and handoff"
```

Slash-compatible Codex paste workflow:

```bash
/aco:bootstrap-codex --event SessionStart --max-bytes 4000 --format markdown --write-artifact
```

Markdown mode is sized for direct paste into Codex. JSON mode is attachable by
automation/workflow consumers and carries the same event and snapshot identity.
Artifacts are written under `.archon/artifacts/context-orchestrator/` and include
the capsule, CapabilitySnapshot sidecar, and bootstrap command evidence row.
Hook activation, graph refresh, auth/config mutation, MCP OAuth changes, and
provider credential changes remain approval-gated and are not performed by this
command.

Use `archon context` for the lower-level ACO surfaces:

| Command | Description |
|---------|-------------|
| `archon context status [request]` | Show status, readiness, evidence resolution, and next decision |
| `archon context ledgers [request]` | Show tool availability and command ledgers |
| `archon context route <request>` | Select the BMAD advisory route |
| `archon context compile <request>` | Compile a context package for the request |
| `archon context approval-capsule <request>` | Create an approval capsule for an approval-required package |
| `archon context approval-capsule-verify` | Verify the approval contract against current artifacts |
| `archon context graph-waivers` | Inspect graph waiver closure state |
| `archon context validate` | Run the Context Orchestrator validation checks |

`compile` accepts `--archive-root`, `--run-id`, and `--json` when a workflow
needs deterministic artifact paths.

## Slash Commands

When a conversation has a registered project, use `/context` from Web, Slack,
Telegram, GitHub, or other chat adapters:

| Command | Description |
|---------|-------------|
| `/context status [request]` | Show route readiness, ledgers, and approval state |
| `/context route <request>` | Pick the BMAD route |
| `/context ledgers [request]` | Show tool and command ledger coverage |
| `/context compile <request>` | Compile the context package |
| `/context run <request>` | Run the bundled `context-orchestrate` workflow |

`/context run` is the chat-friendly entry point when you want the full ACO
status, compile, approval, and handoff sequence.

## Web UI

The Web UI includes a **Context Orchestrator** view for registered projects. It
loads the same API contracts as the CLI: status, ledgers, route, compile, and
artifact package lookup. Use it when you want to inspect readiness and approval
state without reading JSON by hand.

The UI labels approval-sensitive states as **Needs approval**. That is a public
compatibility state for Web/API consumers; new ACO coordination gates use the
internal states described below.

## Readiness States

ACO readiness is evidence-based:

| State | Meaning |
|-------|---------|
| `ready` | Validation and required evidence are closed for the current request |
| `blocked` | Validation or evidence blockers must be resolved before handoff |
| `needs_decision` | A human decision is required, but not a graph-waiver approval |
| `unknown` | ACO cannot truthfully classify the state from available evidence |
| `needs_approval` | Public API/UI compatibility state for approval-required graph evidence |

Do not treat `needs_approval` as ready. It means the next step needs explicit
approval or a separate decision before the handoff should be trusted.

## Graph Waivers And Approval

ACO can report graph evidence as `forbidden` or `unavailable`. In those cases,
the status includes graph waiver IDs and an approval-required next decision.

Approval preserves the listed waivers for the current run only. It does not
approve graph refresh, waiver cleanup, remote mutation, provider configuration,
or any unrelated maintenance task. If graph evidence needs to be regenerated,
request that approval separately.

The `context-orchestrate` workflow generates an approval capsule when the
compiled package needs graph-waiver approval. Review the capsule and its
verification result before approving the workflow gate.

## BMAD, Context7, And MCP Evidence

ACO uses BMAD as advisory routing. The route tells you which planning or review
path fits the request; it does not automatically replace the implementation
workflow.

ACO also records documentation and tool evidence. When a request depends on
current third-party library, SDK, CLI, or cloud-service behavior, the evidence
resolution can point to Context7 or MCP-backed documentation work. If ACO reports
that documentation evidence is unresolved, fetch or verify that evidence before
claiming the package is ready.

Per-node MCP configuration is still handled by workflow YAML. See
[Per-Node MCP Servers](/guides/mcp-servers/) for tool wiring details.

## Built-In ACO Workflows

Archon ships two ACO-oriented workflow defaults:

| Workflow | Use |
|----------|-----|
| `context-orchestrate` | Compile status, ledgers, context package, approval state, and a handoff |
| `archon-aco-adversarial-loop` | Run a contracted adversarial planning loop grounded in ACO artifacts |

Use `context-orchestrate` before broad implementation work. Use the adversarial
loop only when you need a stricter generator/evaluator contract around a slice.

## Validation

For repo-native ACO work, the common checks are:

```bash
bun run aco:context-intake --json
bun run cli context validate --cwd . --json
bun run aco:target-intent -- --objective "Your objective" --json
bun run aco:goal-bound-evidence -- --objective "Your objective" --evidence-file path/to/evidence.json --json
bun run aco:completion-preconditions --json
```

Use these checks to prove the context package and handoff are tied to the
current repository, branch, and objective.
