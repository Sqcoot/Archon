# 015 Security Threat Model

## Purpose

Define ACO security constraints.

## Scope

Secrets, path traversal, prompt injection, docs/graph untrusted input, MCP config, archives, subprocess safety.

## Non-Goals

- Do not claim sandboxing beyond what Archon/Codex provides.

## Generic Behavior

- ACO treats prompts, docs, and graph text as untrusted. It validates paths, redacts secrets, and fails closed on unsafe archives.

## Archon-Specific Behavior

- Use Archon env isolation behavior; do not read target repo `.env` files.

## Inputs

- prompt text
- graph text
- docs text
- target path
- archive root

## Outputs

- security constraints
- security validation report
- blocker list

## Known Unknowns

- exact redaction implementation
- API surface redaction scope

## Evidence References

- packages/docs-web/src/content/docs/reference/security.md
- docs/context-orchestrator/research/caveman-principles.md

## Acceptance Scenarios

- Given target repo contains `.env` with `SECRET_TOKEN`, when ACO compiles a package, then `SECRET_TOKEN` appears in no archive, CLI output, or API output.

## Failure Behavior

- Block on path traversal, secret leakage, or shell interpolation risk.

## Security Constraints

- Never read target `.env`; never archive secrets; never interpolate prompt text into shell.

## Open Questions

- Should token redaction use shared Archon utility or ACO-local validator?
