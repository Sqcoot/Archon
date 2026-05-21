import {
  getContextOrchestratorStatus,
  type ContextOrchestratorStatus,
} from '@archon/context-orchestrator';
import type { ContextCommandOptions } from './context';

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
