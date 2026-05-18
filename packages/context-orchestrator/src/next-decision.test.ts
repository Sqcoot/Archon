import { describe, expect, test } from 'bun:test';
import { buildNextDecision, type BuildNextDecisionInput } from './next-decision';
import type { EvidenceBlocker, GraphContext, LedgerBundleSummary, ValidationReport } from './types';

describe('next decision', () => {
  test('AC-NEXT-001 maps waived forbidden graph evidence to approval_required', () => {
    const decision = buildNextDecision(baseInput());

    expect(decision.schemaVersion).toBe('aco.next-decision.v1');
    expect(decision.kind).toBe('approval_required');
    expect(decision.waiverIds).toEqual([
      'graph-waiver.bmad-plugins-marketplace',
      'graph-waiver.bmad-sample-data',
    ]);
    expect(decision.evidenceBlockerIds).toEqual([]);
    expect(decision.primaryAction.requiresApproval).toBe(true);
    expect(decision.primaryAction.willRun).toBe(false);
  });

  test('AC-NEXT-002 failed validation has highest branch precedence', () => {
    const validationReport: ValidationReport = {
      status: 'failed',
      checks: [{ id: 'aco-policy', status: 'failed', message: 'denied' }],
    };

    const decision = buildNextDecision({ ...baseInput(), validationReport });

    expect(decision.kind).toBe('blocked_by_validation');
    expect(decision.primaryAction.kind).toBe('validation');
  });

  test('AC-NEXT-003 non-graph blockers win before graph approval with sorted IDs', () => {
    const decision = buildNextDecision({
      ...baseInput(),
      evidenceBlockers: [blocker('tool.z-docs'), blocker('tool.a-docs')],
    });

    expect(decision.kind).toBe('blocked_by_evidence');
    expect(decision.evidenceBlockerIds).toEqual(['tool.a-docs', 'tool.z-docs']);
  });

  test('AC-NEXT-004 graph without valid waiver approvals blocks', () => {
    const decision = buildNextDecision({
      ...baseInput(),
      evidenceResolution: { required: true, items: [] },
    });

    expect(decision.kind).toBe('blocked_by_graph');
    expect(decision.primaryAction.id).toBe('next.inspect-graph-evidence');
  });

  test('AC-NEXT-006 same input gives same output and does not mutate input', () => {
    const input = baseInput();
    const before = JSON.stringify(input);
    const first = buildNextDecision(input);
    const second = buildNextDecision(input);

    expect(second).toEqual(first);
    expect(JSON.stringify(input)).toBe(before);
  });
});

function baseInput(): BuildNextDecisionInput {
  return {
    contextIntent: {
      objective: 'Implement deterministic ACO Next Decision Engine.',
      normalizedObjective: 'implement deterministic aco next decision engine.',
      intentHash: 'intent-next-decision',
      cwd: '/repo',
      commitSha: 'abc123',
      generatedAt: '2026-05-18T12:00:00.000Z',
    },
    route: {
      id: 'brownfield-architecture',
      label: 'Brownfield architecture',
      steps: ['bmad-prd', 'bmad-create-architecture'],
      rationale: 'Architecture-sensitive request.',
    },
    readiness: 'needs_approval',
    validationReport: {
      status: 'passed',
      checks: [{ id: 'aco-policy', status: 'passed', message: 'ok' }],
    },
    graphContext: graphContext(),
    ledgerSummary: zeroLedgerSummary(),
    evidenceBlockers: [],
    evidenceResolution: {
      required: true,
      items: [
        {
          evidenceId: 'graph-waiver.bmad-sample-data',
          capabilityId: 'graph-context',
          targetKind: 'graph',
          targetName: 'bmad-sample-data',
          resolver: 'approval',
          reason: 'Graph failed.',
          nextAction: 'Keep waiver explicit.',
          requiresApproval: true,
          blockingAcceptanceIds: ['AC-ACO-WAIVER-001'],
          expectedSuccessEvidence: ['Waiver remains visible.'],
        },
        {
          evidenceId: 'graph-waiver.bmad-plugins-marketplace',
          capabilityId: 'graph-context',
          targetKind: 'graph',
          targetName: 'bmad-plugins-marketplace',
          resolver: 'approval',
          reason: 'Graph failed.',
          nextAction: 'Keep waiver explicit.',
          requiresApproval: true,
          blockingAcceptanceIds: ['AC-ACO-WAIVER-001'],
          expectedSuccessEvidence: ['Waiver remains visible.'],
        },
      ],
    },
  };
}

function graphContext(): GraphContext {
  return {
    status: 'forbidden',
    repositories: [],
    waiverCount: 2,
    waivers: [
      {
        id: 'graph-waiver.bmad-sample-data',
        repository: 'bmad-sample-data',
        owner: 'context-orchestrator',
        reason: 'Graph failed.',
        evidence: 'upstream-manifest.json',
        expiryCondition: 'Regenerate graph evidence.',
      },
      {
        id: 'graph-waiver.bmad-plugins-marketplace',
        repository: 'bmad-plugins-marketplace',
        owner: 'context-orchestrator',
        reason: 'Graph failed.',
        evidence: 'upstream-manifest.json',
        expiryCondition: 'Regenerate graph evidence.',
      },
    ],
    summary: '13 repositories indexed; 2 failed graph waiver(s) forbidden.',
  };
}

function blocker(id: string): EvidenceBlocker {
  return {
    id,
    kind: 'docs',
    status: 'partial',
    freshness: 'unknown',
    reason: 'Docs unresolved.',
    sourceArtifact: 'documentation-plan',
    nextVerificationAction: 'Resolve docs.',
  };
}

function zeroLedgerSummary(): LedgerBundleSummary {
  const counts = {
    available: 0,
    partial: 0,
    blocked: 0,
    deferred: 0,
    forbidden: 0,
    'not used': 0,
    unknown: 0,
  };
  return {
    toolAvailability: { total: 0, counts },
    commands: { total: 0, counts },
    combined: { total: 0, counts },
  };
}
