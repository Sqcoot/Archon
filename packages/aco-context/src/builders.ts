import type { EvidenceRef, MutationClass, ParseResult } from '@archon/aco-core';
import {
  buildCommandCatalog,
  commandDescriptorById,
  type AcoCommandCatalog,
  type AcoCommandDescriptor,
  type AcoCommandId,
} from '@archon/aco-cli-contracts';
import { buildGraphWaiverClosure, type GraphWaiverClosure } from '@archon/aco-research';
import {
  CONTEXT_ARTIFACT_EVIDENCE,
  CONTEXT_COMMAND_LEDGER_EVIDENCE,
  CONTEXT_WORKFLOW_PARITY_EVIDENCE,
  REQUIRED_CONTEXT_LEDGER_NAMES,
  S8_CONSENSUS_EVIDENCE,
} from './constants';
import {
  approvalCapsuleSchema,
  approvalCapsuleVerificationSchema,
  compiledContextPackageSchema,
  contextStatusSchema,
} from './schemas';
import type {
  ApprovalCapsule,
  ApprovalCapsuleVerification,
  CompiledContextPackage,
  ContextApprovalRequirement,
  ContextCommandCoverage,
  ContextGraphWaiverSummary,
  ContextLedgerSummary,
  ContextReadiness,
  ContextRouteSummary,
  ContextStatus,
} from './schemas';
import {
  approvalCapsuleChecksum,
  checkApprovalCapsule,
  checkApprovalCapsuleVerification,
  checkCompiledContextPackage,
  checkContextStatus,
  contextPackageDigest,
  stableChecksum,
} from './checks';

export interface ContextBuildInput {
  readonly prompt?: string | null;
  readonly catalog?: AcoCommandCatalog;
  readonly graphWaiver?: GraphWaiverClosure;
  readonly ledgerSummaries?: readonly ContextLedgerSummary[];
}

export interface ApprovalCapsuleInput extends ContextBuildInput {
  readonly contextPackage?: CompiledContextPackage;
  readonly requestedCommandId?: AcoCommandId;
  readonly mutationClass?: MutationClass;
  readonly approvalScope?: readonly MutationClass[];
}

export interface ApprovalCapsuleVerifyInput {
  readonly capsule: unknown;
  readonly expectedContext?: CompiledContextPackage;
  readonly expectedPrompt?: string;
}

export function buildContextStatus(input: ContextBuildInput = {}): ParseResult<ContextStatus> {
  const catalog = input.catalog ?? defaultCommandCatalog();
  const graphWaiver = input.graphWaiver ?? defaultGraphWaiverClosure();
  const requiredLedgers = input.ledgerSummaries ?? defaultLedgerSummaries();
  const prompt = normalizeOptionalPrompt(input.prompt);
  const deferredSurfaces = deferredSurfaceDisplays(catalog);
  const findings = contextFindings(requiredLedgers, graphWaiver, deferredSurfaces);
  const status = {
    kind: 'aco-context-status',
    schemaVersion: 'aco.context-status.v1',
    id: 'aco.context.s8.status',
    prompt,
    promptDigest: stableChecksum(prompt ?? 'no-prompt'),
    readiness: readinessFor(requiredLedgers, graphWaiver, deferredSurfaces),
    requiredLedgers,
    commandCoverage: commandCoverage(catalog),
    graphWaiver: graphWaiverSummary(graphWaiver),
    approvalReadiness: approvalRequirements(catalog),
    deferredSurfaces,
    nextSlice: 'S10 API/UI parity after workflow contracts are committed',
    findings,
    evidence: [
      CONTEXT_COMMAND_LEDGER_EVIDENCE,
      CONTEXT_WORKFLOW_PARITY_EVIDENCE,
      S8_CONSENSUS_EVIDENCE,
    ],
  } as const;

  const parsed = contextStatusSchema.safeParse(status);
  if (!parsed.success)
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  const issues = checkContextStatus(parsed.data);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: parsed.data };
}

