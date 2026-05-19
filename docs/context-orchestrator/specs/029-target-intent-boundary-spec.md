# 029 Target Intent Boundary Spec

## Purpose

ACO prevents accidental mutation of the wrong repo by making target, intent, source signals, confidence, warnings, and mutation policy explicit in prompt package evidence before execution.

This spec defines the provider-neutral Target/Intent Boundary Artifact. The artifact describes where Archon/ACO runs, where the requested work applies, where durable evidence is written, what kind of work is being requested, and what mutation policy is implied by the evidence available at compile time.

## Scope

- Add `target-intent-boundary.json` to newly compiled ACO prompt package archives.
- Add a schema for `aco.target-intent-boundary.v1`.
- Add a conservative builder that derives target relationship, work intent, mutation policy, confidence, source signals, warnings, and next decision from existing compile inputs.
- Add traceability and acceptance coverage for `ACO-TARGET-*`.
- Keep the artifact descriptive and advisory. It does not enforce mutation boundaries or authorize source changes.

## Non-Goals

- Do not refresh graph data.
- Do not clear, remove, normalize, or rewrite graph waivers.
- Do not edit `.archon/workflows/defaults/archon-adversarial-dev.yaml`.
- Do not add database migrations, UI changes, server routes, provider SDK behavior, or workflow runtime lifecycle changes.
- Do not implement enforcement, permission gating, evaluator driver registry, Ralph queue integration, or a verdict-to-NextDecision bridge.
- Do not perform registered-project database lookup in this first slice.
- Do not treat this artifact as permission to mutate files.

## Generic Behavior

- ACO compile emits a boundary artifact before implementation work begins.
- The boundary separates `harness.root`, `target.root`, `artifacts.root`, `target.relationship`, `objective.workIntent`, and `scope.mutationPolicy`.
- The boundary records source signals for every inferred claim, including user request, route, compile input, repo file, project doc, prior artifact, or inferred signal.
- Weak or ambiguous signals compile successfully with warnings and a safe next decision.
- Work intent is classified independently from target relationship. A bug fix can target Archon, the current repo, an external repo, or no source target; a refactor can do the same.
- The artifact remains provider-neutral and contains no Claude-, Codex-, UI-, server-, or database-specific execution assumptions.

## Archon-Specific Behavior

- New compile archives write `target-intent-boundary.json` next to `manifest.json`.
- `PromptPackage.targetCodebase` remains for compatibility. `PromptPackage.targetIntentBoundary` is the preferred structured source for new consumers.
- The archive manifest references the boundary schema version and artifact path.
- `prompt-package.json` includes the boundary in policy evidence.
- `final-prompt-package.md` names the boundary artifact and summarizes target relationship, work intent, mutation policy, confidence, warnings, and the descriptive non-enforcement boundary.
- Existing archives without `target-intent-boundary.json` remain valid.
- Active graph waiver state is preserved. Current known waiver IDs include `graph-waiver.bmad-plugins-marketplace` and `graph-waiver.bmad-sample-data`.

## Inputs

- User objective.
- Compile `cwd`.
- Compile archive path.
- Context intent, including normalized objective, commit SHA, and generated timestamp.
- BMAD route.
- Existing compile evidence, including ledgers and validation report when available.
- Git branch, commit, and dirty-state evidence for the harness checkout when available.

## Outputs

- `target-intent-boundary.json` using schema version `aco.target-intent-boundary.v1`.
- `PromptPackage.targetIntentBoundary` on newly compiled packages.
- Manifest metadata:
  - `targetIntentBoundarySchemaVersion`
  - `targetIntentBoundaryArtifact`
  - `targetIntentBoundary`
- Policy input evidence section `evidence.targetIntentBoundary`.
- Final prompt package section `## Target Intent Boundary`.

## Known Unknowns

- Registered-project resolution is intentionally deferred until the project resolver contract is explicit.
- External repository/worktree resolution is limited to safely and explicitly resolvable paths in this first slice.
- Future enforcement may consume this artifact, but this spec does not define enforcement behavior.
- Future target-specific evaluator drivers may consume work intent and target relationship, but this spec does not define driver selection.

## Evidence References

- `packages/context-orchestrator/src/compiler.ts`
- `packages/context-orchestrator/src/target-intent-boundary.ts`
- `packages/context-orchestrator/src/schemas/target-intent-boundary.ts`
- `tests/acceptance/context-orchestrator/target-intent-boundary.acceptance.test.ts`
- `docs/context-orchestrator/specs/spec-traceability-matrix.md`
- `docs/context-orchestrator/specs/traceability/aco-traceability.json`

## Acceptance Scenarios

- ACO-TARGET-001: Given an Archon/ACO/context-orchestrator objective, when ACO compiles the boundary, then it records `target.relationship = same_as_harness`, `target.equalsHarness = true`, and source signals.
- ACO-TARGET-002: Given a current-repo objective, when ACO compiles the boundary, then it records `target.relationship = current_repo` independently from work intent.
- ACO-TARGET-003: Given validation/evaluation-only or no-source work, when ACO compiles the boundary, then it records `target.relationship = artifact_only` and a read-only or artifact-only mutation policy.
- ACO-TARGET-004: Given ambiguous target signals, when ACO compiles the boundary, then it emits warnings and a safe next decision instead of assuming Archon or an external target.
- ACO-TARGET-005: Given bug, feature, refactor, or investigation wording, when ACO classifies the objective, then work intent remains independent from target relationship.
- ACO-TARGET-006: Given a new compile archive, when archive files are inspected, then `target-intent-boundary.json` exists and validates against the schema.
- ACO-TARGET-007: Given a new compile archive, when manifest, policy input evidence, and final package are inspected, then each references the boundary artifact.
- ACO-TARGET-008: Given an existing archive consumer reads an archive without the boundary artifact, when it validates the manifest-backed package, then the missing boundary artifact remains compatible.
- ACO-TARGET-009: Given the boundary artifact is present, when its scope is inspected, then it states `nonEnforcementBoundary: true` and does not create mutation permission.
- ACO-TARGET-010: Given the first slice is implemented, when changed files are inspected, then no graph refresh, waiver cleanup, provider/server/web/DB import, lifecycle mutation, or `archon-adversarial-dev.yaml` edit is introduced.

## Failure Behavior

- Malformed newly produced boundary artifacts fail compile before archive completion.
- Invalid enum values fail schema validation.
- Unsafe path traversal in explicit artifact paths fails fast.
- Attempts to treat the artifact as permission or enforcement must fail validation by preserving `scope.nonEnforcementBoundary: true`.
- Unknown targets, unknown intent, missing source signals, low confidence, or conflicting source signals are non-fatal warnings that produce `approval_required`, `blocked`, or `needs_correct_course` as appropriate.

## Security Constraints

- Do not read or archive `.env` files or secrets.
- Do not interpolate raw prompt text into shell commands.
- Do not silently broaden permissions or provider capabilities.
- Do not execute commands from boundary artifact fields.
- Do not mutate workflow/session lifecycle state across process boundaries.
- Do not run graph refresh, graph waiver cleanup, or destructive git commands as part of boundary compilation.

## Open Questions

- Which registered-project resolver should provide target evidence in a later slice?
- Should future workflow prompts consume the boundary artifact directly for Generator/Evaluator scoping?
- Should future policy gates require boundary presence for all new compile archives after backward compatibility has been proven?
