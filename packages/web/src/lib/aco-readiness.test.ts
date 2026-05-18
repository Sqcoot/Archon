import { describe, expect, test } from 'bun:test';
import type { AcoStatusResponse } from './api';
import {
  formatAcoEvidenceSummary,
  formatAcoHandoffNarrative,
  formatAcoLedgerCounts,
  getAcoReadinessLabel,
} from './aco-readiness';

const baseStatus: AcoStatusResponse = {
  cwd: '/repo',
  validationStatus: 'passed',
  graphStatus: 'forbidden',
  graphWaivers: 2,
  graphWaiverIds: ['graph-waiver.bmad-plugins-marketplace', 'graph-waiver.bmad-sample-data'],
  ledgerSchemaVersion: 'aco.ledger-bundle.v1',
  ledgerSummary: {
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
  },
};

describe('ACO readiness display helpers', () => {
  test('AC-P1-WEB AC-FORBIDDEN-GRAPH-001 keeps forbidden graph waivers blocked', () => {
    expect(getAcoReadinessLabel(baseStatus)).toBe('Blocked by forbidden graph limits');
    expect(formatAcoEvidenceSummary(baseStatus)).toBe(
      'validation passed · graph forbidden · 2 forbidden graph limits · 39 ledger rows · 0 unknown'
    );
  });

  test('AC-P3-WF formats workflow dashboard and run detail ledger counts from canonical status', () => {
    expect(formatAcoLedgerCounts(baseStatus)).toBe(
      'total 39 · available 26 · partial 2 · deferred 3 · forbidden 8 · unknown 0'
    );
  });

  test('AC-P3-PR creates PR/handoff text with forbidden graph waivers and no ready claim', () => {
    const narrative = formatAcoHandoffNarrative(baseStatus);

    expect(narrative).toContain('ACO Readiness: Blocked by forbidden graph limits');
    expect(narrative).toContain('Validation: passed');
    expect(narrative).toContain('Graph: forbidden');
    expect(narrative).toContain('graph-waiver.bmad-plugins-marketplace');
    expect(narrative).toContain('graph-waiver.bmad-sample-data');
    expect(narrative).toContain('Ledger: aco.ledger-bundle.v1; total 39');
    expect(narrative).toContain('Forbidden graph limits: failed waiver-required graph evidence');
    expect(narrative).not.toContain('Ready with known limits');
    expect(narrative).not.toContain('complete graph coverage');
  });

  test('AC-P3-WF keeps unknown evidence visible instead of collapsing to full readiness', () => {
    const status: AcoStatusResponse = {
      ...baseStatus,
      graphStatus: 'available',
      graphWaivers: 0,
      graphWaiverIds: [],
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

    expect(getAcoReadinessLabel(status)).toBe('Ready with known limits');
    expect(formatAcoEvidenceSummary(status)).toContain('2 unknown');
  });
});
