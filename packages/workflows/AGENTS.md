# Workflows Package Instructions

Purpose: workflow schemas, loader, discovery, executor, DAG runtime, validator, event emitter, scripts, and bundled defaults.

- Do not invent workflow YAML fields; update schemas and tests first when changing syntax.
- Use `dagNodeSchema.safeParse()` conventions for node validation.
- Derive runtime constants such as trigger rules from schema options.
- Regenerate bundled defaults after source workflow/command changes.
- Validate with `bun run cli validate workflows`, `bun run cli validate commands`, `bun run check:bundled`, and package tests.
