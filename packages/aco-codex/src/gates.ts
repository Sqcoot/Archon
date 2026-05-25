import type { Gate, GateRunResult } from '@archon/aco-core';
import {
  BOOTSTRAP_CODEX_COMMAND,
  CODEX_RUNTIME_NON_CLAIMS,
  REQUIRED_CODEX_BOOTSTRAP_ARTIFACTS,
  buildCodexBootstrapArtifacts,
} from './builders';
import type {
  BootstrapCodexCommandDescriptor,
  CodexBootstrapArtifactBundle,
  CodexBootstrapArtifactName,
  CodexBootstrapInput,
  CodexCapabilitySummary,
} from './schemas';

export interface CodexBootstrapFixtureParityResult {
  readonly gate: 'codex-bootstrap-fixture-gate';
  readonly artifactNames: readonly CodexBootstrapArtifactName[];
  readonly command: BootstrapCodexCommandDescriptor;
  readonly capabilitySummary: CodexCapabilitySummary;
  readonly bundle: CodexBootstrapArtifactBundle;
}

export const codexBootstrapFixtureGate: Gate<
  CodexBootstrapInput,
  CodexBootstrapFixtureParityResult
> = {
  kind: 'gate',
  id: 'codex-bootstrap-fixture-gate',
  mutates: 'read-only',
  run(input: CodexBootstrapInput): Promise<GateRunResult<CodexBootstrapFixtureParityResult>> {
    const evidence = [
      {
        id: 'evidence.gate.codex-bootstrap-fixture',
        source: 'codex-bootstrap-fixture-gate',
        summary: 'S4 Codex bootstrap fixture gate is pure and read-only',
        confidence: 'high',
        freshness: 'unknown',
      },
    ] as const;

    const bundle = buildCodexBootstrapArtifacts(input);
    if (!bundle.ok) {
      return Promise.resolve({ status: 'failed', errors: bundle.issues, evidence });
    }

    const errors = validateBundle(input, bundle.value);
    if (errors.length > 0) {
      return Promise.resolve({ status: 'failed', errors, evidence });
    }

    const reportArtifact = bundle.value.artifacts.find(
      artifact => artifact.name === 'codex-harness-capability-report.json'
    );
    const capabilitySummary = readCapabilitySummary(reportArtifact?.content ?? '');

    return Promise.resolve({
      status: 'passed',
      value: {
        gate: 'codex-bootstrap-fixture-gate',
        artifactNames: bundle.value.artifacts.map(artifact => artifact.name),
        command: bundle.value.command,
        capabilitySummary,
        bundle: bundle.value,
      },
      evidence,
    });
  },
};

function validateBundle(
  input: CodexBootstrapInput,
  bundle: CodexBootstrapArtifactBundle
): readonly string[] {
  const errors: string[] = [];
  const artifactNames = bundle.artifacts.map(artifact => artifact.name);
  const uniqueArtifactNames = new Set(artifactNames);

  if (uniqueArtifactNames.size !== artifactNames.length) {
    errors.push('duplicate Codex bootstrap artifact names are not allowed');
  }
  for (const required of REQUIRED_CODEX_BOOTSTRAP_ARTIFACTS) {
    if (!uniqueArtifactNames.has(required)) {
      errors.push(`missing required Codex bootstrap artifact ${required}`);
    }
  }
  for (const artifact of bundle.artifacts) {
    if (artifact.content.trim().length === 0) {
      errors.push(`${artifact.name} must have non-empty content`);
    }
  }

  if (bundle.command.command !== BOOTSTRAP_CODEX_COMMAND) {
    errors.push('missing preserved bootstrap-codex command descriptor');
  }
  if (bundle.command.owner !== 'aco-codex') {
    errors.push('bootstrap-codex command owner must be aco-codex');
  }
  if (bundle.command.defaultMutates !== 'read-only') {
    errors.push('bootstrap-codex command default mode must be read-only');
  }
  if (bundle.command.writeArtifactMutates !== 'writes-artifacts') {
    errors.push('bootstrap-codex write mode must be artifact-only');
  }
  if (bundle.command.compatibility !== 'preserve') {
    errors.push('bootstrap-codex command compatibility must be preserve');
  }

  const reportContent = bundle.artifacts.find(
    artifact => artifact.name === 'codex-harness-capability-report.json'
  )?.content;
  if (reportContent === undefined) {
    errors.push('missing Codex harness capability report artifact');
  }

  const snapshotContent = bundle.artifacts.find(
    artifact => artifact.name === 'capability-snapshot.json'
  )?.content;
  if (snapshotContent === undefined) {
    errors.push('missing Codex capability snapshot artifact');
  } else {
    errors.push(...validateNonClaims(snapshotContent));
  }

  const rebuilt = buildCodexBootstrapArtifacts(input);
  if (!rebuilt.ok) {
    errors.push(...rebuilt.issues);
  } else if (JSON.stringify(rebuilt.value.artifacts) !== JSON.stringify(bundle.artifacts)) {
    errors.push('Codex bootstrap artifact rendering must be deterministic');
  }

  return errors;
}

function validateNonClaims(snapshotContent: string): readonly string[] {
  const snapshot = parseJsonRecord(snapshotContent);
  if (snapshot === undefined) return ['Codex capability snapshot must be valid JSON'];
  const nonClaims = snapshot.nonClaims;
  if (!Array.isArray(nonClaims)) return ['Codex capability snapshot must include nonClaims'];

  const errors: string[] = [];
  for (const nonClaim of CODEX_RUNTIME_NON_CLAIMS) {
    if (!nonClaims.includes(nonClaim)) {
      errors.push(`missing explicit non-claim ${nonClaim}`);
    }
  }

  return errors;
}

function readCapabilitySummary(content: string): CodexCapabilitySummary {
  const report = parseJsonRecord(content);
  const summary = isRecord(report?.summary) ? report.summary : {};
  return {
    supported: readCount(summary.supported),
    partial: readCount(summary.partial),
    unsupported: readCount(summary.unsupported),
    unknown: readCount(summary.unknown),
    deferred_by_design: readCount(summary.deferred_by_design),
  };
}

function readCount(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}

function parseJsonRecord(content: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(content);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
