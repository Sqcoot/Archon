import type {
  BmadAdversarialReview,
  BmadEvaluatorVerdict,
  BmadRoleContract,
  BmadRoleRegistry,
  BmadUncertaintyRouterPacket,
} from './schemas';

export type JsonValue =
  | null
  | string
  | number
  | boolean
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export function renderRoleContractYaml(contract: BmadRoleContract): string {
  return serializeStableYaml(contract);
}

export function renderRoleRegistryJson(registry: BmadRoleRegistry): string {
  return serializeStableJson(registry);
}

export function renderRoleRegistryYaml(registry: BmadRoleRegistry): string {
  return serializeStableYaml(registry);
}

export function renderRouterPacketYaml(packet: BmadUncertaintyRouterPacket): string {
  return serializeStableYaml(packet);
}

export function renderEvaluatorVerdictJson(verdict: BmadEvaluatorVerdict): string {
  return serializeStableJson(verdict);
}

export function renderEvaluatorVerdictYaml(verdict: BmadEvaluatorVerdict): string {
  return serializeStableYaml(verdict);
}

export function renderAdversarialLoopMarkdown(review: BmadAdversarialReview): string {
  const completion = review.evaluatorVerdict.goalCompletion;
  const lines = [
    '# ACO BMAD Adversarial Loop Summary',
    '',
    `schemaVersion: ${review.schemaVersion}`,
    `id: ${review.id}`,
    `objective: ${review.objective}`,
    '',
    '## Runtime Boundary',
    '',
    '- BMAD/ACO roles are workflow artifact contracts unless provider runtime evidence proves native enforcement.',
    '- This package validates contracts and router packets only; it does not spawn agents or mutate runtime state.',
    '',
    '## Role Catalog',
    '',
    ...review.roleRegistry.roles.map(
      role => `- ${role.id}: ${role.role} (${role.certification}, ${role.nativeRuntimeSupport})`
    ),
    '',
    '## Router Packet',
    '',
    `question: ${review.routerPacket.question}`,
    `owner: ${review.routerPacket.owner}`,
    `confidence: ${review.routerPacket.confidenceBefore} -> ${review.routerPacket.confidenceAfter}`,
    '',
    '## Evaluator Verdict',
    '',
    `verdict: ${review.evaluatorVerdict.verdict}`,
    `canClaimComplete: ${String(completion.canClaimComplete)}`,
    `reason: ${completion.reason}`,
    '',
    '## Remaining Risks',
    '',
    ...review.evaluatorVerdict.remainingRisks.map(risk => `- ${risk}`),
    '',
    '## Required Followups',
    '',
    ...review.evaluatorVerdict.requiredFollowups.map(followup => `- ${followup}`),
  ];

  return `${lines.join('\n')}\n`;
}

export function serializeStableJson(value: unknown): string {
  return `${renderJsonValue(toStableJson(value), 0)}\n`;
}

export function serializeStableYaml(value: unknown): string {
  return `${toStableYaml(value, 0).join('\n')}\n`;
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

const JSON_PRINT_WIDTH = 100;

function toStableYaml(value: unknown, indent: number): readonly string[] {
  const prefix = ' '.repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${prefix}[]`];
    return value.flatMap(item => renderYamlArrayItem(item, indent));
  }
  if (isRecord(value)) {
    const lines: string[] = [];
    for (const key of Object.keys(value).sort()) {
      const item = value[key];
      if (item === undefined) continue;
      if (isScalar(item)) {
        lines.push(`${prefix}${key}: ${formatYamlScalar(item)}`);
      } else {
        lines.push(`${prefix}${key}:`);
        lines.push(...toStableYaml(item, indent + 2));
      }
    }
    return lines;
  }
  return [`${prefix}${formatYamlScalar(value)}`];
}

function renderYamlArrayItem(item: unknown, indent: number): readonly string[] {
  const prefix = ' '.repeat(indent);
  if (isScalar(item)) return [`${prefix}- ${formatYamlScalar(item)}`];
  const lines = toStableYaml(item, indent + 2);
  if (lines.length === 0) return [`${prefix}- {}`];
  const [firstLine, ...rest] = lines;
  if (firstLine === undefined) return [`${prefix}- {}`];
  return [`${prefix}- ${firstLine.trimStart()}`, ...rest];
}

function isScalar(value: unknown): boolean {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function formatYamlScalar(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  throw new TypeError(`Unsupported YAML scalar type: ${typeof value}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function renderJsonValue(value: JsonValue, indent: number): string {
  if (value === null || typeof value === 'string' || typeof value === 'number') {
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') return String(value);
  if (isJsonArray(value)) return renderJsonArray(value, indent);
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
      isJsonScalarArray(item) &&
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

function isJsonArray(value: JsonValue): value is readonly JsonValue[] {
  return Array.isArray(value);
}

function isJsonScalarArray(value: JsonValue): value is readonly JsonValue[] {
  return Array.isArray(value) && value.every(isJsonScalar);
}

function renderInlineJsonArray(values: readonly JsonValue[]): string {
  return `[${values.map(value => renderJsonValue(value, 0)).join(', ')}]`;
}
