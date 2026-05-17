# ACO Problem Solving

Date: 2026-05-17
BMAD action: `bmad-cis-problem-solving`

## Core Tension

ACO needs to be generic enough for future Archon surfaces while shipping a useful first milestone without a large cross-package patch.

## Tradeoff Resolution

- Start with a new generic package.
- Integrate through CLI only for MVP.
- Keep workflow/API/slash integrations as documented follow-up stories.
- Use file artifacts, not database tables.
- Use docs plans, not mandatory live doc fetching in every compile run.

## Rejected Paths

- All-surfaces MVP: too much blast radius.
- Workflow-only MVP: useful, but makes ACO hard to reuse from CLI/API and complicates deterministic acceptance tests.
- Core package only: risks mixing orchestration policy with generic prompt package modeling.
- DB-backed package registry: not needed for first milestone.

## Decision Gate

Proceed to ADRs with CLI-first MVP.
