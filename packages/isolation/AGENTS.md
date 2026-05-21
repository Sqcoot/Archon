# Isolation Package Instructions

Purpose: worktree isolation providers, resolver, store interfaces, and copy helpers.

- Preserve worktree isolation semantics and user changes.
- Let git block unsafe worktree removal when uncommitted changes exist.
- Do not silently delete untracked files.
- Keep provider interfaces narrow.
- Validate with package tests and workflow paths that create or resolve isolation environments.
