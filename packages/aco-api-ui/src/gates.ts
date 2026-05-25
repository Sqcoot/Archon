import type { Gate, GateRunResult } from '@archon/aco-core';
import { buildApiUiParityBundle } from './builders';
import { S10_CONSENSUS_EVIDENCE } from './constants';
import type { ApiUiParityBundle } from './schemas';

export interface AcoApiUiFixtureResult {
  readonly gate: 'aco-api-ui-fixture-gate';
  readonly bundle: ApiUiParityBundle;
}

export const acoApiUiFixtureGate: Gate<undefined, AcoApiUiFixtureResult> = {
  kind: 'gate',
  id: 'aco-api-ui-fixture-gate',
  mutates: 'read-only',
  run(): Promise<GateRunResult<AcoApiUiFixtureResult>> {
    const evidence = [S10_CONSENSUS_EVIDENCE];
    const bundle = buildApiUiParityBundle();
    if (!bundle.ok) return Promise.resolve({ status: 'failed', errors: bundle.issues, evidence });

    return Promise.resolve({
      status: 'passed',
      value: {
        gate: 'aco-api-ui-fixture-gate',
        bundle: bundle.value,
      },
      evidence,
    });
  },
};
