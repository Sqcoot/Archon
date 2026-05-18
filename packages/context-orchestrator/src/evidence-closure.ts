import { redactSecrets } from './security';
import type {
  CapabilityRoute,
  ContextIntent,
  DocumentationPlan,
  DocumentationTarget,
  EvidenceBlocker,
  EvidenceClosurePlan,
  EvidenceResolutionItem,
  GraphContext,
  LedgerBundle,
  ValidationCheck,
  ValidationReport,
} from './types';

export interface CreateEvidenceClosurePlanOptions {
  contextIntent: ContextIntent;
  documentationPlan: DocumentationPlan;
  selectedCapabilities: CapabilityRoute;
  graphContext: GraphContext;
  validationReport: ValidationReport;
  ledgerBundle: LedgerBundle;
}

const acceptanceByEvidenceKind: Record<string, string[]> = {
  docs: ['AC-ACO-EVIDENCE-001', 'AC-ACO-BLOCKER-001'],
  graph: ['AC-ACO-WAIVER-001'],
  validation: ['AC-ACO-BLOCKER-001'],
  tool: ['AC-ACO-BLOCKER-001'],
  command: ['AC-ACO-BLOCKER-001'],
};

export function createEvidenceClosurePlan(
  options: CreateEvidenceClosurePlanOptions
): EvidenceClosurePlan {
  const items = [
    ...buildDocsResolutionItems(options),
    ...buildGraphResolutionItems(options),
    ...buildValidationResolutionItems(options),
    ...buildLedgerResolutionItems(options),
  ].map(redactResolutionItem);

  return {
    required: items.length > 0,
    items: items.sort((left, right) => {
      const idCompare = left.evidenceId.localeCompare(right.evidenceId);
      if (idCompare !== 0) return idCompare;
      return left.targetName.localeCompare(right.targetName);
    }),
  };
}

function buildDocsResolutionItems(
  options: CreateEvidenceClosurePlanOptions
): EvidenceResolutionItem[] {
  const docsBlocker = options.ledgerBundle.evidenceBlockers.find(
    blocker => blocker.id === 'tool.docs-evidence'
  );
  if (!docsBlocker) return [];

  const unresolvedTargets = options.documentationPlan.targets.filter(
    target => target.status === 'unresolved'
  );
  if (unresolvedTargets.length === 0) {
    return [fallbackItemFromBlocker(options, docsBlocker, 'documentation-plan')];
  }

  return unresolvedTargets.map(target => docsTargetToResolutionItem(options, docsBlocker, target));
}

function docsTargetToResolutionItem(
  options: CreateEvidenceClosurePlanOptions,
  blocker: EvidenceBlocker,
  target: DocumentationTarget
): EvidenceResolutionItem {
  if (target.source === 'openai-docs-mcp') {
    return {
      evidenceId: blocker.id,
      capabilityId: 'documentation-plan',
      targetKind: 'openai',
      targetName: target.topic,
      resolver: 'openai-docs-mcp',
      reason: target.reason,
      nextAction: `Use OpenAI Docs MCP for "${target.topic}", record source evidence, then rerun ACO status or compile for intent ${options.contextIntent.intentHash}.`,
      requiresApproval: false,
      blockingAcceptanceIds: acceptanceByEvidenceKind.docs,
      expectedSuccessEvidence: [
        `Documentation target "${target.topic}" is resolved with official OpenAI documentation evidence.`,
        'tool.docs-evidence is no longer partial for this target.',
      ],
    };
  }

  if (target.source === 'context7') {
    return {
      evidenceId: blocker.id,
      capabilityId: 'documentation-plan',
      targetKind: 'third-party',
      targetName: target.topic,
      resolver: 'context7',
      reason: target.reason,
      nextAction: `Run \`npx ctx7@latest library ${target.topic} "${options.contextIntent.objective}"\`, select the best /org/project ID, then run \`npx ctx7@latest docs <libraryId> "${options.contextIntent.objective}"\` and rerun ACO status or compile.`,
      requiresApproval: false,
      blockingAcceptanceIds: acceptanceByEvidenceKind.docs,
      expectedSuccessEvidence: [
        `Context7 library ID for "${target.topic}" is recorded or the ambiguity is preserved explicitly.`,
        'tool.docs-evidence is resolved or remains partial with a precise unresolved target.',
      ],
    };
  }

  return fallbackItemFromBlocker(options, blocker, 'documentation-plan');
}