export function compileContextPackage(
  input: ContextBuildInput = {}
): ParseResult<CompiledContextPackage> {
  const prompt = normalizeRequiredPrompt(input.prompt);
  if (!prompt.ok) return prompt;

  const status = buildContextStatus({ ...input, prompt: prompt.value });
  if (!status.ok) return status;

  const route = routeFor('archon.context.compile');
  const contextWithoutDigest = {
    kind: 'aco-context-package',
    schemaVersion: 'aco.context-package.v1',
    id: 'aco.context.s8.context-package',
    prompt: prompt.value,
    promptDigest: status.value.promptDigest,
    selectedRoute: route,
    statusReadiness: status.value.readiness,
    statusFindings: status.value.findings,
    ledgerSummaries: status.value.requiredLedgers,
    evidenceRefs: contextEvidenceRefs(status.value),
    graphWaiver: status.value.graphWaiver,
    roleConstraints: [
      'generators cannot claim goal completion',
      'evaluator verdicts are required for completion claims',
      'workflow completion claims require S9 workflow contract evidence',
    ],
    capabilityConstraints: [
      'research graph refresh requires explicit approval',
      'artifact persistence is not implemented in S8',
      'provider/runtime behavior is outside the context package',
    ],
    approvalRequirements: status.value.approvalReadiness,
    deferredItems: [
      'bun run aco:role-contracts remains deferred',
      'bun run research:graph remains approval-required',
    ],
    evidence: [
      CONTEXT_COMMAND_LEDGER_EVIDENCE,
      CONTEXT_ARTIFACT_EVIDENCE,
      CONTEXT_WORKFLOW_PARITY_EVIDENCE,
      S8_CONSENSUS_EVIDENCE,
    ],
  } as const;

  const context = {
    ...contextWithoutDigest,
    contextDigest: contextPackageDigest(contextWithoutDigest),
  } as const;

  const parsed = compiledContextPackageSchema.safeParse(context);
  if (!parsed.success)
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  const issues = checkCompiledContextPackage(parsed.data);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: parsed.data };
}

export function buildApprovalCapsule(
  input: ApprovalCapsuleInput = {}
): ParseResult<ApprovalCapsule> {
  const context =
    input.contextPackage !== undefined
      ? { ok: true as const, value: input.contextPackage }
      : compileContextPackage(input);
  if (!context.ok) return context;

  const requestedCommand = descriptorFor(input.requestedCommandId ?? 'archon.context.compile');
  const mutationClass = input.mutationClass ?? 'writes-artifacts';
  const approvalScope = input.approvalScope ?? [mutationClass];
  const capsuleWithoutChecksum = {
    kind: 'aco-approval-capsule',
    schemaVersion: 'aco.approval-capsule.v1',
    id: `aco.context.s8.approval-capsule.${requestedCommand.id}`,
    promptDigest: context.value.promptDigest,
    contextDigest: context.value.contextDigest,
    requestedCommand: {
      id: requestedCommand.id,
      display: requestedCommand.display,
    },
    mutationClass,
    approvalScope,
    approvalStatus: 'not-granted',
    evidenceRefs: context.value.evidenceRefs,
    graphRequirements: context.value.graphWaiver,
    roleAuthority: 'approval capsule records requested scope only; it cannot grant approval',
    expiresWhen: 'prompt digest, context digest, command, mutation scope, or evidence refs change',
    invalidatesWhen: [
      'prompt changes',
      'context package digest changes',
      'requested command changes',
      'mutation scope changes',
      'evidence refs change',
    ],
  } as const;

  const capsule = {
    ...capsuleWithoutChecksum,
    checksum: approvalCapsuleChecksum(capsuleWithoutChecksum),
  } as const;

  const parsed = approvalCapsuleSchema.safeParse(capsule);
  if (!parsed.success)
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  const issues = checkApprovalCapsule(parsed.data);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: parsed.data };
}

