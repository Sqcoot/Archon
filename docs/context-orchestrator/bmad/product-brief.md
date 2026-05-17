# ACO Product Brief

Date: 2026-05-17
BMAD action: `bmad-product-brief`

## Product

Archon Context Orchestrator is an Archon-native prompt package compiler for agentic coding work.

## Problem

Broad coding requests often start implementation too early. They lose evidence, skip acceptance criteria, pick a route without validating assumptions, and produce prompts that are hard to audit or resume.

## Users

- Solo developers using Archon to coordinate coding agents.
- Maintainers who want reproducible planning before large or ambiguous implementation.
- Agentic workflow authors who need an evidence-backed prompt package before running a workflow.

## Value Proposition

Given a prompt and a codebase, ACO produces a compact, archived, Codex-ready prompt package with graph status, docs plan, BMAD route, acceptance plan, security constraints, and validation report.

## MVP

CLI-first compile flow:

```bash
archon context compile --cwd . --json "Plan an SDD + ATDD implementation for this feature."
```

Expected result:

- compact CLI summary
- archive path
- final prompt package
- Codex prompt
- route report
- docs plan
- acceptance plan
- validation report

## Success Criteria

- Generic core does not assume CLI-only future shape.
- Prompt package archives are deterministic in tests.
- Secret-like values are redacted.
- Context7 library IDs are never invented.
- OpenAI Docs MCP is selected for OpenAI/Codex behavior.
- Caveman policy preserves structured artifacts byte-identically.
