import { createRegistry } from './registry';
import {
  capabilityClaimStatusValues,
  migrationOrderPlanSchema,
  mutationClassValues,
  parseReferenceSurfacePlan,
  surfaceCompatibilityValues,
} from './schemas';
import type { MigrationOrderPlan, ReferenceSurfacePlan } from './schemas';
import type {
  CapabilityClaimStatus,
  CapabilityManifestRecord,
  CommandManifestRecord,
  CompatibilityGateResult,
  EvidenceRef,
  Gate,
  GateManifestRecord,
  GateRunResult,
  ManifestRecord,
  MutationClass,
  ParseResult,
  ReferenceSurfaceCompilation,
  Registry,
  RegistryContract,
  SurfaceCompatibility,
  SurfaceManifestRecord,
  WorkflowManifestRecord,
} from './contracts';

type CommandSurface = ReferenceSurfacePlan['commands'][number];
type CapabilitySurface = ReferenceSurfacePlan['capabilities'][number];

const REQUIRED_CONTEXT_COMMAND_PREFIXES = [
  'archon context status',
  'archon context ledgers',
  'archon context route',
  'archon context compile',
  'archon context approval-capsule ',
  'archon context approval-capsule-verify',
  'archon context graph-waivers',
  'archon context validate',
] as const;

const REQUIRED_WORKFLOWS = ['context-orchestrate', 'archon-aco-adversarial-loop'] as const;

const HIGH_RISK_MUTATIONS: readonly MutationClass[] = [
  'writes-tracked-files',
  'writes-user-files',
  'writes-config',
  'writes-credentials',
  'writes-remotes',
  'writes-graph-cache',
  'destructive',
  'network',
  'unknown',
];

export function compileReferenceSurfacePlan(
  input: unknown
): ParseResult<ReferenceSurfaceCompilation> {
  const parsed = parseReferenceSurfacePlan(input);
  if (!parsed.ok) return parsed;

  const issues: string[] = [];
  if (parsed.value.generatedFrom.length === 0) {
    issues.push('reference surface plan must include generatedFrom evidence labels');
  }

  const commandManifests = collectMapped(parsed.value.commands, toCommandManifest, issues);
  const capabilityManifests = collectMapped(
    parsed.value.capabilities,
    toCapabilityManifest,
    issues
  );
  const workflowManifests = collectWorkflowManifests(parsed.value.capabilities, issues);
  const gateManifests = [createCompatibilityGateManifest()];
  const surfaceManifests = collectSurfaceManifests(commandManifests, workflowManifests);

  const records = sortRecords([
    ...commandManifests,
    ...surfaceManifests,
    ...capabilityManifests,
    ...workflowManifests,
    ...gateManifests,
  ]);

  issues.push(...findDuplicateIds(records));
  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const registries = buildRegistries({
    commandManifests,
    surfaceManifests,
    capabilityManifests,
    workflowManifests,
    gateManifests,
  });
  if (!registries.ok) return registries;

  return {
    ok: true,
    value: {
      records,
      commandManifests,
      surfaceManifests,
      capabilityManifests,
      workflowManifests,
      gateManifests,
      requiredSurfaceAssertions: [...parsed.value.requiredSurfaceAssertions].sort(),
      registries: registries.value,
    },
  };
}

export const referenceSurfaceCompatibilityGate: Gate<
  ReferenceSurfacePlan,
  CompatibilityGateResult
> = {
  kind: 'gate',
  id: 'reference-surface-compatibility-gate',
  mutates: 'read-only',
  run(input: ReferenceSurfacePlan): Promise<GateRunResult<CompatibilityGateResult>> {
    const compiled = compileReferenceSurfacePlan(input);
    const evidence = [gateEvidence()];
    if (!compiled.ok) {
      return Promise.resolve({ status: 'failed', errors: compiled.issues, evidence });
    }

    const errors = validateCompatibility(compiled.value);
    if (errors.length > 0) {
      return Promise.resolve({ status: 'failed', errors, evidence });
    }

    return Promise.resolve({
      status: 'passed',
      value: {
        manifestCounts: {
          commands: compiled.value.commandManifests.length,
          surfaces: compiled.value.surfaceManifests.length,
          capabilities: compiled.value.capabilityManifests.length,
          workflows: compiled.value.workflowManifests.length,
          gates: compiled.value.gateManifests.length,
        },
        requiredSurfaces: compiled.value.requiredSurfaceAssertions,
        migrationPhases: ['S2', 'S3'],
      },
      evidence,
    });
  },
};

