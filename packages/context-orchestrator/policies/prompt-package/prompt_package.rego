package archon.context_orchestrator.prompt_package

policy_version := "aco-prompt-package-v1"

default allow := false

allow if count(deny) == 0

decision := {
	"allow": allow,
	"deny": deny,
	"warn": warn,
	"policy_version": policy_version,
}

required_evidence_codes := {
	"graph": "ACO_POLICY_MISSING_GRAPH_EVIDENCE",
	"docs": "ACO_POLICY_MISSING_DOCS_EVIDENCE",
	"bmad": "ACO_POLICY_MISSING_BMAD_EVIDENCE",
	"acceptance": "ACO_POLICY_MISSING_ACCEPTANCE_EVIDENCE",
	"security": "ACO_POLICY_MISSING_SECURITY_EVIDENCE",
}

required_spec_refs := {
	"docs/context-orchestrator/specs/008-prompt-package-spec.md",
	"docs/context-orchestrator/specs/021-opa-prompt-package-policy-spec.md",
}

deny contains finding("ACO_POLICY_MALFORMED_INPUT", "Prompt package policy input must be an object.", "", "deny") if {
	not is_object(input)
}

deny contains finding("ACO_POLICY_MISSING_METADATA", sprintf("Missing required metadata field: %s.", [field]), sprintf("/%s", [field]), "deny") if {
	root_object
	field := ["schema_version", "package_id", "generated_at"][_]
	not non_empty_string(object.get(input, field, ""))
}

deny contains finding("ACO_POLICY_MISSING_METADATA", "Missing required source request text.", "/source_request/text", "deny") if {
	root_object
	not has_source_request_text
}

deny contains finding("ACO_POLICY_MALFORMED_INPUT", "artifacts must be an array.", "/artifacts", "deny") if {
	root_object
	not is_array(object.get(input, "artifacts", null))
}

deny contains finding("ACO_POLICY_MALFORMED_INPUT", "evidence must be an object.", "/evidence", "deny") if {
	root_object
	not is_object(object.get(input, "evidence", null))
}

deny contains finding(code, sprintf("Missing required evidence section: evidence.%s.", [section]), sprintf("/evidence/%s", [section]), "deny") if {
	root_object
	evidence := object.get(input, "evidence", {})
	is_object(evidence)
	code := required_evidence_codes[section]
	not is_object(object.get(evidence, section, null))
}

deny contains finding("ACO_POLICY_UNSAFE_ARTIFACT_PATH", sprintf("Artifact path is unsafe: %s.", [path]), sprintf("/artifacts/%d/path", [index]), "deny") if {
	root_object
	artifacts := object.get(input, "artifacts", [])
	is_array(artifacts)
	artifact := artifacts[index]
	is_object(artifact)
	path := object.get(artifact, "path", "")
	unsafe_artifact_path(path)
}

deny contains finding("ACO_POLICY_MALFORMED_INPUT", sprintf("Artifact path is missing at index %d.", [index]), sprintf("/artifacts/%d/path", [index]), "deny") if {
	root_object
	artifacts := object.get(input, "artifacts", [])
	is_array(artifacts)
	artifact := artifacts[index]
	is_object(artifact)
	not non_empty_string(object.get(artifact, "path", ""))
}

deny contains finding("ACO_POLICY_SECRET_LIKE_VALUE", "Manifest or artifact references contain secret-like material.", "/manifest", "deny") if {
	root_object
	secret_scan_text := lower(json.marshal({
		"manifest": object.get(input, "manifest", {}),
		"artifacts": object.get(input, "artifacts", []),
	}))
	regex.match("(secret|api[_-]?key|token|password|sk-[a-z0-9]{16,}|ghp_[a-z0-9_]{16,}|npm_[a-z0-9_]{16,}|akia[0-9a-z]{16})", secret_scan_text)
}

deny contains finding("ACO_POLICY_MISSING_REPRODUCIBILITY_LINKAGE", "Manifest must link to the upstream manifest.", "/manifest/upstreamManifest", "deny") if {
	root_object
	manifest := object.get(input, "manifest", {})
	is_object(manifest)
	not non_empty_string(object.get(manifest, "upstreamManifest", ""))
}

deny contains finding("ACO_POLICY_MISSING_REPRODUCIBILITY_LINKAGE", sprintf("Manifest must link to required spec: %s.", [spec]), "/manifest/specs", "deny") if {
	root_object
	manifest := object.get(input, "manifest", {})
	is_object(manifest)
	specs := object.get(manifest, "specs", [])
	spec := required_spec_refs[_]
	not array_contains(specs, spec)
}

warn contains finding("ACO_POLICY_GRAPH_WAIVER", "Graph evidence is partial or waived.", "/evidence/graph", "warn") if {
	graph_evidence.status == "partial"
}

warn contains finding("ACO_POLICY_GRAPH_WAIVER", "Graph evidence is partial or waived.", "/evidence/graph", "warn") if {
	graph_evidence.waiverCount > 0
}

warn contains finding("ACO_POLICY_UNRESOLVED_DOCS", "Documentation evidence contains unresolved library identity.", "/evidence/docs", "warn") if {
	docs_evidence.unresolved[_]
}

warn contains finding("ACO_POLICY_UNRESOLVED_DOCS", "Documentation evidence contains unresolved library identity.", "/evidence/docs/targets", "warn") if {
	target := docs_evidence.targets[_]
	object.get(target, "status", "") == "unresolved"
}

root_object if is_object(input)

has_source_request_text if {
	source_request := object.get(input, "source_request", {})
	is_object(source_request)
	non_empty_string(object.get(source_request, "text", ""))
}

non_empty_string(value) if {
	is_string(value)
	count(value) > 0
}

unsafe_artifact_path(path) if {
	is_string(path)
	startswith(path, "/")
}

unsafe_artifact_path(path) if {
	is_string(path)
	contains(path, "..")
}

array_contains(values, value) if {
	is_array(values)
	values[_] == value
}

graph_evidence := graph if {
	root_object
	evidence := object.get(input, "evidence", {})
	is_object(evidence)
	graph := object.get(evidence, "graph", {})
	is_object(graph)
}

docs_evidence := docs if {
	root_object
	evidence := object.get(input, "evidence", {})
	is_object(evidence)
	docs := object.get(evidence, "docs", {})
	is_object(docs)
}

finding(code, message, path, severity) := {
	"code": code,
	"message": message,
	"path": path,
	"severity": severity,
}
