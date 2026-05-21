# Providers Package Instructions

Purpose: AI provider contracts, registry, Claude, Codex, MCP config, and community Pi integration.

- Preserve provider IDs: `claude`, `codex`, and `pi`.
- Do not infer provider from model strings.
- Keep provider-specific SDK behavior isolated inside provider implementations.
- Preserve community provider support.
- Do not add credentials or machine-local provider config.
- Validate provider changes with package tests and workflow provider-selection checks.
