# Paths Package Instructions

Purpose: Archon path resolution, logger factory, web-dist paths, and cwd environment stripping.

- Keep this package low-dependency and free of `@archon/*` imports.
- Preserve cross-platform path behavior.
- Avoid embedding machine-local absolute paths in reusable config.
- Validate with package tests and root type-check.