function buildGraphResolutionItems(
  options: CreateEvidenceClosurePlanOptions
): EvidenceResolutionItem[] {
  if (
    options.graphContext.status !== 'forbidden' &&
    options.graphContext.status !== 'unavailable'
  ) {
    return [];
  }

  if (options.graphContext.waivers.length === 0) {
    return [
      {
        evidenceId: 'tool.graph-evidence',
        capabilityId: 'graph-context',
        targetKind: 'graph',
        targetName: 'graph evidence',
        resolver: 'manual',
        reason: options.graphContext.summary,
        nextAction:
          'Inspect graph evidence artifacts manually; do not refresh graph evidence without explicit approval.',
        requiresApproval: false,
        blockingAcceptanceIds: acceptanceByEvidenceKind.graph,
        expectedSuccessEvidence: ['Graph evidence status changes away from unavailable/forbidden.'],
      },
    ];
  }

  return options.graphContext.waivers.map(waiver => ({
    evidenceId: waiver.id,
    capabilityId: 'graph-context',
    targetKind: 'graph',
    targetName: waiver.repository,
    resolver: 'approval',
    reason: waiver.reason,
    nextAction: `Keep waiver ${waiver.id} explicit, or request approval before running graph refresh commands for ${waiver.repository}.`,
    requiresApproval: true,
    blockingAcceptanceIds: acceptanceByEvidenceKind.graph,
    expectedSuccessEvidence: [
      waiver.expiryCondition,
      `Status output still names waiver ${waiver.id} until it is cleared by approved evidence refresh.`,
    ],
  }));
}

function buildValidationResolutionItems(
  options: CreateEvidenceClosurePlanOptions
): EvidenceResolutionItem[] {
  return options.validationReport.checks
    .filter(check => check.status !== 'passed')
    .map(checkToResolutionItem);
}

function checkToResolutionItem(check: ValidationCheck): EvidenceResolutionItem {
  return {
    evidenceId: check.id,
    capabilityId: 'validation',
    targetKind: 'validation',
    targetName: check.id,
    resolver: 'manual',
    reason: check.message,
    nextAction: `Resolve validation check ${check.id}, then rerun \`bun run cli context validate --cwd . --json\`.`,
    requiresApproval: false,
    blockingAcceptanceIds: acceptanceByEvidenceKind.validation,
    expectedSuccessEvidence: [`Validation check ${check.id} reports passed.`],
  };
}

function buildLedgerResolutionItems(
  options: CreateEvidenceClosurePlanOptions
): EvidenceResolutionItem[] {
  const handledIds = new Set([
    'tool.docs-evidence',
    'tool.graph-evidence',
    'tool.aco-status',
    ...options.graphContext.waivers.map(waiver => waiver.id),
    ...options.validationReport.checks.map(check => check.id),
  ]);

  return options.ledgerBundle.evidenceBlockers
    .filter(blocker => !handledIds.has(blocker.id))
    .map(blocker => fallbackItemFromBlocker(options, blocker, capabilityIdForBlocker(blocker)));
}

function fallbackItemFromBlocker(
  options: Pick<CreateEvidenceClosurePlanOptions, 'contextIntent'>,
  blocker: EvidenceBlocker,
  capabilityId: string
): EvidenceResolutionItem {
  return {
    evidenceId: blocker.id,
    capabilityId,
    targetKind: blocker.kind === 'validation' ? 'validation' : 'unknown',
    targetName: blocker.id,
    resolver: blocker.kind === 'graph' ? 'approval' : 'manual',
    reason: blocker.reason,
    nextAction: `${blocker.nextVerificationAction} Intent: ${options.contextIntent.intentHash}.`,
    requiresApproval: blocker.kind === 'graph',
    blockingAcceptanceIds: acceptanceByEvidenceKind[blocker.kind] ?? ['AC-ACO-BLOCKER-001'],
    expectedSuccessEvidence: [`${blocker.id} no longer appears in evidenceBlockers.`],
  };
}

function capabilityIdForBlocker(blocker: EvidenceBlocker): string {
  if (blocker.kind === 'docs') return 'documentation-plan';
  if (blocker.kind === 'graph') return 'graph-context';
  if (blocker.kind === 'validation') return 'validation';
  return 'ledger-evidence';
}

function redactResolutionItem(item: EvidenceResolutionItem): EvidenceResolutionItem {
  return {
    ...item,
    evidenceId: redactSecrets(item.evidenceId),
    capabilityId: redactSecrets(item.capabilityId),
    targetName: redactSecrets(item.targetName),
    reason: redactSecrets(item.reason),
    nextAction: redactSecrets(item.nextAction),
    blockingAcceptanceIds: item.blockingAcceptanceIds.map(redactSecrets),
    expectedSuccessEvidence: item.expectedSuccessEvidence.map(redactSecrets),
  };
}
