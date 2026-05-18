import {
  nextDecisionSchema,
  type NextDecision,
  type NextDecisionAction,
} from './schemas/next-decision';
import { redactSecrets } from './security';
import type {
  BmadRoute,
  ContextIntent,
  ContextOrchestratorReadiness,
  EvidenceBlocker,
  EvidenceClosurePlan,
  GraphContext,
  LedgerBundleSummary,
  ValidationReport,
} from './types';

export interface BuildNextDecisionInput {
  contextIntent: ContextIntent;
  route: BmadRoute;
  readiness: ContextOrchestratorReadiness;
  validationReport: ValidationReport;
  graphContext: GraphContext;
  ledgerSummary: LedgerBundleSummary;
  evidenceBlockers: EvidenceBlocker[];
  evidenceResolution: EvidenceClosurePlan;
}

const nextDecisionSchemaVersion = 'aco.next-decision.v1' as const;

export function buildNextDecision(input: BuildNextDecisionInput): NextDecision {
  const waiverIds = sortedUnique(input.graphContext.waivers.map(waiver => waiver.id));
  const evidenceBlockerIds = sortedUnique(input.evidenceBlockers.map(blocker => blocker.id));
  const evidenceResolutionIds = sortedUnique(
    input.evidenceResolution.items.map(item => item.evidenceId)
  );
  const nonGraphBlockerIds = sortedUnique(
    input.evidenceBlockers.filter(blocker => blocker.kind !== 'graph').map(blocker => blocker.id)
  );
  const approvalResolutionIds = sortedUnique(
    input.evidenceResolution.items
      .filter(
        item =>
          item.targetKind === 'graph' &&
          item.resolver === 'approval' &&
          item.requiresApproval &&
          waiverIds.includes(item.evidenceId)
      )
      .map(item => item.evidenceId)
  );
  const hasValidGraphApproval =
    waiverIds.length > 0 && waiverIds.every(waiverId => approvalResolutionIds.includes(waiverId));
  const graphRequiresDecision =
    input.graphContext.status === 'forbidden' || input.graphContext.status === 'unavailable';

  if (input.validationReport.status === 'failed') {
    return makeDecision(input, {
      kind: 'blocked_by_validation',
      title: 'Validation failed',
      summary: 'Resolve failed ACO validation before implementation.',
      primaryAction: validationAction(input),
      secondaryActions: [correctCourseAction(input)],
      waiverIds,
      evidenceBlockerIds,
      evidenceResolutionIds,
      nextPrompt: `Resolve failed ACO validation for intent ${input.contextIntent.intentHash}, then rebuild Context Orchestrator status.`,
    });
  }

  if (nonGraphBlockerIds.length > 0) {
    return makeDecision(input, {
      kind: 'blocked_by_evidence',
      title: 'Evidence blockers remain',
      summary: `Resolve ${String(nonGraphBlockerIds.length)} non-graph evidence blocker(s) before implementation.`,
      primaryAction: manualAction({
        id: 'next.resolve-evidence-blockers',
        label: 'Resolve evidence blockers',
        payload: { evidenceBlockerIds: nonGraphBlockerIds },
        successEvidence: nonGraphBlockerIds.map(
          id => `${id} no longer appears in evidenceBlockers.`
        ),
      }),
      secondaryActions: [correctCourseAction(input)],
      waiverIds,
      evidenceBlockerIds,
      evidenceResolutionIds,
      nextPrompt: `Resolve evidence blockers ${nonGraphBlockerIds.join(', ')} for intent ${input.contextIntent.intentHash}.`,
    });
  }

  if (graphRequiresDecision && !hasValidGraphApproval) {
    return makeDecision(input, {
      kind: 'blocked_by_graph',
      title: 'Graph evidence blocked',
      summary: 'Graph evidence is unavailable or forbidden without valid explicit waiver approval.',
      primaryAction: manualAction({
        id: 'next.inspect-graph-evidence',
        label: 'Inspect graph evidence and waivers',
        payload: { graphStatus: input.graphContext.status, waiverIds },
        successEvidence: [
          'Graph evidence has valid explicit waivers or no longer requires approval.',
        ],
      }),
      secondaryActions: [correctCourseAction(input)],
      waiverIds,
      evidenceBlockerIds,
      evidenceResolutionIds,
      nextPrompt: `Inspect graph evidence for intent ${input.contextIntent.intentHash}; do not implement until graph status is ready or waivers are explicit.`,
    });
  }

  if (graphRequiresDecision && hasValidGraphApproval) {
    return makeDecision(input, {
      kind: 'approval_required',
      title: 'Approval required',
      summary:
        'Implementation may proceed only if current graph waivers are explicitly preserved or graph refresh is approved separately.',
      primaryAction: {
        id: 'next.approve-current-graph-waivers',
        kind: 'approval',
        label: 'Approve preserving current graph waivers',
        payload: { waiverIds, evidenceResolutionIds: approvalResolutionIds },
        requiresApproval: true,
        willRun: false,
        successEvidence: [
          'User explicitly approves preserving listed graph waivers for this run.',
          'Status output still names active waiver IDs until graph evidence changes.',
        ],
      },
      secondaryActions: [
        manualAction({
          id: 'next.request-graph-refresh-approval',
          label: 'Request graph refresh approval',
          payload: { waiverIds },
          successEvidence: [
            'Graph evidence refresh is explicitly approved before any write command runs.',
          ],
        }),
      ],
      waiverIds,
      evidenceBlockerIds,
      evidenceResolutionIds,
      nextPrompt: `Request explicit approval to preserve graph waivers ${waiverIds.join(', ')} for intent ${input.contextIntent.intentHash}. Do not run graph refresh or approval commands without user approval.`,
    });
  }

  if (
    input.readiness !== 'ready' ||
    input.validationReport.status === 'warning' ||
    input.graphContext.status === 'partial'
  ) {
    return makeDecision(input, {
      kind: 'needs_correct_course',
      title: 'Correct course needed',
      summary:
        'ACO evidence is not blocked, but readiness is not strong enough for implementation.',
      primaryAction: correctCourseAction(input),
      secondaryActions: [validationAction(input)],
      waiverIds,
      evidenceBlockerIds,
      evidenceResolutionIds,
      nextPrompt: `Clarify ACO readiness for intent ${input.contextIntent.intentHash}, then rebuild status before implementation.`,
    });
  }

  return makeDecision(input, {
    kind: 'ready_for_implementation',
    title: 'Ready for implementation',
    summary: 'ACO evidence is ready for SDD/ATDD implementation planning.',
    primaryAction: {
      id: 'next.implement-with-bmad-route',
      kind: 'implementation',
      label: 'Implement with selected BMAD route',
      payload: { routeId: input.route.id, steps: input.route.steps },
      requiresApproval: false,
      willRun: false,
      successEvidence: [
        'Implementation follows the selected BMAD route and validation remains passing.',
      ],
    },
    secondaryActions: [validationAction(input)],
    waiverIds,
    evidenceBlockerIds,
    evidenceResolutionIds,
    nextPrompt: `Proceed with SDD/ATDD for intent ${input.contextIntent.intentHash} using BMAD route ${input.route.id}.`,
  });
}

