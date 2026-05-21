# Adapters Package Instructions

Purpose: platform adapters for Slack, Telegram, GitHub, Discord, and related adapter utilities.

- Keep platform authorization inside adapters.
- Preserve `IPlatformAdapter` contracts from core.
- Do not leak secrets or raw user identifiers in logs; mask where existing code does.
- Prefer package-local tests before full validation.
- Read `CODEBASE_MAP.md` before changing cross-package adapter behavior.
