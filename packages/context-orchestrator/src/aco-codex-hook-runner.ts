import { appendFile } from 'fs/promises';
import {
  acoBootstrapEvents,
  buildAcoBootstrapContext,
  type AcoBootstrapEvent,
} from './capability-snapshot';
import { redactSecrets } from './security';

export const ACO_CODEX_HOOK_RUNNER_SCHEMA_VERSION = 'aco.codex-hook-runner.v1' as const;

export type AcoCodexHookReleaseSupport = 'codex-0.128.0-command-hook' | 'simulated';

export interface RunAcoCodexHookOptions {
  cwd: string;
  input: Record<string, unknown>;
  timestamp?: string;
  runId?: string;
  maxBytes?: number;
  logPath?: string;
}

export interface AcoCodexHookRunResult {
  schemaVersion: typeof ACO_CODEX_HOOK_RUNNER_SCHEMA_VERSION;
  event: AcoBootstrapEvent;
  releaseSupport: AcoCodexHookReleaseSupport;
  output: Record<string, unknown>;
  outputText: string;
}

const codex0128CommandHookEvents = new Set<AcoBootstrapEvent>([
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PermissionRequest',
  'PostToolUse',
  'Stop',
]);

export async function runAcoCodexHook(
  options: RunAcoCodexHookOptions
): Promise<AcoCodexHookRunResult> {
  const event = parseHookEvent(options.input.hook_event_name ?? options.input.hookEventName);
  const prompt = promptForEvent(options.input);
  const context = await buildAcoBootstrapContext({
    cwd: options.cwd,
    prompt,
    event,
    maxBytes: options.maxBytes ?? 4_000,
    timestamp: options.timestamp,
    goalStatus: event === 'Stop' ? goalStatusForInput(options.input) : 'unknown',
  });
  const releaseSupport = codex0128CommandHookEvents.has(event)
    ? 'codex-0.128.0-command-hook'
    : 'simulated';
  const output = outputForEvent(event, context.markdown, options.input);

  await appendHookLog(options, event, releaseSupport);

  return {
    schemaVersion: ACO_CODEX_HOOK_RUNNER_SCHEMA_VERSION,
    event,
    releaseSupport,
    output,
    outputText: `${JSON.stringify(output)}\n`,
  };
}

function parseHookEvent(value: unknown): AcoBootstrapEvent {
  if (typeof value === 'string' && acoBootstrapEvents.includes(value as AcoBootstrapEvent)) {
    return value as AcoBootstrapEvent;
  }
  return 'SessionStart';
}

function promptForEvent(input: Record<string, unknown>): string {
  if (typeof input.prompt === 'string' && input.prompt.trim()) return redactSecrets(input.prompt);
  if (typeof input.last_assistant_message === 'string' && input.last_assistant_message.trim()) {
    return redactSecrets(input.last_assistant_message);
  }
  const toolInput = input.tool_input;
  if (isRecord(toolInput) && typeof toolInput.command === 'string') {
    return redactSecrets(toolInput.command);
  }
  return 'ACO Codex hook runner.';
}

