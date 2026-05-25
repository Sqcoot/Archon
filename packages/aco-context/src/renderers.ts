import type {
  ApprovalCapsule,
  ApprovalCapsuleVerification,
  CompiledContextPackage,
  ContextStatus,
} from './schemas';

export type JsonValue =
  | null
  | string
  | number
  | boolean
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export function renderContextStatusJson(status: ContextStatus): string {
  return serializeStableJson(status);
}

export function renderCompiledContextPackageJson(context: CompiledContextPackage): string {
  return serializeStableJson(context);
}

export function renderApprovalCapsuleJson(capsule: ApprovalCapsule): string {
  return serializeStableJson(capsule);
}

export function renderApprovalCapsuleVerificationJson(
  verification: ApprovalCapsuleVerification
): string {
  return serializeStableJson(verification);
}

export function renderContextStatusMarkdown(status: ContextStatus): string {
  const lines = [
    '# ACO Context Status',
    '',
    `schemaVersion: ${status.schemaVersion}`,
    `id: ${status.id}`,
    `readiness: ${status.readiness}`,
    `promptDigest: ${status.promptDigest}`,
    `nextSlice: ${status.nextSlice}`,
    '',
    '## Required Ledgers',
    '',
    ...status.requiredLedgers.map(
      ledger => `- ${ledger.name}: ${ledger.status} (${ledger.rowCount} rows)`
    ),
    '',
    '## Graph Waiver',
    '',
    `status: ${status.graphWaiver.status}`,
    `command: ${status.graphWaiver.command ?? 'none'}`,
    '',
    '## Deferred Surfaces',
    '',
    ...renderList(status.deferredSurfaces, 'No deferred surfaces.'),
    '',
    '## Findings',
    '',
    ...status.findings.map(finding => `- ${finding}`),
  ];

  return `${lines.join('\n')}\n`;
}

export function renderCompiledContextPackageMarkdown(context: CompiledContextPackage): string {
  const lines = [
    '# ACO Context Package',
    '',
    `schemaVersion: ${context.schemaVersion}`,
    `id: ${context.id}`,
    `promptDigest: ${context.promptDigest}`,
    `contextDigest: ${context.contextDigest}`,
    `selectedRoute: ${context.selectedRoute.display}`,
    '',
    '## Ledger Summaries',
    '',
    ...context.ledgerSummaries.map(
      ledger => `- ${ledger.name}: ${ledger.status} (${ledger.rowCount} rows)`
    ),
    '',
    '## Graph State',
    '',
    `status: ${context.graphWaiver.status}`,
    `command: ${context.graphWaiver.command ?? 'none'}`,
    '',
    '## Role Constraints',
    '',
    ...context.roleConstraints.map(constraint => `- ${constraint}`),
    '',
    '## Capability Constraints',
    '',
    ...context.capabilityConstraints.map(constraint => `- ${constraint}`),
    '',
    '## Approval Requirements',
    '',
    ...context.approvalRequirements.map(
      requirement =>
        `- ${requirement.display}: required=${String(requirement.required)} scope=${requirement.mutationScope.join(', ')}`
    ),
    '',
    '## Deferred Items',
    '',
    ...context.deferredItems.map(item => `- ${item}`),
  ];

  return `${lines.join('\n')}\n`;
}

export function renderApprovalCapsuleMarkdown(capsule: ApprovalCapsule): string {
  const lines = [
    '# ACO Approval Capsule',
    '',
    `schemaVersion: ${capsule.schemaVersion}`,
    `id: ${capsule.id}`,
    `requestedCommand: ${capsule.requestedCommand.display}`,
    `mutationClass: ${capsule.mutationClass}`,
    `approvalScope: ${capsule.approvalScope.join(', ')}`,
    `approvalStatus: ${capsule.approvalStatus}`,
    `promptDigest: ${capsule.promptDigest}`,
    `contextDigest: ${capsule.contextDigest}`,
    `checksum: ${capsule.checksum}`,
    '',
    '## Boundary',
    '',
    '- This capsule records requested scope only; it does not grant approval.',
    '- Verification is read-only and must not run gated commands.',
    '',
    '## Invalidates When',
    '',
    ...capsule.invalidatesWhen.map(item => `- ${item}`),
  ];

  return `${lines.join('\n')}\n`;
}

