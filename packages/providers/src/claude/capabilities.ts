import type { ProviderCapabilities } from '../types';

export const CLAUDE_CAPABILITIES: ProviderCapabilities = {
  sessionResume: true,
  mcp: true,
  hookCapabilities: {
    workflowNodeHooks: 'enforced',
    runtimeConfigHooks: 'unknown',
    hookInventoryObservable: false,
    hookTrustObservable: false,
    hookEventStreaming: false,
  },
  hooks: true,
  skills: true,
  agents: true,
  toolRestrictions: true,
  structuredOutput: true,
  structuredOutputMode: 'enforced',
  systemPrompt: true,
  systemPromptMode: 'full',
  envInjection: true,
  costControl: true,
  effortControl: true,
  thinkingControl: true,
  fallbackModel: true,
  sandbox: true,
  betaFlags: true,
};
