import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { getGraphWaiverClosureReport, renderGraphWaiverClosureReportMarkdown } from './index';

const timestamp = '2026-05-18T12:00:00.000Z';

describe('graph waiver closure diagnostics', () => {
  test('AC-GWCL-001 AC-GWCL-002 reports documented empty waiver graphs as unresolved', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'aco-gwcl-current-'));
    await writeCompleteProof(cwd);

    const report = await getGraphWaiverClosureReport({ cwd, timestamp });

    expect(report.schemaVersion).toBe('aco.graph-waiver-closure.v1');
    expect(report.summary.total).toBe(1);
    expect(report.summary.byDecision.unresolved).toBe(1);
    expect(report.summary.approvalRequired).toBe(true);
    expect(report.diagnostics.map(diagnostic => diagnostic.waiverId)).toEqual([
      'graph-waiver.sample-upstream',
    ]);
    for (const diagnostic of report.diagnostics) {
      expect(diagnostic.graphArtifact.status).toBe('empty-waiver');
      expect(diagnostic.decision).toBe('unresolved');
      expect(diagnostic.graphArtifact.message).toContain('documented_failed_waiver_required');
      expect(diagnostic.approvalStatus).toBe('approval_required');
      expect(diagnostic.recommendedCommands.every(command => command.willRun === false)).toBe(true);
      expect(diagnostic.expectedSuccessEvidence.length).toBeGreaterThanOrEqual(3);
    }
  });

  test('AC-GWCL-004 renders reviewer-ready Markdown', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'aco-gwcl-render-'));
    await writeCompleteProof(cwd);

    const report = await getGraphWaiverClosureReport({ cwd, timestamp });
    const markdown = renderGraphWaiverClosureReportMarkdown(report);

    expect(markdown).toContain('# Graph Waiver Closure Report');
    expect(markdown).toContain('graph-waiver.sample-upstream');
    expect(markdown).toContain('Graph artifact: empty-waiver');
    expect(markdown).toContain('documented_failed_waiver_required');
    expect(markdown).toContain('Expected success evidence:');
  });

  test('AC-GWCL-005 missing proof keeps missing graph artifacts manual action', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'aco-gwcl-missing-'));
    await mkdir(join(cwd, 'docs/context-orchestrator/research'), { recursive: true });
    await writeManifest(cwd);

    const report = await getGraphWaiverClosureReport({ cwd, timestamp });
    const diagnostic = report.diagnostics[0];

    expect(diagnostic?.waiverId).toBe('graph-waiver.sample-upstream');
    expect(diagnostic?.graphArtifact.status).toBe('missing');
    expect(diagnostic?.decision).toBe('manual_action_required');
    expect(diagnostic?.graphArtifact.message).toContain('missing_index_row');
    expect(diagnostic?.approvalStatus).toBe('approval_required');
    expect(diagnostic?.recommendedCommands.every(command => command.requiresApproval)).toBe(true);
  });

  test('STAB-001-AC1 synthesizes documented missing ignored graph cache as unresolved', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'aco-gwcl-documented-'));
    await writeCompleteProof(cwd);

    const report = await getGraphWaiverClosureReport({ cwd, timestamp });
    const diagnostic = report.diagnostics[0];

    expect(diagnostic?.graphArtifact.status).toBe('empty-waiver');
    expect(diagnostic?.graphArtifact.graphStatus).toBe('waived');
    expect(diagnostic?.decision).toBe('unresolved');
    expect(diagnostic?.graphArtifact.message).toContain('documented_failed_waiver_required');
    expect(diagnostic?.graphArtifact.message).toContain(
      'docs/context-orchestrator/research/upstream-manifest.json'
    );
    expect(diagnostic?.recommendedCommands.every(command => command.willRun === false)).toBe(true);
  });

  test('STAB-001-AC3 contradictory tracked proof remains manual action', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'aco-gwcl-contradictory-'));
    await writeCompleteProof(cwd, {
      indexGraphPath: 'research/graphs/different-upstream/graph.json',
    });

    const report = await getGraphWaiverClosureReport({ cwd, timestamp });
    const diagnostic = report.diagnostics[0];

    expect(diagnostic?.graphArtifact.status).toBe('missing');
    expect(diagnostic?.decision).toBe('manual_action_required');
    expect(diagnostic?.graphArtifact.message).toContain('contradictory_docs');
  });

  test('STAB-001-AC4 unsafe proof paths remain manual action', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'aco-gwcl-unsafe-'));
    await writeCompleteProof(cwd, {
      indexGraphPath: 'research/graphs/../sample-upstream/graph.json',
      waiverGraphPath: 'research/graphs/sample-upstream/graph.json',
    });

    const report = await getGraphWaiverClosureReport({ cwd, timestamp });
    const diagnostic = report.diagnostics[0];

    expect(diagnostic?.graphArtifact.status).toBe('missing');
    expect(diagnostic?.decision).toBe('manual_action_required');
    expect(diagnostic?.graphArtifact.message).toContain('unsafe_path');
  });

  test('STAB-001-AC4 existing malformed graph artifact is not synthesized', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'aco-gwcl-malformed-'));
    await writeCompleteProof(cwd);
    await mkdir(join(cwd, 'research/graphs/sample-upstream'), { recursive: true });
    await writeFile(join(cwd, 'research/graphs/sample-upstream/graph.json'), '{', 'utf8');

    const report = await getGraphWaiverClosureReport({ cwd, timestamp });
    const diagnostic = report.diagnostics[0];

    expect(diagnostic?.graphArtifact.status).toBe('malformed');
    expect(diagnostic?.decision).toBe('manual_action_required');
    expect(diagnostic?.graphArtifact.message).toContain('not valid JSON');
  });
});

