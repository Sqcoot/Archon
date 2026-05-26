import { createHash } from 'crypto';
import { execFileSync } from 'child_process';
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'path';
import { homedir } from 'os';
import { createRequire } from 'module';
import {
  type ScopedArtifactRootPolicy,
  ensureScopedArtifactDirectory,
  ensureScopedWritableFilePath,
  resolveScopedArtifactRoot,
  scopedArtifactPath,
} from '@archon/paths';
import type { NodeConfig, ProviderCapabilities } from '../types';
import { CODEX_CAPABILITIES } from './capabilities';

export type CodexHookBootloaderDecision = 'allow' | 'warn' | 'block';

export interface CodexHookSourceReport {
  id: string;
  kind: 'user' | 'project' | 'managed' | 'plugin' | 'unknown';
  format: 'hooks.json' | 'config.toml' | 'requirements.toml' | 'plugin-manifest' | 'unknown';
  path: string;
  exists: boolean;
  sha256?: string;
  trusted: 'managed' | 'unknown' | 'not-applicable';
  hooksFeatureSetting?: boolean;
  allowManagedHooksOnly?: boolean;
  managedDir?: string;
  windowsManagedDir?: string;
  issues: string[];
}

export interface CodexHookHandlerReport {
  sourceId: string;
  event: string;
  matcher?: string;
  definitionSha256: string;
  type: string;
  command?: string;
  commandWindows?: string;
  timeoutSeconds?: number;
  async: boolean;
  riskFlags: string[];
  issues: string[];
}

export interface CodexHookBootloaderReport {
  kind: 'codex-hook-bootloader-report';
  schemaVersion: 'archon.codex-hooks.bootloader.v1';
  generatedAt: string;
  cwd: string;
  projectRoot: string;
  hooksFeatureEnabled: boolean | 'unknown';
  approvalPolicy: string;
  providerHookCapabilities: ProviderCapabilities['hookCapabilities'];
  artifactPolicy: ScopedArtifactRootPolicy;
  codexRuntime: {
    sdkPackage?: CodexPackageEvidence;
    cliPackage?: CodexPackageEvidence;
    binaryPackage?: CodexPackageEvidence;
    configuredBinaryPath?: string;
    envBinaryPath?: string;
    discoveredBinaryPath?: string;
    resolvedBinaryPath?: string;
    binaryVersion?: string;
    binaryVersionCommand?: string;
    schemaCandidates: {
      path: string;
      exists: boolean;
      files?: {
        path: string;
        sizeBytes: number;
        sha256: string;
        contractSource?: 'hook-event-enum' | 'managed-hook-requirements';
        parsedHookEvents?: string[];
      }[];
      issues?: string[];
    }[];
    issues: string[];
  };
  hookContract: CodexHookContractEvidence;
  workflowNodeHooks: {
    present: boolean;
    supportedByArchonForCodex: false;
    safetyCritical: boolean;
    issues: string[];
  };
  sources: CodexHookSourceReport[];
  hooks: CodexHookHandlerReport[];
  trust: {
    status: 'unknown' | 'managed' | 'not-applicable';
    untrustedOrChangedHooksObservable: false;
    unknownProjectHookSources: number;
    unknownPluginHookSources: number;
    unknownNonManagedHookSources: number;
    issues: string[];
  };
  coverage: {
    allowManagedHooksOnly: boolean;
    inventoriedHookHandlers: number;
    enforcedHookHandlers: number;
    excludedHookHandlers: number;
    excludedSensitiveHookHandlers: number;
    excludedContinuationHookHandlers: number;
    excludedPermissionRequestHookHandlers: number;
    unsupportedSensitiveHookHandlers: number;
    disabledSensitiveHookHandlers: number;
    overlongSensitiveHookHandlers: number;
    matcherIgnoredSensitiveHookHandlers: number;
    fragileRelativeSensitiveHookHandlers: number;
    overlappingHookGroups: {
      event: string;
      matcher: string;
      handlers: string[];
      sensitive: boolean;
    }[];
    preToolUseIsCompleteBoundary: false;
    permissionRequestRunsInNoApprovalMode: false;
    matcherUnsupportedEvents: string[];
    uninterceptedToolPaths: string[];
  };
  continuation: {
    stopContinuationHooks: number;
    timeoutlessContinuationHooks: number;
    matcherIgnoredContinuationHooks: number;
    maxObservedTimeoutSeconds?: number;
    maxAllowedTimeoutSeconds: number;
    bounded: boolean;
    issues: string[];
  };
  permissionRequest: {
    permissionRequestHooks: number;
    preToolUseHooks: number;
    preToolUseFallbackBounded: boolean;
    preToolUseFallbackIssues: string[];
    preToolUseFallbackCoverage: {
      requiredMatchers: string[];
      coveredMatchers: string[];
      uncoveredMatchers: string[];
    };
    noApprovalMode: boolean;
    autoApprovalObservable: false;
    autoApprovalPolicy: {
      mode: 'approval-prompt-mode' | 'no-approval-mode' | 'not-applicable';
      decisionsObservable: false;
      boundedBy: 'codex-approval-prompts' | 'pre-tool-use-hooks' | 'unbounded' | 'not-applicable';
      issue?: string;
    };
    timeoutlessPermissionRequestHooks: number;
    overlongPermissionRequestHooks: number;
    permissionOnlyNoApprovalGap: boolean;
    maxAllowedTimeoutSeconds: number;
    maxObservedTimeoutSeconds?: number;
    bounded: boolean;
    issues: string[];
  };
  decision: CodexHookBootloaderDecision;
  reasons: string[];
  warnings: string[];
  artifactPaths: {
    directory: string;
    manifest: string;
    report: string;
    inventory: string;
    coverage: string;
    trust: string;
    trustStatus: string;
    artifactPolicy: string;
    stopContinuation: string;
    stopContinuationPolicy: string;
    contract: string;
    contractEvidence: string;
    permissionRequest: string;
    permissionRequestPolicy: string;
    badBehaviourLint: string;
  };
}

export interface CodexHookBootloaderResult {
  report: CodexHookBootloaderReport;
  artifactPaths: CodexHookBootloaderReport['artifactPaths'];
}

export interface CodexPackageEvidence {
  name: string;
  version?: string;
  packageJsonPath?: string;
  root?: string;
  resolvedFrom?: string;
  issues: string[];
}

export interface CodexHookContractEvidence {
  kind: 'codex-hook-contract';
  schemaVersion: 'archon.codex-hooks.contract.v1';
  generatedAt: string;
  source: 'embedded-context7-official-docs';
  installedRuntimeContractStatus: 'schema-fingerprinted' | 'embedded-docs-only';
  installedRuntimeContractIssue?: string;
  installedRuntimeContractCompatible: boolean | 'unknown';
  installedHookEventCompatibility: 'matched' | 'mismatch' | 'unavailable';
  installedHookEventNames: string[];
  installedHookEventCompatibilityIssues: string[];
  sourceUrl: string;
  context7LibraryId: string;
  context7Query: string;
  context7LibraryCommand: string;
  context7DocsCommand: string;
  context7EvidenceSummary: string[];
  installedRuntimeEvidence: {
    binaryVersionCommand?: string;
    binaryVersion?: string;
    packageSchemaCandidates: number;
    packageSchemasFound: boolean;
    packageSchemaFilesFound: number;
    packageSchemaFingerprints: string[];
    installedHookEventNames: string[];
    installedHookEventCompatibility: 'matched' | 'mismatch' | 'unavailable';
    installedHookEventCompatibilityIssues: string[];
    packageResolutionIssues: string[];
  };
  installedRuntimeVersion?: string;
  defaultCommandHookTimeoutSeconds: 600;
  executableHandlerTypes: string[];
  parsedButSkippedHandlerFeatures: string[];
  supportedEvents: string[];
  matcherSupportedEvents: Record<string, string>;
  matcherIgnoredEvents: string[];
  supportedSources: string[];
  trustModel: {
    nonManagedHooksRequireReview: true;
    trustRecordedAgainstHookHash: true;
    managedHooksTrustedByPolicy: true;
    dangerouslyBypassHookTrustFlag: string;
  };
  knownFailOpenOrUnsupportedFields: Record<string, string[]>;
  coverageLimits: string[];
}

const CODEX_RUNTIME_HOOK_EVENTS = new Set([
  'SessionStart',
  'SubagentStart',
  'PreToolUse',
  'PermissionRequest',
  'PostToolUse',
  'PreCompact',
  'PostCompact',
  'UserPromptSubmit',
  'SubagentStop',
  'Stop',
]);

const MATCHER_UNSUPPORTED_EVENTS = new Set(['Stop', 'UserPromptSubmit']);
const SAFETY_RELEVANT_EVENTS = new Set(['PreToolUse', 'PermissionRequest', 'Stop', 'SubagentStop']);
const PRIVACY_RELEVANT_EVENTS = new Set([
  'UserPromptSubmit',
  'PostToolUse',
  'Stop',
  'SubagentStop',
]);
const MAX_SAFETY_PRIVACY_HOOK_TIMEOUT_SECONDS = 30;
const MAX_CONTINUATION_HOOK_TIMEOUT_SECONDS = 30;
const MAX_PERMISSION_REQUEST_HOOK_TIMEOUT_SECONDS = 30;
const CODEX_DEFAULT_COMMAND_HOOK_TIMEOUT_SECONDS = 600;
const requireFromHere = createRequire(import.meta.url);

