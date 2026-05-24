import type {
  DocumentationPlan,
  DocumentationTarget,
  IntegrationVerification,
  IntegrationVerificationState,
} from './types';

const thirdPartyIgnore = new Set([
  'ACO',
  'Archon',
  'Add',
  'Codex',
  'Build',
  'OpenAI',
  'BMAD',
  'Agentic',
  'Can',
  'Could',
  'Context',
  'Create',
  'Evidence',
  'Goal',
  'Identify',
  'Improve',
  'Improvement',
  'Ledgers',
  'Library',
  'SDD',
  'ATDD',
  'MCP',
  'CLI',
  'API',
  'REST',
  'Fix',
  'Harden',
  'How',
  'Implement',
  'Plan',
  'Package',
  'Prepare',
  'Resolve',
  'Review',
  'Run',
  'Single',
  'Should',
  'SDK',
  'Test',
  'Tools',
  'Update',
  'Use',
  'Validate',
  'What',
  'When',
  'Where',
  'Who',
  'Why',
  'Workflow',
]);

export interface PlanDocumentationOptions {
  prompt: string;
  timestamp?: string;
  codebaseSignals?: string[];
  graphSummary?: string;
}

export function planDocumentation(options: PlanDocumentationOptions): DocumentationPlan {
  const prompt = options.prompt;
  const checkedAt = options.timestamp ?? 'not-runtime-checked';
  const targets: DocumentationTarget[] = [];
  const lower = prompt.toLowerCase();
  const openAiDocsRequired =
    lower.includes('codex') ||
    lower.includes('openai') ||
    lower.includes('mcp configuration') ||
    lower.includes('mcp setup');

  if (openAiDocsRequired) {
    targets.push({
      source: 'openai-docs-mcp',
      topic: lower.includes('mcp') ? 'Codex MCP configuration' : 'Codex behavior',
      status: 'resolved',
      reason: 'OpenAI/Codex behavior must use official OpenAI documentation first.',
    });
  }

  if (!openAiDocsRequired) {
    const thirdPartyTargets = new Set<string>();
    const promptThirdParty = detectThirdPartyLibrary(prompt);
    if (promptThirdParty !== null) thirdPartyTargets.add(promptThirdParty);
    for (const signal of options.codebaseSignals ?? []) {
      for (const detected of detectKnownLibraries(signal)) {
        thirdPartyTargets.add(detected);
      }
    }
    for (const detected of detectKnownLibraries(options.graphSummary ?? '')) {
      thirdPartyTargets.add(detected);
    }

    for (const thirdParty of thirdPartyTargets) {
      targets.push({
        source: 'context7',
        topic: thirdParty,
        status: 'unresolved',
        reason: context7Reason(thirdParty, options),
      });
    }
  }

  if (targets.length === 0) {
    targets.push({
      source: 'generic',
      topic: 'No external documentation required',
      status: 'not-required',
      reason:
        'Prompt does not reference OpenAI/Codex behavior or a detectable third-party library.',
    });
  }

  const integrations = buildIntegrationStates(targets, checkedAt);

  return {
    readiness: {
      openaiDocsMcp:
        integrations.find(integration => integration.id === 'openai-docs-mcp')?.state ??
        'deferred_by_design',
      context7:
        integrations.find(integration => integration.id === 'context7')?.state ??
        'deferred_by_design',
    },
    integrations,
    targets,
    unresolved: targets
      .filter(target => target.status === 'unresolved')
      .map(target => target.topic),
  };
}

function buildIntegrationStates(
  targets: DocumentationTarget[],
  checkedAt: string
): IntegrationVerification[] {
  const openaiRequired = targets.some(target => target.source === 'openai-docs-mcp');
  const context7Required = targets.some(target => target.source === 'context7');
  return [
    integrationState({
      id: 'openai-docs-mcp',
      label: 'OpenAI Docs MCP',
      state: openaiRequired ? configuredState('OPENAI_DOCS_MCP_ENABLED') : 'deferred_by_design',
      reason: openaiRequired
        ? 'OpenAI/Codex docs are required; ACO does not assume MCP availability without runtime configuration.'
        : 'No OpenAI/Codex documentation target selected for this prompt.',
      checkedAt,
    }),
    integrationState({
      id: 'context7',
      label: 'Context7',
      state: context7Required ? configuredState('CONTEXT7_API_KEY') : 'deferred_by_design',
      reason: context7Required
        ? 'Third-party docs are required; Context7 library ID must be resolved by an explicit docs command.'
        : 'No third-party documentation target selected for this prompt.',
      checkedAt,
    }),
    integrationState({
      id: 'generic-docs',
      label: 'Generic docs planning',
      state: targets.some(target => target.source === 'generic')
        ? 'verified_available'
        : 'deferred_by_design',
      reason: targets.some(target => target.source === 'generic')
        ? 'Generic docs planning is local deterministic logic and needs no external integration.'
        : 'Generic docs planning not selected for this prompt.',
      checkedAt,
    }),
  ];
}

function integrationState(input: {
  id: IntegrationVerification['id'];
  label: string;
  state: IntegrationVerificationState;
  reason: string;
  checkedAt: string;
}): IntegrationVerification {
  return {
    ...input,
    networkAccess: 'not_attempted',
  };
}

function configuredState(
  envName: 'CONTEXT7_API_KEY' | 'OPENAI_DOCS_MCP_ENABLED'
): IntegrationVerificationState {
  return process.env[envName] ? 'configured_but_not_reachable' : 'not_configured';
}

function detectThirdPartyLibrary(prompt: string): string | null {
  const targetPattern =
    /\b(?:[Uu]se|[Uu]sing|[Ww]ith|[Vv]ia|[Ff]or|[Ll]ibrary|[Ff]ramework|[Ss][Dd][Kk]|[Aa][Pp][Ii]|[Cc][Ll][Ii]|[Tt]ool)\s+([A-Z][A-Za-z0-9]*(?:Library|SDK|JS|Js)?)\b/g;

  for (let match = targetPattern.exec(prompt); match !== null; match = targetPattern.exec(prompt)) {
    const candidate = match[1];
    if (candidate && !thirdPartyIgnore.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

function detectKnownLibraries(text: string): string[] {
  return ['Hono', 'Zod'].filter(library => new RegExp(`\\b${library}\\b`, 'i').test(text));
}

function context7Reason(thirdParty: string, options: PlanDocumentationOptions): string {
  const codebaseMentioned = (options.codebaseSignals ?? []).some(signal =>
    signal.toLowerCase().includes(thirdParty.toLowerCase())
  );
  const graphMentioned = (options.graphSummary ?? '')
    .toLowerCase()
    .includes(thirdParty.toLowerCase());
  if (graphMentioned) {
    return 'Context7 target selected from Graphify/codebase summary evidence; library ID must be resolved before version-specific docs are used.';
  }
  if (codebaseMentioned) {
    return 'Context7 target selected from generated temp codebase evidence; library ID must be resolved before version-specific docs are used.';
  }
  return 'Context7 library ID must be resolved before version-specific docs are used.';
}
