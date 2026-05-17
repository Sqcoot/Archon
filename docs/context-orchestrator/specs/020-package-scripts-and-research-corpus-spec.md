# 020 Package Scripts and Research Corpus Spec

## Purpose

Define research corpus scripts and validation.

## Scope

Bootstrap, update, graph, merge, render, validate scripts and gitignore behavior.

## Non-Goals

- Do not commit raw upstream repositories or graph caches.

## Generic Behavior

- Research scripts are safe to rerun, record status, and continue on per-repo failures.

## Archon-Specific Behavior

- Scripts live under `scripts/research` and are exposed through root `package.json` scripts.

## Inputs

- required upstream list
- local names
- roles
- Graphify availability

## Outputs

- upstream manifest
- graph evidence docs
- waivers
- merged report

## Known Unknowns

- whether Graphify semantic extraction is required later

## Evidence References

- docs/context-orchestrator/research/upstream-manifest.json
- docs/context-orchestrator/research/graph-evidence-index.md

## Acceptance Scenarios

- Given research scripts complete, when corpus validation runs, then manifest exists, graph outputs exist or are waived, and ignored research directories are not visible to git.

## Failure Behavior

- Failed repos are recorded and do not stop other repos.

## Security Constraints

- Never use `git clean -fd`, reset hard, forced checkout, or overwrite non-git directories.

## Open Questions

- Should failed Graphify repos be retried with fixture mode or left as waivers?
