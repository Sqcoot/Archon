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
  if (status.graphStatus === 'forbidden') return 'Blocked by forbidden graph limits';
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
    status.graphStatus === 'forbidden' ? 'forbidden graph limits' : 'accepted limits';
  return [
    `validation ${status.validationStatus}`,
    `graph ${status.graphStatus}`,
    `${String(status.graphWaivers)} ${limitLabel}`,
    `${String(status.ledgerSummary.combined.total)} ledger rows`,
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
      ? 'Forbidden graph confidence limits:'
      : 'Accepted confidence limits:';
  const limitNarrative =
    status.graphStatus === 'forbidden'
      ? 'Forbidden graph limits: failed waiver-required graph evidence remains unresolved; this does not prove full marketplace/plugin graph certainty, sample data completeness, or production CI enforcement.'
      : 'Known limits: graph remains partial when accepted waivers are present; this does not prove full marketplace/plugin graph certainty, sample data completeness, or production CI enforcement.';

  return [
    `ACO Readiness: ${getAcoReadinessLabel(status)}`,
    `Validation: ${status.validationStatus}`,
    `Graph: ${status.graphStatus}`,
    `Ledger: ${status.ledgerSchemaVersion}; ${formatAcoLedgerCounts(status)}`,
    waiverHeading,
    waiverLines,
    limitNarrative,
  ].join('\n');
}
