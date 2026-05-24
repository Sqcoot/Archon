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
    goalStatus: event === 'Stop' ? 'complete' : 'unknown',
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
  switch (event) {
    case 'SessionStart':
    case 'UserPromptSubmit':
      return {
        continue: true,
        systemMessage,
        hookSpecificOutput: {
          hookEventName: event,
          additionalContext,
        },
      };
    case 'PreToolUse': {
      const denial = preToolUseDenial(input);
      return denial === null
        ? {
            continue: true,
            systemMessage,
            hookSpecificOutput: {
              hookEventName: 'PreToolUse',
            },
          }
        : {
            continue: true,
            systemMessage,
            hookSpecificOutput: {
              hookEventName: 'PreToolUse',
              permissionDecision: 'deny',
              permissionDecisionReason: denial,
            },
          };
    }
    case 'PermissionRequest':
      return {
        continue: true,
        systemMessage,
        hookSpecificOutput: {
          hookEventName: 'PermissionRequest',
        },
      };
    case 'PostToolUse':
      return {
        continue: true,
        systemMessage,
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext,
        },
      };
    case 'Stop':
    case 'PreCompact':
    case 'PostCompact':
    case 'SubagentStart':
    case 'SubagentStop':
      return {
        continue: true,
        systemMessage,
      };
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
