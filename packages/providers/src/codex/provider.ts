/**
 * Codex SDK wrapper
 * Provides async generator interface for streaming Codex responses
 */
import {
  Codex,
  type CodexOptions,
  type ThreadOptions,
  type TurnOptions,
  type TurnCompletedEvent,
} from '@openai/codex-sdk';
import { createHash } from 'crypto';
import { existsSync } from 'fs';
import { appendFile, mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  createLogger,
  ensureScopedArtifactDirectory,
  resolveScopedArtifactRoot,
  scopedArtifactPath,
} from '@archon/paths';
import type {
  IAgentProvider,
  SendQueryOptions,
  MessageChunk,
  TokenUsage,
  ProviderCapabilities,
  NodeConfig,
} from '../types';
import { parseCodexConfig } from './config';
import { CODEX_CAPABILITIES } from './capabilities';
import { resolveCodexBinaryPath } from './binary-resolver';
import { loadMcpConfig } from '../mcp/config';
import { runCodexHookBootloaderPreflight } from './hooks-preflight';

type CodexHookPreflightRunner = typeof runCodexHookBootloaderPreflight;

/** Lazy-initialized logger (deferred so test mocks can intercept createLogger) */
let cachedLog: ReturnType<typeof createLogger> | undefined;
function getLog(): ReturnType<typeof createLogger> {
  if (!cachedLog) cachedLog = createLogger('provider.codex');
  return cachedLog;
}

type CodexConfigOverrides = NonNullable<CodexOptions['config']>;
type CodexConfigValue = CodexConfigOverrides[string];

const DEFAULT_CODEX_SANDBOX_MODE = 'danger-full-access' as const;
const DEFAULT_CODEX_APPROVAL_POLICY = 'never' as const;
const DEFAULT_CODEX_NETWORK_ACCESS = true;
type CodexApprovalPolicy = NonNullable<ReturnType<typeof parseCodexConfig>['approvalPolicy']>;

interface ProviderWarning {
  code: string;
  message: string;
}

interface CodexRuntimeHookObservation {
  startedAt: string;
  endedAt?: string;
  status: 'running' | 'completed' | 'failed';
  workflowRunId?: string;
  nodeId?: string;
  artifactDirectory: string;
  preflightReportPath: string;
  manifestPath: string;
  eventLogPath: string;
  summaryPath: string;
  totalEvents: number;
  eventTypes: Record<string, number>;
  hookRelevantEvents: number;
  permissionRequestRelevantEvents: number;
  stopContinuationRelevantEvents: number;
  persistedRelevantEvents: number;
  droppedRelevantEvents: number;
  artifactWriteFailures: number;
  providerHookCapabilities: ProviderCapabilities['hookCapabilities'];
  hookEventStreaming: boolean;
  eventStreamingStatus: 'available' | 'unavailable';
  terminalEventType?: string;
  warnings: string[];
  configuredHookSurfaces: {
    inventoriedHookHandlers: number;
    permissionRequestHooks: number;
    stopContinuationHooks: number;
    permissionRequestBoundedByPreflight: boolean;
    stopContinuationBoundedByPreflight: boolean;
  };
}

const MAX_CODEX_RUNTIME_HOOK_EVENTS = 200;
const MAX_CODEX_RUNTIME_EVENT_VALUE_LENGTH = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizePathPart(value: string | undefined, fallback: string): string {
  const cleaned = (value ?? fallback).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned.length > 0 ? cleaned.slice(0, 80) : fallback;
}

function resolveCodexHookArtifactRoot(cwd: string, nodeConfig?: NodeConfig): string | undefined {
  const runtime = nodeConfig?.archonRuntime;
  if (!runtime?.artifactsDir) return undefined;
  const artifactPolicy = resolveScopedArtifactRoot({
    cwd,
    artifactsDir: runtime.artifactsDir,
    source: 'workflow:run-artifacts',
  });
  const artifactsDir = artifactPolicy.artifactRoot;
  const workflowRunId = sanitizePathPart(runtime.workflowRunId, 'workflow');
  const nodeId = sanitizePathPart(runtime.nodeId, 'node');
  const runtimeRoot = scopedArtifactPath(artifactsDir, 'codex-hooks-runtime');
  ensureScopedArtifactDirectory(artifactsDir, runtimeRoot);
  const nodeRoot = scopedArtifactPath(runtimeRoot, `${workflowRunId}-${nodeId}`);
  ensureScopedArtifactDirectory(artifactsDir, nodeRoot);
  return nodeRoot;
}

function truncateRuntimeValue(value: string): string {
  return value.length > MAX_CODEX_RUNTIME_EVENT_VALUE_LENGTH
    ? `${value.slice(0, MAX_CODEX_RUNTIME_EVENT_VALUE_LENGTH)}...`
    : value;
}

function collectInterestingRuntimeValues(
  value: unknown,
  depth = 0,
  output: Record<string, string[]> = {}
): Record<string, string[]> {
  if (depth > 3 || !isRecord(value)) return output;
  for (const [key, raw] of Object.entries(value)) {
    if (/token|secret|password|authorization|api[_-]?key|credential/i.test(key)) {
      output[key] = ['[redacted]'];
      continue;
    }
    if (
      /hook|permission|approval|decision|stop|continue|behavior|matcher|tool|status|reason/i.test(
        key
      )
    ) {
      const rendered =
        typeof raw === 'string'
          ? truncateRuntimeValue(raw)
          : typeof raw === 'number' || typeof raw === 'boolean'
            ? String(raw)
            : undefined;
      if (rendered !== undefined) {
        output[key] = [...(output[key] ?? []), rendered];
      }
    }
    if (isRecord(raw)) collectInterestingRuntimeValues(raw, depth + 1, output);
  }
  return output;
}

function summarizeCodexRuntimeEvent(event: Record<string, unknown>): {
  kind: 'codex-runtime-hook-event-summary';
  schemaVersion: 'archon.codex-hooks.runtime-event-summary.v1';
  generatedAt: string;
  persistence: 'persisted';
  at: string;
  type: string;
  itemType?: string;
  itemId?: string;
  itemStatus?: string;
  eventKeys: string[];
  itemKeys: string[];
  interestingValues: Record<string, string[]>;
  relevance: string[];
} {
  const item = isRecord(event.item) ? event.item : undefined;
  const type = typeof event.type === 'string' ? event.type : 'unknown';
  const itemType = typeof item?.type === 'string' ? item.type : undefined;
  const itemId = typeof item?.id === 'string' ? item.id : undefined;
  const itemStatus = typeof item?.status === 'string' ? item.status : undefined;
  const interestingValues = collectInterestingRuntimeValues(event);
  const generatedAt = new Date().toISOString();
  const haystack = [
    type,
    itemType,
    itemStatus,
    ...Object.keys(event),
    ...(item ? Object.keys(item) : []),
    ...Object.values(interestingValues).flat(),
  ]
    .filter((part): part is string => typeof part === 'string')
    .join(' ')
    .toLowerCase();
  const relevance: string[] = [];
  if (haystack.includes('hook')) relevance.push('hook');
  if (haystack.includes('permissionrequest') || haystack.includes('permission_request')) {
    relevance.push('permission-request');
  }
  if (haystack.includes('approval') || haystack.includes('permission')) {
    relevance.push('approval');
  }
  if (
    haystack.includes('stop') ||
    haystack.includes('subagentstop') ||
    haystack.includes('continuation') ||
    haystack.includes('continue')
  ) {
    relevance.push('stop-continuation');
  }
  return {
    kind: 'codex-runtime-hook-event-summary',
    schemaVersion: 'archon.codex-hooks.runtime-event-summary.v1',
    generatedAt,
    persistence: 'persisted',
    at: generatedAt,
    type,
    ...(itemType ? { itemType } : {}),
    ...(itemId ? { itemId } : {}),
    ...(itemStatus ? { itemStatus } : {}),
    eventKeys: Object.keys(event).slice(0, 40),
    itemKeys: item ? Object.keys(item).slice(0, 40) : [],
    interestingValues,
    relevance: [...new Set(relevance)],
  };
}