export function verifyApprovalCapsule(
  input: ApprovalCapsuleVerifyInput
): ParseResult<ApprovalCapsuleVerification> {
  const parsed = approvalCapsuleSchema.safeParse(input.capsule);
  const evidence = [CONTEXT_ARTIFACT_EVIDENCE, S8_CONSENSUS_EVIDENCE];
  if (!parsed.success) {
    return verificationResult({
      capsuleId: 'unknown',
      commandId: 'archon.context.approval-capsule',
      promptDigest: stableChecksum(input.expectedPrompt ?? 'unknown'),
      contextDigest: input.expectedContext?.contextDigest ?? stableChecksum('unknown-context'),
      issues: parsed.error.issues.map(issue => issue.message),
      evidence,
    });
  }

  const capsule = parsed.data;
  const issues = [...checkApprovalCapsule(capsule)];
  if (input.expectedPrompt !== undefined) {
    const expectedPromptDigest = stableChecksum(input.expectedPrompt);
    if (capsule.promptDigest !== expectedPromptDigest) {
      issues.push('approval capsule prompt digest does not match expected prompt');
    }
  }
  if (
    input.expectedContext !== undefined &&
    capsule.contextDigest !== input.expectedContext.contextDigest
  ) {
    issues.push('approval capsule context digest does not match expected context package');
  }
  if (capsule.approvalStatus !== 'not-granted') {
    issues.push('approval capsule verification cannot grant approval');
  }

  return verificationResult({
    capsuleId: capsule.id,
    commandId: capsule.requestedCommand.id,
    promptDigest: capsule.promptDigest,
    contextDigest: capsule.contextDigest,
    issues,
    evidence,
  });
}

export function defaultLedgerSummaries(): readonly ContextLedgerSummary[] {
  const counts: Record<(typeof REQUIRED_CONTEXT_LEDGER_NAMES)[number], number> = {
    artifact: 12,
    capability: 17,
    command: 12,
    risk: 8,
    tool: 10,
    unknowns: 6,
    workflow: 5,
  };
  return REQUIRED_CONTEXT_LEDGER_NAMES.map(name => ({
    name,
    status: 'present',
    rowCount: counts[name],
    evidence: [CONTEXT_COMMAND_LEDGER_EVIDENCE],
  }));
}

function verificationResult(input: {
  readonly capsuleId: string;
  readonly commandId: AcoCommandId;
  readonly promptDigest: string;
  readonly contextDigest: string;
  readonly issues: readonly string[];
  readonly evidence: readonly EvidenceRef[];
}): ParseResult<ApprovalCapsuleVerification> {
  const verification = {
    kind: 'aco-approval-capsule-verification',
    schemaVersion: 'aco.approval-capsule-verification.v1',
    id: `aco.context.s8.approval-capsule-verification.${input.capsuleId}`,
    status: input.issues.length === 0 ? 'passed' : 'failed',
    capsuleId: input.capsuleId,
    commandId: input.commandId,
    promptDigest: input.promptDigest,
    contextDigest: input.contextDigest,
    issues: [...input.issues].sort(),
    canGrantApproval: false,
    evidence: input.evidence,
  } as const;

  const parsed = approvalCapsuleVerificationSchema.safeParse(verification);
  if (!parsed.success)
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  const issues = checkApprovalCapsuleVerification(parsed.data);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: parsed.data };
}

function defaultCommandCatalog(): AcoCommandCatalog {
  const catalog = buildCommandCatalog();
  if (!catalog.ok) throw new Error(catalog.issues.join('\n'));
  return catalog.value;
}

function defaultGraphWaiverClosure(): GraphWaiverClosure {
  const closure = buildGraphWaiverClosure();
  if (!closure.ok) throw new Error(closure.issues.join('\n'));
  return closure.value;
}

function normalizeOptionalPrompt(prompt: string | null | undefined): string | null {
  const normalized = prompt?.trim() ?? '';
  return normalized.length > 0 ? normalized : null;
}

function normalizeRequiredPrompt(prompt: string | null | undefined): ParseResult<string> {
  const normalized = prompt?.trim() ?? '';
  if (normalized.length === 0) return { ok: false, issues: ['missing required <prompt>'] };
  return { ok: true, value: normalized };
}

