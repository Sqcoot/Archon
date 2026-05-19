import { describe, expect, test } from 'bun:test';
import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import {
  buildNextDecision,
  compilePromptPackage,
  createApprovalCapsule,
  createDecisionDossier,
  getContextOrchestratorStatus,
  verifyAcoApprovalContract,
  type BuildNextDecisionInput,
  type EvidenceBlocker,
  type GraphContext,
  type LedgerBundleSummary,
} from '@archon/context-orchestrator';

const repoRoot = resolve(import.meta.dir, '../../..');
const objective = 'Implement deterministic ACO Next Decision Engine.';
const timestamp = '2026-05-18T22:20:00.000Z';

describe('ACO next decision acceptance', () => {
  test('AC-NEXT-001 current repo golden evidence emits approval_required with explicit waivers and inert actions', () => {
    const decision = buildNextDecision(baseInput());

    expect(decision.kind).toBe('approval_required');
    expect(decision.waiverIds).toEqual([
      'graph-waiver.bmad-plugins-marketplace',
      'graph-waiver.bmad-sample-data',
    ]);
    expect(decision.evidenceBlockerIds).toEqual([]);
    expect(decision.primaryAction.willRun).toBe(false);
    expect(decision.secondaryActions.every(action => action.willRun === false)).toBe(true);
  });

  test('AC-NEXT-002 failed validation wins over graph waiver approval', () => {
    const decision = buildNextDecision({
      ...baseInput(),
      validationReport: {
        status: 'failed',
        checks: [{ id: 'aco-policy', status: 'failed', message: 'Policy failed.' }],
      },
    });

    expect(decision.kind).toBe('blocked_by_validation');
    expect(decision.primaryAction.kind).toBe('validation');
  });

  test('AC-NEXT-003 non-graph blockers win before graph approval and use sorted IDs', () => {
    const decision = buildNextDecision({
      ...baseInput(),
      evidenceBlockers: [docsBlocker('tool.docs-z'), docsBlocker('tool.docs-a')],
    });

    expect(decision.kind).toBe('blocked_by_evidence');
    expect(decision.evidenceBlockerIds).toEqual(['tool.docs-a', 'tool.docs-z']);
  });

  test('AC-NEXT-004 forbidden graph without valid explicit waivers is blocked_by_graph', () => {
    const decision = buildNextDecision({
      ...baseInput(),
      graphContext: {
        ...baseGraphContext(),
        waivers: [],
        waiverCount: 0,
      },
      evidenceResolution: { required: true, items: [] },
    });

    expect(decision.kind).toBe('blocked_by_graph');
    expect(decision.primaryAction.kind).toBe('manual');
  });

  test('AC-NEXT-005 canonical next decision is shared by status compile dossier and approval capsule', async () => {
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-next-decision-'));
    const status = await getContextOrchestratorStatus(repoRoot, { objective, timestamp });
    const compiled = await compilePromptPackage({
      cwd: repoRoot,
      prompt: objective,
      archiveRoot,
      runId: 'aco-next-decision-acceptance',
      timestamp,
    });
    const dossier = await createDecisionDossier({
      cwd: repoRoot,
      prompt: objective,
      timestamp,
    });
    const capsule = await createApprovalCapsule({
      cwd: repoRoot,
      prompt: objective,
      runId: 'aco-next-decision-acceptance',
      timestamp,
    });

    expect(compiled.package.nextDecision).toEqual(status.nextDecision);
    expect(dossier.nextDecision).toEqual(status.nextDecision);
    expect(capsule.nextDecision).toEqual(status.nextDecision);
  });

  test('AC-NEXT-006 buildNextDecision is deterministic and does not mutate input', () => {
    const input = baseInput();
    const before = JSON.stringify(input);
    const first = buildNextDecision(input);
    const second = buildNextDecision(input);

    expect(second).toEqual(first);
    expect(JSON.stringify(input)).toBe(before);
  });

  test('AC-NEXT-007 approval_required primary payload is the canonical approval contract', () => {
    const decision = buildNextDecision(baseInput());

    expect(decision.kind).toBe('approval_required');
    expect(decision.primaryAction.payload).toMatchObject({
      schemaVersion: 'aco.approval-contract.v1',
      willRun: false,
      requiredWaiverIds: ['graph-waiver.bmad-plugins-marketplace', 'graph-waiver.bmad-sample-data'],
    });
    expect(verifyAcoApprovalContract(decision.primaryAction.payload).status).toBe('valid');
  });
});

function baseInput(): BuildNextDecisionInput {
  return {
    contextIntent: {
      objective,
      normalizedObjective: objective.toLowerCase(),
      intentHash: 'intent-next-decision',
      cwd: repoRoot,
      commitSha: 'abc123',
      generatedAt: timestamp,
    },
    route: {
      id: 'brownfield-architecture',
      label: 'Brownfield architecture-sensitive route',
      steps: ['bmad-prd', 'bmad-create-architecture'],
      rationale: 'Architecture-sensitive request.',
    },
    readiness: 'needs_approval',
    validationReport: {
      status: 'passed',
      checks: [{ id: 'aco-policy', status: 'passed', message: 'Policy passed.' }],
    },
    graphContext: baseGraphContext(),
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
          reason: 'Graph evidence failed.',
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
          reason: 'Graph evidence failed.',
          nextAction: 'Keep waiver explicit.',
          requiresApproval: true,
          blockingAcceptanceIds: ['AC-ACO-WAIVER-001'],
          expectedSuccessEvidence: ['Waiver remains visible.'],
        },
      ],
    },
  };
}

function baseGraphContext(): GraphContext {
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

function docsBlocker(id: string): EvidenceBlocker {
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
