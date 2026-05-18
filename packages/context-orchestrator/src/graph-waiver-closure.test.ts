import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { getGraphWaiverClosureReport, renderGraphWaiverClosureReportMarkdown } from './index';

const repoRoot = resolve(import.meta.dir, '../../..');
const timestamp = '2026-05-18T12:00:00.000Z';

describe('graph waiver closure diagnostics', () => {
  test('AC-GWCL-001 AC-GWCL-002 reports current empty waiver graphs as unresolved', async () => {
    const report = await getGraphWaiverClosureReport({ cwd: repoRoot, timestamp });

    expect(report.schemaVersion).toBe('aco.graph-waiver-closure.v1');
    expect(report.summary.total).toBe(2);
    expect(report.summary.byDecision.unresolved).toBe(2);
    expect(report.summary.approvalRequired).toBe(true);
    expect(report.diagnostics.map(diagnostic => diagnostic.waiverId)).toEqual([
      'graph-waiver.bmad-plugins-marketplace',
      'graph-waiver.bmad-sample-data',
    ]);
    for (const diagnostic of report.diagnostics) {
      expect(diagnostic.graphArtifact.status).toBe('empty-waiver');
      expect(diagnostic.decision).toBe('unresolved');
      expect(diagnostic.approvalStatus).toBe('approval_required');
      expect(diagnostic.recommendedCommands.every(command => command.willRun === false)).toBe(true);
      expect(diagnostic.expectedSuccessEvidence.length).toBeGreaterThanOrEqual(3);
    }
  });

  test('AC-GWCL-004 renders reviewer-ready Markdown', async () => {
    const report = await getGraphWaiverClosureReport({ cwd: repoRoot, timestamp });
    const markdown = renderGraphWaiverClosureReportMarkdown(report);

    expect(markdown).toContain('# Graph Waiver Closure Report');
    expect(markdown).toContain('graph-waiver.bmad-plugins-marketplace');
    expect(markdown).toContain('Graph artifact: empty-waiver');
    expect(markdown).toContain('Expected success evidence:');
  });

  test('AC-GWCL-005 missing graph artifacts require manual action and approval', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'aco-gwcl-missing-'));
    await mkdir(join(cwd, 'docs/context-orchestrator/research'), { recursive: true });
    await writeFile(
      join(cwd, 'docs/context-orchestrator/research/upstream-manifest.json'),
      `${JSON.stringify(
        {
          repositories: [
            {
              name: 'sample-upstream',
              localPath: 'research/upstreams/sample-upstream',
              cloneStatus: 'fetched',
              graphStatus: 'failed',
              waiverRequired: true,
              error: 'Graphify completed but graphify-out/graph.json was not found.',
            },
          ],
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const report = await getGraphWaiverClosureReport({ cwd, timestamp });
    const diagnostic = report.diagnostics[0];

    expect(diagnostic?.waiverId).toBe('graph-waiver.sample-upstream');
    expect(diagnostic?.graphArtifact.status).toBe('missing');
    expect(diagnostic?.decision).toBe('manual_action_required');
    expect(diagnostic?.approvalStatus).toBe('approval_required');
    expect(diagnostic?.recommendedCommands.every(command => command.requiresApproval)).toBe(true);
  });
});
