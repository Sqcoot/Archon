import {
  compilePromptPackage,
  createDecisionDossier,
  getContextOrchestratorReadiness,
  getGraphWaiverClosureReport,
  getContextOrchestratorLedgers,
  getContextOrchestratorStatus,
  renderDecisionDossierMarkdown,
  renderLedgerBundleMarkdown,
  renderGraphWaiverClosureReportMarkdown,
  serializeLedgerBundle,
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

  console.log(`Context Orchestrator status: ${status.validationStatus}`);
  console.log(`Readiness: ${status.readiness}`);
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

export async function contextLedgersCommand(options: ContextCommandOptions): Promise<number> {
  try {
    const bundle = await getContextOrchestratorLedgers(options.cwd);
    if (options.json) {
      console.log(JSON.stringify(serializeLedgerBundle(bundle), null, 2));
      return 0;
    }

    console.log(renderLedgerBundleMarkdown(bundle));
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            error: 'aco-ledger-build-failed',
            message,
          },
          null,
          2
        )
      );
    } else {
      console.error(`Context Orchestrator ledgers failed: ${message}`);
    }
    return 1;
  }
}

export async function contextDossierCommand(
  prompt: string,
  options: ContextCommandOptions & { timestamp?: string }
): Promise<number> {
  const dossier = await createDecisionDossier({
    cwd: options.cwd,
    prompt,
    timestamp: options.timestamp,
  });
  if (options.json) {
    console.log(JSON.stringify(dossier, null, 2));
    return 0;
  }

  console.log(renderDecisionDossierMarkdown(dossier));
  return 0;
}

export async function contextGraphWaiversCommand(
  options: ContextCommandOptions & { timestamp?: string }
): Promise<number> {
  const report = await getGraphWaiverClosureReport({
    cwd: options.cwd,
    timestamp: options.timestamp,
  });
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return 0;
  }

  console.log(renderGraphWaiverClosureReportMarkdown(report));
  return 0;
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

  console.log(`Context package: ${result.archivePath}`);
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

  console.log(`Context Orchestrator route: ${route.id}`);
  console.log(route.rationale);
  for (const step of route.steps) {
    console.log(`- ${step}`);
  }
}

function toCompileJson(result: PromptPackageResult): Record<string, unknown> {
  const readiness = getContextOrchestratorReadiness(
    result.package.graphContext,
    result.package.validationReport
  );
  return {
    runId: result.package.runId,
    archivePath: result.archivePath,
    files: result.files,
    route: result.package.bmadRoute.id,
    graphStatus: result.package.graphContext.status,
    graphWaivers: result.package.graphContext.waiverCount,
    graphWaiverIds: result.package.graphContext.waivers.map(waiver => waiver.id),
    waivers: result.package.graphContext.waivers,
    approvalRequired: readiness === 'needs_approval',
    readiness,
    openaiDocsMcpStatus: result.package.documentationPlan.readiness.openaiDocsMcp,
    context7Status: result.package.documentationPlan.readiness.context7,
    acceptanceStatus: result.package.acceptancePlan.status,
    validationStatus: result.package.validationReport.status,
    ledgerSchemaVersion: result.package.ledgerBundle.schemaVersion,
    ledgerSummary: result.package.ledgerBundle.summary,
    decisionDossierSchemaVersion: result.package.decisionDossier.schemaVersion,
    decisionDossierDecision: result.package.decisionDossier.decision.id,
    decisionDossierReadiness: result.package.decisionDossier.readiness,
  };
}