function outputForEvent(
  event: AcoBootstrapEvent,
  additionalContext: string,
  input: Record<string, unknown>
): Record<string, unknown> {
  const systemMessage = `ACO hook runner observed ${event}`;
  const observedInput = summarizeHookInput(input);
  switch (event) {
    case 'SessionStart':
      return {
        continue: true,
        systemMessage,
        hookSpecificOutput: {
          hookEventName: event,
          observedInput,
          additionalContext,
        },
      };
    case 'UserPromptSubmit': {
      const blockReason = promptBlockReason(input);
      if (blockReason !== null) {
        return {
          continue: false,
          stopReason: blockReason,
          systemMessage,
          hookSpecificOutput: {
            hookEventName: event,
            observedInput,
            decision: {
              behavior: 'block',
              message: blockReason,
            },
          },
        };
      }
      return {
        continue: true,
        systemMessage,
        hookSpecificOutput: {
          hookEventName: event,
          observedInput,
          additionalContext,
        },
      };
    }
    case 'PreToolUse': {
      const denial = preToolUseDenial(input);
      return denial === null
        ? {
            continue: true,
            systemMessage,
            hookSpecificOutput: {
              hookEventName: 'PreToolUse',
              observedInput,
              decision: {
                behavior: 'allow',
                message: 'ACO guard allowed tool input.',
              },
              proof: {
                updatedInputEmitted: false,
                additionalContextEmitted: false,
                error: null,
              },
            },
          }
        : {
            continue: true,
            systemMessage,
            hookSpecificOutput: {
              hookEventName: 'PreToolUse',
              observedInput,
              permissionDecision: 'deny',
              permissionDecisionReason: denial,
              decision: {
                behavior: 'deny',
                message: denial,
              },
              proof: {
                updatedInputEmitted: false,
                additionalContextEmitted: false,
                error: denial,
              },
            },
          };
    }
    case 'PermissionRequest': {
      const decision = permissionRequestDecision(input);
      return {
        continue: true,
        systemMessage,
        hookSpecificOutput: {
          hookEventName: 'PermissionRequest',
          observedInput,
          decision,
          approvalCapsule: {
            command: commandFromInput(input),
            reason: decision.message,
            requestedScope: stringOrNull(input.requested_scope) ?? 'tool execution',
            affectedPaths: arrayOfStrings(input.affected_paths),
            protectedStateCheck:
              decision.behavior === 'allow' ? 'passed' : 'blocked-or-requires-approval',
            expectedOutputs: arrayOfStrings(input.expected_outputs),
            willRun: false,
          },
          failClosedFieldsRejected: ['updatedInput', 'updatedPermissions', 'interrupt:true'],
        },
      };
    }
    case 'PostToolUse':
      return {
        continue: true,
        systemMessage,
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          observedInput,
          status: toolSucceeded(input) ? 'success' : 'failure',
          undoClaimed: false,
          additionalContext,
        },
      };
    case 'PreCompact':
      return {
        continue: true,
        systemMessage,
        hookSpecificOutput: {
          hookEventName: 'PreCompact',
          observedInput,
          trigger: stringOrNull(input.trigger) ?? stringOrNull(input.compact_trigger) ?? 'manual',
          continue: true,
        },
      };
    case 'PostCompact':
      return {
        continue: true,
        systemMessage,
        hookSpecificOutput: {
          hookEventName: 'PostCompact',
          observedInput,
          trigger: stringOrNull(input.trigger) ?? stringOrNull(input.compact_trigger) ?? 'manual',
          continue: true,
          additionalContext,
        },
      };
    case 'SubagentStart':
      return {
        continue: true,
        systemMessage,
        hookSpecificOutput: {
          hookEventName: 'SubagentStart',
          observedInput,
          support: 'aco-runner-simulation',
          roleContract: {
            roleScope: stringOrNull(input.agent_type) ?? 'aco-subagent',
            allowedEvidence: [
              'capability-snapshot.json',
              'aco-bootstrap-context.json',
              'tool-availability-ledger.json',
              'commands-ledger.json',
            ],
            deniedEvidence: [
              'active user Codex config',
              'auth stores',
              'MCP OAuth state',
              'provider credentials',
              'unmanaged .codex files',
            ],
            snapshotRefs: ['capability-snapshot.json'],
            artifactExpectations: [
              'role output artifact',
              'evidence claims',
              'unknowns',
              'evaluator notes when applicable',
            ],
          },
        },
      };
    case 'SubagentStop':
      return {
        continue: true,
        systemMessage,
        hookSpecificOutput: {
          hookEventName: 'SubagentStop',
          observedInput,
          support: 'aco-runner-simulation',
          artifactCollection: {
            collectedArtifacts: arrayOfStrings(input.collected_artifacts),
            evidenceCapture: arrayOfStrings(input.evidence_capture),
            unknowns: arrayOfStrings(input.unknowns),
            evaluatorNotes: stringOrNull(input.evaluator_notes) ?? 'No evaluator notes supplied.',
          },
        },
      };
    case 'Stop': {
      const goalStatus = goalStatusForInput(input);
      const continuationRequired = goalStatus !== 'complete';
      return {
        continue: continuationRequired,
        systemMessage,
        hookSpecificOutput: {
          hookEventName: 'Stop',
          observedInput,
          continuation: {
            required: continuationRequired,
            reason: continuationRequired
              ? 'Goal incomplete or unknown; JSON continuation required.'
              : 'Goal complete; continue:false takes precedence.',
          },
        },
      };
    }
  }
}

function preToolUseDenial(input: Record<string, unknown>): string | null {
  const serialized = JSON.stringify(input.tool_input ?? {});
  if (/graphify|research:graph|refresh-graph/i.test(serialized)) {
    return 'ACO denied graph refresh from hook guard.';
  }
  if (/\b(rm\s+-rf|git\s+reset\s+--hard)\b/i.test(serialized)) {
    return 'ACO denied destructive command from hook guard.';
  }
  if (/(auth\.json|oauth|credential|OPENAI_API_KEY|sk-[A-Za-z0-9_-]{10,})/i.test(serialized)) {
    return 'ACO denied auth, OAuth, credential, or secret exposure from hook guard.';
  }
  return null;
}