export async function runCodexHookBootloaderPreflight(input: {
  cwd: string;
  nodeConfig?: NodeConfig;
  approvalPolicy: string;
  artifactRoot?: string;
  configuredBinaryPath?: string;
}): Promise<CodexHookBootloaderResult> {
  const cwd = resolve(input.cwd);
  const projectRoot = findProjectRoot(cwd);
  const generatedAt = new Date().toISOString();
  const requestedArtifactRoot =
    input.artifactRoot ??
    process.env.ARTIFACTS_DIR ??
    join(projectRoot, '.archon', 'artifacts', 'codex-hooks-preflight', safeTimestamp(generatedAt));
  const artifactPolicy = resolveScopedArtifactRoot({
    cwd: projectRoot,
    artifactsDir: requestedArtifactRoot,
    source: input.artifactRoot
      ? 'explicit:artifact-root'
      : process.env.ARTIFACTS_DIR
        ? 'env:ARTIFACTS_DIR'
        : 'default:codex-hooks-preflight',
  });
  const artifactDir = artifactPolicy.artifactRoot;

  const workflowNodeHooks = inspectWorkflowNodeHooks(input.nodeConfig?.hooks);
  const sourceCandidates = codexHookSourceCandidates(projectRoot);
  const codexRuntime = inspectCodexRuntime(input.configuredBinaryPath);
  const hookContract = buildCodexHookContract(codexRuntime, generatedAt);
  const sourceReports: CodexHookSourceReport[] = [];
  const hookReports: CodexHookHandlerReport[] = [];

  for (const candidate of sourceCandidates) {
    const parsed = await inspectHookSource(candidate);
    sourceReports.push(parsed.source);
    hookReports.push(...parsed.hooks);
  }

  const hooksFeatureEnabled = inferHooksFeatureEnabled(sourceReports);
  const sourceById = new Map(sourceReports.map(source => [source.id, source]));
  const allowManagedHooksOnly = sourceReports.some(source => source.allowManagedHooksOnly === true);
  const effectiveHookReports = allowManagedHooksOnly
    ? hookReports.filter(hook => sourceById.get(hook.sourceId)?.kind === 'managed')
    : hookReports;
  const excludedHookReports = allowManagedHooksOnly
    ? hookReports.filter(hook => sourceById.get(hook.sourceId)?.kind !== 'managed')
    : [];
  const excludedSensitiveHookReports = excludedHookReports.filter(
    hook => hook.riskFlags.includes('safety') || hook.riskFlags.includes('privacy')
  );
  const excludedContinuationHookReports = excludedHookReports.filter(hook =>
    hook.riskFlags.includes('continuation')
  );
  const excludedPermissionRequestHookReports = excludedHookReports.filter(
    hook => hook.event === 'PermissionRequest'
  );
  const blockReasons: string[] = [];
  const warnings: string[] = [];
  const trustIssues: string[] = [];
  const overlappingHookGroups = findOverlappingHookGroups(effectiveHookReports);
  const overlappingSensitiveHookGroups = overlappingHookGroups.filter(group => group.sensitive);
  const unknownProjectHookSources = sourceReports.filter(
    source => source.exists && source.kind === 'project' && source.trusted === 'unknown'
  ).length;
  const unknownPluginHookSources = sourceReports.filter(
    source => source.exists && source.kind === 'plugin' && source.trusted === 'unknown'
  ).length;
  const unknownNonManagedHookSources = sourceReports.filter(
    source => source.exists && source.kind !== 'managed' && source.trusted === 'unknown'
  ).length;

  const hookSourceIssues = sourceReports.flatMap(source =>
    source.issues.map(issue => `${source.id}: ${issue}`)
  );
  if (hookSourceIssues.length > 0) {
    warnings.push(
      `Codex hook inventory has ${hookSourceIssues.length} source issue(s): ${hookSourceIssues.join('; ')}`
    );
  }
  if (allowManagedHooksOnly) {
    warnings.push(
      'allow_managed_hooks_only=true is configured; non-managed hook sources are inventoried but excluded from enforcement decisions because Codex will skip them.'
    );
    if (excludedSensitiveHookReports.length > 0) {
      blockReasons.push(
        `${excludedSensitiveHookReports.length} non-managed safety/privacy hook handler(s) are excluded by allow_managed_hooks_only=true and will not run.`
      );
    }
  }
  if (overlappingHookGroups.length > 0) {
    warnings.push(
      `${overlappingHookGroups.length} Codex hook event/matcher group(s) have multiple handlers; Codex launches matching command hooks concurrently rather than replacing lower-precedence hooks.`
    );
  }
  if (overlappingSensitiveHookGroups.length > 0) {
    blockReasons.push(
      `${overlappingSensitiveHookGroups.length} safety/privacy hook event/matcher group(s) overlap; one matching hook cannot prevent another matching hook from starting.`
    );
  }
  if (unknownProjectHookSources > 0) {
    trustIssues.push(
      `${unknownProjectHookSources} project-local hook source(s) exist, but Archon cannot observe whether Codex trusts the project .codex layer.`
    );
  }
  if (unknownPluginHookSources > 0) {
    trustIssues.push(
      `${unknownPluginHookSources} plugin hook source(s) exist, but Archon cannot observe whether Codex has trusted their current hook definitions.`
    );
  }
  if (unknownNonManagedHookSources > 0) {
    warnings.push(
      `${unknownNonManagedHookSources} non-managed Codex hook source(s) have unobservable trust state; Archon will block safety/privacy handlers from these sources but treats non-safety inventory as diagnostic-only.`
    );
  }

  if (!codexRuntime.sdkPackage?.version) {
    warnings.push('Codex SDK package version could not be resolved from the installed runtime.');
  }
  if (
    codexRuntime.schemaCandidates.length === 0 ||
    codexRuntime.schemaCandidates.every(candidate => !candidate.exists)
  ) {
    warnings.push(
      'No installed Codex hook schema/source candidate was found; preflight is using Archon embedded hook-contract knowledge.'
    );
  }
  if (hookContract.installedRuntimeEvidence.installedHookEventCompatibility === 'mismatch') {
    blockReasons.push(
      `Installed Codex hook event contract differs from Archon's embedded contract: ${hookContract.installedRuntimeEvidence.installedHookEventCompatibilityIssues.join('; ')}`
    );
  } else if (
    hookContract.installedRuntimeEvidence.installedHookEventCompatibility === 'unavailable' &&
    codexRuntime.schemaCandidates.some(candidate => candidate.exists)
  ) {
    warnings.push(
      'Installed Codex hook schema/source candidates were found, but hook event names could not be parsed; preflight is using Archon embedded hook-event contract knowledge.'
    );
  }

  if (workflowNodeHooks.present) {
    blockReasons.push(
      'Archon workflow YAML hooks are not mapped into Codex runtime hooks; remove workflow hooks or use provider-native runtime hooks covered by the Codex hook bootloader.'
    );
  }
  if (workflowNodeHooks.safetyCritical) {
    blockReasons.push(
      'Codex node declares safety-critical workflow hooks that Archon cannot enforce for Codex.'
    );
  }

  const safetyHooks = effectiveHookReports.filter(hook => hook.riskFlags.includes('safety'));
  const privacyHooks = effectiveHookReports.filter(hook => hook.riskFlags.includes('privacy'));
  const unknownTrustSensitiveHooks = [...new Set([...safetyHooks, ...privacyHooks])].filter(
    hook => sourceById.get(hook.sourceId)?.trusted !== 'managed'
  );
  if (safetyHooks.length > 0 || privacyHooks.length > 0) {
    if (unknownTrustSensitiveHooks.length > 0) {
      trustIssues.push(
        'Codex runtime hook trust status is not observable through Archon yet; non-managed hooks may be skipped until trusted.'
      );
      blockReasons.push(
        `${unknownTrustSensitiveHooks.length} safety/privacy hook handler(s) have trust status '${unknownTrustSensitiveHooks
          .map(hook => sourceById.get(hook.sourceId)?.trusted ?? 'unknown')
          .join(', ')}'; Archon cannot prove they are trusted.`
      );
    }
  }

  const timeoutlessSensitiveHooks = effectiveHookReports.filter(
    hook =>
      (hook.riskFlags.includes('safety') || hook.riskFlags.includes('privacy')) &&
      hook.timeoutSeconds === undefined
  );
  if (timeoutlessSensitiveHooks.length > 0) {
    blockReasons.push(
      `${timeoutlessSensitiveHooks.length} safety/privacy hook handler(s) omit timeout; Codex defaults command hooks to ${hookContract.defaultCommandHookTimeoutSeconds} seconds.`
    );
  }
  const overlongSensitiveHooks = effectiveHookReports.filter(
    hook =>
      (hook.riskFlags.includes('safety') || hook.riskFlags.includes('privacy')) &&
      hook.timeoutSeconds !== undefined &&
      hook.timeoutSeconds > MAX_SAFETY_PRIVACY_HOOK_TIMEOUT_SECONDS
  );
  if (overlongSensitiveHooks.length > 0) {
    blockReasons.push(
      `${overlongSensitiveHooks.length} safety/privacy hook handler(s) exceed ${MAX_SAFETY_PRIVACY_HOOK_TIMEOUT_SECONDS}s timeout.`
    );
  }

  const unsupportedSensitiveHooks = effectiveHookReports.filter(
    hook =>
      (hook.riskFlags.includes('safety') || hook.riskFlags.includes('privacy')) &&
      hook.issues.some(issue =>
        /unknown Codex hook event|not executable|skipped by Codex|missing command|managed hook command/.test(
          issue
        )
      )
  );
  if (unsupportedSensitiveHooks.length > 0) {
    blockReasons.push(
      `${unsupportedSensitiveHooks.length} safety/privacy hook handler(s) are unsupported, skipped, missing executable command metadata, or not anchored to managed hook directories.`
    );
  }

  const disabledSensitiveHooks = effectiveHookReports.filter(
    hook =>
      (hook.riskFlags.includes('safety') || hook.riskFlags.includes('privacy')) &&
      hook.issues.some(issue => issue.includes('marked disabled'))
  );
  if (disabledSensitiveHooks.length > 0) {
    blockReasons.push(
      `${disabledSensitiveHooks.length} safety/privacy hook handler(s) are marked disabled and will not run.`
    );
  }

  const matcherIgnoredSensitiveHooks = effectiveHookReports.filter(
    hook =>
      (hook.riskFlags.includes('safety') || hook.riskFlags.includes('privacy')) &&
      !hook.riskFlags.includes('continuation') &&
      hook.issues.some(issue => issue.includes('matchers are ignored by Codex'))
  );
  if (matcherIgnoredSensitiveHooks.length > 0) {
    blockReasons.push(
      `${matcherIgnoredSensitiveHooks.length} safety/privacy hook handler(s) declare matcher filters that Codex ignores for this event.`
    );
  }

  const fragileRelativeSensitiveHooks = effectiveHookReports.filter(
    hook =>
      (hook.riskFlags.includes('safety') || hook.riskFlags.includes('privacy')) &&
      hook.issues.some(issue => issue.includes('repo-local hook command appears relative'))
  );
  if (fragileRelativeSensitiveHooks.length > 0) {
    blockReasons.push(
      `${fragileRelativeSensitiveHooks.length} safety/privacy repo-local hook command(s) use fragile relative paths; Codex runs hooks from the session cwd.`
    );
  }

  if (
    hooksFeatureEnabled === false &&
    (workflowNodeHooks.present || effectiveHookReports.length > 0)
  ) {
    blockReasons.push(
      'Codex hooks are disabled by config while hooks are configured or workflow hooks are declared.'
    );
  } else if (
    hooksFeatureEnabled === 'unknown' &&
    effectiveHookReports.length === 0 &&
    !workflowNodeHooks.present
  ) {
    warnings.push('Codex hook inventory is unknown or empty; workflow does not declare hooks.');
  }

  const permissionRequestHooks = effectiveHookReports.filter(
    hook => hook.event === 'PermissionRequest'
  );
  const preToolUseHooks = effectiveHookReports.filter(hook => hook.event === 'PreToolUse');
  const noApprovalMode = isNoApprovalMode(input.approvalPolicy);
  const permissionRequestTimeouts = permissionRequestHooks
    .map(hook => hook.timeoutSeconds)
    .filter((timeout): timeout is number => timeout !== undefined);
  const timeoutlessPermissionRequestHooks = permissionRequestHooks.filter(
    hook => hook.timeoutSeconds === undefined
  );
  const maxObservedPermissionRequestTimeout =
    permissionRequestTimeouts.length > 0 ? Math.max(...permissionRequestTimeouts) : undefined;
  const overlongPermissionRequestHooks = permissionRequestHooks.filter(
    hook =>
      hook.timeoutSeconds !== undefined &&
      hook.timeoutSeconds > MAX_PERMISSION_REQUEST_HOOK_TIMEOUT_SECONDS
  );
  const permissionRequestIssues: string[] = [];
  const permissionRequestWarnings: string[] = [];
  const permissionOnlyGap =
    noApprovalMode && permissionRequestHooks.length > 0 && preToolUseHooks.length === 0;
  const preToolUseFallbackIssues: string[] = [];
  const requiredPermissionRequestMatchers = noApprovalMode
    ? uniqueSortedMatchers(permissionRequestHooks)
    : [];
  let uncoveredPermissionRequestHooks: CodexHookHandlerReport[] =
    noApprovalMode && permissionRequestHooks.length > 0 && preToolUseHooks.length === 0
      ? permissionRequestHooks
      : [];
  if (noApprovalMode && permissionRequestHooks.length > 0 && preToolUseHooks.length > 0) {
    uncoveredPermissionRequestHooks = permissionRequestHooks.filter(
      hook => !preToolUseFallbackCoversPermissionRequest(hook, preToolUseHooks)
    );
    const untrustedFallbackHooks = preToolUseHooks.filter(hook =>
      unknownTrustSensitiveHooks.includes(hook)
    );
    const timeoutlessFallbackHooks = preToolUseHooks.filter(hook =>
      timeoutlessSensitiveHooks.includes(hook)
    );
    const overlongFallbackHooks = preToolUseHooks.filter(hook =>
      overlongSensitiveHooks.includes(hook)
    );
    const unsupportedFallbackHooks = preToolUseHooks.filter(hook =>
      unsupportedSensitiveHooks.includes(hook)
    );
    const disabledFallbackHooks = preToolUseHooks.filter(hook =>
      disabledSensitiveHooks.includes(hook)
    );
    const fragileRelativeFallbackHooks = preToolUseHooks.filter(hook =>
      fragileRelativeSensitiveHooks.includes(hook)
    );
    if (untrustedFallbackHooks.length > 0) {
      preToolUseFallbackIssues.push(
        `${untrustedFallbackHooks.length} PreToolUse fallback hook(s) have unobservable trust status.`
      );
    }
    if (uncoveredPermissionRequestHooks.length > 0) {
      preToolUseFallbackIssues.push(
        `${uncoveredPermissionRequestHooks.length} PermissionRequest hook(s) are not covered by a matching PreToolUse fallback matcher in no-approval mode: ${uncoveredPermissionRequestHooks
          .map(hook => hook.matcher ?? '<all>')
          .join(', ')}.`
      );
    }
    if (timeoutlessFallbackHooks.length > 0) {
      preToolUseFallbackIssues.push(
        `${timeoutlessFallbackHooks.length} PreToolUse fallback hook(s) omit timeout.`
      );
    }
    if (overlongFallbackHooks.length > 0) {
      preToolUseFallbackIssues.push(
        `${overlongFallbackHooks.length} PreToolUse fallback hook(s) exceed ${MAX_SAFETY_PRIVACY_HOOK_TIMEOUT_SECONDS}s timeout.`
      );
    }
    if (unsupportedFallbackHooks.length > 0) {
      preToolUseFallbackIssues.push(
        `${unsupportedFallbackHooks.length} PreToolUse fallback hook(s) are unsupported, skipped, missing command metadata, or not anchored to managed hook directories.`
      );
    }
    if (disabledFallbackHooks.length > 0) {
      preToolUseFallbackIssues.push(
        `${disabledFallbackHooks.length} PreToolUse fallback hook(s) are marked disabled.`
      );
    }
    if (fragileRelativeFallbackHooks.length > 0) {
      preToolUseFallbackIssues.push(
        `${fragileRelativeFallbackHooks.length} PreToolUse fallback hook command(s) use fragile relative paths.`
      );
    }
  }
  const uncoveredPermissionRequestMatchers = uniqueSortedMatchers(uncoveredPermissionRequestHooks);
  const coveredPermissionRequestMatchers = requiredPermissionRequestMatchers.filter(
    matcher => !uncoveredPermissionRequestMatchers.includes(matcher)
  );
  const preToolUseFallbackBounded = preToolUseFallbackIssues.length === 0;
  const permissionRequestAutoApprovalPolicy: CodexHookBootloaderReport['permissionRequest']['autoApprovalPolicy'] =
    permissionRequestHooks.length === 0
      ? {
          mode: 'not-applicable',
          decisionsObservable: false,
          boundedBy: 'not-applicable',
        }
      : noApprovalMode && preToolUseHooks.length > 0
        ? {
            mode: 'no-approval-mode',
            decisionsObservable: false,
            boundedBy: 'pre-tool-use-hooks',
            issue: preToolUseFallbackBounded
              ? 'PermissionRequest hooks are configured while Codex approval prompts are disabled; Archon treats PreToolUse as the bounded enforcement surface because PermissionRequest auto-approval decisions are not observable.'
              : `PermissionRequest hooks are configured while Codex approval prompts are disabled; PreToolUse fallback exists but is not bounded: ${preToolUseFallbackIssues.join('; ')}`,
          }
        : noApprovalMode
          ? {
              mode: 'no-approval-mode',
              decisionsObservable: false,
              boundedBy: 'unbounded',
              issue:
                'PermissionRequest hooks are configured while Codex approval prompts are disabled and no PreToolUse fallback exists; PermissionRequest auto-approval decisions are not observable.',
            }
          : {
              mode: 'approval-prompt-mode',
              decisionsObservable: false,
              boundedBy: 'codex-approval-prompts',
            };
  if (permissionOnlyGap) {
    permissionRequestIssues.push(
      'PermissionRequest hooks are present without PreToolUse hooks while Codex approval policy disables prompts; PermissionRequest may not run.'
    );
  } else if (preToolUseFallbackIssues.length > 0) {
    permissionRequestIssues.push(...preToolUseFallbackIssues);
  } else if (noApprovalMode && permissionRequestHooks.length > 0) {
    permissionRequestWarnings.push(
      'PermissionRequest hooks are present while Codex approval prompts are disabled; Archon records this as an auto-approval policy surface and relies on PreToolUse fallback hooks for bounded enforcement.'
    );
  }
  if (timeoutlessPermissionRequestHooks.length > 0) {
    permissionRequestIssues.push(
      `${timeoutlessPermissionRequestHooks.length} PermissionRequest hook(s) omit timeout; Codex default is ${CODEX_DEFAULT_COMMAND_HOOK_TIMEOUT_SECONDS}s.`
    );
  }
  if (overlongPermissionRequestHooks.length > 0) {
    permissionRequestIssues.push(
      `${overlongPermissionRequestHooks.length} PermissionRequest hook(s) exceed ${MAX_PERMISSION_REQUEST_HOOK_TIMEOUT_SECONDS}s timeout.`
    );
  }
  if (permissionRequestIssues.length > 0) {
    blockReasons.push(...permissionRequestIssues);
  }
  warnings.push(...permissionRequestWarnings);

  const continuationHooks = effectiveHookReports.filter(hook =>
    hook.riskFlags.includes('continuation')
  );
  const timeoutlessContinuationHooks = continuationHooks.filter(
    hook => hook.timeoutSeconds === undefined
  );
  const continuationTimeouts = continuationHooks
    .map(hook => hook.timeoutSeconds)
    .filter((timeout): timeout is number => timeout !== undefined);
  const maxObservedContinuationTimeout =
    continuationTimeouts.length > 0 ? Math.max(...continuationTimeouts) : undefined;
  const overlongContinuationHooks = continuationHooks.filter(
    hook =>
      hook.timeoutSeconds !== undefined &&
      hook.timeoutSeconds > MAX_CONTINUATION_HOOK_TIMEOUT_SECONDS
  );
  const matcherIgnoredContinuationHooks = continuationHooks.filter(hook =>
    hook.issues.some(issue => issue.includes('matchers are ignored by Codex'))
  );
  const untrustedContinuationHooks = continuationHooks.filter(hook =>
    unknownTrustSensitiveHooks.includes(hook)
  );
  const unsupportedContinuationHooks = continuationHooks.filter(hook =>
    unsupportedSensitiveHooks.includes(hook)
  );
  const disabledContinuationHooks = continuationHooks.filter(hook =>
    disabledSensitiveHooks.includes(hook)
  );
  const fragileRelativeContinuationHooks = continuationHooks.filter(hook =>
    fragileRelativeSensitiveHooks.includes(hook)
  );
  const continuationIssues: string[] = [];
  if (untrustedContinuationHooks.length > 0) {
    continuationIssues.push(
      `${untrustedContinuationHooks.length} Stop/SubagentStop continuation hook(s) have unobservable trust status.`
    );
  }
  if (unsupportedContinuationHooks.length > 0) {
    continuationIssues.push(
      `${unsupportedContinuationHooks.length} Stop/SubagentStop continuation hook(s) are unsupported, skipped, missing command metadata, or not anchored to managed hook directories.`
    );
  }
  if (disabledContinuationHooks.length > 0) {
    continuationIssues.push(
      `${disabledContinuationHooks.length} Stop/SubagentStop continuation hook(s) are marked disabled.`
    );
  }
  if (fragileRelativeContinuationHooks.length > 0) {
    continuationIssues.push(
      `${fragileRelativeContinuationHooks.length} Stop/SubagentStop continuation hook command(s) use fragile relative paths.`
    );
  }
  if (timeoutlessContinuationHooks.length > 0) {
    continuationIssues.push(
      `${timeoutlessContinuationHooks.length} Stop/SubagentStop continuation hook(s) omit timeout.`
    );
  }
  if (overlongContinuationHooks.length > 0) {
    continuationIssues.push(
      `${overlongContinuationHooks.length} Stop/SubagentStop continuation hook(s) exceed ${MAX_CONTINUATION_HOOK_TIMEOUT_SECONDS}s timeout.`
    );
  }
  if (matcherIgnoredContinuationHooks.length > 0) {
    continuationIssues.push(
      `${matcherIgnoredContinuationHooks.length} Stop/SubagentStop continuation hook(s) declare matcher filters that Codex ignores for this event.`
    );
  }
  if (continuationIssues.length > 0) {
    blockReasons.push(...continuationIssues);
  }

  const reasons = [...blockReasons, ...warnings];
  const decision: CodexHookBootloaderDecision =
    blockReasons.length > 0 ? 'block' : warnings.length > 0 ? 'warn' : 'allow';
  const trustStatus: CodexHookBootloaderReport['trust']['status'] =
    effectiveHookReports.length === 0
      ? 'not-applicable'
      : effectiveHookReports.every(hook => sourceById.get(hook.sourceId)?.trusted === 'managed')
        ? 'managed'
        : 'unknown';

  const report: CodexHookBootloaderReport = {
    kind: 'codex-hook-bootloader-report',
    schemaVersion: 'archon.codex-hooks.bootloader.v1',
    generatedAt,
    cwd,
    projectRoot,
    hooksFeatureEnabled,
    approvalPolicy: input.approvalPolicy,
    providerHookCapabilities: CODEX_CAPABILITIES.hookCapabilities,
    artifactPolicy,
    codexRuntime,
    hookContract,
    workflowNodeHooks,
    sources: sourceReports,
    hooks: hookReports,
    trust: {
      status: trustStatus,
      untrustedOrChangedHooksObservable: false,
      unknownProjectHookSources,
      unknownPluginHookSources,
      unknownNonManagedHookSources,
      issues: trustIssues,
    },
    coverage: {
      allowManagedHooksOnly,
      inventoriedHookHandlers: hookReports.length,
      enforcedHookHandlers: effectiveHookReports.length,
      excludedHookHandlers: excludedHookReports.length,
      excludedSensitiveHookHandlers: excludedSensitiveHookReports.length,
      excludedContinuationHookHandlers: excludedContinuationHookReports.length,
      excludedPermissionRequestHookHandlers: excludedPermissionRequestHookReports.length,
      unsupportedSensitiveHookHandlers: unsupportedSensitiveHooks.length,
      disabledSensitiveHookHandlers: disabledSensitiveHooks.length,
      overlongSensitiveHookHandlers: overlongSensitiveHooks.length,
      matcherIgnoredSensitiveHookHandlers: matcherIgnoredSensitiveHooks.length,
      fragileRelativeSensitiveHookHandlers: fragileRelativeSensitiveHooks.length,
      overlappingHookGroups,
      preToolUseIsCompleteBoundary: false,
      permissionRequestRunsInNoApprovalMode: false,
      matcherUnsupportedEvents: [...MATCHER_UNSUPPORTED_EVENTS],
      uninterceptedToolPaths: [
        'newer unified shell execution paths may not be fully intercepted',
        'non-shell non-MCP tools such as web search are outside PreToolUse coverage',
      ],
    },
    continuation: {
      stopContinuationHooks: continuationHooks.length,
      timeoutlessContinuationHooks: timeoutlessContinuationHooks.length,
      matcherIgnoredContinuationHooks: matcherIgnoredContinuationHooks.length,
      ...(maxObservedContinuationTimeout !== undefined
        ? { maxObservedTimeoutSeconds: maxObservedContinuationTimeout }
        : {}),
      maxAllowedTimeoutSeconds: MAX_CONTINUATION_HOOK_TIMEOUT_SECONDS,
      bounded: continuationHooks.length === 0 || continuationIssues.length === 0,
      issues: continuationIssues,
    },
    permissionRequest: {
      permissionRequestHooks: permissionRequestHooks.length,
      preToolUseHooks: preToolUseHooks.length,
      preToolUseFallbackBounded,
      preToolUseFallbackIssues,
      preToolUseFallbackCoverage: {
        requiredMatchers: requiredPermissionRequestMatchers,
        coveredMatchers: coveredPermissionRequestMatchers,
        uncoveredMatchers: uncoveredPermissionRequestMatchers,
      },
      noApprovalMode,
      autoApprovalObservable: false,
      autoApprovalPolicy: permissionRequestAutoApprovalPolicy,
      timeoutlessPermissionRequestHooks: timeoutlessPermissionRequestHooks.length,
      overlongPermissionRequestHooks: overlongPermissionRequestHooks.length,
      permissionOnlyNoApprovalGap: permissionOnlyGap,
      maxAllowedTimeoutSeconds: MAX_PERMISSION_REQUEST_HOOK_TIMEOUT_SECONDS,
      ...(maxObservedPermissionRequestTimeout !== undefined
        ? { maxObservedTimeoutSeconds: maxObservedPermissionRequestTimeout }
        : {}),
      bounded: permissionRequestHooks.length === 0 || permissionRequestIssues.length === 0,
      issues: permissionRequestIssues,
    },
    decision,
    reasons,
    warnings,
    artifactPaths: {
      directory: artifactDir,
      manifest: scopedArtifactPath(artifactDir, 'codex-hook-artifacts-manifest.json'),
      report: scopedArtifactPath(artifactDir, 'codex-hook-bootloader-report.json'),
      inventory: scopedArtifactPath(artifactDir, 'codex-hooks-inventory.json'),
      coverage: scopedArtifactPath(artifactDir, 'codex-hook-coverage.md'),
      trust: scopedArtifactPath(artifactDir, 'codex-hook-trust-status.md'),
      trustStatus: scopedArtifactPath(artifactDir, 'codex-hook-trust-status.json'),
      artifactPolicy: scopedArtifactPath(artifactDir, 'codex-hook-artifact-policy.json'),
      stopContinuation: scopedArtifactPath(artifactDir, 'codex-stop-continuation-policy.md'),
      stopContinuationPolicy: scopedArtifactPath(
        artifactDir,
        'codex-stop-continuation-policy.json'
      ),
      contract: scopedArtifactPath(artifactDir, 'codex-hook-contract.json'),
      contractEvidence: scopedArtifactPath(artifactDir, 'codex-hook-contract-evidence.md'),
      permissionRequest: scopedArtifactPath(artifactDir, 'codex-permission-request-policy.md'),
      permissionRequestPolicy: scopedArtifactPath(
        artifactDir,
        'codex-permission-request-policy.json'
      ),
      badBehaviourLint: scopedArtifactPath(artifactDir, 'codex-hook-bad-behaviour-lint.json'),
    },
  };

  await writeHookBootloaderArtifacts(report);
  return { report, artifactPaths: report.artifactPaths };
}

