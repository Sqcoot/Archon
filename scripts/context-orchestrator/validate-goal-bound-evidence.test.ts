import { createHash } from 'node:crypto';
import { describe, expect, test } from 'bun:test';
import {
  evaluateGoalBoundEvidence,
  renderGoalBoundEvidenceReport,
  type GoalBoundEvidenceCode,
  type GoalBoundEvidenceInputItem,
} from './validate-goal-bound-evidence';
import type { GitSnapshot } from './validate-target-intent-boundary';

const harnessObjective = 'Implement ACO goal-bound evidence gate in Archon.';
const validationObjective = 'Validate traceability coverage without source changes.';

describe('ACO Goal-Bound Evidence gate', () => {
  test('ready evidence returns the output contract', async () => {
    const report = await evaluateGoalBoundEvidence({
      cwd: '/repo/Archon',
      objective: harnessObjective,
      timestamp: '2026-05-23T00:00:00Z',
      gitSnapshot: cleanGit(),
      evidence: readyHarnessEvidence(harnessObjective),
    });

    expect(report.schemaVersion).toBe('aco.goal-bound-evidence.v1');
    expect(report.state).toBe('ready');
    expect(report.reasons).toEqual([]);
    expect(report.blockers).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(report.evidence.length).toBeGreaterThan(0);
    expect(report.nextRecommendedAction).toContain('Proceed');
    expect(report.checkedAt).toBe('2026-05-23T00:00:00Z');
    expect(report.contextIntent.intentHash).toBe(intentHash(harnessObjective));
    expect(report.requiredEvidence.every(item => item.satisfied)).toBe(true);
  });

  test('missing objective is blocked before evidence can be closed', async () => {
    const report = await evaluateGoalBoundEvidence({
      cwd: '/repo/Archon',
      gitSnapshot: cleanGit(),
      evidence: [],
    });

    expect(report.state).toBe('blocked');
    expect(codes(report.blockers)).toContain('objective_missing');
    expect(codes(report.blockers)).toContain('target_intent_not_ready');
  });

  test('ambiguous target intent requires a decision instead of fake evidence closure', async () => {
    const report = await evaluateGoalBoundEvidence({
      cwd: '/repo/Archon',
      objective: 'Improve the checkout flow.',
      gitSnapshot: cleanGit(),
      evidence: [],
    });

    expect(report.state).toBe('needs_decision');
    expect(codes(report.blockers)).toContain('target_intent_not_ready');
  });

  test('bug fix work requires baseline evidence bound to the same objective', async () => {
    const objective = 'Fix the current repo checkout bug.';
    const report = await evaluateGoalBoundEvidence({
      cwd: '/repo/Archon',
      objective,
      gitSnapshot: cleanGit(),
      evidence: [
        evidence('impl.changed-files', 'implementation', objective),
        validationEvidence('validation.checkout', objective),
      ],
    });

    expect(report.state).toBe('blocked');
    expect(codes(report.blockers)).toContain('required_evidence_missing');
    expect(codes(report.blockers)).toContain('target_intent_not_ready');
    expect(report.closureItems.some(item => item.kind === 'baseline')).toBe(true);
  });

  test('required evidence without objective hash is blocked as unbound', async () => {
    const report = await evaluateGoalBoundEvidence({
      cwd: '/repo/Archon',
      objective: harnessObjective,
      gitSnapshot: cleanGit(),
      evidence: [
        {
          ...evidence('impl.changed-files', 'implementation', harnessObjective),
          objectiveHash: undefined,
        },
        validationEvidence('validation.target-intent', harnessObjective),
      ],
    });

    expect(report.state).toBe('blocked');
    expect(codes(report.blockers)).toContain('evidence_unbound_to_objective');
  });

  test('required evidence with another objective hash is blocked', async () => {
    const report = await evaluateGoalBoundEvidence({
      cwd: '/repo/Archon',
      objective: harnessObjective,
      gitSnapshot: cleanGit(),
      evidence: [
        {
          ...evidence('impl.changed-files', 'implementation', harnessObjective),
          objectiveHash: intentHash('Implement another goal.'),
        },
        validationEvidence('validation.target-intent', harnessObjective),
      ],
    });

    expect(report.state).toBe('blocked');
    expect(codes(report.blockers)).toContain('evidence_objective_mismatch');
  });

  test('failed validation evidence blocks readiness', async () => {
    const report = await evaluateGoalBoundEvidence({
      cwd: '/repo/Archon',
      objective: harnessObjective,
      gitSnapshot: cleanGit(),
      evidence: [
        evidence('impl.changed-files', 'implementation', harnessObjective),
        {
          ...validationEvidence('validation.target-intent', harnessObjective),
          status: 'failed',
          summary: 'bun run aco:target-intent:test failed',
        },
      ],
    });

    expect(report.state).toBe('blocked');
    expect(codes(report.blockers)).toContain('evidence_failed');
    expect(report.closureItems.some(item => item.kind === 'validation')).toBe(true);
  });

  test('unknown validation evidence returns unknown instead of ready', async () => {
    const report = await evaluateGoalBoundEvidence({
      cwd: '/repo/Archon',
      objective: validationObjective,
      gitSnapshot: cleanGit(),
      evidence: [
        {
          ...validationEvidence('validation.traceability', validationObjective),
          status: 'unknown',
          summary: 'validation output was incomplete',
        },
      ],
    });

    expect(report.state).toBe('unknown');
    expect(codes(report.warnings)).toContain('evidence_unknown');
  });

  test('stale required evidence blocks with a closure item', async () => {
    const report = await evaluateGoalBoundEvidence({
      cwd: '/repo/Archon',
      objective: validationObjective,
      gitSnapshot: cleanGit(),
      evidence: [
        {
          ...validationEvidence('validation.traceability', validationObjective),
          freshness: 'stale',
        },
      ],
    });

    expect(report.state).toBe('blocked');
    expect(codes(report.blockers)).toContain('evidence_stale');
    expect(report.closureItems.some(item => item.kind === 'validation')).toBe(true);
  });

  test('validation evidence must include the command that produced it', async () => {
    const report = await evaluateGoalBoundEvidence({
      cwd: '/repo/Archon',
      objective: harnessObjective,
      gitSnapshot: cleanGit(),
      evidence: [
        evidence('impl.changed-files', 'implementation', harnessObjective),
        {
          ...validationEvidence('validation.target-intent', harnessObjective),
          command: undefined,
        },
      ],
    });

    expect(report.state).toBe('blocked');
    expect(codes(report.blockers)).toContain('validation_command_missing');
  });

  test('approval-required evidence maps to needs_decision, not needs_approval', async () => {
    const report = await evaluateGoalBoundEvidence({
      cwd: '/repo/Archon',
      objective: validationObjective,
      gitSnapshot: cleanGit(),
      evidence: [
        validationEvidence('validation.traceability', validationObjective),
        {
          id: 'graph-waiver.bmad',
          kind: 'decision',
          status: 'waived',
          summary: 'Graph waiver remains active for this run.',
          source: 'docs/context-orchestrator/research/waivers.md',
          requiresApproval: true,
        },
      ],
    });

    expect(report.state).toBe('needs_decision');
    expect(report.state).not.toBe('needs_approval');
    expect(codes(report.blockers)).toContain('approval_required');
    expect(report.closureItems.some(item => item.requiresApproval)).toBe(true);
  });

  test('generated artifacts require a lifecycle before they count as evidence', async () => {
    const report = await evaluateGoalBoundEvidence({
      cwd: '/repo/Archon',
      objective: validationObjective,
      gitSnapshot: cleanGit(),
      evidence: [
        validationEvidence('validation.traceability', validationObjective),
        {
          id: 'artifact.status-report',
          kind: 'generated_artifact',
          status: 'passed',
          summary: 'Generated status report exists.',
          source: 'docs/context-orchestrator/stabilization/status-report.md',
        },
      ],
    });

    expect(report.state).toBe('blocked');
    expect(codes(report.blockers)).toContain('generated_artifact_lifecycle_missing');
  });

  test('secret-like values are redacted before rendering or hashing evidence', async () => {
    const secretObjective = 'Implement ACO support using sk-proj_abcdefghijklmnopqrstuvwxyz.';
    const report = await evaluateGoalBoundEvidence({
      cwd: '/repo/Archon',
      objective: secretObjective,
      gitSnapshot: cleanGit(),
      evidence: [],
    });
    const serialized = JSON.stringify(report);

    expect(serialized).toContain('<redacted-secret>');
    expect(serialized).not.toContain('sk-proj_abcdefghijklmnopqrstuvwxyz');
    expect(report.contextIntent.intentHash).toBe(
      intentHash('Implement ACO support using <redacted-secret>.')
    );
  });

  test('rendered text report includes core output contract fields', async () => {
    const report = await evaluateGoalBoundEvidence({
      cwd: '/repo/Archon',
      objective: harnessObjective,
      gitSnapshot: cleanGit(),
      evidence: readyHarnessEvidence(harnessObjective),
    });

    const rendered = renderGoalBoundEvidenceReport(report);

    expect(rendered).toContain('State: ready');
    expect(rendered).toContain('Intent Hash:');
    expect(rendered).toContain('Work Intent: harness_improvement');
    expect(rendered).toContain('Next: Proceed');
  });

  test('CLI JSON entrypoint preserves the package output contract', async () => {
    const result = await run([
      process.execPath,
      'scripts/context-orchestrator/validate-goal-bound-evidence.ts',
      '--objective',
      harnessObjective,
      '--evidence-json',
      JSON.stringify(readyHarnessEvidence(harnessObjective)),
      '--json',
    ]);
    const report = JSON.parse(result.stdout) as {
      state?: string;
      reasons?: unknown[];
      evidence?: unknown[];
      nextRecommendedAction?: string;
      contextIntent?: { intentHash?: string };
    };

    expect(result.exitCode).toBe(0);
    expect(report.state).toBe('ready');
    expect(Array.isArray(report.reasons)).toBe(true);
    expect(Array.isArray(report.evidence)).toBe(true);
    expect(report.nextRecommendedAction).toContain('Proceed');
    expect(report.contextIntent?.intentHash).toBe(intentHash(harnessObjective));
  });
});

