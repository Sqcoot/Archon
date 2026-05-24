# Server Package Instructions

Purpose: Hono HTTP server, OpenAPI routes, web adapter, SSE, and static web serving.

- New or changed API routes should use local OpenAPI route helpers and schemas.
- Preserve SSE streaming semantics for web conversations.
- Regenerate frontend API types when API schema changes and the server is available.
- Validate with server tests and type-check before broader validation.