function permissionRequestDecision(input: Record<string, unknown>): {
  behavior: 'allow' | 'deny';
  message: string;
} {
  const denial = preToolUseDenial(input);
  if (denial !== null) {
    return {
      behavior: 'deny',
      message: `ACO approval capsule denied request: ${denial}`,
    };
  }
  return {
    behavior: 'allow',
    message:
      'ACO approval capsule found no protected-state violation; willRun remains false until explicit approval.',
  };
}

function promptBlockReason(input: Record<string, unknown>): string | null {
  const prompt = typeof input.prompt === 'string' ? input.prompt : '';
  if (/(auth\.json|oauth|credential|OPENAI_API_KEY|sk-[A-Za-z0-9_-]{10,})/i.test(prompt)) {
    return 'ACO blocked secret-like prompt content before submission.';
  }
  return null;
}

function commandFromInput(input: Record<string, unknown>): string {
  const toolInput = input.tool_input;
  if (isRecord(toolInput) && typeof toolInput.command === 'string') {
    return redactSecrets(toolInput.command);
  }
  return stringOrNull(input.tool_name) ?? 'unknown tool';
}

function toolSucceeded(input: Record<string, unknown>): boolean {
  const response = input.tool_response;
  if (!isRecord(response)) return true;
  const exitCode = response.exit_code ?? response.exitCode;
  if (typeof exitCode === 'number') return exitCode === 0;
  if (typeof response.error === 'string' && response.error.trim()) return false;
  return true;
}

function summarizeHookInput(input: Record<string, unknown>): Record<string, unknown> {
  return {
    sessionId: stringOrNull(input.session_id) ?? stringOrNull(input.sessionId),
    turnId: stringOrNull(input.turn_id) ?? stringOrNull(input.turnId),
    cwd: stringOrNull(input.cwd),
    model: stringOrNull(input.model),
    permissionMode: stringOrNull(input.permission_mode) ?? stringOrNull(input.permissionMode),
    prompt: typeof input.prompt === 'string' ? redactSecrets(input.prompt) : null,
    tool: {
      name: stringOrNull(input.tool_name) ?? stringOrNull(input.toolName),
      input: redactUnknown(input.tool_input ?? null),
      response: redactUnknown(input.tool_response ?? null),
      useId: stringOrNull(input.tool_use_id) ?? stringOrNull(input.toolUseId),
    },
    agent: {
      type: stringOrNull(input.agent_type) ?? stringOrNull(input.agentType),
    },
    compact: {
      trigger: stringOrNull(input.trigger) ?? stringOrNull(input.compact_trigger),
    },
    stop: {
      active: typeof input.stop_hook_active === 'boolean' ? input.stop_hook_active : null,
      lastAssistantMessage:
        typeof input.last_assistant_message === 'string'
          ? redactSecrets(input.last_assistant_message)
          : null,
    },
  };
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map(redactSecrets)
    : [];
}

function goalStatusForInput(input: Record<string, unknown>): 'complete' | 'incomplete' | 'unknown' {
  const value = input.goal_status ?? input.goalStatus;
  return value === 'complete' || value === 'incomplete' ? value : 'unknown';
}

async function appendHookLog(
  options: RunAcoCodexHookOptions,
  event: AcoBootstrapEvent,
  releaseSupport: AcoCodexHookReleaseSupport
): Promise<void> {
  const logPath = options.logPath ?? process.env.ACO_HOOK_LOG;
  if (logPath === undefined || logPath.trim() === '') return;
  const row = {
    schemaVersion: 'aco.codex-hook-log-row.v1',
    runId: options.runId ?? process.env.ACO_TEST_RUN_ID ?? 'unknown',
    event,
    releaseSupport,
    toolName: stringOrNull(options.input.tool_name),
    source: stringOrNull(options.input.source),
    trigger: stringOrNull(options.input.trigger),
    agentType: stringOrNull(options.input.agent_type),
    timestamp: options.timestamp ?? new Date().toISOString(),
    input: redactUnknown(options.input),
  };
  await appendFile(logPath, `${JSON.stringify(row)}\n`, 'utf8');
}

function redactUnknown(value: unknown): unknown {
  if (typeof value === 'string') return redactSecrets(value);
  if (Array.isArray(value)) return value.map(redactUnknown);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, redactUnknown(entry)])
    );
  }
  return value;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? redactSecrets(value) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
