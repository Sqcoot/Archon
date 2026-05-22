# Archon Agent Instructions

## Mission

Archon is a remote agentic coding platform for controlling AI coding assistants from Slack, Telegram, GitHub, CLI, and web surfaces. It is a single-developer tool built with Bun, TypeScript, and SQLite/PostgreSQL. Favor simple, typed, explicit behavior over broad abstractions.

## Required Branch Discipline

- Do not implement release work on `main`.
- Do not assume `dev` is the active branch during stabilization work.
- For the current stabilization branch, preserve SDD/ATDD alignment: update specs first, define acceptance scenarios next, then implement.
- Preserve active Context Orchestrator graph waivers unless the user explicitly approves graph refresh or waiver cleanup.

## Large-Codebase Navigation

- Prefer symbol/type navigation for definitions and references. Use grep for broad discovery or text search, not as the primary way to locate TypeScript definitions/references.
- Use `CODEBASE_MAP.md` for repository routing before broad edits.
- When launched from the repo root, read the nearest package `AGENTS.md` before editing files in that package.
- Keep root instructions lean. Put architecture in `CODEBASE_MAP.md`, repeatable procedures in skills, and deterministic enforcement in scripts/tests.

## Validation

- Do not run root `bun test` directly; use `bun run test` for package-isolated test runs or explicit test-file commands.
- Run scoped validation first, then escalate to full validation when shared packages, generated bundles, workflow engine code, provider boundaries, SDD/ATDD artifacts, or TypeScript config changed.
- Pre-PR validation is `bun run validate`.
- AI-layer navigation validation is `bun run validate:ts-navigation`.

## Type Safety

- Strict TypeScript matters. Avoid `any` unless the justification is local and explicit.
- Use type-only imports for types and named imports for values.
- Import Zod as `z` from `@hono/zod-openapi`.
- Derive schema types with `z.infer<typeof schema>` instead of parallel hand-written interfaces.

## Workflow And Command Rules

- Bundled command sources live in `.archon/commands/defaults/`.
- Bundled workflow sources live in `.archon/workflows/defaults/`.
- Regenerate bundled defaults with `bun run generate:bundled` after changing bundled commands or workflows.
- Validate with `bun run cli validate workflows` and `bun run cli validate commands`.
- Do not invent workflow schema fields. Inspect `packages/workflows/src/schemas/` first.

## AI Workflow Governance

- Read `docs/ai/README.md` before making workflow, harness, BMAD, MCP, or AI operating-layer changes.
- For Archon workflow governance, consult `docs/ai/agentic-coding-operating-guide.md`.
- For current asset coverage, consult `docs/ai/workflow-compliance-matrix.md`.
- For BMAD mapping, consult `docs/ai/bmad-to-archon-mapping.md`.
- Do not create duplicate workflows or commands without checking the compliance matrix.
- Do not claim validation passed without updating `docs/ai/stab-002-validation-report.md` or citing actual command output.

## Git And Safety

- Never run `git clean -fd`.
- Do not revert user changes unless explicitly asked.
- Do not commit runtime artifacts under `.archon/artifacts`.
- Do not add secrets, credentials, provider auth config, telemetry profiles, or machine-local settings.
- Prefer proposed artifacts over live edits for `.claude/settings.json`, `.codex/hooks.json`, `.codex/config.toml`, `.mcp.json`, and other trust-sensitive config.

## Package Map

Read `CODEBASE_MAP.md` for the full package map and change routes. The most common package-local files are:

- `packages/workflows/AGENTS.md` for workflow engine changes.
- `packages/providers/AGENTS.md` for Claude, Codex, and Pi provider changes.
- `packages/core/AGENTS.md` for orchestration, state, config, and DB business logic.
- `packages/server/AGENTS.md` and `packages/web/AGENTS.md` for API and UI changes.
- `packages/context-orchestrator/AGENTS.md` for SDD/ATDD Context Orchestrator work.

## Skills

- Use `scoped-tests` when choosing validation for a change.
- Use AI-layer workflow commands for artifact-first bootstrap work instead of relying on conversation memory.
