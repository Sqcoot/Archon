import { describe, expect, test } from 'bun:test';
import { createEvidenceClosurePlan } from './evidence-closure';
import { planDocumentation } from './docs';
import type {
  ContextIntent,
  DocumentationPlan,
  EvidenceBlocker,
  GraphContext,
  LedgerBundle,
  ValidationReport,
} from './types';

const timestamp = '2026-05-18T12:00:00.000Z';
const contextIntent: ContextIntent = {
  objective: 'Use Hono for a new API route.',
  normalizedObjective: 'use hono for a new api route.',
  intentHash: 'intent-hono',
  cwd: '/repo',
  commitSha: 'abc123',
  generatedAt: timestamp,
};
const docsBlocker: EvidenceBlocker = {
  id: 'tool.docs-evidence',
  kind: 'docs',
  status: 'partial',
  freshness: 'fresh',
  reason:
    'tool.docs-evidence is partial with fresh evidence: Unresolved library target limits confidence.',
  sourceArtifact: 'planDocumentation({ prompt })',
  nextVerificationAction:
    'Resolve docs targets with OpenAI Docs MCP or Context7, then re-run ACO status or compile.',
};

describe('Evidence Closure Planner', () => {
  test('AC-ACO-EVIDENCE-001 ignores imperative goal words as third-party libraries', () => {
    const plan = planDocumentation({
      prompt:
        'Identify the single next highest-leverage improvement to my Agentic Context Orchestrator using ledgers, tools, Archon, BMADs.',
    });

    expect(plan.unresolved).toEqual([]);
    expect(plan.targets.every(target => target.topic !== 'Identify')).toBe(true);
  });

  test('AC-ACO-EVIDENCE-001 creates Context7 closure work for unresolved third-party targets', () => {
    const documentationPlan = planDocumentation({ prompt: contextIntent.objective });
    const closurePlan = createEvidenceClosurePlan({
      contextIntent,
      documentationPlan,
      selectedCapabilities: { capabilities: [] },
      graphContext: graphContext('available'),
      validationReport: passedValidation(),
      ledgerBundle: ledgerBundle([docsBlocker]),
    });

    expect(documentationPlan.unresolved).toEqual(['Hono']);
    expect(closurePlan.required).toBe(true);
    expect(closurePlan.items).toHaveLength(1);
    expect(closurePlan.items[0]).toMatchObject({
      evidenceId: 'tool.docs-evidence',
      capabilityId: 'documentation-plan',
      targetKind: 'third-party',
      targetName: 'Hono',
      resolver: 'context7',
      requiresApproval: false,
    });
    expect(closurePlan.items[0]?.nextAction).toContain('ctx7@latest library Hono');
    expect(closurePlan.items[0]?.nextAction).toContain('ctx7@latest docs <libraryId>');
  });

  test('AC-ACO-EVIDENCE-001 routes unresolved OpenAI targets to OpenAI Docs MCP', () => {
    const documentationPlan: DocumentationPlan = {
      readiness: { openaiDocsMcp: 'available', context7: 'available' },
      targets: [
        {
          source: 'openai-docs-mcp',
          topic: 'OpenAI Codex SDK',
          status: 'unresolved',
          reason: 'OpenAI/Codex behavior must use official OpenAI documentation first.',
        },
      ],
      unresolved: ['OpenAI Codex SDK'],
    };
    const closurePlan = createEvidenceClosurePlan({
      contextIntent: { ...contextIntent, objective: 'Use OpenAI Codex SDK behavior.' },
      documentationPlan,
      selectedCapabilities: { capabilities: [] },
      graphContext: graphContext('available'),
      validationReport: passedValidation(),
      ledgerBundle: ledgerBundle([docsBlocker]),
    });

    expect(closurePlan.items[0]).toMatchObject({
      targetKind: 'openai',
      targetName: 'OpenAI Codex SDK',
      resolver: 'openai-docs-mcp',
    });
    expect(closurePlan.items[0]?.nextAction).toContain('OpenAI Docs MCP');
  });

  test('AC-ACO-WAIVER-001 reports graph waivers as approval closure items without clearing them', () => {
    const closurePlan = createEvidenceClosurePlan({
      contextIntent,
      documentationPlan: {
        readiness: { openaiDocsMcp: 'available', context7: 'available' },
        targets: [],
        unresolved: [],
      },
      selectedCapabilities: { capabilities: [] },
      graphContext: graphContext('forbidden'),
      validationReport: passedValidation(),
      ledgerBundle: ledgerBundle([]),
    });

    expect(closurePlan.required).toBe(true);
    expect(closurePlan.items).toHaveLength(1);
    expect(closurePlan.items[0]).toMatchObject({
      evidenceId: 'graph-waiver.test',
      resolver: 'approval',
      requiresApproval: true,
      targetKind: 'graph',
    });
  });
});

function graphContext(status: GraphContext['status']): GraphContext {
  return {
    status,
    repositories: [],
    waiverCount: status === 'forbidden' ? 1 : 0,
    waivers:
      status === 'forbidden'
        ? [
            {
              id: 'graph-waiver.test',
              repository: 'test-upstream',
              owner: 'context-orchestrator',
              reason: 'Graph evidence failed.',
              evidence: 'graph evidence',
              expiryCondition: 'Regenerate graph evidence with explicit approval.',
            },
          ]
        : [],
    summary: status,
  };
}

function passedValidation(): ValidationReport {
  return {
    status: 'passed',
    checks: [{ id: 'aco-test', status: 'passed', message: 'ok' }],
  };
}

function ledgerBundle(evidenceBlockers: EvidenceBlocker[]): LedgerBundle {
  return {
    schemaVersion: 'aco.ledger-bundle.v1',
    generatedAt: timestamp,
    contextIntent,
    toolAvailability: [],
    commands: [],
    evidenceBlockers,
    summary: {
      toolAvailability: { total: 0, counts: zeroCounts() },
      commands: { total: 0, counts: zeroCounts() },
      combined: { total: 0, counts: zeroCounts() },
    },
  };
}

function zeroCounts(): LedgerBundle['summary']['combined']['counts'] {
  return {
    available: 0,
    partial: 0,
    blocked: 0,
    deferred: 0,
    forbidden: 0,
    'not used': 0,
    unknown: 0,
  };
}
