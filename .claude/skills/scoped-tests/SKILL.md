---
name: scoped-tests
description: Choose and run the smallest meaningful Archon validation set for a change, then escalate when shared surfaces are touched.
---

# Scoped Tests

Use this skill when choosing validation for Archon changes.

1. Identify changed files and their owning package or subsystem.
2. Read root `AGENTS.md`, `CODEBASE_MAP.md`, and the nearest package `AGENTS.md`.
3. Start with scoped checks:
   - package-local tests for local code
   - targeted acceptance tests for SDD/ATDD updates
   - `bun run cli validate workflows <name>` for workflow YAML
   - `bun run cli validate commands <name>` or all commands for command prompts
   - `bun run validate:ts-navigation` for symbol-navigation changes
4. Escalate to `bun run validate` for shared packages, provider boundaries, workflow engine code, generated bundles, SDD/ATDD artifacts, TypeScript config, root instructions, hooks, or MCP config.
5. Report exact commands and outcomes. Do not skip validation silently.
