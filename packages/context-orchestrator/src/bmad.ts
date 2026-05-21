import type { BmadRoute } from './types';

const brownfieldSteps = [
  'bmad-index-docs',
  'bmad-generate-project-context',
  'bmad-document-project',
  'bmad-domain-research',
  'bmad-technical-research',
  'bmad-investigate',
  'bmad-product-brief',
  'bmad-prd',
  'bmad-create-architecture',
  'bmad-review-adversarial-general',
  'bmad-review-edge-case-hunter',
  'bmad-create-epics-and-stories',
  'bmad-check-implementation-readiness',
  'bmad-sprint-planning',
];

export interface RouteBmadOptions {
  prompt: string;
}

export function routeBmad(options: RouteBmadOptions): BmadRoute {
  const lower = options.prompt.toLowerCase();

  if (
    lower.includes('correct-course') ||
    lower.includes('correct course') ||
    lower.includes('blocked')
  ) {
    return {
      id: 'correct-course',
      label: 'Correct course',
      steps: ['bmad-correct-course'],
      rationale: 'The prompt indicates a disrupted or blocked plan.',
    };
  }

  if (lower.includes('help me think') || lower.trim() === 'help' || lower.length < 24) {
    return {
      id: 'unknown-help',
      label: 'BMAD help',
      steps: ['bmad-help'],
      rationale: 'The task is ambiguous and should be routed through BMAD help.',
    };
  }

  if (lower.includes('typo') || lower.includes('small contained') || lower.includes('quick')) {
    return {
      id: 'quick-contained',
      label: 'Quick contained change',
      steps: ['bmad-prd', 'bmad-quick-dev'],
      rationale: 'The prompt appears small and bounded.',
    };
  }

  return {
    id: 'brownfield-architecture',
    label: 'Brownfield architecture-sensitive route',
    steps: brownfieldSteps,
    rationale:
      'Archon implementation work should gather context, validate PRD, then create architecture.',
  };
}
