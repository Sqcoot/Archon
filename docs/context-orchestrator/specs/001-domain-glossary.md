# 001 Domain Glossary

## Purpose

Define shared ACO language before model and contract work.

## Scope

Core domain terms used by specs, ADRs, tests, and implementation.

## Non-Goals

- Do not freeze class names before architecture ADRs.
- Do not duplicate generated TypeScript types.

## Generic Behavior

- Maintain stable meanings for PromptRequest, EvidencePacket, GraphContext, DocumentationPlan, BmadRoute, AcceptancePlan, PromptPackage, ArchiveArtifact, and ValidationReport.

## Archon-Specific Behavior

- Map generic terms to Archon workflows, artifacts, commands, CLI, REST API, and events only at integration boundaries.

## Inputs

- graph evidence
- Archon docs
- BMAD source
- OpenAI docs
- Context7 docs

## Outputs

- bounded-context glossary
- domain object glossary

## Known Unknowns

- final package/module names
- which terms become public API

## Evidence References

- docs/context-orchestrator/research/merged-ecosystem-report.md

## Acceptance Scenarios

- Given a spec uses a domain term, when the glossary is checked, then the term has one clear definition.

## Failure Behavior

- Route terminology conflicts to assumption-evidence register and BMAD correct-course if architecture-affecting.

## Security Constraints

- Do not use glossary terms to hide security-sensitive behavior.

## Open Questions

- Should CapabilityRoute and BmadRoute be separate objects?
