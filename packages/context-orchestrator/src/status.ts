import { getGraphContext } from './graph';
import { validateContextOrchestrator } from './validation';

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
