import { lstat } from 'fs/promises';
import { join, resolve } from 'path';
import { createAcceptancePlan } from './acceptance';
import { routeBmad } from './bmad';
import { selectCapabilities } from './capabilities';
import { createDecisionDossier } from './decision-dossier';
import { planDocumentation } from './docs';
import { getGraphContext } from './graph';
import { buildLedgerBundle } from './ledgers';
import { getContextOrchestratorReadiness } from './status';
import { validateContextOrchestrator } from './validation';
import {
  approvalCapsuleSchema,
  type ApprovalCapsule,
  type ApprovalCapsuleArtifactRef,
  type ApprovalCapsuleCommand,
  type ApprovalCapsuleLedgerRef,
} from './schemas/approval-capsule';
import {
  assertPathInside,
  assertRealPathInside,
  redactSecrets,
  validateSafeRunId,
  writeFileNoFollow,
} from './security';
import type {
  AcceptancePlan,
  BmadRoute,
  CapabilityRoute,
  DecisionDossier,
  DocumentationPlan,
  GraphContext,
  LedgerBundle,
  ValidationReport,
} from './types';

export const APPROVAL_CAPSULE_SCHEMA_VERSION = 'aco.approval-capsule.v1' as const;
export const APPROVAL_CAPSULE_JSON = 'approval-capsule.json' as const;
export const APPROVAL_CAPSULE_MARKDOWN = 'approval-capsule.md' as const;

export interface CreateApprovalCapsuleOptions {
  cwd: string;
  prompt: string;
  runId: string;
  timestamp?: string;
  artifactRoot?: string;
  graphContext?: GraphContext;
  documentationPlan?: DocumentationPlan;
  bmadRoute?: BmadRoute;
  acceptancePlan?: AcceptancePlan;
  selectedCapabilities?: CapabilityRoute;
  validationReport?: ValidationReport;
  ledgerBundle?: LedgerBundle;
  decisionDossier?: DecisionDossier;
}

export interface ApprovalCapsuleArtifactFiles {
  json: string;
  markdown: string;
}

const approvalLedgerStatuses = new Set(['deferred', 'forbidden'] as const);

export async function createApprovalCapsule(
  options: CreateApprovalCapsuleOptions
): Promise<ApprovalCapsule> {
  const runId = validateSafeRunId(options.runId);
  const graphContext = options.graphContext ?? (await getGraphContext({ cwd: options.cwd }));
  const documentationPlan =
    options.documentationPlan ?? planDocumentation({ prompt: options.prompt });
  const bmadRoute = options.bmadRoute ?? routeBmad({ prompt: options.prompt });
  const acceptancePlan =
    options.acceptancePlan ?? createAcceptancePlan({ prompt: options.prompt, route: bmadRoute });
  const selectedCapabilities =
    options.selectedCapabilities ?? selectCapabilities({ graphContext, documentationPlan });
  const validationReport =
    options.validationReport ?? (await validateContextOrchestrator({ cwd: options.cwd }));
  const ledgerBundle =
    options.ledgerBundle ??
    (await buildLedgerBundle({
      cwd: options.cwd,
      timestamp: options.timestamp,
      graphContext,
      documentationPlan,
      bmadRoute,
      acceptancePlan,
      selectedCapabilities,
      validationReport,
    }));
  const decisionDossier =
    options.decisionDossier ??
    (await createDecisionDossier({
      cwd: options.cwd,
      prompt: options.prompt,
      timestamp: options.timestamp,
      graphContext,
      documentationPlan,
      bmadRoute,
      acceptancePlan,
      selectedCapabilities,
      validationReport,
      ledgerBundle,
    }));
  const readiness = getContextOrchestratorReadiness(graphContext, validationReport);
  if (readiness !== 'needs_approval' || graphContext.status !== 'forbidden') {
    throw new Error(
      `ACO approval capsule requires readiness=needs_approval and graphStatus=forbidden; got readiness=${readiness} graphStatus=${graphContext.status}`
    );
  }

  const activeWaiverIds = graphContext.waivers.map(waiver => redactSecrets(waiver.id));
  const capsule: ApprovalCapsule = {
    schemaVersion: APPROVAL_CAPSULE_SCHEMA_VERSION,
    ...(options.timestamp !== undefined ? { generatedAt: redactSecrets(options.timestamp) } : {}),
    runId,
    route: bmadRoute,
    readiness,
    graphStatus: graphContext.status,
    validationStatus: validationReport.status,
    ledgerSummary: ledgerBundle.summary,
    artifactRefs: buildArtifactRefs({ artifactRoot: options.artifactRoot, runId }),
    activeWaiverIds,
    ledgerRefs: buildApprovalLedgerRefs(ledgerBundle),
    approvalCommands: buildApprovalCommands(decisionDossier),
    decisionScope: buildDecisionScope(runId, activeWaiverIds),
    releaseReadiness: 'Needs approval while waivers remain.',
  };

  return approvalCapsuleSchema.parse(capsule);
}

