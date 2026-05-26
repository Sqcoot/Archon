# Codex Bootstrap Capsule

schemaVersion: aco.codex-bootstrap-capsule.v1
id: aco.codex-bootstrap.fixture
mode: read-only
command: archon aco bootstrap-codex --event <event> --format markdown|json [--no-write-artifact]
repository: /Users/edam/Documents/TODA/Archon
branch: codex/aco-first-principles-rewrite
event: SessionStart

## Goal

Implement S4 as @archon/aco-codex: a pure Codex bootstrap and harness contract package.

## Runtime Boundaries

- Contract package only; live Codex runtime control is deferred.
- No subagent enforcement, tool restriction enforcement, MCP OAuth, hooks, credentials, or config mutation is claimed.
- Scoped artifact dossier and zip writes are default CLI behavior; use `--no-write-artifact` to suppress them.

## Required Artifacts

- codex-bootstrap-capsule.md
- codex-bootstrap-context.json
- capability-snapshot.json
- codex-harness-capability-report.json
- codex-continuation-handoff.md

## Capability Summary

- supported: 0
- partial: 3
- unsupported: 2
- unknown: 4
- deferred_by_design: 1

## Next Action

Use this capsule as bootstrap context and persist the scoped dossier under the artifact root before handoff.
