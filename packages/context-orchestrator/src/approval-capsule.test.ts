import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import {
  compilePromptPackage,
  createApprovalCapsule,
  renderApprovalCapsuleMarkdown,
  verifyApprovalCapsuleArtifacts,
  writeApprovalCapsuleArtifacts,
} from './index';
import type { GraphContext, ValidationReport } from './types';

const repoRoot = resolve(import.meta.dir, '../../..');

describe('approval capsule', () => {
  test('ACO-APPROVAL-001 ACO-APPROVAL-006 builds forbidden graph approval capsule with inert commands', async () => {
    const cwd = await writeApprovalFixture();
    const capsule = await createApprovalCapsule({
      cwd,
      prompt: 'Implement ACO Approval Capsule',
      runId: 'aco-approval-unit',
      timestamp: '2026-05-18T12:00:00.000Z',
      artifactRoot: '/tmp/aco-artifacts',
    });

    expect(capsule.schemaVersion).toBe('aco.approval-capsule.v1');
    expect(capsule.readiness).toBe('needs_approval');
    expect(capsule.graphStatus).toBe('forbidden');
    expect(capsule.activeWaiverIds).toEqual(['graph-waiver.sample-upstream']);
    expect(capsule.approvalCommands.length).toBeGreaterThan(0);
    expect(capsule.approvalCommands.every(command => command.willRun === false)).toBe(true);
    expect(capsule.approvalCommands.every(command => command.requiresApproval === true)).toBe(true);
    expect(capsule.ledgerRefs.some(ref => ref.status === 'forbidden')).toBe(true);
    expect(capsule.ledgerRefs.some(ref => ref.status === 'deferred')).toBe(true);
    expect(capsule.evidenceResolution.required).toBe(true);
    expect(capsule.evidenceResolution.items.some(item => item.resolver === 'approval')).toBe(true);
    if (capsule.evidenceBlockers.length > 0) {
      expect(capsule.nextDecision.kind).toBe('blocked_by_evidence');
      expect(capsule.nextDecision.evidenceBlockerIds).toEqual(
        capsule.evidenceBlockers.map(blocker => blocker.id).sort()
      );
    } else {
      expect(capsule.nextDecision.kind).toBe('approval_required');
    }
    expect(capsule.nextDecision.primaryAction.willRun).toBe(false);
    expect(capsule.approvalContract.schemaVersion).toBe('aco.approval-contract.v1');
    if (capsule.nextDecision.kind === 'approval_required') {
      expect(capsule.nextDecision.primaryAction.payload).toEqual(capsule.approvalContract);
    }
    expect(capsule.approvalContract.willRun).toBe(false);
    expect(capsule.decisionScope).toContain('preserves only these active graph waivers');
    expect(capsule.decisionScope).toContain('for this run only');

    const markdown = renderApprovalCapsuleMarkdown(capsule);
    expect(markdown).toContain('# ACO Approval Capsule');
    expect(markdown).toContain('Release readiness: Needs approval while waivers remain.');
    expect(markdown).toContain('## Evidence Resolution');
    expect(markdown).toContain('## Next Decision');
    expect(markdown).toContain('## Approval Contract');
    expect(markdown).toContain(capsule.approvalContract.contractId);
    expect(markdown).toContain('willRun=false');
  });

  test('ACO-APPROVAL-003 writes approval capsule artifacts beside compiled package artifacts', async () => {
    const cwd = await writeApprovalFixture();
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-approval-artifacts-'));
    await compilePromptPackage({
      cwd,
      prompt: 'Implement ACO Approval Capsule',
      archiveRoot,
      runId: 'aco-approval-write',
      timestamp: '2026-05-18T12:00:00.000Z',
    });
    const capsule = await createApprovalCapsule({
      cwd,
      prompt: 'Implement ACO Approval Capsule',
      runId: 'aco-approval-write',
      timestamp: '2026-05-18T12:00:00.000Z',
      artifactRoot: archiveRoot,
    });

    const files = await writeApprovalCapsuleArtifacts(capsule, archiveRoot);
    const verification = await verifyApprovalCapsuleArtifacts({
      cwd,
      artifactRoot: archiveRoot,
      runId: 'aco-approval-write',
    });

    expect(files.json).toBe(join(archiveRoot, 'aco-approval-write', 'approval-capsule.json'));
    expect(files.markdown).toBe(join(archiveRoot, 'aco-approval-write', 'approval-capsule.md'));
    expect(await readFile(files.json, 'utf8')).toContain('"aco.approval-capsule.v1"');
    expect(await readFile(files.markdown, 'utf8')).toContain('# ACO Approval Capsule');
    expect(verification.status).toBe('valid');
    expect(verification.willRun).toBe(false);
  });

  test('ACO-APPROVAL-008 detects waiver mismatch during approval capsule verification', async () => {
    const cwd = await writeApprovalFixture();
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-approval-waiver-drift-'));
    await compilePromptPackage({
      cwd,
      prompt: 'Implement ACO Approval Capsule',
      archiveRoot,
      runId: 'aco-approval-waiver-drift',
      timestamp: '2026-05-18T12:00:00.000Z',
    });
    const capsule = await createApprovalCapsule({
      cwd,
      prompt: 'Implement ACO Approval Capsule',
      runId: 'aco-approval-waiver-drift',
      timestamp: '2026-05-18T12:00:00.000Z',
      artifactRoot: archiveRoot,
    });
    const files = await writeApprovalCapsuleArtifacts(capsule, archiveRoot);
    const tampered = {
      ...capsule,
      activeWaiverIds: ['graph-waiver.other-upstream'],
    };
    await writeFile(files.json, `${JSON.stringify(tampered, null, 2)}\n`);

    const verification = await verifyApprovalCapsuleArtifacts({
      cwd,
      artifactRoot: archiveRoot,
      runId: 'aco-approval-waiver-drift',
    });

    expect(verification.status).toBe('invalid');
    expect(verification.mismatches.map(mismatch => mismatch.field)).toContain('activeWaiverIds');
    expect(verification.willRun).toBe(false);
  });

  test('ACO-APPROVAL-010 treats legacy prose-only capsule as invalid', async () => {
    const cwd = await writeApprovalFixture();
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-approval-legacy-'));
    await compilePromptPackage({
      cwd,
      prompt: 'Implement ACO Approval Capsule',
      archiveRoot,
      runId: 'aco-approval-legacy',
      timestamp: '2026-05-18T12:00:00.000Z',
    });
    const capsule = await createApprovalCapsule({
      cwd,
      prompt: 'Implement ACO Approval Capsule',
      runId: 'aco-approval-legacy',
      timestamp: '2026-05-18T12:00:00.000Z',
      artifactRoot: archiveRoot,
    });
    const files = await writeApprovalCapsuleArtifacts(capsule, archiveRoot);
    const { approvalContract: _approvalContract, ...legacyCapsule } = capsule;
    await writeFile(files.json, `${JSON.stringify(legacyCapsule, null, 2)}\n`);

    const verification = await verifyApprovalCapsuleArtifacts({
      cwd,
      artifactRoot: archiveRoot,
      runId: 'aco-approval-legacy',
    });

    expect(verification.status).toBe('invalid');
    expect(verification.nextAction).toContain('Regenerate');
  });

  test('ACO-APPROVAL-003 rejects missing compiled package for artifact mode', async () => {
    const cwd = await writeApprovalFixture();
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-approval-missing-'));
    await mkdir(join(archiveRoot, 'not-the-run'), { recursive: true });
    const capsule = await createApprovalCapsule({
      cwd,
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

async function writeApprovalFixture(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'aco-approval-cwd-'));
  await mkdir(join(cwd, 'docs/context-orchestrator/specs'), { recursive: true });
  await mkdir(join(cwd, 'docs/context-orchestrator/research'), { recursive: true });
  await mkdir(join(cwd, 'tests/acceptance/context-orchestrator'), { recursive: true });

  await writeFile(join(cwd, 'docs/context-orchestrator/specs/000-product-charter.md'), '# ACO\n');
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
            error: 'Graph evidence unavailable in fixture.',
          },
        ],
      },
      null,
      2
    )}\n`
  );
  await writeFile(
    join(cwd, 'package.json'),
    `${JSON.stringify({
      scripts: {
        'research:bootstrap': 'bun --version',
        'research:update-upstreams': 'bun --version',
        'research:graph': 'bun --version',
        'research:merge-graphs': 'bun --version',
        'research:validate-corpus': 'bun --version',
        'aco:context-intake': 'bun --version',
        'aco:completion-preconditions': 'bun --version',
        'aco:target-intent': 'bun --version',
        'aco:goal-bound-evidence': 'bun --version',
        'aco:gates:test': 'bun --version',
        'aco:policy:test': 'bun --version',
        'aco:policy:fixtures': 'bun --version',
        'aco:policy': 'bun --version',
        'aco:traceability': 'bun --version',
        'aco:test:acceptance': 'bun --version',
      },
    })}\n`
  );

  await writeAcceptanceSurface(cwd, 'api.acceptance.test.ts', 'AC-P1-API');
  await writeAcceptanceSurface(cwd, 'command.acceptance.test.ts', 'AC-P1-SLASH');
  await writeAcceptanceSurface(cwd, 'workflow.acceptance.test.ts', 'AC-P3-WF');
  await writeAcceptanceSurface(cwd, 'events.acceptance.test.ts', 'ACO-EVENTS-001');
  await writeAcceptanceSurface(
    cwd,
    'traceability.acceptance.test.ts',
    'ACO-TRACE-001 ACO-TRACE-002 ACO-TRACE-003'
  );
  await writeAcceptanceSurface(
    cwd,
    'bootstrap.acceptance.test.ts',
    'ACO-BOOTSTRAP-001 ACO-BOOTSTRAP-002 ACO-BOOTSTRAP-003 ACO-BOOTSTRAP-004 ACO-BOOTSTRAP-005'
  );

  return cwd;
}

async function writeAcceptanceSurface(cwd: string, file: string, marker: string): Promise<void> {
  await writeFile(
    join(cwd, 'tests/acceptance/context-orchestrator', file),
    `import { test } from 'bun:test';\ntest('${marker} fixture', () => {});\n`
  );
}
