# 021 OPA Prompt Package Policy Spec

## Purpose

Define the deterministic OPA policy gate and archived decision artifact for ACO prompt-package evidence.

## Scope

Package-local Rego policy, policy tests, fixtures, archived prompt-package JSON input, deterministic `policy-decision.json` output, aggregate validation reporting, and CI enforcement.

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
- Archive-time admission writes a deterministic `policy-decision.json` artifact derived from the exact archived `prompt-package.json` bytes.
- `policy-decision.json` is a derived artifact and must not be included in the OPA policy input or the prompt-package artifact list.
- Findings in `policy-decision.json` are deduplicated by `severity`, `code`, `path`, and `message`, then sorted by the same fields.
- `policy-decision.json` includes SHA-256 hashes for the archived input and the sorted Rego policy files under `packages/context-orchestrator/policies/prompt-package`, excluding `fixtures/**`.
- `policy-decision.json` does not include a wall-clock evaluation timestamp.

## Archon-Specific Behavior

- Rego policy files live under `packages/context-orchestrator/policies/prompt-package/`.
- Fixture validation is run by `bun run aco:policy`.
- `validateContextOrchestrator()` reports an `aco-policy` check.
- `context compile` evaluates the archived prompt-package policy after writing `prompt-package.json`.
- `context compile` writes `policy-decision.json` for valid OPA decisions, including denied decisions, then fails on denial.
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
- `policy-decision.json`
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
- Given a compiled package has warning-only policy findings, when archive-time admission runs, then policy-decision.json records the warning codes and compile succeeds.
- Given a compiled package has deny policy findings, when archive-time admission runs, then policy-decision.json records the deny codes and compile fails.
- Given duplicate policy findings are emitted, when policy-decision.json is written, then duplicate findings are suppressed deterministically.
- Given `ARCHON_SKIP_OPA=1` and `CI=true`, when validation runs, then validation fails closed.

## Failure Behavior

- Missing OPA fails explicit policy scripts.
- Policy denials fail explicit policy scripts and CI.
- Archive-time policy denials fail compile/archive validation after writing policy-decision.json.
- Missing OPA, failed OPA eval, or malformed OPA output fail archive-time admission and write no policy-decision.json.
- Missing `policy_version` in the OPA decision is malformed output.
- Fixture decision drift fails fixture validation.
- Local aggregate skip is explicit and reports a warning.

## Security Constraints

- Artifact refs must not use absolute paths or parent traversal.
- Manifest and artifact refs must not contain obvious secret-like values.
- The policy must validate archived evidence structure only; it must not broaden runtime permissions or capabilities.

## Open Questions

- Should future runtime policy enforcement use the same package or a separate policy domain after runtime failure evidence exists?
