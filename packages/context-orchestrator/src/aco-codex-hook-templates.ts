import { acoBootstrapEvents, type AcoBootstrapEvent } from './capability-snapshot';

export const ACO_CODEX_HOOK_TEMPLATE_SCHEMA_VERSION = 'aco.codex-hook-templates.v1' as const;
export const ACO_CODEX_HOOK_MANIFEST_TEMPLATE_SCHEMA_VERSION =
  'aco.codex-hook-manifest-template.v1' as const;
export const ACO_CODEX_RESEARCHED_RELEASE = 'codex-cli 0.128.0' as const;

export type AcoCodexHookSupport = 'codex-0.128.0-command-hook' | 'simulated';

export interface AcoCodexHookTemplate {
  schemaVersion: typeof ACO_CODEX_HOOK_TEMPLATE_SCHEMA_VERSION;
  event: AcoBootstrapEvent;
  release: typeof ACO_CODEX_RESEARCHED_RELEASE;
  support: AcoCodexHookSupport;
  acoUse: string;
  matcher: string | null;
  runnerContract: {
    command: string;
    input: string;
    output: string;
  };
  inert: boolean;
  notes: string[];
}

export interface AcoCodexHookManifestTemplate {
  schemaVersion: typeof ACO_CODEX_HOOK_MANIFEST_TEMPLATE_SCHEMA_VERSION;
  release: typeof ACO_CODEX_RESEARCHED_RELEASE;
  activeHooksJson: {
    hooks: Record<
      string,
      {
        matcher?: string;
        hooks: {
          type: 'command';
          command: string;
          timeout: number;
        }[];
      }[]
    >;
  };
  inertTemplates: AcoCodexHookTemplate[];
}

export const acoCodexCurrentCommandHookEvents = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PermissionRequest',
  'PostToolUse',
  'Stop',
] as const satisfies readonly AcoBootstrapEvent[];

const eventUses: Record<AcoBootstrapEvent, string> = {
  SessionStart: 'bootstrap',
  UserPromptSubmit: 'prompt routing',
  PreToolUse: 'tool guard',
  PermissionRequest: 'approval capsule',
  PostToolUse: 'evidence capture',
  PreCompact: 'precompact summary',
  PostCompact: 'postcompact reload',
  SubagentStart: 'role contract',
  SubagentStop: 'role artifact collection',
  Stop: 'evaluator continuation',
};

export function supportsCodexCommandHook(event: AcoBootstrapEvent): boolean {
  return acoCodexCurrentCommandHookEvents.includes(
    event as (typeof acoCodexCurrentCommandHookEvents)[number]
  );
}

export function buildAcoCodexHookTemplates(
  command = 'ACO_HOOK_RUNNER_COMMAND'
): AcoCodexHookTemplate[] {
  return acoBootstrapEvents.map(event => {
    const supported = supportsCodexCommandHook(event);
    return {
      schemaVersion: ACO_CODEX_HOOK_TEMPLATE_SCHEMA_VERSION,
      event,
      release: ACO_CODEX_RESEARCHED_RELEASE,
      support: supported ? 'codex-0.128.0-command-hook' : 'simulated',
      acoUse: eventUses[event],
      matcher: matcherForEvent(event),
      runnerContract: {
        command,
        input: 'Codex hook JSON on stdin with hook_event_name or hookEventName.',
        output: 'Codex hook JSON stdout conforming to installed event schema.',
      },
      inert: true,
      notes: supported
        ? [
            'Runnable as a command hook when placed in a trusted temp/project hook layer.',
            'Template is inert until written by an explicit harness or user action.',
          ]
        : [
            'Not an installed Codex 0.128.0 hook event.',
            'Covered by direct ACO runner simulation only.',
          ],
    };
  });
}

export function buildAcoCodexHookManifestTemplate(options: {
  command: string;
  timeoutSeconds?: number;
}): AcoCodexHookManifestTemplate {
  const timeout = options.timeoutSeconds ?? 30;
  const commandHook = {
    type: 'command' as const,
    command: options.command,
    timeout,
  };
  const hooks: AcoCodexHookManifestTemplate['activeHooksJson']['hooks'] = {};
  for (const event of acoCodexCurrentCommandHookEvents) {
    const matcher = matcherForEvent(event);
    hooks[event] = matcher ? [{ matcher, hooks: [commandHook] }] : [{ hooks: [commandHook] }];
  }

  return {
    schemaVersion: ACO_CODEX_HOOK_MANIFEST_TEMPLATE_SCHEMA_VERSION,
    release: ACO_CODEX_RESEARCHED_RELEASE,
    activeHooksJson: { hooks },
    inertTemplates: buildAcoCodexHookTemplates(options.command),
  };
}

function matcherForEvent(event: AcoBootstrapEvent): string | null {
  if (event === 'SessionStart') return 'startup|resume|clear';
  if (event === 'PreToolUse' || event === 'PostToolUse') return 'Bash|shell|local_shell';
  if (event === 'PermissionRequest') return 'Bash|shell|local_shell';
  return null;
}