function readyHarnessEvidence(objective: string): GoalBoundEvidenceInputItem[] {
  return [
    evidence('impl.changed-files', 'implementation', objective),
    validationEvidence('validation.goal-bound-evidence', objective),
  ];
}

function validationEvidence(id: string, objective: string): GoalBoundEvidenceInputItem {
  return {
    ...evidence(id, 'validation', objective),
    command: 'bun run aco:goal-bound-evidence:test',
  };
}

function evidence(
  id: string,
  kind: GoalBoundEvidenceInputItem['kind'],
  objective: string
): GoalBoundEvidenceInputItem {
  return {
    id,
    kind,
    status: 'passed',
    freshness: 'fresh',
    summary: `${kind} evidence for ${objective}`,
    source: 'test fixture',
    objectiveHash: intentHash(objective),
  };
}

function intentHash(objective: string): string {
  const normalized = objective.toLowerCase().replace(/\s+/g, ' ').trim();
  return createHash('sha256')
    .update(normalized || '<missing>')
    .digest('hex')
    .slice(0, 16);
}

function codes(items: Array<{ code: GoalBoundEvidenceCode }>): GoalBoundEvidenceCode[] {
  return items.map(item => item.code);
}

function cleanGit(): GitSnapshot {
  return {
    branch: 'codex/aco-stabilization-slices',
    commit: 'abc123',
    dirtyState: 'clean',
    inspectionErrors: [],
  };
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
