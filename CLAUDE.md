# Claude Code Instructions

Claude should use `AGENTS.md` as the canonical shared project instruction file and `CODEBASE_MAP.md` as the architecture/navigation map.

## Claude-Specific Notes

- Keep persistent context lean; detailed procedures belong in skills.
- Read the nearest package `AGENTS.md` before editing package files.
- Prefer `.claude/skills` for reusable Claude workflows and `.claude/agents` for Claude subagents.
- Do not overwrite `.claude/settings.json`; propose hook or MCP settings when merge safety is uncertain.
- Preserve existing Claude agents, skills, hooks, and permissions.

## Navigation

Prefer symbol/type navigation for definitions and references. Use grep for broad discovery or text search, not as the primary way to locate TypeScript definitions/references.

## Validation

Use the scoped-tests skill to choose the smallest meaningful validation first. Escalate to `bun run validate` when shared packages, generated bundles, workflow engine code, provider boundaries, SDD/ATDD artifacts, or TypeScript config changed.

## AI Workflow Governance

- `docs/ai/README.md` is the AI workflow governance index.
- `docs/ai/workflow-compliance-matrix.md` maps guide requirements to actual repo assets.
- `docs/ai/bmad-to-archon-mapping.md` maps BMAD to Archon.
- If editing `.archon`, `.claude`, `_bmad`, or `docs/ai`, update `docs/ai/stab-002-validation-report.md` or explain why not.
