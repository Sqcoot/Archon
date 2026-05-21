import { createAcceptancePlan } from './acceptance';
import { routeBmad } from './bmad';
import { selectCapabilities } from './capabilities';
import { createEvidenceClosurePlan } from './evidence-closure';
import { planDocumentation } from './docs';
import { getGraphContext } from './graph';
import { createContextIntent } from './intent';
import { buildLedgerBundle, ledgerStatusOrder } from './ledgers';
import { buildNextDecision } from './next-decision';
import { createLedgerFingerprint } from './schemas/approval-contract';
import { redactSecrets } from './security';
import { getContextOrchestratorReadiness } from './status';
import { validateContextOrchestrator } from './validation';
import type {
  AcceptancePlan,
  BmadRoute,
  CapabilityRoute,
  CommandLedgerEntry,
  ContextIntent,
  DecisionDossier,
  DecisionDossierApprovalCommand,
  DecisionDossierBlockedItem,
  DecisionDossierDecision,
  DecisionDossierEvidence,
  DecisionDossierRejectedAlternative,
  DocumentationPlan,
  EvidenceClosurePlan,
  GraphContext,
  LedgerBundle,
  LedgerStatus,
  NextDecision,
  ToolAvailabilityLedgerEntry,
  ValidationReport,
} from './types';

export const DECISION_DOSSIER_SCHEMA_VERSION = 'aco.decision-dossier.v1' as const;

export interface CreateDecisionDossierOptions {
  cwd: string;
  prompt: string;
  timestamp?: string;
  contextIntent?: ContextIntent;
  graphContext?: GraphContext;
  documentationPlan?: DocumentationPlan;
  bmadRoute?: BmadRoute;
  acceptancePlan?: AcceptancePlan;
  selectedCapabilities?: CapabilityRoute;
  validationReport?: ValidationReport;
  ledgerBundle?: LedgerBundle;
  evidenceResolution?: EvidenceClosurePlan;
  nextDecision?: NextDecision;
}

const nonGreenLedgerStatuses = new Set<LedgerStatus>([
  'partial',
  'blocked',
  'deferred',
  'forbidden',
  'unknown',
]);

const goalMaxLength = 3800;

export async function createDecisionDossier(
  options: CreateDecisionDossierOptions
): Promise<DecisionDossier> {
  const redactedPrompt = redactSecrets(options.prompt);
  const contextIntent =
    options.contextIntent ??
    (await createContextIntent({
      cwd: options.cwd,
      objective: options.prompt,
      timestamp: options.timestamp,
    }));
  const graphContext = options.graphContext ?? (await getGraphContext({ cwd: options.cwd }));
  const documentationPlan =
    options.documentationPlan ?? planDocumentation({ prompt: options.prompt });
  const bmadRoute = options.bmadRoute ?? routeBmad({ prompt: options.prompt });
  const acceptancePlan =
    options.acceptancePlan ?? createAcceptancePlan({ prompt: options.prompt, route: bmadRoute });
  const selectedCapabilities =
    options.selectedCapabilities ?? selectCapabilities({ graphContext, documentationPlan });
  const validationReport =
    options.validationReport ?? (await validateContextOrchestrator({ cwd: options.cwd }));
  const ledgerBundle =
    options.ledgerBundle ??
    (await buildLedgerBundle({
      cwd: options.cwd,
      objective: options.prompt,
      timestamp: contextIntent.generatedAt,
      contextIntent,
      graphContext,
      documentationPlan,
      bmadRoute,
      acceptancePlan,
      selectedCapabilities,
      validationReport,
    }));
  const readiness = getContextOrchestratorReadiness(
    graphContext,
    validationReport,
    ledgerBundle.evidenceBlockers,
    { route: bmadRoute }
  );
  const evidenceResolution =
    options.evidenceResolution ??
    createEvidenceClosurePlan({
      contextIntent,
      documentationPlan,
      selectedCapabilities,
      graphContext,
      validationReport,
      ledgerBundle,
    });
  const nextDecision =
    options.nextDecision ??
    buildNextDecision({
      contextIntent,
      route: bmadRoute,
      readiness,
      validationReport,
      graphContext,
      ledgerSummary: ledgerBundle.summary,
      ledgerFingerprint: createLedgerFingerprint(ledgerBundle),
      evidenceBlockers: ledgerBundle.evidenceBlockers,
      evidenceResolution,
    });
  const approvalRequired = readiness === 'needs_approval';
  const approvalCommands = buildApprovalCommands(graphContext);
  const blockedItems = buildBlockedItems(graphContext, validationReport, ledgerBundle);
  const decision = buildDecision({
    route: bmadRoute,
    readiness,
    validationReport,
    graphContext,
    approvalCommands,
  });
  const nextGoalObjective = buildNextGoalObjective({
    prompt: redactedPrompt,
    route: bmadRoute,
    readiness,
    graphContext,
  });
  const dossier: DecisionDossier = {
    schemaVersion: DECISION_DOSSIER_SCHEMA_VERSION,
    ...(options.timestamp !== undefined ? { generatedAt: redactSecrets(options.timestamp) } : {}),
    contextIntent,
    route: bmadRoute,
    decision,
    evidenceUsed: buildEvidenceUsed({
      route: bmadRoute,
      graphContext,
      validationReport,
      ledgerBundle,
      acceptancePlan,
    }),
    readiness,
    validationStatus: validationReport.status,
    graphStatus: graphContext.status,
    waivers: graphContext.waivers.map(waiver => ({
      id: redactSecrets(waiver.id),
      repository: redactSecrets(waiver.repository),
      owner: redactSecrets(waiver.owner),
      reason: redactSecrets(waiver.reason),
      evidence: redactSecrets(waiver.evidence),
      expiryCondition: redactSecrets(waiver.expiryCondition),
    })),
    ledgerSummary: ledgerBundle.summary,
    evidenceBlockers: ledgerBundle.evidenceBlockers,
    evidenceResolution,
    nextDecision,
    blockedItems,
    approvalRequired,
    approvalCommands,
    rejectedAlternatives: rejectedAlternatives(),
    nextGoalObjective,
    nextPlanPrompt: buildNextPlanPrompt({
      prompt: redactedPrompt,
      route: bmadRoute,
      readiness,
      graphContext,
      validationReport,
      approvalCommands,
      nextGoalObjective,
      contextIntent,
      evidenceResolution,
    }),
  };

  return dossier;
}

