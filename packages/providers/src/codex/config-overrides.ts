import type { CodexOptions } from '@openai/codex-sdk';
import type { CodexProviderDefaults } from '../types';

export type CodexConfigOverrides = NonNullable<CodexOptions['config']>;
export type CodexConfigValue = CodexConfigOverrides[string];

export function toCodexConfigValue(value: unknown): CodexConfigValue | undefined {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    const result: CodexConfigValue[] = [];
    for (const item of value) {
      const converted = toCodexConfigValue(item);
      if (converted !== undefined) result.push(converted);
    }
    return result;
  }

  if (typeof value === 'object' && value !== null) {
    const result: CodexConfigOverrides = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      const converted = toCodexConfigValue(nestedValue);
      if (converted !== undefined) result[key] = converted;
    }
    return result;
  }

  return undefined;
}

export function setCodexConfigValue(
  target: CodexConfigOverrides,
  key: string,
  value: unknown
): void {
  const converted = toCodexConfigValue(value);
  if (converted !== undefined) {
    target[key] = converted;
  }
}

export function mergeCodexConfigOverrides(
  ...overrides: (CodexConfigOverrides | undefined)[]
): CodexConfigOverrides | undefined {
  const result: CodexConfigOverrides = {};

  for (const override of overrides) {
    if (!override) continue;
    mergeIntoCodexConfig(result, override);
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function mergeIntoCodexConfig(target: CodexConfigOverrides, source: CodexConfigOverrides): void {
  for (const [key, incoming] of Object.entries(source)) {
    const current = target[key];
    if (isPlainConfigObject(current) && isPlainConfigObject(incoming)) {
      const merged: CodexConfigOverrides = { ...current };
      mergeIntoCodexConfig(merged, incoming);
      target[key] = merged;
      continue;
    }
    target[key] = incoming;
  }
}

function isPlainConfigObject(value: CodexConfigValue | undefined): value is CodexConfigOverrides {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function buildCodexFeatureConfigOverrides(
  config: CodexProviderDefaults,
  options?: { forceMultiAgent?: boolean }
): CodexConfigOverrides | undefined {
  const features: CodexConfigOverrides = {};

  if (config.applyPatchStreamingEvents === true) {
    features.apply_patch_streaming_events = true;
  }

  if (options?.forceMultiAgent === true || config.features?.multiAgent === true) {
    features.multi_agent = true;
  }

  if (config.features?.multiAgentV2 === true) {
    features.multi_agent_v2 = true;
  }

  if (config.features?.enableFanout === true || config.fanout?.enabled === true) {
    features.enable_fanout = true;
  }

  return Object.keys(features).length > 0 ? { features } : undefined;
}

export function buildCodexRuntimeConfigOverrides(
  config: CodexProviderDefaults
): CodexConfigOverrides | undefined {
  const agents: CodexConfigOverrides = {};

  if (config.agents?.maxThreads !== undefined) {
    agents.max_threads = config.agents.maxThreads;
  }
  if (config.agents?.maxDepth !== undefined) {
    agents.max_depth = config.agents.maxDepth;
  }
  if (config.agents?.jobMaxRuntimeSeconds !== undefined) {
    agents.job_max_runtime_seconds = config.agents.jobMaxRuntimeSeconds;
  }
  if (config.agents?.interruptMessage !== undefined) {
    agents.interrupt_message = config.agents.interruptMessage;
  }

  const overrides: CodexConfigOverrides = {};
  if (Object.keys(agents).length > 0) overrides.agents = agents;

  return Object.keys(overrides).length > 0 ? overrides : undefined;
}
