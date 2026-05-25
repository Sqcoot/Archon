import type { Gate, GateRunResult, MutationClass } from '@archon/aco-core';
import { COMMAND_LEDGER_EVIDENCE, S7_CONSENSUS_EVIDENCE, S8_CONSENSUS_EVIDENCE } from './constants';
import type { CommandInvocation } from './router';
import type {
  AcoApproval,
  AcoCommandCatalog,
  AcoCommandDescriptor,
  AcoCommandResultEnvelope,
  JsonValue,
} from './schemas';
import {
  acoCommandResultEnvelopeSchema,
  acoCommandDescriptorSchema,
  acoCommandIdValues,
} from './schemas';
import {
  checkDescriptorCoverage,
  coversMutationApproval,
  hasHighRiskMutation,
  implementationStatusCounts,
  requestedMutationsForDescriptor,
} from './checks';
import { buildCommandCatalog } from './descriptors';

export interface AcoCliContractsFixtureResult {
  readonly gate: 'aco-cli-contracts-fixture-gate';
  readonly descriptorCount: number;
  readonly commandIds: readonly string[];
  readonly statusCounts: Record<string, number>;
  readonly catalog: AcoCommandCatalog;
}

export const acoCliContractsFixtureGate: Gate<
  readonly AcoCommandDescriptor[] | undefined,
  AcoCliContractsFixtureResult
> = {
  kind: 'gate',
  id: 'aco-cli-contracts-fixture-gate',
  mutates: 'read-only',
  run(
    input: readonly AcoCommandDescriptor[] | undefined
  ): Promise<GateRunResult<AcoCliContractsFixtureResult>> {
    const catalog = buildCommandCatalog(input);
    const evidence = [COMMAND_LEDGER_EVIDENCE, S7_CONSENSUS_EVIDENCE, S8_CONSENSUS_EVIDENCE];
    if (!catalog.ok) {
      return Promise.resolve({ status: 'failed', errors: catalog.issues, evidence });
    }

    const errors = checkDescriptorCoverage(catalog.value.descriptors);
    if (errors.length > 0) {
      return Promise.resolve({ status: 'failed', errors, evidence });
    }

    return Promise.resolve({
      status: 'passed',
      value: {
        gate: 'aco-cli-contracts-fixture-gate',
        descriptorCount: catalog.value.descriptors.length,
        commandIds: catalog.value.descriptors.map(descriptor => descriptor.id).sort(),
        statusCounts: implementationStatusCounts(catalog.value.descriptors),
        catalog: catalog.value,
      },
      evidence,
    });
  },
};

export function enforceCommandSafety(
  descriptor: AcoCommandDescriptor,
  invocation: CommandInvocation
): AcoCommandResultEnvelope | null {
  const descriptorIssues = acoCommandDescriptorSchema.safeParse(descriptor);
  if (!descriptorIssues.success || descriptor.safetyClasses.length === 0) {
    return deniedCommandResult(
      descriptor.id,
      descriptor.display,
      'missing safety metadata for ACO command descriptor'
    );
  }

  const requested = requestedMutationsForDescriptor(descriptor, invocation.requestedMutations);
  if (invocation.readonlyContext && hasHighRiskMutation(requested)) {
    return deniedCommandResult(
      descriptor.id,
      descriptor.display,
      `readonly context forbids requested mutations: ${requested.join(', ')}`
    );
  }

  if (hasHighRiskMutation(requested) && !approvalCoversMutations(invocation.approval, requested)) {
    return approvalRequiredCommandResult(descriptor, requested);
  }

  return null;
}

export function okCommandResult(input: {
  readonly descriptor: AcoCommandDescriptor;
  readonly stdout: string;
  readonly data?: Readonly<Record<string, JsonValue>>;
}): AcoCommandResultEnvelope {
  return resultEnvelope({
    commandId: input.descriptor.id,
    display: input.descriptor.display,
    status: 'ok',
    exitCode: 0,
    stdout: input.stdout,
    stderr: '',
    data: input.data ?? {},
    evidence: input.descriptor.evidence,
  });
}

export function deferredCommandResult(
  descriptor: AcoCommandDescriptor,
  reason = 'command behavior is not implemented in S7'
): AcoCommandResultEnvelope {
  return resultEnvelope({
    commandId: descriptor.id,
    display: descriptor.display,
    status: 'deferred',
    exitCode: 3,
    stdout: '',
    stderr: `Not implemented in S7: ${descriptor.display}. ${reason}.`,
    data: { implementationStatus: descriptor.implementationStatus, reason },
    evidence: descriptor.evidence,
  });
}

export function unsupportedCommandResult(command: string): AcoCommandResultEnvelope {
  return resultEnvelope({
    commandId: command,
    display: command,
    status: 'unsupported',
    exitCode: 1,
    stdout: '',
    stderr: `Unsupported ACO command: ${command}.`,
    data: { reason: 'command is not present in the S7 descriptor catalog' },
    evidence: [COMMAND_LEDGER_EVIDENCE],
  });
}

export function deniedCommandResult(
  commandId: string,
  display: string,
  reason: string
): AcoCommandResultEnvelope {
  return resultEnvelope({
    commandId,
    display,
    status: 'denied',
    exitCode: 2,
    stdout: '',
    stderr: `Denied ACO command: ${display}. ${reason}.`,
    data: { reason },
    evidence: [COMMAND_LEDGER_EVIDENCE, S7_CONSENSUS_EVIDENCE, S8_CONSENSUS_EVIDENCE],
  });
}

export function approvalRequiredCommandResult(
  descriptor: AcoCommandDescriptor,
  requested: readonly MutationClass[]
): AcoCommandResultEnvelope {
  return resultEnvelope({
    commandId: descriptor.id,
    display: descriptor.display,
    status: 'approval_required',
    exitCode: 2,
    stdout: '',
    stderr: `Approval required for ${descriptor.display}: ${requested.join(', ')}.`,
    data: {
      requestedMutations: requested,
      reason: 'write, network, graph-cache, or artifact mutation risk requires approval',
    },
    evidence: descriptor.evidence,
  });
}

export function resultEnvelope(
  input: Omit<AcoCommandResultEnvelope, 'kind' | 'schemaVersion'>
): AcoCommandResultEnvelope {
  return acoCommandResultEnvelopeSchema.parse({
    kind: 'aco-cli-command-result',
    schemaVersion: 'aco.cli-command-result.v1',
    ...input,
  });
}

export function commandIdKnown(commandId: string): boolean {
  return acoCommandIdValues.some(value => value === commandId);
}

function approvalCoversMutations(
  approval: AcoApproval | null | undefined,
  requested: readonly MutationClass[]
): boolean {
  if (approval?.status !== 'approved') return false;
  return coversMutationApproval(requested, approval.scope);
}