export function validateMigrationOrderPlan(input: unknown): ParseResult<MigrationOrderPlan> {
  const parsed = migrationOrderPlanSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  }

  const phases = new Set(parsed.data.phases.map(phase => phase.id));
  const issues: string[] = [];
  for (const phase of ['S2', 'S3']) {
    if (!phases.has(phase)) {
      issues.push(`migration order must include ${phase}`);
    }
  }
  const s2 = parsed.data.phases.find(phase => phase.id === 'S2');
  if (s2?.ownerPackage !== '@archon/aco-core') {
    issues.push('S2 must be owned by @archon/aco-core');
  }
  const s3 = parsed.data.phases.find(phase => phase.id === 'S3');
  if (s3?.ownerPackage !== '@archon/aco-ledgers') {
    issues.push('S3 must be owned by @archon/aco-ledgers');
  }
  for (const surface of parsed.data.preservedSurfaces) {
    if (!phases.has(surface.capturePhase)) {
      issues.push(`${surface.surface} references unknown capture phase ${surface.capturePhase}`);
    }
    if (!phases.has(surface.migrationPhase)) {
      issues.push(
        `${surface.surface} references unknown migration phase ${surface.migrationPhase}`
      );
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true, value: parsed.data };
}

function toCommandManifest(
  command: CommandSurface,
  index: number
): ParseResult<CommandManifestRecord> {
  const mutates = normalizeMutation(command.mutates);
  const approvalRequired = normalizeApproval(command.approvalRequired);
  const compatibility = normalizeCompatibility(command.compatibility);
  if (!mutates.ok || !approvalRequired.ok || !compatibility.ok) {
    return { ok: false, issues: collectIssues(mutates, approvalRequired, compatibility) };
  }

  return {
    ok: true,
    value: {
      kind: 'command-manifest',
      id: `command.${slugify(command.command)}`,
      command: command.command,
      surface: command.surface,
      purpose: command.purpose,
      mutates: mutates.value,
      approvalRequired: approvalRequired.value,
      owner: command.owner,
      compatibility: compatibility.value,
      evidence: [commandEvidence(command, index)],
    },
  };
}

function toCapabilityManifest(
  capability: CapabilitySurface,
  index: number
): ParseResult<CapabilityManifestRecord> {
  const status = normalizeCapabilityStatus(capability.status);
  if (!status.ok) return { ok: false, issues: status.issues };

  return {
    ok: true,
    value: {
      kind: 'capability-manifest',
      id: `capability.${slugify(capability.id)}`,
      capability: capability.capability,
      owner: `aco-${capability.id}`,
      status: status.value,
      evidence: [capabilityEvidence(capability, index)],
    },
  };
}

function collectWorkflowManifests(
  capabilities: readonly CapabilitySurface[],
  issues: string[]
): readonly WorkflowManifestRecord[] {
  const workflowCapability = capabilities.find(capability => capability.id === 'workflows');
  if (workflowCapability === undefined) {
    issues.push('missing workflows capability');
    return [];
  }

  return workflowCapability.currentSurface
    .split(';')
    .map(workflow => workflow.trim())
    .filter(workflow => workflow.length > 0)
    .sort()
    .map(
      (workflow): WorkflowManifestRecord => ({
        kind: 'workflow-manifest',
        id: `workflow.${slugify(workflow)}`,
        workflow,
        owner: 'aco-workflows',
        nodeContracts: [],
        evidence: [
          capabilityEvidence(workflowCapability, capabilities.indexOf(workflowCapability)),
        ],
      })
    );
}

