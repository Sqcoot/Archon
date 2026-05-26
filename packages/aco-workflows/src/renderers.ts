import type {
  BundledDefaultInventory,
  WorkflowParityBundle,
  WorkflowParityContract,
  WorkflowYamlMetadata,
} from './schemas';

export type JsonValue =
  | null
  | string
  | number
  | boolean
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface WorkflowDefaultYamlRenderInput {
  readonly name: string;
  readonly workflowDescription: string;
  readonly triggerDescription: string;
  readonly requiredNodes: readonly {
    readonly id: string;
    readonly purpose: string;
    readonly dependsOn: readonly string[];
    readonly contextCommandIds: readonly string[];
  }[];
}

const CLI_COMMANDS: Readonly<Record<string, string>> = {
  'archon.context.status': 'archon context status "$ARGUMENTS" --json --write-artifact',
  'archon.context.ledgers': 'archon context ledgers "$ARGUMENTS" --json --write-artifact',
  'archon.context.route': 'archon context route "$ARGUMENTS" --json --write-artifact',
  'archon.context.compile': 'archon context compile "$ARGUMENTS" --json --write-artifact',
  'archon.context.approval-capsule':
    'archon context approval-capsule "$ARGUMENTS" --json --write-artifact',
  'archon.context.approval-capsule-verify':
    'archon context approval-capsule-verify --json --write-artifact',
  'archon.context.graph-waivers': 'archon context graph-waivers --json --write-artifact',
  'archon.context.validate': 'archon context validate --json',
};

export function renderWorkflowParityBundleJson(bundle: WorkflowParityBundle): string {
  return serializeStableJson(bundle);
}

export function renderWorkflowParityContractJson(contract: WorkflowParityContract): string {
  return serializeStableJson(contract);
}

export function renderBundledDefaultInventoryJson(inventory: BundledDefaultInventory): string {
  return serializeStableJson(inventory);
}

export function renderWorkflowYamlMetadataJson(metadata: readonly WorkflowYamlMetadata[]): string {
  return serializeStableJson(metadata);
}

export function renderWorkflowParitySummaryMarkdown(bundle: WorkflowParityBundle): string {
  const lines = [
    '# ACO Workflow Parity',
    '',
    `schemaVersion: ${bundle.schemaVersion}`,
    `id: ${bundle.id}`,
    `status: ${bundle.status}`,
    `nextSlice: ${bundle.nextSlice}`,
    '',
    '## Workflows',
    '',
    ...bundle.contracts.map(
      contract =>
        `- ${contract.name}: ${contract.status}; nodes=${contract.requiredNodes.length}; default=${contract.bundledDefault.fileName}`
    ),
    '',
    '## Deferred Commands',
    '',
    ...renderRequirementList(bundle.deferredCommands),
    '',
    '## Approval Required Commands',
    '',
    ...renderRequirementList(bundle.approvalRequiredCommands),
  ];

  return `${lines.join('\n')}\n`;
}

export function renderDeferredApprovalReportJson(bundle: WorkflowParityBundle): string {
  return serializeStableJson({
    deferredCommands: bundle.deferredCommands,
    approvalRequiredCommands: bundle.approvalRequiredCommands,
  });
}

export function renderWorkflowDefaultYaml(contract: WorkflowDefaultYamlRenderInput): string {
  const lines = [
    `name: ${contract.name}`,
    'description: |',
    `  Use when: ${contract.triggerDescription}`,
    `  Does: ${contract.workflowDescription}`,
    '  Contract source: @archon/aco-workflows S9 workflow parity.',
    'provider: codex',
    'model: gpt-5.3-codex',
    'mode: autonomous',
    'lock_scope: artifact_only',
    'mutates_checkout: false',
    '',
    'nodes:',
  ];

  for (const node of contract.requiredNodes) {
    lines.push(`  - id: ${node.id}`);
    if (node.dependsOn.length > 0) {
      lines.push(`    depends_on: [${node.dependsOn.join(', ')}]`);
    }
    const command = commandForNode(node.contextCommandIds);
    lines.push('    bash: |');
    lines.push(`      ${command}`);
    lines.push('    timeout: 30000');
  }

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

function commandForNode(commandIds: readonly string[]): string {
  const commandId = commandIds[0];
  if (commandId === undefined) return 'archon context status "$ARGUMENTS" --json --write-artifact';
  return CLI_COMMANDS[commandId] ?? 'archon context status "$ARGUMENTS" --json --write-artifact';
}

function renderRequirementList(
  requirements: readonly { readonly display: string; readonly status: string }[]
): readonly string[] {
  if (requirements.length === 0) return ['- none'];
  return requirements.map(requirement => `- ${requirement.display}: ${requirement.status}`);
}

const JSON_PRINT_WIDTH = 100;

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
    const rendered = renderJsonValue(item, childIndent);
    const suffix = index === entries.length - 1 ? '' : ',';
    return `${childPrefix}${JSON.stringify(key)}: ${rendered}${suffix}`;
  });
  return `{\n${lines.join('\n')}\n${' '.repeat(indent)}}`;
}

function renderInlineJsonArray(values: readonly JsonValue[]): string {
  return `[${values.map(value => renderJsonValue(value, 0)).join(', ')}]`;
}

function isJsonScalar(value: JsonValue): value is string | number | boolean | null {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function isJsonRecord(value: JsonValue): value is Readonly<Record<string, JsonValue>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
