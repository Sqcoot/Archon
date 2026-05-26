import type { LedgerBundle } from './schemas';

export type JsonValue =
  | null
  | string
  | number
  | boolean
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export function serializeLedgerBundle(bundle: LedgerBundle): string {
  return `${JSON.stringify(toStableJson(bundle), null, 2)}\n`;
}

export function renderLedgerBundleSummary(bundle: LedgerBundle): string {
  const requiredCommand = bundle.commands.find(
    command => command.subject.command === 'archon context ledgers [prompt] [--no-write-artifact]'
  );
  const lines = [
    '# ACO Ledger Bundle',
    '',
    `schemaVersion: ${bundle.schemaVersion}`,
    `totalRows: ${bundle.counts.total}`,
    `artifactRows: ${bundle.counts.artifact}`,
    `capabilityRows: ${bundle.counts.capability}`,
    `commandRows: ${bundle.counts.command}`,
    `riskRows: ${bundle.counts.risk}`,
    `toolRows: ${bundle.counts.tool}`,
    `unknownRows: ${bundle.counts.unknowns}`,
    `workflowRows: ${bundle.counts.workflow}`,
  ];

  if (requiredCommand !== undefined) {
    lines.push(
      '',
      `requiredCommand: ${requiredCommand.subject.command}`,
      `requiredCommandOwner: ${requiredCommand.owner}`,
      `requiredCommandMutates: ${requiredCommand.mutates}`,
      `requiredCommandApprovalRequired: ${String(requiredCommand.approvalRequired)}`
    );
  }

  return `${lines.join('\n')}\n`;
}

export function toStableJson(value: unknown): JsonValue {
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(item => toStableJson(item));
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, JsonValue> = {};
    for (const key of Object.keys(record).sort()) {
      const item = record[key];
      if (item !== undefined) {
        sorted[key] = toStableJson(item);
      }
    }
    return sorted;
  }
  throw new TypeError(`Unsupported JSON value type: ${typeof value}`);
}
