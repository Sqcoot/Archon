/**
 * Typed config parsing for Codex provider defaults.
 * Validates and narrows the opaque assistantConfig to typed fields.
 */
import type { CodexProviderDefaults } from '../types';

// Re-export so consumers can import the type from either location
export type { CodexProviderDefaults } from '../types';

export interface CodexConfigDiagnostic {
  field: string;
  message: string;
  badBehaviour: {
    pattern: 'ignored_control' | 'silent_behavior' | 'alias_normalized';
    classification: 'intentional' | 'warning-only' | 'bug';
    rationale: string;
  };
}

export type ParsedCodexConfig = CodexProviderDefaults & {
  diagnostics: CodexConfigDiagnostic[];
};

/**
 * Parse raw assistantConfig into typed Codex defaults.
 * Defensive: invalid fields are dropped, but diagnostics are retained so
 * callers can surface safety/output config drift instead of silently falling
 * back to defaults.
 */
export function parseCodexConfig(raw: Record<string, unknown>): ParsedCodexConfig {
  const result: ParsedCodexConfig = { diagnostics: [] };

  function addDiagnostic(
    field: string,
    message: string,
    rationale: string,
    pattern: CodexConfigDiagnostic['badBehaviour']['pattern'] = 'ignored_control',
    classification: CodexConfigDiagnostic['badBehaviour']['classification'] = 'warning-only'
  ): void {
    result.diagnostics.push({
      field,
      message,
      badBehaviour: {
        pattern,
        classification,
        rationale,
      },
    });
  }

  if (typeof raw.model === 'string') {
    result.model = raw.model;
  } else if (raw.model !== undefined) {
    addDiagnostic(
      'model',
      'Codex config field model must be a string.',
      'Invalid model config would be ignored and Codex would fall back to workflow/default model selection.',
      'silent_behavior',
      'bug'
    );
  }

  const validSandboxModes = ['read-only', 'workspace-write', 'danger-full-access'];
  if (typeof raw.sandboxMode === 'string' && validSandboxModes.includes(raw.sandboxMode)) {
    result.sandboxMode = raw.sandboxMode as CodexProviderDefaults['sandboxMode'];
  } else if (raw.sandboxMode !== undefined) {
    addDiagnostic(
      'sandboxMode',
      `Codex config field sandboxMode must be one of: ${validSandboxModes.join(', ')}.`,
      'Invalid sandbox config would be ignored and Codex would fall back to Archon defaults, changing the mutation boundary.',
      'silent_behavior',
      'bug'
    );
  }

  const validApprovalPolicies = ['untrusted', 'on-failure', 'on-request', 'never'];
  const noApprovalAliases = ['dontAsk', 'bypassPermissions'];
  if (
    typeof raw.approvalPolicy === 'string' &&
    validApprovalPolicies.includes(raw.approvalPolicy)
  ) {
    result.approvalPolicy = raw.approvalPolicy as CodexProviderDefaults['approvalPolicy'];
  } else if (
    typeof raw.approvalPolicy === 'string' &&
    noApprovalAliases.includes(raw.approvalPolicy)
  ) {
    result.approvalPolicy = 'never';
    addDiagnostic(
      'approvalPolicy',
      `Codex config field approvalPolicy=${raw.approvalPolicy} is a Codex permission_mode alias; Archon normalized it to approvalPolicy=never for SDK launch.`,
      'No-approval aliases are normalized explicitly so PermissionRequest/Stop preflight behavior is visible instead of silently relying on a rejected SDK value.',
      'alias_normalized',
      'intentional'
    );
  } else if (raw.approvalPolicy !== undefined) {
    addDiagnostic(
      'approvalPolicy',
      `Codex config field approvalPolicy must be one of: ${validApprovalPolicies.join(', ')}; aliases accepted: ${noApprovalAliases.join(', ')}.`,
      'Invalid approval policy config would be ignored and Codex would fall back to Archon defaults, changing runtime approval behavior.',
      'silent_behavior',
      'bug'
    );
  }

  if (typeof raw.networkAccessEnabled === 'boolean') {
    result.networkAccessEnabled = raw.networkAccessEnabled;
  } else if (raw.networkAccessEnabled !== undefined) {
    addDiagnostic(
      'networkAccessEnabled',
      'Codex config field networkAccessEnabled must be a boolean.',
      'Invalid network config would be ignored and Codex would fall back to Archon defaults, changing network access behavior.',
      'silent_behavior',
      'bug'
    );
  }

  const validEfforts = ['minimal', 'low', 'medium', 'high', 'xhigh'];
  if (
    typeof raw.modelReasoningEffort === 'string' &&
    validEfforts.includes(raw.modelReasoningEffort)
  ) {
    result.modelReasoningEffort =
      raw.modelReasoningEffort as CodexProviderDefaults['modelReasoningEffort'];
  } else if (raw.modelReasoningEffort !== undefined) {
    addDiagnostic(
      'modelReasoningEffort',
      `Codex config field modelReasoningEffort must be one of: ${validEfforts.join(', ')}.`,
      'Invalid reasoning-effort config would be ignored and Codex would fall back to default model reasoning behavior.',
      'silent_behavior',
      'bug'
    );
  }

  const validSearchModes = ['disabled', 'cached', 'live'];
  if (typeof raw.webSearchMode === 'string' && validSearchModes.includes(raw.webSearchMode)) {
    result.webSearchMode = raw.webSearchMode as CodexProviderDefaults['webSearchMode'];
  } else if (raw.webSearchMode !== undefined) {
    addDiagnostic(
      'webSearchMode',
      `Codex config field webSearchMode must be one of: ${validSearchModes.join(', ')}.`,
      'Invalid web-search config would be ignored and Codex would fall back to default search behavior.',
      'silent_behavior',
      'bug'
    );
  }

  if (Array.isArray(raw.additionalDirectories)) {
    result.additionalDirectories = raw.additionalDirectories.filter(
      (d): d is string => typeof d === 'string'
    );
    const dropped = raw.additionalDirectories.length - result.additionalDirectories.length;
    if (dropped > 0) {
      addDiagnostic(
        'additionalDirectories',
        `${dropped} Codex additionalDirectories entr${dropped === 1 ? 'y was' : 'ies were'} not a string.`,
        'Invalid additional directory entries would be ignored and Codex may lose intended workspace access.',
        'silent_behavior',
        'bug'
      );
    }
  } else if (raw.additionalDirectories !== undefined) {
    addDiagnostic(
      'additionalDirectories',
      'Codex config field additionalDirectories must be an array of strings.',
      'Invalid additional directory config would be ignored and Codex may lose intended workspace access.',
      'silent_behavior',
      'bug'
    );
  }

  if (typeof raw.codexBinaryPath === 'string') {
    result.codexBinaryPath = raw.codexBinaryPath;
  } else if (raw.codexBinaryPath !== undefined) {
    addDiagnostic(
      'codexBinaryPath',
      'Codex config field codexBinaryPath must be a string.',
      'Invalid Codex binary path config would be ignored and Archon would fall back to binary auto-detection.',
      'silent_behavior',
      'bug'
    );
  }

  return result;
}
