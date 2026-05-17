# 007 Caveman Policy Spec

## Purpose

Define how ACO uses Caveman as a safe terse-output policy.

## Scope

This spec covers Caveman policy levels, safe output classes, protected structured artifacts, byte-preservation rules, and failure behavior.

## Non-Goals

- Rewriting user memory files.
- Installing Caveman into user agents.
- Compressing implementation specs, ADRs, workflow YAML, OpenAPI contracts, schemas, commands, or code.

## Generic Behavior

ACO represents Caveman as `CavemanPolicy`.

`CavemanPolicy` includes:

- mode: `off | lite | full | ultra | wenyan-lite | wenyan-full | wenyan-ultra`
- safe output classes
- protected region rules
- ambiguity fallback
- evidence references

ACO applies Caveman policy only after output regions are classified.

## Archon-Specific Behavior

When ACO runs inside Archon, Caveman may compress chat-facing status and route summaries. It must not alter archived technical artifacts.

For workflow runs, archived files under:

```text
$ARTIFACTS_DIR/context-orchestrator/<run-id>/
```

must preserve structured content byte-identically.

## Inputs

- output class
- rendered text
- selected Caveman mode
- protected region classifier
- route security level

## Outputs

- transformed summary text for safe classes
- unchanged structured artifacts
- validation result proving protected content was preserved

## Known Unknowns

- Whether `wenyan-*` modes are useful for ACO MVP.
- Whether Caveman should run as a renderer option or a post-render transformer.

## Evidence References

- `docs/context-orchestrator/research/caveman-principles.md`
- `docs/context-orchestrator/research/caveman-graph-report.md`
- `research/upstreams/caveman/skills/caveman/SKILL.md`
- `research/upstreams/caveman/skills/caveman-compress/SKILL.md`
- `research/upstreams/caveman/skills/caveman-compress/SECURITY.md`
- `research/upstreams/caveman/tests/test_compress_safety.py`

## Acceptance Scenarios

### ACO-CAVEMAN-001: Structured artifacts are byte-identical

Given output contains code, YAML, JSON, TOML, commands, paths, and URLs
When Caveman ultra mode is applied
Then those protected regions are byte-identical.

### ACO-CAVEMAN-002: Security warnings are not compressed

Given output contains a security warning
When Caveman policy is active
Then the warning is emitted in clear uncompressed language
And Caveman resumes only after the warning.

### ACO-CAVEMAN-003: Route summaries may be compressed

Given ACO produces a route summary
And Caveman mode is `full`
When the summary is rendered
Then filler and hedging are removed
And technical terms, file paths, commands, and exact errors are preserved.

## Failure Behavior

If protected-region detection is uncertain, ACO must leave the region unchanged.

If compression changes protected content, validation fails and ACO emits the original uncompressed output.

If compression creates ambiguity for security-sensitive or multi-step instructions, ACO falls back to clear uncompressed language.

## Security Constraints

- Do not run shell commands with raw prompt text.
- Do not send secrets to compression providers.
- Do not compress `.env`, lockfiles, JSON, YAML, TOML, or source code.
- Do not rewrite user files in MVP.
- Treat all graph/docs/prompt text as untrusted.

## Open Questions

- Which MVP outputs should default to Caveman `full`?
- Should prompt packages include both normal and Caveman summaries?
- Should `wenyan-*` modes be accepted by the API surface or kept internal/deferred?