function commandCoverage(catalog: AcoCommandCatalog): readonly ContextCommandCoverage[] {
  return catalog.descriptors.map(descriptor => ({
    commandId: descriptor.id,
    display: descriptor.display,
    owner: descriptor.owner,
    implementationStatus: descriptor.implementationStatus,
  }));
}

function graphWaiverSummary(closure: GraphWaiverClosure): ContextGraphWaiverSummary {
  return {
    required: closure.required,
    status: closure.status,
    command: closure.command,
    safetyClass: closure.safetyClass,
    findings: closure.findings,
  };
}

function approvalRequirements(catalog: AcoCommandCatalog): readonly ContextApprovalRequirement[] {
  return catalog.descriptors
    .filter(descriptor => descriptor.approvalRequired || descriptor.id === 'bun.research.graph')
    .map(descriptor => ({
      commandId: descriptor.id,
      display: descriptor.display,
      required: descriptor.approvalRequired,
      mutationScope: descriptor.safetyClasses.filter(mutation => mutation !== 'read-only'),
      reason:
        descriptor.id === 'bun.research.graph'
          ? 'graph refresh remains approval-required and is never triggered implicitly'
          : 'descriptor requires approval before mutation',
    }));
}

function deferredSurfaceDisplays(catalog: AcoCommandCatalog): readonly string[] {
  return catalog.descriptors
    .filter(descriptor => descriptor.implementationStatus !== 'supported')
    .map(descriptor => descriptor.display)
    .sort();
}

function contextFindings(
  ledgers: readonly ContextLedgerSummary[],
  graphWaiver: GraphWaiverClosure,
  deferredSurfaces: readonly string[]
): readonly string[] {
  const findings: string[] = [];
  for (const ledger of ledgers) {
    if (ledger.status !== 'present') findings.push(`${ledger.name} ledger is ${ledger.status}`);
  }
  if (graphWaiver.status === 'approval_required') {
    findings.push('graph waiver closure requires approval before graph refresh');
  }
  if (deferredSurfaces.length > 0) {
    findings.push(`${deferredSurfaces.length} surfaces remain deferred or approval-gated`);
  }
  if (findings.length === 0) return ['context primitives are ready for read-only use'];
  return findings;
}

function readinessFor(
  ledgers: readonly ContextLedgerSummary[],
  graphWaiver: GraphWaiverClosure,
  deferredSurfaces: readonly string[]
): ContextReadiness {
  if (ledgers.some(ledger => ledger.status !== 'present')) return 'blocked';
  if (graphWaiver.status === 'approval_required') return 'approval_required';
  if (deferredSurfaces.length > 0) return 'degraded';
  return 'ready';
}

function routeFor(commandId: AcoCommandId): ContextRouteSummary {
  const descriptor = descriptorFor(commandId);
  return {
    commandId: descriptor.id,
    display: descriptor.display,
    owner: descriptor.owner,
    implementationStatus: descriptor.implementationStatus,
  };
}

function descriptorFor(commandId: AcoCommandId): AcoCommandDescriptor {
  const descriptor = commandDescriptorById(commandId);
  if (descriptor === undefined) throw new Error(`missing descriptor ${commandId}`);
  return descriptor;
}

function contextEvidenceRefs(status: ContextStatus): readonly EvidenceRef[] {
  const refs = new Map<string, EvidenceRef>();
  for (const evidence of status.evidence) refs.set(evidence.id, evidence);
  for (const ledger of status.requiredLedgers) {
    for (const evidence of ledger.evidence) refs.set(evidence.id, evidence);
  }
  refs.set(CONTEXT_ARTIFACT_EVIDENCE.id, CONTEXT_ARTIFACT_EVIDENCE);
  refs.set(CONTEXT_WORKFLOW_PARITY_EVIDENCE.id, CONTEXT_WORKFLOW_PARITY_EVIDENCE);
  refs.set(S8_CONSENSUS_EVIDENCE.id, S8_CONSENSUS_EVIDENCE);
  return [...refs.values()].sort((left, right) => left.id.localeCompare(right.id));
}
