import { describe, expect, test } from 'bun:test';
import { routeBmad } from '@archon/context-orchestrator';

describe('ACO BMAD acceptance', () => {
  test('Spec: 006-bmad-routing-spec.md Acceptance: ACO-BMAD-001 ambiguous prompt falls back to bmad-help', () => {
    const route = routeBmad({ prompt: 'Help me think about this.' });
    expect(route.id).toBe('unknown-help');
    expect(route.steps).toEqual(['bmad-help']);
  });
});
