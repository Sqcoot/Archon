import { createAcceptancePlan } from './acceptance';
import { routeBmad } from './bmad';
import { selectCapabilities } from './capabilities';
import { planDocumentation } from './docs';
import { getGraphContext } from './graph';
import { buildLedgerBundle } from './ledgers';
import { validateContextOrchestrator } from './validation';
import type { GraphContext, LedgerBundle, LedgerBundleSummary, ValidationReport } from './types';

const contextLedgerPrompt = 'implement aco confidence closure';

export interface ContextOrchestratorStatus {
  cwd: string;
  graphStatus: string;
  graphWaivers: number;
  graphWaiverIds: string[];
  validationStatus: string;
  ledgerSchemaVersion: LedgerBundle['schemaVersion'];
  ledgerSummary: LedgerBundleSummary;
}

export async function getContextOrchestratorStatus(
  cwd: string
): Promise<ContextOrchestratorStatus> {
  const { graphContext, validationReport, ledgerBundle } = await buildContextLedgerEvidence(cwd);
  return {
    cwd,
    graphStatus: graphContext.status,
    graphWaivers: graphContext.waiverCount,
    graphWaiverIds: graphContext.waivers.map(waiver => waiver.id),
    validationStatus: validationReport.status,
    ledgerSchemaVersion: ledgerBundle.schemaVersion,
    ledgerSummary: ledgerBundle.summary,
  };
}

export async function getContextOrchestratorLedgers(
  cwd: string,
  timestamp?: string
): Promise<LedgerBundle> {
  return (await buildContextLedgerEvidence(cwd, timestamp)).ledgerBundle;
}

async function buildContextLedgerEvidence(
  cwd: string,
  timestamp?: string
): Promise<{
  graphContext: GraphContext;
  validationReport: ValidationReport;
  ledgerBundle: LedgerBundle;
}> {
  const prompt = contextLedgerPrompt;
  const graphContext = await getGraphContext({ cwd });
  const documentationPlan = planDocumentation({ prompt });
  const bmadRoute = routeBmad({ prompt });
  const acceptancePlan = createAcceptancePlan({ prompt, route: bmadRoute });
  const selectedCapabilities = selectCapabilities({ graphContext, documentationPlan });
  const validationReport = await validateContextOrchestrator({ cwd });

  const ledgerBundle = await buildLedgerBundle({
    cwd,
    timestamp,
    graphContext,
    documentationPlan,
    bmadRoute,
    acceptancePlan,
    selectedCapabilities,
    validationReport,
  });

  return { graphContext, validationReport, ledgerBundle };
}
