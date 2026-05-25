import type { Gate, GateRunResult } from '@archon/aco-core';
import { buildWorkflowParityBundle } from './builders';
import { S9_CONSENSUS_EVIDENCE } from './constants';
import type { WorkflowParityBundle } from './schemas';

export interface AcoWorkflowsFixtureResult {
  readonly gate: 'aco-workflows-fixture-gate';
  readonly bundle: WorkflowParityBundle;
}

export const acoWorkflowsFixtureGate: Gate<undefined, AcoWorkflowsFixtureResult> = {
  kind: 'gate',
  id: 'aco-workflows-fixture-gate',
  mutates: 'read-only',
  run(): Promise<GateRunResult<AcoWorkflowsFixtureResult>> {
    const evidence = [S9_CONSENSUS_EVIDENCE];
    const bundle = buildWorkflowParityBundle();
    if (!bundle.ok) return Promise.resolve({ status: 'failed', errors: bundle.issues, evidence });

    return Promise.resolve({
      status: 'passed',
      value: {
        gate: 'aco-workflows-fixture-gate',
        bundle: bundle.value,
      },
      evidence,
    });
  },
};
