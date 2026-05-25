import type { EvidenceRef, ParseResult } from '@archon/aco-core';
import {
  bootstrapCodexCommandDescriptorSchema,
  codexBootstrapArtifactBundleSchema,
  codexBootstrapArtifactNameValues,
  codexBootstrapContextSchema,
  codexBootstrapInputSchema,
  codexCapabilitySnapshotSchema,
  codexCapabilityStatusValues,
  codexContinuationHandoffSchema,
  codexHarnessCapabilityReportSchema,
} from './schemas';
import type {
  BootstrapCodexCommandDescriptor,
  CodexBootstrapArtifact,
  CodexBootstrapArtifactBundle,
  CodexBootstrapArtifactName,
  CodexBootstrapContext,
  CodexBootstrapInput,
  CodexCapabilitySnapshot,
  CodexCapabilityStatus,
  CodexContinuationHandoff,
  CodexHarnessCapability,
  CodexHarnessCapabilityReport,
} from './schemas';
import {
  renderCapabilitySnapshotJson,
  renderCodexBootstrapCapsule,
  renderCodexBootstrapContextJson,
  renderCodexContinuationHandoff,
  renderCodexHarnessCapabilityReportJson,
} from './renderers';

export const BOOTSTRAP_CODEX_COMMAND =
  'archon aco bootstrap-codex --event <event> --format markdown|json [--write-artifact]';

export const REQUIRED_CODEX_BOOTSTRAP_ARTIFACTS = [
  ...codexBootstrapArtifactNameValues,
] as const satisfies readonly CodexBootstrapArtifactName[];

export const CODEX_RUNTIME_NON_CLAIMS = [
  'native subagent enforcement',
  'native tool restriction enforcement',
  'silent MCP OAuth setup',
  'silent hook activation',
  'silent provider credential writes',
  'silent user config mutation',
] as const;

const REQUIRED_CAPABILITY_IDS = [
  'json-bootstrap-attachment',
  'runtime-event-observation',
  'tool-restriction-enforcement',
  'native-subagent-launch',
  'mcp-attachment-scope',
  'provider-config-inspection',
  'credential-path-writes',
  'artifact-ref-attachment',
  'continuation-handoff-resume',
  'machine-readable-failures',
] as const;

const COMMAND_EVIDENCE = {
  id: 'evidence.codex.bootstrap-command',
  source: 'reference-surface-plan.json#commands.archon-aco-bootstrap-codex',
  summary: 'Reference surface preserves archon aco bootstrap-codex command metadata',
  confidence: 'high',
  freshness: 'unknown',
} as const satisfies EvidenceRef;

const HARNESS_SPEC_EVIDENCE = {
  id: 'evidence.codex.harness-spec',
  source: 'codex/real-codex-harness-spec.md',
  summary: 'Readonly artifact defines CodexHarness contract and required bootstrap artifacts',
  confidence: 'high',
  freshness: 'unknown',
} as const satisfies EvidenceRef;

const CAPABILITY_CHECK_EVIDENCE = {
  id: 'evidence.codex.capability-checks',
  source: 'codex/codex-harness-capability-checks.md',
  summary:
    'Readonly artifact requires explicit supported/partial/unsupported/unknown/deferred_by_design statuses',
  confidence: 'high',
  freshness: 'unknown',
} as const satisfies EvidenceRef;

export const bootstrapCodexCommand: BootstrapCodexCommandDescriptor =
  bootstrapCodexCommandDescriptorSchema.parse({
    kind: 'codex-bootstrap-command',
    command: BOOTSTRAP_CODEX_COMMAND,
    owner: 'aco-codex',
    compatibility: 'preserve',
    defaultMutates: 'read-only',
    writeArtifactMutates: 'writes-artifacts',
    approvalRequired: false,
    evidence: [COMMAND_EVIDENCE],
    manifest: {
      kind: 'command-manifest',
      id: 'command.archon-aco-bootstrap-codex',
      command: BOOTSTRAP_CODEX_COMMAND,
      surface: 'CLI/slash',
      purpose: 'Emit Codex-ready bootstrap capsule',
      mutates: 'read-only',
      approvalRequired: false,
      owner: 'aco-codex',
      compatibility: 'preserve',
      evidence: [COMMAND_EVIDENCE],
    },
  });

