import type { MutationClass } from '@archon/aco-core';
import {
  REQUIRED_CONTEXT_COMMAND_IDS,
  REQUIRED_CONTEXT_LEDGER_NAMES,
  S8_CONSENSUS_EVIDENCE,
} from './constants';
import {
  approvalCapsuleSchema,
  approvalCapsuleVerificationSchema,
  compiledContextPackageSchema,
  contextStatusSchema,
} from './schemas';

interface ApprovalCapsuleChecksumInput {
  readonly schemaVersion: string;
  readonly id: string;
  readonly promptDigest: string;
  readonly contextDigest: string;
  readonly requestedCommand: {
    readonly id: string;
  };
  readonly mutationClass: MutationClass;
  readonly approvalScope: readonly MutationClass[];
  readonly approvalStatus: string;
  readonly graphRequirements: {
    readonly status: string;
  };
  readonly roleAuthority: string;
  readonly expiresWhen: string;
  readonly invalidatesWhen: readonly string[];
  readonly evidenceRefs: readonly { readonly id: string }[];
}

interface ContextPackageDigestInput {
  readonly schemaVersion: string;
  readonly id: string;
  readonly promptDigest: string;
  readonly selectedRoute: {
    readonly commandId: string;
  };
  readonly graphWaiver: {
    readonly status: string;
  };
  readonly ledgerSummaries: readonly {
    readonly name: string;
    readonly rowCount: number;
  }[];
  readonly deferredItems: readonly string[];
}

export function checkContextStatus(input: unknown): readonly string[] {
  const parsed = contextStatusSchema.safeParse(input);
  if (!parsed.success) return parsed.error.issues.map(issue => issue.message);

  const status = parsed.data;
  const errors: string[] = [];
  const ledgers = new Set(status.requiredLedgers.map(ledger => ledger.name));
  for (const required of REQUIRED_CONTEXT_LEDGER_NAMES) {
    if (!ledgers.has(required)) errors.push(`missing required ledger summary ${required}`);
  }

  for (const ledger of status.requiredLedgers) {
    if (ledger.status !== 'present') {
      errors.push(`ledger ${ledger.name} status is ${ledger.status}`);
    }
  }

  const commands = new Set(status.commandCoverage.map(command => command.commandId));
  for (const required of REQUIRED_CONTEXT_COMMAND_IDS) {
    if (!commands.has(required)) errors.push(`missing context command coverage ${required}`);
  }

  if (status.readiness === 'ready' && status.deferredSurfaces.length > 0) {
    errors.push('ready status must not include deferred surfaces');
  }

  return errors;
}

export function checkCompiledContextPackage(input: unknown): readonly string[] {
  const parsed = compiledContextPackageSchema.safeParse(input);
  if (!parsed.success) return parsed.error.issues.map(issue => issue.message);

  const context = parsed.data;
  const errors: string[] = [];

  if (context.statusReadiness === 'ready' && context.deferredItems.length > 0) {
    errors.push('ready context package must not include deferred items');
  }
  if (context.statusFindings.length === 0) {
    errors.push('context package must carry status findings');
  }
  if (!context.deferredItems.includes('workflow parity deferred to the next slice')) {
    errors.push('context package must keep workflow parity explicitly deferred');
  }

  return errors;
}

export function checkApprovalCapsule(input: unknown): readonly string[] {
  const parsed = approvalCapsuleSchema.safeParse(input);
  if (!parsed.success) return parsed.error.issues.map(issue => issue.message);

  const capsule = parsed.data;
  const errors: string[] = [];
  if (capsule.approvalStatus !== 'not-granted') {
    errors.push('approval capsule must not grant approval');
  }
  if (!capsule.approvalScope.includes(capsule.mutationClass)) {
    errors.push('approval scope must include requested mutation class');
  }
  if (capsule.checksum !== approvalCapsuleChecksum(capsule)) {
    errors.push('approval capsule checksum mismatch');
  }
  if (capsule.expiresWhen.length === 0 || capsule.invalidatesWhen.length === 0) {
    errors.push('approval capsule must describe expiry and invalidation conditions');
  }

  return errors;
}

export function checkApprovalCapsuleVerification(input: unknown): readonly string[] {
  const parsed = approvalCapsuleVerificationSchema.safeParse(input);
  if (!parsed.success) return parsed.error.issues.map(issue => issue.message);

  const verification = parsed.data;
  if (verification.status === 'passed' && verification.issues.length > 0) {
    return ['passed verification must not include issues'];
  }
  if (verification.status === 'failed' && verification.issues.length === 0) {
    return ['failed verification must include issues'];
  }
  return [];
}

export function approvalCapsuleChecksum(capsule: ApprovalCapsuleChecksumInput): string {
  return stableChecksum(
    [
      capsule.schemaVersion,
      capsule.id,
      capsule.promptDigest,
      capsule.contextDigest,
      capsule.requestedCommand.id,
      capsule.mutationClass,
      [...capsule.approvalScope].sort().join(','),
      capsule.approvalStatus,
      capsule.graphRequirements.status,
      capsule.roleAuthority,
      capsule.expiresWhen,
      [...capsule.invalidatesWhen].sort().join(','),
      capsule.evidenceRefs
        .map(evidence => evidence.id)
        .sort()
        .join(','),
    ].join('|')
  );
}

export function stableChecksum(seedValue: string): string {
  let hex = '';
  for (let index = 0; index < seedValue.length; index += 1) {
    hex += seedValue.charCodeAt(index).toString(16).padStart(2, '0');
  }
  return `${hex}${'0'.repeat(64)}`.slice(0, 64);
}

export function mutationLabel(values: readonly MutationClass[]): string {
  return [...values].sort().join(', ');
}

export function contextPackageDigest(context: ContextPackageDigestInput): string {
  return stableChecksum(
    [
      context.schemaVersion,
      context.id,
      context.promptDigest,
      context.selectedRoute.commandId,
      context.graphWaiver.status,
      context.ledgerSummaries.map(ledger => `${ledger.name}:${ledger.rowCount}`).join(','),
      context.deferredItems.join(','),
    ].join('|')
  );
}

export function verificationEvidence(): readonly [typeof S8_CONSENSUS_EVIDENCE] {
  return [S8_CONSENSUS_EVIDENCE];
}
