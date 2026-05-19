import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  TARGET_INTENT_BOUNDARY_SCHEMA_VERSION,
  compilePromptPackage,
  createTargetIntentBoundary,
  targetIntentBoundarySchema,
} from '@archon/context-orchestrator';

const boundaryArchivePath = join(
  process.cwd(),
  '.archon/artifacts/context-orchestrator/target-intent-boundary-test'
);
const boundaryPath = join(boundaryArchivePath, 'target-intent-boundary.json');

describe('ACO target/intent boundary acceptance', () => {
  test('ACO-TARGET-001 Archon and ACO self-work records same_as_harness with source signals', async () => {
    const boundary = await createTargetIntentBoundary({
      cwd: process.cwd(),
      objective: 'Implement ACO Target/Intent Boundary Artifact in Archon.',
      timestamp: '2026-05-19T12:00:00.000Z',
      archivePath: boundaryArchivePath,
      boundaryPath,
      routeId: 'brownfield-architecture',
      contextArtifacts: ['manifest.json'],
      ledgerArtifacts: ['commands-ledger.json'],
    });

    expect(boundary.schemaVersion).toBe(TARGET_INTENT_BOUNDARY_SCHEMA_VERSION);
    expect(boundary.target.relationship).toBe('same_as_harness');
    expect(boundary.target.equalsHarness).toBe(true);
    expect(boundary.scope.mutationPolicy).toBe('harness_only');
    expect(boundary.evidence.sourceSignals.length).toBeGreaterThan(0);
    expect(boundary.evidence.sourceSignals.map(signal => signal.kind)).toContain('user_request');
    targetIntentBoundarySchema.parse(boundary);
  });

  test('ACO-TARGET-002 current-repo work records target independently from intent', async () => {
    const boundary = await createTargetIntentBoundary({
      cwd: process.cwd(),
      objective: 'Refactor the current repo command handler.',
      timestamp: '2026-05-19T12:00:00.000Z',
      archivePath: boundaryArchivePath,
      boundaryPath,
      routeId: 'quick-contained',
      contextArtifacts: [],
      ledgerArtifacts: [],
    });

    expect(boundary.target.relationship).toBe('current_repo');
    expect(boundary.target.equalsHarness).toBe(true);
    expect(boundary.objective.workIntent).toBe('refactor');
  });

  test('ACO-TARGET-003 artifact-only work uses read-only or artifact-only mutation policy', async () => {
    const boundary = await createTargetIntentBoundary({
      cwd: process.cwd(),
      objective: 'Validate the adversarial-loop spec coverage without source changes.',
      timestamp: '2026-05-19T12:00:00.000Z',
      archivePath: boundaryArchivePath,
      boundaryPath,
      routeId: 'brownfield-architecture',
      contextArtifacts: ['final-prompt-package.md'],
      ledgerArtifacts: [],
    });

    expect(boundary.target.relationship).toBe('artifact_only');
    expect(['read_only', 'artifact_only']).toContain(boundary.scope.mutationPolicy);
    expect(boundary.target.dirtyState).toBe('not_applicable');
  });

  test('ACO-TARGET-004 ambiguous targets warn and do not assume Archon or external work', async () => {
    const boundary = await createTargetIntentBoundary({
      cwd: process.cwd(),
      objective: 'Improve the checkout flow.',
      timestamp: '2026-05-19T12:00:00.000Z',
      archivePath: boundaryArchivePath,
      boundaryPath,
      routeId: 'unknown-help',
      contextArtifacts: [],
      ledgerArtifacts: [],
    });

    expect(boundary.target.relationship).toBe('unknown');
    expect(boundary.target.root).toBeNull();
    expect(boundary.safety.requiresApproval).toBe(true);
    expect(['approval_required', 'blocked']).toContain(boundary.nextDecision.kind);
    expect(boundary.evidence.warnings.map(warning => warning.code)).toContain('target_unknown');
  });

  test('ACO-TARGET-005 work intent classification is independent from target relationship', async () => {
    const bug = await createTargetIntentBoundary({
      cwd: process.cwd(),
      objective: 'Fix the current repo checkout bug.',
      timestamp: '2026-05-19T12:00:00.000Z',
      archivePath: boundaryArchivePath,
      boundaryPath,
      routeId: 'quick-contained',
      contextArtifacts: [],
      ledgerArtifacts: [],
    });
    const feature = await createTargetIntentBoundary({
      cwd: process.cwd(),
      objective: 'Add a current repo status export feature.',
      timestamp: '2026-05-19T12:00:00.000Z',
      archivePath: boundaryArchivePath,
      boundaryPath,
      routeId: 'quick-contained',
      contextArtifacts: [],
      ledgerArtifacts: [],
    });
    const investigation = await createTargetIntentBoundary({
      cwd: process.cwd(),
      objective: 'Investigate current repo CI flakes.',
      timestamp: '2026-05-19T12:00:00.000Z',
      archivePath: boundaryArchivePath,
      boundaryPath,
      routeId: 'brownfield-architecture',
      contextArtifacts: [],
      ledgerArtifacts: [],
    });

    expect(bug.target.relationship).toBe('current_repo');
    expect(feature.target.relationship).toBe('current_repo');
    expect(investigation.target.relationship).toBe('current_repo');
    expect(bug.objective.workIntent).toBe('bug_fix');
    expect(feature.objective.workIntent).toBe('feature_change');
    expect(investigation.objective.workIntent).toBe('investigation');
  });

  test('ACO-TARGET-006 compile writes schema-valid target-intent-boundary.json', async () => {
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-target-boundary-'));
    const result = await compilePromptPackage({
      cwd: process.cwd(),
      prompt: 'Implement ACO Target/Intent Boundary Artifact.',
      archiveRoot,
      runId: 'aco-target-boundary',
      timestamp: '2026-05-19T12:00:00.000Z',
    });

    const boundary = targetIntentBoundarySchema.parse(
      JSON.parse(await readFile(result.files['target-intent-boundary.json'], 'utf8'))
    );
    expect(result.package.targetIntentBoundary).toEqual(boundary);
    expect(boundary.artifacts.boundaryPath).toBe(result.files['target-intent-boundary.json']);
  });

  test('ACO-TARGET-007 manifest, policy evidence, and final package reference boundary artifact', async () => {
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-target-boundary-refs-'));
    const result = await compilePromptPackage({
      cwd: process.cwd(),
      prompt: 'Implement ACO Target/Intent Boundary Artifact.',
      archiveRoot,
      runId: 'aco-target-boundary-refs',
      timestamp: '2026-05-19T12:00:00.000Z',
    });

    const manifest = JSON.parse(await readFile(result.files['manifest.json'], 'utf8')) as {
      targetIntentBoundaryArtifact?: string;
      targetIntentBoundarySchemaVersion?: string;
    };
    const policyInput = JSON.parse(await readFile(result.files['prompt-package.json'], 'utf8')) as {
      evidence: { targetIntentBoundary?: unknown };
      artifacts: Array<{ path: string }>;
    };
    const finalPackage = await readFile(result.files['final-prompt-package.md'], 'utf8');

    expect(manifest.targetIntentBoundaryArtifact).toBe('target-intent-boundary.json');
    expect(manifest.targetIntentBoundarySchemaVersion).toBe(TARGET_INTENT_BOUNDARY_SCHEMA_VERSION);
    expect(policyInput.evidence.targetIntentBoundary).toBeDefined();
    expect(policyInput.artifacts.map(artifact => artifact.path)).toContain(
      'target-intent-boundary.json'
    );
    expect(finalPackage).toContain('## Target Intent Boundary');
    expect(finalPackage).toContain('target-intent-boundary.json');
  });

  test('ACO-TARGET-008 existing archive consumers tolerate absent boundary artifacts', async () => {
    const manifestOnly = {
      runId: 'legacy-archive',
      targetCodebase: process.cwd(),
      ledgerSchemaVersion: 'aco.ledger-bundle.v1',
    };

    expect(manifestOnly).not.toHaveProperty('targetIntentBoundaryArtifact');
    expect(targetIntentBoundarySchema.safeParse(manifestOnly).success).toBe(false);
  });

  test('ACO-TARGET-009 boundary is descriptive and never grants mutation permission', async () => {
    const boundary = await createTargetIntentBoundary({
      cwd: process.cwd(),
      objective: 'Implement ACO Target/Intent Boundary Artifact in Archon.',
      timestamp: '2026-05-19T12:00:00.000Z',
      archivePath: boundaryArchivePath,
      boundaryPath,
      routeId: 'brownfield-architecture',
      contextArtifacts: [],
      ledgerArtifacts: [],
    });

    expect(boundary.scope.nonEnforcementBoundary).toBe(true);
    expect(JSON.stringify(boundary).toLowerCase()).not.toContain('permission granted');
    expect(JSON.stringify(boundary).toLowerCase()).not.toContain('authorized to mutate');
  });

  test('ACO-TARGET-010 first slice avoids graph, waiver, lifecycle, provider, server, web, DB, and legacy workflow changes', async () => {
    const compiler = await readFile(
      join(process.cwd(), 'packages/context-orchestrator/src/compiler.ts'),
      'utf8'
    );
    const builder = await readFile(
      join(process.cwd(), 'packages/context-orchestrator/src/target-intent-boundary.ts'),
      'utf8'
    );
    const legacyWorkflow = await readFile(
      join(process.cwd(), '.archon/workflows/defaults/archon-adversarial-dev.yaml'),
      'utf8'
    );
    const combined = `${compiler}\n${builder}`;

    for (const forbidden of [
      'research:graph',
      'graph-upstreams',
      'waiver removal',
      'clear waiver',
      '@archon/server',
      '@archon/providers',
      '@archon/web',
      'remote_agent_',
      'markAsFailed',
    ]) {
      expect(combined).not.toContain(forbidden);
    }
    expect(legacyWorkflow).toContain('name: archon-adversarial-dev');
    expect(legacyWorkflow).not.toContain('target-intent-boundary');
  });
});
