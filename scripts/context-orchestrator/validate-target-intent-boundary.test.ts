import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  evaluateTargetIntentBoundary,
  renderTargetIntentReport,
  type GitSnapshot,
  type TargetIntentCode,
} from './validate-target-intent-boundary';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

describe('ACO Target Intent Boundary gate', () => {
  test('Archon/ACO self-work returns ready with harness-only mutation policy', async () => {
    const report = await evaluateTargetIntentBoundary({
      cwd: '/repo/Archon',
      objective: 'Implement ACO target intent boundary in Archon.',
      timestamp: '2026-05-23T00:00:00Z',
      gitSnapshot: cleanGit(),
    });

    expect(report.schemaVersion).toBe('aco.target-intent-boundary.v1');
    expect(report.state).toBe('ready');
    expect(report.boundary.schemaVersion).toBe('aco.target-intent-boundary.v1');
    expect(report.boundary.objective.workIntent).toBe('harness_improvement');
    expect(report.boundary.target.relationship).toBe('same_as_harness');
    expect(report.boundary.scope.mutationPolicy).toBe('harness_only');
    expect(report.boundary.scope.nonEnforcementBoundary).toBe(true);
    expect(report.evidence.length).toBeGreaterThan(0);
    expect(report.nextRecommendedAction).toContain('Proceed');
    expect(report.checkedAt).toBe('2026-05-23T00:00:00Z');
  });

  test('current-repo target is independent from work intent', async () => {
    const report = await evaluateTargetIntentBoundary({
      cwd: '/repo/Archon',
      objective: 'Refactor the current repo command handler.',
      gitSnapshot: cleanGit(),
    });

    expect(report.state).toBe('ready');
    expect(report.boundary.target.relationship).toBe('current_repo');
    expect(report.boundary.objective.workIntent).toBe('refactor');
    expect(report.boundary.scope.mutationPolicy).toBe('target_only');
  });

  test('artifact-only validation work stays read-only and does not require dirty-state evidence', async () => {
    const report = await evaluateTargetIntentBoundary({
      cwd: '/repo/Archon',
      objective: 'Validate traceability coverage without source changes.',
      gitSnapshot: { ...cleanGit(), dirtyState: 'dirty' },
    });

    expect(report.state).toBe('ready');
    expect(report.boundary.target.relationship).toBe('artifact_only');
    expect(report.boundary.scope.mutationPolicy).toBe('read_only');
    expect(report.boundary.harness.dirtyState).toBe('not_applicable');
  });

  test('ambiguous objective requires a target decision instead of assuming Archon', async () => {
    const report = await evaluateTargetIntentBoundary({
      cwd: '/repo/Archon',
      objective: 'Improve the checkout flow.',
      gitSnapshot: cleanGit(),
    });

    expect(report.state).toBe('needs_decision');
    expect(codes(report.blockers)).toContain('target_unknown');
    expect(report.boundary.target.relationship).toBe('unknown');
    expect(report.boundary.nextDecision.kind).toBe('decision_required');
  });

  test('bug fix requires baseline evidence before implementation', async () => {
    const blocked = await evaluateTargetIntentBoundary({
      cwd: '/repo/Archon',
      objective: 'Fix the current repo checkout bug.',
      gitSnapshot: cleanGit(),
    });
    const ready = await evaluateTargetIntentBoundary({
      cwd: '/repo/Archon',
      objective: 'Fix the current repo checkout bug.',
      baselineEvidence: ['bun test packages/core/src/checkout.test.ts failed before fix'],
      gitSnapshot: cleanGit(),
    });

    expect(blocked.state).toBe('blocked');
    expect(codes(blocked.blockers)).toContain('baseline_evidence_required');
    expect(blocked.boundary.evidence.baselineRequired).toBe(true);
    expect(ready.state).toBe('ready');
    expect(ready.boundary.evidence.baselineEvidence).toHaveLength(1);
  });

  test('registered-project target returns needs_decision without private resolver assumptions', async () => {
    const report = await evaluateTargetIntentBoundary({
      cwd: '/repo/Archon',
      objective: 'Add feature support to the registered project.',
      gitSnapshot: cleanGit(),
    });

    expect(report.state).toBe('needs_decision');
    expect(codes(report.blockers)).toContain('registered_project_unresolved');
    expect(report.boundary.target.relationship).toBe('unknown');
  });

  test('explicit registered-project target still needs a resolver decision', async () => {
    const report = await evaluateTargetIntentBoundary({
      cwd: '/repo/Archon',
      objective: 'Add feature support.',
      targetRelationship: 'registered_project',
      gitSnapshot: cleanGit(),
    });

    expect(report.state).toBe('needs_decision');
    expect(codes(report.blockers)).toContain('registered_project_unresolved');
    expect(report.boundary.target.relationship).toBe('registered_project');
    expect(report.boundary.scope.allowedPaths).toEqual(['<registered-project-root>']);
  });

  test('explicit external target without a root keeps approval as a decision reason', async () => {
    const report = await evaluateTargetIntentBoundary({
      cwd: '/repo/Archon',
      objective: 'Implement feature support.',
      targetRelationship: 'external_repo',
      gitSnapshot: cleanGit(),
    });

    expect(report.state).toBe('needs_decision');
    expect(codes(report.blockers)).toContain('external_target_requires_decision');
    expect(report.boundary.safety.requiresApproval).toBe(true);
    expect(report.boundary.scope.approvalRequiredPaths).toEqual(['<target-root>']);
  });

  test('explicit same-harness target cannot smuggle an external root', async () => {
    const external = await mkdtemp(join(tmpdir(), 'aco-target-conflict-'));
    tempRoots.push(external);
    const resolvedExternal = await realpath(external);

    const report = await evaluateTargetIntentBoundary({
      cwd: '/repo/Archon',
      objective: 'Implement feature support.',
      targetRelationship: 'same_as_harness',
      targetRoot: external,
      gitSnapshot: cleanGit(),
    });

    expect(report.state).toBe('needs_decision');
    expect(codes(report.blockers)).toContain('target_relationship_conflict');
    expect(report.boundary.target.relationship).toBe('same_as_harness');
    expect(report.boundary.target.equalsHarness).toBe(false);
    expect(report.boundary.target.confidence).toBe('low');
    expect(report.boundary.scope.allowedPaths).toEqual([resolvedExternal]);
  });

  test('explicit external target cannot point at the harness root as ready', async () => {
    const report = await evaluateTargetIntentBoundary({
      cwd: '/repo/Archon',
      objective: 'Implement feature support.',
      targetRelationship: 'external_repo',
      targetRoot: '/repo/Archon',
      gitSnapshot: cleanGit(),
    });

    expect(report.state).toBe('needs_decision');
    expect(codes(report.blockers)).toContain('target_relationship_conflict');
    expect(report.boundary.target.relationship).toBe('external_repo');
    expect(report.boundary.target.equalsHarness).toBe(true);
  });

  test('explicit artifact-only target cannot include a mutable root', async () => {
    const external = await mkdtemp(join(tmpdir(), 'aco-target-artifact-conflict-'));
    tempRoots.push(external);

    const report = await evaluateTargetIntentBoundary({
      cwd: '/repo/Archon',
      objective: 'Validate artifact coverage.',
      targetRelationship: 'artifact_only',
      targetRoot: external,
      gitSnapshot: cleanGit(),
    });

    expect(report.state).toBe('needs_decision');
    expect(codes(report.blockers)).toContain('target_relationship_conflict');
    expect(report.boundary.target.relationship).toBe('artifact_only');
    expect(report.boundary.scope.mutationPolicy).toBe('read_only');
    expect(report.boundary.scope.allowedPaths).toEqual(['<artifact-root>']);
  });

  test('existing external target path requires an explicit decision', async () => {
    const external = await mkdtemp(join(tmpdir(), 'aco-target-external-'));
    tempRoots.push(external);
    const resolvedExternal = await realpath(external);

    const report = await evaluateTargetIntentBoundary({
      cwd: '/repo/Archon',
      objective: `Implement a feature in ${external}.`,
      gitSnapshot: cleanGit(),
    });

    expect(report.state).toBe('needs_decision');
    expect(codes(report.blockers)).toContain('external_target_requires_decision');
    expect(report.boundary.target.relationship).toBe('external_repo');
    expect(report.boundary.scope.approvalRequiredPaths).toEqual([resolvedExternal]);
  });

  test('unresolved external target path blocks instead of guessing', async () => {
    const report = await evaluateTargetIntentBoundary({
      cwd: '/repo/Archon',
      objective: 'Implement a feature in /tmp/aco-target-does-not-exist-never.',
      gitSnapshot: cleanGit(),
    });

    expect(report.state).toBe('blocked');
    expect(codes(report.blockers)).toContain('target_path_unresolved');
  });

  test('missing objective is a structured blocker', async () => {
    const report = await evaluateTargetIntentBoundary({
      cwd: '/repo/Archon',
      gitSnapshot: cleanGit(),
    });

    expect(report.state).toBe('blocked');
    expect(codes(report.blockers)).toContain('objective_missing');
    expect(codes(report.blockers)).toContain('intent_unknown');
  });

  test('secret-like values in objective and baseline evidence are redacted', async () => {
    const report = await evaluateTargetIntentBoundary({
      cwd: '/repo/Archon',
      objective: 'Implement ACO work with sk-proj_abcdefghijklmnopqrstuvwxyz.',
      baselineEvidence: ['failing command used ghp_abcdefghijklmnopqrstuvwxyz'],
      gitSnapshot: cleanGit(),
    });
    const serialized = JSON.stringify(report);

    expect(serialized).toContain('<redacted-secret>');
    expect(serialized).not.toContain('sk-proj_abcdefghijklmnopqrstuvwxyz');
    expect(serialized).not.toContain('ghp_abcdefghijklmnopqrstuvwxyz');
  });

  test('git inspection failures preserve unknown state with evidence', async () => {
    const report = await evaluateTargetIntentBoundary({
      cwd: '/repo/Archon',
      objective: 'Implement ACO target intent boundary in Archon.',
      gitSnapshot: { ...cleanGit(), inspectionErrors: ['not a git repository'] },
    });

    expect(report.state).toBe('unknown');
    expect(codes(report.warnings)).toContain('git_inspection_failed');
  });

  test('rendered text report includes core output contract fields', async () => {
    const report = await evaluateTargetIntentBoundary({
      cwd: '/repo/Archon',
      objective: 'Implement ACO target intent boundary in Archon.',
      gitSnapshot: cleanGit(),
    });

    const rendered = renderTargetIntentReport(report);

    expect(rendered).toContain('State: ready');
    expect(rendered).toContain('Next: Proceed');
    expect(rendered).toContain('Target: same_as_harness');
    expect(rendered).toContain('Work Intent: harness_improvement');
    expect(rendered).toContain('Mutation Policy: harness_only');
  });

  test('CLI JSON entrypoint preserves the package output contract', async () => {
    const result = await run([
      process.execPath,
      'scripts/context-orchestrator/validate-target-intent-boundary.ts',
      '--objective',
      'Implement ACO target intent boundary in Archon.',
      '--json',
    ]);
    const report = JSON.parse(result.stdout) as {
      state?: string;
      reasons?: unknown[];
      blockers?: unknown[];
      warnings?: unknown[];
      evidence?: unknown[];
      nextRecommendedAction?: string;
      boundary?: { target?: { relationship?: string } };
    };

    expect(result.exitCode).toBe(0);
    expect(report.state).toBe('ready');
    expect(Array.isArray(report.reasons)).toBe(true);
    expect(Array.isArray(report.blockers)).toBe(true);
    expect(Array.isArray(report.warnings)).toBe(true);
    expect(Array.isArray(report.evidence)).toBe(true);
    expect(report.nextRecommendedAction).toContain('Proceed');
    expect(report.boundary?.target?.relationship).toBe('same_as_harness');
  });
});

function cleanGit(): GitSnapshot {
  return {
    branch: 'codex/aco-stabilization-slices',
    commit: 'abc123',
    dirtyState: 'clean',
    inspectionErrors: [],
  };
}

function codes(items: Array<{ code: TargetIntentCode }>): TargetIntentCode[] {
  return items.map(item => item.code);
}

async function run(command: string[]): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  const proc = Bun.spawn(command, {
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { exitCode, stdout, stderr };
}
