import type { AcceptancePlan, AcceptanceScenario, BmadRoute } from './types';

export interface CreateAcceptancePlanOptions {
  prompt: string;
  route: BmadRoute;
}

export function createAcceptancePlan(options: CreateAcceptancePlanOptions): AcceptancePlan {
  const scenarios: AcceptanceScenario[] = [
    {
      id: 'ACO-IMPLEMENT-SDD-FIRST',
      spec: '016-acceptance-test-plan.md',
      given: 'a user asks for implementation',
      when: 'ACO compiles a Codex prompt',
      then: 'the prompt instructs Codex to create or update specs before production code',
    },
    {
      id: 'ACO-IMPLEMENT-ATDD-FIRST',
      spec: '016-acceptance-test-plan.md',
      given: 'a user asks for implementation',
      when: 'ACO compiles a Codex prompt',
      then: 'the prompt instructs Codex to define acceptance scenarios before production code',
    },
    {
      id: 'ACO-PROMPT-PACKAGE-TRACEABILITY',
      spec: '008-prompt-package-spec.md',
      given: 'a prompt package is compiled',
      when: 'final-prompt-package.md is opened',
      then: 'it references specs, graph status, docs plan, BMAD route, acceptance criteria, and unknowns',
    },
  ];

  if (options.route.id === 'brownfield-architecture') {
    scenarios.push({
      id: 'ACO-BMAD-BROWNFIELD-ROUTE',
      spec: '006-bmad-routing-spec.md',
      given: 'an architecture-sensitive Archon implementation request',
      when: 'ACO routes the prompt',
      then: 'the route includes technical research before PRD and architecture after PRD',
    });
  }

  return {
    status: 'ready',
    scenarios,
  };
}
