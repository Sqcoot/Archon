import type {
  AgenticSearchReport,
  GraphWaiverClosure,
  ResearchArtifactBundle,
  UpstreamGraphManifest,
} from './schemas';

export type JsonValue =
  | null
  | string
  | number
  | boolean
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export function renderUpstreamGraphManifestJson(manifest: UpstreamGraphManifest): string {
  return serializeStableJson(manifest);
}

export function renderGraphWaiverClosureJson(closure: GraphWaiverClosure): string {
  return serializeStableJson(closure);
}

export function renderAgenticSearchReportJson(report: AgenticSearchReport): string {
  return serializeStableJson(report);
}

export function renderResearchArtifactBundleJson(bundle: ResearchArtifactBundle): string {
  return serializeStableJson(bundle);
}

export function renderAgenticSearchMarkdown(report: AgenticSearchReport): string {
  const lines = [
    '# Agentic Search Report',
    '',
    `schemaVersion: ${report.schemaVersion}`,
    `id: ${report.id}`,
    '',
    '## Objective and Intent Hash',
    '',
    `objective: ${report.objective}`,
    `intentHash: ${report.intentHash}`,
    '',
    '## Candidate Implementation Surfaces',
    '',
    ...report.candidateImplementationSurfaces.map(
      surface => `- ${surface.path} (${surface.owner}): ${surface.reason}`
    ),
    '',
    '## Candidate Tests and Acceptance Markers',
    '',
    ...report.candidateTestsAndAcceptanceMarkers.map(
      marker => `- ${marker.commandOrPath}: ${marker.marker}`
    ),
    '',
    '## Dependency and Context Graph References',
    '',
    ...report.dependencyContextGraphRefs.map(
      ref =>
        `- ${ref.repository}: ${ref.status}, nodes=${ref.nodes}, edges=${ref.edges}, waiverRequired=${String(ref.waiverRequired)}`
    ),
    '',
    '## Evidence Gaps',
    '',
    ...renderMarkdownList(report.evidenceGaps, 'No evidence gaps in current fixture.'),
    '',
    '## Disallowed Assumptions',
    '',
    ...report.disallowedAssumptions.map(assumption => `- ${assumption}`),
    '',
    '## Recommended Next Slice',
    '',
    `id: ${report.recommendedNextSlice.id}`,
    `package: ${report.recommendedNextSlice.packageName}`,
    `reason: ${report.recommendedNextSlice.reason}`,
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

function renderMarkdownList(values: readonly string[], emptyText: string): readonly string[] {
  if (values.length === 0) return [`- ${emptyText}`];
  return values.map(value => `- ${value}`);
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
