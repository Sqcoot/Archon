import { describe, expect, test } from 'bun:test';
import {
  buildAcoApprovalContract,
  canonicalJson,
  createLedgerFingerprint,
  verifyAcoApprovalContract,
  type BuildAcoApprovalContractInput,
} from './approval-contract';

describe('ACO approval contract', () => {
  test('ACO-APPROVAL-007 builds deterministic hash-backed approval contract', () => {
    const first = buildAcoApprovalContract(baseInput());
    const second = buildAcoApprovalContract(baseInput());

    expect(first).toEqual(second);
    expect(first.schemaVersion).toBe('aco.approval-contract.v1');
    expect(first.contractHash).toHaveLength(64);
    expect(first.contractId).toBe(`aco.approval-contract.v1:${first.contractHash.slice(0, 16)}`);
    expect(first.requiredWaiverIds).toEqual([
      'graph-waiver.bmad-plugins-marketplace',
      'graph-waiver.bmad-sample-data',
    ]);
    expect(first.willRun).toBe(false);
    expect(verifyAcoApprovalContract(first).status).toBe('valid');
  });

  test('ACO-APPROVAL-008 verification invalidates tampered waiver contract', () => {
    const contract = buildAcoApprovalContract(baseInput());
    const tampered = {
      ...contract,
      requiredWaiverIds: ['graph-waiver.bmad-sample-data'],
    };

    const verification = verifyAcoApprovalContract(tampered);

    expect(verification.status).toBe('invalid');
    expect(verification.willRun).toBe(false);
    expect(verification.mismatches.map(mismatch => mismatch.field)).toContain('contractHash');
  });

  test('ACO-APPROVAL-009 ledger fingerprint changes when ledger status changes', () => {
    const clean = createLedgerFingerprint({
      toolAvailability: { total: 1, counts: counts({ available: 1 }) },
      commands: { total: 0, counts: counts({}) },
      combined: { total: 1, counts: counts({ available: 1 }) },
    });
    const drifted = createLedgerFingerprint({
      toolAvailability: { total: 1, counts: counts({ forbidden: 1 }) },
      commands: { total: 0, counts: counts({}) },
      combined: { total: 1, counts: counts({ forbidden: 1 }) },
    });

    expect(drifted).not.toBe(clean);
  });

  test('ACO-APPROVAL-010 canonical JSON is stable and redacts secret-like strings', () => {
    const serialized = canonicalJson({
      z: 'token=super-secret-value',
      a: ['b', 'a'],
    });

    expect(serialized).toBe('{"a":["b","a"],"z":"token=[REDACTED]"}');
  });
});

function baseInput(): BuildAcoApprovalContractInput {
  return {
    actionId: 'next.approve-current-graph-waivers',
    contextIntent: {
      objective: 'Implement approval contract',
      normalizedObjective: 'implement approval contract',
      intentHash: 'intent-approval-contract',
      cwd: '/repo',
      commitSha: 'abc123',
      generatedAt: '2026-05-18T12:00:00.000Z',
    },
    route: {
      id: 'brownfield-architecture',
      label: 'Brownfield architecture',
      steps: ['bmad-prd'],
      rationale: 'Architecture-sensitive request.',
    },
    readiness: 'needs_approval',
    graphContext: {
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
      summary: 'Graph forbidden.',
    },
    evidenceResolution: {
      required: true,
      items: [
        approvalItem('graph-waiver.bmad-sample-data'),
        approvalItem('graph-waiver.bmad-plugins-marketplace'),
      ],
    },
    ledgerFingerprint: createLedgerFingerprint({
      toolAvailability: { total: 0, counts: counts({}) },
      commands: { total: 0, counts: counts({}) },
      combined: { total: 0, counts: counts({}) },
    }),
    validationReport: {
      status: 'passed',
      checks: [{ id: 'aco-policy', status: 'passed', message: 'ok' }],
    },
  };
}

function approvalItem(
  evidenceId: string
): BuildAcoApprovalContractInput['evidenceResolution']['items'][number] {
  return {
    evidenceId,
    capabilityId: 'graph-context',
    targetKind: 'graph',
    targetName: evidenceId,
    resolver: 'approval',
    reason: 'Graph failed.',
    nextAction: 'Keep waiver explicit.',
    requiresApproval: true,
    blockingAcceptanceIds: ['AC-ACO-WAIVER-001'],
    expectedSuccessEvidence: ['Waiver remains visible.'],
  };
}

function counts(overrides: Partial<Record<string, number>>): {
  available: number;
  partial: number;
  blocked: number;
  deferred: number;
  forbidden: number;
  'not used': number;
  unknown: number;
} {
  return {
    available: overrides.available ?? 0,
    partial: overrides.partial ?? 0,
    blocked: overrides.blocked ?? 0,
    deferred: overrides.deferred ?? 0,
    forbidden: overrides.forbidden ?? 0,
    'not used': overrides['not used'] ?? 0,
    unknown: overrides.unknown ?? 0,
  };
}
