import { lstat, readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { createAcceptancePlan } from './acceptance';
import { routeBmad } from './bmad';
import { selectCapabilities } from './capabilities';
import { createDecisionDossier } from './decision-dossier';
import { planDocumentation } from './docs';
import { getGraphContext } from './graph';
import { createContextIntent } from './intent';
import { buildLedgerBundle } from './ledgers';
import { getContextOrchestratorReadiness } from './status';
import { validateContextOrchestrator } from './validation';
import {
  ACO_APPROVAL_CONTRACT_SCHEMA_VERSION,
  acoApprovalContractVerificationSchema,
  approvalContractFromPayload,
  buildAcoApprovalContract,
  compareApprovalContracts,
  createLedgerFingerprint,
  verifyAcoApprovalContract,
  type AcoApprovalContractMismatch,
  type AcoApprovalContractVerification,
} from './schemas/approval-contract';
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
  ContextIntent,
  DecisionDossier,
  EvidenceBlocker,
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
  contextIntent?: ContextIntent;
}

export interface ApprovalCapsuleArtifactFiles {
  json: string;
  markdown: string;
}

export interface VerifyApprovalCapsuleArtifactsOptions {
  cwd: string;
  artifactRoot: string;
  runId: string;
}

const approvalLedgerStatuses = new Set(['deferred', 'forbidden'] as const);

export async function createApprovalCapsule(
  options: CreateApprovalCapsuleOptions
): Promise<ApprovalCapsule> {
  const runId = validateSafeRunId(options.runId);
  const contextIntent =
    options.contextIntent ??
    (await createContextIntent({
      cwd: options.cwd,
      objective: options.prompt,
      timestamp: options.timestamp,
    }));
  const graphContext = options.graphContext ?? (await getGraphContext({ cwd: options.cwd }));
  const documentationPlan =
    options.documentationPlan ?? planDocumentation({ prompt: contextIntent.objective });
  const bmadRoute = options.bmadRoute ?? routeBmad({ prompt: contextIntent.objective });
  const acceptancePlan =
    options.acceptancePlan ??
    createAcceptancePlan({ prompt: contextIntent.objective, route: bmadRoute });
  const selectedCapabilities =
    options.selectedCapabilities ?? selectCapabilities({ graphContext, documentationPlan });
  const validationReport =
    options.validationReport ?? (await validateContextOrchestrator({ cwd: options.cwd }));
  const ledgerBundle =
    options.ledgerBundle ??
    (await buildLedgerBundle({
      cwd: options.cwd,
      objective: contextIntent.objective,
      timestamp: contextIntent.generatedAt,
      contextIntent,
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
      prompt: contextIntent.objective,
      timestamp: contextIntent.generatedAt,
      graphContext,
      documentationPlan,
      bmadRoute,
      acceptancePlan,
      selectedCapabilities,
      validationReport,
      ledgerBundle,
      contextIntent,
    }));
  const readiness = getContextOrchestratorReadiness(
    graphContext,
    validationReport,
    ledgerBundle.evidenceBlockers,
    { route: bmadRoute }
  );
  if (readiness !== 'needs_approval' || graphContext.status !== 'forbidden') {
    throw new Error(
      `ACO approval capsule requires readiness=needs_approval and graphStatus=forbidden; got readiness=${readiness} graphStatus=${graphContext.status}`
    );
  }
  const approvalContract = buildAcoApprovalContract({
    actionId: 'next.approve-current-graph-waivers',
    contextIntent,
    route: bmadRoute,
    readiness,
    graphContext,
    evidenceResolution: decisionDossier.evidenceResolution,
    ledgerFingerprint: createLedgerFingerprint(ledgerBundle),
    validationReport,
  });
  const payloadContract = approvalContractFromPayload(
    decisionDossier.nextDecision.primaryAction.payload
  );
  if (decisionDossier.nextDecision.kind === 'approval_required') {
    if (payloadContract === null) {
      throw new Error(
        `ACO approval capsule requires nextDecision=approval_required with ${ACO_APPROVAL_CONTRACT_SCHEMA_VERSION}; got missing payload`
      );
    }
    const payloadMismatches = compareApprovalContracts(
      approvalContract,
      payloadContract,
      'nextDecision.payload'
    );
    if (payloadMismatches.length > 0) {
      throw new Error(
        `ACO approval capsule nextDecision approval contract mismatch: ${payloadMismatches
          .map(mismatch => mismatch.field)
          .join(', ')}`
      );
    }
  }

  const activeWaiverIds = graphContext.waivers.map(waiver => redactSecrets(waiver.id));
  const capsule: ApprovalCapsule = {
    schemaVersion: APPROVAL_CAPSULE_SCHEMA_VERSION,
    generatedAt: contextIntent.generatedAt,
    runId,
    contextIntent,
    route: bmadRoute,
    readiness,
    graphStatus: graphContext.status,
    validationStatus: validationReport.status,
    ledgerSummary: ledgerBundle.summary,
    artifactRefs: buildArtifactRefs({ artifactRoot: options.artifactRoot, runId }),
    activeWaiverIds,
    evidenceBlockers: ledgerBundle.evidenceBlockers,
    evidenceResolution: decisionDossier.evidenceResolution,
    approvalContract,
    nextDecision: decisionDossier.nextDecision,
    ledgerRefs: buildApprovalLedgerRefs(ledgerBundle),
    approvalCommands: buildApprovalCommands(decisionDossier),
    decisionScope: buildDecisionScope(runId, activeWaiverIds),
    releaseReadiness: 'Needs approval while waivers remain.',
  };

  return approvalCapsuleSchema.parse(capsule);
}

