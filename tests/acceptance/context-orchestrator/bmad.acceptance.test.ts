import { describe, expect, test } from 'bun:test';
import { routeBmad } from '@archon/context-orchestrator';

describe('ACO BMAD acceptance', () => {
  test('Spec: 006-bmad-routing-spec.md Acceptance: ACO-BMAD-001 ambiguous prompt falls back to bmad-help', () => {
    const route = routeBmad({ prompt: 'Help me think about this.' });
    expect(route.id).toBe('unknown-help');
    expect(route.steps).toEqual(['bmad-help']);
    expect(route.requiresDecision).toBe(true);
    expect(route.confidence).toBe('low');
    expect(route.nextRecommendedAction).toContain('scope');
  });

  test.each([
    {
      name: 'blocked urgent input',
      prompt: 'Production validation is blocked and urgent. Correct course before more work.',
      expected: 'correct-course',
      signal: 'blocked',
      requiresDecision: false,
    },
    {
      name: 'small typo fix',
      prompt: 'Fix a typo in one README as a small contained change.',
      expected: 'quick-contained',
      signal: 'typo',
      requiresDecision: false,
    },
    {
      name: 'architecture heavy input',
      prompt:
        'Implement an architecture-sensitive Archon context orchestrator with SDD, ATDD, workflow, policy, and traceability changes.',
      expected: 'brownfield-architecture',
      signal: 'architecture',
      requiresDecision: false,
    },
    {
      name: 'ambiguous input',
      prompt: 'Help me think about this.',
      expected: 'unknown-help',
      signal: 'help-request',
      requiresDecision: true,
    },
    {
      name: 'brownfield enhancement input',
      prompt:
        'Use the BMAD brownfield architecture route for this Archon package boundary enhancement.',
      expected: 'brownfield-architecture',
      signal: 'explicit-brownfield-route',
      requiresDecision: false,
    },
    {
      name: 'missing context input',
      prompt: 'Fix this.',
      expected: 'unknown-help',
      signal: 'unclear-pronoun',
      requiresDecision: true,
    },
    {
      name: 'explicit user intent input',
      prompt: 'Use BMAD brownfield architecture route for workflow policy stabilization.',
      expected: 'brownfield-architecture',
      signal: 'explicit-architecture-route',
      requiresDecision: false,
    },
    {
      name: 'slash goal input',
      prompt: '/goal stabilize-aco-merge-ready',
      expected: 'brownfield-architecture',
      signal: 'explicit-aco-stabilization-goal',
      requiresDecision: false,
    },
    {
      name: 'conflicting signals input',
      prompt: 'Make a quick typo fix that changes the architecture and workflow policy.',
      expected: 'unknown-help',
      signal: 'quick-fix',
      requiresDecision: true,
    },
  ] as const)(
    'Spec: 006-bmad-routing-spec.md Acceptance: ACO-BMAD-002 deterministic route for $name',
    ({ prompt, expected, signal, requiresDecision }) => {
      const route = routeBmad({ prompt });
      expect(route.id).toBe(expected);
      expect(route.matchedSignals).toContain(signal);
      expect(route.requiresDecision).toBe(requiresDecision);
      expect(route.nextRecommendedAction.length).toBeGreaterThan(0);
      expect(route.rejectedAlternatives.length).toBeGreaterThan(0);
    }
  );

  test('Spec: 006-bmad-routing-spec.md Acceptance: ACO-BMAD-003 no silent brownfield fallback', () => {
    const route = routeBmad({ prompt: 'Please improve it.' });
    expect(route.id).toBe('unknown-help');
    expect(route.requiresDecision).toBe(true);
    expect(route.rejectedAlternatives.map(item => item.id)).toContain('brownfield-architecture');
  });
});