function collectSurfaceManifests(
  commands: readonly CommandManifestRecord[],
  workflows: readonly WorkflowManifestRecord[]
): readonly SurfaceManifestRecord[] {
  const commandSurfaces = commands.map(command => ({
    kind: 'surface-manifest' as const,
    id: `surface.${slugify(command.command)}`,
    surface: command.command,
    owner: command.owner,
    compatibility: command.compatibility,
    evidence: command.evidence,
  }));
  const workflowSurfaces = workflows.map(workflow => ({
    kind: 'surface-manifest' as const,
    id: `surface.${slugify(workflow.workflow)}`,
    surface: workflow.workflow,
    owner: workflow.owner,
    compatibility: 'preserve' as const,
    evidence: workflow.evidence,
  }));
  return [...commandSurfaces, ...workflowSurfaces].sort(compareById);
}

function createCompatibilityGateManifest(): GateManifestRecord {
  return {
    kind: 'gate-manifest',
    id: 'gate.reference-surface-compatibility-gate',
    gate: 'reference-surface-compatibility-gate',
    mutates: 'read-only',
    evidence: [gateEvidence()],
  };
}

function validateCompatibility(compiled: ReferenceSurfaceCompilation): readonly string[] {
  const errors: string[] = [];
  const commandTexts = compiled.commandManifests.map(command => command.command);
  const workflows = new Set(compiled.workflowManifests.map(workflow => workflow.workflow));

  if (!commandTexts.some(command => command.startsWith('archon aco bootstrap-codex'))) {
    errors.push('missing /aco:bootstrap-codex command surface');
  }
  if (!commandTexts.some(command => command.startsWith('archon aco status'))) {
    errors.push('missing archon aco status command surface');
  }
  for (const prefix of REQUIRED_CONTEXT_COMMAND_PREFIXES) {
    if (!commandTexts.some(command => command.startsWith(prefix))) {
      errors.push(`missing ${prefix.trim()} command surface`);
    }
  }
  for (const workflow of REQUIRED_WORKFLOWS) {
    if (!workflows.has(workflow)) {
      errors.push(`missing ${workflow} workflow surface`);
    }
  }
  for (const command of compiled.commandManifests) {
    if (HIGH_RISK_MUTATIONS.includes(command.mutates) && !command.approvalRequired) {
      errors.push(`${command.id} requires approval for ${command.mutates}`);
    }
  }

  return errors;
}

function normalizeMutation(input: string): ParseResult<MutationClass> {
  const normalized = input.trim().toLowerCase();
  if (normalized === 'no' || normalized === 'read-only') {
    return { ok: true, value: 'read-only' };
  }
  if (normalized === 'artifact-only' || normalized === 'artifact-only when flag set') {
    return { ok: true, value: 'writes-artifacts' };
  }
  if (normalized === 'graph cache artifacts') {
    return { ok: true, value: 'writes-graph-cache' };
  }
  if (isOneOf(normalized, mutationClassValues)) {
    return { ok: true, value: normalized };
  }
  return { ok: false, issues: [`unsupported mutation claim: ${input}`] };
}

function normalizeApproval(input: string): ParseResult<boolean> {
  const normalized = input.trim().toLowerCase();
  if (normalized.startsWith('yes')) return { ok: true, value: true };
  if (normalized.startsWith('no')) return { ok: true, value: false };
  return { ok: false, issues: [`unsupported approval claim: ${input}`] };
}

function normalizeCompatibility(input: string): ParseResult<SurfaceCompatibility> {
  const normalized = input.trim().toLowerCase();
  if (isOneOf(normalized, surfaceCompatibilityValues)) {
    return { ok: true, value: normalized };
  }
  return { ok: false, issues: [`unsupported compatibility claim: ${input}`] };
}

function normalizeCapabilityStatus(input: string): ParseResult<CapabilityClaimStatus> {
  const normalized = input.trim().toLowerCase();
  if (normalized === 'planned') {
    return { ok: true, value: 'deferred' };
  }
  if (isOneOf(normalized, capabilityClaimStatusValues)) {
    return { ok: true, value: normalized };
  }
  return { ok: false, issues: [`unsupported capability status: ${input}`] };
}