async function writeRuntimeHookObservationSummary(
  observation: CodexRuntimeHookObservation
): Promise<void> {
  await writeFile(
    observation.summaryPath,
    `${JSON.stringify(
      {
        kind: 'codex-runtime-hook-observability',
        schemaVersion: 'archon.codex-hooks.runtime-observability.v1',
        generatedAt: observation.endedAt ?? observation.startedAt,
        persistence: observation.artifactWriteFailures > 0 ? 'best_effort_failed' : 'persisted',
        eventLogPersistence: {
          status:
            observation.artifactWriteFailures > 0
              ? 'best_effort_failed'
              : observation.droppedRelevantEvents > 0
                ? 'persisted_with_dropped_events'
                : 'persisted',
          persistedRelevantEvents: observation.persistedRelevantEvents,
          droppedRelevantEvents: observation.droppedRelevantEvents,
          artifactWriteFailures: observation.artifactWriteFailures,
          eventCap: MAX_CODEX_RUNTIME_HOOK_EVENTS,
        },
        ...observation,
      },
      null,
      2
    )}\n`,
    'utf8'
  );
}

async function runtimeArtifactEntry(
  path: string,
  description: string,
  digestStatus?: string
): Promise<Record<string, unknown>> {
  if (digestStatus) {
    return {
      path,
      required: true,
      description,
      digestStatus,
    };
  }

  const bytes = await readFile(path);
  return {
    path,
    required: true,
    description,
    bytes: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

async function writeRuntimeHookObservationManifest(
  observation: CodexRuntimeHookObservation
): Promise<void> {
  const mutable = observation.status === 'running';
  const summaryEntry = await runtimeArtifactEntry(
    observation.summaryPath,
    'Runtime hook observability summary produced by the Codex provider.',
    mutable ? 'mutable_until_turn_end' : undefined
  );
  const eventLogEntry = await runtimeArtifactEntry(
    observation.eventLogPath,
    'JSONL stream of hook-relevant runtime observations emitted by the Codex provider.',
    mutable ? 'mutable_until_turn_end' : undefined
  );
  const manifestEntry = {
    path: observation.manifestPath,
    required: true,
    description: 'Self-referential runtime hook observability manifest.',
    digestStatus: 'self-referential',
  };

  await writeFile(
    observation.manifestPath,
    `${JSON.stringify(
      {
        kind: 'codex-runtime-hook-observability-manifest',
        schemaVersion: 'archon.codex-hooks.runtime-observability-manifest.v1',
        generatedAt: observation.endedAt ?? observation.startedAt,
        status: observation.status,
        artifactDirectory: observation.artifactDirectory,
        preflightReportPath: observation.preflightReportPath,
        ...(observation.workflowRunId ? { workflowRunId: observation.workflowRunId } : {}),
        ...(observation.nodeId ? { nodeId: observation.nodeId } : {}),
        configuredHookSurfaces: observation.configuredHookSurfaces,
        providerHookCapabilities: observation.providerHookCapabilities,
        hookEventStreaming: observation.hookEventStreaming,
        eventStreamingStatus: observation.eventStreamingStatus,
        eventLogPersistence: {
          status:
            observation.artifactWriteFailures > 0
              ? 'best_effort_failed'
              : observation.droppedRelevantEvents > 0
                ? 'persisted_with_dropped_events'
                : 'persisted',
          persistedRelevantEvents: observation.persistedRelevantEvents,
          droppedRelevantEvents: observation.droppedRelevantEvents,
          artifactWriteFailures: observation.artifactWriteFailures,
          eventCap: MAX_CODEX_RUNTIME_HOOK_EVENTS,
        },
        eventCounts: {
          totalEvents: observation.totalEvents,
          hookRelevantEvents: observation.hookRelevantEvents,
          permissionRequestRelevantEvents: observation.permissionRequestRelevantEvents,
          stopContinuationRelevantEvents: observation.stopContinuationRelevantEvents,
          persistedRelevantEvents: observation.persistedRelevantEvents,
          droppedRelevantEvents: observation.droppedRelevantEvents,
          artifactWriteFailures: observation.artifactWriteFailures,
        },
        requiredArtifacts: {
          summary: summaryEntry,
          eventLog: eventLogEntry,
          manifest: manifestEntry,
        },
        files: [manifestEntry, summaryEntry, eventLogEntry],
        warnings: observation.warnings,
      },
      null,
      2
    )}\n`,
    'utf8'
  );
}

async function createRuntimeHookObservation(
  artifactDirectory: string,
  preflightReportPath: string,
  nodeConfig: NodeConfig | undefined,
  configuredHookSurfaces: CodexRuntimeHookObservation['configuredHookSurfaces']
): Promise<CodexRuntimeHookObservation> {
  await mkdir(artifactDirectory, { recursive: true });
  const observation: CodexRuntimeHookObservation = {
    startedAt: new Date().toISOString(),
    status: 'running',
    ...(nodeConfig?.archonRuntime?.workflowRunId
      ? { workflowRunId: nodeConfig.archonRuntime.workflowRunId }
      : {}),
    ...(nodeConfig?.archonRuntime?.nodeId ? { nodeId: nodeConfig.archonRuntime.nodeId } : {}),
    artifactDirectory,
    preflightReportPath,
    manifestPath: join(artifactDirectory, 'codex-runtime-hook-observability-manifest.json'),
    eventLogPath: join(artifactDirectory, 'codex-runtime-hook-events.jsonl'),
    summaryPath: join(artifactDirectory, 'codex-runtime-hook-observability.json'),
    totalEvents: 0,
    eventTypes: {},
    hookRelevantEvents: 0,
    permissionRequestRelevantEvents: 0,
    stopContinuationRelevantEvents: 0,
    persistedRelevantEvents: 0,
    droppedRelevantEvents: 0,
    artifactWriteFailures: 0,
    providerHookCapabilities: CODEX_CAPABILITIES.hookCapabilities,
    hookEventStreaming: CODEX_CAPABILITIES.hookCapabilities.hookEventStreaming,
    eventStreamingStatus: CODEX_CAPABILITIES.hookCapabilities.hookEventStreaming
      ? 'available'
      : 'unavailable',
    warnings: CODEX_CAPABILITIES.hookCapabilities.hookEventStreaming
      ? []
      : [
          'Codex hook event streaming is not available through Archon; runtime observation is limited to provider stream events and preflight-derived hook coverage.',
        ],
    configuredHookSurfaces,
  };
  await writeFile(observation.eventLogPath, '', 'utf8');
  await writeRuntimeHookObservationSummary(observation);
  await writeRuntimeHookObservationManifest(observation);
  return observation;
}

function recordRuntimeHookArtifactWriteFailure(
  observation: CodexRuntimeHookObservation,
  operation: string,
  error: unknown
): void {
  observation.artifactWriteFailures += 1;
  const message = `${operation} failed: ${(error as Error).message}`;
  if (!observation.warnings.includes(message) && observation.warnings.length < 20) {
    observation.warnings.push(message);
  }
}

async function recordRuntimeHookEvent(
  observation: CodexRuntimeHookObservation | undefined,
  event: Record<string, unknown>
): Promise<void> {
  if (!observation) return;
  const summary = summarizeCodexRuntimeEvent(event);
  observation.totalEvents += 1;
  observation.eventTypes[summary.type] = (observation.eventTypes[summary.type] ?? 0) + 1;
  if (summary.type === 'turn.completed' || summary.type === 'turn.failed') {
    observation.terminalEventType = summary.type;
  }
  if (summary.relevance.length === 0) return;
  observation.hookRelevantEvents += summary.relevance.includes('hook') ? 1 : 0;
  observation.permissionRequestRelevantEvents += summary.relevance.some(
    relevance => relevance === 'permission-request' || relevance === 'approval'
  )
    ? 1
    : 0;
  observation.stopContinuationRelevantEvents += summary.relevance.includes('stop-continuation')
    ? 1
    : 0;
  if (observation.persistedRelevantEvents >= MAX_CODEX_RUNTIME_HOOK_EVENTS) {
    observation.droppedRelevantEvents += 1;
    return;
  }
  try {
    await appendFile(observation.eventLogPath, `${JSON.stringify(summary)}\n`, 'utf8');
    observation.persistedRelevantEvents += 1;
  } catch (error) {
    recordRuntimeHookArtifactWriteFailure(observation, 'runtime hook event append', error);
    getLog().warn(
      { err: error as Error, summaryPath: observation.summaryPath },
      'codex.runtime_hook_event_append_failed'
    );
  }
}

async function finalizeRuntimeHookObservation(
  observation: CodexRuntimeHookObservation | undefined,
  status: 'completed' | 'failed',
  errorMessage?: string
): Promise<readonly string[]> {
  if (!observation) return [];
  const finalizationWarnings: string[] = [];
  const addFinalizationWarning = (message: string): void => {
    observation.warnings.push(message);
    finalizationWarnings.push(message);
  };
  observation.endedAt = new Date().toISOString();
  observation.status = observation.terminalEventType === 'turn.failed' ? 'failed' : status;
  if (errorMessage) addFinalizationWarning(`Codex turn ended with error: ${errorMessage}`);
  const nonDecisionHookHandlers = Math.max(
    0,
    observation.configuredHookSurfaces.inventoriedHookHandlers -
      observation.configuredHookSurfaces.permissionRequestHooks -
      observation.configuredHookSurfaces.stopContinuationHooks
  );
  if (nonDecisionHookHandlers > 0 && observation.hookRelevantEvents === 0) {
    addFinalizationWarning(
      `${nonDecisionHookHandlers} Codex hook handler(s) were inventoried outside PermissionRequest/Stop, but the Codex SDK stream did not expose hook lifecycle or decision events to Archon.`
    );
  }
  if (
    observation.configuredHookSurfaces.permissionRequestHooks > 0 &&
    observation.permissionRequestRelevantEvents === 0
  ) {
    addFinalizationWarning(
      'PermissionRequest hooks were configured, but the Codex SDK stream did not expose PermissionRequest hook decision events to Archon.'
    );
  }
  if (
    observation.configuredHookSurfaces.stopContinuationHooks > 0 &&
    observation.stopContinuationRelevantEvents === 0
  ) {
    addFinalizationWarning(
      'Stop/SubagentStop continuation hooks were configured, but the Codex SDK stream did not expose continuation decision events to Archon.'
    );
  }
  if (observation.droppedRelevantEvents > 0) {
    addFinalizationWarning(
      `${observation.droppedRelevantEvents} hook-relevant runtime event summaries were omitted after the ${MAX_CODEX_RUNTIME_HOOK_EVENTS} event cap.`
    );
  }
  try {
    await writeRuntimeHookObservationSummary(observation);
    await writeRuntimeHookObservationManifest(observation);
  } catch (error) {
    getLog().warn(
      { err: error as Error, summaryPath: observation.summaryPath },
      'codex.runtime_hook_summary_write_failed'
    );
  }
  return finalizationWarnings;
}

// Singleton Codex instance (async because binary path resolution is async)
let codexInstance: Codex | null = null;
let codexInitPromise: Promise<Codex> | null = null;

/** Reset singleton state. Exported for tests only. */
export function resetCodexSingleton(): void {
  codexInstance = null;
  codexInitPromise = null;
}

/**
 * Get or create Codex SDK instance.
 */
async function getCodex(configCodexBinaryPath?: string): Promise<Codex> {
  if (codexInstance) return codexInstance;

  if (!codexInitPromise) {
    codexInitPromise = (async (): Promise<Codex> => {
      const codexPathOverride = await resolveCodexBinaryPath(configCodexBinaryPath);
      const instance = new Codex({ codexPathOverride });
      codexInstance = instance;
      return instance;
    })().catch(err => {
      codexInitPromise = null;
      throw err;
    });
  }
  return codexInitPromise;
}

/**
 * Build thread options for Codex SDK
 */
function buildThreadOptions(
  cwd: string,
  model?: string,
  assistantConfig?: Record<string, unknown>,
  effectiveApprovalPolicy?: CodexApprovalPolicy
): ThreadOptions {
  const config = parseCodexConfig(assistantConfig ?? {});
  return {
    workingDirectory: cwd,
    skipGitRepoCheck: true,
    sandboxMode: config.sandboxMode ?? DEFAULT_CODEX_SANDBOX_MODE,
    networkAccessEnabled: config.networkAccessEnabled ?? DEFAULT_CODEX_NETWORK_ACCESS,
    approvalPolicy:
      effectiveApprovalPolicy ?? config.approvalPolicy ?? DEFAULT_CODEX_APPROVAL_POLICY,
    model: model ?? config.model,
    modelReasoningEffort: config.modelReasoningEffort,
    webSearchMode: config.webSearchMode,
    additionalDirectories: config.additionalDirectories,
  };
}

function isAutonomousCodexRequest(nodeConfig?: NodeConfig): boolean {
  return nodeConfig?.workflow_mode === 'autonomous';
}

function resolveCodexApprovalPolicy(
  configuredApprovalPolicy: CodexApprovalPolicy | undefined,
  nodeConfig?: NodeConfig
): CodexApprovalPolicy {
  if (isAutonomousCodexRequest(nodeConfig)) {
    return DEFAULT_CODEX_APPROVAL_POLICY;
  }
  return configuredApprovalPolicy ?? DEFAULT_CODEX_APPROVAL_POLICY;
}

function buildCodexEnv(requestEnv: Record<string, string>): Record<string, string> {
  const baseEnv = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  );
  // Managed project env intentionally overrides inherited process env for project-scoped execution.
  return { ...baseEnv, ...requestEnv };
}

function buildMcpEnvSource(
  requestEnv?: Record<string, string>
): Record<string, string | undefined> {
  return requestEnv ? { ...process.env, ...requestEnv } : process.env;
}

const CODEX_MCP_PASSTHROUGH_KEYS = [
  'command',
  'args',
  'env',
  'url',
  'enabled',
  'required',
  'startup_timeout_sec',
  'startup_timeout_ms',
  'tool_timeout_sec',
  'enabled_tools',
  'disabled_tools',
  'supports_parallel_tool_calls',
  'cwd',
  'env_vars',
  'experimental_environment',
  'http_headers',
  'env_http_headers',
  'oauth_resource',
  'scopes',
  'bearer_token_env_var',
  'default_tools_approval_mode',
  'tools',
] as const;

function toCodexConfigValue(value: unknown): CodexConfigValue | undefined {
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

function setCodexConfigValue(target: CodexConfigOverrides, key: string, value: unknown): void {
  const converted = toCodexConfigValue(value);
  if (converted !== undefined) {
    target[key] = converted;
  }
}

function convertMcpServerConfigForCodex(
  serverConfig: Record<string, unknown>
): CodexConfigOverrides {
  const result: CodexConfigOverrides = {};

  for (const key of CODEX_MCP_PASSTHROUGH_KEYS) {
    if (key in serverConfig) {
      setCodexConfigValue(result, key, serverConfig[key]);
    }
  }

  // Archon's MCP JSON format uses `headers`; Codex config uses `http_headers`.
  if ('headers' in serverConfig && !('http_headers' in result)) {
    setCodexConfigValue(result, 'http_headers', serverConfig.headers);
  }

  return result;
}

function buildCodexMcpConfigOverrides(
  servers: Record<string, unknown>
): CodexConfigOverrides | undefined {
  const mcpServers: CodexConfigOverrides = {};

  for (const [serverName, serverConfig] of Object.entries(servers)) {
    if (typeof serverConfig !== 'object' || serverConfig === null || Array.isArray(serverConfig)) {
      getLog().warn(
        { serverName, valueType: typeof serverConfig },
        'codex.mcp_server_config_not_object'
      );
      continue;
    }

    const converted = convertMcpServerConfigForCodex(serverConfig as Record<string, unknown>);
    if (Object.keys(converted).length > 0) {
      mcpServers[serverName] = converted;
    }
  }

  if (Object.keys(mcpServers).length === 0) return undefined;
  return { mcp_servers: mcpServers };
}

const CODEX_MODEL_FALLBACKS: Record<string, string> = {
  'gpt-5.3-codex': 'gpt-5.2-codex',
};

function isModelAccessError(errorMessage: string): boolean {
  const m = errorMessage.toLowerCase();
  const hasModel = m.includes('model');
  const hasAvailabilitySignal =
    m.includes('not available') || m.includes('not found') || m.includes('access denied');
  return hasModel && hasAvailabilitySignal;
}

function buildModelAccessMessage(model?: string): string {
  const normalizedModel = model?.trim();
  const selectedModel = normalizedModel || 'the configured model';
  const suggested = normalizedModel ? CODEX_MODEL_FALLBACKS[normalizedModel] : undefined;

  const fixLine = suggested
    ? `To fix: update your model in ~/.archon/config.yaml:\n  assistants:\n    codex:\n      model: ${suggested}`
    : 'To fix: update your model in ~/.archon/config.yaml to one your account can access.';

  const workflowLine = suggested
    ? `Or set it per-workflow with \`model: ${suggested}\` in workflow YAML.`
    : 'Or set it per-workflow with a valid `model:` in workflow YAML.';

  return `❌ Model "${selectedModel}" is not available for your account.\n\n${fixLine}\n\n${workflowLine}`;
}

const MAX_SUBPROCESS_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;
const RATE_LIMIT_PATTERNS = ['rate limit', 'too many requests', '429', 'overloaded'];
const AUTH_PATTERNS = [
  'credit balance',
  'unauthorized',
  'authentication',
  'invalid token',
  '401',
  '403',
];
const SUBPROCESS_CRASH_PATTERNS = ['exited with code', 'killed', 'signal', 'codex exec'];

function classifyCodexError(
  errorMessage: string
): 'rate_limit' | 'auth' | 'crash' | 'model_access' | 'unknown' {
  if (isModelAccessError(errorMessage)) return 'model_access';
  const m = errorMessage.toLowerCase();
  if (RATE_LIMIT_PATTERNS.some(p => m.includes(p))) return 'rate_limit';
  if (AUTH_PATTERNS.some(p => m.includes(p))) return 'auth';
  if (SUBPROCESS_CRASH_PATTERNS.some(p => m.includes(p))) return 'crash';
  return 'unknown';
}

function extractUsageFromCodexEvent(event: TurnCompletedEvent): TokenUsage {
  if (!event.usage) {
    getLog().warn({ eventType: event.type }, 'codex.usage_null_on_turn_completed');
    return { input: 0, output: 0 };
  }
  return {
    input: event.usage.input_tokens,
    output: event.usage.output_tokens,
  };
}

// ─── Turn Options Builder ────────────────────────────────────────────────

/**
 * Build turn options for a single Codex turn.
 * Handles output schema from both requestOptions and nodeConfig (workflow path).
 */
function buildTurnOptions(requestOptions?: SendQueryOptions): {
  turnOptions: TurnOptions;
  hasOutputFormat: boolean;
} {
  const turnOptions: TurnOptions = {};
  const hasOutputFormat = !!(
    requestOptions?.outputFormat ?? requestOptions?.nodeConfig?.output_format
  );
  if (requestOptions?.outputFormat) {
    turnOptions.outputSchema = requestOptions.outputFormat.schema;
  }
  if (requestOptions?.nodeConfig?.output_format && !requestOptions?.outputFormat) {
    turnOptions.outputSchema = requestOptions.nodeConfig.output_format;
  }
  // Signal assignment is intentionally per-attempt (in sendQuery's retry
  // loop), not here. Reusing a single AbortSignal across retries can poison
  // later attempts once any earlier attempt's subprocess is SIGTERM'd.
  // See issue #1266.
  return { turnOptions, hasOutputFormat };
}

// ─── Stream Normalizer ───────────────────────────────────────────────────

/** State maintained across Codex event stream normalization. */
interface CodexStreamState {
  lastTodoListSignature?: string;
}

/**
 * Normalize raw Codex SDK events into Archon MessageChunks.
 * Handles structured output normalization (Codex returns JSON inline in text).
 */
async function* streamCodexEvents(
  events: AsyncIterable<Record<string, unknown>>,
  hasOutputFormat: boolean,
  threadId: string | null | undefined,
  abortSignal?: AbortSignal,
  surfaceMcpClientErrors = false,
  runtimeHookObservation?: CodexRuntimeHookObservation
): AsyncGenerator<MessageChunk> {
  const state: CodexStreamState = {};
  let accumulatedText = '';

  if (abortSignal?.aborted) {
    getLog().info('query_aborted_before_stream');
    throw new Error('Query aborted');
  }

  // If the iterator closes without a terminal event (e.g. the model was
  // rejected before the turn even started), we synthesize a fail-stop result
  // after the loop so the dag-executor's `msg.isError` branch catches it
  // — matching Claude's contract. Both terminal branches below `return`,
  // so reaching the post-loop block can only mean no terminal fired.
  let lastNonMcpError: string | undefined;

  for await (const event of events) {
    await recordRuntimeHookEvent(runtimeHookObservation, event);

    if (abortSignal?.aborted) {
      getLog().info('query_aborted_between_events');
      throw new Error('Query aborted');
    }

    if (event.type === 'item.started') {
      const item = event.item as { type: string; id: string };
      getLog().debug(
        { eventType: event.type, itemType: item.type, itemId: item.id },
        'item_started'
      );
    }

    if (event.type === 'error') {
      const errorEvent = event as { message: string };
      getLog().error({ message: errorEvent.message }, 'stream_error');
      // MCP client errors are non-fatal — Codex retries internally and may
      // still reach turn.completed. Other errors are captured; whether they
      // are fatal is decided when the stream terminates: turn.completed
      // means the SDK recovered, so the captured error is dropped; loop
      // closure without a terminal means the captured error caused the
      // stream to abort and is surfaced as the failure cause.
      const isMcpClientError = errorEvent.message.toLowerCase().includes('mcp client');
      if (!isMcpClientError) {
        lastNonMcpError = errorEvent.message;
      } else if (surfaceMcpClientErrors) {
        // MCP was explicitly configured for this node — surface MCP client
        // errors as system warnings so the workflow author can diagnose.
        yield { type: 'system', content: `⚠️ ${errorEvent.message}` };
      }
      continue;
    }

    if (event.type === 'turn.failed') {
      const errorObj = (event as { error?: { message?: string } }).error;
      const errorMessage = errorObj?.message ?? 'Unknown error';
      getLog().error({ errorMessage }, 'turn_failed');
      yield {
        type: 'result',
        sessionId: threadId ?? undefined,
        isError: true,
        errorSubtype: 'codex_turn_failed',
        errors: [errorMessage],
      };
      return;
    }

    if (event.type === 'item.completed') {
      const item = event.item as Record<string, unknown>;
      const itemType = item.type as string;

      const logContext: Record<string, unknown> = {
        eventType: event.type,
        itemType,
        itemId: item.id,
      };
      if (itemType === 'command_execution' && item.command) {
        logContext.command = item.command;
      }
      getLog().debug(logContext, 'item_completed');

      switch (itemType) {
        case 'agent_message':
          if (item.text) {
            if (hasOutputFormat) accumulatedText += item.text as string;
            yield { type: 'assistant', content: item.text as string };
          }
          break;

        case 'command_execution':
          if (item.command) {
            const cmd = item.command as string;
            yield { type: 'tool', toolName: cmd };
            const exitCode = item.exit_code as number | null | undefined;
            const exitSuffix =
              exitCode != null && exitCode !== 0 ? `\n[exit code: ${String(exitCode)}]` : '';
            yield {
              type: 'tool_result',
              toolName: cmd,
              toolOutput: ((item.aggregated_output as string) ?? '') + exitSuffix,
            };
          } else {
            getLog().warn({ itemId: item.id }, 'command_execution_missing_command');
          }
          break;

        case 'reasoning':
          if (item.text) {
            yield { type: 'thinking', content: item.text as string };
          }
          break;

        case 'web_search':
          if (item.query) {
            const searchToolName = `🔍 Searching: ${item.query as string}`;
            yield { type: 'tool', toolName: searchToolName };
            yield { type: 'tool_result', toolName: searchToolName, toolOutput: '' };
          } else {
            getLog().debug({ itemId: item.id }, 'web_search_missing_query');
          }
          break;

        case 'todo_list': {
          const items = item.items as { text?: string; completed?: boolean }[] | undefined;
          if (Array.isArray(items) && items.length > 0) {
            const normalizedItems = items.map(t => ({
              text: typeof t.text === 'string' ? t.text : '(unnamed task)',
              completed: t.completed ?? false,
            }));
            const signature = JSON.stringify(normalizedItems);
            if (signature !== state.lastTodoListSignature) {
              state.lastTodoListSignature = signature;
              const taskList = normalizedItems
                .map(t => `${t.completed ? '✅' : '⬜'} ${t.text}`)
                .join('\n');
              yield { type: 'system', content: `📋 Tasks:\n${taskList}` };
            }
          } else {
            getLog().debug({ itemId: item.id }, 'todo_list_empty_or_invalid');
          }
          break;
        }

        case 'file_change': {
          const statusIcon = (item.status as string) === 'failed' ? '❌' : '✅';
          const rawError = 'error' in item ? (item as { error?: unknown }).error : undefined;
          const fileErrorMessage =
            typeof rawError === 'string'
              ? rawError
              : typeof rawError === 'object' && rawError !== null && 'message' in rawError
                ? String((rawError as { message: unknown }).message)
                : undefined;

          const changes = item.changes as { kind: string; path?: string }[] | undefined;
          if (Array.isArray(changes) && changes.length > 0) {
            const changeList = changes
              .map(c => {
                const icon = c.kind === 'add' ? '➕' : c.kind === 'delete' ? '➖' : '📝';
                return `${icon} ${c.path ?? '(unknown file)'}`;
              })
              .join('\n');
            const errorSuffix =
              (item.status as string) === 'failed' && fileErrorMessage
                ? `\n${fileErrorMessage}`
                : '';
            yield {
              type: 'system',
              content: `${statusIcon} File changes:\n${changeList}${errorSuffix}`,
            };
          } else if ((item.status as string) === 'failed') {
            getLog().warn(
              { itemId: item.id, status: item.status },
              'file_change_failed_no_changes'
            );
            const failMsg = fileErrorMessage
              ? `❌ File change failed: ${fileErrorMessage}`
              : '❌ File change failed';
            yield { type: 'system', content: failMsg };
          } else {
            getLog().debug({ itemId: item.id, status: item.status }, 'file_change_no_changes');
          }
          break;
        }

        case 'mcp_tool_call': {
          const server = item.server as string | undefined;
          const tool = item.tool as string | undefined;
          const toolInfo = server && tool ? `${server}/${tool}` : (tool ?? server ?? 'MCP tool');
          const mcpToolName = `🔌 MCP: ${toolInfo}`;

          yield { type: 'tool', toolName: mcpToolName };

          if ((item.status as string) === 'failed') {
            getLog().warn(
              { server, tool, error: item.error, itemId: item.id },
              'mcp_tool_call_failed'
            );
            const mcpError = item.error as { message?: string } | undefined;
            const errMsg = mcpError?.message
              ? `❌ Error: ${mcpError.message}`
              : '❌ Error: MCP tool failed';
            yield { type: 'tool_result', toolName: mcpToolName, toolOutput: errMsg };
          } else {
            let toolOutput = '';
            const mcpResult = item.result as { content?: unknown } | undefined;
            if (mcpResult?.content) {
              if (Array.isArray(mcpResult.content)) {
                toolOutput = JSON.stringify(mcpResult.content);
              } else {
                getLog().warn(
                  {
                    itemId: item.id,
                    server,
                    tool,
                    resultType: typeof mcpResult.content,
                  },
                  'mcp_tool_call_unexpected_result_shape'
                );
              }
            }
            yield { type: 'tool_result', toolName: mcpToolName, toolOutput };
          }
          break;
        }
      }
    }

    if (event.type === 'turn.completed') {
      getLog().debug('turn_completed');
      const usage = extractUsageFromCodexEvent(event as TurnCompletedEvent);

      // Codex returns structured output inline in agent_message text.
      // Normalize: parse as JSON and put on structuredOutput so the
      // dag-executor can handle all providers uniformly.
      let structuredOutput: unknown;
      if (hasOutputFormat && accumulatedText) {
        try {
          structuredOutput = JSON.parse(accumulatedText);
          getLog().debug('codex.structured_output_parsed');
        } catch {
          getLog().warn(
            { outputPreview: accumulatedText.slice(0, 200) },
            'codex.structured_output_not_json'
          );
          yield {
            type: 'system',
            content:
              '⚠️ Structured output requested but Codex returned non-JSON text. ' +
              'Downstream $nodeId.output.field references may not evaluate correctly.',
          };
        }
      }

      yield {
        type: 'result',
        sessionId: threadId ?? undefined,
        tokens: usage,
        ...(structuredOutput !== undefined ? { structuredOutput } : {}),
      };
      return;
    }
  }

  // Reaching here means the iterator closed without yielding turn.completed
  // or turn.failed (both branches `return` immediately). Common cause: model
  // rejected by the API (model not supported, auth refused) before the turn
  // started. Surface as a fail-stop. The dag-executor's `msg.isError` branch
  // (dag-executor.ts: throws `Node '<id>' failed: SDK returned <subtype>`)
  // turns this into a thrown node failure — distinct from the empty-output
  // guard further down, which returns `{ state: 'failed' }` for AI nodes
  // that streamed nothing but never raised an isError.
  const message = lastNonMcpError ?? 'Codex stream closed without turn.completed or turn.failed';
  getLog().error({ message }, 'stream_incomplete');
  yield {
    type: 'result',
    sessionId: threadId ?? undefined,
    isError: true,
    errorSubtype: 'codex_stream_incomplete',
    errors: [message],
  };
}

// ─── Error Classification & Retry ────────────────────────────────────────

/**
 * Classify a Codex error and determine retry eligibility.
 */
function classifyAndEnrichCodexError(
  error: Error,
  model?: string
): { enrichedError: Error; errorClass: string; shouldRetry: boolean } {
  const errorClass = classifyCodexError(error.message);

  if (errorClass === 'model_access') {
    return {
      enrichedError: new Error(buildModelAccessMessage(model)),
      errorClass,
      shouldRetry: false,
    };
  }

  if (errorClass === 'auth') {
    const enrichedError = new Error(`Codex auth error: ${error.message}`);
    enrichedError.cause = error;
    return { enrichedError, errorClass, shouldRetry: false };
  }

  const enrichedError = new Error(`Codex ${errorClass}: ${error.message}`);
  enrichedError.cause = error;
  const shouldRetry = errorClass === 'rate_limit' || errorClass === 'crash';
  return { enrichedError, errorClass, shouldRetry };
}

// ─── Codex Provider ──────────────────────────────────────────────────────

/**
 * Codex AI agent provider.
 * Implements IAgentProvider with Codex SDK integration.
 *
 * sendQuery orchestrates the following internal helpers:
 * - buildThreadOptions: SDK thread configuration
 * - buildTurnOptions: per-turn configuration (output schema, abort signal)
 * - streamCodexEvents: raw SDK event normalization into MessageChunks
 * - classifyAndEnrichCodexError: error classification for retry decisions
 */
export class CodexProvider implements IAgentProvider {
  private readonly retryBaseDelayMs: number;
  private readonly hookPreflightRunner: CodexHookPreflightRunner;

  constructor(options?: {
    retryBaseDelayMs?: number;
    hookPreflightRunner?: CodexHookPreflightRunner;
  }) {
    this.retryBaseDelayMs = options?.retryBaseDelayMs ?? RETRY_BASE_DELAY_MS;
    this.hookPreflightRunner = options?.hookPreflightRunner ?? runCodexHookBootloaderPreflight;
  }

  private async createCodexClient(
    configCodexBinaryPath: string | undefined,
    requestEnv?: Record<string, string>,
    codexConfigOverrides?: CodexConfigOverrides
  ): Promise<Codex> {
    if ((!requestEnv || Object.keys(requestEnv).length === 0) && !codexConfigOverrides) {
      return getCodex(configCodexBinaryPath);
    }

    try {
      const codexOptions: CodexOptions = {
        codexPathOverride: await resolveCodexBinaryPath(configCodexBinaryPath),
        ...(requestEnv && Object.keys(requestEnv).length > 0
          ? { env: buildCodexEnv(requestEnv) }
          : {}),
        ...(codexConfigOverrides ? { config: codexConfigOverrides } : {}),
      };
      return new Codex(codexOptions);
    } catch (error) {
      const err = error as Error;
      if (isModelAccessError(err.message)) {
        throw new Error(buildModelAccessMessage());
      }
      throw new Error(`Codex query failed: ${err.message}`);
    }
  }

  getCapabilities(): ProviderCapabilities {
    return CODEX_CAPABILITIES;
  }

  async *sendQuery(
    prompt: string,
    cwd: string,
    resumeSessionId?: string,
    requestOptions?: SendQueryOptions
  ): AsyncGenerator<MessageChunk> {
    const assistantConfig = requestOptions?.assistantConfig ?? {};
    const codexConfig = parseCodexConfig(assistantConfig);
    const providerWarnings: ProviderWarning[] = [];
    let codexConfigOverrides: CodexConfigOverrides | undefined;
    const effectiveApprovalPolicy = resolveCodexApprovalPolicy(
      codexConfig.approvalPolicy,
      requestOptions?.nodeConfig
    );

    for (const diagnostic of codexConfig.diagnostics) {
      providerWarnings.push({
        code: `codex_config_${diagnostic.field}_${diagnostic.badBehaviour.pattern}`,
        message: `${diagnostic.message} ${diagnostic.badBehaviour.rationale} [${diagnostic.badBehaviour.pattern}:${diagnostic.badBehaviour.classification}]`,
      });
    }

    const fatalConfigDiagnostics = codexConfig.diagnostics.filter(
      diagnostic => diagnostic.badBehaviour.classification === 'bug'
    );

    if (
      isAutonomousCodexRequest(requestOptions?.nodeConfig) &&
      codexConfig.approvalPolicy !== undefined &&
      codexConfig.approvalPolicy !== DEFAULT_CODEX_APPROVAL_POLICY
    ) {
      providerWarnings.push({
        code: 'codex_autonomous_approval_policy_overridden',
        message: `Autonomous Codex workflow requested approvalPolicy=${codexConfig.approvalPolicy}; Archon is using approvalPolicy=${DEFAULT_CODEX_APPROVAL_POLICY} for this run so it does not pause for runtime approvals.`,
      });
    }

    const hookArtifactRoot = resolveCodexHookArtifactRoot(cwd, requestOptions?.nodeConfig);
    const surfaceHookArtifacts = existsSync(cwd);
    const hookPreflight = await this.hookPreflightRunner({
      cwd,
      nodeConfig: requestOptions?.nodeConfig,
      approvalPolicy: effectiveApprovalPolicy,
      ...(hookArtifactRoot ? { artifactRoot: hookArtifactRoot } : {}),
      configuredBinaryPath: codexConfig.codexBinaryPath,
    });
    getLog().info(
      {
        decision: hookPreflight.report.decision,
        reportPath: hookPreflight.artifactPaths.report,
        hookCount: hookPreflight.report.hooks.length,
      },
      'codex.hooks_preflight_completed'
    );
    if (surfaceHookArtifacts) {
      providerWarnings.push({
        code: 'codex_hooks_preflight',
        message: `Codex hook bootloader preflight ${hookPreflight.report.decision}; report: ${hookPreflight.artifactPaths.report}`,
      });
      yield {
        type: 'artifact',
        artifactType: 'file_created',
        label: 'Codex hook artifacts manifest',
        path: hookPreflight.artifactPaths.manifest,
      };
      yield {
        type: 'artifact',
        artifactType: 'file_created',
        label: 'Codex hook bootloader report',
        path: hookPreflight.artifactPaths.report,
      };
      yield {
        type: 'artifact',
        artifactType: 'file_created',
        label: 'Codex hook inventory',
        path: hookPreflight.artifactPaths.inventory,
      };
      yield {
        type: 'artifact',
        artifactType: 'file_created',
        label: 'Codex hook coverage',
        path: hookPreflight.artifactPaths.coverage,
      };
      yield {
        type: 'artifact',
        artifactType: 'file_created',
        label: 'Codex hook trust status',
        path: hookPreflight.artifactPaths.trust,
      };
      yield {
        type: 'artifact',
        artifactType: 'file_created',
        label: 'Codex hook trust status JSON',
        path: hookPreflight.artifactPaths.trustStatus,
      };
      yield {
        type: 'artifact',
        artifactType: 'file_created',
        label: 'Codex hook artifact policy',
        path: hookPreflight.artifactPaths.artifactPolicy,
      };
      yield {
        type: 'artifact',
        artifactType: 'file_created',
        label: 'Codex hook contract',
        path: hookPreflight.artifactPaths.contract,
      };
      yield {
        type: 'artifact',
        artifactType: 'file_created',
        label: 'Codex hook contract evidence',
        path: hookPreflight.artifactPaths.contractEvidence,
      };
      yield {
        type: 'artifact',
        artifactType: 'file_created',
        label: 'Codex PermissionRequest policy',
        path: hookPreflight.artifactPaths.permissionRequest,
      };
      yield {
        type: 'artifact',
        artifactType: 'file_created',
        label: 'Codex PermissionRequest policy JSON',
        path: hookPreflight.artifactPaths.permissionRequestPolicy,
      };
      yield {
        type: 'artifact',
        artifactType: 'file_created',
        label: 'Codex hook bad-behaviour lint',
        path: hookPreflight.artifactPaths.badBehaviourLint,
      };
      yield {
        type: 'artifact',
        artifactType: 'file_created',
        label: 'Codex Stop continuation policy',
        path: hookPreflight.artifactPaths.stopContinuation,
      };
      yield {
        type: 'artifact',
        artifactType: 'file_created',
        label: 'Codex Stop continuation policy JSON',
        path: hookPreflight.artifactPaths.stopContinuationPolicy,
      };
    }
    if (fatalConfigDiagnostics.length > 0 || hookPreflight.report.decision === 'block') {
      const blockedWarnings = [...providerWarnings];
      if (!blockedWarnings.some(warning => warning.code === 'codex_hooks_preflight')) {
        blockedWarnings.push({
          code: 'codex_hooks_preflight',
          message: `Codex hook bootloader preflight ${hookPreflight.report.decision}; report: ${hookPreflight.artifactPaths.report}`,
        });
      }
      for (const warning of blockedWarnings) {
        yield { type: 'system', content: `⚠️ ${warning.message}` };
      }
    }
    if (fatalConfigDiagnostics.length > 0) {
      throw new Error(
        `Codex config contains safety/resource control field(s) that would otherwise be ignored: ${fatalConfigDiagnostics
          .map(diagnostic => `${diagnostic.field} (${diagnostic.message})`)
          .join('; ')}. Hook bootloader report: ${hookPreflight.artifactPaths.report}`
      );
    }
    if (hookPreflight.report.decision === 'block') {
      throw new Error(
        `Codex hook bootloader blocked this run: ${hookPreflight.report.reasons.join('; ')}. Report: ${hookPreflight.artifactPaths.report}`
      );
    }
    if (requestOptions?.nodeConfig?.mcp) {
      const mcpPath = requestOptions.nodeConfig.mcp;
      const { servers, serverNames, missingVars } = await loadMcpConfig(
        mcpPath,
        cwd,
        buildMcpEnvSource(requestOptions.env)
      );
      codexConfigOverrides = buildCodexMcpConfigOverrides(servers);
      getLog().info({ serverNames, mcpPath }, 'codex.mcp_config_loaded');
      if (missingVars.length > 0) {
        const uniqueVars = [...new Set(missingVars)];
        getLog().warn({ missingVars: uniqueVars }, 'codex.mcp_env_vars_missing');
        providerWarnings.push({
          code: 'mcp_env_vars_missing',
          message: `MCP config references undefined env vars: ${uniqueVars.join(', ')}. These will be empty strings - MCP servers may fail to authenticate.`,
        });
      }
    }
    const runtimeHookObservation = surfaceHookArtifacts
      ? await createRuntimeHookObservation(
          hookPreflight.artifactPaths.directory,
          hookPreflight.artifactPaths.report,
          requestOptions?.nodeConfig,
          {
            inventoriedHookHandlers: hookPreflight.report.coverage.inventoriedHookHandlers,
            permissionRequestHooks: hookPreflight.report.permissionRequest.permissionRequestHooks,
            stopContinuationHooks: hookPreflight.report.continuation.stopContinuationHooks,
            permissionRequestBoundedByPreflight: hookPreflight.report.permissionRequest.bounded,
            stopContinuationBoundedByPreflight: hookPreflight.report.continuation.bounded,
          }
        )
      : undefined;
    if (runtimeHookObservation) {
      providerWarnings.push({
        code: 'codex_runtime_hook_observability',
        message: `Codex runtime hook observability artifact: ${runtimeHookObservation.summaryPath}`,
      });

      yield {
        type: 'artifact',
        artifactType: 'file_created',
        label: 'Codex runtime hook observability manifest',
        path: runtimeHookObservation.manifestPath,
      };
      yield {
        type: 'artifact',
        artifactType: 'file_created',
        label: 'Codex runtime hook observability summary',
        path: runtimeHookObservation.summaryPath,
      };
      yield {
        type: 'artifact',
        artifactType: 'file_created',
        label: 'Codex runtime hook event summaries',
        path: runtimeHookObservation.eventLogPath,
      };
    }

    for (const warning of providerWarnings) {
      yield { type: 'system', content: `⚠️ ${warning.message}` };
    }

    // 1. Initialize SDK and build thread options
    const codex = await this.createCodexClient(
      codexConfig.codexBinaryPath,
      requestOptions?.env,
      codexConfigOverrides
    );
    const threadOptions = buildThreadOptions(
      cwd,
      requestOptions?.model,
      assistantConfig,
      effectiveApprovalPolicy
    );

    if (requestOptions?.abortSignal?.aborted) {
      throw new Error('Query aborted');
    }

    // 2. Create or resume thread
    let sessionResumeFailed = false;
    let thread;
    if (resumeSessionId) {
      getLog().debug({ sessionId: resumeSessionId }, 'resuming_thread');
      try {
        thread = codex.resumeThread(resumeSessionId, threadOptions);
      } catch (error) {
        getLog().error({ err: error, sessionId: resumeSessionId }, 'resume_thread_failed');
        try {
          thread = codex.startThread(threadOptions);
        } catch (startError) {
          const err = startError as Error;
          if (isModelAccessError(err.message)) {
            throw new Error(buildModelAccessMessage(requestOptions?.model));
          }
          throw new Error(`Codex query failed: ${err.message}`);
        }
        sessionResumeFailed = true;
      }
    } else {
      getLog().debug({ cwd }, 'starting_new_thread');
      try {
        thread = codex.startThread(threadOptions);
      } catch (error) {
        const err = error as Error;
        if (isModelAccessError(err.message)) {
          throw new Error(buildModelAccessMessage(requestOptions?.model));
        }
        throw new Error(`Codex query failed: ${err.message}`);
      }
    }

    if (sessionResumeFailed) {
      yield {
        type: 'system',
        content: '⚠️ Could not resume previous session. Starting fresh conversation.',
      };
    }

    // 3. Build turn options
    const { turnOptions, hasOutputFormat } = buildTurnOptions(requestOptions);
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= MAX_SUBPROCESS_RETRIES; attempt++) {
      if (requestOptions?.abortSignal?.aborted) {
        throw new Error('Query aborted');
      }

      // Fresh AbortController per attempt. Caller's abortSignal, if any, is
      // chained in via a once-listener so cancellation still propagates.
      // Without this, a signal aborted during attempt N (e.g. when the
      // Codex subprocess crashes and Node.js reacts to the `spawn({ signal })`
      // linkage) would wire an already-aborted signal into attempt N+1's
      // `spawn`, SIGTERMing the freshly spawned child before it reads any
      // input. The "Reading prompt from stdin..." in the resulting error is
      // Codex CLI's startup banner, not an indicator of crash location.
      // See issue #1266.
      const attemptController = new AbortController();
      const onCallerAbort = (): void => {
        attemptController.abort();
      };
      if (requestOptions?.abortSignal) {
        requestOptions.abortSignal.addEventListener('abort', onCallerAbort, { once: true });
      }
      turnOptions.signal = attemptController.signal;

      try {
        if (attempt > 0) {
          getLog().debug({ cwd, attempt }, 'starting_new_thread');
          try {
            thread = codex.startThread(threadOptions);
          } catch (startError) {
            const err = startError as Error;
            if (isModelAccessError(err.message)) {
              getLog().debug({ attempt, errorClass: 'model_access' }, 'query_error_pre_retry');
              throw new Error(buildModelAccessMessage(requestOptions?.model));
            }
            throw new Error(`Codex query failed: ${err.message}`);
          }
        }

        try {
          // 4. Run streamed turn
          const result = await thread.runStreamed(prompt, turnOptions);

          // 5. Stream normalized events (fresh state per attempt to avoid dedup leaks)
          let normalizedStreamError: string | undefined;
          for await (const chunk of streamCodexEvents(
            result.events as AsyncIterable<Record<string, unknown>>,
            hasOutputFormat,
            thread.id,
            attemptController.signal,
            Boolean(requestOptions?.nodeConfig?.mcp),
            runtimeHookObservation
          )) {
            if (chunk.type === 'result' && chunk.isError) {
              normalizedStreamError =
                chunk.errors?.join('; ') ??
                chunk.errorSubtype ??
                'Codex stream produced an error result';
            }
            yield chunk;
          }
          const runtimeHookWarnings = await finalizeRuntimeHookObservation(
            runtimeHookObservation,
            normalizedStreamError ? 'failed' : 'completed',
            normalizedStreamError
          );
          for (const warning of runtimeHookWarnings) {
            yield { type: 'system', content: `⚠️ ${warning}` };
          }
          return;
        } catch (error) {
          const err = error as Error;

          if (requestOptions?.abortSignal?.aborted) {
            throw new Error('Query aborted');
          }

          const { enrichedError, errorClass, shouldRetry } = classifyAndEnrichCodexError(
            err,
            requestOptions?.model
          );

          getLog().error(
            { err, errorClass, attempt, maxRetries: MAX_SUBPROCESS_RETRIES },
            'query_error'
          );

          if (!shouldRetry || attempt >= MAX_SUBPROCESS_RETRIES) {
            const runtimeHookWarnings = await finalizeRuntimeHookObservation(
              runtimeHookObservation,
              'failed',
              enrichedError.message
            );
            for (const warning of runtimeHookWarnings) {
              yield { type: 'system', content: `⚠️ ${warning}` };
            }
            throw enrichedError;
          }

          const delayMs = this.retryBaseDelayMs * Math.pow(2, attempt);
          getLog().info({ attempt, delayMs, errorClass }, 'retrying_query');
          await new Promise(resolve => setTimeout(resolve, delayMs));
          lastError = enrichedError;
        }
      } finally {
        if (requestOptions?.abortSignal) {
          requestOptions.abortSignal.removeEventListener('abort', onCallerAbort);
        }
        // The per-attempt AbortController is short-lived and goes out of
        // scope at iteration end — no explicit abort() cleanup needed.
        // Calling abort() here would race with the codex-sdk's own finally
        // (which calls child.removeAllListeners() + child.kill()), firing
        // Node's internal spawn-signal abort listener on a listenerless
        // child and surfacing an uncaught AbortError.  See #1735.
      }
    }

    throw lastError ?? new Error('Codex query failed after retries');
  }

  getType(): string {
    return 'codex';
  }
}
