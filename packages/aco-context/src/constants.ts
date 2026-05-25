import type { EvidenceRef } from '@archon/aco-core';

export const S8_CONSENSUS_EVIDENCE = {
  id: 'evidence.context.s8-consensus',
  source: 'party-mode-output-s8-consensus/next_goal_4000chars.txt',
  summary: 'S8 consensus selected ACO context contracts before workflow parity',
  confidence: 'high',
  freshness: 'fresh',
} as const satisfies EvidenceRef;

export const CONTEXT_COMMAND_LEDGER_EVIDENCE = {
  id: 'evidence.context.command-ledger',
  source: 'ledgers/command-ledger.csv#aco-context',
  summary: 'Command ledger assigns status, compile, and approval capsule surfaces to aco-context',
  confidence: 'high',
  freshness: 'unknown',
} as const satisfies EvidenceRef;

export const CONTEXT_ARTIFACT_EVIDENCE = {
  id: 'evidence.context.artifact-contracts',
  source: 'architecture/artifact-contracts.md',
  summary: 'Artifact contracts require deterministic schema, evidence, checksum, and freshness',
  confidence: 'high',
  freshness: 'unknown',
} as const satisfies EvidenceRef;

export const CONTEXT_WORKFLOW_DEFERRAL_EVIDENCE = {
  id: 'evidence.context.workflow-deferral',
  source: 'party-mode-output-s8-consensus/consensus_report.md',
  summary: 'Workflow parity is deferred until context primitives are implemented',
  confidence: 'high',
  freshness: 'fresh',
} as const satisfies EvidenceRef;

export const REQUIRED_CONTEXT_COMMAND_IDS = [
  'archon.context.status',
  'archon.context.compile',
  'archon.context.approval-capsule',
  'archon.context.approval-capsule-verify',
] as const;

export const REQUIRED_CONTEXT_LEDGER_NAMES = [
  'artifact',
  'capability',
  'command',
  'risk',
  'tool',
  'unknowns',
  'workflow',
] as const;
