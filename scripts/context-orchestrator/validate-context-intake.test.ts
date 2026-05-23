import { describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { evaluateContextIntake, type ContextIntakeCode } from './validate-context-intake';

describe('ACO Context Intake gate', () => {
  test('clean committed reusable context passes and returns output contract', async () => {
    const repo = await fixtureRepo({
      'CLAUDE.md': 'Use typed code. Runtime tool availability must be verified by commands.\n',
      '.archon/commands/defaults/assist.md':
        '---\ndescription: Assist safely\n---\nRead repo context and report evidence.\n',
    });

    const report = await evaluateContextIntake({ cwd: repo, timestamp: '2026-05-23T00:00:00Z' });

    expect(report.schemaVersion).toBe('aco.context-intake.v1');
    expect(report.state).toBe('ready');
    expect(report.reasons).toEqual([]);
    expect(report.blockers).toEqual([]);
    expect(report.evidence.length).toBeGreaterThan(0);
    expect(report.nextRecommendedAction).toContain('Proceed');
    expect(report.checkedAt).toBe('2026-05-23T00:00:00Z');
  });

  test('real developer-local path in reusable artifact is blocked', async () => {
    const repo = await fixtureRepo({
      '.archon/commands/defaults/bad.md':
        'Use /Users/edam/Documents/TODA/Archon as the repository root.\n',
      '.claude/skills/test-release/SKILL.md':
        'Dev binary: /Users/rasmus/.bun/bin/archon (unchanged)\n',
    });

    const report = await evaluateContextIntake({ cwd: repo });

    expect(report.state).toBe('blocked');
    expect(codes(report.blockers).filter(code => code === 'developer_local_path')).toHaveLength(2);
  });

  test('fake local path is allowed only in clearly marked fixture or example', async () => {
    const allowed = await fixtureRepo({
      'docs/examples/local-path.md':
        'Example fixture for redaction behavior: /Users/alice/example-repo must be rejected.\n',
    });
    const rejected = await fixtureRepo({
      '.archon/commands/defaults/local.md': 'Open /Users/alice/example-repo before coding.\n',
    });

    expect((await evaluateContextIntake({ cwd: allowed })).state).toBe('ready');

    const report = await evaluateContextIntake({ cwd: rejected });
    expect(report.state).toBe('blocked');
    expect(codes(report.blockers)).toContain('developer_local_path');
  });

  test('branch-specific default command assumption is blocked', async () => {
    const repo = await fixtureRepo({
      '.archon/commands/defaults/goal.md':
        'Supported invocation: /goal stabilize-aco-merge-ready on codex/aco-context-intake-gate.\n',
    });

    const report = await evaluateContextIntake({ cwd: repo });

    expect(report.state).toBe('blocked');
    expect(codes(report.blockers)).toContain('branch_specific_assumption');
  });

  test('runtime-readiness claim based only on prompt text is blocked', async () => {
    const repo = await fixtureRepo({
      'docs/ai/bootstrap.md':
        'Context7 ready. MCP available. Run bun run validate later before implementation.\n',
    });

    const report = await evaluateContextIntake({ cwd: repo });

    expect(report.state).toBe('blocked');
    expect(codes(report.blockers)).toContain('static_runtime_readiness_claim');
  });

  test('generated artifact without lifecycle is blocked', async () => {
    const repo = await fixtureRepo({
      'docs/context-orchestrator/stabilization/status-report.md':
        '# Status Report\n\nFinal recommendation: ready.\n\nValidation passed.\n',
    });

    const report = await evaluateContextIntake({ cwd: repo });

    expect(report.state).toBe('blocked');
    expect(codes(report.blockers)).toContain('generated_artifact_without_lifecycle');
  });

  test('provider-specific default hook is blocked unless explicitly opt-in', async () => {
    const blocked = await fixtureRepo({
      '.claude/settings.json': JSON.stringify({
        hooks: {
          Stop: [{ hooks: [{ type: 'command', command: 'kild agent-status --self idle' }] }],
        },
      }),
    });
    const hiddenByNote = await fixtureRepo({
      '.claude/settings.json': JSON.stringify({
        note: 'Optional opt-in provider hook template.',
        hooks: {
          Stop: [{ hooks: [{ type: 'command', command: 'kild agent-status --self idle' }] }],
        },
      }),
    });
    const allowed = await fixtureRepo({
      '.claude/settings.json': JSON.stringify({
        env: {
          CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1',
        },
      }),
    });

    const blockedReport = await evaluateContextIntake({ cwd: blocked });
    expect(blockedReport.state).toBe('blocked');
    expect(codes(blockedReport.blockers)).toContain('provider_specific_default');
    expect(codes(blockedReport.blockers)).toContain('undeclared_private_tool');

    const hiddenByNoteReport = await evaluateContextIntake({ cwd: hiddenByNote });
    expect(hiddenByNoteReport.state).toBe('blocked');
    expect(codes(hiddenByNoteReport.blockers)).toContain('provider_specific_default');

    expect((await evaluateContextIntake({ cwd: allowed })).state).toBe('ready');
  });

  test('readiness claim without evidence is blocked', async () => {
    const repo = await fixtureRepo({
      'docs/aco-readiness.md': 'Readiness: ready. Validation passed.\n',
    });

    const report = await evaluateContextIntake({ cwd: repo });

    expect(report.state).toBe('blocked');
    expect(codes(report.blockers)).toContain('readiness_claim_without_evidence');
  });

  test('scan failures return structured unknown state instead of throwing', async () => {
    const repo = await fixtureRepo({
      'docs/context.md': 'Reusable context surface.\n',
    });
    await unlink(join(repo, 'docs/context.md'));

    const report = await evaluateContextIntake({ cwd: repo });

    expect(report.state).toBe('unknown');
    expect(codes(report.warnings)).toContain('scan_incomplete');
    expect(report.evidence.length).toBeGreaterThan(0);
    expect(report.nextRecommendedAction).toContain('Resolve warnings');
  });
});

async function fixtureRepo(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'aco-context-intake-'));
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(root, path);
    await mkdir(dirname(fullPath), { recursive: true });
    await Bun.write(fullPath, content);
  }
  await run(root, ['git', 'init']);
  await run(root, ['git', 'add', '.']);
  return root;
}

async function run(cwd: string, command: string[]): Promise<void> {
  const proc = Bun.spawn(command, { cwd, stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(
      [`${command.join(' ')} failed with ${String(exitCode)}`, stdout, stderr]
        .filter(Boolean)
        .join('\n')
    );
  }
}

function codes(findings: Array<{ code: ContextIntakeCode }>): ContextIntakeCode[] {
  return findings.map(finding => finding.code);
}
