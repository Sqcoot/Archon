import {
  getContextOrchestratorStatus,
  runAcoCleanupCodexCommand,
  runAcoBootstrapCodexCommand,
  type AcoBootstrapEvent,
  type AcoBootstrapFormat,
  type AcoGoalStatus,
  type ContextOrchestratorStatus,
} from '@archon/context-orchestrator';
import type { ContextCommandOptions } from './context';

export interface AcoBootstrapCodexCommandOptions extends ContextCommandOptions {
  event?: AcoBootstrapEvent;
  maxBytes?: number;
  format?: AcoBootstrapFormat;
  writeArtifact?: boolean;
  strict?: boolean;
  evaluator?: boolean;
  goalStatus?: AcoGoalStatus;
  nextGoalObjective?: string;
  archiveRoot?: string;
  runId?: string;
}

export interface AcoCleanupCodexCommandOptions extends ContextCommandOptions {
  runId?: string;
  manifest?: string;
  artifactsDir?: string;
  dryRun?: boolean;
  apply?: boolean;
}

export async function acoStatusCommand(options: ContextCommandOptions): Promise<void> {
  const status = await getContextOrchestratorStatus(options.cwd, {
    objective: options.objective,
    timestamp: options.timestamp,
  });
  if (options.json) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  console.log(formatAcoStatusText(status));
}

export async function acoBootstrapCodexCommand(
  prompt: string | undefined,
  options: AcoBootstrapCodexCommandOptions
): Promise<number> {
  try {
    const result = await runAcoBootstrapCodexCommand({
      cwd: options.cwd,
      prompt,
      event: options.event,
      maxBytes: options.maxBytes,
      format: options.format,
      writeArtifact: options.writeArtifact,
      strict: options.strict,
      evaluator: options.evaluator,
      timestamp: options.timestamp,
      goalStatus: options.goalStatus,
      nextGoalObjective: options.nextGoalObjective,
      archiveRoot: options.archiveRoot,
      runId: options.runId,
    });
    console.log(result.output.text);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.json || options.format === 'json') {
      console.log(JSON.stringify({ error: 'aco-bootstrap-codex-failed', message }, null, 2));
    } else {
      console.error(`ACO Codex bootstrap failed: ${message}`);
    }
    return 1;
  }
}

export async function acoCleanupCodexCommand(
  options: AcoCleanupCodexCommandOptions
): Promise<number> {
  try {
    const result = await runAcoCleanupCodexCommand({
      cwd: options.cwd,
      runId: options.runId,
      manifest: options.manifest,
      artifactsDir: options.artifactsDir,
      dryRun: options.dryRun,
      apply: options.apply,
      json: options.json,
      timestamp: options.timestamp,
    });
    console.log(result.output.text);
    return result.status === 'passed' ? 0 : 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.json) {
      console.log(JSON.stringify({ error: 'aco-cleanup-codex-failed', message }, null, 2));
    } else {
      console.error(`ACO Codex cleanup failed: ${message}`);
    }
    return 1;
  }
}

export function formatAcoStatusText(status: ContextOrchestratorStatus): string {
  const combined = status.ledgerSummary.combined;
  const readiness = toReadinessLabel(status);
  const waiverHeading = status.approvalRequired
    ? 'Approval-required graph confidence limits:'
    : 'Accepted confidence limits:';
  const waiverLines =
    status.graphWaiverIds.length > 0
      ? [waiverHeading, ...status.graphWaiverIds.map(waiverId => `- ${waiverId}`)]
      : [`${waiverHeading} none`];

  return [
    'Context Orchestrator Status',
    `Readiness: ${readiness}`,
    `cwd: ${status.cwd}`,
    `intent: ${status.contextIntent.intentHash}`,
    `objective: ${status.contextIntent.normalizedObjective}`,
    `validation: ${status.validationStatus}`,
    `graph: ${status.graphStatus}`,
    `waivers: ${String(status.graphWaivers)}`,
    `schema: ${status.ledgerSchemaVersion}`,
    `ledger counts: total=${String(combined.total)} available=${String(combined.counts.available)} partial=${String(combined.counts.partial)} deferred=${String(combined.counts.deferred)} forbidden=${String(combined.counts.forbidden)} unknown=${String(combined.counts.unknown)}`,
    `capability snapshot: ${status.capabilityDiscovery.schemaVersion} claims=${String(status.capabilityDiscovery.evidenceClaims)} providers=${String(status.capabilityDiscovery.providers)} commands=${String(status.capabilityDiscovery.commands)} workflows=${String(status.capabilityDiscovery.workflows)}`,
    `bootstrap events: ${status.bootstrapEvents.join(', ')}`,
    `evidence blockers: ${String(status.evidenceBlockers.length)}`,
    ...waiverLines,
  ].join('\n');
}

function toReadinessLabel(status: ContextOrchestratorStatus): string {
  switch (status.readiness) {
    case 'ready':
      return 'Ready';
    case 'needs_approval':
      return 'Needs approval';
    case 'needs_decision':
      return 'Needs decision';
    case 'unknown':
      return 'Unknown';
    case 'blocked':
      return 'Blocked';
  }
}
