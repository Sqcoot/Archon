import { createAcceptancePlan } from './acceptance';
import { routeBmad } from './bmad';
import { selectCapabilities } from './capabilities';
import { planDocumentation } from './docs';
import { getGraphContext } from './graph';
import { createContextIntent, deriveDefaultObjective } from './intent';
import { buildLedgerBundle } from './ledgers';
import { validateContextOrchestrator } from './validation';
import type {
  ContextOrchestratorReadiness,
  ContextIntent,
  EvidenceBlocker,
  GraphContext,
  GraphWaiver,
  LedgerBundle,
  LedgerBundleSummary,
  ValidationReport,
} from './types';

export interface ContextEvidenceOptions {
  objective?: string;
  timestamp?: string;
  contextIntent?: ContextIntent;
}

export interface ContextOrchestratorStatus {
  cwd: string;
  contextIntent: ContextIntent;
  graphStatus: GraphContext['status'];
  graphWaivers: number;
  graphWaiverIds: string[];
  waivers: GraphWaiver[];
  approvalRequired: boolean;
  readiness: ContextOrchestratorReadiness;
  validationStatus: string;
  ledgerSchemaVersion: LedgerBundle['schemaVersion'];
  ledgerSummary: LedgerBundleSummary;
  evidenceBlockers: EvidenceBlocker[];
}

export async function getContextOrchestratorStatus(
  cwd: string,
  options: ContextEvidenceOptions = {}
): Promise<ContextOrchestratorStatus> {
  const { contextIntent, graphContext, validationReport, ledgerBundle } =
    await buildContextLedgerEvidence(cwd, options);
  return {
    cwd,
    contextIntent,
    graphStatus: graphContext.status,
    graphWaivers: graphContext.waiverCount,
    graphWaiverIds: graphContext.waivers.map(waiver => waiver.id),
    waivers: graphContext.waivers,
    approvalRequired: isApprovalRequired(graphContext),
    readiness: getContextOrchestratorReadiness(
      graphContext,
      validationReport,
      ledgerBundle.evidenceBlockers
    ),
    validationStatus: validationReport.status,
    ledgerSchemaVersion: ledgerBundle.schemaVersion,
    ledgerSummary: ledgerBundle.summary,
    evidenceBlockers: ledgerBundle.evidenceBlockers,
  };
}

export function getContextOrchestratorReadiness(
  graphContext: Pick<GraphContext, 'status'>,
  validationReport: Pick<ValidationReport, 'status'>,
  evidenceBlockers: readonly EvidenceBlocker[] = []
): ContextOrchestratorReadiness {
  if (isApprovalRequired(graphContext)) return 'needs_approval';
  if (validationReport.status === 'failed') return 'blocked';
  // Evidence blockers preserve exact ledger row IDs, for example tool.docs-evidence.
  if (evidenceBlockers.length > 0) return 'blocked';
  if (validationReport.status !== 'passed') return 'unknown';
  if (graphContext.status === 'partial') return 'unknown';
  return 'ready';
}

function isApprovalRequired(graphContext: Pick<GraphContext, 'status'>): boolean {
  return graphContext.status === 'forbidden' || graphContext.status === 'unavailable';
}

export async function getContextOrchestratorLedgers(
  cwd: string,
  optionsOrTimestamp?: ContextEvidenceOptions | string
): Promise<LedgerBundle> {
  return (await buildContextLedgerEvidence(cwd, normalizeEvidenceOptions(optionsOrTimestamp)))
    .ledgerBundle;
}

async function buildContextLedgerEvidence(
  cwd: string,
  options: ContextEvidenceOptions = {}
): Promise<{
  contextIntent: ContextIntent;
  graphContext: GraphContext;
  validationReport: ValidationReport;
  ledgerBundle: LedgerBundle;
}> {
  const contextIntent =
    options.contextIntent ??
    (await createContextIntent({
      cwd,
      objective: options.objective ?? deriveDefaultObjective(cwd),
      timestamp: options.timestamp,
    }));
  const prompt = contextIntent.objective;
  const graphContext = await getGraphContext({ cwd });
  const documentationPlan = planDocumentation({ prompt });
  const bmadRoute = routeBmad({ prompt });
  const acceptancePlan = createAcceptancePlan({ prompt, route: bmadRoute });
  const selectedCapabilities = selectCapabilities({ graphContext, documentationPlan });
  const validationReport = await validateContextOrchestrator({ cwd });

  const ledgerBundle = await buildLedgerBundle({
    cwd,
    objective: prompt,
    timestamp: contextIntent.generatedAt,
    contextIntent,
    graphContext,
    documentationPlan,
    bmadRoute,
    acceptancePlan,
    selectedCapabilities,
    validationReport,
  });

  return { contextIntent, graphContext, validationReport, ledgerBundle };
}

function normalizeEvidenceOptions(
  optionsOrTimestamp: ContextEvidenceOptions | string | undefined
): ContextEvidenceOptions {
  if (typeof optionsOrTimestamp === 'string') return { timestamp: optionsOrTimestamp };
  return optionsOrTimestamp ?? {};
}
