import { createHash } from 'crypto';
import { z } from '@hono/zod-openapi';
import { redactSecrets } from '../security';
import type {
  BmadRoute,
  ContextIntent,
  ContextOrchestratorReadiness,
  EvidenceClosurePlan,
  GraphContext,
  LedgerBundle,
  LedgerBundleSummary,
  ValidationReport,
} from '../types';

export const ACO_APPROVAL_CONTRACT_SCHEMA_VERSION = 'aco.approval-contract.v1' as const;
export const ACO_APPROVAL_CONTRACT_VERIFICATION_SCHEMA_VERSION =
  'aco.approval-contract-verification.v1' as const;

const contractIdPrefixLength = 16;

export const acoApprovalScopeSchema = z.object({
  type: z.literal('workflow-handoff'),
  allowedActions: z.array(z.literal('preserve-current-graph-waivers')).min(1),
  summary: z.literal('Approval preserves listed graph waivers for this run only.'),
});

export const acoApprovalContractV1Schema = z.object({
  schemaVersion: z.literal(ACO_APPROVAL_CONTRACT_SCHEMA_VERSION),
  contractId: z.string().min(1),
  contractHash: z.string().regex(/^[a-f0-9]{64}$/),
  actionId: z.string().min(1),
  intentHash: z.string().min(1),
  commitSha: z.string().min(1),
  routeId: z.enum(['brownfield-architecture', 'quick-contained', 'correct-course', 'unknown-help']),
  readiness: z.literal('needs_approval'),
  graphStatus: z.literal('forbidden'),
  requiredWaiverIds: z.array(z.string().min(1)),
  evidenceResolutionIds: z.array(z.string().min(1)),
  ledgerFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  validationStatus: z.enum(['passed', 'warning', 'failed']),
  willRun: z.literal(false),
  approvalScope: acoApprovalScopeSchema,
});

export const acoApprovalContractMismatchSchema = z.object({
  field: z.string().min(1),
  reason: z.string().min(1),
  expected: z.string().optional(),
  actual: z.string().optional(),
});

export const acoApprovalContractVerificationSchema = z.object({
  schemaVersion: z.literal(ACO_APPROVAL_CONTRACT_VERIFICATION_SCHEMA_VERSION),
  status: z.enum(['valid', 'invalid']),
  contractId: z.string(),
  contractHash: z.string(),
  mismatches: z.array(acoApprovalContractMismatchSchema),
  nextAction: z.string().min(1),
  willRun: z.literal(false),
});

export type AcoApprovalScope = z.infer<typeof acoApprovalScopeSchema>;
export type AcoApprovalContractV1 = z.infer<typeof acoApprovalContractV1Schema>;
export type AcoApprovalContractMismatch = z.infer<typeof acoApprovalContractMismatchSchema>;
export type AcoApprovalContractVerification = z.infer<typeof acoApprovalContractVerificationSchema>;

export interface BuildAcoApprovalContractInput {
  actionId: string;
  contextIntent: ContextIntent;
  route: BmadRoute;
  readiness: ContextOrchestratorReadiness;
  graphContext: GraphContext;
  evidenceResolution: EvidenceClosurePlan;
  ledgerFingerprint: string;
  validationReport: ValidationReport;
}

export function buildAcoApprovalContract(
  input: BuildAcoApprovalContractInput
): AcoApprovalContractV1 {
  const requiredWaiverIds = sortedRedacted(input.graphContext.waivers.map(waiver => waiver.id));
  const evidenceResolutionIds = sortedRedacted(
    input.evidenceResolution.items
      .filter(
        item =>
          item.targetKind === 'graph' &&
          item.resolver === 'approval' &&
          item.requiresApproval &&
          requiredWaiverIds.includes(item.evidenceId)
      )
      .map(item => item.evidenceId)
  );
  const contractBase = {
    schemaVersion: ACO_APPROVAL_CONTRACT_SCHEMA_VERSION,
    actionId: redactSecrets(input.actionId),
    intentHash: redactSecrets(input.contextIntent.intentHash),
    commitSha: redactSecrets(input.contextIntent.commitSha),
    routeId: input.route.id,
    readiness: input.readiness,
    graphStatus: input.graphContext.status,
    requiredWaiverIds,
    evidenceResolutionIds,
    ledgerFingerprint: redactSecrets(input.ledgerFingerprint),
    validationStatus: input.validationReport.status,
    willRun: false,
    approvalScope: defaultApprovalScope(),
  };
  const contractHash = sha256(canonicalJson(contractBase));
  const contractId = `${ACO_APPROVAL_CONTRACT_SCHEMA_VERSION}:${contractHash.slice(
    0,
    contractIdPrefixLength
  )}`;

  return acoApprovalContractV1Schema.parse({
    ...contractBase,
    contractId,
    contractHash,
  });
}

export function createLedgerFingerprint(input: LedgerBundle | LedgerBundleSummary): string {
  if (isLedgerBundle(input)) {
    return sha256(
      canonicalJson({
        schemaVersion: 'aco.ledger-fingerprint.v1',
        summary: input.summary,
        toolAvailability: input.toolAvailability.map(entry => ({
          id: entry.id,
          status: entry.status,
          freshness: entry.freshness,
          confidence: entry.confidence,
          verificationMethod: entry.verificationMethod,
        })),
        commands: input.commands.map(entry => ({
          id: entry.id,
          status: entry.status,
          freshness: entry.freshness,
          confidence: entry.confidence,
          verificationMethod: entry.verificationMethod,
          safety: entry.safety,
          mutatesTrackedFiles: entry.mutatesTrackedFiles,
          requiresApproval: entry.requiresApproval,
        })),
      })
    );
  }

  return sha256(
    canonicalJson({
      schemaVersion: 'aco.ledger-fingerprint.v1',
      summary: input,
    })
  );
}