export function renderDecisionDossierMarkdown(dossier: DecisionDossier): string {
  return [
    '# ACO Decision Dossier',
    '',
    `Schema: ${dossier.schemaVersion}`,
    ...(dossier.generatedAt !== undefined ? [`Generated: ${dossier.generatedAt}`] : []),
    `Intent: ${dossier.contextIntent.intentHash}`,
    `Route: ${dossier.route.id}`,
    `Decision: ${dossier.decision.id}`,
    `Readiness: ${dossier.readiness}`,
    `Validation: ${dossier.validationStatus}`,
    `Graph: ${dossier.graphStatus}`,
    `Approval required: ${dossier.approvalRequired ? 'yes' : 'no'}`,
    '',
    '## Decision',
    '',
    dossier.decision.summary,
    '',
    `Allowed next step: ${dossier.decision.allowedNextStep}`,
    '',
    `Rationale: ${dossier.decision.rationale}`,
    '',
    '## Evidence Used',
    '',
    ...renderEvidenceUsed(dossier.evidenceUsed),
    '',
    '## Waivers',
    '',
    ...renderWaivers(dossier),
    '',
    '## Blocked Items',
    '',
    ...renderBlockedItems(dossier.blockedItems),
    '',
    '## Evidence Blockers',
    '',
    ...renderEvidenceBlockers(dossier.evidenceBlockers),
    '',
    '## Evidence Resolution',
    '',
    ...renderEvidenceResolution(dossier.evidenceResolution),
    '',
    '## Next Decision',
    '',
    ...renderNextDecision(dossier.nextDecision),
    '',
    '## Approval Commands',
    '',
    ...renderApprovalCommands(dossier.approvalCommands),
    '',
    '## Ledger Summary',
    '',
    ...renderLedgerCounts(dossier),
    '',
    '## Rejected Alternatives',
    '',
    ...dossier.rejectedAlternatives.map(
      alternative => `- ${alternative.label}: ${alternative.reason}`
    ),
    '',
    '## Next Goal Objective',
    '',
    dossier.nextGoalObjective,
    '',
    '## Next Plan Prompt',
    '',
    dossier.nextPlanPrompt,
  ].join('\n');
}

