import { describe, expect, test } from 'bun:test';
import { mapWorkflowEvent } from './workflow-bridge';

describe('mapWorkflowEvent', () => {
  test('preserves pre-execution validation metadata in failed workflow status events', () => {
    const mapped = mapWorkflowEvent({
      type: 'workflow_failed',
      runId: 'run-1',
      workflowName: 'deploy',
      error: 'Codex hook preflight blocked this workflow',
      failureStage: 'pre_execution_validation',
      artifactPath: '/tmp/codex-hook-bootloader-report.json',
      workflowPreExecutionValidation: {
        status: 'blocked',
        message: 'Codex hook preflight blocked this workflow',
        hook_bootloader_report_path: '/tmp/codex-hook-bootloader-report.json',
        hook_bad_behaviour_lint_path: '/tmp/codex-hook-bad-behaviour-lint.json',
      },
    });

    expect(mapped).not.toBeNull();
    const status = JSON.parse(mapped ?? '{}') as {
      type?: string;
      runId?: string;
      workflowName?: string;
      status?: string;
      error?: string;
      failureStage?: string;
      artifactPath?: string;
      workflowPreExecutionValidation?: {
        status?: string;
        hook_bootloader_report_path?: string;
        hook_bad_behaviour_lint_path?: string;
      };
    };

    expect(status).toMatchObject({
      type: 'workflow_status',
      runId: 'run-1',
      workflowName: 'deploy',
      status: 'failed',
      error: 'Codex hook preflight blocked this workflow',
      failureStage: 'pre_execution_validation',
      artifactPath: '/tmp/codex-hook-bootloader-report.json',
      workflowPreExecutionValidation: {
        status: 'blocked',
        hook_bootloader_report_path: '/tmp/codex-hook-bootloader-report.json',
        hook_bad_behaviour_lint_path: '/tmp/codex-hook-bad-behaviour-lint.json',
      },
    });
  });

  test('preserves workflow artifact diagnostic path metadata', () => {
    const mapped = mapWorkflowEvent({
      type: 'workflow_artifact',
      runId: 'run-1',
      artifactType: 'file_created',
      label: 'Recorded external artifact',
      absolutePath: '/tmp/outside/report.md',
      originalPath: '../report.md',
      failureStage: 'pre_execution_validation',
    });

    expect(mapped).not.toBeNull();
    const artifact = JSON.parse(mapped ?? '{}') as {
      type?: string;
      runId?: string;
      label?: string;
      path?: string;
      absolutePath?: string;
      originalPath?: string;
      failureStage?: string;
    };

    expect(artifact).toMatchObject({
      type: 'workflow_artifact',
      runId: 'run-1',
      label: 'Recorded external artifact',
      absolutePath: '/tmp/outside/report.md',
      originalPath: '../report.md',
      failureStage: 'pre_execution_validation',
    });
    expect(artifact.path).toBeUndefined();
  });

  test('maps workflow event persistence failures to visible diagnostics', () => {
    const mapped = mapWorkflowEvent({
      type: 'workflow_event_persist_failed',
      runId: 'run-1',
      eventType: 'approval_requested',
      stepName: 'deploy-gate',
      reason: 'database createWorkflowEvent returned best-effort failure',
      persistence: 'best_effort_failed',
    });

    expect(mapped).not.toBeNull();
    const diagnostic = JSON.parse(mapped ?? '{}') as {
      type?: string;
      runId?: string;
      severity?: string;
      code?: string;
      message?: string;
      persistence?: string;
      eventType?: string;
      stepName?: string;
    };

    expect(diagnostic).toMatchObject({
      type: 'workflow_diagnostic',
      runId: 'run-1',
      severity: 'warning',
      code: 'workflow_event_persist_failed',
      persistence: 'best_effort_failed',
      eventType: 'approval_requested',
      stepName: 'deploy-gate',
    });
    expect(diagnostic.message).toContain('approval_requested/deploy-gate');
    expect(diagnostic.message).toContain('best-effort failure');
  });

  test('preserves custom high-impact approval metadata in workflow status events', () => {
    const mapped = mapWorkflowEvent({
      type: 'approval_pending',
      runId: 'run-1',
      nodeId: 'network-gate',
      message: 'Change network boundary?',
      mutationClass: 'network_boundary',
      command: 'configure-network-boundary',
      reason: 'Changes external network access',
      approvalChannel: 'web',
      highImpact: true,
      highImpactConfirmed: false,
      defaultScope: 'once',
      allowedScopes: ['once'],
    });

    expect(mapped).not.toBeNull();
    const status = JSON.parse(mapped ?? '{}') as {
      type?: string;
      status?: string;
      approval?: {
        mutationClass?: string;
        highImpact?: boolean;
        highImpactConfirmed?: boolean;
        command?: string;
        reason?: string;
        approvalChannel?: string;
        defaultScope?: string;
        allowedScopes?: string[];
      };
    };

    expect(status).toMatchObject({
      type: 'workflow_status',
      status: 'paused',
      approval: {
        mutationClass: 'network_boundary',
        highImpact: true,
        highImpactConfirmed: false,
        command: 'configure-network-boundary',
        reason: 'Changes external network access',
        approvalChannel: 'web',
        defaultScope: 'once',
        allowedScopes: ['once'],
      },
    });
  });
});
