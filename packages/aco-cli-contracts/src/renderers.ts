import type {
  AcoCommandCatalog,
  AcoCommandDescriptor,
  AcoCommandResultEnvelope,
  JsonValue,
} from './schemas';

export function renderCommandCatalogJson(catalog: AcoCommandCatalog): string {
  const rendered = {
    kind: catalog.kind,
    schemaVersion: catalog.schemaVersion,
    commands: catalog.descriptors.map(descriptor => ({
      id: descriptor.id,
      display: descriptor.display,
      surface: descriptor.surface,
      implementationStatus: descriptor.implementationStatus,
      mutates: descriptor.mutates,
      safetyClasses: descriptor.safetyClasses,
      approvalRequired: descriptor.approvalRequired,
      owner: descriptor.owner,
    })),
  } as const;

  return serializeStableJson(rendered);
}

export function renderSafetyMatrixJson(catalog: AcoCommandCatalog): string {
  const matrix = {
    kind: 'aco-cli-safety-matrix',
    schemaVersion: 'aco.cli-safety-matrix.v1',
    commands: catalog.descriptors.map(descriptor => ({
      id: descriptor.id,
      display: descriptor.display,
      implementationStatus: descriptor.implementationStatus,
      mutates: descriptor.mutates,
      safetyClasses: descriptor.safetyClasses,
      approvalRequired: descriptor.approvalRequired,
    })),
  } as const;

  return serializeStableJson(matrix);
}

export function renderCommandHelpMarkdown(catalog: AcoCommandCatalog): string {
  const lines = [
    '# ACO CLI Command Catalog',
    '',
    `schemaVersion: ${catalog.schemaVersion}`,
    `commands: ${catalog.descriptors.length}`,
    '',
    '<!-- prettier-ignore -->',
    '| Command | Surface | Status | Safety | Owner |',
    '| --- | --- | --- | --- | --- |',
    ...catalog.descriptors.map(
      descriptor =>
        `| \`${escapeTableText(descriptor.display)}\` | ${descriptor.surface} | ${descriptor.implementationStatus} | ${descriptor.safetyClasses.join(', ')} | ${descriptor.owner} |`
    ),
  ];

  return `${lines.join('\n')}\n`;
}

export function renderCommandPlanMarkdown(descriptor: AcoCommandDescriptor): string {
  const lines = [
    '# ACO Command Plan',
    '',
    `command: ${descriptor.display}`,
    `id: ${descriptor.id}`,
    `surface: ${descriptor.surface}`,
    `owner: ${descriptor.owner}`,
    `status: ${descriptor.implementationStatus}`,
    `mutates: ${descriptor.mutates}`,
    `safety: ${descriptor.safetyClasses.join(', ')}`,
    `approvalRequired: ${String(descriptor.approvalRequired)}`,
    `outputModes: ${descriptor.outputModes.join(', ')}`,
    '',
    '## Arguments',
    '',
    ...renderArgumentLines(descriptor),
    '',
    '## Options',
    '',
    ...renderOptionLines(descriptor),
    '',
    '## S7 Boundary',
    '',
    boundaryLine(descriptor),
  ];

  return `${lines.join('\n')}\n`;
}

export function renderCliResultJson(result: AcoCommandResultEnvelope): string {
  return serializeStableJson(result);
}

export function serializeStableJson(value: unknown): string {
  return `${JSON.stringify(toStableJson(value), null, 2)}\n`;
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

function renderArgumentLines(descriptor: AcoCommandDescriptor): readonly string[] {
  if (descriptor.arguments.length === 0) return ['- none'];
  return descriptor.arguments.map(argument => {
    const requirement = argument.required ? 'required' : 'optional';
    const variadic = argument.variadic ? ', variadic' : '';
    return `- ${argument.name}: ${requirement}${variadic}; ${argument.description}`;
  });
}

function renderOptionLines(descriptor: AcoCommandDescriptor): readonly string[] {
  if (descriptor.options.length === 0) return ['- none'];
  return descriptor.options.map(option => {
    const value = option.valueName === null ? 'flag' : option.valueName;
    const allowed =
      option.allowedValues.length > 0 ? `; allowed=${option.allowedValues.join('|')}` : '';
    const safety =
      option.safetyClassWhenEnabled === null ? '' : `; enables=${option.safetyClassWhenEnabled}`;
    return `- --${option.name}: ${value}${allowed}${safety}; ${option.description}`;
  });
}

function boundaryLine(descriptor: AcoCommandDescriptor): string {
  if (descriptor.implementationStatus === 'supported') {
    return '- Supported only through committed pure S1-S6 contracts and thin CLI adaptation.';
  }
  if (descriptor.implementationStatus === 'approval-required') {
    return '- Blocked in S7 unless explicit approval is present; no implicit execution.';
  }
  return '- Deferred in S7; command is discoverable but returns a stable nonzero diagnostic.';
}

function escapeTableText(value: string): string {
  return value.replaceAll('|', '\\|');
}