function buildDecision(input: {
  route: BmadRoute;
  readiness: DecisionDossier['readiness'];
  validationReport: ValidationReport;
  graphContext: GraphContext;
  approvalCommands: DecisionDossierApprovalCommand[];
}): DecisionDossierDecision {
  if (input.validationReport.status === 'failed') {
    return {
      id: 'blocked',
      summary: 'ACO validation failed; implementation guidance is blocked.',
      allowedNextStep: 'Resolve failed validation checks, then rebuild the dossier.',
      rationale: 'Failed validation cannot be treated as implementation-ready evidence.',
    };
  }

  if (input.readiness === 'needs_approval') {
    return {
      id: 'approval-required',
      summary: `ACO route ${input.route.id} is selected, but evidence closure needs approval.`,
      allowedNextStep:
        'Request approval for listed evidence commands or preserve named waivers explicitly before implementation.',
      rationale: `${input.graphContext.status} graph evidence and ${input.approvalCommands.length} approval command(s) require human authorization.`,
    };
  }

  if (input.readiness === 'ready') {
    return {
      id: 'ready-for-implementation',
      summary: `ACO route ${input.route.id} is ready for SDD/ATDD implementation planning.`,
      allowedNextStep:
        'Proceed through the selected BMAD route after updating specs and acceptance criteria.',
      rationale: 'Validation passed and graph evidence does not require approval.',
    };
  }

  return {
    id: 'needs-correct-course',
    summary: `ACO route ${input.route.id} has uncertain readiness.`,
    allowedNextStep: 'Clarify partial or warning evidence before implementation.',
    rationale:
      'Validation or graph evidence is not failed, but confidence is not high enough for ready state.',
  };
}

function buildEvidenceUsed(input: {
  route: BmadRoute;
  graphContext: GraphContext;
  validationReport: ValidationReport;
  ledgerBundle: LedgerBundle;
  acceptancePlan: AcceptancePlan;
}): DecisionDossierEvidence[] {
  const evidenceUsed: DecisionDossierEvidence[] = [
    {
      id: 'route',
      kind: 'route',
      status: input.route.id,
      source: 'routeBmad({ prompt })',
      summary: input.route.rationale,
    },
    {
      id: 'graph',
      kind: 'graph',
      status: input.graphContext.status,
      source: 'getGraphContext({ cwd })',
      summary: input.graphContext.summary,
    },
    {
      id: 'validation',
      kind: 'validation',
      status: input.validationReport.status,
      source: 'validateContextOrchestrator({ cwd })',
      summary: input.validationReport.checks.map(check => `${check.id}:${check.status}`).join(', '),
    },
    {
      id: 'ledgers',
      kind: 'ledger',
      status: input.ledgerBundle.schemaVersion,
      source: `buildLedgerBundle(...); intent=${input.ledgerBundle.contextIntent.intentHash}`,
      summary: `combined rows=${input.ledgerBundle.summary.combined.total}; blockers=${input.ledgerBundle.evidenceBlockers.length}`,
    },
    {
      id: 'acceptance',
      kind: 'acceptance',
      status: input.acceptancePlan.status,
      source: 'createAcceptancePlan({ prompt, route })',
      summary: `scenarios=${input.acceptancePlan.scenarios.length}`,
    },
    ...input.graphContext.waivers.map(
      (waiver): DecisionDossierEvidence => ({
        id: waiver.id,
        kind: 'waiver',
        status: 'active',
        source: waiver.evidence,
        summary: `${waiver.repository}: ${waiver.reason}`,
      })
    ),
  ];

  return evidenceUsed.map(evidence => ({
    ...evidence,
    source: redactSecrets(evidence.source),
    summary: redactSecrets(evidence.summary),
  }));
}

