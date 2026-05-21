# Core Package Instructions

Purpose: shared business logic, config loading, database access, orchestration, state, services, and workflow store bridge.

- Keep core provider-agnostic unless provider-specific behavior is already isolated.
- Preserve session transition immutability and explicit transition reasons.
- Use typed imports and narrow interfaces.
- Do not add database behavior without considering SQLite and PostgreSQL paths.
- Run targeted core tests before broader validation.
