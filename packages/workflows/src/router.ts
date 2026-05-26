/**
 * Workflow Router - builds prompts and detects workflow invocation
 */
import { isApprovalNode, type WorkflowDefinition } from './schemas';
import { createLogger } from '@archon/paths';

/** Lazy-initialized logger (deferred so test mocks can intercept createLogger) */
let cachedLog: ReturnType<typeof createLogger> | undefined;
function getLog(): ReturnType<typeof createLogger> {
  if (!cachedLog) cachedLog = createLogger('workflow.router');
  return cachedLog;
}

/**
 * Optional context for router to make informed decisions.
 * Constructed by the orchestrator from platform type, issue context strings, and isolation hints.
 */
export interface RouterContext {
  /** Platform type identifier from the adapter (e.g., 'github', 'slack', 'telegram', 'test') */
  platformType?: string;
  /** Whether this is a PR vs issue - currently only relevant for GitHub */
  isPullRequest?: boolean;
  /** Issue or PR title */
  title?: string;
  /** Issue or PR labels */
  labels?: string[];
  /** Thread/comment history - previous messages for context */
  threadHistory?: string;
  /** Workflow type hint (e.g., 'pr-review', 'issue', etc.) */
  workflowType?: string;
}

/**
 * Build the context section for the router prompt.
 * Returns formatted lines for each context property present (platform, type, title, labels, history).
 * Returns empty string if context is undefined or has no populated properties.
 */
function buildContextSection(context?: RouterContext): string {
  if (!context) return '';

  const parts: string[] = [];

  if (context.platformType) {
    parts.push(`Platform: ${context.platformType}`);
  }

  if (context.isPullRequest !== undefined) {
    parts.push(`Type: ${context.isPullRequest ? 'Pull Request' : 'Issue'}`);
  } else if (context.workflowType) {
    parts.push(`Type: ${context.workflowType}`);
  }

  if (context.title) {
    parts.push(`Title: ${context.title}`);
  }

  if (context.labels && context.labels.length > 0) {
    parts.push(`Labels: ${context.labels.join(', ')}`);
  }

  if (context.threadHistory) {
    parts.push(`\nThread History:\n${context.threadHistory}`);
  }

  return parts.length > 0 ? parts.join('\n') : '';
}

export function isHumanInLoopWorkflow(workflow: WorkflowDefinition): boolean {
  const mode = workflow.mode ?? (workflow.interactive === true ? 'guided' : undefined);
  const legacyCheckoutMutation =
    workflow.lock_scope === undefined && workflow.mutates_checkout !== false;
  return (
    mode === 'guided' ||
    mode === 'interactive_only' ||
    workflow.lock_scope === 'external_side_effect' ||
    workflow.lock_scope === 'checkout_mutation' ||
    legacyCheckoutMutation ||
    workflow.interactive === true ||
    workflow.nodes.some(node => isApprovalNode(node))
  );
}

