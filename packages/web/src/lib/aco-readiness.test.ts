import { describe, expect, test } from 'bun:test';
import type { AcoStatusResponse } from './api';
import {
  formatAcoEvidenceSummary,
  formatAcoHandoffNarrative,
  formatAcoLedgerCounts,
  getAcoReadinessLabel,
} from './aco-readiness';

const baseLedgerSummary: AcoStatusResponse['ledgerSummary'] = {
  toolAvailability: {
    total: 20,
    counts: {
      available: 17,
      partial: 1,
      blocked: 0,
      deferred: 0,
      forbidden: 2,
      'not used': 0,
      unknown: 0,
    },
  },
  commands: {
    total: 19,
    counts: {
      available: 9,
      partial: 1,
      blocked: 0,
      deferred: 3,
      forbidden: 6,
      'not used': 0,
      unknown: 0,
    },
  },
  combined: {
    total: 39,
    counts: {
      available: 26,
      partial: 2,
      blocked: 0,
      deferred: 3,
      forbidden: 8,
      'not used': 0,
      unknown: 0,
    },
  },
};

const baseStatus: AcoStatusResponse = {
  cwd: '/repo',
  contextIntent: {
    objective: 'Implement native loop',
    normalizedObjective: 'implement native loop',
    intentHash: 'intent-123',
    cwd: '/repo',
    commitSha: 'abc123',
    generatedAt: '2026-05-18T12:00:00.000Z',
  },
  validationStatus: 'passed',
  graphStatus: 'forbidden',
  graphWaivers: 2,
  graphWaiverIds: ['graph-waiver.bmad-plugins-marketplace', 'graph-waiver.bmad-sample-data'],
  waivers: [],
  approvalRequired: true,
  readiness: 'needs_approval',
  ledgerSchemaVersion: 'aco.ledger-bundle.v1',
  evidenceBlockers: [],
  evidenceResolution: {
    required: true,
    items: [
      {
        evidenceId: 'graph-waiver.bmad-plugins-marketplace',
        capabilityId: 'graph-context',
        targetKind: 'graph',
        targetName: 'bmad-plugins-marketplace',
        resolver: 'approval',
        reason: 'Graph evidence failed.',
        nextAction: 'Keep waiver explicit or request graph refresh approval.',
        requiresApproval: true,
        blockingAcceptanceIds: ['AC-ACO-WAIVER-001'],
        expectedSuccessEvidence: ['Graph waiver remains visible.'],
      },
    ],
  },
  ledgerSummary: baseLedgerSummary,
  nextDecision: {
    schemaVersion: 'aco.next-decision.v1',
    kind: 'approval_required',
    title: 'Approval required',
    summary: 'Implementation needs explicit graph waiver approval.',
    primaryAction: {
      id: 'next.approve-current-graph-waivers',
      kind: 'approval',
      label: 'Approve preserving current graph waivers',
      requiresApproval: true,
      willRun: false,
      successEvidence: ['User approves preserving listed graph waivers.'],
    },
    secondaryActions: [],
    decisionFactors: [],
    evidenceSummary: {
      readiness: 'needs_approval',
      validationStatus: 'passed',
      graphStatus: 'forbidden',
      graphWaivers: 2,
      evidenceBlockers: 0,
      evidenceResolutionRequired: true,
      ledgerSummary: baseLedgerSummary,
    },
    waiverIds: ['graph-waiver.bmad-plugins-marketplace', 'graph-waiver.bmad-sample-data'],
    evidenceBlockerIds: [],
    evidenceResolutionIds: ['graph-waiver.bmad-plugins-marketplace'],
    nextPrompt: 'Request explicit approval before implementation.',
  },
};

describe('ACO readiness display helpers', () => {
  test('AC-P1-WEB AC-FORBIDDEN-GRAPH-001 keeps graph waivers approval-gated', () => {
    expect(getAcoReadinessLabel(baseStatus)).toBe('Needs approval');
    expect(formatAcoEvidenceSummary(baseStatus)).toBe(
      'intent intent-123 · validation passed · graph forbidden · 2 approval-required graph limits · 39 ledger rows · 0 blockers · 1 closure actions · 0 unknown'
    );
  });

  test('AC-P3-WF formats workflow dashboard and run detail ledger counts from canonical status', () => {
    expect(formatAcoLedgerCounts(baseStatus)).toBe(
      'total 39 · available 26 · partial 2 · deferred 3 · forbidden 8 · unknown 0'
    );
  });

  test('AC-P3-PR creates PR/handoff text with forbidden graph waivers and no ready claim', () => {
    const narrative = formatAcoHandoffNarrative(baseStatus);

    expect(narrative).toContain('Context Orchestrator Readiness: Needs approval');
    expect(narrative).toContain('Intent: intent-123');
    expect(narrative).toContain('Validation: passed');
    expect(narrative).toContain('Graph: forbidden');
    expect(narrative).toContain('graph-waiver.bmad-plugins-marketplace');
    expect(narrative).toContain('graph-waiver.bmad-sample-data');
    expect(narrative).toContain('Ledger: aco.ledger-bundle.v1; total 39');
    expect(narrative).toContain('Evidence blockers:\n- none');
    expect(narrative).toContain('Evidence resolution:\n- graph-waiver.bmad-plugins-marketplace');
    expect(narrative).toContain('Needs approval: failed waiver-required graph evidence');
    expect(narrative).not.toContain('Ready with known limits');
    expect(narrative).not.toContain('complete graph coverage');
  });

  test('AC-P3-WF keeps unknown evidence visible instead of collapsing to full readiness', () => {
    const status: AcoStatusResponse = {
      ...baseStatus,
      graphStatus: 'available',
      graphWaivers: 0,
      graphWaiverIds: [],
      waivers: [],
      approvalRequired: false,
      readiness: 'ready',
      ledgerSummary: {
        ...baseStatus.ledgerSummary,
        combined: {
          ...baseStatus.ledgerSummary.combined,
          counts: {
            ...baseStatus.ledgerSummary.combined.counts,
            unknown: 2,
          },
        },
      },
    };

    expect(getAcoReadinessLabel(status)).toBe('Ready');
    expect(formatAcoEvidenceSummary(status)).toContain('2 unknown');
  });
});