function findProjectRoot(cwd: string): string {
  let current = cwd;
  while (true) {
    if (existsSync(join(current, '.git'))) return current;
    const parent = dirname(current);
    if (parent === current) return cwd;
    current = parent;
  }
}

function safeTimestamp(value: string): string {
  return value.replace(/[:.]/g, '-');
}

function inspectCodexRuntime(
  configuredBinaryPath: string | undefined
): CodexHookBootloaderReport['codexRuntime'] {
  const sdkPackage = resolvePackageEvidence('@openai/codex-sdk');
  const cliPackage = resolvePackageEvidence('@openai/codex');
  const binaryEvidence = inspectCodexBinary(configuredBinaryPath);
  const binaryPackage = resolveBinaryPackageEvidence(binaryEvidence.resolvedBinaryPath);
  const schemaCandidates = [
    ...schemaCandidatesForPackage(cliPackage),
    ...schemaCandidatesForPackage(sdkPackage),
    ...schemaCandidatesForPackage(binaryPackage),
  ];
  const issues = [
    ...runtimeIssuesForPackage('Codex SDK', sdkPackage),
    ...runtimeIssuesForPackage('Codex CLI package', cliPackage),
    ...runtimeIssuesForPackage('Codex binary package', binaryPackage),
    ...binaryEvidence.issues,
  ];
  if (schemaCandidates.length === 0 || schemaCandidates.every(candidate => !candidate.exists)) {
    issues.push(
      'Installed Codex hook schema/source files were not found in known package locations.'
    );
  }

  return {
    ...(sdkPackage ? { sdkPackage } : {}),
    ...(cliPackage ? { cliPackage } : {}),
    ...(binaryPackage ? { binaryPackage } : {}),
    ...(configuredBinaryPath ? { configuredBinaryPath } : {}),
    ...(process.env.CODEX_BIN_PATH ? { envBinaryPath: process.env.CODEX_BIN_PATH } : {}),
    ...(binaryEvidence.discoveredBinaryPath
      ? { discoveredBinaryPath: binaryEvidence.discoveredBinaryPath }
      : {}),
    ...(binaryEvidence.resolvedBinaryPath
      ? { resolvedBinaryPath: binaryEvidence.resolvedBinaryPath }
      : {}),
    ...(binaryEvidence.binaryVersion ? { binaryVersion: binaryEvidence.binaryVersion } : {}),
    ...(binaryEvidence.binaryVersionCommand
      ? { binaryVersionCommand: binaryEvidence.binaryVersionCommand }
      : {}),
    schemaCandidates,
    issues,
  };
}

