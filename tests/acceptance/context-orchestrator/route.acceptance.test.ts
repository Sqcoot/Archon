import { describe, expect, test } from 'bun:test';
import { routeBmad } from '@archon/context-orchestrator';

describe('ACO route acceptance', () => {
  test('Spec: 006-bmad-routing-spec.md Acceptance: ACO-ROUTE-001 architecture-sensitive Archon work uses brownfield route', () => {
    const route = routeBmad({
      prompt:
        'Implement an architecture-sensitive context orchestrator inside Archon using SDD and ATDD.',
    });
    expect(route.id).toBe('brownfield-architecture');
    expect(route.steps).toContain('bmad-generate-project-context');
    expect(route.steps).toContain('bmad-technical-research');
    expect(route.steps.indexOf('bmad-prd')).toBeLessThan(
      route.steps.indexOf('bmad-create-architecture')
    );
  });
});
