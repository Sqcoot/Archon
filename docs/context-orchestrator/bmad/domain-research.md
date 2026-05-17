# ACO Domain Research

Date: 2026-05-17
BMAD action: `bmad-domain-research`

## Domain

ACO sits in the domain of agentic coding orchestration: it converts a request into an evidence-backed, route-aware, test-first prompt package that another coding agent can execute.

## Bounded Contexts

- Prompt Intake: normalize user request, target codebase, flags, and run identity.
- Evidence Collection: load graph, docs, baseline, and research corpus state.
- Graph Context: summarize repository structure and evidence availability.
- Documentation Resolution: choose OpenAI Docs MCP, Context7, or unresolved docs targets.
- Capability Routing: select which ACO capabilities are required for the prompt.
- BMAD Routing: map work type to BMAD phases and gates.
- Acceptance Planning: produce Given/When/Then scenarios before implementation.
- Prompt Package Compilation: render human and Codex prompts with traceability.
- Archive: write deterministic, redacted artifacts.
- Security Validation: path safety, secret redaction, env isolation, command safety.

## Core Domain Terms

- PromptPackage: final archived unit containing request, evidence, docs plan, BMAD route, acceptance plan, prompts, and validation report.
- CapabilityRoute: selected capability list and why each capability is required.
- DocumentationPlan: source selection and readiness for OpenAI Docs MCP, Context7, and unresolved third-party docs.
- BmadRoute: ordered BMAD workflow route and fallback route.
- AcceptancePlan: acceptance scenarios and validation gates.
- GraphContext: graph availability, summary, waivers, and open questions.

## User Value

Users get a repeatable first step before broad or architecture-sensitive coding: ACO returns a compact summary plus a Codex-ready prompt package that preserves evidence and acceptance criteria.

## Non-Goals

- ACO is not an autonomous implementation agent.
- ACO is not a replacement for Archon workflows.
- ACO is not a general MCP registry.
- ACO is not a database-backed analytics system in the first milestone.
