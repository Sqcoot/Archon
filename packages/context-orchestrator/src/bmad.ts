import type { BmadRejectedAlternative, BmadRoute } from './types';

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

type RouteId = BmadRoute['id'];

interface RouteSignal {
  id: string;
  pattern: RegExp;
}

const correctCourseSignals: RouteSignal[] = [
  { id: 'blocked', pattern: /\bblocked\b/ },
  { id: 'urgent-recovery', pattern: /\b(?:urgent|regression|broken|failing|failure)\b/ },
  { id: 'correct-course', pattern: /\bcorrect[- ]course\b/ },
];

const quickSignals: RouteSignal[] = [
  { id: 'typo', pattern: /\btypo\b/ },
  { id: 'small-contained', pattern: /\bsmall (?:contained|bounded)\b/ },
  { id: 'quick-fix', pattern: /\bquick(?: fix)?\b/ },
  { id: 'single-file', pattern: /\bsingle[- ]file\b/ },
];

const architectureSignals: RouteSignal[] = [
  { id: 'aco', pattern: /\baco\b/ },
  { id: 'product-gate', pattern: /\b(?:gate|dossier|capsule|readiness)\b/ },
  { id: 'architecture', pattern: /\barchitecture|architectural|architecture-sensitive\b/ },
  { id: 'brownfield', pattern: /\bbrownfield\b/ },
  { id: 'sdd-atdd', pattern: /\b(?:sdd|atdd)\b/ },
  { id: 'orchestrator', pattern: /\borchestrator\b/ },
  { id: 'package-boundary', pattern: /\bpackage boundar(?:y|ies)\b/ },
  { id: 'workflow-policy', pattern: /\bworkflow|policy|traceability\b/ },
];

const explicitBrownfieldSignals: RouteSignal[] = [
  { id: 'explicit-brownfield-route', pattern: /\buse (?:the )?bmad brownfield\b/ },
  { id: 'explicit-architecture-route', pattern: /\bbrownfield architecture route\b/ },
  { id: 'explicit-aco-stabilization-goal', pattern: /\/goal stabilize-aco-merge-ready\b/ },
  { id: 'explicit-route-analytics-work', pattern: /\broute analytics\b/ },
];

const missingContextSignals: RouteSignal[] = [
  { id: 'help-request', pattern: /\bhelp(?: me)?(?: think)?\b/ },
  { id: 'unclear-pronoun', pattern: /\bthis\b/ },
  { id: 'unspecified-task', pattern: /^\s*(?:help|fix|do it|work on this)\s*\.?\s*$/ },
];