export function renderApprovalCapsuleVerificationMarkdown(
  verification: ApprovalCapsuleVerification
): string {
  const lines = [
    '# ACO Approval Capsule Verification',
    '',
    `schemaVersion: ${verification.schemaVersion}`,
    `id: ${verification.id}`,
    `status: ${verification.status}`,
    `capsuleId: ${verification.capsuleId}`,
    `commandId: ${verification.commandId}`,
    `canGrantApproval: ${String(verification.canGrantApproval)}`,
    '',
    '## Issues',
    '',
    ...renderList(verification.issues, 'No verification issues.'),
  ];

  return `${lines.join('\n')}\n`;
}

export function serializeStableJson(value: unknown): string {
  return `${renderJsonValue(toStableJson(value), 0)}\n`;
}

export function toStableJson(value: unknown): JsonValue {
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) return value.map(item => toStableJson(item));
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, JsonValue> = {};
    for (const key of Object.keys(record).sort()) {
      const item = record[key];
      if (item !== undefined) sorted[key] = toStableJson(item);
    }
    return sorted;
  }
  throw new TypeError(`Unsupported JSON value type: ${typeof value}`);
}

const JSON_PRINT_WIDTH = 100;

function renderList(values: readonly string[], emptyText: string): readonly string[] {
  if (values.length === 0) return [`- ${emptyText}`];
  return values.map(value => `- ${value}`);
}

function renderJsonValue(value: JsonValue, indent: number): string {
  if (value === null || typeof value === 'string' || typeof value === 'number') {
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return renderJsonArray(value, indent);
  if (!isJsonRecord(value)) throw new TypeError('Unsupported JSON object value');
  return renderJsonObject(value, indent);
}

function renderJsonArray(values: readonly JsonValue[], indent: number): string {
  if (values.length === 0) return '[]';
  if (values.every(isJsonScalar)) {
    const inline = renderInlineJsonArray(values);
    if (inline.length + indent <= JSON_PRINT_WIDTH) return inline;
  }

  const childIndent = indent + 2;
  const childPrefix = ' '.repeat(childIndent);
  const lines = values.map((value, index) => {
    const rendered = renderJsonValue(value, 0);
    const suffix = index === values.length - 1 ? '' : ',';
    return `${childPrefix}${rendered.replaceAll('\n', `\n${childPrefix}`)}${suffix}`;
  });
  return `[\n${lines.join('\n')}\n${' '.repeat(indent)}]`;
}

function renderJsonObject(value: Readonly<Record<string, JsonValue>>, indent: number): string {
  const entries = Object.entries(value);
  if (entries.length === 0) return '{}';

  const childIndent = indent + 2;
  const childPrefix = ' '.repeat(childIndent);
  const lines = entries.map(([key, item], index) => {
    const keyPrefix = `${childPrefix}${JSON.stringify(key)}: `;
    const rendered =
      Array.isArray(item) &&
      item.every(isJsonScalar) &&
      keyPrefix.length + renderInlineJsonArray(item).length <= JSON_PRINT_WIDTH
        ? renderInlineJsonArray(item)
        : renderJsonValue(item, 0);
    const suffix = index === entries.length - 1 ? '' : ',';
    return `${keyPrefix}${rendered.replaceAll('\n', `\n${childPrefix}`)}${suffix}`;
  });
  return `{\n${lines.join('\n')}\n${' '.repeat(indent)}}`;
}

function isJsonScalar(value: JsonValue): boolean {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function isJsonRecord(value: JsonValue): value is Readonly<Record<string, JsonValue>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function renderInlineJsonArray(values: readonly JsonValue[]): string {
  return `[${values.map(value => renderJsonValue(value, 0)).join(', ')}]`;
}
