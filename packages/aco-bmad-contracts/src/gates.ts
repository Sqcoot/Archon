import type { Gate, GateRunResult } from '@archon/aco-core';
import { buildBmadContractArtifacts } from './builders';
import {
  checkAdversarialReview,
  checkBmadContractArtifactBundle,
  checkEvaluatorVerdict,
  checkRoleContract,
  checkRoleRegistry,
  checkRouterPacket,
  findRole,
} from './checks';
import { bmadEscalationReasonValues } from './schemas';
import type {
  BmadContractArtifactBundle,
  BmadContractArtifactName,
  BmadEscalationReason,
} from './schemas';

export interface BmadRoleContractFixtureParityResult {
  readonly gate: 'bmad-role-contract-fixture-gate';
  readonly artifactNames: readonly BmadContractArtifactName[];
  readonly roleIds: readonly string[];
  readonly escalationReasons: readonly BmadEscalationReason[];
  readonly bundle: BmadContractArtifactBundle;
}

export const bmadRoleContractFixtureGate: Gate<
  BmadContractArtifactBundle | undefined,
  BmadRoleContractFixtureParityResult
> = {
  kind: 'gate',
  id: 'bmad-role-contract-fixture-gate',
  mutates: 'read-only',
  run(
    input: BmadContractArtifactBundle | undefined
  ): Promise<GateRunResult<BmadRoleContractFixtureParityResult>> {
    const evidence = [
      {
        id: 'evidence.gate.bmad-role-contract-fixture',
        source: 'bmad-role-contract-fixture-gate',
        summary: 'S5 BMAD role contract fixture gate is pure and read-only',
        confidence: 'high',
        freshness: 'unknown',
      },
    ] as const;

    const bundle =
      input === undefined ? buildBmadContractArtifacts() : ({ ok: true, value: input } as const);
    if (!bundle.ok) {
      return Promise.resolve({ status: 'failed', errors: bundle.issues, evidence });
    }

    const errors = [...checkBmadContractArtifactBundle(bundle.value)];
    if (input === undefined) {
      const secondRender = buildBmadContractArtifacts();
      if (!secondRender.ok) {
        errors.push(...secondRender.issues);
      } else if (
        JSON.stringify(secondRender.value.artifacts) !== JSON.stringify(bundle.value.artifacts)
      ) {
        errors.push('BMAD contract artifact rendering must be deterministic');
      }
    }
    if (errors.length > 0) {
      return Promise.resolve({ status: 'failed', errors, evidence });
    }

    return Promise.resolve({
      status: 'passed',
      value: {
        gate: 'bmad-role-contract-fixture-gate',
        artifactNames: bundle.value.artifacts.map(artifact => artifact.name),
        roleIds: bundle.value.roleRegistry.roles.map(role => role.id),
        escalationReasons: [...bmadEscalationReasonValues],
        bundle: bundle.value,
      },
      evidence,
    });
  },
};

export {
  checkAdversarialReview,
  checkBmadContractArtifactBundle,
  checkEvaluatorVerdict,
  checkRoleContract,
  checkRoleRegistry,
  checkRouterPacket,
  findRole,
};
