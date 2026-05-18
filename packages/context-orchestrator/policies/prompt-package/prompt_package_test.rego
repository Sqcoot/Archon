package archon.context_orchestrator.prompt_package_test

import data.archon.context_orchestrator.prompt_package

base_manifest := {
	"runId": "aco-policy-fixture",
	"upstreamManifest": "docs/context-orchestrator/research/upstream-manifest.json",
	"specs": [
		"docs/context-orchestrator/specs/008-prompt-package-spec.md",
		"docs/context-orchestrator/specs/021-opa-prompt-package-policy-spec.md",
	],
}

base_artifacts := [
	{"id": "manifest", "path": "manifest.json", "kind": "json"},
	{"id": "prompt-package", "path": "prompt-package.json", "kind": "json"},
	{"id": "final-prompt-package", "path": "final-prompt-package.md", "kind": "markdown"},
]

base_evidence := {
	"graph": {"status": "available", "waiverCount": 0},
	"docs": {"unresolved": [], "targets": []},
	"bmad": {"id": "brownfield-architecture", "steps": ["bmad-technical-research"]},
	"acceptance": {"status": "ready", "scenarios": [{"id": "ACO-POLICY-001"}]},
	"security": {"constraints": ["Do not archive secrets."], "redaction": "applied"},
}

valid_input := {
	"schema_version": "aco.prompt-package.policy-input.v1",
	"package_id": "aco-policy-fixture",
	"generated_at": "2026-05-18T12:00:00.000Z",
	"source_request": {"text": "Implement the ACO policy gate."},
	"manifest": base_manifest,
	"artifacts": base_artifacts,
	"evidence": base_evidence,
	"validation": {"status": "passed"},
}

missing_acceptance_input := {
	"schema_version": "aco.prompt-package.policy-input.v1",
	"package_id": "aco-policy-fixture",
	"generated_at": "2026-05-18T12:00:00.000Z",
	"source_request": {"text": "Implement the ACO policy gate."},
	"manifest": base_manifest,
	"artifacts": base_artifacts,
	"evidence": {
		"graph": base_evidence.graph,
		"docs": base_evidence.docs,
		"bmad": base_evidence.bmad,
		"security": base_evidence.security,
	},
	"validation": {"status": "passed"},
}

test_valid_prompt_package_allows if {
	decision := prompt_package.decision with input as valid_input
	decision.allow
	count(decision.deny) == 0
	decision.policy_version == "aco-prompt-package-v1"
}

test_missing_acceptance_denies if {
	decision := prompt_package.decision with input as missing_acceptance_input
	not decision.allow
	decision.deny[_].code == "ACO_POLICY_MISSING_ACCEPTANCE_EVIDENCE"
}

test_missing_security_denies if {
	input_without_security := {
		"schema_version": valid_input.schema_version,
		"package_id": valid_input.package_id,
		"generated_at": valid_input.generated_at,
		"source_request": valid_input.source_request,
		"manifest": base_manifest,
		"artifacts": base_artifacts,
		"evidence": {
			"graph": base_evidence.graph,
			"docs": base_evidence.docs,
			"bmad": base_evidence.bmad,
			"acceptance": base_evidence.acceptance,
		},
		"validation": valid_input.validation,
	}
	decision := prompt_package.decision with input as input_without_security
	not decision.allow
	decision.deny[_].code == "ACO_POLICY_MISSING_SECURITY_EVIDENCE"
}

test_malformed_input_denies if {
	decision := prompt_package.decision with input as "not-an-object"
	not decision.allow
	decision.deny[_].code == "ACO_POLICY_MALFORMED_INPUT"
}

test_unsafe_artifact_path_denies if {
	unsafe_input := object.union(valid_input, {"artifacts": [{"id": "bad", "path": "../secret", "kind": "json"}]})
	decision := prompt_package.decision with input as unsafe_input
	not decision.allow
	decision.deny[_].code == "ACO_POLICY_UNSAFE_ARTIFACT_PATH"
}

test_secret_like_value_denies if {
	secret_input := object.union(valid_input, {"manifest": object.union(base_manifest, {"secret_token": "sk-abcdefghijklmnopqrstuvwxyz"})})
	decision := prompt_package.decision with input as secret_input
	not decision.allow
	decision.deny[_].code == "ACO_POLICY_SECRET_LIKE_VALUE"
}

test_unresolved_docs_warns_but_allows if {
	warn_input := object.union(valid_input, {"evidence": object.union(base_evidence, {"docs": {"unresolved": ["Open Policy Agent"], "targets": []}})})
	decision := prompt_package.decision with input as warn_input
	decision.allow
	decision.warn[_].code == "ACO_POLICY_UNRESOLVED_DOCS"
}

test_graph_waiver_warns_but_allows if {
	warn_input := object.union(valid_input, {"evidence": object.union(base_evidence, {"graph": {"status": "partial", "waiverCount": 1}})})
	decision := prompt_package.decision with input as warn_input
	decision.allow
	decision.warn[_].code == "ACO_POLICY_GRAPH_WAIVER"
}
