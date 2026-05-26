/**
 * Zod schemas for per-node hook configuration.
 */
import { z } from '@hono/zod-openapi';

/**
 * Supported hook events for per-node hooks.
 * Uses the same event names as the Claude Agent SDK's HookEvent type.
 */
export const workflowHookEventSchema = z.enum([
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'Notification',
  'UserPromptSubmit',
  'SessionStart',
  'SessionEnd',
  'Stop',
  'SubagentStart',
  'SubagentStop',
  'PreCompact',
  'PermissionRequest',
  'Setup',
  'TeammateIdle',
  'TaskCompleted',
  'Elicitation',
  'ElicitationResult',
  'ConfigChange',
  'WorktreeCreate',
  'WorktreeRemove',
  'InstructionsLoaded',
]);

export type WorkflowHookEvent = z.infer<typeof workflowHookEventSchema>;

/** Canonical list of hook events — derived from schema, do not duplicate. */
export const WORKFLOW_HOOK_EVENTS: readonly WorkflowHookEvent[] = workflowHookEventSchema.options;

/**
 * A single hook matcher in a YAML workflow definition.
 * Maps 1:1 to the SDK's HookCallbackMatcher.
 */
export const workflowHookMatcherSchema = z.object({
  /** Regex pattern to match tool names (PreToolUse/PostToolUse) or event subtypes. */
  matcher: z.string().optional(),
  /** The SDK SyncHookJSONOutput to return when this hook fires. */
  response: z.record(z.unknown()),
  /** Timeout in seconds (default: SDK default of 60). */
  timeout: z.number().positive().optional(),
});

export type WorkflowHookMatcher = z.infer<typeof workflowHookMatcherSchema>;

/**
 * Per-node hook configuration keyed by event name.
 * Each event maps to an array of matchers with static responses.
 *
 * Fields are listed explicitly (not z.record) so TypeScript narrows event names
 * to the WorkflowHookEvent union. `.strict()` rejects unknown keys, producing
 * clear validation errors for typos like 'preToolUse'.
 */
export const workflowNodeHooksSchema = z
  .object({
    PreToolUse: z.array(workflowHookMatcherSchema).nonempty().optional(),
    PostToolUse: z.array(workflowHookMatcherSchema).nonempty().optional(),
    PostToolUseFailure: z.array(workflowHookMatcherSchema).nonempty().optional(),
    Notification: z.array(workflowHookMatcherSchema).nonempty().optional(),
    UserPromptSubmit: z.array(workflowHookMatcherSchema).nonempty().optional(),
    SessionStart: z.array(workflowHookMatcherSchema).nonempty().optional(),
    SessionEnd: z.array(workflowHookMatcherSchema).nonempty().optional(),
    Stop: z.array(workflowHookMatcherSchema).nonempty().optional(),
    SubagentStart: z.array(workflowHookMatcherSchema).nonempty().optional(),
    SubagentStop: z.array(workflowHookMatcherSchema).nonempty().optional(),
    PreCompact: z.array(workflowHookMatcherSchema).nonempty().optional(),
    PermissionRequest: z.array(workflowHookMatcherSchema).nonempty().optional(),
    Setup: z.array(workflowHookMatcherSchema).nonempty().optional(),
    TeammateIdle: z.array(workflowHookMatcherSchema).nonempty().optional(),
    TaskCompleted: z.array(workflowHookMatcherSchema).nonempty().optional(),
    Elicitation: z.array(workflowHookMatcherSchema).nonempty().optional(),
    ElicitationResult: z.array(workflowHookMatcherSchema).nonempty().optional(),
    ConfigChange: z.array(workflowHookMatcherSchema).nonempty().optional(),
    WorktreeCreate: z.array(workflowHookMatcherSchema).nonempty().optional(),
    WorktreeRemove: z.array(workflowHookMatcherSchema).nonempty().optional(),
    InstructionsLoaded: z.array(workflowHookMatcherSchema).nonempty().optional(),
  })
  .strict();

export type WorkflowNodeHooks = z.infer<typeof workflowNodeHooksSchema>;