export function renderApprovalCapsuleMarkdown(capsule: ApprovalCapsule): string {
  return [
    '# ACO Approval Capsule',
    '',
    `Schema: ${capsule.schemaVersion}`,
    ...(capsule.generatedAt !== undefined ? [`Generated: ${capsule.generatedAt}`] : []),
    `Run ID: ${capsule.runId}`,
    `Route: ${capsule.route.id}`,
    `Readiness: ${capsule.readiness}`,
    `Graph: ${capsule.graphStatus}`,
    `Validation: ${capsule.validationStatus}`,
    `Release readiness: ${capsule.releaseReadiness}`,
    '',
    '## Decision Scope',
    '',
    capsule.decisionScope,
    '',
    '## Active Waivers',
    '',
    ...renderList(capsule.activeWaiverIds),
    '',
    '## Approval Commands',
    '',
    ...renderApprovalCommands(capsule.approvalCommands),
    '',
    '## Forbidden Or Deferred Ledger Refs',
    '',
    ...renderLedgerRefs(capsule.ledgerRefs),
    '',
    '## Artifact Refs',
    '',
    ...renderArtifactRefs(capsule.artifactRefs),
    '',
    '## Ledger Summary',
    '',
    `Total rows: ${capsule.ledgerSummary.combined.total}`,
    `Forbidden rows: ${capsule.ledgerSummary.combined.counts.forbidden}`,
    `Deferred rows: ${capsule.ledgerSummary.combined.counts.deferred}`,
  ].join('\n');
}

export async function writeApprovalCapsuleArtifacts(
  capsule: ApprovalCapsule,
  artifactRoot: string
): Promise<ApprovalCapsuleArtifactFiles> {
  const archivePath = await assertCompiledPackageExists(artifactRoot, capsule.runId);
  const files = getApprovalCapsuleArtifactFiles(artifactRoot, capsule.runId);
  await writeFileNoFollow(archivePath, files.json, `${JSON.stringify(capsule, null, 2)}\n`);
  await writeFileNoFollow(
    archivePath,
    files.markdown,
    `${renderApprovalCapsuleMarkdown(capsule)}\n`
  );
  return files;
}

export function getApprovalCapsuleArtifactFiles(
  artifactRoot: string,
  runId: string
): ApprovalCapsuleArtifactFiles {
  const safeRunId = validateSafeRunId(runId);
  const resolvedRoot = resolve(artifactRoot);
  const archivePath = resolve(resolvedRoot, safeRunId);
  assertPathInside(resolvedRoot, archivePath);
  return {
    json: join(archivePath, APPROVAL_CAPSULE_JSON),
    markdown: join(archivePath, APPROVAL_CAPSULE_MARKDOWN),
  };
}

function buildArtifactRefs(input: {
  artifactRoot?: string;
  runId: string;
}): ApprovalCapsuleArtifactRef[] {
  const root = input.artifactRoot !== undefined ? resolve(input.artifactRoot) : undefined;
  const packagePath = root !== undefined ? resolve(root, input.runId) : undefined;
  const ref = (
    id: ApprovalCapsuleArtifactRef['id'],
    label: string,
    path: string | undefined,
    nodeId?: string
  ): ApprovalCapsuleArtifactRef => ({
    id,
    label,
    ...(path !== undefined ? { path: redactSecrets(path) } : {}),
    ...(nodeId !== undefined ? { nodeId } : {}),
  });

  return [
    ref(
      'status-json',
      'Context status JSON',
      root ? join(root, 'status.json') : undefined,
      'status'
    ),
    ref(
      'ledgers-json',
      'Ledger bundle JSON',
      root ? join(root, 'ledgers.json') : undefined,
      'ledgers'
    ),
    ref(
      'graph-validation-gate',
      'Graph validation gate output',
      root ? join(root, 'graph-validation-gate.txt') : undefined,
      'graph-validation-gate'
    ),
    ref(
      'compile-result-json',
      'Compile result JSON',
      root ? join(root, 'compile-result.json') : undefined,
      'compile'
    ),
    ref('compiled-package', 'Compiled prompt package directory', packagePath),
    ref(
      'decision-dossier-json',
      'Decision dossier JSON',
      packagePath ? join(packagePath, 'decision-dossier.json') : undefined
    ),
    ref(
      'decision-dossier-markdown',
      'Decision dossier Markdown',
      packagePath ? join(packagePath, 'decision-dossier.md') : undefined
    ),
    ref(
      'approval-capsule-json',
      'Approval capsule JSON',
      packagePath ? join(packagePath, APPROVAL_CAPSULE_JSON) : undefined,
      'approval-capsule'
    ),
    ref(
      'approval-capsule-markdown',
      'Approval capsule Markdown',
      packagePath ? join(packagePath, APPROVAL_CAPSULE_MARKDOWN) : undefined,
      'approval-capsule'
    ),
  ];
}