function makeDecision(
  input: BuildNextDecisionInput,
  decision: Omit<NextDecision, 'schemaVersion' | 'decisionFactors' | 'evidenceSummary'>
): NextDecision {
  return nextDecisionSchema.parse({
    schemaVersion: nextDecisionSchemaVersion,
    ...redactDecision(decision),
    decisionFactors: [
      {
        id: 'validation',
        status: input.validationReport.status,
        source: 'validationReport.status',
        summary:
          input.validationReport.checks.map(check => `${check.id}:${check.status}`).join(', ') ||
          input.validationReport.status,
      },
      {
        id: 'graph',
        status: input.graphContext.status,
        source: 'graphContext.status',
        summary: input.graphContext.summary,
      },
      {
        id: 'readiness',
        status: input.readiness,
        source: 'ContextOrchestratorReadiness',
        summary: `readiness=${input.readiness}`,
      },
    ].map(factor => ({
      ...factor,
      summary: redactSecrets(factor.summary),
    })),
    evidenceSummary: {
      readiness: input.readiness,
      validationStatus: input.validationReport.status,
      graphStatus: input.graphContext.status,
      graphWaivers: input.graphContext.waiverCount,
      evidenceBlockers: input.evidenceBlockers.length,
      evidenceResolutionRequired: input.evidenceResolution.required,
      ledgerSummary: input.ledgerSummary,
    },
  });
}

function validationAction(input: BuildNextDecisionInput): NextDecisionAction {
  return {
    id: 'next.run-aco-validation',
    kind: 'validation',
    label: 'Run ACO validation',
    command: [
      'bun',
      'run',
      'cli',
      'context',
      'validate',
      '--cwd',
      input.contextIntent.cwd,
      '--json',
    ],
    requiresApproval: false,
    willRun: false,
    successEvidence: ['ACO validation reports passed.'],
  };
}

function correctCourseAction(input: BuildNextDecisionInput): NextDecisionAction {
  return {
    id: 'next.correct-course',
    kind: 'correct_course',
    label: 'Clarify evidence and correct course',
    payload: { intentHash: input.contextIntent.intentHash },
    requiresApproval: false,
    willRun: false,
    successEvidence: ['ACO status no longer reports unknown or inconsistent readiness.'],
  };
}

function manualAction(input: {
  id: string;
  label: string;
  payload: Record<string, unknown>;
  successEvidence: string[];
}): NextDecisionAction {
  return {
    id: input.id,
    kind: 'manual',
    label: input.label,
    payload: input.payload,
    requiresApproval: false,
    willRun: false,
    successEvidence: input.successEvidence,
  };
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values.map(redactSecrets).filter(value => value.length > 0))].sort(
    (left, right) => left.localeCompare(right)
  );
}

function redactDecision(
  decision: Omit<NextDecision, 'schemaVersion' | 'decisionFactors' | 'evidenceSummary'>
): Omit<NextDecision, 'schemaVersion' | 'decisionFactors' | 'evidenceSummary'> {
  return {
    ...decision,
    title: redactSecrets(decision.title),
    summary: redactSecrets(decision.summary),
    primaryAction: redactAction(decision.primaryAction),
    secondaryActions: decision.secondaryActions.map(redactAction),
    waiverIds: decision.waiverIds.map(redactSecrets),
    evidenceBlockerIds: decision.evidenceBlockerIds.map(redactSecrets),
    evidenceResolutionIds: decision.evidenceResolutionIds.map(redactSecrets),
    nextPrompt: redactSecrets(decision.nextPrompt),
  };
}

function redactAction(action: NextDecisionAction): NextDecisionAction {
  return {
    ...action,
    id: redactSecrets(action.id),
    label: redactSecrets(action.label),
    ...(action.command !== undefined ? { command: action.command.map(redactSecrets) } : {}),
    ...(action.payload !== undefined ? { payload: redactPayload(action.payload) } : {}),
    successEvidence: action.successEvidence.map(redactSecrets),
  };
}

function redactPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [redactSecrets(key), redactUnknown(value)])
  );
}

function redactUnknown(value: unknown): unknown {
  if (typeof value === 'string') return redactSecrets(value);
  if (Array.isArray(value)) return value.map(redactUnknown);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        redactSecrets(key),
        redactUnknown(nestedValue),
      ])
    );
  }
  return value;
}
