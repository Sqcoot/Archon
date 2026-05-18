import { describe, expect, test } from 'bun:test';
import { createDecisionDossier, renderDecisionDossierMarkdown } from './decision-dossier';
import type {
  AcceptancePlan,
  BmadRoute,
  CapabilityRoute,
  DocumentationPlan,
  GraphContext,
  LedgerBundle,
  LedgerStatusCounts,
  ValidationReport,
} from './types';

describe('decision dossier', () => {
  test('AC-DOSSIER-001 AC-DOSSIER-005 AC-DOSSIER-006 builds canonical approval dossier', async () => {
    const dossier = await createDecisionDossier({
      cwd: '/repo',
      prompt: 'Improve project context UX with SECRET_TOKEN=hidden-value',
      timestamp: '2026-05-18T12:00:00.000Z',
      graphContext: graphContextFixture(),
      documentationPlan: documentationPlanFixture,
      bmadRoute: routeFixture,
      acceptancePlan: acceptancePlanFixture,
      selectedCapabilities: selectedCapabilitiesFixture,
      validationReport: validationReportFixture,
      ledgerBundle: ledgerBundleFixture(),
      contextIntent: contextIntentFixture,
    });

    expect(dossier.schemaVersion).toBe('aco.decision-dossier.v1');
    expect(dossier.route.id).toBe('brownfield-architecture');
    expect(dossier.validationStatus).toBe('passed');
    expect(dossier.readiness).toBe('needs_approval');
    expect(dossier.graphStatus).toBe('forbidden');
    expect(dossier.approvalRequired).toBe(true);
    expect(dossier.evidenceResolution.required).toBe(true);
    expect(dossier.evidenceResolution.items.map(item => item.evidenceId)).toContain(
      'graph-waiver.bmad-plugins-marketplace'
    );
    expect(dossier.waivers.map(waiver => waiver.id)).toEqual([
      'graph-waiver.bmad-plugins-marketplace',
      'graph-waiver.bmad-sample-data',
    ]);
    expect(dossier.approvalCommands).toEqual([
      expect.objectContaining({
        command: 'bun scripts/research/graph-upstreams.ts --mode required --force',
        requiresApproval: true,
        willRun: false,
      }),
      expect.objectContaining({
        command: 'bun scripts/research/render-graph-evidence-docs.ts',
        requiresApproval: true,
        willRun: false,
      }),
    ]);
    expect(dossier.blockedItems.map(item => item.id)).toContain('cmd.research-graph');
    expect(dossier.rejectedAlternatives.map(alternative => alternative.id)).toContain(
      'static-handoff-prompt'
    );
    expect(dossier.nextGoalObjective).not.toContain('hidden-value');
    expect(dossier.nextPlanPrompt).not.toContain('hidden-value');
    expect(dossier.nextGoalObjective).not.toContain('Implement ACO Acceptance Reality Gate');

    const markdown = renderDecisionDossierMarkdown(dossier);
    expect(markdown).toContain('# ACO Decision Dossier');
    expect(markdown).toContain('Route: brownfield-architecture');
    expect(markdown).toContain('Readiness: needs_approval');
    expect(markdown).toContain('Graph: forbidden');
    expect(markdown).toContain('graph-waiver.bmad-plugins-marketplace');
    expect(markdown).toContain('willRun=false');
    expect(markdown).toContain('## Evidence Resolution');
  });
});

const routeFixture: BmadRoute = {
  id: 'brownfield-architecture',
  label: 'Brownfield architecture',
  steps: ['bmad-index-docs', 'bmad-create-architecture'],
  rationale:
    'Archon implementation work should gather context, validate PRD, then create architecture.',
};

const documentationPlanFixture: DocumentationPlan = {
  readiness: {
    openaiDocsMcp: 'available',
    context7: 'available',
  },
  targets: [],
  unresolved: [],
};

const acceptancePlanFixture: AcceptancePlan = {
  status: 'ready',
  scenarios: [
    {
      id: 'AC-DOSSIER-001',
      spec: 'docs/context-orchestrator/specs/023-decision-dossier-gate-spec.md',
      given: 'a prompt',
      when: 'dossier builder runs',
      then: 'canonical dossier is emitted',
    },
  ],
};

const selectedCapabilitiesFixture: CapabilityRoute = {
  capabilities: [],
};