function buildApprovalLedgerRefs(ledgerBundle: LedgerBundle): ApprovalCapsuleLedgerRef[] {
  const toolRefs = ledgerBundle.toolAvailability
    .filter(entry => approvalLedgerStatuses.has(entry.status as 'deferred' | 'forbidden'))
    .map(
      (entry): ApprovalCapsuleLedgerRef => ({
        id: redactSecrets(entry.id),
        kind: 'tool',
        status: entry.status as 'deferred' | 'forbidden',
        reason: redactSecrets(entry.failureMode),
        sourceEvidence: redactSecrets(entry.sourceEvidence),
      })
    );
  const commandRefs = ledgerBundle.commands
    .filter(entry => approvalLedgerStatuses.has(entry.status as 'deferred' | 'forbidden'))
    .map(
      (entry): ApprovalCapsuleLedgerRef => ({
        id: redactSecrets(entry.id),
        kind: 'command',
        status: entry.status as 'deferred' | 'forbidden',
        reason: redactSecrets(entry.failureMode),
        sourceEvidence: redactSecrets(entry.sourceEvidence),
        command: redactSecrets(entry.command),
      })
    );

  return [...toolRefs, ...commandRefs].sort((left, right) => left.id.localeCompare(right.id));
}

function buildApprovalCommands(decisionDossier: DecisionDossier): ApprovalCapsuleCommand[] {
  return decisionDossier.approvalCommands.map(command => ({
    id: redactSecrets(command.id),
    command: redactSecrets(command.command),
    safety: command.safety,
    requiresApproval: true,
    willRun: false,
    reason: redactSecrets(command.reason),
  }));
}

function buildDecisionScope(runId: string, waiverIds: string[]): string {
  const waiverText = waiverIds.length > 0 ? waiverIds.join(', ') : 'none';
  return redactSecrets(
    [
      `Approval preserves only these active graph waivers for this run only (${runId}): ${waiverText}.`,
      'It does not approve new waivers, clear existing waivers, refresh Graphify evidence, run graph commands, or grant permission for future runs.',
    ].join(' ')
  );
}

function renderList(items: string[]): string[] {
  if (items.length === 0) return ['- none'];
  return items.map(item => `- ${item}`);
}

function renderApprovalCommands(commands: ApprovalCapsuleCommand[]): string[] {
  if (commands.length === 0) return ['- none'];
  return commands.map(
    command =>
      `- ${command.id}: \`${command.command}\` (${command.safety}, approval required, willRun=false) - ${command.reason}`
  );
}

function renderLedgerRefs(refs: ApprovalCapsuleLedgerRef[]): string[] {
  if (refs.length === 0) return ['- none'];
  return refs.map(ref => {
    const command = ref.command !== undefined ? `; command=${ref.command}` : '';
    return `- ${ref.id} (${ref.kind}, ${ref.status}): ${ref.reason}${command}`;
  });
}

function renderArtifactRefs(refs: ApprovalCapsuleArtifactRef[]): string[] {
  if (refs.length === 0) return ['- none'];
  return refs.map(ref => {
    const target = ref.path ?? ref.nodeId ?? 'not available';
    return `- ${ref.id}: ${ref.label} (${target})`;
  });
}

async function assertCompiledPackageExists(artifactRoot: string, runId: string): Promise<string> {
  const safeRunId = validateSafeRunId(runId);
  const resolvedRoot = resolve(artifactRoot);
  const archivePath = resolve(resolvedRoot, safeRunId);
  assertPathInside(resolvedRoot, archivePath);
  await assertDirectory(resolvedRoot, 'ACO artifact root');
  await assertDirectory(archivePath, `ACO compiled package for runId ${safeRunId}`);
  await assertRealPathInside(resolvedRoot, archivePath);
  await assertRegularFile(
    join(archivePath, 'manifest.json'),
    `ACO manifest for runId ${safeRunId}`
  );
  return archivePath;
}

async function assertDirectory(path: string, label: string): Promise<void> {
  try {
    const stats = await lstat(path);
    if (stats.isSymbolicLink()) throw new Error(`${label} must not be a symbolic link: ${path}`);
    if (!stats.isDirectory()) throw new Error(`${label} must be a directory: ${path}`);
  } catch (error) {
    if (isEnoent(error)) throw new Error(`${label} not found: ${path}`);
    throw error;
  }
}

async function assertRegularFile(path: string, label: string): Promise<void> {
  try {
    const stats = await lstat(path);
    if (stats.isSymbolicLink()) throw new Error(`${label} must not be a symbolic link: ${path}`);
    if (!stats.isFile()) throw new Error(`${label} must be a file: ${path}`);
  } catch (error) {
    if (isEnoent(error)) throw new Error(`${label} not found: ${path}`);
    throw error;
  }
}

function isEnoent(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string' &&
    (error as { code: string }).code === 'ENOENT'
  );
}
