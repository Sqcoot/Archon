import type { Gate, GateRunResult } from '@archon/aco-core';
import { REQUIRED_RESEARCH_ARTIFACTS } from './constants';
import { buildResearchArtifacts } from './builders';
import {
  checkAgenticSearchReport,
  checkGraphEvidenceRef,
  checkGraphWaiverClosure,
  checkResearchArtifactBundle,
  checkResearchArtifactMetadata,
  checkUpstreamGraphManifest,
  findGraphEvidenceRef,
  findResearchArtifactMetadata,
} from './checks';
import { researchGraphEvidenceStatusValues } from './schemas';
import type {
  ResearchArtifactBundle,
  ResearchArtifactName,
  ResearchGraphEvidenceStatus,
} from './schemas';

export interface ResearchFixtureParityResult {
  readonly gate: 'aco-research-fixture-gate';
  readonly artifactNames: readonly ResearchArtifactName[];
  readonly graphStatuses: readonly ResearchGraphEvidenceStatus[];
  readonly repositories: readonly string[];
  readonly bundle: ResearchArtifactBundle;
}

export const acoResearchFixtureGate: Gate<
  ResearchArtifactBundle | undefined,
  ResearchFixtureParityResult
> = {
  kind: 'gate',
  id: 'aco-research-fixture-gate',
  mutates: 'read-only',
  run(
    input: ResearchArtifactBundle | undefined
  ): Promise<GateRunResult<ResearchFixtureParityResult>> {
    const evidence = [
      {
        id: 'evidence.gate.aco-research-fixture',
        source: 'aco-research-fixture-gate',
        summary: 'S6 Research and Graphify fixture gate is pure and read-only',
        confidence: 'high',
        freshness: 'unknown',
      },
    ] as const;

    const bundle =
      input === undefined ? buildResearchArtifacts() : ({ ok: true, value: input } as const);
    if (!bundle.ok) {
      return Promise.resolve({ status: 'failed', errors: bundle.issues, evidence });
    }

    const errors = [...checkResearchArtifactBundle(bundle.value)];
    if (input === undefined) {
      const secondRender = buildResearchArtifacts();
      if (!secondRender.ok) {
        errors.push(...secondRender.issues);
      } else if (
        JSON.stringify(secondRender.value.artifacts) !== JSON.stringify(bundle.value.artifacts)
      ) {
        errors.push('ACO research artifact rendering must be deterministic');
      }
    }
    if (errors.length > 0) {
      return Promise.resolve({ status: 'failed', errors, evidence });
    }

    return Promise.resolve({
      status: 'passed',
      value: {
        gate: 'aco-research-fixture-gate',
        artifactNames: bundle.value.artifacts.map(artifact => artifact.name),
        graphStatuses: [...researchGraphEvidenceStatusValues],
        repositories: bundle.value.upstreamManifest.repositories.map(ref => ref.repository),
        bundle: bundle.value,
      },
      evidence,
    });
  },
};

export {
  checkAgenticSearchReport,
  checkGraphEvidenceRef,
  checkGraphWaiverClosure,
  checkResearchArtifactBundle,
  checkResearchArtifactMetadata,
  checkUpstreamGraphManifest,
  findGraphEvidenceRef,
  findResearchArtifactMetadata,
  REQUIRED_RESEARCH_ARTIFACTS,
};
