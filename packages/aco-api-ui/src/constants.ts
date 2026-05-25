import type { EvidenceRef } from '@archon/aco-core';

export const API_UI_PARITY_ROUTE = '/api/aco/parity';
export const API_UI_PARITY_UI_ROUTE = '/aco';

export const TERMINAL_NEXT_SLICE = 'complete';

export const REQUIRED_API_UI_SURFACE_IDS = ['api.aco.parity', 'ui.aco.parity'] as const;

export const REQUIRED_SLICE_IDS = [
  'S1',
  'S2',
  'S3',
  'S4',
  'S5',
  'S6',
  'S7',
  'S8',
  'S9',
  'S10',
] as const;

export const S10_CONSENSUS_EVIDENCE = {
  id: 'evidence.api-ui.s10-consensus',
  source: 'party-mode-output-s10-consensus/next_goal_4000chars.txt',
  summary: 'S10 consensus selected terminal API/UI parity over committed ACO contracts',
  confidence: 'high',
  freshness: 'fresh',
} as const satisfies EvidenceRef;

export const API_UI_SURFACE_EVIDENCE = {
  id: 'evidence.api-ui.public-surface',
  source: 'packages/server/src/routes/api.ts and packages/web/src/App.tsx',
  summary: 'Existing API and web route surfaces are the public boundary for ACO parity',
  confidence: 'high',
  freshness: 'fresh',
} as const satisfies EvidenceRef;
