# Spec Traceability Matrix

| Spec | Acceptance IDs | Evidence | Implementation status |
| --- | --- | --- | --- |
| 000-product-charter.md | ACO-CHARTER-001 | graph/docs research | spec only |
| 004-graph-context-spec.md | ACO-GRAPH-001 | graph-evidence-index.md | research scripts complete |
| 005-documentation-resolution-spec.md | ACO-DOCS-001, ACO-DOCS-002, ACO-DOCS-003 | openai-docs-mcp.md, context7-mcp.md | spec only |
| 007-caveman-policy-spec.md | ACO-CAVEMAN-001, ACO-CAVEMAN-002, ACO-CAVEMAN-003 | caveman-principles.md | spec only |
| 008-prompt-package-spec.md | ACO-COMPILE-001, ACO-ARCHIVE-001, ACO-POLICY-DECISION-001, ACO-CLI-001 | compile/archive/CLI acceptance tests and policy-decision artifact tests | CLI MVP implemented with structured next-command argv, archive output, and deterministic OPA decision artifact |
| 009-archive-artifact-spec.md | ACO-ARCHIVE-001, ACO-ARCHIVE-002, ACO-ARCHIVE-003, ACO-POLICY-DECISION-001, ACO-POLICY-DECISION-002 | archive acceptance tests and policy-decision artifact tests | implemented for CLI MVP with runId, symlink escape checks, and archive-time OPA admission |
| 010-codex-readiness-spec.md | ACO-CODEX-HOOK-001, ACO-CODEX-HOOK-002, ACO-CODEX-HOOK-003 | Codex hook acceptance tests and `.codex/README.md` | project hook config hardened; user-level Codex config untouched |
| 012-cli-contract.md | ACO-CLI-001, ACO-CLI-002, ACO-CLI-003 | CLI acceptance tests | route, compile, status, and validate CLI MVP implemented |
| 015-security-threat-model.md | ACO-SECURITY-001, ACO-SECURITY-002, ACO-SECURITY-003, ACO-SECURITY-004 | security acceptance tests and context-orchestrator unit tests | partial hardening implemented for CLI MVP; API/workflow redaction remains deferred with those surfaces |
| 020-package-scripts-and-research-corpus-spec.md | ACO-RESEARCH-001 | upstream-manifest.json, validate-corpus output | scripts complete |
| 021-opa-prompt-package-policy-spec.md | ACO-POLICY-001, ACO-POLICY-002, ACO-POLICY-003, ACO-POLICY-DECISION-001, ACO-POLICY-DECISION-002, ACO-POLICY-DECISION-003 | Rego policy tests, fixture validation, policy-decision artifact tests, traceability manifest, ACO acceptance tests, `bun run aco:policy`, `bun run aco:traceability`, `bun run validate` | package-local OPA prompt-package policy gate implemented for archived evidence validation and deterministic archived decision evidence |
| 022-sdd-atdd-traceability-gate-spec.md | ACO-TRACE-001, ACO-TRACE-002, ACO-TRACE-003 | traceability manifest, traceability validator, specs acceptance tests, `bun run aco:traceability`, `validateContextOrchestrator()` | deterministic SDD/ATDD traceability gate for enforced OPA and policy-decision requirements |