export async function verifyApprovalCapsuleArtifacts(
  options: VerifyApprovalCapsuleArtifactsOptions
): Promise<AcoApprovalContractVerification> {
  const files = getApprovalCapsuleArtifactFiles(options.artifactRoot, options.runId);
  const raw = await readFile(files.json, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return invalidVerification('', '', [
      {
        field: 'approvalCapsule',
        reason: `Approval capsule JSON is malformed: ${error instanceof Error ? error.message : String(error)}`,
      },
    ]);
  }

  const capsuleResult = approvalCapsuleSchema.safeParse(parsed);
  if (!capsuleResult.success) {
    return invalidVerification(
      getRecordString(parsed, 'contractId'),
      getRecordString(parsed, 'contractHash'),
      [
        {
          field: 'approvalCapsule',
          reason: isLegacyApprovalCapsule(parsed)
            ? 'Legacy approval capsule is missing approvalContract.'
            : 'Approval capsule schema is invalid.',
        },
      ]
    );
  }

  const capsule = capsuleResult.data;
  const mismatches: AcoApprovalContractMismatch[] = [
    ...verifyAcoApprovalContract(capsule.approvalContract).mismatches,
  ];
  const payloadContract = approvalContractFromPayload(capsule.nextDecision.primaryAction.payload);
  if (capsule.nextDecision.kind === 'approval_required' && payloadContract === null) {
    mismatches.push({
      field: 'nextDecision.primaryAction.payload',
      reason: 'Next decision primary action payload is not an approval contract.',
    });
  } else if (payloadContract !== null) {
    mismatches.push(
      ...compareApprovalContracts(capsule.approvalContract, payloadContract, 'nextDecision.payload')
    );
  }

  const activeWaiverIds = sorted(capsule.activeWaiverIds);
  if (
    JSON.stringify(activeWaiverIds) !== JSON.stringify(capsule.approvalContract.requiredWaiverIds)
  ) {
    mismatches.push({
      field: 'activeWaiverIds',
      reason: 'Approval capsule active waivers differ from approval contract required waivers.',
      expected: JSON.stringify(capsule.approvalContract.requiredWaiverIds),
      actual: JSON.stringify(activeWaiverIds),
    });
  }

  const evidenceResolutionIds = sorted(
    capsule.evidenceResolution.items
      .filter(
        item =>
          item.targetKind === 'graph' &&
          item.resolver === 'approval' &&
          item.requiresApproval &&
          capsule.approvalContract.requiredWaiverIds.includes(item.evidenceId)
      )
      .map(item => item.evidenceId)
  );
  if (
    JSON.stringify(evidenceResolutionIds) !==
    JSON.stringify(capsule.approvalContract.evidenceResolutionIds)
  ) {
    mismatches.push({
      field: 'evidenceResolutionIds',
      reason: 'Approval capsule evidence resolution IDs differ from approval contract.',
      expected: JSON.stringify(capsule.approvalContract.evidenceResolutionIds),
      actual: JSON.stringify(evidenceResolutionIds),
    });
  }

  if (capsule.readiness !== capsule.approvalContract.readiness) {
    mismatches.push({
      field: 'readiness',
      reason: 'Approval capsule readiness differs from approval contract.',
      expected: capsule.approvalContract.readiness,
      actual: capsule.readiness,
    });
  }
  if (capsule.graphStatus !== capsule.approvalContract.graphStatus) {
    mismatches.push({
      field: 'graphStatus',
      reason: 'Approval capsule graph status differs from approval contract.',
      expected: capsule.approvalContract.graphStatus,
      actual: capsule.graphStatus,
    });
  }
  if (capsule.validationStatus !== capsule.approvalContract.validationStatus) {
    mismatches.push({
      field: 'validationStatus',
      reason: 'Approval capsule validation status differs from approval contract.',
      expected: capsule.approvalContract.validationStatus,
      actual: capsule.validationStatus,
    });
  }

  try {
    const currentCapsule = await createApprovalCapsule({
      cwd: options.cwd,
      prompt: capsule.contextIntent.objective,
      runId: capsule.runId,
    });
    mismatches.push(
      ...compareApprovalContracts(
        currentCapsule.approvalContract,
        capsule.approvalContract,
        'currentEvidence'
      )
    );
  } catch (error) {
    mismatches.push({
      field: 'currentEvidence',
      reason: `Current ACO evidence cannot produce an approval contract: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  return verificationFromMismatches(
    capsule.approvalContract.contractId,
    capsule.approvalContract.contractHash,
    mismatches
  );
}

export function renderApprovalCapsuleMarkdown(capsule: ApprovalCapsule): string {
  return [
    '# ACO Approval Capsule',
    '',
    `Schema: ${capsule.schemaVersion}`,
    ...(capsule.generatedAt !== undefined ? [`Generated: ${capsule.generatedAt}`] : []),
    `Run ID: ${capsule.runId}`,
    `Intent: ${capsule.contextIntent.intentHash}`,
    `Objective: ${capsule.contextIntent.normalizedObjective}`,
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
    '## Evidence Blockers',
    '',
    ...renderEvidenceBlockers(capsule.evidenceBlockers),
    '',
    '## Evidence Resolution',
    '',
    ...renderEvidenceResolution(capsule.evidenceResolution),
    '',
    '## Approval Contract',
    '',
    ...renderApprovalContract(capsule.approvalContract, capsule.runId),
    '',
    '## Next Decision',
    '',
    ...renderNextDecision(capsule.nextDecision),
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
      root ? join(root, 'graph-validation-gate.json') : undefined,
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

function renderEvidenceBlockers(blockers: EvidenceBlocker[]): string[] {
  if (blockers.length === 0) return ['- none'];
  return blockers.map(
    blocker =>
      `- ${blocker.id} (${blocker.kind}, ${blocker.status}, ${blocker.freshness}): ${blocker.nextVerificationAction}`
  );
}

function renderEvidenceResolution(
  capsuleResolution: ApprovalCapsule['evidenceResolution']
): string[] {
  if (capsuleResolution.items.length === 0) return ['- none'];
  return capsuleResolution.items.map(
    item =>
      `- ${item.evidenceId}: ${item.resolver} -> ${item.targetName}; approval=${item.requiresApproval ? 'yes' : 'no'}; next=${item.nextAction}`
  );
}

function renderApprovalContract(
  contract: ApprovalCapsule['approvalContract'],
  runId: string
): string[] {
  return [
    `- Schema: ${contract.schemaVersion}`,
    `- Contract ID: ${contract.contractId}`,
    `- Contract hash: ${contract.contractHash}`,
    `- Scope: ${contract.approvalScope.summary}`,
    `- Required waivers: ${contract.requiredWaiverIds.join(', ') || 'none'}`,
    `- Verification: run \`archon context approval-capsule-verify --cwd <repo> --artifact-root <artifact-root> --run-id ${runId}\` before approving handoff`,
  ];
}

function renderNextDecision(nextDecision: ApprovalCapsule['nextDecision']): string[] {
  return [
    `- Schema: ${nextDecision.schemaVersion}`,
    `- Kind: ${nextDecision.kind}`,
    `- Title: ${nextDecision.title}`,
    `- Summary: ${nextDecision.summary}`,
    `- Primary action: ${nextDecision.primaryAction.label} (${nextDecision.primaryAction.kind}, willRun=false, approval=${nextDecision.primaryAction.requiresApproval ? 'yes' : 'no'})`,
  ];
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

function sorted(values: string[]): string[] {
  return [...new Set(values.map(redactSecrets))].sort((left, right) => left.localeCompare(right));
}

function invalidVerification(
  contractId: string,
  contractHash: string,
  mismatches: AcoApprovalContractMismatch[]
): AcoApprovalContractVerification {
  return verificationFromMismatches(contractId, contractHash, mismatches);
}

function verificationFromMismatches(
  contractId: string,
  contractHash: string,
  mismatches: AcoApprovalContractMismatch[]
): AcoApprovalContractVerification {
  return acoApprovalContractVerificationSchema.parse({
    schemaVersion: 'aco.approval-contract-verification.v1',
    status: mismatches.length === 0 ? 'valid' : 'invalid',
    contractId: redactSecrets(contractId),
    contractHash: redactSecrets(contractHash),
    mismatches: mismatches.map(mismatch => ({
      field: redactSecrets(mismatch.field),
      reason: redactSecrets(mismatch.reason),
      ...(mismatch.expected !== undefined ? { expected: redactSecrets(mismatch.expected) } : {}),
      ...(mismatch.actual !== undefined ? { actual: redactSecrets(mismatch.actual) } : {}),
    })),
    nextAction:
      mismatches.length === 0
        ? 'Approval contract is valid for the current ACO evidence.'
        : 'Regenerate the ACO approval capsule for the current evidence before approving handoff.',
    willRun: false,
  });
}

function isLegacyApprovalCapsule(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    (value as Record<string, unknown>).schemaVersion === APPROVAL_CAPSULE_SCHEMA_VERSION &&
    !('approvalContract' in value)
  );
}

function getRecordString(value: unknown, key: string): string {
  if (value !== null && typeof value === 'object') {
    const nested = (value as Record<string, unknown>)[key];
    return typeof nested === 'string' ? redactSecrets(nested) : '';
  }
  return '';
}
