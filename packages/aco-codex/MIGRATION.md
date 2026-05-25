# ACO Codex Migration Note

S4 keeps `archon aco bootstrap-codex --event <event> --format markdown|json [--write-artifact]`
out of live CLI wiring and captures its Codex bootstrap contract in `@archon/aco-codex`.

Future CLI code should call the package builders and renderers for markdown/json output. A later
artifact-writer slice may persist the rendered bundle when `--write-artifact` is explicitly used.

This package does not start real Codex sessions, enforce subagent or tool restrictions, attach MCP
servers, mutate config, write credentials, install hooks, refresh graph data, or claim provider
runtime behavior. Unproven capabilities are represented as `unsupported`, `unknown`, `partial`, or
`deferred_by_design` in the capability report.

The `--event <event>` schema is intentionally minimal: S4 models known Codex lifecycle labels and
keeps runtime payload details as a documented contract field for later provider/CLI slices.