function rejectsHumanInLoopRequest(userMessage: string): boolean {
  const rejectionPatterns = [
    /\b(?:no|without)\s+(?:manual\s+)?approvals?\b/i,
    /\b(?:no|without)\s+approval\s+gates?\b/i,
    /\b(?:no|without)\s+human[- ]in[- ]the[- ]loop\b/i,
    /\b(?:do\s+not|don'?t|never)\s+(?:ask|pause|wait)\s+(?:me\s+)?(?:for\s+)?approval\b/i,
    /\b(?:do\s+not|don'?t|never|stop)\s+ask(?:ing)?(?:\s+me)?\b/i,
    /\bwithout\s+asking\b/i,
    /\bcontinue\s+without\s+(?:asking|approval)\b/i,
  ];
  return rejectionPatterns.some(pattern => pattern.test(userMessage));
}

function isExplicitHumanInLoopRequest(userMessage: string): boolean {
  if (rejectsHumanInLoopRequest(userMessage)) {
    return false;
  }

  return /\b(guided|interactive|human[- ]in[- ]the[- ]loop|ask me|approval gate|manual approval|wait for approval|with approvals)\b/i.test(
    userMessage
  );
}

function isAutonomousRoutingRequest(userMessage: string, context?: RouterContext): boolean {
  const combined = [userMessage, context?.title, context?.labels?.join(' '), context?.workflowType]
    .filter(Boolean)
    .join(' ');

  return /\b(archon agentic coding orchestrator|aco\b|autonomous|unattended|party[- ]mode|handoff|artifact-rich|artifact rich|zip|dossier|continue without|without asking|without approval|do not ask|don't ask|dont ask|stop asking|no approval(?:\s+(?:prompts?|gates?))?)\b/i.test(
    combined
  );
}

export function isAutonomousRequestWithoutHumanLoopConsent(
  userMessage: string,
  context?: RouterContext
): boolean {
  return (
    isAutonomousRoutingRequest(userMessage, context) && !isExplicitHumanInLoopRequest(userMessage)
  );
}

function routableWorkflowsForRequest(
  userMessage: string,
  workflows: readonly WorkflowDefinition[],
  context?: RouterContext
): {
  workflows: readonly WorkflowDefinition[];
  omittedHumanLoopCount: number;
  autonomousRequest: boolean;
} {
  const autonomousRequest = isAutonomousRequestWithoutHumanLoopConsent(userMessage, context);
  if (!autonomousRequest) {
    return { workflows, omittedHumanLoopCount: 0, autonomousRequest: false };
  }

  const autonomousCompatible = workflows.filter(w => !isHumanInLoopWorkflow(w));
  if (autonomousCompatible.length === 0) {
    return { workflows: [], omittedHumanLoopCount: workflows.length, autonomousRequest: true };
  }

  return {
    workflows: autonomousCompatible,
    omittedHumanLoopCount: workflows.length - autonomousCompatible.length,
    autonomousRequest: true,
  };
}

function autonomousRoutingCandidateNote(routing: {
  readonly workflows: readonly WorkflowDefinition[];
  readonly omittedHumanLoopCount: number;
}): string {
  if (routing.omittedHumanLoopCount > 0) {
    return `Omitted ${routing.omittedHumanLoopCount} human-in-loop/high-impact/source-mutating workflow(s) from the candidate list.`;
  }
  if (routing.workflows.length > 0) {
    return 'All listed workflows are autonomous-compatible.';
  }
  return 'No autonomous-compatible workflow candidates are available; do not invoke a human-in-loop workflow.';
}

function shouldSurfaceAllOmittedAutonomousNote(
  userMessage: string,
  workflows: readonly WorkflowDefinition[],
  context?: RouterContext
): boolean {
  return (
    workflows.length > 0 &&
    isAutonomousRequestWithoutHumanLoopConsent(userMessage, context) &&
    workflows.every(
      workflow => workflow.mode === 'autonomous' || workflow.lock_scope === 'checkout_mutation'
    )
  );
}

/**
 * Build the router prompt with available workflows and optional context.
 * Context helps the router make better routing decisions by understanding the situation.
 * Instructs AI to use /invoke-workflow command.
 */
export function buildRouterPrompt(
  userMessage: string,
  workflows: readonly WorkflowDefinition[],
  context?: RouterContext
): string {
  const routing = routableWorkflowsForRequest(userMessage, workflows, context);

  if (routing.workflows.length === 0) {
    if (shouldSurfaceAllOmittedAutonomousNote(userMessage, workflows, context)) {
      return autonomousRoutingCandidateNote(routing);
    }
    // No workflows - just respond conversationally
    return userMessage;
  }

  const workflowList = routing.workflows
    .map(w => {
      // Format description, handling multi-line descriptions
      const desc = w.description.trim().replace(/\n/g, '\n  ');
      const metadata: string[] = [];
      const mode = w.mode ?? (w.interactive === true ? 'guided' : undefined);
      if (mode) metadata.push(`Mode: ${mode}`);
      if (w.lock_scope) metadata.push(`Lock scope: ${w.lock_scope}`);
      if (w.interactive === true) metadata.push('Interactive: true');
      const metadataText = metadata.length > 0 ? `\n  ${metadata.join('\n  ')}` : '';
      return `**${w.name}**\n  ${desc}${metadataText}`;
    })
    .join('\n\n');

  const contextSection = buildContextSection(context);
  const routingModeNote = routing.autonomousRequest
    ? `## Autonomous Routing Constraint

This request is autonomous. Do not route it to guided, interactive-only, or interactive workflows unless the user explicitly asked for human-in-the-loop execution.
${autonomousRoutingCandidateNote(routing)}

`
    : '';

  // Build prompt with or without context section
  const contextPart = contextSection
    ? `## Context

${contextSection}

`
    : '';

  return `# Workflow Router

You are a router. Your job is to pick the best workflow for the user's request.

${contextPart}## Available Workflows

${workflowList}

${routingModeNote}
## User Request

"${userMessage}"

## Rules

1. The USER REQUEST is the PRIMARY signal — it determines which workflow to use
2. The CONTEXT section is supplementary — it tells you WHERE the user is, not WHAT they want
3. Read each workflow's description - especially the "NOT for" and "Use when" sections
4. CRITICAL: Being on a GitHub issue does NOT mean the user wants to fix it. Only route to "fix-github-issue" if the user EXPLICITLY asks to fix, resolve, or implement something.
5. IMPORTANT distinctions:
   - CI failures, test failures, build errors, linting issues → use "assist" (debugging help)
   - "Fix this issue" / "implement this" / "resolve this bug" (explicit action request) → use "fix-github-issue"
   - Questions, exploration, explanations, general messages → use "assist"
   - PR reviews, code reviews → check for a PR review workflow in the list above
6. If unsure, prefer "assist" (the catch-all)
7. For autonomous requests, prefer workflows with mode "autonomous" and safer lock scopes ("artifact_only" or "read_only")
8. You MUST pick a workflow - never respond with just text

## Response Format

Your ENTIRE response must be ONLY this single line - no analysis, no explanation, no context:
/invoke-workflow {workflow-name}

Do NOT include any other text before or after. Just the command.
Do NOT use any tools (Read, Write, Bash, etc.) — this is a routing decision only.`;
  // NOTE: We emphasize "ONLY this single line" because AI models sometimes add analysis
  // before the command. The parseWorkflowInvocation regex uses multiline mode as a fallback,
  // but cleaner output is preferred for GitHub comments where the full response is posted.
}

/**
 * Result of parsing a message for workflow invocation
 */
export interface WorkflowInvocation {
  workflowName: string | null;
  remainingMessage: string;
  /** Error message when workflow name was detected but didn't match */
  error?: string;
}

export interface WorkflowInvocationParseOptions {
  /** Original user request that caused the router prompt/model response. */
  userMessage?: string;
  context?: RouterContext;
  /** Defaults to true when userMessage is provided. */
  enforceAutonomous?: boolean;
}

/**
 * Parse a message to detect /invoke-workflow command
 */
export function parseWorkflowInvocation(
  message: string,
  workflows: readonly WorkflowDefinition[],
  options: WorkflowInvocationParseOptions = {}
): WorkflowInvocation {
  const trimmed = message.trim();
  const enforceAutonomous = options.enforceAutonomous ?? options.userMessage !== undefined;
  const autonomousRequest =
    enforceAutonomous && options.userMessage !== undefined
      ? isAutonomousRequestWithoutHumanLoopConsent(options.userMessage, options.context)
      : false;

  function rejectUnsafeAutonomousInvocation(
    workflow: WorkflowDefinition
  ): WorkflowInvocation | null {
    if (!autonomousRequest || !isHumanInLoopWorkflow(workflow)) return null;
    return {
      workflowName: null,
      remainingMessage: message,
      error: `Autonomous request cannot invoke human-in-loop/high-impact workflow: \`${workflow.name}\`. Choose an autonomous read_only or artifact_only workflow instead.`,
    };
  }

  // Check for /invoke-workflow pattern (at start of any line)
  // Uses multiline flag ('m') because AI models sometimes add analysis text before the command
  // despite instructions to only output the command. This ensures routing still works.
  const match = /^\/invoke-workflow\s+(\S+)/im.exec(trimmed);

  if (match) {
    const workflowName = match[1];

    // Exact match
    const workflow = workflows.find(w => w.name === workflowName);
    if (workflow) {
      const rejected = rejectUnsafeAutonomousInvocation(workflow);
      if (rejected) return rejected;
      // Use match.index to handle multiline matches where command isn't at position 0
      const remainingMessage = trimmed.slice(match.index + match[0].length).trim();
      return { workflowName, remainingMessage };
    }

    // Case-insensitive match
    const caseMatch = workflows.find(w => w.name.toLowerCase() === workflowName.toLowerCase());
    if (caseMatch) {
      const rejected = rejectUnsafeAutonomousInvocation(caseMatch);
      if (rejected) return rejected;
      getLog().info(
        { requested: workflowName, matched: caseMatch.name },
        'workflow.invoke_case_insensitive_match'
      );
      const remainingMessage = trimmed.slice(match.index + match[0].length).trim();
      return { workflowName: caseMatch.name, remainingMessage };
    }

    // No match - build helpful error
    const available = workflows.map(w => w.name);
    getLog().warn({ workflowName, available }, 'workflow.invoke_unknown');

    return {
      workflowName: null,
      remainingMessage: message,
      error: `Unknown workflow: \`${workflowName}\`. Available: ${available.map(n => `\`${n}\``).join(', ')}`,
    };
  }

  return {
    workflowName: null,
    remainingMessage: message,
  };
}

/**
 * Find a workflow by name
 */
export function findWorkflow(
  name: string,
  workflows: readonly WorkflowDefinition[]
): WorkflowDefinition | undefined {
  return workflows.find(w => w.name === name);
}

/**
 * Resolve a workflow by name using a 4-tier fallback hierarchy:
 * 1. Exact match
 * 2. Case-insensitive match
 * 3. Suffix match (e.g. "assist" → "archon-assist")
 * 4. Substring match (e.g. "smart" → "archon-smart-pr-review")
 *
 * Returns the matched workflow, or undefined if no match found.
 * Throws an Error if multiple workflows match at the same tier (ambiguous).
 */
export function resolveWorkflowName(
  name: string,
  workflows: readonly WorkflowDefinition[]
): WorkflowDefinition | undefined {
  // Tier 1: Exact match
  const exact = workflows.find(w => w.name === name);
  if (exact) return exact;

  const lowerName = name.toLowerCase();

  // Returns the single match, throws on ambiguity, returns undefined for no match
  function checkTier(
    matches: WorkflowDefinition[],
    logEvent: string
  ): WorkflowDefinition | undefined {
    if (matches.length === 1) {
      getLog().info({ requested: name, matched: matches[0].name }, logEvent);
      return matches[0];
    }
    if (matches.length > 1) {
      const candidates = matches.map(w => `  - ${w.name}`).join('\n');
      throw new Error(`Ambiguous workflow '${name}'. Did you mean:\n${candidates}`);
    }
    return undefined;
  }

  return (
    // Tier 2: Case-insensitive match
    checkTier(
      workflows.filter(w => w.name.toLowerCase() === lowerName),
      'workflow.resolve_case_insensitive_match'
    ) ??
    // Tier 3: Suffix match (e.g. "assist" matches "archon-assist")
    checkTier(
      workflows.filter(w => w.name.toLowerCase().endsWith(`-${lowerName}`)),
      'workflow.resolve_suffix_match'
    ) ??
    // Tier 4: Substring match (e.g. "smart" matches "archon-smart-pr-review")
    checkTier(
      workflows.filter(w => w.name.toLowerCase().includes(lowerName)),
      'workflow.resolve_substring_match'
    )
  );
}
