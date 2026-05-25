# ACO BMAD Contracts Migration

S5 adds `@archon/aco-bmad-contracts` as a pure contract package for BMAD/ACO role boundaries, evaluator authority, adversarial loop summaries, and uncertainty-router packets.

This package is intentionally contract-only. It validates and renders role artifacts, but it does not run party mode, spawn subagents, wire workflow orchestration, call provider SDKs, mutate repositories, or persist artifacts.

Future CLI/workflow slices may consume these contracts to validate generated role artifacts. Until provider runtime evidence proves native subagent enforcement, BMAD/ACO roles must remain `workflow-artifact-contract` records rather than runtime capability claims.
