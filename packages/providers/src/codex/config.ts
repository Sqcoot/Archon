/**
 * Typed config parsing for Codex provider defaults.
 * Validates and narrows the opaque assistantConfig to typed fields.
 */
import type { CodexProviderDefaults } from '../types';

// Re-export so consumers can import the type from either location
export type { CodexProviderDefaults } from '../types';

/**
 * Parse raw assistantConfig into typed Codex defaults.
 * Unknown fields are ignored. Recognized numeric limits fail fast when invalid
 * so fanout/agent concurrency mistakes do not silently run unbounded.
 */
export function parseCodexConfig(raw: Record<string, unknown>): CodexProviderDefaults {
  const result: CodexProviderDefaults = {};

  if (typeof raw.model === 'string') {
    result.model = raw.model;
  }

  const validEfforts = ['minimal', 'low', 'medium', 'high', 'xhigh'];
  if (
    typeof raw.modelReasoningEffort === 'string' &&
    validEfforts.includes(raw.modelReasoningEffort)
  ) {
    result.modelReasoningEffort =
      raw.modelReasoningEffort as CodexProviderDefaults['modelReasoningEffort'];
  }

  const validSearchModes = ['disabled', 'cached', 'live'];
  if (typeof raw.webSearchMode === 'string' && validSearchModes.includes(raw.webSearchMode)) {
    result.webSearchMode = raw.webSearchMode as CodexProviderDefaults['webSearchMode'];
  }

  if (Array.isArray(raw.additionalDirectories)) {
    result.additionalDirectories = raw.additionalDirectories.filter(
      (d): d is string => typeof d === 'string'
    );
  }

  if (typeof raw.codexBinaryPath === 'string') {
    result.codexBinaryPath = raw.codexBinaryPath;
  }

  if (raw.applyPatchStreamingEvents === true || raw.apply_patch_streaming_events === true) {
    result.applyPatchStreamingEvents = true;
  }

  const featureFlags = parseFeatureFlags(raw);
  if (featureFlags) result.features = featureFlags;

  const agents = parseAgentsConfig(raw.agents);
  if (agents) result.agents = agents;

  const fanout = parseFanoutConfig(raw.fanout);
  if (fanout) result.fanout = fanout;

  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBoolean(
  source: Record<string, unknown>,
  camelKey: string,
  snakeKey: string = camelKey
): boolean | undefined {
  const camelValue = source[camelKey];
  if (typeof camelValue === 'boolean') return camelValue;
  const snakeValue = source[snakeKey];
  return typeof snakeValue === 'boolean' ? snakeValue : undefined;
}

function readPositiveInt(
  source: Record<string, unknown>,
  camelKey: string,
  snakeKey: string,
  label: string
): number | undefined {
  const value = source[camelKey] ?? source[snakeKey];
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error(`Invalid Codex ${label}: expected a positive integer`);
  }
  return value;
}

function parseFeatureFlags(
  raw: Record<string, unknown>
): NonNullable<CodexProviderDefaults['features']> | undefined {
  const source = isRecord(raw.features) ? raw.features : {};
  const features: NonNullable<CodexProviderDefaults['features']> = {};

  const multiAgent =
    readBoolean(source, 'multiAgent', 'multi_agent') ??
    readBoolean(raw, 'multiAgent', 'multi_agent');
  if (multiAgent !== undefined) features.multiAgent = multiAgent;

  const multiAgentV2 =
    readBoolean(source, 'multiAgentV2', 'multi_agent_v2') ??
    readBoolean(raw, 'multiAgentV2', 'multi_agent_v2');
  if (multiAgentV2 !== undefined) features.multiAgentV2 = multiAgentV2;

  const enableFanout =
    readBoolean(source, 'enableFanout', 'enable_fanout') ??
    readBoolean(raw, 'enableFanout', 'enable_fanout');
  if (enableFanout !== undefined) features.enableFanout = enableFanout;

  return Object.keys(features).length > 0 ? features : undefined;
}

function parseAgentsConfig(
  rawAgents: unknown
): NonNullable<CodexProviderDefaults['agents']> | undefined {
  if (!isRecord(rawAgents)) return undefined;
  const agents: NonNullable<CodexProviderDefaults['agents']> = {};

  const maxThreads = readPositiveInt(rawAgents, 'maxThreads', 'max_threads', 'agents.maxThreads');
  if (maxThreads !== undefined) agents.maxThreads = maxThreads;

  const maxDepth = readPositiveInt(rawAgents, 'maxDepth', 'max_depth', 'agents.maxDepth');
  if (maxDepth !== undefined) agents.maxDepth = maxDepth;

  const jobMaxRuntimeSeconds = readPositiveInt(
    rawAgents,
    'jobMaxRuntimeSeconds',
    'job_max_runtime_seconds',
    'agents.jobMaxRuntimeSeconds'
  );
  if (jobMaxRuntimeSeconds !== undefined) agents.jobMaxRuntimeSeconds = jobMaxRuntimeSeconds;

  const interruptMessage = readBoolean(rawAgents, 'interruptMessage', 'interrupt_message');
  if (interruptMessage !== undefined) agents.interruptMessage = interruptMessage;

  const strict = readBoolean(rawAgents, 'strict');
  if (strict !== undefined) agents.strict = strict;

  return Object.keys(agents).length > 0 ? agents : undefined;
}

function parseFanoutConfig(
  rawFanout: unknown
): NonNullable<CodexProviderDefaults['fanout']> | undefined {
  if (!isRecord(rawFanout)) return undefined;
  const fanout: NonNullable<CodexProviderDefaults['fanout']> = {};

  const enabled = readBoolean(rawFanout, 'enabled');
  if (enabled !== undefined) fanout.enabled = enabled;

  const maxConcurrency = readPositiveInt(
    rawFanout,
    'maxConcurrency',
    'max_concurrency',
    'fanout.maxConcurrency'
  );
  if (maxConcurrency !== undefined) fanout.maxConcurrency = maxConcurrency;

  const strict = readBoolean(rawFanout, 'strict');
  if (strict !== undefined) fanout.strict = strict;

  return Object.keys(fanout).length > 0 ? fanout : undefined;
}