function collectMapped<TInput, TOutput>(
  items: readonly TInput[],
  mapItem: (item: TInput, index: number) => ParseResult<TOutput>,
  issues: string[]
): readonly TOutput[] {
  const output: TOutput[] = [];
  items.forEach((item, index) => {
    const mapped = mapItem(item, index);
    if (mapped.ok) {
      output.push(mapped.value);
    } else {
      issues.push(...mapped.issues);
    }
  });
  return output;
}

function collectIssues(...results: readonly ParseResult<unknown>[]): readonly string[] {
  return results.flatMap(result => (result.ok ? [] : result.issues));
}

function commandEvidence(command: CommandSurface, index: number): EvidenceRef {
  return {
    id: `evidence.command.${slugify(command.command)}`,
    source: `reference-surface-plan.commands.${String(index)}`,
    summary: `${command.command} preserved from stabilization command ledger`,
    confidence: 'high',
    freshness: 'fresh',
  };
}

function capabilityEvidence(capability: CapabilitySurface, index: number): EvidenceRef {
  return {
    id: `evidence.capability.${slugify(capability.id)}`,
    source: `reference-surface-plan.capabilities.${String(index)}`,
    summary: `${capability.capability} preserved from stabilization capability inventory`,
    confidence: capability.confidence,
    freshness: 'fresh',
  };
}

function gateEvidence(): EvidenceRef {
  return {
    id: 'evidence.gate.reference-surface-compatibility',
    source: 'reference-surface-compatibility-gate',
    summary: 'Pure read-only compatibility gate over normalized ACO manifests',
    confidence: 'high',
    freshness: 'fresh',
  };
}

function buildRegistries(input: {
  readonly commandManifests: readonly CommandManifestRecord[];
  readonly surfaceManifests: readonly SurfaceManifestRecord[];
  readonly capabilityManifests: readonly CapabilityManifestRecord[];
  readonly workflowManifests: readonly WorkflowManifestRecord[];
  readonly gateManifests: readonly GateManifestRecord[];
}): ParseResult<ReferenceSurfaceCompilation['registries']> {
  try {
    return {
      ok: true,
      value: {
        commands: bootloadRegistry('command-manifest', input.commandManifests),
        surfaces: bootloadRegistry('surface-manifest', input.surfaceManifests),
        capabilities: bootloadRegistry('capability-manifest', input.capabilityManifests),
        workflows: bootloadRegistry('workflow-manifest', input.workflowManifests),
        gates: bootloadRegistry('gate-manifest', input.gateManifests),
      },
    };
  } catch (error: unknown) {
    return {
      ok: false,
      issues: [error instanceof Error ? error.message : 'registry bootload failed'],
    };
  }
}

function bootloadRegistry<TKind extends string, TContract extends RegistryContract<TKind>>(
  kind: TKind,
  records: readonly TContract[]
): Registry<TKind, TContract> {
  return records
    .reduce((registry, record) => registry.register(record), createRegistry<TKind, TContract>(kind))
    .bootload();
}

function findDuplicateIds(records: readonly ManifestRecord[]): readonly string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const record of records) {
    const key = `${record.kind}:${record.id}`;
    if (seen.has(key)) {
      duplicates.add(key);
    }
    seen.add(key);
  }
  return [...duplicates].sort().map(id => `duplicate manifest id: ${id}`);
}

function sortRecords(records: readonly ManifestRecord[]): readonly ManifestRecord[] {
  return [...records].sort((left, right) =>
    `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`)
  );
}

function compareById<TRecord extends { readonly id: string }>(
  left: TRecord,
  right: TRecord
): number {
  return left.id.localeCompare(right.id);
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'unnamed';
}

function isOneOf<TValue extends string>(
  value: string,
  allowed: readonly TValue[]
): value is TValue {
  return allowed.includes(value as TValue);
}
