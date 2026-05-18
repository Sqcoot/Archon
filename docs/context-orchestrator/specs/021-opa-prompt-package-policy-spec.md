# 021 OPA Prompt Package Policy Spec

## Purpose

Define the deterministic OPA policy gate for ACO prompt-package evidence.

## Scope

Package-local Rego policy, policy tests, fixtures, archived prompt-package JSON input, aggregate validation reporting, and CI enforcement.

## Non-Goals

- Do not add runtime OPA enforcement.
- Do not add MCP/tool allow or deny policy.
- Do not add model-output policy enforcement.
- Do not add OPA decision-log pipelines.
- Do not add Wasm embedding.
- Do not add server, slash command, workflow, UI, or policy mutation config surfaces.
- Do not add a generic policy engine abstraction.

## Generic Behavior

- OPA evaluates the archived `prompt-package.json` artifact.
- Policy decisions use `{ allow, deny, warn, policy_version }`.
- `deny` and `warn` entries use stable finding codes, messages, paths, and severities.
- `allow` is true only when `deny` is empty.
- Warnings do not fail `aco:policy`; denials do.

## Archon-Specific Behavior

- Rego policy files live under `packages/context-orchestrator/policies/prompt-package/`.
- Fixture validation is run by `bun run aco:policy`.
- `validateContextOrchestrator()` reports an `aco-policy` check.
- `ARCHON_SKIP_OPA=1` may only skip local aggregate validation outside CI.
- Explicit `aco:policy*` scripts do not honor `ARCHON_SKIP_OPA`.
- CI installs the pinned `OPA_VERSION` from `.github/workflows/test.yml` and fails closed if OPA is unavailable, policy denies, or `ARCHON_SKIP_OPA=1` is set.

## Inputs

- `prompt-package.json`
- Rego fixture JSON files
- OPA CLI

## Outputs

- Rego test results
- Fixture validation output
- `aco-policy` validation check
- CI policy gate result

## Known Unknowns

- Whether future runtime policy enforcement should exist remains unresolved until runtime failure evidence exists.

## Evidence References

- OPA CLI documentation for `opa test` and `opa eval`
- OPA repository `build/policy/pr-check` policy and test conventions
- docs/context-orchestrator/specs/008-prompt-package-spec.md

## Acceptance Scenarios

- Given a valid prompt-package fixture, when `bun run aco:policy` runs, then the policy allows it with no denials.
- Given a fixture missing acceptance evidence, when `bun run aco:policy` runs, then the policy denies it with `ACO_POLICY_MISSING_ACCEPTANCE_EVIDENCE`.
- Given a fixture missing security evidence, when `bun run aco:policy` runs, then the policy denies it with `ACO_POLICY_MISSING_SECURITY_EVIDENCE`.
- Given a warning-only fixture, when `bun run aco:policy` runs, then the policy allows it and reports warning codes.
- Given `ARCHON_SKIP_OPA=1` and `CI=true`, when validation runs, then validation fails closed.

## Failure Behavior

- Missing OPA fails explicit policy scripts.
- Policy denials fail explicit policy scripts and CI.
- Fixture decision drift fails fixture validation.
- Local aggregate skip is explicit and reports a warning.

## Security Constraints

- Artifact refs must not use absolute paths or parent traversal.
- Manifest and artifact refs must not contain obvious secret-like values.
- The policy must validate archived evidence structure only; it must not broaden runtime permissions or capabilities.

## Open Questions

- Should future runtime policy enforcement use the same package or a separate policy domain after runtime failure evidence exists?