function inspectCodexBinary(configuredBinaryPath: string | undefined): {
  discoveredBinaryPath?: string;
  resolvedBinaryPath?: string;
  binaryVersion?: string;
  binaryVersionCommand?: string;
  issues: string[];
} {
  const issues: string[] = [];
  const binaryPath = configuredBinaryPath ?? process.env.CODEX_BIN_PATH ?? 'codex';
  const resolvedBinaryPath = resolveCodexBinaryFilesystemPath(binaryPath, issues);

  try {
    const version = execFileSync(binaryPath, ['--version'], {
      encoding: 'utf8',
      timeout: 2000,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    return {
      discoveredBinaryPath: binaryPath,
      ...(resolvedBinaryPath ? { resolvedBinaryPath } : {}),
      binaryVersion: version,
      binaryVersionCommand: `${binaryPath} --version`,
      issues,
    };
  } catch (error) {
    issues.push(
      `Codex binary version probe failed for '${binaryPath}': ${(error as Error).message}`
    );
    return {
      discoveredBinaryPath: binaryPath,
      ...(resolvedBinaryPath ? { resolvedBinaryPath } : {}),
      binaryVersionCommand: `${binaryPath} --version`,
      issues,
    };
  }
}

function resolveCodexBinaryFilesystemPath(
  binaryPath: string,
  issues: string[]
): string | undefined {
  const candidate =
    binaryPath.includes('/') || isAbsolute(binaryPath)
      ? binaryPath
      : locateExecutableOnPath(binaryPath, issues);
  if (!candidate) return undefined;
  try {
    return realpathSync(resolve(candidate));
  } catch (error) {
    issues.push(
      `Codex binary filesystem path could not be resolved for '${candidate}': ${(error as Error).message}`
    );
    return undefined;
  }
}

function locateExecutableOnPath(binaryName: string, issues: string[]): string | undefined {
  try {
    const located = execFileSync('which', [binaryName], {
      encoding: 'utf8',
      timeout: 1000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return located.length > 0 ? located.split(/\r?\n/)[0] : undefined;
  } catch (error) {
    issues.push(
      `Codex binary '${binaryName}' could not be located on PATH: ${(error as Error).message}`
    );
    return undefined;
  }
}

function resolveBinaryPackageEvidence(
  binaryPath: string | undefined
): CodexPackageEvidence | undefined {
  if (!binaryPath) {
    return {
      name: '@openai/codex',
      issues: [
        'Codex binary package root could not be resolved because the binary path is unknown',
      ],
    };
  }
  const packageJsonPath = findNearestPackageJson(dirname(binaryPath));
  if (!packageJsonPath) {
    return {
      name: '@openai/codex',
      resolvedFrom: binaryPath,
      issues: [`Codex binary package.json could not be found above ${binaryPath}`],
    };
  }
  return packageEvidenceFromPackageJson('@openai/codex', packageJsonPath, binaryPath);
}

function buildCodexHookContract(
  runtime: CodexHookBootloaderReport['codexRuntime'],
  generatedAt: string
): CodexHookContractEvidence {
  const installedRuntimeVersion =
    runtime.binaryVersion ?? runtime.cliPackage?.version ?? runtime.sdkPackage?.version;
  const packageSchemaFilesFound = runtime.schemaCandidates.reduce(
    (total, candidate) => total + (candidate.files?.length ?? 0),
    0
  );
  const installedHookEventNames = uniqueSortedHookEvents(
    runtime.schemaCandidates.flatMap(candidate =>
      (candidate.files ?? []).flatMap(file => file.parsedHookEvents ?? [])
    )
  );
  const hookEventCompatibility = compareInstalledHookEvents(installedHookEventNames);
  const packageResolutionIssues = [runtime.cliPackage, runtime.sdkPackage]
    .concat(runtime.binaryPackage ? [runtime.binaryPackage] : [])
    .filter((pkg): pkg is CodexPackageEvidence => pkg !== undefined)
    .flatMap(pkg => pkg.issues.map(issue => `${pkg.name}: ${issue}`));

  return {
    kind: 'codex-hook-contract',
    schemaVersion: 'archon.codex-hooks.contract.v1',
    generatedAt,
    source: 'embedded-context7-official-docs',
    installedRuntimeContractStatus:
      packageSchemaFilesFound > 0 ? 'schema-fingerprinted' : 'embedded-docs-only',
    ...(packageSchemaFilesFound === 0 || hookEventCompatibility.status === 'mismatch'
      ? {
          installedRuntimeContractIssue:
            packageSchemaFilesFound === 0
              ? 'Installed Codex hook schema/source files were not fingerprinted; Archon is using embedded Context7 official-docs contract knowledge for this run.'
              : `Installed Codex hook event names differ from the embedded contract: ${hookEventCompatibility.issues.join('; ')}`,
        }
      : {}),
    installedRuntimeContractCompatible:
      hookEventCompatibility.status === 'matched'
        ? true
        : hookEventCompatibility.status === 'mismatch'
          ? false
          : 'unknown',
    installedHookEventCompatibility: hookEventCompatibility.status,
    installedHookEventNames,
    installedHookEventCompatibilityIssues: hookEventCompatibility.issues,
    sourceUrl: 'https://github.com/openai/codex',
    context7LibraryId: '/openai/codex',
    context7Query:
      'Verify the current Codex CLI hook contract: supported hook events and fields, matcher behavior, default timeout, trust model, plugin or managed hook sources, and unsupported or fail-open hook fields',
    context7LibraryCommand:
      'npx ctx7@latest library "OpenAI Codex CLI" "Verify the current Codex CLI hook contract: supported hook events and fields, matcher behavior, default timeout, trust model, plugin or managed hook sources, and unsupported or fail-open hook fields"',
    context7DocsCommand:
      'npx ctx7@latest docs /openai/codex "Verify the current Codex CLI hook contract: supported hook events and fields, matcher behavior, default timeout, trust model, plugin or managed hook sources, and unsupported or fail-open hook fields"',
    context7EvidenceSummary: [
      'Context7 resolved the official OpenAI Codex CLI source/docs as /openai/codex with High source reputation.',
      'Context7 ManagedHooksRequirements docs expose managedDir/windowsManagedDir plus PreToolUse, PermissionRequest, PostToolUse, PreCompact, PostCompact, SessionStart, UserPromptSubmit, SubagentStart, SubagentStop, and Stop event keys.',
      'Context7 HookEventName protocol docs list the same ten runtime hook events.',
      'Context7 thread/start docs confirm SessionStart source defaults to startup and can be set to clear by sessionStartSource.',
      'Context7 thread/start docs confirm trusted project marking can occur when cwd is supplied with workspace-write or full-access sandbox permissions.',
      'Context7 LoaderOverrides docs confirm managed configuration sources can be overridden for tests and app-managed setups.',
      'Context7 plugin manifest docs identify unsupported manifest fields, including hooks; plugin manifest hooks are diagnostic and skipped rather than treated as trusted runtime sources.',
    ],
    installedRuntimeEvidence: {
      ...(runtime.binaryVersionCommand
        ? { binaryVersionCommand: runtime.binaryVersionCommand }
        : {}),
      ...(runtime.binaryVersion ? { binaryVersion: runtime.binaryVersion } : {}),
      packageSchemaCandidates: runtime.schemaCandidates.length,
      packageSchemasFound: runtime.schemaCandidates.some(candidate => candidate.exists),
      packageSchemaFilesFound,
      packageSchemaFingerprints: runtime.schemaCandidates.flatMap(candidate =>
        (candidate.files ?? []).map(file => `${file.sha256}  ${file.path}`)
      ),
      installedHookEventNames,
      installedHookEventCompatibility: hookEventCompatibility.status,
      installedHookEventCompatibilityIssues: hookEventCompatibility.issues,
      packageResolutionIssues,
    },
    ...(installedRuntimeVersion ? { installedRuntimeVersion } : {}),
    defaultCommandHookTimeoutSeconds: CODEX_DEFAULT_COMMAND_HOOK_TIMEOUT_SECONDS,
    executableHandlerTypes: ['command'],
    parsedButSkippedHandlerFeatures: ['async command hooks', 'prompt handlers', 'agent handlers'],
    supportedEvents: [...CODEX_RUNTIME_HOOK_EVENTS],
    matcherSupportedEvents: {
      PermissionRequest:
        'tool name, including Bash, apply_patch/Edit/Write aliases, and MCP tool names',
      PostToolUse: 'tool name, including Bash, apply_patch/Edit/Write aliases, and MCP tool names',
      PreToolUse: 'tool name, including Bash, apply_patch/Edit/Write aliases, and MCP tool names',
      SessionStart: 'start source: startup, resume, clear, compact',
      SubagentStart: 'subagent type',
      SubagentStop: 'subagent type',
      PreCompact: 'compaction trigger: manual or auto',
      PostCompact: 'compaction trigger: manual or auto',
    },
    matcherIgnoredEvents: [...MATCHER_UNSUPPORTED_EVENTS],
    supportedSources: [
      '~/.codex/hooks.json',
      '~/.codex/config.toml inline hooks',
      '<repo>/.codex/hooks.json',
      '<repo>/.codex/config.toml inline hooks',
      'managed requirements.toml hooks',
      'enabled plugin hooks/hooks.json bundled hooks',
    ],
    trustModel: {
      nonManagedHooksRequireReview: true,
      trustRecordedAgainstHookHash: true,
      managedHooksTrustedByPolicy: true,
      dangerouslyBypassHookTrustFlag: '--dangerously-bypass-hook-trust',
    },
    knownFailOpenOrUnsupportedFields: {
      PreToolUse: [
        'permissionDecision: ask',
        'legacy decision: approve',
        'continue',
        'stopReason',
        'suppressOutput',
        'updatedInput without permissionDecision: allow',
      ],
      PermissionRequest: ['updatedInput', 'updatedPermissions', 'interrupt'],
      PostToolUse: ['updatedMCPToolOutput', 'suppressOutput'],
      SubagentStart: ['continue: false does not stop subagent start'],
      PluginManifest: ['hooks'],
      Common: ['plain-text stdout is invalid for Stop/SubagentStop'],
    },
    coverageLimits: [
      'PreToolUse/PostToolUse do not intercept every shell execution path.',
      'WebSearch and other non-shell non-MCP tools are outside current hook interception.',
      'PermissionRequest only runs when Codex is about to ask for approval.',
      'Stop and UserPromptSubmit ignore matcher filters.',
      'Archon cannot observe persisted non-managed hook trust hashes yet.',
    ],
  };
}

function resolvePackageEvidence(packageName: string): CodexPackageEvidence | undefined {
  try {
    const packageJsonPath = resolvePackageJsonPath(packageName);
    if (packageJsonPath === undefined) {
      return {
        name: packageName,
        issues: [`package '${packageName}' could not be resolved`],
      };
    }
    return packageEvidenceFromPackageJson(packageName, packageJsonPath);
  } catch (error) {
    return {
      name: packageName,
      issues: [`package '${packageName}' inspection failed: ${(error as Error).message}`],
    };
  }
}

function packageEvidenceFromPackageJson(
  packageName: string,
  packageJsonPath: string,
  resolvedFrom?: string
): CodexPackageEvidence {
  const root = dirname(packageJsonPath);
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    name?: string;
    version?: string;
  };
  return {
    name: packageJson.name ?? packageName,
    ...(packageJson.version ? { version: packageJson.version } : {}),
    packageJsonPath,
    root,
    ...(resolvedFrom ? { resolvedFrom } : {}),
    issues: [],
  };
}

function resolvePackageJsonPath(packageName: string): string | undefined {
  try {
    return requireFromHere.resolve(`${packageName}/package.json`);
  } catch {
    try {
      const resolvedFrom = requireFromHere.resolve(packageName);
      return findNearestPackageJson(dirname(resolvedFrom));
    } catch {
      return undefined;
    }
  }
}

function findNearestPackageJson(start: string): string | undefined {
  let current = start;
  while (true) {
    const candidate = join(current, 'package.json');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

function schemaCandidatesForPackage(
  pkg: CodexPackageEvidence | undefined
): CodexHookBootloaderReport['codexRuntime']['schemaCandidates'] {
  if (!pkg?.root) return [];
  const candidates = [
    join(pkg.root, 'codex-rs', 'hooks', 'schema', 'generated'),
    join(pkg.root, 'hooks', 'schema', 'generated'),
    join(pkg.root, 'schema', 'hooks'),
    join(
      pkg.root,
      'codex-rs',
      'app-server-protocol',
      'schema',
      'typescript',
      'v2',
      'ManagedHooksRequirements.ts'
    ),
    join(pkg.root, 'codex-rs', 'protocol', 'src', 'protocol.rs'),
  ];
  return candidates.map(inspectCodexHookSchemaCandidate);
}

function inspectCodexHookSchemaCandidate(
  candidatePath: string
): CodexHookBootloaderReport['codexRuntime']['schemaCandidates'][number] {
  if (!existsSync(candidatePath)) return { path: candidatePath, exists: false };

  const issues: string[] = [];
  try {
    const stat = lstatSync(candidatePath);
    if (stat.isFile()) {
      const content = readFileSync(candidatePath);
      return {
        path: candidatePath,
        exists: true,
        files: [
          {
            path: candidatePath,
            sizeBytes: content.byteLength,
            sha256: createHash('sha256').update(content).digest('hex'),
            ...codexHookContractSourceEvidence(candidatePath, content),
          },
        ],
      };
    }
    if (!stat.isDirectory()) {
      return {
        path: candidatePath,
        exists: true,
        issues: ['schema candidate exists but is not a directory'],
      };
    }
  } catch (error) {
    return {
      path: candidatePath,
      exists: true,
      issues: [`failed to stat schema candidate: ${(error as Error).message}`],
    };
  }

  const files: NonNullable<
    CodexHookBootloaderReport['codexRuntime']['schemaCandidates'][number]['files']
  > = [];
  try {
    for (const entry of readdirSync(candidatePath, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const filePath = join(candidatePath, entry.name);
      try {
        const content = readFileSync(filePath);
        files.push({
          path: filePath,
          sizeBytes: content.byteLength,
          sha256: createHash('sha256').update(content).digest('hex'),
          ...codexHookContractSourceEvidence(filePath, content),
        });
      } catch (error) {
        issues.push(`failed to fingerprint schema file '${filePath}': ${(error as Error).message}`);
      }
    }
  } catch (error) {
    issues.push(`failed to list schema candidate: ${(error as Error).message}`);
  }

  files.sort((a, b) => a.path.localeCompare(b.path));
  return {
    path: candidatePath,
    exists: true,
    ...(files.length > 0 ? { files } : {}),
    ...(issues.length > 0 ? { issues } : {}),
  };
}

function codexHookContractSourceEvidence(
  path: string,
  content: Buffer
):
  | { contractSource: 'hook-event-enum' | 'managed-hook-requirements'; parsedHookEvents: string[] }
  | undefined {
  const text = content.toString('utf8');
  if (path.endsWith('/protocol.rs')) {
    const enumMatch = /enum\s+HookEventName\s*\{([\s\S]*?)\}/.exec(text);
    return {
      contractSource: 'hook-event-enum',
      parsedHookEvents: enumMatch
        ? uniqueSortedHookEvents(
            [...enumMatch[1].matchAll(/\b([A-Z][A-Za-z0-9_]*)\b/g)].map(match => match[1])
          )
        : [],
    };
  }
  if (path.endsWith('/ManagedHooksRequirements.ts')) {
    return {
      contractSource: 'managed-hook-requirements',
      parsedHookEvents: uniqueSortedHookEvents(
        [...text.matchAll(/^\s*([A-Z][A-Za-z0-9_]*)\??\s*:/gm)].map(match => match[1])
      ),
    };
  }
  return undefined;
}

function uniqueSortedHookEvents(events: readonly (string | undefined)[]): string[] {
  const unique = [...new Set(events.filter((event): event is string => !!event))];
  const embeddedOrder = [...CODEX_RUNTIME_HOOK_EVENTS];
  return unique.sort((left, right) => {
    const leftIndex = embeddedOrder.indexOf(left);
    const rightIndex = embeddedOrder.indexOf(right);
    if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex;
    if (leftIndex >= 0) return -1;
    if (rightIndex >= 0) return 1;
    return left.localeCompare(right);
  });
}

function compareInstalledHookEvents(installedHookEvents: readonly string[]): {
  status: 'matched' | 'mismatch' | 'unavailable';
  issues: string[];
} {
  if (installedHookEvents.length === 0) return { status: 'unavailable', issues: [] };
  const embeddedHookEvents = [...CODEX_RUNTIME_HOOK_EVENTS];
  const missing = embeddedHookEvents.filter(event => !installedHookEvents.includes(event));
  const extra = installedHookEvents.filter(event => !CODEX_RUNTIME_HOOK_EVENTS.has(event));
  const issues = [
    ...(missing.length > 0
      ? [`missing embedded event(s) in installed source: ${missing.join(', ')}`]
      : []),
    ...(extra.length > 0
      ? [`unknown installed event(s) not in embedded contract: ${extra.join(', ')}`]
      : []),
  ];
  return issues.length === 0 ? { status: 'matched', issues } : { status: 'mismatch', issues };
}

function runtimeIssuesForPackage(label: string, pkg: CodexPackageEvidence | undefined): string[] {
  if (pkg === undefined) return [`${label} package was not resolvable.`];
  return pkg.issues;
}

function codexHookSourceCandidates(
  projectRoot: string
): Omit<CodexHookSourceReport, 'exists' | 'trusted' | 'issues' | 'sha256'>[] {
  const homeCodex = join(process.env.HOME ?? homedir(), '.codex');
  const projectCodex = join(projectRoot, '.codex');
  return [
    {
      id: 'user-hooks-json',
      kind: 'user',
      format: 'hooks.json',
      path: join(homeCodex, 'hooks.json'),
    },
    {
      id: 'user-config-toml',
      kind: 'user',
      format: 'config.toml',
      path: join(homeCodex, 'config.toml'),
    },
    {
      id: 'user-requirements-toml',
      kind: 'managed',
      format: 'requirements.toml',
      path: join(homeCodex, 'requirements.toml'),
    },
    {
      id: 'project-hooks-json',
      kind: 'project',
      format: 'hooks.json',
      path: join(projectCodex, 'hooks.json'),
    },
    {
      id: 'project-config-toml',
      kind: 'project',
      format: 'config.toml',
      path: join(projectCodex, 'config.toml'),
    },
    {
      id: 'project-requirements-toml',
      kind: 'managed',
      format: 'requirements.toml',
      path: join(projectCodex, 'requirements.toml'),
    },
    ...codexPluginHookSourceCandidates(homeCodex, projectCodex),
  ];
}

function codexPluginHookSourceCandidates(
  homeCodex: string,
  projectCodex: string
): Omit<CodexHookSourceReport, 'exists' | 'trusted' | 'issues' | 'sha256'>[] {
  const pluginRoots = [
    join(homeCodex, 'plugins'),
    join(homeCodex, 'plugins', 'cache'),
    join(homeCodex, 'plugins', 'enabled'),
    join(projectCodex, 'plugins'),
  ];
  const seen = new Set<string>();
  const candidates: Omit<CodexHookSourceReport, 'exists' | 'trusted' | 'issues' | 'sha256'>[] = [];

  for (const root of pluginRoots) {
    for (const pluginRoot of discoverPluginRoots(root)) {
      const manifest = join(pluginRoot, '.codex-plugin', 'plugin.json');
      const defaultHooks = join(pluginRoot, 'hooks', 'hooks.json');
      if (existsSync(manifest) && !seen.has(manifest)) {
        seen.add(manifest);
        candidates.push({
          id: `plugin-manifest-${createHash('sha1').update(manifest).digest('hex').slice(0, 12)}`,
          kind: 'plugin',
          format: 'plugin-manifest',
          path: manifest,
        });
      }
      if (existsSync(defaultHooks) && !seen.has(defaultHooks)) {
        seen.add(defaultHooks);
        candidates.push({
          id: `plugin-hooks-${createHash('sha1').update(defaultHooks).digest('hex').slice(0, 12)}`,
          kind: 'plugin',
          format: 'hooks.json',
          path: defaultHooks,
        });
      }
    }
  }

  return candidates;
}

function discoverPluginRoots(root: string): string[] {
  const results: string[] = [];
  const queue: { path: string; depth: number }[] = [{ path: root, depth: 0 }];
  const seen = new Set<string>();
  const maxDepth = 5;
  const maxVisited = 250;

  while (queue.length > 0 && seen.size < maxVisited) {
    const item = queue.shift();
    if (!item || seen.has(item.path) || !existsSync(item.path)) continue;
    seen.add(item.path);
    let stat;
    try {
      stat = lstatSync(item.path);
    } catch {
      continue;
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) continue;

    if (
      existsSync(join(item.path, '.codex-plugin', 'plugin.json')) ||
      existsSync(join(item.path, 'hooks', 'hooks.json'))
    ) {
      results.push(item.path);
    }
    if (item.depth >= maxDepth) continue;

    let entries: string[];
    try {
      entries = readdirSync(item.path);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === '.git') continue;
      queue.push({ path: join(item.path, entry), depth: item.depth + 1 });
    }
  }

  return results;
}

async function inspectHookSource(
  candidate: Omit<CodexHookSourceReport, 'exists' | 'trusted' | 'issues' | 'sha256'>
): Promise<{ source: CodexHookSourceReport; hooks: CodexHookHandlerReport[] }> {
  if (!existsSync(candidate.path)) {
    return {
      source: {
        ...candidate,
        exists: false,
        trusted: candidate.kind === 'managed' ? 'managed' : 'not-applicable',
        issues: [],
      },
      hooks: [],
    };
  }

  let content: string;
  try {
    content = await readFile(candidate.path, 'utf8');
  } catch (error) {
    return {
      source: {
        ...candidate,
        exists: true,
        trusted: candidate.kind === 'managed' ? 'managed' : 'unknown',
        issues: [`failed to read hook source: ${(error as Error).message}`],
      },
      hooks: [],
    };
  }
  const source: CodexHookSourceReport = {
    ...candidate,
    exists: true,
    sha256: createHash('sha256').update(content).digest('hex'),
    trusted: candidate.kind === 'managed' ? 'managed' : 'unknown',
    ...hookFeatureSettingPatch(content),
    ...managedHookPolicyPatch(content),
    ...managedHookDirectoryPatch(content),
    issues: [],
  };

  try {
    if (candidate.format === 'plugin-manifest') {
      const parsed = await parsePluginManifestHooks(candidate.id, candidate.path, content);
      return { source: { ...source, issues: parsed.issues }, hooks: parsed.hooks };
    }
    const hooks =
      candidate.format === 'hooks.json'
        ? parseHooksJson(candidate.id, content)
        : parseHooksToml(candidate.id, content);
    return {
      source,
      hooks:
        candidate.kind === 'managed'
          ? annotateManagedHookAnchoring(hooks, source.managedDir, source.windowsManagedDir)
          : hooks,
    };
  } catch (error) {
    const err = error as Error;
    return {
      source: { ...source, issues: [`failed to parse hook source: ${err.message}`] },
      hooks: [],
    };
  }
}

async function parsePluginManifestHooks(
  sourceId: string,
  manifestPath: string,
  content: string
): Promise<{ hooks: CodexHookHandlerReport[]; issues: string[] }> {
  const manifest = JSON.parse(content) as { hooks?: unknown };
  const pluginRoot = dirname(dirname(manifestPath));
  const entries = normalizePluginHookEntries(manifest.hooks);
  const hooks: CodexHookHandlerReport[] = [];
  const issues: string[] = [];

  if (manifest.hooks === undefined) {
    return { hooks, issues };
  }

  issues.push(
    "plugin manifest field 'hooks' is unsupported by current Codex plugin manifests and will be skipped by Codex; use hooks/hooks.json or managed requirements.toml hooks instead"
  );

  if (entries.length === 0) {
    return { hooks, issues };
  }

  for (const entry of entries) {
    if (typeof entry === 'string') {
      if (!entry.startsWith('./')) {
        issues.push(`plugin hook path '${entry}' is not ./-prefixed`);
        continue;
      }
      const hookPath = resolve(pluginRoot, entry);
      const relativeToRoot = relative(pluginRoot, hookPath);
      if (
        relativeToRoot.startsWith('..') ||
        relativeToRoot === '..' ||
        isAbsolute(relativeToRoot)
      ) {
        issues.push(`plugin hook path '${entry}' resolves outside plugin root`);
        continue;
      }
      if (!existsSync(hookPath)) {
        issues.push(`plugin hook path '${entry}' does not exist`);
        continue;
      }
      if (lstatSync(hookPath).isSymbolicLink()) {
        issues.push(`plugin hook path '${entry}' is a symlink and was not read`);
        continue;
      }
      const realPluginRoot = realpathSync(pluginRoot);
      const realHookPath = realpathSync(hookPath);
      const realRelativeToRoot = relative(realPluginRoot, realHookPath);
      if (
        realRelativeToRoot.startsWith('..') ||
        realRelativeToRoot === '..' ||
        isAbsolute(realRelativeToRoot)
      ) {
        issues.push(`plugin hook path '${entry}' realpath resolves outside plugin root`);
        continue;
      }
      try {
        hooks.push(...parseHooksJson(sourceId, await readFile(hookPath, 'utf8')));
      } catch (error) {
        issues.push(`failed to parse plugin hook path '${entry}': ${(error as Error).message}`);
      }
      continue;
    }

    if (isRecord(entry)) {
      try {
        hooks.push(...parseHooksJson(sourceId, JSON.stringify(entry)));
      } catch (error) {
        issues.push(`failed to parse inline plugin hook object: ${(error as Error).message}`);
      }
      continue;
    }

    issues.push(`unsupported plugin hooks manifest entry type: ${typeof entry}`);
  }

  return {
    hooks: hooks.map(hook => ({
      ...hook,
      issues: [...hook.issues, 'plugin manifest hooks field is unsupported and skipped by Codex'],
    })),
    issues,
  };
}

function normalizePluginHookEntries(value: unknown): unknown[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function parseHooksJson(sourceId: string, content: string): CodexHookHandlerReport[] {
  const parsed = JSON.parse(content) as { hooks?: unknown };
  const root = isRecord(parsed.hooks) ? parsed.hooks : isRecord(parsed) ? parsed : {};
  const hooks: CodexHookHandlerReport[] = [];

  for (const [event, groups] of Object.entries(root)) {
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      if (!isRecord(group)) continue;
      const matcher = typeof group.matcher === 'string' ? group.matcher : undefined;
      const handlers = Array.isArray(group.hooks) ? group.hooks : [];
      for (const handler of handlers) {
        if (!isRecord(handler)) continue;
        hooks.push(buildHandlerReport(sourceId, event, matcher, handler));
      }
    }
  }

  return hooks;
}

function hookFeatureSettingPatch(
  content: string
): Pick<CodexHookSourceReport, 'hooksFeatureSetting'> {
  let inFeatures = false;
  for (const line of content.split(/\r?\n/)) {
    const section = /^\s*\[([A-Za-z_.-]+)\]\s*$/.exec(line);
    if (section) {
      inFeatures = section[1] === 'features';
      continue;
    }
    if (!inFeatures) continue;
    const canonical = /^\s*hooks\s*=\s*(true|false)\s*$/.exec(line);
    if (canonical) return { hooksFeatureSetting: canonical[1] === 'true' };
    const deprecated = /^\s*codex_hooks\s*=\s*(true|false)\s*$/.exec(line);
    if (deprecated) return { hooksFeatureSetting: deprecated[1] === 'true' };
  }
  return {};
}

function managedHookPolicyPatch(
  content: string
): Pick<CodexHookSourceReport, 'allowManagedHooksOnly'> {
  for (const line of content.split(/\r?\n/)) {
    const match = /^\s*allow_managed_hooks_only\s*=\s*(true|false)\s*$/.exec(line);
    if (match) return { allowManagedHooksOnly: match[1] === 'true' };
  }
  return {};
}

function managedHookDirectoryPatch(
  content: string
): Pick<CodexHookSourceReport, 'managedDir' | 'windowsManagedDir'> {
  let inHooks = false;
  const patch: Pick<CodexHookSourceReport, 'managedDir' | 'windowsManagedDir'> = {};
  for (const line of content.split(/\r?\n/)) {
    const section = /^\s*\[([A-Za-z_.-]+)\]\s*$/.exec(line);
    if (section) {
      inHooks = section[1] === 'hooks';
      continue;
    }
    if (!inHooks) continue;
    const assignment = /^\s*(managed_dir|windows_managed_dir)\s*=\s*(.+?)\s*$/.exec(line);
    if (!assignment) continue;
    const key = assignment[1];
    const value = parseTomlScalar(assignment[2] ?? '');
    if (typeof value !== 'string' || value.length === 0) continue;
    if (key === 'managed_dir') patch.managedDir = value;
    if (key === 'windows_managed_dir') patch.windowsManagedDir = value;
  }
  return patch;
}

function annotateManagedHookAnchoring(
  hooks: CodexHookHandlerReport[],
  managedDir: string | undefined,
  windowsManagedDir: string | undefined
): CodexHookHandlerReport[] {
  return hooks.map(hook => {
    if (hook.type !== 'command') return hook;
    const issues = [...hook.issues];
    if (!managedDir) {
      issues.push('managed hook command cannot be anchored because hooks.managed_dir is missing');
    } else if (!isAbsolute(managedDir)) {
      issues.push(
        `managed hook command cannot be anchored because hooks.managed_dir is not absolute (${managedDir})`
      );
    } else if (hook.command) {
      issues.push(...managedCommandAnchorIssues(hook.command, managedDir, 'managed hook command'));
    }
    if (hook.commandWindows) {
      if (!windowsManagedDir) {
        issues.push(
          'managed hook command_windows cannot be anchored because hooks.windows_managed_dir is missing'
        );
      } else if (!isAbsolute(windowsManagedDir)) {
        issues.push(
          `managed hook command_windows cannot be anchored because hooks.windows_managed_dir is not absolute (${windowsManagedDir})`
        );
      } else {
        issues.push(
          ...managedCommandAnchorIssues(
            hook.commandWindows,
            windowsManagedDir,
            'managed hook command_windows',
            'hooks.windows_managed_dir'
          )
        );
      }
    }
    return { ...hook, issues };
  });
}

function managedCommandAnchorIssues(
  command: string,
  directory: string,
  label: string,
  directoryLabel = 'hooks.managed_dir'
): string[] {
  const normalizedDir = normalizeComparablePath(directory);
  const candidates = splitCommandTokens(command)
    .map(token => normalizeComparablePath(token))
    .filter(token => token.length > 0 && pathTokenInsideDirectory(token, normalizedDir));
  if (candidates.length === 0) {
    return [`${label} is not anchored under ${directoryLabel} (${directory})`];
  }

  const issues: string[] = [];
  for (const candidate of candidates) {
    const candidatePath = resolve(candidate);
    if (!existsSync(candidatePath)) {
      issues.push(`${label} anchor path does not exist under ${directoryLabel}: ${candidate}`);
      continue;
    }
    const stat = lstatSync(candidatePath);
    if (stat.isSymbolicLink()) {
      issues.push(`${label} anchor path is a symlink and is not trusted: ${candidate}`);
    }
    const realDir = realpathSync(directory);
    const realCandidate = realpathSync(candidatePath);
    const relativeToDir = relative(realDir, realCandidate);
    if (relativeToDir.startsWith('..') || relativeToDir === '..' || isAbsolute(relativeToDir)) {
      issues.push(`${label} anchor path realpath resolves outside ${directoryLabel}: ${candidate}`);
    }
  }
  return issues;
}

function pathTokenInsideDirectory(token: string, normalizedDir: string): boolean {
  const cleaned = normalizeComparablePath(token);
  return cleaned === normalizedDir || cleaned.startsWith(`${normalizedDir}/`);
}

function normalizeComparablePath(value: string): string {
  return value
    .replace(/^["']|["']$/g, '')
    .replace(/\\/g, '/')
    .replace(/\/+$/g, '');
}

function splitCommandTokens(command: string): string[] {
  const tokens: string[] = [];
  const pattern = /"([^"]+)"|'([^']+)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(command)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3] ?? '');
  }
  return tokens;
}

function parseHooksToml(sourceId: string, content: string): CodexHookHandlerReport[] {
  const lines = content.split(/\r?\n/);
  const hooks: CodexHookHandlerReport[] = [];
  let currentEvent: string | undefined;
  let currentMatcher: string | undefined;
  let currentHandler: Record<string, unknown> | undefined;

  function flushHandler(): void {
    if (currentEvent && currentHandler) {
      hooks.push(buildHandlerReport(sourceId, currentEvent, currentMatcher, currentHandler));
    }
    currentHandler = undefined;
  }

  for (const line of lines) {
    const section = /^\s*\[\[hooks\.([A-Za-z]+)(?:\.hooks)?\]\]\s*$/.exec(line);
    if (section) {
      const event = section[1];
      if (!event) continue;
      const isHandler = line.includes('.hooks]]');
      if (!isHandler) {
        flushHandler();
        currentEvent = event;
        currentMatcher = undefined;
      } else {
        flushHandler();
        currentHandler = {};
      }
      continue;
    }

    const assignment = /^\s*([A-Za-z_]+)\s*=\s*(.+?)\s*$/.exec(line);
    if (!assignment) continue;
    const rawKey = assignment[1];
    const rawValue = assignment[2];
    if (!rawKey || rawValue === undefined) continue;
    const value = parseTomlScalar(rawValue);
    if (currentHandler) {
      currentHandler[rawKey] = value;
    } else if (rawKey === 'matcher' && typeof value === 'string') {
      currentMatcher = value;
    }
  }
  flushHandler();

  return hooks;
}

function parseTomlScalar(raw: string): unknown {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : trimmed;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(item => stableJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

function buildHandlerReport(
  sourceId: string,
  event: string,
  matcher: string | undefined,
  handler: Record<string, unknown>
): CodexHookHandlerReport {
  const type = typeof handler.type === 'string' ? handler.type : 'command';
  const command = typeof handler.command === 'string' ? handler.command : undefined;
  const commandWindows =
    typeof handler.commandWindows === 'string'
      ? handler.commandWindows
      : typeof handler.command_windows === 'string'
        ? handler.command_windows
        : undefined;
  const timeoutSeconds = typeof handler.timeout === 'number' ? handler.timeout : undefined;
  const isAsync = handler.async === true;
  const isDisabled = handler.enabled === false || handler.disabled === true;
  const riskFlags = hookRiskFlags(event);
  const issues: string[] = [];

  if (!CODEX_RUNTIME_HOOK_EVENTS.has(event)) issues.push(`unknown Codex hook event '${event}'`);
  if (type !== 'command')
    issues.push(`handler type '${type}' is parsed but not executable by Codex today`);
  if (isAsync) issues.push('async command hooks are parsed but skipped by Codex today');
  if (isDisabled) issues.push('hook handler is marked disabled and will be skipped');
  if (type === 'command' && !command) issues.push('command hook missing command');
  if (
    (riskFlags.includes('safety') || riskFlags.includes('privacy')) &&
    timeoutSeconds === undefined
  ) {
    issues.push('safety/privacy hook omits timeout; Codex default is 600 seconds');
  }
  if (
    (riskFlags.includes('safety') || riskFlags.includes('privacy')) &&
    timeoutSeconds !== undefined &&
    timeoutSeconds > MAX_SAFETY_PRIVACY_HOOK_TIMEOUT_SECONDS
  ) {
    issues.push(
      `safety/privacy hook timeout exceeds ${MAX_SAFETY_PRIVACY_HOOK_TIMEOUT_SECONDS} seconds`
    );
  }
  if (matcher && MATCHER_UNSUPPORTED_EVENTS.has(event)) {
    issues.push(`${event} matchers are ignored by Codex`);
  }
  if (command && looksLikeFragileRelativeRepoHook(command)) {
    issues.push('repo-local hook command appears relative; prefer git-root or absolute paths');
  }

  return {
    sourceId,
    event,
    ...(matcher ? { matcher } : {}),
    definitionSha256: createHash('sha256')
      .update(stableJson({ event, matcher: matcher ?? null, handler }))
      .digest('hex'),
    type,
    ...(command ? { command } : {}),
    ...(commandWindows ? { commandWindows } : {}),
    ...(timeoutSeconds !== undefined ? { timeoutSeconds } : {}),
    async: isAsync,
    riskFlags,
    issues,
  };
}

function findOverlappingHookGroups(
  hooks: readonly CodexHookHandlerReport[]
): CodexHookBootloaderReport['coverage']['overlappingHookGroups'] {
  const groups = new Map<string, CodexHookHandlerReport[]>();
  for (const hook of hooks) {
    const matcher = hook.matcher ?? '<all>';
    const key = `${hook.event}\u0000${matcher}`;
    groups.set(key, [...(groups.get(key) ?? []), hook]);
  }
  return [...groups.entries()]
    .map(([key, handlers]) => {
      const [event = 'unknown', matcher = '<all>'] = key.split('\u0000');
      return {
        event,
        matcher,
        handlers: handlers.map(
          handler => `${handler.sourceId}:${handler.definitionSha256.slice(0, 12)}`
        ),
        sensitive: handlers.some(
          handler => handler.riskFlags.includes('safety') || handler.riskFlags.includes('privacy')
        ),
      };
    })
    .filter(group => group.handlers.length > 1);
}

function hookRiskFlags(event: string): string[] {
  const flags: string[] = [];
  if (SAFETY_RELEVANT_EVENTS.has(event)) flags.push('safety');
  if (PRIVACY_RELEVANT_EVENTS.has(event)) flags.push('privacy');
  if (event === 'Stop' || event === 'SubagentStop') flags.push('continuation');
  return flags;
}

function looksLikeFragileRelativeRepoHook(command: string): boolean {
  const firstToken = command.trim().split(/\s+/)[0] ?? '';
  if (isAbsolute(firstToken)) return false;
  if (command.includes('$(git rev-parse --show-toplevel)')) return false;
  if (command.includes('$PLUGIN_ROOT') || command.includes('${PLUGIN_ROOT}')) return false;
  return command.includes('.codex/hooks/');
}

function inferHooksFeatureEnabled(sources: CodexHookSourceReport[]): boolean | 'unknown' {
  const existing = sources.filter(source => source.exists);
  if (existing.length === 0) return 'unknown';
  const explicit = [...existing].reverse().find(source => source.hooksFeatureSetting !== undefined);
  if (explicit) return explicit.hooksFeatureSetting ?? 'unknown';
  return true;
}

function inspectWorkflowNodeHooks(raw: unknown): CodexHookBootloaderReport['workflowNodeHooks'] {
  if (!raw || !isRecord(raw)) {
    return {
      present: false,
      supportedByArchonForCodex: false,
      safetyCritical: false,
      issues: [],
    };
  }

  const serialized = JSON.stringify(raw);
  const safetyCritical =
    /PermissionRequest|PreToolUse|Stop|permissionDecision|decision|continue|updatedInput|suppressOutput/.test(
      serialized
    );
  return {
    present: true,
    supportedByArchonForCodex: false,
    safetyCritical,
    issues: [
      safetyCritical
        ? 'Codex workflow-node hooks contain safety/control fields but Archon does not map YAML hooks into Codex runtime hooks.'
        : 'Codex workflow-node hooks are present but Archon does not map YAML hooks into Codex runtime hooks.',
    ],
  };
}

function isNoApprovalMode(approvalPolicy: string): boolean {
  return (
    approvalPolicy === 'never' ||
    approvalPolicy === 'dontAsk' ||
    approvalPolicy === 'bypassPermissions'
  );
}

function uniqueSortedMatchers(hooks: readonly CodexHookHandlerReport[]): string[] {
  return [...new Set(hooks.map(hook => hook.matcher ?? '<all>'))].sort();
}

function preToolUseFallbackCoversPermissionRequest(
  permissionRequestHook: CodexHookHandlerReport,
  preToolUseHooks: readonly CodexHookHandlerReport[]
): boolean {
  return preToolUseHooks.some(preToolUseHook => {
    if (preToolUseHook.matcher === undefined) return true;
    if (permissionRequestHook.matcher === undefined) return false;
    return preToolUseHook.matcher === permissionRequestHook.matcher;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function writeHookBootloaderArtifacts(report: CodexHookBootloaderReport): Promise<void> {
  ensureScopedArtifactDirectory(report.artifactPaths.directory, report.artifactPaths.directory);
  ensureScopedWritableFilePath(report.artifactPaths.directory, report.artifactPaths.artifactPolicy);
  await writeFile(
    report.artifactPaths.artifactPolicy,
    `${JSON.stringify(report.artifactPolicy, null, 2)}\n`,
    'utf8'
  );
  ensureScopedWritableFilePath(report.artifactPaths.directory, report.artifactPaths.report);
  await writeFile(report.artifactPaths.report, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  ensureScopedWritableFilePath(report.artifactPaths.directory, report.artifactPaths.contract);
  await writeFile(
    report.artifactPaths.contract,
    `${JSON.stringify(report.hookContract, null, 2)}\n`,
    'utf8'
  );
  ensureScopedWritableFilePath(
    report.artifactPaths.directory,
    report.artifactPaths.contractEvidence
  );
  await writeFile(
    report.artifactPaths.contractEvidence,
    renderContractEvidenceMarkdown(report),
    'utf8'
  );
  ensureScopedWritableFilePath(report.artifactPaths.directory, report.artifactPaths.inventory);
  await writeFile(
    report.artifactPaths.inventory,
    `${JSON.stringify(
      {
        kind: 'codex-hooks-inventory',
        schemaVersion: 'archon.codex-hooks.inventory.v1',
        generatedAt: report.generatedAt,
        providerHookCapabilities: report.providerHookCapabilities,
        sources: report.sources,
        hooks: report.hooks,
        enforcement: {
          allowManagedHooksOnly: report.coverage.allowManagedHooksOnly,
          inventoriedHookHandlers: report.coverage.inventoriedHookHandlers,
          enforcedHookHandlers: report.coverage.enforcedHookHandlers,
          excludedHookHandlers: report.coverage.excludedHookHandlers,
          excludedSensitiveHookHandlers: report.coverage.excludedSensitiveHookHandlers,
          excludedContinuationHookHandlers: report.coverage.excludedContinuationHookHandlers,
          excludedPermissionRequestHookHandlers:
            report.coverage.excludedPermissionRequestHookHandlers,
          unsupportedSensitiveHookHandlers: report.coverage.unsupportedSensitiveHookHandlers,
          disabledSensitiveHookHandlers: report.coverage.disabledSensitiveHookHandlers,
          overlongSensitiveHookHandlers: report.coverage.overlongSensitiveHookHandlers,
          matcherIgnoredSensitiveHookHandlers: report.coverage.matcherIgnoredSensitiveHookHandlers,
          fragileRelativeSensitiveHookHandlers:
            report.coverage.fragileRelativeSensitiveHookHandlers,
          overlappingHookGroups: report.coverage.overlappingHookGroups,
          permissionRequestFallbackCoverage: report.permissionRequest.preToolUseFallbackCoverage,
          unknownProjectHookSources: report.trust.unknownProjectHookSources,
          unknownPluginHookSources: report.trust.unknownPluginHookSources,
          unknownNonManagedHookSources: report.trust.unknownNonManagedHookSources,
        },
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  ensureScopedWritableFilePath(report.artifactPaths.directory, report.artifactPaths.coverage);
  await writeFile(report.artifactPaths.coverage, renderCoverageMarkdown(report), 'utf8');
  ensureScopedWritableFilePath(report.artifactPaths.directory, report.artifactPaths.trust);
  await writeFile(report.artifactPaths.trust, renderTrustMarkdown(report), 'utf8');
  ensureScopedWritableFilePath(report.artifactPaths.directory, report.artifactPaths.trustStatus);
  await writeFile(
    report.artifactPaths.trustStatus,
    `${JSON.stringify(renderTrustStatusJson(report), null, 2)}\n`,
    'utf8'
  );
  ensureScopedWritableFilePath(
    report.artifactPaths.directory,
    report.artifactPaths.stopContinuation
  );
  await writeFile(
    report.artifactPaths.stopContinuation,
    renderStopContinuationMarkdown(report),
    'utf8'
  );
  ensureScopedWritableFilePath(
    report.artifactPaths.directory,
    report.artifactPaths.stopContinuationPolicy
  );
  await writeFile(
    report.artifactPaths.stopContinuationPolicy,
    `${JSON.stringify(renderStopContinuationPolicyJson(report), null, 2)}\n`,
    'utf8'
  );
  ensureScopedWritableFilePath(
    report.artifactPaths.directory,
    report.artifactPaths.permissionRequest
  );
  await writeFile(
    report.artifactPaths.permissionRequest,
    renderPermissionRequestMarkdown(report),
    'utf8'
  );
  ensureScopedWritableFilePath(
    report.artifactPaths.directory,
    report.artifactPaths.permissionRequestPolicy
  );
  await writeFile(
    report.artifactPaths.permissionRequestPolicy,
    `${JSON.stringify(renderPermissionRequestPolicyJson(report), null, 2)}\n`,
    'utf8'
  );
  ensureScopedWritableFilePath(
    report.artifactPaths.directory,
    report.artifactPaths.badBehaviourLint
  );
  await writeFile(
    report.artifactPaths.badBehaviourLint,
    `${JSON.stringify(renderCodexHookBadBehaviourLint(report), null, 2)}\n`,
    'utf8'
  );
  ensureScopedWritableFilePath(report.artifactPaths.directory, report.artifactPaths.manifest);
  await writeFile(
    report.artifactPaths.manifest,
    `${JSON.stringify(renderHookArtifactsManifest(report), null, 2)}\n`,
    'utf8'
  );
}

function renderHookArtifactsManifest(report: CodexHookBootloaderReport): Record<string, unknown> {
  const artifactEntries = [
    ['bootloaderReport', report.artifactPaths.report],
    ['inventory', report.artifactPaths.inventory],
    ['coverage', report.artifactPaths.coverage],
    ['trust', report.artifactPaths.trust],
    ['trustStatus', report.artifactPaths.trustStatus],
    ['artifactPolicy', report.artifactPaths.artifactPolicy],
    ['stopContinuation', report.artifactPaths.stopContinuation],
    ['stopContinuationPolicy', report.artifactPaths.stopContinuationPolicy],
    ['contract', report.artifactPaths.contract],
    ['contractEvidence', report.artifactPaths.contractEvidence],
    ['permissionRequest', report.artifactPaths.permissionRequest],
    ['permissionRequestPolicy', report.artifactPaths.permissionRequestPolicy],
    ['badBehaviourLint', report.artifactPaths.badBehaviourLint],
  ] as const;

  return {
    kind: 'codex-hook-artifacts-manifest',
    schemaVersion: 'archon.codex-hooks.artifacts-manifest.v1',
    generatedAt: report.generatedAt,
    providerHookCapabilities: report.providerHookCapabilities,
    decision: report.decision,
    contractCompatibility: {
      installedRuntimeContractStatus: report.hookContract.installedRuntimeContractStatus,
      installedRuntimeContractIssue: report.hookContract.installedRuntimeContractIssue ?? null,
      installedRuntimeContractCompatible: report.hookContract.installedRuntimeContractCompatible,
      installedHookEventCompatibility: report.hookContract.installedHookEventCompatibility,
      installedHookEventNames: report.hookContract.installedHookEventNames,
      installedHookEventCompatibilityIssues:
        report.hookContract.installedHookEventCompatibilityIssues,
    },
    artifactPolicy: report.artifactPolicy,
    artifactRoot: report.artifactPaths.directory,
    badBehaviourLintSummary: renderCodexHookBadBehaviourLint(report).summary,
    requiredArtifacts: {
      ...Object.fromEntries(
        artifactEntries.map(([name, path]) => [name, hookArtifactFileEntry(report, path)])
      ),
      manifest: hookArtifactManifestSelfReference(report),
    },
    files: [
      ...artifactEntries.map(([, path]) => hookArtifactFileEntry(report, path)),
      hookArtifactManifestSelfReference(report),
    ],
  };
}

function renderTrustStatusJson(report: CodexHookBootloaderReport): Record<string, unknown> {
  return {
    kind: 'codex-hook-trust-status',
    schemaVersion: 'archon.codex-hooks.trust-status.v1',
    generatedAt: report.generatedAt,
    decision: report.decision,
    providerHookCapabilities: report.providerHookCapabilities,
    trust: report.trust,
    coverage: {
      allowManagedHooksOnly: report.coverage.allowManagedHooksOnly,
      inventoriedHookHandlers: report.coverage.inventoriedHookHandlers,
      enforcedHookHandlers: report.coverage.enforcedHookHandlers,
      excludedHookHandlers: report.coverage.excludedHookHandlers,
      excludedSensitiveHookHandlers: report.coverage.excludedSensitiveHookHandlers,
      excludedContinuationHookHandlers: report.coverage.excludedContinuationHookHandlers,
      excludedPermissionRequestHookHandlers: report.coverage.excludedPermissionRequestHookHandlers,
      unsupportedSensitiveHookHandlers: report.coverage.unsupportedSensitiveHookHandlers,
      disabledSensitiveHookHandlers: report.coverage.disabledSensitiveHookHandlers,
      overlongSensitiveHookHandlers: report.coverage.overlongSensitiveHookHandlers,
      matcherIgnoredSensitiveHookHandlers: report.coverage.matcherIgnoredSensitiveHookHandlers,
      fragileRelativeSensitiveHookHandlers: report.coverage.fragileRelativeSensitiveHookHandlers,
      overlappingHookGroups: report.coverage.overlappingHookGroups,
      permissionRequestFallbackCoverage: report.permissionRequest.preToolUseFallbackCoverage,
    },
    reasons: report.reasons,
    warnings: report.warnings,
  };
}

function renderStopContinuationPolicyJson(
  report: CodexHookBootloaderReport
): Record<string, unknown> {
  return {
    kind: 'codex-stop-continuation-policy',
    schemaVersion: 'archon.codex-hooks.stop-continuation-policy.v1',
    generatedAt: report.generatedAt,
    decision: report.decision,
    providerHookCapabilities: report.providerHookCapabilities,
    continuation: report.continuation,
    matcherUnsupportedEvents: report.coverage.matcherUnsupportedEvents,
    reasons: report.reasons.filter(reason => /Stop|SubagentStop|continuation/.test(reason)),
    bounded: report.continuation.bounded,
  };
}

function renderPermissionRequestPolicyJson(
  report: CodexHookBootloaderReport
): Record<string, unknown> {
  return {
    kind: 'codex-permission-request-policy',
    schemaVersion: 'archon.codex-hooks.permission-request-policy.v1',
    generatedAt: report.generatedAt,
    decision: report.decision,
    providerHookCapabilities: report.providerHookCapabilities,
    approvalPolicy: report.approvalPolicy,
    permissionRequest: report.permissionRequest,
    reasons: report.reasons.filter(reason =>
      /PermissionRequest|approval policy|approval prompts/.test(reason)
    ),
    bounded: report.permissionRequest.bounded,
  };
}

type CodexHookBadBehaviourClassification = 'intentional' | 'warning-only' | 'bug';

interface CodexHookBadBehaviourFinding {
  pattern: string;
  classification: CodexHookBadBehaviourClassification;
  rationale: string;
  evidence?: Record<string, unknown>;
}

function summarizeCodexHookBadBehaviourFindings(
  findings: readonly CodexHookBadBehaviourFinding[]
): Record<string, unknown> {
  const byClassification: Record<CodexHookBadBehaviourClassification, number> = {
    intentional: 0,
    'warning-only': 0,
    bug: 0,
  };
  const byPattern: Record<string, number> = {};
  for (const finding of findings) {
    byClassification[finding.classification] += 1;
    byPattern[finding.pattern] = (byPattern[finding.pattern] ?? 0) + 1;
  }
  return {
    total: findings.length,
    byClassification,
    byPattern,
    findings,
  };
}

function renderCodexHookBadBehaviourLint(
  report: CodexHookBootloaderReport
): Record<string, unknown> {
  const findings: CodexHookBadBehaviourFinding[] = [];

  if (report.workflowNodeHooks.present) {
    findings.push({
      pattern: 'ignored_control',
      classification: 'bug',
      rationale:
        'Workflow YAML hooks reached the Codex provider, but Archon does not map workflow-node hooks into Codex runtime hooks.',
      evidence: { workflowNodeHooks: report.workflowNodeHooks },
    });
  }

  if (report.hookContract.installedRuntimeEvidence.installedHookEventCompatibility === 'mismatch') {
    findings.push({
      pattern: 'unsupported_control',
      classification: 'bug',
      rationale:
        'Installed Codex hook event names differ from Archon embedded contract knowledge; runtime hook enforcement must fail closed until compatibility is verified.',
      evidence: {
        installedHookEventNames:
          report.hookContract.installedRuntimeEvidence.installedHookEventNames,
        installedHookEventCompatibilityIssues:
          report.hookContract.installedRuntimeEvidence.installedHookEventCompatibilityIssues,
      },
    });
  }

  if (report.coverage.unsupportedSensitiveHookHandlers > 0) {
    findings.push({
      pattern: 'unsupported_control',
      classification: 'bug',
      rationale:
        'Safety/privacy hook handlers are unsupported, skipped, missing command metadata, or outside trusted managed hook paths.',
      evidence: {
        unsupportedSensitiveHookHandlers: report.coverage.unsupportedSensitiveHookHandlers,
      },
    });
  }

  if (
    report.coverage.disabledSensitiveHookHandlers > 0 ||
    report.coverage.matcherIgnoredSensitiveHookHandlers > 0 ||
    report.coverage.fragileRelativeSensitiveHookHandlers > 0
  ) {
    findings.push({
      pattern: 'ignored_control',
      classification: 'bug',
      rationale:
        'Safety/privacy hooks are disabled, matcher-ignored, or fragile relative commands; these controls must not appear enforced.',
      evidence: {
        disabledSensitiveHookHandlers: report.coverage.disabledSensitiveHookHandlers,
        matcherIgnoredSensitiveHookHandlers: report.coverage.matcherIgnoredSensitiveHookHandlers,
        fragileRelativeSensitiveHookHandlers: report.coverage.fragileRelativeSensitiveHookHandlers,
      },
    });
  }

  if (
    report.coverage.overlongSensitiveHookHandlers > 0 ||
    report.permissionRequest.timeoutlessPermissionRequestHooks > 0 ||
    report.permissionRequest.overlongPermissionRequestHooks > 0 ||
    report.continuation.timeoutlessContinuationHooks > 0 ||
    report.continuation.issues.some(issue => /exceed|timeout/i.test(issue))
  ) {
    findings.push({
      pattern: 'unsupported_control',
      classification: 'bug',
      rationale:
        'Safety/privacy, PermissionRequest, or continuation hooks are timeoutless or exceed the bounded preflight policy; unbounded hook controls must not be treated as enforced.',
      evidence: {
        overlongSensitiveHookHandlers: report.coverage.overlongSensitiveHookHandlers,
        timeoutlessPermissionRequestHooks:
          report.permissionRequest.timeoutlessPermissionRequestHooks,
        overlongPermissionRequestHooks: report.permissionRequest.overlongPermissionRequestHooks,
        timeoutlessContinuationHooks: report.continuation.timeoutlessContinuationHooks,
        continuationIssues: report.continuation.issues,
      },
    });
  }

  if (
    report.permissionRequest.permissionOnlyNoApprovalGap ||
    report.permissionRequest.preToolUseFallbackCoverage.uncoveredMatchers.length > 0
  ) {
    findings.push({
      pattern: 'fail_open_behavior',
      classification: 'bug',
      rationale:
        'PermissionRequest hooks may be bypassed when Codex approval prompts are disabled without bounded PreToolUse fallback coverage.',
      evidence: {
        permissionOnlyNoApprovalGap: report.permissionRequest.permissionOnlyNoApprovalGap,
        preToolUseFallbackCoverage: report.permissionRequest.preToolUseFallbackCoverage,
      },
    });
  }

  if (!report.providerHookCapabilities.hookEventStreaming) {
    findings.push({
      pattern: 'best_effort_surface',
      classification: 'warning-only',
      rationale:
        'Codex hook lifecycle/event streaming is not available through Archon; runtime hook observability relies on preflight artifacts and provider stream summaries.',
      evidence: { hookEventStreaming: false },
    });
  }

  if (report.hookContract.parsedButSkippedHandlerFeatures.length > 0) {
    findings.push({
      pattern: 'deferred_behavior',
      classification: 'warning-only',
      rationale:
        'The verified Codex hook contract includes handler features that Archon parses but does not enforce as runtime hooks; the preflight surfaces them as deferred/unsupported contract surface.',
      evidence: {
        parsedButSkippedHandlerFeatures: report.hookContract.parsedButSkippedHandlerFeatures,
      },
    });
  }

  if (
    Object.values(report.hookContract.knownFailOpenOrUnsupportedFields).some(
      fields => fields.length > 0
    )
  ) {
    findings.push({
      pattern: 'unsupported_ignored',
      classification: 'warning-only',
      rationale:
        'The verified Codex hook contract records known fail-open or unsupported fields; the lint artifact surfaces them so operators do not infer those fields are enforced.',
      evidence: {
        knownFailOpenOrUnsupportedFields: report.hookContract.knownFailOpenOrUnsupportedFields,
      },
    });
  }

  if (
    report.warnings.some(warning =>
      /inventory is unknown or empty|unobservable trust state/.test(warning)
    )
  ) {
    findings.push({
      pattern: 'unsupported_ignored',
      classification: 'warning-only',
      rationale:
        'Hook inventory or trust state is incomplete; the preflight surfaces the gap instead of silently implying full enforcement.',
      evidence: { warnings: report.warnings },
    });
  }

  if (
    report.warnings.some(warning =>
      warning.includes('Codex hook inventory is unknown or empty; workflow does not declare hooks')
    )
  ) {
    findings.push({
      pattern: 'missing_control',
      classification: 'warning-only',
      rationale:
        'No runtime hook inventory was found, but the workflow did not declare hook-dependent controls; the preflight warns instead of blocking.',
      evidence: {
        inventoriedHookHandlers: report.coverage.inventoriedHookHandlers,
        enforcedHookHandlers: report.coverage.enforcedHookHandlers,
        workflowNodeHooks: report.workflowNodeHooks,
      },
    });
  }

  if (report.decision === 'block') {
    findings.push({
      pattern: 'fail_closed_enforcement',
      classification: 'intentional',
      rationale:
        'The Codex hook bootloader blocked the run because safety/privacy hook enforcement was incomplete or unsafe.',
      evidence: { reasons: report.reasons },
    });
  }

  return {
    kind: 'codex-hook-bad-behaviour-lint',
    schemaVersion: 'archon.codex-hooks.bad-behaviour-lint.v1',
    generatedAt: report.generatedAt,
    decision: report.decision,
    summary: summarizeCodexHookBadBehaviourFindings(findings),
  };
}

function hookArtifactManifestSelfReference(report: CodexHookBootloaderReport): {
  path: string;
  relativePath: string;
  role: 'manifest-self-reference';
  digestStatus: string;
} {
  return {
    path: report.artifactPaths.manifest,
    relativePath: relative(report.artifactPaths.directory, report.artifactPaths.manifest),
    role: 'manifest-self-reference',
    digestStatus:
      'self-referential manifest digest is not recorded inside the Codex hook artifacts manifest; compute an external checksum after write when needed',
  };
}

function hookArtifactFileEntry(
  report: CodexHookBootloaderReport,
  path: string
): {
  path: string;
  relativePath: string;
  bytes: number;
  sha256: string;
} {
  const content = readFileSync(path);
  return {
    path,
    relativePath: relative(report.artifactPaths.directory, path),
    bytes: content.byteLength,
    sha256: createHash('sha256').update(content).digest('hex'),
  };
}

function renderContractEvidenceMarkdown(report: CodexHookBootloaderReport): string {
  const evidence = report.hookContract.installedRuntimeEvidence;
  return `# Codex Hook Contract Evidence

Generated: ${report.generatedAt}

## Context7 evidence

- Library ID: ${report.hookContract.context7LibraryId}
- Library command: \`${report.hookContract.context7LibraryCommand}\`
- Docs command: \`${report.hookContract.context7DocsCommand}\`
- Source URL: ${report.hookContract.sourceUrl}

${report.hookContract.context7EvidenceSummary.map(item => `- ${item}`).join('\n')}

## Installed runtime evidence

- Contract evidence status: ${report.hookContract.installedRuntimeContractStatus}
- Contract evidence issue: ${report.hookContract.installedRuntimeContractIssue ?? 'none'}
- Binary version command: ${evidence.binaryVersionCommand ?? 'unavailable'}
- Binary version: ${evidence.binaryVersion ?? 'unknown'}
- Package schema candidates: ${evidence.packageSchemaCandidates}
- Package schemas found: ${evidence.packageSchemasFound ? 'yes' : 'no'}
- Package schema files fingerprinted: ${evidence.packageSchemaFilesFound}
- Installed hook event compatibility: ${evidence.installedHookEventCompatibility}
- Installed hook event names: ${
    evidence.installedHookEventNames.length > 0
      ? evidence.installedHookEventNames.join(', ')
      : 'unavailable'
  }
- Installed hook event compatibility issues: ${
    evidence.installedHookEventCompatibilityIssues.length > 0
      ? evidence.installedHookEventCompatibilityIssues.join('; ')
      : 'none'
  }
- Package schema fingerprints:
${evidence.packageSchemaFingerprints.length > 0 ? evidence.packageSchemaFingerprints.map(item => `  - ${item}`).join('\n') : '  - none'}
- Package resolution issues: ${
    evidence.packageResolutionIssues.length > 0
      ? evidence.packageResolutionIssues.join('; ')
      : 'none'
  }

## Contract captured by Archon

- Supported events: ${report.hookContract.supportedEvents.join(', ')}
- Matcher ignored events: ${report.hookContract.matcherIgnoredEvents.join(', ')}
- Default command hook timeout: ${report.hookContract.defaultCommandHookTimeoutSeconds}s
- Executable handler types: ${report.hookContract.executableHandlerTypes.join(', ')}
- Parsed but skipped handler features: ${report.hookContract.parsedButSkippedHandlerFeatures.join(', ')}
- Supported hook sources: ${report.hookContract.supportedSources.join('; ')}

## Archon provider hook capability context

- Workflow-node YAML hooks: ${report.providerHookCapabilities.workflowNodeHooks}
- Runtime/config hooks: ${report.providerHookCapabilities.runtimeConfigHooks}
- Hook inventory observable: ${report.providerHookCapabilities.hookInventoryObservable ? 'yes' : 'no'}
- Hook trust observable: ${report.providerHookCapabilities.hookTrustObservable ? 'yes' : 'no'}
- Hook event streaming: ${report.providerHookCapabilities.hookEventStreaming ? 'yes' : 'no'}

The installed Codex hook contract describes provider-native runtime hooks. It does not make Archon workflow YAML hooks enforceable when provider capabilities report workflow-node hooks as unsupported.

## Known fail-open or unsupported fields

${Object.entries(report.hookContract.knownFailOpenOrUnsupportedFields)
  .map(([event, fields]) => `- ${event}: ${fields.join(', ')}`)
  .join('\n')}

## Coverage limits

${report.hookContract.coverageLimits.map(limit => `- ${limit}`).join('\n')}
`;
}

function renderCoverageMarkdown(report: CodexHookBootloaderReport): string {
  return `# Codex Hook Coverage

Decision: ${report.decision}

## Installed runtime evidence

- Codex SDK package: ${renderPackageEvidence(report.codexRuntime.sdkPackage)}
- Codex CLI package: ${renderPackageEvidence(report.codexRuntime.cliPackage)}
- Codex binary package: ${renderPackageEvidence(report.codexRuntime.binaryPackage)}
- Configured binary path: ${report.codexRuntime.configuredBinaryPath ?? 'n/a'}
- CODEX_BIN_PATH: ${report.codexRuntime.envBinaryPath ?? 'n/a'}
- Resolved binary path: ${report.codexRuntime.resolvedBinaryPath ?? 'not resolved'}
- Binary version: ${report.codexRuntime.binaryVersion ?? 'not resolved'}
- Hook schema candidates:
${
  report.codexRuntime.schemaCandidates.length > 0
    ? report.codexRuntime.schemaCandidates
        .map(candidate => {
          const files = candidate.files?.length
            ? ` (${candidate.files.length} file fingerprint${candidate.files.length === 1 ? '' : 's'})`
            : '';
          const issues = candidate.issues?.length ? ` issues=${candidate.issues.join('; ')}` : '';
          return `  - ${candidate.exists ? 'found' : 'missing'}: ${candidate.path}${files}${issues}`;
        })
        .join('\n')
    : '  - none'
}

## Hook contract source

- Source: ${report.hookContract.sourceUrl}
- Artifact policy: ${report.artifactPaths.artifactPolicy}
- Context7 library: ${report.hookContract.context7LibraryId}
- Installed runtime version: ${report.hookContract.installedRuntimeVersion ?? 'unknown'}
- Installed runtime contract status: ${report.hookContract.installedRuntimeContractStatus}
- Installed runtime contract issue: ${report.hookContract.installedRuntimeContractIssue ?? 'none'}
- Default command hook timeout: ${report.hookContract.defaultCommandHookTimeoutSeconds}s
- Executable handler types: ${report.hookContract.executableHandlerTypes.join(', ')}
- Parsed but skipped handler features: ${report.hookContract.parsedButSkippedHandlerFeatures.join(', ')}

## Provider hook capabilities

- Workflow-node YAML hooks: ${report.providerHookCapabilities.workflowNodeHooks}
- Runtime/config hooks: ${report.providerHookCapabilities.runtimeConfigHooks}
- Hook inventory observable: ${report.providerHookCapabilities.hookInventoryObservable ? 'yes' : 'no'}
- Hook trust observable: ${report.providerHookCapabilities.hookTrustObservable ? 'yes' : 'no'}
- Hook event streaming: ${report.providerHookCapabilities.hookEventStreaming ? 'yes' : 'no'}

## Coverage limits

- Inventoried hook handlers: ${report.coverage.inventoriedHookHandlers}
- Enforced hook handlers: ${report.coverage.enforcedHookHandlers}
- Excluded hook handlers: ${report.coverage.excludedHookHandlers}
- Excluded safety/privacy hook handlers: ${report.coverage.excludedSensitiveHookHandlers}
- Excluded Stop/SubagentStop continuation hook handlers: ${report.coverage.excludedContinuationHookHandlers}
- Excluded PermissionRequest hook handlers: ${report.coverage.excludedPermissionRequestHookHandlers}
- Unsupported/skipped safety/privacy hook handlers: ${report.coverage.unsupportedSensitiveHookHandlers}
- Disabled safety/privacy hook handlers: ${report.coverage.disabledSensitiveHookHandlers}
- Overlong safety/privacy hook handlers: ${report.coverage.overlongSensitiveHookHandlers}
- Matcher-ignored safety/privacy hook handlers: ${report.coverage.matcherIgnoredSensitiveHookHandlers}
- Fragile relative safety/privacy hook commands: ${report.coverage.fragileRelativeSensitiveHookHandlers}
- Overlapping hook event/matcher groups: ${report.coverage.overlappingHookGroups.length}
- Overlapping safety/privacy hook event/matcher groups: ${report.coverage.overlappingHookGroups.filter(group => group.sensitive).length}
- Managed-only policy active: ${report.coverage.allowManagedHooksOnly ? 'yes' : 'no'}
- PreToolUse is not treated as a complete enforcement boundary.
- PermissionRequest is not assumed to run when approval prompts are disabled.
- Required PermissionRequest fallback matchers: ${report.permissionRequest.preToolUseFallbackCoverage.requiredMatchers.join(', ') || 'none'}
- Covered PermissionRequest fallback matchers: ${report.permissionRequest.preToolUseFallbackCoverage.coveredMatchers.join(', ') || 'none'}
- Uncovered PermissionRequest fallback matchers: ${report.permissionRequest.preToolUseFallbackCoverage.uncoveredMatchers.join(', ') || 'none'}
- Matchers are ignored for: ${report.coverage.matcherUnsupportedEvents.join(', ')}.

## Overlapping hook groups

${
  report.coverage.overlappingHookGroups.length > 0
    ? report.coverage.overlappingHookGroups
        .map(
          group =>
            `- ${group.event} matcher=${group.matcher} sensitive=${group.sensitive ? 'yes' : 'no'} handlers=${group.handlers.join(', ')}`
        )
        .join('\n')
    : '- None'
}

## Unintercepted or uncertain tool paths

${report.coverage.uninterceptedToolPaths.map(item => `- ${item}`).join('\n')}

## Reasons

${report.reasons.length > 0 ? report.reasons.map(item => `- ${item}`).join('\n') : '- None'}

## Warnings

${report.warnings.length > 0 ? report.warnings.map(item => `- ${item}`).join('\n') : '- None'}
`;
}

function renderPackageEvidence(pkg: CodexPackageEvidence | undefined): string {
  if (pkg === undefined) return 'not resolved';
  const version = pkg.version ?? 'unknown version';
  const path = pkg.packageJsonPath ?? 'unknown package.json';
  return `${pkg.name}@${version} (${path})`;
}

function renderTrustMarkdown(report: CodexHookBootloaderReport): string {
  return `# Codex Hook Trust Status

Trust status: ${report.trust.status}

## Provider hook capabilities

- Workflow-node YAML hooks: ${report.providerHookCapabilities.workflowNodeHooks}
- Runtime/config hooks: ${report.providerHookCapabilities.runtimeConfigHooks}
- Hook inventory observable: ${report.providerHookCapabilities.hookInventoryObservable ? 'yes' : 'no'}
- Hook trust observable: ${report.providerHookCapabilities.hookTrustObservable ? 'yes' : 'no'}
- Hook event streaming: ${report.providerHookCapabilities.hookEventStreaming ? 'yes' : 'no'}

Archon can inspect visible hook config files, but it cannot yet observe Codex's persisted non-managed hook trust hashes.

## Source-level trust uncertainty

- Unknown project-local hook sources: ${report.trust.unknownProjectHookSources}
- Unknown plugin hook sources: ${report.trust.unknownPluginHookSources}
- Unknown non-managed hook sources: ${report.trust.unknownNonManagedHookSources}

## Trust issues

${report.trust.issues.length > 0 ? report.trust.issues.map(item => `- ${item}`).join('\n') : '- None'}

## Existing hook sources

${
  report.sources
    .filter(source => source.exists)
    .map(source => `- ${source.id}: ${source.path} (${source.trusted})`)
    .join('\n') || '- None found'
}
`;
}

function renderStopContinuationMarkdown(report: CodexHookBootloaderReport): string {
  const continuationHooks = report.hooks.filter(hook => hook.riskFlags.includes('continuation'));
  return `# Codex Stop Continuation Policy

Decision: ${report.decision}

## Bound

- Workflow-node YAML hooks: ${report.providerHookCapabilities.workflowNodeHooks}
- Runtime/config hooks: ${report.providerHookCapabilities.runtimeConfigHooks}
- Hook inventory observable: ${report.providerHookCapabilities.hookInventoryObservable ? 'yes' : 'no'}
- Hook trust observable: ${report.providerHookCapabilities.hookTrustObservable ? 'yes' : 'no'}
- Hook event streaming: ${report.providerHookCapabilities.hookEventStreaming ? 'yes' : 'no'}
- Stop/SubagentStop hook handlers observed: ${report.continuation.stopContinuationHooks}
- Timeoutless continuation hook handlers: ${report.continuation.timeoutlessContinuationHooks}
- Matcher-ignored continuation hook handlers: ${report.continuation.matcherIgnoredContinuationHooks}
- Max allowed continuation hook timeout: ${report.continuation.maxAllowedTimeoutSeconds}s
- Max observed continuation hook timeout: ${report.continuation.maxObservedTimeoutSeconds ?? 'n/a'}
- Bounded by Archon preflight: ${report.continuation.bounded ? 'yes' : 'no'}

Archon cannot observe Codex Stop-hook continuation prompts after launch. Therefore, this preflight fails closed when Stop/SubagentStop continuation hooks omit explicit timeout metadata, exceed the configured bound, or rely on matcher filters that Codex ignores for continuation events.

## Continuation hooks

${
  continuationHooks.length > 0
    ? continuationHooks
        .map(
          hook =>
            `- ${hook.event} from ${hook.sourceId}: timeout=${hook.timeoutSeconds ?? 'missing'}, matcher=${hook.matcher ?? 'n/a'}, command=${hook.command ?? 'missing'}`
        )
        .join('\n')
    : '- None found'
}

## Issues

${report.continuation.issues.length > 0 ? report.continuation.issues.map(item => `- ${item}`).join('\n') : '- None'}
`;
}

function renderPermissionRequestMarkdown(report: CodexHookBootloaderReport): string {
  const permissionRequestHooks = report.hooks.filter(hook => hook.event === 'PermissionRequest');
  const preToolUseHooks = report.hooks.filter(hook => hook.event === 'PreToolUse');

  return `# Codex PermissionRequest Policy

Decision: ${report.decision}

## Bound

- Workflow-node YAML hooks: ${report.providerHookCapabilities.workflowNodeHooks}
- Runtime/config hooks: ${report.providerHookCapabilities.runtimeConfigHooks}
- Hook inventory observable: ${report.providerHookCapabilities.hookInventoryObservable ? 'yes' : 'no'}
- Hook trust observable: ${report.providerHookCapabilities.hookTrustObservable ? 'yes' : 'no'}
- Hook event streaming: ${report.providerHookCapabilities.hookEventStreaming ? 'yes' : 'no'}
- Approval policy: ${report.approvalPolicy}
- No-approval mode: ${report.permissionRequest.noApprovalMode ? 'yes' : 'no'}
- PermissionRequest hook handlers observed: ${report.permissionRequest.permissionRequestHooks}
- PreToolUse hook handlers observed: ${report.permissionRequest.preToolUseHooks}
- PreToolUse fallback bounded: ${report.permissionRequest.preToolUseFallbackBounded ? 'yes' : 'no'}
- Auto-approval decisions observable by Archon: ${report.permissionRequest.autoApprovalObservable ? 'yes' : 'no'}
- Auto-approval policy mode: ${report.permissionRequest.autoApprovalPolicy.mode}
- Auto-approval bounded by: ${report.permissionRequest.autoApprovalPolicy.boundedBy}
- Auto-approval policy issue: ${report.permissionRequest.autoApprovalPolicy.issue ?? 'n/a'}
- PermissionRequest-only no-approval gap: ${report.permissionRequest.permissionOnlyNoApprovalGap ? 'yes' : 'no'}
- Timeoutless PermissionRequest hook handlers: ${report.permissionRequest.timeoutlessPermissionRequestHooks}
- Overlong PermissionRequest hook handlers: ${report.permissionRequest.overlongPermissionRequestHooks}
- Max allowed PermissionRequest hook timeout: ${report.permissionRequest.maxAllowedTimeoutSeconds}s
- Max observed PermissionRequest hook timeout: ${report.permissionRequest.maxObservedTimeoutSeconds ?? 'n/a'}
- Bounded by Archon preflight: ${report.permissionRequest.bounded ? 'yes' : 'no'}

PermissionRequest hooks can approve or deny Codex runtime approval prompts. Archon cannot observe individual hook decisions after launch, so this preflight treats PermissionRequest as an approval-control surface rather than ordinary advisory logging.

When Codex approval prompts are disabled, PermissionRequest may not run. A workflow that relies on PermissionRequest without PreToolUse in no-approval mode is blocked because the intended approval-control hook can be bypassed by runtime policy.

## PermissionRequest hooks

${
  permissionRequestHooks.length > 0
    ? permissionRequestHooks
        .map(
          hook =>
            `- ${hook.sourceId}: timeout=${hook.timeoutSeconds ?? 'missing'}, matcher=${hook.matcher ?? 'n/a'}, command=${hook.command ?? 'missing'}`
        )
        .join('\n')
    : '- None found'
}

## PreToolUse hooks available as no-approval fallback

${
  preToolUseHooks.length > 0
    ? preToolUseHooks
        .map(
          hook =>
            `- ${hook.sourceId}: timeout=${hook.timeoutSeconds ?? 'missing'}, matcher=${hook.matcher ?? 'n/a'}, command=${hook.command ?? 'missing'}`
        )
        .join('\n')
    : '- None found'
}

## PreToolUse fallback coverage

- Required PermissionRequest matchers: ${report.permissionRequest.preToolUseFallbackCoverage.requiredMatchers.join(', ') || 'none'}
- Covered PermissionRequest matchers: ${report.permissionRequest.preToolUseFallbackCoverage.coveredMatchers.join(', ') || 'none'}
- Uncovered PermissionRequest matchers: ${report.permissionRequest.preToolUseFallbackCoverage.uncoveredMatchers.join(', ') || 'none'}

## Issues

${report.permissionRequest.issues.length > 0 ? report.permissionRequest.issues.map(item => `- ${item}`).join('\n') : '- None'}

## PreToolUse fallback issues

${report.permissionRequest.preToolUseFallbackIssues.length > 0 ? report.permissionRequest.preToolUseFallbackIssues.map(item => `- ${item}`).join('\n') : '- None'}
`;
}
