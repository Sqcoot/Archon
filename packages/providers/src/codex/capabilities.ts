import type { ProviderCapabilities } from '../types';

export const CODEX_CAPABILITIES: ProviderCapabilities = {
  sessionResume: true,
  mcp: true,
  hookCapabilities: {
    workflowNodeHooks: 'unsupported',
    runtimeConfigHooks: 'possible',
    hookInventoryObservable: true,
    hookTrustObservable: true,
    hookEventStreaming: false,
  },
  hooks: true,
  skills: false,
  agents: false,
  toolRestrictions: false,
  structuredOutput: true,
  structuredOutputMode: 'enforced',
  systemPrompt: false,
  systemPromptMode: 'unsupported',
  envInjection: true,
  costControl: false,
  effortControl: false,
  thinkingControl: false,
  fallbackModel: false,
  sandbox: false,
  betaFlags: false,
};
