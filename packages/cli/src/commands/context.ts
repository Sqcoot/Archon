import {
  compilePromptPackage,
  getContextOrchestratorStatus,
  routeBmad,
  validateContextOrchestrator,
  type CavemanMode,
  type PromptPackageResult,
} from '@archon/context-orchestrator';

export interface ContextCommandOptions {
  cwd: string;
  json?: boolean;
}

export interface ContextCompileCommandOptions extends ContextCommandOptions {
  archiveRoot?: string;
  runId?: string;
  timestamp?: string;
  cavemanMode?: CavemanMode;
}

export async function contextStatusCommand(options: ContextCommandOptions): Promise<void> {
  const status = await getContextOrchestratorStatus(options.cwd);
  if (options.json) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  console.log(`ACO status: ${status.validationStatus}`);
  console.log(`Graph: ${status.graphStatus} (${status.graphWaivers} waiver(s))`);
}

export async function contextValidateCommand(options: ContextCommandOptions): Promise<number> {
  const report = await validateContextOrchestrator({ cwd: options.cwd });
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`ACO validation: ${report.status}`);
    for (const check of report.checks) {
      console.log(`- ${check.id}: ${check.status} - ${check.message}`);
    }
  }

  return report.status === 'failed' ? 1 : 0;
}

export async function contextCompileCommand(
  prompt: string,
  options: ContextCompileCommandOptions
): Promise<void> {
  const result = await compilePromptPackage({
    cwd: options.cwd,
    prompt,
    archiveRoot: options.archiveRoot,
    runId: options.runId,
    timestamp: options.timestamp,
    cavemanMode: options.cavemanMode,
  });

  if (options.json) {
    console.log(JSON.stringify(toCompileJson(result), null, 2));
    return;
  }

  console.log(`ACO package: ${result.archivePath}`);
  console.log(`Route: ${result.package.bmadRoute.id}`);
  console.log(`Graph: ${result.package.graphContext.status}`);
  console.log(`Validation: ${result.package.validationReport.status}`);
  console.log(`Codex prompt: ${result.files['codex-prompt.md']}`);
}

export async function contextRouteCommand(
  prompt: string,
  options: ContextCommandOptions
): Promise<void> {
  const route = routeBmad({ prompt });
  if (options.json) {
    console.log(JSON.stringify(route, null, 2));
    return;
  }

  console.log(`ACO route: ${route.id}`);
  console.log(route.rationale);
  for (const step of route.steps) {
    console.log(`- ${step}`);
  }
}

function toCompileJson(result: PromptPackageResult): Record<string, unknown> {
  return {
    runId: result.package.runId,
    archivePath: result.archivePath,
    files: result.files,
    route: result.package.bmadRoute.id,
    graphStatus: result.package.graphContext.status,
    openaiDocsMcpStatus: result.package.documentationPlan.readiness.openaiDocsMcp,
    context7Status: result.package.documentationPlan.readiness.context7,
    acceptanceStatus: result.package.acceptancePlan.status,
    validationStatus: result.package.validationReport.status,
  };
}
