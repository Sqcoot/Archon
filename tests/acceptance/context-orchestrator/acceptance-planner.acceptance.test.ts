import { describe, expect, test } from 'bun:test';
import { createAcceptancePlan, routeBmad } from '@archon/context-orchestrator';

describe('ACO acceptance planner acceptance', () => {
  test('Spec: 016-acceptance-test-plan.md Acceptance: ACO-ACCEPT-001 implementation prompts get SDD and ATDD scenarios first', () => {
    const route = routeBmad({ prompt: 'Implement a CLI feature in Archon.' });
    const plan = createAcceptancePlan({
      prompt: 'Implement a CLI feature in Archon.',
      route,
    });
    expect(plan.scenarios.some(scenario => scenario.id === 'ACO-IMPLEMENT-SDD-FIRST')).toBe(true);
    expect(plan.scenarios.some(scenario => scenario.id === 'ACO-IMPLEMENT-ATDD-FIRST')).toBe(true);
  });
});
