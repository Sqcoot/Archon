import { describe, expect, it } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { spawnSync } from 'child_process';
import { BUNDLED_WORKFLOWS } from './bundled-defaults';

function getVerifyRequiredArtifactsScript(): string {
  const workflowSource = BUNDLED_WORKFLOWS['archon-self-improve'];
  if (!workflowSource) {
    throw new Error('Missing bundled archon-self-improve workflow');
  }

  const marker = '\n  - id: verify-required-artifacts\n    bash: |\n';
  const markerIndex = workflowSource.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error('verify-required-artifacts bash node marker missing from bundled workflow');
  }

  const afterMarker = workflowSource.slice(markerIndex + marker.length);
  const dependsOnMarker = '\n    depends_on: [summarize]';
  const endIndex = afterMarker.indexOf(dependsOnMarker);
  if (endIndex < 0) {
    throw new Error('verify-required-artifacts depends_on marker missing from bundled workflow');
  }

  const indentedScript = afterMarker.slice(0, endIndex);
  const normalizedScript = indentedScript
    .split('\n')
    .map(line => (line.startsWith('      ') ? line.slice(6) : line))
    .join('\n')
    .trimEnd();

  if (normalizedScript.length === 0) {
    throw new Error('verify-required-artifacts bash script is empty');
  }

  return normalizedScript;
}

function runVerifyRequiredArtifactsCheck(options: {
  contractCsv: string;
  artifacts?: Record<string, string>;
  appendTrailingNewline?: boolean;
}): { status: number | null; stdout: string; stderr: string } {
  const verifyScript = getVerifyRequiredArtifactsScript();

  const repoDir = mkdtempSync(join(tmpdir(), 'archon-self-improve-contract-'));
  const artifactsDir = join(repoDir, 'run-artifacts');

  mkdirSync(artifactsDir, { recursive: true });
  mkdirSync(join(repoDir, '.archon', 'self-improvement'), { recursive: true });
  const shouldAppendTrailingNewline = options.appendTrailingNewline ?? true;
  const contractCsv =
    shouldAppendTrailingNewline && !options.contractCsv.endsWith('\n')
      ? `${options.contractCsv}\n`
      : options.contractCsv;
  writeFileSync(join(repoDir, '.archon', 'self-improvement', 'artifact-contract.csv'), contractCsv);

  for (const [relativePath, content] of Object.entries(options.artifacts ?? {})) {
    const absolutePath = join(artifactsDir, relativePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content);
  }

  const result = spawnSync('bash', ['-c', verifyScript], {
    cwd: repoDir,
    env: {
      ...process.env,
      ARTIFACTS_DIR: artifactsDir,
    },
    encoding: 'utf8',
  });

  rmSync(repoDir, { recursive: true, force: true });

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

describe('archon-self-improve verify-required-artifacts node', () => {
  it('passes when required artifacts listed by contract exist', () => {
    const result = runVerifyRequiredArtifactsCheck({
      contractCsv: [
        'artifact,schema,producer,consumer,required,freshness',
        'self-improve-goal.md,schema,producer,consumer,yes,fresh',
        'handoff.md,schema,producer,consumer,yes,fresh',
        'best-practices-evidence.md,schema,producer,consumer,no,unknown',
      ].join('\n'),
      artifacts: {
        'self-improve-goal.md': '# goal\n',
        'handoff.md': '# handoff\n',
      },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      'Required artifacts present and non-empty per artifact-contract.csv.'
    );
  });

  it('fails closed on malformed artifact-contract header', () => {
    const result = runVerifyRequiredArtifactsCheck({
      contractCsv: [
        'artifact,schema,producer,consumer,required',
        'handoff.md,schema,producer,consumer,yes',
      ].join('\n'),
      artifacts: {
        'handoff.md': '# handoff\n',
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'ERROR: malformed self-improvement artifact contract CSV header.'
    );
    expect(result.stderr).toContain(
      'Expected: artifact,schema,producer,consumer,required,freshness'
    );
  });

  it('fails closed when required column value is not yes/no', () => {
    const result = runVerifyRequiredArtifactsCheck({
      contractCsv: [
        'artifact,schema,producer,consumer,required,freshness',
        'handoff.md,schema,producer,consumer,yes,fresh',
        'candidate-ranking.md,schema,producer,consumer,maybe,fresh',
      ].join('\n'),
      artifacts: {
        'handoff.md': '# handoff\n',
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'ERROR: artifact contract required column must be yes or no for candidate-ranking.md.'
    );
    expect(result.stderr).toContain(
      'ERROR: archon-self-improve summarize must produce all required artifacts.'
    );
  });

  it('fails closed when malformed final row lacks trailing newline', () => {
    const result = runVerifyRequiredArtifactsCheck({
      contractCsv: [
        'artifact,schema,producer,consumer,required,freshness',
        'handoff.md,schema,producer,consumer,yes,fresh',
        'candidate-ranking.md,schema,producer,consumer,maybe,fresh',
      ].join('\n'),
      artifacts: {
        'handoff.md': '# handoff\n',
      },
      appendTrailingNewline: false,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'ERROR: artifact contract required column must be yes or no for candidate-ranking.md.'
    );
  });

  it('fails closed when artifact cell is empty', () => {
    const result = runVerifyRequiredArtifactsCheck({
      contractCsv: [
        'artifact,schema,producer,consumer,required,freshness',
        'handoff.md,schema,producer,consumer,yes,fresh',
        ',schema,producer,consumer,no,fresh',
      ].join('\n'),
      artifacts: {
        'handoff.md': '# handoff\n',
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('ERROR: artifact contract contains empty artifact cell.');
    expect(result.stderr).toContain(
      'ERROR: archon-self-improve summarize must produce all required artifacts.'
    );
  });
});
