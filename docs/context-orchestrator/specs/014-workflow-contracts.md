# Context Orchestrator Workflow Contracts

AC-P3-WF covers the `context-orchestrate` workflow default.

Required behavior:

- Read status and ledgers from the repository-native CLI.
- Compile a context package into `$ARTIFACTS_DIR/context-orchestrator`.
- Write `graph-validation-gate.json` from compile output.
- Generate and verify an approval capsule when forbidden graph evidence requires it.
- Pause with explicit approval messages and `capture_response: true`.
- Always write a final handoff summary through an `all_done` trigger.

The workflow must not clear graph waivers, refresh graph evidence, mutate provider auth, or treat approval as a blanket permission beyond the current run.

AC-P3-WF also covers the `archon-aco-adversarial-loop` default when a contracted ACO loop is used.
Codex execution is selected with an execution-time provider override on the canonical workflow,
for example `archon workflow run archon-aco-adversarial-loop --provider codex`. Role contracts
remain workflow artifacts/nodes and must not claim Codex subagents or Codex runtime tool
restrictions for ACO authority.

Required behavior:

- Collect ACO status, ledgers, compile output, readiness input, and explicit approval records before role artifacts run.
- Enforce ACO-ADV-006 role contracts across the adversarial loop:
  - Coordinator/Triage routes the request, detects decision-grade ambiguity, chooses the ACO/BMAD path, and owns final handoff after the Evaluator verdict.
  - Agentic Search writes a read-only evidence packet covering surfaces, tests, acceptance markers, source diffs, graph evidence, and source-disposition gaps.
  - Planner writes bounded plans and acceptance criteria only.
  - Skill Curator selects repo-available tools, skills, commands, and workflows while rejecting unsupported runtime claims.
  - Contract writes objective-bound criteria with observable proof and `acoContextRefs`.
  - Generator writes implementation/artifact reports only and cannot claim readiness.
  - QA/Verifier checks criteria and deterministic evidence gaps without goal-completion authority.
  - BMAD Reviewer reviews method quality and missing ACO/BMAD sequence steps as advisory evidence only.
  - Feedback/Handoff routes from the Evaluator verdict and `goalCompletion`.
- Keep Generator artifact output uncertified with `certification: "not-certified-by-generator"`.
- Keep QA/Verifier scoped to contract and evidence checks; it must not declare final readiness or original goal completion.
- Make Evaluator the final independent goal-completion judge. Evaluator must answer: "Can we honestly claim the original goal is done?"
- Require evaluator verdicts to include `originalObjective` and `goalCompletion` with status, claimability, rationale, checked evidence, blockers, and required next action.
- Allow Evaluator verdict `passed` only when `goalCompletion.status` is `complete` and `goalCompletion.canClaimComplete` is `true`.
- Route Feedback and Handoff from Evaluator `goalCompletion`, not merely from contract scores or findings count.

ACO-ADV-006 acceptance covers all adversarial-loop role boundaries. ACO-ADV-007 acceptance covers the Evaluator contract. Dirty worktree evidence, active graph waivers, `needs_approval`, failed validation, stale artifacts, unknown runtime claims, or unresolved source-disposition gaps prevent a `passed` Evaluator verdict.
