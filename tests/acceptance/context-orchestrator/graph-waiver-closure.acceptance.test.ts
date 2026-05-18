import { describe, expect, test } from 'bun:test';
import {
  getContextOrchestratorStatus,
  getGraphWaiverClosureReport,
} from '@archon/context-orchestrator';

describe('ACO graph waiver closure acceptance', () => {
  test('Spec: 004-graph-context-spec.md Acceptance: AC-GWCL-001 AC-GWCL-002 AC-GWCL-003 AC-GWCL-004 failed graph waivers produce unresolved diagnostics', async () => {
    const report = await getGraphWaiverClosureReport({
      cwd: process.cwd(),
      timestamp: '2026-05-18T12:00:00.000Z',
    });
    const status = await getContextOrchestratorStatus(process.cwd());

    expect(report.schemaVersion).toBe('aco.graph-waiver-closure.v1');
    expect(report.readiness).toBe('needs_approval');
    expect(status.readiness).toBe('needs_approval');
    expect(report.diagnostics.map(row => row.waiverId)).toEqual([
      'graph-waiver.bmad-plugins-marketplace',
      'graph-waiver.bmad-sample-data',
    ]);

    for (const diagnostic of report.diagnostics) {
      expect(diagnostic.decision).toBe('unresolved');
      expect(diagnostic.graphArtifact.status).toBe('empty-waiver');
      expect(diagnostic.graphArtifact.nodes).toBe(0);
      expect(diagnostic.graphArtifact.edges).toBe(0);
      expect(diagnostic.affectedLedgerRows).toContain('tool.graph-evidence');
      expect(diagnostic.owner).toBe('context-orchestrator');
      expect(diagnostic.failureSummary).toContain('Nothing to update or rebuild failed');
      expect(diagnostic.expectedSuccessEvidence.length).toBeGreaterThan(0);
      expect(diagnostic.recommendedAction.length).toBeGreaterThan(0);
    }
  });

  test('Spec: 012-cli-contract.md Acceptance: AC-GWCL-005 AC-GWCL-006 CLI emits approval-required recommendations without changing status', async () => {
    const proc = Bun.spawn(
      [
        process.execPath,
        'packages/cli/src/cli.ts',
        'context',
        'graph-waivers',
        '--cwd',
        process.cwd(),
        '--json',
      ],
      { cwd: process.cwd(), stdout: 'pipe', stderr: 'pipe' }
    );
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    expect(stderr).toBe('');
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as Awaited<ReturnType<typeof getGraphWaiverClosureReport>>;
    expect(parsed.summary.total).toBe(2);
    expect(parsed.summary.byDecision.unresolved).toBe(2);
    expect(parsed.approvalRequired).toBe(true);
    for (const diagnostic of parsed.diagnostics) {
      expect(diagnostic.approvalStatus).toBe('approval_required');
      expect(diagnostic.recommendedCommands.length).toBeGreaterThan(0);
      for (const command of diagnostic.recommendedCommands) {
        expect(command.requiresApproval).toBe(true);
        expect(command.willRun).toBe(false);
      }
    }

    const status = await getContextOrchestratorStatus(process.cwd());
    expect(status.readiness).toBe('needs_approval');
  });
});
