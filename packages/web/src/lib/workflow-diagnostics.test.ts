import { describe, expect, test } from 'bun:test';
import { workflowPersistenceDiagnosticsFromMetadata } from './workflow-diagnostics';

describe('workflowPersistenceDiagnosticsFromMetadata', () => {
  test('surfaces persisted pre-execution validation blocks from run metadata', () => {
    const diagnostics = workflowPersistenceDiagnosticsFromMetadata('run-1', {
      workflow_pre_execution_validation: {
        status: 'blocked',
        message: 'Codex hook preflight blocked this workflow',
        hook_bootloader_report_path: '/tmp/codex-hook-bootloader-report.json',
        hook_bad_behaviour_lint_path: '/tmp/codex-hook-bad-behaviour-lint.json',
      },
    });

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      type: 'workflow_diagnostic',
      runId: 'run-1',
      severity: 'error',
      code: 'workflow_pre_execution_validation_blocked',
      message: 'Codex hook preflight blocked this workflow',
      persistence: 'persisted',
      artifactPath: '/tmp/codex-hook-bootloader-report.json',
    });
  });

  test('keeps event persistence failures visible alongside validation diagnostics', () => {
    const diagnostics = workflowPersistenceDiagnosticsFromMetadata('run-2', {
      workflow_pre_execution_validation: {
        status: 'blocked',
        message: 'Provider capability validation blocked this workflow',
      },
      workflow_event_persist_failures: [
        {
          eventType: 'approval_requested',
          stepName: 'deploy',
          reason: 'database unavailable',
          persistence: 'best_effort_failed',
          timestamp: '2026-05-26T12:00:00Z',
        },
      ],
    });

    expect(diagnostics.map(diagnostic => diagnostic.code)).toEqual([
      'workflow_pre_execution_validation_blocked',
      'workflow_event_persist_failed',
    ]);
    expect(diagnostics[1]).toMatchObject({
      severity: 'warning',
      persistence: 'best_effort_failed',
      eventType: 'approval_requested',
      stepName: 'deploy',
    });
  });
});