export function routeBmad(options: RouteBmadOptions): BmadRoute {
  const prompt = normalizePrompt(options.prompt);
  const lower = prompt.toLowerCase();
  const correctCourse = matchSignals(lower, correctCourseSignals);
  const quick = matchSignals(lower, quickSignals);
  const architecture = matchSignals(lower, architectureSignals);
  const explicitBrownfield = matchSignals(lower, explicitBrownfieldSignals);
  const missingContext = matchSignals(lower, missingContextSignals);

  if (correctCourse.length > 0) {
    return route({
      id: 'correct-course',
      label: 'Correct course',
      steps: ['bmad-correct-course'],
      rationale: 'Prompt contains blocker or recovery signals.',
      confidence: 'high',
      matchedSignals: correctCourse,
      rejectedAlternatives: reject(['quick-contained', 'brownfield-architecture', 'unknown-help']),
      fallbackBehavior: 'If blocker is stale, re-run route with current validation evidence.',
      nextRecommendedAction: 'Run bmad-correct-course before more implementation work.',
      requiresDecision: false,
    });
  }

  if (quick.length > 0 && architecture.length === 0) {
    return route({
      id: 'quick-contained',
      label: 'Quick contained change',
      steps: ['bmad-prd', 'bmad-quick-dev'],
      rationale: 'Prompt is small, bounded, and lacks architecture-control signals.',
      confidence: 'medium',
      matchedSignals: quick,
      rejectedAlternatives: reject(['brownfield-architecture', 'correct-course', 'unknown-help']),
      fallbackBehavior: 'Escalate to brownfield architecture route if scope expands.',
      nextRecommendedAction: 'Confirm narrow scope, then run bmad-quick-dev.',
      requiresDecision: false,
    });
  }

  if (quick.length > 0 && architecture.length > 0) {
    return unknownRoute({
      rationale: 'Prompt has conflicting quick-change and architecture-sensitive signals.',
      matchedSignals: [...quick, ...architecture],
      nextRecommendedAction: 'Clarify whether this is a narrow fix or architecture-sensitive work.',
    });
  }

  if (explicitBrownfield.length > 0 || architecture.length >= 2) {
    const signals = [...explicitBrownfield, ...architecture];
    return route({
      id: 'brownfield-architecture',
      label: 'Brownfield architecture-sensitive route',
      steps: brownfieldSteps,
      rationale:
        'Prompt has explicit or repeated architecture-sensitive signals requiring full BMAD context.',
      confidence: explicitBrownfield.length > 0 ? 'high' : 'medium',
      matchedSignals: signals,
      rejectedAlternatives: reject(['quick-contained', 'correct-course', 'unknown-help']),
      fallbackBehavior:
        'If evidence is missing, stop at documentation/research before architecture.',
      nextRecommendedAction:
        'Generate project context, research evidence, then validate PRD before architecture.',
      requiresDecision: false,
    });
  }

  if (missingContext.length > 0 || prompt.length < 24 || architecture.length === 1) {
    return unknownRoute({
      rationale: 'Prompt lacks enough route evidence for a production BMAD path.',
      matchedSignals: [...missingContext, ...architecture],
      nextRecommendedAction:
        'Ask for objective, scope, risk level, and affected package before routing.',
    });
  }

  return unknownRoute({
    rationale: 'No deterministic BMAD route signals matched.',
    matchedSignals: [],
    nextRecommendedAction: 'Collect task scope and desired BMAD route before implementation.',
  });
}

function route(input: BmadRoute): BmadRoute {
  return {
    ...input,
    matchedSignals: sortedUnique(input.matchedSignals),
    rejectedAlternatives: input.rejectedAlternatives.sort((left, right) =>
      left.id.localeCompare(right.id)
    ),
  };
}

function unknownRoute(input: {
  rationale: string;
  matchedSignals: string[];
  nextRecommendedAction: string;
}): BmadRoute {
  return route({
    id: 'unknown-help',
    label: 'BMAD help',
    steps: ['bmad-help'],
    rationale: input.rationale,
    confidence: 'low',
    matchedSignals: input.matchedSignals,
    rejectedAlternatives: reject(['brownfield-architecture', 'quick-contained', 'correct-course']),
    fallbackBehavior: 'Return needs_decision until user clarifies route-driving evidence.',
    nextRecommendedAction: input.nextRecommendedAction,
    requiresDecision: true,
  });
}

function reject(ids: RouteId[]): BmadRejectedAlternative[] {
  return ids.map(id => ({
    id,
    label: routeLabel(id),
    reason: 'Not selected for current matched signals.',
  }));
}

function routeLabel(id: RouteId): string {
  switch (id) {
    case 'brownfield-architecture':
      return 'Brownfield architecture-sensitive route';
    case 'quick-contained':
      return 'Quick contained change';
    case 'correct-course':
      return 'Correct course';
    case 'unknown-help':
      return 'BMAD help';
  }
}

function matchSignals(prompt: string, signals: RouteSignal[]): string[] {
  return signals.filter(signal => signal.pattern.test(prompt)).map(signal => signal.id);
}

function normalizePrompt(prompt: string): string {
  return prompt.replace(/\s+/g, ' ').trim();
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}