const validationReportFixture: ValidationReport = {
  status: 'passed',
  checks: [{ id: 'aco-traceability', status: 'passed', message: 'passed' }],
};

const contextIntentFixture = {
  objective: 'Improve project context UX with SECRET_TOKEN=[REDACTED]',
  normalizedObjective: 'improve project context ux with secret_token=[redacted]',
  intentHash: 'intent-test',
  cwd: '/repo',
  commitSha: 'abc123',
  generatedAt: '2026-05-18T12:00:00.000Z',
};

function graphContextFixture(): GraphContext {
  return {
    status: 'forbidden',
    repositories: [],
    waiverCount: 2,
    waivers: [
      {
        id: 'graph-waiver.bmad-plugins-marketplace',
        repository: 'bmad-plugins-marketplace',
        owner: 'context-orchestrator',
        reason: 'Nothing to update or rebuild failed.',
        evidence: 'docs/context-orchestrator/research/upstream-manifest.json',
        expiryCondition: 'Regenerate graph evidence successfully.',
      },
      {
        id: 'graph-waiver.bmad-sample-data',
        repository: 'bmad-sample-data',
        owner: 'context-orchestrator',
        reason: 'Nothing to update or rebuild failed.',
        evidence: 'docs/context-orchestrator/research/upstream-manifest.json',
        expiryCondition: 'Regenerate graph evidence successfully.',
      },
    ],
    summary: '13 repositories indexed; 2 failed graph waiver(s) forbidden.',
  };
}

function ledgerBundleFixture(): LedgerBundle {
  const counts = statusCounts({ available: 1, forbidden: 1 });
  return {
    schemaVersion: 'aco.ledger-bundle.v1',
    contextIntent: contextIntentFixture,
    toolAvailability: [
      {
        id: 'tool.graph-evidence',
        name: 'Graph evidence',
        category: 'evidence',
        status: 'forbidden',
        sourceEvidence: 'graph=forbidden',
        invocationPath: 'getGraphContext({ cwd })',
        scope: 'Repository graph evidence.',
        preconditions: 'Manifest available.',
        verification: '2 waivers.',
        primaryUse: 'Evidence-backed implementation context.',
        failureMode: 'Missing graph evidence.',
        fallback: 'Record waiver.',
        owner: 'context-orchestrator',
        lastVerified: 'unknown',
        lastVerifiedAt: 'unknown',
        verificationSource: 'graph=forbidden',
        verificationMethod: 'command',
        sourceArtifact: 'getGraphContext({ cwd })',
        nextVerificationAction: 'Review active graph waivers.',
        freshness: 'waived',
        notes: 'forbidden',
        confidence: 'observed',
        evidence: [],
      },
    ],
    commands: [
      {
        id: 'cmd.research-graph',
        command: 'bun scripts/research/graph-upstreams.ts --mode required --force',
        category: 'research',
        status: 'forbidden',
        sourceEvidence: 'package.json',
        invocationPath: 'repo root',
        scope: 'Regenerate graph evidence.',
        preconditions: 'Approval.',
        verification: 'Generated graph output reviewed.',
        primaryUse: 'Refresh graph evidence.',
        failureMode: 'Writes generated research artifacts.',
        fallback: 'Use committed graph evidence.',
        owner: 'context-orchestrator',
        lastVerified: 'unknown',
        lastVerifiedAt: 'unknown',
        verificationSource: 'package.json',
        verificationMethod: 'file',
        sourceArtifact: 'repo root',
        nextVerificationAction: 'Use committed graph evidence.',
        freshness: 'unknown',
        mutatesTrackedFiles: true,
        requiresApproval: true,
        safety: 'writes-tracked-files',
        notes: 'approval required',
        confidence: 'declared',
        evidence: [],
      },
    ],
    summary: {
      toolAvailability: counts,
      commands: counts,
      combined: statusCounts({ available: 2, forbidden: 2 }),
    },
    evidenceBlockers: [],
  };
}

function statusCounts(overrides: Partial<LedgerStatusCounts>): {
  total: number;
  counts: LedgerStatusCounts;
} {
  const counts: LedgerStatusCounts = {
    available: 0,
    partial: 0,
    blocked: 0,
    deferred: 0,
    forbidden: 0,
    'not used': 0,
    unknown: 0,
    ...overrides,
  };
  return {
    total: Object.values(counts).reduce((total, count) => total + count, 0),
    counts,
  };
}