export function parseCodexBootstrapInput(input: unknown): ParseResult<CodexBootstrapInput> {
  const parsed = codexBootstrapInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  }
  return { ok: true, value: parsed.data };
}

export function parseCodexBootstrapArtifactBundle(
  input: unknown
): ParseResult<CodexBootstrapArtifactBundle> {
  const parsed = codexBootstrapArtifactBundleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  }

  const issues = validateArtifactBundle(parsed.data);
  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return { ok: true, value: parsed.data };
}

export function buildCodexHarnessCapabilityReport(
  capabilities: readonly CodexHarnessCapability[] = defaultCodexHarnessCapabilities()
): ParseResult<CodexHarnessCapabilityReport> {
  const issues = validateCapabilities(capabilities);
  if (issues.length > 0) return { ok: false, issues };

  const report = {
    kind: 'codex-harness-capability-report',
    schemaVersion: 'aco.codex-harness-capability-report.v1',
    provider: 'codex',
    contractOnly: true,
    checks: [...capabilities].sort((left, right) => left.id.localeCompare(right.id)),
    summary: summarizeCapabilities(capabilities),
    evidence: [HARNESS_SPEC_EVIDENCE, CAPABILITY_CHECK_EVIDENCE],
  } as const;

  const parsed = codexHarnessCapabilityReportSchema.safeParse(report);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  }
  return { ok: true, value: parsed.data };
}

export function buildCodexCapabilitySnapshot(
  report: CodexHarnessCapabilityReport
): ParseResult<CodexCapabilitySnapshot> {
  const snapshot = {
    kind: 'codex-capability-snapshot',
    schemaVersion: 'aco.codex-capability-snapshot.v1',
    provider: 'codex',
    command: bootstrapCodexCommand,
    capabilities: report.checks,
    nonClaims: [...CODEX_RUNTIME_NON_CLAIMS],
    evidence: [HARNESS_SPEC_EVIDENCE, CAPABILITY_CHECK_EVIDENCE],
  } as const;

  const parsed = codexCapabilitySnapshotSchema.safeParse(snapshot);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  }
  return { ok: true, value: parsed.data };
}

export function buildCodexContinuationHandoff(
  input: CodexBootstrapInput
): ParseResult<CodexContinuationHandoff> {
  const handoff = {
    kind: 'codex-continuation-handoff',
    schemaVersion: 'aco.codex-continuation-handoff.v1',
    id: `${input.id}.handoff`,
    resumeGoal: input.goal,
    completedArtifacts: [...REQUIRED_CODEX_BOOTSTRAP_ARTIFACTS],
    nextActions: [
      'Wire future CLI output to @archon/aco-codex builders.',
      'Keep live runtime support behind provider and approval gates.',
      'Re-run golden render tests before changing artifact contracts.',
    ],
    blockedRuntimeClaims: [...CODEX_RUNTIME_NON_CLAIMS],
    evidence: [HARNESS_SPEC_EVIDENCE],
  } as const;

  const parsed = codexContinuationHandoffSchema.safeParse(handoff);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  }
  return { ok: true, value: parsed.data };
}

export function buildCodexBootstrapContext(
  input: CodexBootstrapInput
): ParseResult<CodexBootstrapContext> {
  const report = buildCodexHarnessCapabilityReport();
  if (!report.ok) return report;
  const handoff = buildCodexContinuationHandoff(input);
  if (!handoff.ok) return handoff;

  const context = {
    kind: 'codex-bootstrap-context',
    schemaVersion: 'aco.codex-bootstrap-context.v1',
    id: input.id,
    goal: input.goal,
    mode: input.mode,
    repository: input.repository,
    event: input.event,
    command: bootstrapCodexCommand,
    requiredArtifacts: [...REQUIRED_CODEX_BOOTSTRAP_ARTIFACTS],
    capabilityReport: report.value,
    continuationHandoff: handoff.value,
    evidence: [...input.evidence, HARNESS_SPEC_EVIDENCE],
  } as const;

  const parsed = codexBootstrapContextSchema.safeParse(context);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  }
  return { ok: true, value: parsed.data };
}

