import type { AcoStatusResponse } from './api';

export const acoLedgerCountOrder = [
  'available',
  'partial',
  'deferred',
  'forbidden',
  'unknown',
] as const;

type LedgerCountKey = (typeof acoLedgerCountOrder)[number];

function getCombinedCounts(status: AcoStatusResponse): Record<LedgerCountKey, number> {
  const counts = status.ledgerSummary.combined.counts;
  return {
    available: counts.available,
    partial: counts.partial,
    deferred: counts.deferred,
    forbidden: counts.forbidden,
    unknown: counts.unknown,
  };
}

export function getAcoReadinessLabel(status: AcoStatusResponse): string {
  if (status.readiness === 'needs_approval') return 'Needs approval';
  if (status.readiness === 'blocked') return 'Blocked';
  if (status.readiness === 'unknown') return 'Unknown';
  if (status.readiness === 'ready' && status.validationStatus === 'passed') return 'Ready';

  if (status.graphStatus === 'forbidden') return 'Needs approval';
  if (status.validationStatus !== 'passed') return 'Blocked';

  const counts = getCombinedCounts(status);
  const hasKnownLimits =
    status.graphStatus !== 'available' ||
    status.graphWaivers > 0 ||
    counts.partial > 0 ||
    counts.deferred > 0 ||
    counts.forbidden > 0 ||
    counts.unknown > 0;

  return hasKnownLimits ? 'Ready with known limits' : 'Ready';
}

export function formatAcoLedgerCounts(status: AcoStatusResponse): string {
  const counts = getCombinedCounts(status);
  return [
    `total ${String(status.ledgerSummary.combined.total)}`,
    ...acoLedgerCountOrder.map(key => `${key} ${String(counts[key])}`),
  ].join(' · ');
}

export function formatAcoEvidenceSummary(status: AcoStatusResponse): string {
  const unknown = status.ledgerSummary.combined.counts.unknown;
  const limitLabel =
    status.graphStatus === 'forbidden' ? 'approval-required graph limits' : 'accepted limits';
  return [
    `intent ${status.contextIntent.intentHash}`,
    `validation ${status.validationStatus}`,
    `graph ${status.graphStatus}`,
    `${String(status.graphWaivers)} ${limitLabel}`,
    `${String(status.ledgerSummary.combined.total)} ledger rows`,
    `${String(status.evidenceBlockers.length)} blockers`,
    `${String(unknown)} unknown`,
  ].join(' · ');
}

export function formatAcoHandoffNarrative(status: AcoStatusResponse): string {
  const waiverLines =
    status.graphWaiverIds.length > 0
      ? status.graphWaiverIds.map(id => `- ${id}`).join('\n')
      : '- none';
  const waiverHeading =
    status.graphStatus === 'forbidden'
      ? 'Approval-required graph confidence limits:'
      : 'Accepted confidence limits:';
  const limitNarrative =
    status.graphStatus === 'forbidden'
      ? 'Needs approval: failed waiver-required graph evidence remains unresolved; this does not prove full marketplace/plugin graph certainty, sample data completeness, or production CI enforcement.'
      : 'Known limits: graph remains partial when accepted waivers are present; this does not prove full marketplace/plugin graph certainty, sample data completeness, or production CI enforcement.';
  const blockerLines =
    status.evidenceBlockers.length > 0
      ? status.evidenceBlockers
          .map(blocker => `- ${blocker.id}: ${blocker.nextVerificationAction}`)
          .join('\n')
      : '- none';

  return [
    `Context Orchestrator Readiness: ${getAcoReadinessLabel(status)}`,
    `Intent: ${status.contextIntent.intentHash}`,
    `Objective: ${status.contextIntent.normalizedObjective}`,
    `Validation: ${status.validationStatus}`,
    `Graph: ${status.graphStatus}`,
    `Ledger: ${status.ledgerSchemaVersion}; ${formatAcoLedgerCounts(status)}`,
    'Evidence blockers:',
    blockerLines,
    waiverHeading,
    waiverLines,
    limitNarrative,
  ].join('\n');
}
