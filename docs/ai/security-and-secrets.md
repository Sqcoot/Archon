# Security and Secrets

## Core rules

- Do not commit secrets.
- Do not store secrets in workflow YAML.
- Use environment variables, secret stores, platform config, or local user config for credentials.
- `.archon/.env.example` may list variable names and comments only.
- `.archon/.env` is Archon-owned and should be gitignored if present.
- Root `.env` belongs to the application and must not be overwritten by Archon setup.
- MCP configs must use environment variables for secrets.
- Production-write MCP access requires explicit approval and an audit trail.
- Broad tool permissions should be the exception.
- Avoid blind `git add .`.

## Current repo notes

- `.gitignore` ignores `.env`, `.env.local`, `.archon/artifacts/`, `_bmad-output/`, and `packages/server/.env`.
- No repo-local `.archon/mcp/*.json` files were found during this patch.
- `.claude/settings.json`, `.codex/hooks.json`, `.codex/config.toml`, `.mcp.json`, and provider auth config are trust-sensitive. Prefer proposed changes unless the user explicitly approves live edits.
- `.archon/config.yaml` is intentionally minimal and contains no secrets.

## Shell and command safety

Treat AI-generated shell commands as untrusted until reviewed or scoped.

Validate or quote all user-controlled strings before they reach shell:

- Branch names
- Issue titles
- PR titles
- Artifact content
- File paths from prompts
- MCP responses
- CLI arguments

Prefer structured parsing over ad hoc shell string manipulation when the repo already has TypeScript, JSON, or YAML tooling.

## Workflow YAML rules

- Use `allowed_tools` and `denied_tools` on AI nodes when the task can be scoped.
- Use `bash` or `script` nodes for deterministic checks.
- Do not put secrets in `prompt`, `command`, `mcp`, `hooks`, `agents`, or `skills` config.
- Do not imply `$ARTIFACTS_DIR` is safe to commit.
- Do not write runtime artifacts under tracked docs unless the artifact is explicitly a reviewable report like `docs/ai/stab-002-validation-report.md`.

## MCP rules

- Prefer read-only MCP access when possible.
- Require approval for write-capable production systems.
- Keep MCP config paths explicit and mapped in the compliance matrix.
- Use environment variables for tokens.
- Validate optional MCP configs with guarded file checks when workflows can skip them.

## Validation evidence

Security-relevant assumptions must be recorded in validation artifacts:

- Whether secrets were required.
- Whether MCP was used.
- Whether commands were read-only or mutating.
- Whether graph waivers or approval gates were preserved.
- Whether any validation command could not run because of local environment.