export function buildCodexBootstrapArtifacts(
  input: CodexBootstrapInput
): ParseResult<CodexBootstrapArtifactBundle> {
  const context = buildCodexBootstrapContext(input);
  if (!context.ok) return context;
  const snapshot = buildCodexCapabilitySnapshot(context.value.capabilityReport);
  if (!snapshot.ok) return snapshot;

  const artifacts: readonly CodexBootstrapArtifact[] = [
    {
      name: 'codex-bootstrap-capsule.md',
      mediaType: 'text/markdown',
      schemaVersion: 'aco.codex-bootstrap-capsule.v1',
      content: renderCodexBootstrapCapsule(context.value),
    },
    {
      name: 'codex-bootstrap-context.json',
      mediaType: 'application/json',
      schemaVersion: context.value.schemaVersion,
      content: renderCodexBootstrapContextJson(context.value),
    },
    {
      name: 'capability-snapshot.json',
      mediaType: 'application/json',
      schemaVersion: snapshot.value.schemaVersion,
      content: renderCapabilitySnapshotJson(snapshot.value),
    },
    {
      name: 'codex-harness-capability-report.json',
      mediaType: 'application/json',
      schemaVersion: context.value.capabilityReport.schemaVersion,
      content: renderCodexHarnessCapabilityReportJson(context.value.capabilityReport),
    },
    {
      name: 'codex-continuation-handoff.md',
      mediaType: 'text/markdown',
      schemaVersion: context.value.continuationHandoff.schemaVersion,
      content: renderCodexContinuationHandoff(context.value.continuationHandoff),
    },
  ];

  const bundle = {
    kind: 'codex-bootstrap-artifact-bundle',
    schemaVersion: 'aco.codex-bootstrap-artifacts.v1',
    command: bootstrapCodexCommand,
    artifacts,
    evidence: [HARNESS_SPEC_EVIDENCE, COMMAND_EVIDENCE],
  } as const;

  return parseCodexBootstrapArtifactBundle(bundle);
}

export function defaultCodexBootstrapInput(): CodexBootstrapInput {
  return codexBootstrapInputSchema.parse({
    kind: 'codex-bootstrap-input',
    schemaVersion: 'aco.codex-bootstrap-input.v1',
    id: 'aco.codex-bootstrap.fixture',
    goal: 'Implement S4 as @archon/aco-codex: a pure Codex bootstrap and harness contract package.',
    repository: {
      repoPath: '/Users/edam/Documents/TODA/Archon',
      branch: 'codex/aco-first-principles-rewrite',
      baseBranch: 'dev',
      referenceBranch: 'codex/aco-stabilization-slices',
      readonlyReference: true,
    },
    event: {
      type: 'SessionStart',
      label: 'S4 bootstrap render',
      payloadContract: 'known lifecycle label with provider-specific payload deferred',
      evidence: [HARNESS_SPEC_EVIDENCE],
    },
    mode: 'read-only',
    evidence: [HARNESS_SPEC_EVIDENCE, COMMAND_EVIDENCE],
  });
}

