import type {
  CodexBootstrapContext,
  CodexCapabilitySnapshot,
  CodexContinuationHandoff,
  CodexHarnessCapabilityReport,
} from './schemas';

export type JsonValue =
  | null
  | string
  | number
  | boolean
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export function renderCodexBootstrapCapsule(context: CodexBootstrapContext): string {
  const lines = [
    '# Codex Bootstrap Capsule',
    '',
    'schemaVersion: aco.codex-bootstrap-capsule.v1',
    `id: ${context.id}`,
    `mode: ${context.mode}`,
    `command: ${context.command.command}`,
    `repository: ${context.repository.repoPath}`,
    `branch: ${context.repository.branch}`,
    `event: ${context.event.type}`,
    '',
    '## Goal',
    '',
    context.goal,
    '',
    '## Runtime Boundaries',
    '',
    '- Contract package only; live Codex runtime control is deferred.',
    '- No subagent enforcement, tool restriction enforcement, MCP OAuth, hooks, credentials, or config mutation is claimed.',
    '- Artifact writes are future CLI behavior guarded by explicit `--write-artifact` use.',
    '',
    '## Required Artifacts',
    '',
    ...context.requiredArtifacts.map(name => `- ${name}`),
    '',
    '## Capability Summary',
    '',
    `- supported: ${context.capabilityReport.summary.supported}`,
    `- partial: ${context.capabilityReport.summary.partial}`,
    `- unsupported: ${context.capabilityReport.summary.unsupported}`,
    `- unknown: ${context.capabilityReport.summary.unknown}`,
    `- deferred_by_design: ${context.capabilityReport.summary.deferred_by_design}`,
    '',
    '## Next Action',
    '',
    'Use this capsule as read-only bootstrap context. Runtime adapters and artifact persistence belong to later slices.',
  ];

  return `${lines.join('\n')}\n`;
}

export function renderCodexBootstrapContextJson(context: CodexBootstrapContext): string {
  return serializeStableJson(context);
}

export function renderCapabilitySnapshotJson(snapshot: CodexCapabilitySnapshot): string {
  return serializeStableJson(snapshot);
}

export function renderCodexHarnessCapabilityReportJson(
  report: CodexHarnessCapabilityReport
): string {
  return serializeStableJson(report);
}

export function renderCodexContinuationHandoff(handoff: CodexContinuationHandoff): string {
  const lines = [
    '# Codex Continuation Handoff',
    '',
    `schemaVersion: ${handoff.schemaVersion}`,
    `id: ${handoff.id}`,
    '',
    '## Resume Goal',
    '',
    handoff.resumeGoal,
    '',
    '## Completed Artifacts',
    '',
    ...handoff.completedArtifacts.map(name => `- ${name}`),
    '',
    '## Next Actions',
    '',
    ...handoff.nextActions.map(action => `- ${action}`),
    '',
    '## Blocked Runtime Claims',
    '',
    ...handoff.blockedRuntimeClaims.map(claim => `- ${claim}`),
  ];

  return `${lines.join('\n')}\n`;
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
