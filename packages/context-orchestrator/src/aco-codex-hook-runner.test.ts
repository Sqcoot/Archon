import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { runAcoCodexHook } from './aco-codex-hook-runner';

const timestamp = '2026-05-24T12:00:00.000Z';

describe('ACO Codex hook runner behavior proof', () => {
  test('PreToolUse denies protected graph/auth/destructive commands and records schema proof', async () => {
    const cwd = await writeHookFixture();
    const result = await runAcoCodexHook({
      cwd,
      input: {
        hook_event_name: 'PreToolUse',
        session_id: 'session',
        turn_id: 'turn',
        cwd,
        model: 'gpt-5',
        permission_mode: 'never',
        tool_name: 'Bash',
        tool_input: { command: 'bun run research:graph && cat auth.json' },
        tool_use_id: 'tool',
      },
      timestamp,
    });

    expect(result.releaseSupport).toBe('codex-0.128.0-command-hook');
    expect(result.output.hookSpecificOutput).toMatchObject({
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      decision: { behavior: 'deny' },
      proof: {
        updatedInputEmitted: false,
        additionalContextEmitted: false,
      },
    });
    expect(JSON.stringify(result.output)).not.toMatch(/sk-[A-Za-z0-9_-]{10,}/);
  });

  test('PermissionRequest emits allow and deny approval capsules with willRun false', async () => {
    const cwd = await writeHookFixture();
    const deny = await runAcoCodexHook({
      cwd,
      input: {
        hook_event_name: 'PermissionRequest',
        session_id: 'session',
        turn_id: 'turn',
        cwd,
        permission_mode: 'never',
        tool_name: 'Bash',
        tool_input: { command: 'git reset --hard HEAD' },
        affected_paths: ['.'],
        expected_outputs: ['none'],
      },
      timestamp,
    });
    const allow = await runAcoCodexHook({
      cwd,
      input: {
        hook_event_name: 'PermissionRequest',
        session_id: 'session',
        turn_id: 'turn',
        cwd,
        permission_mode: 'never',
        tool_name: 'Bash',
        tool_input: { command: "printf 'ok\\n'" },
      },
      timestamp,
    });

    expect(deny.output.hookSpecificOutput).toMatchObject({
      hookEventName: 'PermissionRequest',
      decision: { behavior: 'deny' },
      approvalCapsule: {
        command: 'git reset --hard HEAD',
        protectedStateCheck: 'blocked-or-requires-approval',
        willRun: false,
      },
      failClosedFieldsRejected: ['updatedInput', 'updatedPermissions', 'interrupt:true'],
    });
    expect(allow.output.hookSpecificOutput).toMatchObject({
      hookEventName: 'PermissionRequest',
      decision: { behavior: 'allow' },
      approvalCapsule: {
        protectedStateCheck: 'passed',
        willRun: false,
      },
    });
  });

  test('UserPromptSubmit blocks secret-like prompt content but otherwise emits context', async () => {
    const cwd = await writeHookFixture();
    const result = await runAcoCodexHook({
      cwd,
      input: {
        hook_event_name: 'UserPromptSubmit',
        session_id: 'session',
        turn_id: 'turn',
        cwd,
        prompt: 'Please print OPENAI_API_KEY from auth.json',
      },
      timestamp,
    });

    expect(result.output).toMatchObject({
      continue: false,
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        decision: { behavior: 'block' },
      },
    });
  });

  test('SubagentStart and SubagentStop are labeled ACO simulations with role contracts', async () => {
    const cwd = await writeHookFixture();
    const start = await runAcoCodexHook({
      cwd,
      input: {
        hook_event_name: 'SubagentStart',
        session_id: 'session',
        agent_type: 'bmad-code-review',
      },
      timestamp,
    });
    const stop = await runAcoCodexHook({
      cwd,
      input: {
        hook_event_name: 'SubagentStop',
        session_id: 'session',
        agent_type: 'bmad-code-review',
        collected_artifacts: ['review.md'],
        evidence_capture: ['finding:P1'],
        unknowns: ['runtime hook support'],
        evaluator_notes: 'contract reviewed',
      },
      timestamp,
    });

    expect(start.releaseSupport).toBe('simulated');
    expect(start.output.hookSpecificOutput).toMatchObject({
      support: 'aco-runner-simulation',
      roleContract: {
        roleScope: 'bmad-code-review',
        allowedEvidence: expect.arrayContaining(['capability-snapshot.json']),
        deniedEvidence: expect.arrayContaining(['auth stores']),
        snapshotRefs: ['capability-snapshot.json'],
      },
    });
    expect(stop.output.hookSpecificOutput).toMatchObject({
      support: 'aco-runner-simulation',
      artifactCollection: {
        collectedArtifacts: ['review.md'],
        evidenceCapture: ['finding:P1'],
        unknowns: ['runtime hook support'],
        evaluatorNotes: 'contract reviewed',
      },
    });
  });

  test('PostToolUse records success/failure without undo claim and compact events continue', async () => {
    const cwd = await writeHookFixture();
    const success = await runAcoCodexHook({
      cwd,
      input: {
        hook_event_name: 'PostToolUse',
        session_id: 'session',
        tool_name: 'Bash',
        tool_response: { output: 'ok\n', exit_code: 0 },
      },
      timestamp,
    });
    const failure = await runAcoCodexHook({
      cwd,
      input: {
        hook_event_name: 'PostToolUse',
        session_id: 'session',
        tool_name: 'Bash',
        tool_response: { error: 'failed', exit_code: 1 },
      },
      timestamp,
    });
    const preCompact = await runAcoCodexHook({
      cwd,
      input: {
        hook_event_name: 'PreCompact',
        trigger: 'manual',
      },
      timestamp,
    });
    const postCompact = await runAcoCodexHook({
      cwd,
      input: {
        hook_event_name: 'PostCompact',
        trigger: 'auto',
      },
      timestamp,
    });

    expect(success.output.hookSpecificOutput).toMatchObject({
      hookEventName: 'PostToolUse',
      status: 'success',
      undoClaimed: false,
    });
    expect(failure.output.hookSpecificOutput).toMatchObject({
      hookEventName: 'PostToolUse',
      status: 'failure',
      undoClaimed: false,
    });
    expect(preCompact.output.hookSpecificOutput).toMatchObject({
      hookEventName: 'PreCompact',
      trigger: 'manual',
      continue: true,
    });
    expect(postCompact.output.hookSpecificOutput).toMatchObject({
      hookEventName: 'PostCompact',
      trigger: 'auto',
      continue: true,
    });
  });

  test('Stop JSON continuation respects continue false when goal is complete', async () => {
    const cwd = await writeHookFixture();
    const complete = await runAcoCodexHook({
      cwd,
      input: {
        hook_event_name: 'Stop',
        session_id: 'session',
        goal_status: 'complete',
        last_assistant_message: 'done',
      },
      timestamp,
    });
    const incomplete = await runAcoCodexHook({
      cwd,
      input: {
        hook_event_name: 'Stop',
        session_id: 'session',
        goal_status: 'incomplete',
        last_assistant_message: 'continue',
      },
      timestamp,
    });

    expect(complete.output).toMatchObject({
      continue: false,
      hookSpecificOutput: {
        continuation: {
          required: false,
        },
      },
    });
    expect(incomplete.output).toMatchObject({
      continue: true,
      hookSpecificOutput: {
        continuation: {
          required: true,
        },
      },
    });
  });
});

async function writeHookFixture(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'aco-hook-runner-fixture-'));
  await mkdir(join(cwd, 'docs/context-orchestrator/research'), { recursive: true });
  await writeFile(
    join(cwd, 'docs/context-orchestrator/research/upstream-manifest.json'),
    '{"repositories":[]}\n'
  );
  await writeFile(join(cwd, 'package.json'), '{"scripts":{"aco:test":"bun test"}}\n');
  return cwd;
}