function buildBlockedItems(
  graphContext: GraphContext,
  validationReport: ValidationReport,
  ledgerBundle: LedgerBundle
): DecisionDossierBlockedItem[] {
  const graphItems: DecisionDossierBlockedItem[] =
    graphContext.status === 'available'
      ? []
      : [
          {
            id: 'graph-evidence',
            kind: 'graph',
            status: graphContext.status,
            reason: graphContext.summary,
            sourceEvidence: graphContext.waivers.map(waiver => waiver.id).join(', ') || 'graph',
          },
        ];
  const validationItems: DecisionDossierBlockedItem[] = validationReport.checks
    .filter(check => check.status !== 'passed')
    .map(check => ({
      id: check.id,
      kind: 'validation' as const,
      status: check.status,
      reason: check.message,
      sourceEvidence: 'validateContextOrchestrator({ cwd })',
    }));
  const toolItems = ledgerBundle.toolAvailability
    .filter(entry => nonGreenLedgerStatuses.has(entry.status))
    .map(entry => toBlockedToolItem(entry));
  const commandItems = ledgerBundle.commands
    .filter(entry => nonGreenLedgerStatuses.has(entry.status) || entry.requiresApproval)
    .map(entry => toBlockedCommandItem(entry));

  return [...graphItems, ...validationItems, ...toolItems, ...commandItems]
    .map(item => ({
      ...item,
      reason: redactSecrets(item.reason),
      sourceEvidence: redactSecrets(item.sourceEvidence),
      ...(item.command !== undefined ? { command: redactSecrets(item.command) } : {}),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function toBlockedToolItem(entry: ToolAvailabilityLedgerEntry): DecisionDossierBlockedItem {
  return {
    id: entry.id,
    kind: 'tool',
    status: entry.status,
    reason: entry.failureMode,
    sourceEvidence: entry.sourceEvidence,
  };
}

function toBlockedCommandItem(entry: CommandLedgerEntry): DecisionDossierBlockedItem {
  return {
    id: entry.id,
    kind: 'command',
    status: entry.status,
    reason: entry.requiresApproval
      ? `${entry.failureMode}; command requires explicit approval.`
      : entry.failureMode,
    sourceEvidence: entry.sourceEvidence,
    command: entry.command,
  };
}

function buildApprovalCommands(graphContext: GraphContext): DecisionDossierApprovalCommand[] {
  if (graphContext.waivers.length === 0) return [];
  const waiverIds = graphContext.waivers.map(waiver => waiver.id).join(', ');
  const commands: DecisionDossierApprovalCommand[] = [
    {
      id: 'approval.graph-refresh.required',
      command: 'bun scripts/research/graph-upstreams.ts --mode required --force',
      safety: 'writes-tracked-files',
      requiresApproval: true,
      willRun: false,
      reason: `Regenerates required graph evidence for active waivers: ${waiverIds}.`,
    },
    {
      id: 'approval.graph-docs.render',
      command: 'bun scripts/research/render-graph-evidence-docs.ts',
      safety: 'writes-tracked-files',
      requiresApproval: true,
      willRun: false,
      reason: `Re-renders tracked graph evidence docs after graph status changes for: ${waiverIds}.`,
    },
  ];

  return commands.map(
    (command): DecisionDossierApprovalCommand => ({
      id: command.id,
      command: command.command,
      safety: command.safety,
      requiresApproval: true,
      willRun: false,
      reason: redactSecrets(command.reason),
    })
  );
}

function buildNextGoalObjective(input: {
  prompt: string;
  route: BmadRoute;
  readiness: DecisionDossier['readiness'];
  graphContext: GraphContext;
}): string {
  const promptObjective = normalizeWhitespace(input.prompt).replace(/^\/goal\s+/i, '');
  const waiverSuffix =
    input.graphContext.waivers.length > 0
      ? `Preserve graph waivers: ${input.graphContext.waivers.map(waiver => waiver.id).join(', ')}.`
      : '';
  const objective = [
    promptObjective || `Execute ACO route ${input.route.id}`,
    `Follow BMAD route ${input.route.id}.`,
    `Preserve readiness=${input.readiness} and graphStatus=${input.graphContext.status}.`,
    waiverSuffix,
  ]
    .filter(part => part.length > 0)
    .join(' ');

  return truncateGoal(redactSecrets(objective));
}

function buildNextPlanPrompt(input: {
  prompt: string;
  route: BmadRoute;
  readiness: DecisionDossier['readiness'];
  graphContext: GraphContext;
  validationReport: ValidationReport;
  approvalCommands: DecisionDossierApprovalCommand[];
  nextGoalObjective: string;
  contextIntent: ContextIntent;
  evidenceResolution: EvidenceClosurePlan;
}): string {
  const waiverText =
    input.graphContext.waivers.length > 0
      ? input.graphContext.waivers.map(waiver => waiver.id).join(', ')
      : 'none';
  const approvalText =
    input.approvalCommands.length > 0
      ? input.approvalCommands.map(command => command.command).join('; ')
      : 'none';

  return redactSecrets(
    [
      'Use SDD and ATDD before production code.',
      `Goal: ${input.nextGoalObjective}`,
      `Intent hash: ${input.contextIntent.intentHash}`,
      `Original request: ${input.prompt}`,
      `Route: ${input.route.id}`,
      `Validation: ${input.validationReport.status}`,
      `Readiness: ${input.readiness}`,
      `Graph: ${input.graphContext.status}`,
      `Waivers: ${waiverText}`,
      `Approval commands: ${approvalText}`,
      `Evidence resolution required: ${input.evidenceResolution.required ? 'yes' : 'no'}`,
      'Evidence resolution:',
      ...renderEvidenceResolution(input.evidenceResolution),
      'Do not run approval-required commands without explicit user approval.',
      'Keep graph waivers explicit if implementation proceeds before evidence refresh.',
      'Follow BMAD route steps:',
      ...input.route.steps.map(step => `- ${step}`),
    ].join('\n')
  );
}

function rejectedAlternatives(): DecisionDossierRejectedAlternative[] {
  return [
    {
      id: 'db-backed-dossier',
      label: 'DB-backed dossier',
      reason:
        'Artifacts and existing events can carry dossier state; migration is not proven necessary.',
    },
    {
      id: 'api-web-exposure',
      label: 'API/Web exposure',
      reason:
        'CLI and compile artifacts are enough for this slice; broader surfaces add premature scope.',
    },
    {
      id: 'workflow-engine-expansion',
      label: 'Workflow engine expansion',
      reason: 'Dossier is a route/compile boundary artifact, not new workflow semantics.',
    },
    {
      id: 'implicit-graphify-refresh',
      label: 'Implicit Graphify refresh',
      reason: 'Graph refresh writes tracked evidence and must stay approval-required.',
    },
    {
      id: 'static-handoff-prompt',
      label: 'Static Codex Goal Handoff',
      reason:
        'Static goal text can drift from the current prompt and send the next agent to wrong work.',
    },
  ];
}

function renderEvidenceUsed(evidenceUsed: DecisionDossierEvidence[]): string[] {
  if (evidenceUsed.length === 0) return ['- none'];
  return evidenceUsed.map(
    evidence =>
      `- ${evidence.id} (${evidence.kind}, ${evidence.status}): ${evidence.summary} [${evidence.source}]`
  );
}

function renderWaivers(dossier: DecisionDossier): string[] {
  if (dossier.waivers.length === 0) return ['- none'];
  return dossier.waivers.map(
    waiver =>
      `- ${waiver.id}: ${waiver.repository}; owner=${waiver.owner}; reason=${waiver.reason}; expiry=${waiver.expiryCondition}`
  );
}

function renderBlockedItems(blockedItems: DecisionDossierBlockedItem[]): string[] {
  if (blockedItems.length === 0) return ['- none'];
  return blockedItems.map(item => {
    const command = item.command !== undefined ? `; command=${item.command}` : '';
    return `- ${item.id} (${item.kind}, ${item.status}): ${item.reason}${command}`;
  });
}

function renderEvidenceBlockers(blockers: DecisionDossier['evidenceBlockers']): string[] {
  if (blockers.length === 0) return ['- none'];
  return blockers.map(
    blocker =>
      `- ${blocker.id} (${blocker.kind}, ${blocker.status}, ${blocker.freshness}): ${blocker.nextVerificationAction}`
  );
}

function renderEvidenceResolution(plan: EvidenceClosurePlan): string[] {
  if (plan.items.length === 0) return ['- none'];
  return plan.items.map(
    item => `- ${item.evidenceId} (${item.targetKind}, ${item.resolver}): ${item.nextAction}`
  );
}

function renderNextDecision(nextDecision: NextDecision): string[] {
  return [
    `- Schema: ${nextDecision.schemaVersion}`,
    `- Kind: ${nextDecision.kind}`,
    `- Title: ${nextDecision.title}`,
    `- Summary: ${nextDecision.summary}`,
    `- Primary action: ${nextDecision.primaryAction.label} (${nextDecision.primaryAction.kind}, willRun=false, approval=${nextDecision.primaryAction.requiresApproval ? 'yes' : 'no'})`,
    `- Waivers: ${nextDecision.waiverIds.length > 0 ? nextDecision.waiverIds.join(', ') : 'none'}`,
    `- Evidence blockers: ${nextDecision.evidenceBlockerIds.length > 0 ? nextDecision.evidenceBlockerIds.join(', ') : 'none'}`,
  ];
}

function renderApprovalCommands(commands: DecisionDossierApprovalCommand[]): string[] {
  if (commands.length === 0) return ['- none'];
  return commands.map(
    command =>
      `- ${command.id}: \`${command.command}\` (${command.safety}, approval required, willRun=false) - ${command.reason}`
  );
}

function renderLedgerCounts(dossier: DecisionDossier): string[] {
  const summary = dossier.ledgerSummary.combined;
  return [
    `Total rows: ${summary.total}`,
    ...ledgerStatusOrder.map(status => `- ${status}: ${summary.counts[status]}`),
  ];
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function truncateGoal(value: string): string {
  if (value.length <= goalMaxLength) return value;
  return `${value.slice(0, goalMaxLength - 3).trimEnd()}...`;
}
