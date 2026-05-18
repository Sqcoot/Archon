import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import {
  compilePromptPackage,
  createApprovalCapsule,
  renderApprovalCapsuleMarkdown,
  writeApprovalCapsuleArtifacts,
} from './index';
import type { GraphContext, ValidationReport } from './types';

const repoRoot = resolve(import.meta.dir, '../../..');

describe('approval capsule', () => {
  test('ACO-APPROVAL-001 ACO-APPROVAL-006 builds forbidden graph approval capsule with inert commands', async () => {
    const capsule = await createApprovalCapsule({
      cwd: repoRoot,
      prompt: 'Implement ACO Approval Capsule',
      runId: 'aco-approval-unit',
      timestamp: '2026-05-18T12:00:00.000Z',
      artifactRoot: '/tmp/aco-artifacts',
    });

    expect(capsule.schemaVersion).toBe('aco.approval-capsule.v1');
    expect(capsule.readiness).toBe('needs_approval');
    expect(capsule.graphStatus).toBe('forbidden');
    expect(capsule.activeWaiverIds).toEqual(
      expect.arrayContaining([
        'graph-waiver.bmad-plugins-marketplace',
        'graph-waiver.bmad-sample-data',
      ])
    );
    expect(capsule.approvalCommands.length).toBeGreaterThan(0);
    expect(capsule.approvalCommands.every(command => command.willRun === false)).toBe(true);
    expect(capsule.approvalCommands.every(command => command.requiresApproval === true)).toBe(true);
    expect(capsule.ledgerRefs.some(ref => ref.status === 'forbidden')).toBe(true);
    expect(capsule.ledgerRefs.some(ref => ref.status === 'deferred')).toBe(true);
    expect(capsule.decisionScope).toContain('preserves only these active graph waivers');
    expect(capsule.decisionScope).toContain('for this run only');

    const markdown = renderApprovalCapsuleMarkdown(capsule);
    expect(markdown).toContain('# ACO Approval Capsule');
    expect(markdown).toContain('Release readiness: Needs approval while waivers remain.');
    expect(markdown).toContain('willRun=false');
  });

  test('ACO-APPROVAL-003 writes approval capsule artifacts beside compiled package artifacts', async () => {
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-approval-artifacts-'));
    await compilePromptPackage({
      cwd: repoRoot,
      prompt: 'Implement ACO Approval Capsule',
      archiveRoot,
      runId: 'aco-approval-write',
      timestamp: '2026-05-18T12:00:00.000Z',
    });
    const capsule = await createApprovalCapsule({
      cwd: repoRoot,
      prompt: 'Implement ACO Approval Capsule',
      runId: 'aco-approval-write',
      timestamp: '2026-05-18T12:00:00.000Z',
      artifactRoot: archiveRoot,
    });

    const files = await writeApprovalCapsuleArtifacts(capsule, archiveRoot);

    expect(files.json).toBe(join(archiveRoot, 'aco-approval-write', 'approval-capsule.json'));
    expect(files.markdown).toBe(join(archiveRoot, 'aco-approval-write', 'approval-capsule.md'));
    expect(await readFile(files.json, 'utf8')).toContain('"aco.approval-capsule.v1"');
    expect(await readFile(files.markdown, 'utf8')).toContain('# ACO Approval Capsule');
  });

  test('ACO-APPROVAL-003 rejects missing compiled package for artifact mode', async () => {
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-approval-missing-'));
    await mkdir(join(archiveRoot, 'not-the-run'), { recursive: true });
    const capsule = await createApprovalCapsule({
      cwd: repoRoot,
      prompt: 'Implement ACO Approval Capsule',
      runId: 'missing-run',
      timestamp: '2026-05-18T12:00:00.000Z',
      artifactRoot: archiveRoot,
    });

    await expect(writeApprovalCapsuleArtifacts(capsule, archiveRoot)).rejects.toThrow(
      'ACO compiled package for runId missing-run not found'
    );
  });

  test('ACO-APPROVAL-006 rejects non-forbidden graph state', async () => {
    const graphContext: GraphContext = {
      status: 'available',
      repositories: [],
      waiverCount: 0,
      waivers: [],
      summary: 'non-forbidden graph evidence',
    };
    const validationReport: ValidationReport = {
      status: 'passed',
      checks: [{ id: 'test', status: 'passed', message: 'ok' }],
    };

    await expect(
      createApprovalCapsule({
        cwd: repoRoot,
        prompt: 'Implement ACO Approval Capsule',
        runId: 'non-forbidden',
        graphContext,
        validationReport,
      })
    ).rejects.toThrow(
      'ACO approval capsule requires readiness=needs_approval and graphStatus=forbidden'
    );
  });
});