function isLedgerBundle(input: LedgerBundle | LedgerBundleSummary): input is LedgerBundle {
  return (
    Array.isArray((input as { toolAvailability?: unknown }).toolAvailability) &&
    Array.isArray((input as { commands?: unknown }).commands)
  );
}

export function verifyAcoApprovalContract(value: unknown): AcoApprovalContractVerification {
  const parsed = acoApprovalContractV1Schema.safeParse(value);
  if (!parsed.success) {
    return makeVerification({
      contractId: getRecordString(value, 'contractId'),
      contractHash: getRecordString(value, 'contractHash'),
      mismatches: [
        {
          field: 'approvalContract',
          reason: 'Approval contract is malformed or missing required fields.',
        },
      ],
    });
  }

  const contract = parsed.data;
  const expectedHash = sha256(canonicalJson(omitContractIdentity(contract)));
  const expectedId = `${ACO_APPROVAL_CONTRACT_SCHEMA_VERSION}:${expectedHash.slice(
    0,
    contractIdPrefixLength
  )}`;
  const mismatches: AcoApprovalContractMismatch[] = [];

  if (contract.contractHash !== expectedHash) {
    mismatches.push({
      field: 'contractHash',
      reason: 'Contract hash does not match canonical contract contents.',
      expected: expectedHash,
      actual: contract.contractHash,
    });
  }
  if (contract.contractId !== expectedId) {
    mismatches.push({
      field: 'contractId',
      reason: 'Contract ID does not match contract hash prefix.',
      expected: expectedId,
      actual: contract.contractId,
    });
  }

  return makeVerification({
    contractId: contract.contractId,
    contractHash: contract.contractHash,
    mismatches,
  });
}

export function compareApprovalContracts(
  expected: AcoApprovalContractV1,
  actual: AcoApprovalContractV1,
  fieldPrefix = 'approvalContract'
): AcoApprovalContractMismatch[] {
  const mismatches: AcoApprovalContractMismatch[] = [];
  for (const key of Object.keys(expected).sort() as (keyof AcoApprovalContractV1)[]) {
    const expectedValue = canonicalJson(expected[key]);
    const actualValue = canonicalJson(actual[key]);
    if (expectedValue !== actualValue) {
      mismatches.push({
        field: `${fieldPrefix}.${key}`,
        reason: 'Stored approval contract field differs from current evidence.',
        expected: expectedValue,
        actual: actualValue,
      });
    }
  }
  return mismatches;
}

export function approvalContractFromPayload(value: unknown): AcoApprovalContractV1 | null {
  const parsed = acoApprovalContractV1Schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function omitContractIdentity(
  contract: AcoApprovalContractV1
): Omit<AcoApprovalContractV1, 'contractId' | 'contractHash'> {
  return {
    schemaVersion: contract.schemaVersion,
    actionId: contract.actionId,
    intentHash: contract.intentHash,
    commitSha: contract.commitSha,
    routeId: contract.routeId,
    readiness: contract.readiness,
    graphStatus: contract.graphStatus,
    requiredWaiverIds: contract.requiredWaiverIds,
    evidenceResolutionIds: contract.evidenceResolutionIds,
    ledgerFingerprint: contract.ledgerFingerprint,
    validationStatus: contract.validationStatus,
    willRun: contract.willRun,
    approvalScope: contract.approvalScope,
  };
}

function defaultApprovalScope(): AcoApprovalScope {
  return {
    type: 'workflow-handoff',
    allowedActions: ['preserve-current-graph-waivers'],
    summary: 'Approval preserves listed graph waivers for this run only.',
  };
}

function sortedRedacted(values: string[]): string[] {
  return [...new Set(values.map(redactSecrets).filter(value => value.length > 0))].sort(
    (left, right) => left.localeCompare(right)
  );
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const nested = (value as Record<string, unknown>)[key];
      if (nested !== undefined) {
        output[key] = canonicalize(nested);
      }
    }
    return output;
  }
  if (typeof value === 'string') {
    return redactSecrets(value);
  }
  return value;
}

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function makeVerification(input: {
  contractId: string;
  contractHash: string;
  mismatches: AcoApprovalContractMismatch[];
}): AcoApprovalContractVerification {
  return acoApprovalContractVerificationSchema.parse({
    schemaVersion: ACO_APPROVAL_CONTRACT_VERIFICATION_SCHEMA_VERSION,
    status: input.mismatches.length === 0 ? 'valid' : 'invalid',
    contractId: input.contractId,
    contractHash: input.contractHash,
    mismatches: input.mismatches.map(mismatch => ({
      field: redactSecrets(mismatch.field),
      reason: redactSecrets(mismatch.reason),
      ...(mismatch.expected !== undefined ? { expected: redactSecrets(mismatch.expected) } : {}),
      ...(mismatch.actual !== undefined ? { actual: redactSecrets(mismatch.actual) } : {}),
    })),
    nextAction:
      input.mismatches.length === 0
        ? 'Approval contract is valid for the current ACO evidence.'
        : 'Regenerate the ACO approval capsule for the current evidence before approving handoff.',
    willRun: false,
  });
}

function getRecordString(value: unknown, key: string): string {
  if (value !== null && typeof value === 'object') {
    const nested = (value as Record<string, unknown>)[key];
    return typeof nested === 'string' ? redactSecrets(nested) : '';
  }
  return '';
}
