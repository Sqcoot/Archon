import type { Gate, GateRunResult } from '@archon/aco-core';
import {
  buildApprovalCapsule,
  buildContextStatus,
  compileContextPackage,
  verifyApprovalCapsule,
} from './builders';
import { S8_CONSENSUS_EVIDENCE } from './constants';
import type {
  ApprovalCapsule,
  ApprovalCapsuleVerification,
  CompiledContextPackage,
  ContextStatus,
} from './schemas';

export interface AcoContextFixtureResult {
  readonly gate: 'aco-context-fixture-gate';
  readonly status: ContextStatus;
  readonly contextPackage: CompiledContextPackage;
  readonly approvalCapsule: ApprovalCapsule;
  readonly verification: ApprovalCapsuleVerification;
}

export const acoContextFixtureGate: Gate<string | undefined, AcoContextFixtureResult> = {
  kind: 'gate',
  id: 'aco-context-fixture-gate',
  mutates: 'read-only',
  run(input: string | undefined): Promise<GateRunResult<AcoContextFixtureResult>> {
    const prompt = input ?? 'Implement S8 context contracts';
    const evidence = [S8_CONSENSUS_EVIDENCE];
    const status = buildContextStatus({ prompt });
    if (!status.ok) return Promise.resolve({ status: 'failed', errors: status.issues, evidence });

    const contextPackage = compileContextPackage({ prompt });
    if (!contextPackage.ok) {
      return Promise.resolve({ status: 'failed', errors: contextPackage.issues, evidence });
    }

    const approvalCapsule = buildApprovalCapsule({ contextPackage: contextPackage.value });
    if (!approvalCapsule.ok) {
      return Promise.resolve({ status: 'failed', errors: approvalCapsule.issues, evidence });
    }

    const verification = verifyApprovalCapsule({
      capsule: approvalCapsule.value,
      expectedContext: contextPackage.value,
      expectedPrompt: prompt,
    });
    if (!verification.ok) {
      return Promise.resolve({ status: 'failed', errors: verification.issues, evidence });
    }
    if (verification.value.status !== 'passed') {
      return Promise.resolve({ status: 'failed', errors: verification.value.issues, evidence });
    }

    return Promise.resolve({
      status: 'passed',
      value: {
        gate: 'aco-context-fixture-gate',
        status: status.value,
        contextPackage: contextPackage.value,
        approvalCapsule: approvalCapsule.value,
        verification: verification.value,
      },
      evidence,
    });
  },
};
