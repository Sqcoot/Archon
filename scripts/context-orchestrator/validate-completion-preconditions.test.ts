import { describe, expect, test } from 'bun:test';
import {
  evaluateCompletionPreconditions,
  type CompletionPreconditionsCode,
  type GitPreconditionSnapshot,
} from './validate-completion-preconditions';

describe('ACO Completion Preconditions gate', () => {
  test('clean branch with synced upstream returns ready output contract', async () => {
    const report = await evaluateCompletionPreconditions({
      cwd: '/repo',
      timestamp: '2026-05-23T00:00:00Z',
      snapshot: snapshot({
        branch: 'codex/aco-stabilization-slices',
        upstream: 'origin/codex/aco-stabilization-slices',
      }),
    });

    expect(report.schemaVersion).toBe('aco.completion-preconditions.v1');
    expect(report.state).toBe('ready');
    expect(report.reasons).toEqual([]);
    expect(report.blockers).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(report.evidence.length).toBeGreaterThan(0);
    expect(report.nextRecommendedAction).toContain('Proceed');
    expect(report.checkedAt).toBe('2026-05-23T00:00:00Z');
  });

  test('dirty worktree blocks completion readiness', async () => {
    const report = await evaluateCompletionPreconditions({
      cwd: '/repo',
      snapshot: snapshot({
        branch: 'codex/aco-stabilization-slices',
        upstream: 'origin/codex/aco-stabilization-slices',
        porcelainStatus: ' M package.json\n?? scratch.md\n',
      }),
    });

    expect(report.state).toBe('blocked');
    expect(codes(report.blockers)).toContain('dirty_worktree');
    expect(report.blockers.find(item => item.code === 'dirty_worktree')?.evidence).toContain(
      'package.json'
    );
  });

  test('detached head blocks completion readiness', async () => {
    const report = await evaluateCompletionPreconditions({
      cwd: '/repo',
      snapshot: snapshot({
        branch: '',
        upstream: 'origin/dev',
      }),
    });

    expect(report.state).toBe('blocked');
    expect(codes(report.blockers)).toContain('detached_head');
  });

  test('unsafe branch names are blocked before completion', async () => {
    const report = await evaluateCompletionPreconditions({
      cwd: '/repo',
      snapshot: snapshot({
        branch: 'codex/bad branch;rm',
        upstream: 'origin/codex/bad',
      }),
    });

    expect(report.state).toBe('blocked');
    expect(codes(report.blockers)).toContain('invalid_branch_name');
  });

  test('branch behind upstream requires an explicit decision', async () => {
    const report = await evaluateCompletionPreconditions({
      cwd: '/repo',
      snapshot: snapshot({
        branch: 'codex/aco-stabilization-slices',
        upstream: 'origin/codex/aco-stabilization-slices',
        behind: 2,
      }),
    });

    expect(report.state).toBe('needs_decision');
    expect(codes(report.blockers)).toContain('branch_behind_upstream');
    expect(report.nextRecommendedAction).toContain('Update from upstream');
  });

  test('missing upstream returns unknown instead of fake readiness', async () => {
    const missingUpstream = snapshot({
      branch: 'codex/aco-stabilization-slices',
    });
    delete missingUpstream.upstream;

    const report = await evaluateCompletionPreconditions({
      cwd: '/repo',
      snapshot: missingUpstream,
    });

    expect(report.state).toBe('unknown');
    expect(codes(report.warnings)).toContain('missing_upstream');
  });

  test('branch ahead upstream is a warning while completion remains locally ready', async () => {
    const report = await evaluateCompletionPreconditions({
      cwd: '/repo',
      snapshot: snapshot({
        branch: 'codex/aco-stabilization-slices',
        upstream: 'origin/codex/aco-stabilization-slices',
        ahead: 3,
      }),
    });

    expect(report.state).toBe('ready');
    expect(codes(report.warnings)).toContain('branch_ahead_upstream');
    expect(report.reasons.every(reason => reason.code !== 'git_inspection_failed')).toBe(true);
  });

  test('git inspection failures preserve structured unknown state', async () => {
    const report = await evaluateCompletionPreconditions({
      cwd: '/repo',
      snapshot: snapshot({
        branch: 'codex/aco-stabilization-slices',
        upstream: 'origin/codex/aco-stabilization-slices',
        inspectionErrors: ['status: not a git repository'],
      }),
    });

    expect(report.state).toBe('unknown');
    expect(codes(report.warnings)).toContain('git_inspection_failed');
  });
});

function snapshot(overrides: Partial<GitPreconditionSnapshot>): GitPreconditionSnapshot {
  return {
    branch: 'codex/aco-stabilization-slices',
    porcelainStatus: '',
    upstream: 'origin/codex/aco-stabilization-slices',
    ahead: 0,
    behind: 0,
    inspectionErrors: [],
    ...overrides,
  };
}

function codes(items: Array<{ code: CompletionPreconditionsCode }>): CompletionPreconditionsCode[] {
  return items.map(item => item.code);
}
