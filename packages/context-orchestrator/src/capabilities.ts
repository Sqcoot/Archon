import type { CapabilityRoute, DocumentationPlan, GraphContext } from './types';

export interface SelectCapabilitiesOptions {
  graphContext: GraphContext;
  documentationPlan: DocumentationPlan;
}

export function selectCapabilities(options: SelectCapabilitiesOptions): CapabilityRoute {
  return {
    capabilities: [
      {
        id: 'graph-context',
        label: 'Graph Context',
        required: options.graphContext.status !== 'unavailable',
        reason: options.graphContext.summary,
      },
      {
        id: 'documentation-plan',
        label: 'Documentation Plan',
        required: options.documentationPlan.targets.length > 0,
        reason: 'Selects OpenAI Docs MCP, Context7, or unresolved documentation targets.',
      },
      {
        id: 'bmad-route',
        label: 'BMAD Route',
        required: true,
        reason: 'Routes the prompt through the appropriate BMAD workflow.',
      },
      {
        id: 'acceptance-plan',
        label: 'Acceptance Plan',
        required: true,
        reason: 'Defines ATDD scenarios before implementation.',
      },
      {
        id: 'prompt-package',
        label: 'Prompt Package',
        required: true,
        reason: 'Compiles Codex-ready prompt package artifacts.',
      },
    ],
  };
}
