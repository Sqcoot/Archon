import {
  compilePromptPackage,
  createApprovalCapsule,
  createDecisionDossier,
  getContextOrchestratorReadiness,
  getGraphWaiverClosureReport,
  getContextOrchestratorLedgers,
  getContextOrchestratorStatus,
  renderApprovalCapsuleMarkdown,
  renderDecisionDossierMarkdown,
  renderLedgerBundleMarkdown,
  renderGraphWaiverClosureReportMarkdown,
  serializeLedgerBundle,
  routeBmad,
  validateContextOrchestrator,
  verifyApprovalCapsuleArtifacts,
  writeApprovalCapsuleArtifacts,
  type CavemanMode,
  type PromptPackageResult,
} from '@archon/context-orchestrator';

export interface ContextCommandOptions {
  cwd: string;
  json?: boolean;
  objective?: string;
  timestamp?: string;
}

export interface ContextCompileCommandOptions extends ContextCommandOptions {
  archiveRoot?: string;
  runId?: string;
  cavemanMode?: CavemanMode;
}

export interface ContextApprovalCapsuleCommandOptions extends ContextCommandOptions {
  artifactRoot?: string;
  runId: string;
}

export async function contextStatusCommand(options: ContextCommandOptions): Promise<void> {
  const status = await getContextOrchestratorStatus(options.cwd, {
    objective: options.objective,
    timestamp: options.timestamp,
  });
  if (options.json) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  console.log(`Context Orchestrator status: ${status.validationStatus}`);
  console.log(`Readiness: ${status.readiness}`);
  console.log(`Next decision: ${status.nextDecision.kind}`);
  console.log(`Next action: ${status.nextDecision.primaryAction.label}`);
  console.log(`Intent: ${status.contextIntent.intentHash}`);
  console.log(`Objective: ${status.contextIntent.normalizedObjective}`);
  console.log(`Graph: ${status.graphStatus} (${status.graphWaivers} waiver(s))`);
  if (status.evidenceBlockers.length > 0) {
    console.log(
      `Evidence blockers: ${status.evidenceBlockers
        .map(blocker => `${blocker.id} -> ${blocker.nextVerificationAction}`)
        .join('; ')}`
    );
  }
  console.log(`Evidence resolution required: ${status.evidenceResolution.required ? 'yes' : 'no'}`);
  for (const item of status.evidenceResolution.items) {
    console.log(
      `- ${item.evidenceId}: ${item.resolver} -> ${item.targetName}; approval=${item.requiresApproval ? 'yes' : 'no'}`
    );
    console.log(`  Next: ${item.nextAction}`);
  }
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
    const bundle = await getContextOrchestratorLedgers(options.cwd, {
      objective: options.objective,
      timestamp: options.timestamp,
    });
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

export async function contextApprovalCapsuleCommand(
  prompt: string,
  options: ContextApprovalCapsuleCommandOptions
): Promise<number> {
  const capsule = await createApprovalCapsule({
    cwd: options.cwd,
    prompt,
    runId: options.runId,
    timestamp: options.timestamp,
    artifactRoot: options.artifactRoot,
  });

  if (options.artifactRoot !== undefined) {
    const files = await writeApprovalCapsuleArtifacts(capsule, options.artifactRoot);
    if (options.json) {
      console.log(JSON.stringify({ capsule, files }, null, 2));
      return 0;
    }

    console.log(`Approval capsule JSON: ${files.json}`);
    console.log(`Approval capsule Markdown: ${files.markdown}`);
    return 0;
  }

  if (options.json) {
    console.log(JSON.stringify(capsule, null, 2));
    return 0;
  }

  console.log(renderApprovalCapsuleMarkdown(capsule));
  return 0;
}

export async function contextApprovalCapsuleVerifyCommand(
  options: ContextApprovalCapsuleCommandOptions
): Promise<number> {
  if (options.artifactRoot === undefined) {
    const message = '--artifact-root is required';
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            schemaVersion: 'aco.approval-contract-verification.v1',
            status: 'invalid',
            contractId: '',
            contractHash: '',
            mismatches: [{ field: 'artifactRoot', reason: message }],
            nextAction: 'Provide the ACO artifact root and retry approval capsule verification.',
            willRun: false,
          },
          null,
          2
        )
      );
    } else {
      console.error(`Context Orchestrator approval capsule verification failed: ${message}`);
    }
    return 1;
  }

  const verification = await verifyApprovalCapsuleArtifacts({
    cwd: options.cwd,
    artifactRoot: options.artifactRoot,
    runId: options.runId,
  });

  if (options.json) {
    console.log(JSON.stringify(verification, null, 2));
  } else {
    console.log(`Approval contract verification: ${verification.status}`);
    console.log(`Contract: ${verification.contractId || 'unknown'}`);
    console.log(`Will run: ${verification.willRun ? 'yes' : 'no'}`);
    if (verification.mismatches.length > 0) {
      for (const mismatch of verification.mismatches) {
        console.log(`- ${mismatch.field}: ${mismatch.reason}`);
      }
    }
    console.log(`Next action: ${verification.nextAction}`);
  }

  return verification.status === 'valid' ? 0 : 1;
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
  console.log(`Intent: ${result.package.contextIntent.intentHash}`);
  console.log(`Route: ${result.package.bmadRoute.id}`);
  console.log(`Graph: ${result.package.graphContext.status}`);
  console.log(`Validation: ${result.package.validationReport.status}`);
  console.log(`Next decision: ${result.package.nextDecision.kind}`);
  console.log(
    `Evidence resolution required: ${result.package.evidenceResolution.required ? 'yes' : 'no'}`
  );
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
    result.package.validationReport,
    result.package.ledgerBundle.evidenceBlockers
  );
  return {
    runId: result.package.runId,
    contextIntent: result.package.contextIntent,
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
    evidenceBlockers: result.package.ledgerBundle.evidenceBlockers,
    evidenceResolution: result.package.evidenceResolution,
    nextDecision: result.package.nextDecision,
    decisionDossierSchemaVersion: result.package.decisionDossier.schemaVersion,
    decisionDossierDecision: result.package.decisionDossier.decision.id,
    decisionDossierReadiness: result.package.decisionDossier.readiness,
  };
}
