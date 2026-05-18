import {
  getContextOrchestratorStatus,
  type ContextOrchestratorStatus,
} from '@archon/context-orchestrator';
import type { ContextCommandOptions } from './context';

export async function acoStatusCommand(options: ContextCommandOptions): Promise<void> {
  const status = await getContextOrchestratorStatus(options.cwd);
  if (options.json) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  console.log(formatAcoStatusText(status));
}

export function formatAcoStatusText(status: ContextOrchestratorStatus): string {
  const combined = status.ledgerSummary.combined;
  const readiness = toReadinessLabel(status);
  const waiverHeading =
    status.graphStatus === 'forbidden'
      ? 'Forbidden graph confidence limits:'
      : 'Accepted confidence limits:';
  const waiverLines =
    status.graphWaiverIds.length > 0
      ? [waiverHeading, ...status.graphWaiverIds.map(waiverId => `- ${waiverId}`)]
      : [`${waiverHeading} none`];

  return [
    'ACO Status',
    `Context Readiness: ${readiness}`,
    `cwd: ${status.cwd}`,
    `validation: ${status.validationStatus}`,
    `graph: ${status.graphStatus}`,
    `waivers: ${String(status.graphWaivers)}`,
    `schema: ${status.ledgerSchemaVersion}`,
    `ledger counts: total=${String(combined.total)} available=${String(combined.counts.available)} partial=${String(combined.counts.partial)} deferred=${String(combined.counts.deferred)} forbidden=${String(combined.counts.forbidden)} unknown=${String(combined.counts.unknown)}`,
    ...waiverLines,
  ].join('\n');
}

function toReadinessLabel(status: ContextOrchestratorStatus): string {
  if (status.graphStatus === 'forbidden') {
    return 'Blocked by forbidden graph limits';
  }
  if (status.validationStatus === 'passed' && status.graphStatus === 'available') {
    return 'Ready';
  }
  if (status.validationStatus === 'passed' && status.graphWaivers > 0) {
    return 'Ready with known limits';
  }
  if (status.validationStatus === 'passed') {
    return 'Ready with partial evidence';
  }
  return 'Blocked';
}