async function writeCompleteProof(
  cwd: string,
  overrides: {
    repoName?: string;
    manifestGraphStatus?: string;
    manifestWaiverRequired?: boolean;
    indexGraphStatus?: string;
    indexCloneStatus?: string;
    indexNodes?: string;
    indexEdges?: string;
    indexWaiverRequired?: string;
    indexGraphPath?: string;
    waiverStatus?: string;
    waiverGraphPath?: string;
  } = {}
): Promise<void> {
  await mkdir(join(cwd, 'docs/context-orchestrator/research'), { recursive: true });
  await writeManifest(cwd, overrides);
  await writeGraphEvidenceIndex(cwd, overrides);
  await writeWaivers(cwd, overrides);
}

async function writeManifest(
  cwd: string,
  overrides: {
    repoName?: string;
    manifestGraphStatus?: string;
    manifestWaiverRequired?: boolean;
  } = {}
): Promise<void> {
  const repoName = overrides.repoName ?? 'sample-upstream';
  await writeFile(
    join(cwd, 'docs/context-orchestrator/research/upstream-manifest.json'),
    `${JSON.stringify(
      {
        repositories: [
          {
            name: repoName,
            localPath: `research/upstreams/${repoName}`,
            cloneStatus: 'fetched',
            graphStatus: overrides.manifestGraphStatus ?? 'failed',
            waiverRequired: overrides.manifestWaiverRequired ?? true,
            error: 'Graphify completed but graphify-out/graph.json was not found.',
          },
        ],
      },
      null,
      2
    )}\n`,
    'utf8'
  );
}

async function writeGraphEvidenceIndex(
  cwd: string,
  overrides: {
    repoName?: string;
    indexGraphStatus?: string;
    indexCloneStatus?: string;
    indexNodes?: string;
    indexEdges?: string;
    indexWaiverRequired?: string;
    indexGraphPath?: string;
  }
): Promise<void> {
  const repoName = overrides.repoName ?? 'sample-upstream';
  const graphPath = overrides.indexGraphPath ?? `research/graphs/${repoName}/graph.json`;
  const rows = [
    '# Graph Evidence Index',
    '',
    '| Repository | Graph status | Clone status | Branch | Commit | Nodes | Edges | Waiver required | Graph |',
    '| --- | --- | --- | --- | --- | ---: | ---: | --- | --- |',
    `| ${repoName} | ${overrides.indexGraphStatus ?? 'failed'} | ${overrides.indexCloneStatus ?? 'fetched'} | main | abc123 | ${overrides.indexNodes ?? '0'} | ${overrides.indexEdges ?? '0'} | ${overrides.indexWaiverRequired ?? 'yes'} | ${graphPath} |`,
    '',
  ];
  await writeFile(
    join(cwd, 'docs/context-orchestrator/research/graph-evidence-index.md'),
    rows.join('\n'),
    'utf8'
  );
}

async function writeWaivers(
  cwd: string,
  overrides: {
    repoName?: string;
    waiverStatus?: string;
    waiverGraphPath?: string;
  }
): Promise<void> {
  const repoName = overrides.repoName ?? 'sample-upstream';
  const graphPath = overrides.waiverGraphPath ?? `research/graphs/${repoName}/graph.json`;
  const lines = [
    '# Research Waivers',
    '',
    `## ${repoName}`,
    '',
    `Status: ${overrides.waiverStatus ?? 'failed'}`,
    '',
    'Owner: STAB-001 test',
    '',
    `Graph path: ${graphPath}`,
    '',
  ];
  await writeFile(
    join(cwd, 'docs/context-orchestrator/research/waivers.md'),
    lines.join('\n'),
    'utf8'
  );
}
