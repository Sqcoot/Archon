import { bmadContractArtifactNameValues } from './schemas';
import type { BmadContractArtifactName } from './schemas';

export const REQUIRED_BMAD_ROLE_IDS = [
  'coordinator-triage',
  'skill-curator',
  'bmad-reviewer',
  'agentic-search',
  'planner',
  'contract',
  'generator',
  'qa-verifier',
  'evaluator',
] as const;

export const REQUIRED_BMAD_CONTRACT_ARTIFACTS = [
  ...bmadContractArtifactNameValues,
] as const satisfies readonly BmadContractArtifactName[];
