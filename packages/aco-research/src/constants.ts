import type { ResearchArtifactName } from './schemas';

export const REQUIRED_RESEARCH_ARTIFACTS = [
  'upstream-graph-manifest.json',
  'graph-waiver-closure.json',
  'agentic-search-report.json',
  'agentic-search.md',
] as const satisfies readonly ResearchArtifactName[];

export const REQUIRED_AGENTIC_SEARCH_SECTIONS = [
  'Objective and Intent Hash',
  'Candidate Implementation Surfaces',
  'Candidate Tests and Acceptance Markers',
  'Dependency and Context Graph References',
  'Evidence Gaps',
  'Disallowed Assumptions',
  'Recommended Next Slice',
] as const;

export const APPROVAL_REQUIRED_GRAPH_COMMAND = 'bun run research:graph';
export const APPROVAL_REQUIRED_GRAPH_SAFETY_CLASS = 'writes-graph-cache';
