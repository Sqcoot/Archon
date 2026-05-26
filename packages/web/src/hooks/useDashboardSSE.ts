import { useEffect } from 'react';
import { workflowSSEHandlers } from '@/stores/workflow-store';
import type {
  WorkflowStatusEvent,
  WorkflowDiagnosticEvent,
  WorkflowArtifactEvent,
  DagNodeEvent,
  WorkflowToolActivityEvent,
  LoopIterationEvent,
} from '@/lib/types';

/** Connects to the multiplexed dashboard SSE stream and routes events to the Zustand store. */
export function useDashboardSSE(): void {
  useEffect(() => {
    const es = new EventSource('/api/stream/__dashboard__');

    es.onmessage = (e: MessageEvent<string>): void => {
      let event: { type: string };
      try {
        event = JSON.parse(e.data) as { type: string };
      } catch {
        workflowSSEHandlers.onWorkflowTransportDiagnostic({
          source: 'dashboard_sse',
          readyState: es.readyState,
          message:
            'Dashboard workflow event stream received a malformed event; live workflow status may be incomplete.',
        });
        return;
      }

      switch (event.type) {
        case 'workflow_status':
          workflowSSEHandlers.onWorkflowStatus(event as WorkflowStatusEvent);
          break;
        case 'workflow_diagnostic':
          workflowSSEHandlers.onWorkflowDiagnostic(event as WorkflowDiagnosticEvent);
          break;
        case 'workflow_artifact':
          workflowSSEHandlers.onWorkflowArtifact(event as WorkflowArtifactEvent);
          break;
        case 'dag_node':
          workflowSSEHandlers.onDagNode(event as DagNodeEvent);
          break;
        case 'workflow_tool_activity':
          workflowSSEHandlers.onToolActivity(event as WorkflowToolActivityEvent);
          break;
        case 'workflow_step':
          workflowSSEHandlers.onLoopIteration(event as LoopIterationEvent);
          break;
        case 'heartbeat':
          break;
        default:
          workflowSSEHandlers.onWorkflowTransportDiagnostic({
            source: 'dashboard_sse',
            readyState: es.readyState,
            message: `Dashboard workflow event stream received unsupported event type '${event.type}'; live workflow status may be incomplete.`,
          });
      }
    };

    es.onerror = (): void => {
      workflowSSEHandlers.onWorkflowTransportDiagnostic({
        source: 'dashboard_sse',
        readyState: es.readyState,
        message:
          es.readyState === EventSource.CLOSED
            ? 'Dashboard workflow event stream closed; workflow status may be stale until refresh.'
            : 'Dashboard workflow event stream is reconnecting; live workflow status may be temporarily stale.',
      });
    };

    return (): void => {
      es.close();
    };
  }, []); // mount once — stable handlers from Zustand module level
}
