import type { EvidenceRef } from '@archon/aco-core';

export const S9_CONSENSUS_EVIDENCE = {
  id: 'evidence.workflows.s9-consensus',
  source: 'party-mode-output-s9-consensus/next_goal_4000chars.txt',
  summary: 'S9 consensus selected workflow parity contracts after S8 context contracts',
  confidence: 'high',
  freshness: 'fresh',
} as const satisfies EvidenceRef;

export const S8_CONTEXT_EVIDENCE = {
  id: 'evidence.workflows.s8-context-contracts',
  source: 'party-mode-output-s8-consensus/next_goal_4000chars.txt',
  summary: 'S8 made context status, compile, approval capsule, and verification commands real',
  confidence: 'high',
  freshness: 'fresh',
} as const satisfies EvidenceRef;

export const WORKFLOW_LEDGER_EVIDENCE = {
  id: 'evidence.workflows.workflow-ledger',
  source: 'ledgers/workflow-ledger.csv',
  summary: 'Artifact-scoped workflow ledger lists context-orchestrate and adversarial loop parity',
  confidence: 'high',
  freshness: 'unknown',
} as const satisfies EvidenceRef;

export const DEFAULT_WORKFLOW_EVIDENCE = {
  id: 'evidence.workflows.default-bundle',
  source: '.archon/workflows/defaults',
  summary: 'Bundled default workflows are regenerated into @archon/workflows defaults',
  confidence: 'high',
  freshness: 'fresh',
} as const satisfies EvidenceRef;

export const REQUIRED_ACO_WORKFLOW_IDS = [
  'context-orchestrate',
  'archon-aco-adversarial-loop',
] as const;

export const REQUIRED_CONTEXT_ORCHESTRATE_NODES = [
  'status',
  'ledgers',
  'route',
  'compile',
  'approval-capsule',
  'verification',
  'handoff',
] as const;

export const REQUIRED_ADVERSARIAL_LOOP_NODES = [
  'coordinator',
  'skill-bmad-review',
  'search-evidence',
  'planner-contract',
  'generator-qa-evaluator',
  'feedback-handoff',
] as const;

export const REQUIRED_DEFERRED_COMMAND_ID = 'bun.aco.role-contracts';
export const REQUIRED_APPROVAL_COMMAND_ID = 'bun.research.graph';
