import { ensureUtc } from '@/lib/format';
import type { WorkflowDiagnosticEvent } from '@/lib/types';

function recordFromUnknown(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function workflowPersistenceDiagnosticsFromMetadata(
  runId: string,
  metadata: unknown
): WorkflowDiagnosticEvent[] {
  const record = recordFromUnknown(metadata);
  if (!record) return [];

  const diagnostics: WorkflowDiagnosticEvent[] = [];
  const validationBlock = recordFromUnknown(record.workflow_pre_execution_validation);
  const validationStatus =
    typeof validationBlock?.status === 'string' ? validationBlock.status : undefined;
  const validationMessage =
    typeof validationBlock?.message === 'string' ? validationBlock.message : undefined;
  const hookBootloaderReportPath =
    typeof validationBlock?.hook_bootloader_report_path === 'string'
      ? validationBlock.hook_bootloader_report_path
      : undefined;
  const hookBadBehaviourLintPath =
    typeof validationBlock?.hook_bad_behaviour_lint_path === 'string'
      ? validationBlock.hook_bad_behaviour_lint_path
      : undefined;

  if (validationStatus === 'blocked' && validationMessage) {
    diagnostics.push({
      type: 'workflow_diagnostic',
      runId,
      severity: 'error',
      code: 'workflow_pre_execution_validation_blocked',
      message: validationMessage,
      persistence: 'persisted',
      ...(hookBootloaderReportPath || hookBadBehaviourLintPath
        ? { artifactPath: hookBootloaderReportPath ?? hookBadBehaviourLintPath }
        : {}),
      timestamp: Date.now(),
    });
  }

  const raw = record.workflow_event_persist_failures;
  if (!Array.isArray(raw)) return diagnostics;

  diagnostics.push(
    ...raw.flatMap((item): WorkflowDiagnosticEvent[] => {
      const diagnostic = recordFromUnknown(item);
      if (!diagnostic) return [];

      const eventType = typeof diagnostic.eventType === 'string' ? diagnostic.eventType : undefined;
      const reason = typeof diagnostic.reason === 'string' ? diagnostic.reason : undefined;
      if (!eventType || !reason) return [];

      const stepName = typeof diagnostic.stepName === 'string' ? diagnostic.stepName : undefined;
      const timestamp =
        typeof diagnostic.timestamp === 'string'
          ? new Date(ensureUtc(diagnostic.timestamp)).getTime()
          : Date.now();

      return [
        {
          type: 'workflow_diagnostic',
          runId,
          severity: 'warning',
          code: 'workflow_event_persist_failed',
          message: `Workflow event persistence failed for ${eventType}${stepName ? `/${stepName}` : ''}: ${reason}`,
          persistence: 'best_effort_failed',
          eventType,
          ...(stepName ? { stepName } : {}),
          timestamp,
        },
      ];
    })
  );

  return diagnostics;
}
