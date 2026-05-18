import type { DocumentationPlan, DocumentationTarget } from './types';

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
}

export function planDocumentation(options: PlanDocumentationOptions): DocumentationPlan {
  const prompt = options.prompt;
  const targets: DocumentationTarget[] = [];
  const lower = prompt.toLowerCase();

  if (
    lower.includes('codex') ||
    lower.includes('openai') ||
    lower.includes('mcp configuration') ||
    lower.includes('mcp setup')
  ) {
    targets.push({
      source: 'openai-docs-mcp',
      topic: lower.includes('mcp') ? 'Codex MCP configuration' : 'Codex behavior',
      status: 'resolved',
      reason: 'OpenAI/Codex behavior must use official OpenAI documentation first.',
    });
  }

  const thirdParty = detectThirdPartyLibrary(prompt);
  if (thirdParty) {
    targets.push({
      source: 'context7',
      topic: thirdParty,
      status: 'unresolved',
      reason: 'Context7 library ID must be resolved before version-specific docs are used.',
    });
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

  return {
    readiness: {
      openaiDocsMcp: 'available',
      context7: 'available',
    },
    targets,
    unresolved: targets
      .filter(target => target.status === 'unresolved')
      .map(target => target.topic),
  };
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
