# ACO Codex Hook Test Coverage Investigation Goal Template

Investigate whether the current ACO-on-Codex hook tests for the target baseline are sufficient to prove `/aco:bootstrap-codex` is clean-room, complete, idempotent, and usable by the real Codex app/CLI, or whether follow-up is required before the hook surface can be treated as covered. Record the exact baseline branch and commit in the resulting evidence report, not in this reusable goal template.

Use the target Archon repository state, committed specs, hook templates, runner, cleanup command, real-Codex harness, acceptance tests, traceability matrix, and installed Codex CLI help/docs/source. Do not mutate user Codex config, credentials, auth, MCP OAuth material, provider credentials, graph evidence, or graph waivers. Do not run graph refresh. Prefer read-only inspection and targeted validation. Real-Codex probes must stay opt-in, use temporary `HOME`/`CODEX_HOME`/repo directories, enforce timeouts and noninteractive execution, and treat missing binary/auth as blocked evidence instead of a pass.

Primary question: are the hook tests enough? Distinguish covered behavior from missing or weak coverage across all ten events: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PreCompact`, `PostCompact`, `SubagentStart`, `SubagentStop`, and `Stop`. For each event, check spec assertion, schema/fixture coverage, runner/template coverage, simulated integration coverage, real-Codex evidence where the current release supports it, and cleanup/idempotency coverage. Also evaluate negative cases: malformed payloads, unknown events, blocked guardrail decisions, non-ACO files, symlink/path escape attempts, duplicate artifacts, stale run manifests, trust gating, auth/config secrecy, and release-unsupported events.

Use Archon as part of the investigation. Inspect slash and CLI alias surfaces for `/aco:bootstrap-codex`, `/aco:cleanup-codex`, and `archon aco cleanup-codex`. Run or document appropriate `bun run cli validate ... --json`, `aco:test:acceptance`, `aco:traceability`, and targeted acceptance tests only if needed. Do not rerun expensive full validation unless needed. Record commands, pass/fail state, and what they prove. Use installed Codex CLI/version/auth checks only in temporary harness mode or read-only status commands.

Expected artifacts:

1. This goal file, approximately 4000 characters, capturing scope, rules, acceptance questions, and output requirements.
2. `docs/context-orchestrator/research/aco-codex-hook-test-coverage-investigation.md`, a markdown investigation report with an event-by-event coverage matrix, current test inventory, Archon/Codex evidence, missing tests, recommended implementation sequence, and risk assessment.
3. Optional supporting markdown if the gap list is large enough to split. Keep artifacts implementation-ready: file paths, test names, concrete assertions, and command examples.

Acceptance for the investigation:

- The report states clearly whether the current tests are sufficient.
- Every hook event has a coverage verdict: enough, partial, missing, blocked, or release-unsupported.
- Every acceptance ID `ACO-CODEX-REAL-001..010` is mapped to existing coverage or a concrete missing test.
- The real-Codex smoke is assessed separately from pure fixture tests and simulated hook tests.
- Cleanup/idempotency is assessed as a first-class hook-system concern, including dry-run, runId scoping, protected paths, unmanaged files, and rerun behavior.
- Unsupported or inert hook events are not falsely counted as real-Codex proven.
- The report names the minimal tests to add next, with priority and expected fixture/harness shape.
- The report identifies any blocked unknowns, including Codex release semantics that cannot be proven without upstream support.
- The report is safe to attach to a future implementation prompt without needing this conversation context.

Final handoff should include artifact paths, a short answer to "are the tests enough?", commands run, validation result, and blocked/deferred items. Do not commit unless explicitly requested.
