import { createAcceptancePlan } from './acceptance';
import { routeBmad } from './bmad';
import { selectCapabilities } from './capabilities';
import { planDocumentation } from './docs';
import { getGraphContext } from './graph';
import { buildLedgerBundle } from './ledgers';
import { validateContextOrchestrator } from './validation';
import type { LedgerBundle } from './types';

export interface ContextOrchestratorStatus {
  cwd: string;
  graphStatus: string;
  graphWaivers: number;
  validationStatus: string;
}

export async function getContextOrchestratorStatus(
  cwd: string
): Promise<ContextOrchestratorStatus> {
  const [graphContext, validationReport] = await Promise.all([
    getGraphContext({ cwd }),
    validateContextOrchestrator({ cwd }),
  ]);
  return {
    cwd,
    graphStatus: graphContext.status,
    graphWaivers: graphContext.waiverCount,
    validationStatus: validationReport.status,
  };
}

export async function getContextOrchestratorLedgers(
  cwd: string,
  timestamp?: string
): Promise<LedgerBundle> {
  const prompt = 'Inspect ACO context-orchestrator ledger capabilities.';
  const graphContext = await getGraphContext({ cwd });
  const documentationPlan = planDocumentation({ prompt: '' });
  const bmadRoute = routeBmad({ prompt });
  const acceptancePlan = createAcceptancePlan({ prompt, route: bmadRoute });
  const selectedCapabilities = selectCapabilities({ graphContext, documentationPlan });
  const validationReport = await validateContextOrchestrator({ cwd });

  return buildLedgerBundle({
    cwd,
    timestamp,
    graphContext,
    documentationPlan,
    bmadRoute,
    acceptancePlan,
    selectedCapabilities,
    validationReport,
  });
}