function defaultCodexHarnessCapabilities(): readonly CodexHarnessCapability[] {
  return [
    capability(
      'json-bootstrap-attachment',
      'Can the harness receive a JSON bootstrap attachment, or only markdown paste text?',
      'partial',
      false,
      false,
      'S4 renders JSON artifacts, but runtime attachment behavior is not implemented.'
    ),
    capability(
      'runtime-event-observation',
      'Can a run distinguish Codex lifecycle events?',
      'unknown',
      false,
      false,
      'S4 models event labels; runtime event observation belongs to a later harness adapter.'
    ),
    capability(
      'tool-restriction-enforcement',
      'Can tool allow/deny restrictions be enforced by runtime?',
      'unsupported',
      false,
      false,
      'S4 makes no runtime tool enforcement claim.'
    ),
    capability(
      'native-subagent-launch',
      'Can subagents be launched as separate runtime entities?',
      'unsupported',
      false,
      false,
      'S4 makes no native Codex subagent launch claim.'
    ),
    capability(
      'mcp-attachment-scope',
      'Can MCP servers be attached per node, globally, or not at all?',
      'unknown',
      false,
      true,
      'MCP attachment scope and OAuth setup are deferred to future approved runtime work.'
    ),
    capability(
      'provider-config-inspection',
      'Can provider config be inspected without mutation?',
      'unknown',
      false,
      false,
      'Provider config inspection is not part of this pure package.'
    ),
    capability(
      'credential-path-writes',
      'What credential paths are read, and which writes require approval?',
      'deferred_by_design',
      false,
      true,
      'Credential IO is deliberately out of scope for S4.'
    ),
    capability(
      'artifact-ref-attachment',
      'Can artifact refs be attached as files, or must they be pasted/summarized?',
      'partial',
      false,
      false,
      'S4 renders artifact refs and handoff text, but does not attach files at runtime.'
    ),
    capability(
      'continuation-handoff-resume',
      'How are continuation/handoff states resumed after compaction?',
      'partial',
      false,
      false,
      'S4 renders a continuation handoff artifact; runtime resume semantics are deferred.'
    ),
    capability(
      'machine-readable-failures',
      'What failure events are observable and machine-readable?',
      'unknown',
      false,
      false,
      'S4 schemas can represent results, but runtime failure observation is unproven.'
    ),
  ];
}

function capability(
  id: string,
  question: string,
  status: CodexCapabilityStatus,
  runtimeClaimed: boolean,
  approvalRequired: boolean,
  summary: string
): CodexHarnessCapability {
  return {
    id,
    question,
    status,
    runtimeClaimed,
    approvalRequired,
    summary,
    evidence: [CAPABILITY_CHECK_EVIDENCE],
  };
}

function validateCapabilities(capabilities: readonly CodexHarnessCapability[]): readonly string[] {
  const issues: string[] = [];
  const ids = capabilities.map(item => item.id);
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    issues.push('duplicate Codex capability ids are not allowed');
  }
  for (const required of REQUIRED_CAPABILITY_IDS) {
    if (!uniqueIds.has(required)) {
      issues.push(`missing required Codex capability check ${required}`);
    }
  }
  for (const capabilityItem of capabilities) {
    if (!codexCapabilityStatusValues.includes(capabilityItem.status)) {
      issues.push(`invalid Codex capability status ${capabilityItem.status}`);
    }
    if (
      capabilityItem.runtimeClaimed &&
      (capabilityItem.status === 'unsupported' ||
        capabilityItem.status === 'unknown' ||
        capabilityItem.status === 'deferred_by_design')
    ) {
      issues.push(
        `${capabilityItem.id} cannot claim runtime support with status ${capabilityItem.status}`
      );
    }
  }
  return issues;
}

function validateArtifactBundle(bundle: CodexBootstrapArtifactBundle): readonly string[] {
  const issues: string[] = [];
  const artifactNames = bundle.artifacts.map(artifact => artifact.name);
  const uniqueNames = new Set(artifactNames);
  if (uniqueNames.size !== artifactNames.length) {
    issues.push('duplicate Codex bootstrap artifact names are not allowed');
  }
  for (const required of REQUIRED_CODEX_BOOTSTRAP_ARTIFACTS) {
    if (!uniqueNames.has(required)) {
      issues.push(`missing required Codex bootstrap artifact ${required}`);
    }
  }
  if (bundle.command.command !== BOOTSTRAP_CODEX_COMMAND) {
    issues.push('missing preserved bootstrap-codex command descriptor');
  }
  return issues;
}

function summarizeCapabilities(
  capabilities: readonly CodexHarnessCapability[]
): Record<CodexCapabilityStatus, number> {
  return codexCapabilityStatusValues.reduce<Record<CodexCapabilityStatus, number>>(
    (summary, status) => ({
      ...summary,
      [status]: capabilities.filter(capabilityItem => capabilityItem.status === status).length,
    }),
    {
      supported: 0,
      partial: 0,
      unsupported: 0,
      unknown: 0,
      deferred_by_design: 0,
    }
  );
}
