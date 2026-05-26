/**
 * Typed config parsing for Claude provider defaults.
 * Validates and narrows the opaque assistantConfig to typed fields.
 */
import type { ClaudeProviderDefaults } from '../types';

// Re-export so consumers can import the type from either location
export type { ClaudeProviderDefaults } from '../types';

export interface ClaudeConfigDiagnostic {
  field: string;
  message: string;
  badBehaviour: {
    pattern: 'silent_behavior';
    classification: 'bug';
    rationale: string;
  };
}

export interface ParsedClaudeConfig {
  config: ClaudeProviderDefaults;
  diagnostics: ClaudeConfigDiagnostic[];
}

/**
 * Parse raw assistantConfig into typed Claude defaults.
 * Defensive compatibility wrapper: invalid fields are excluded from the typed
 * config and surfaced by parseClaudeConfigWithDiagnostics(); runtime provider
 * execution must inspect diagnostics and fail closed.
 */
export function parseClaudeConfig(raw: Record<string, unknown>): ClaudeProviderDefaults {
  return parseClaudeConfigWithDiagnostics(raw).config;
}

export function parseClaudeConfigWithDiagnostics(raw: Record<string, unknown>): ParsedClaudeConfig {
  const result: ClaudeProviderDefaults = {};
  const diagnostics: ClaudeConfigDiagnostic[] = [];

  function addDiagnostic(field: string, message: string, rationale: string): void {
    diagnostics.push({
      field,
      message,
      badBehaviour: {
        pattern: 'silent_behavior',
        classification: 'bug',
        rationale,
      },
    });
  }

  if (typeof raw.model === 'string') {
    result.model = raw.model;
  } else if (raw.model !== undefined) {
    addDiagnostic(
      'model',
      'Claude config field model must be a string.',
      'Invalid model config would be silently dropped, causing Claude to fall back to request/default model selection.'
    );
  }

  if (Array.isArray(raw.settingSources)) {
    const valid = raw.settingSources.filter(
      (s): s is 'project' | 'user' => s === 'project' || s === 'user'
    );
    if (valid.length !== raw.settingSources.length) {
      addDiagnostic(
        'settingSources',
        'Claude config field settingSources must contain only project or user.',
        'Invalid setting source entries would be silently dropped, changing project/user configuration trust scope.'
      );
    }
    if (valid.length > 0) {
      result.settingSources = valid;
    }
  } else if (raw.settingSources !== undefined) {
    addDiagnostic(
      'settingSources',
      'Claude config field settingSources must be an array.',
      'Invalid settingSources config would be silently dropped, causing Claude to use default project and user setting scopes.'
    );
  }

  if (typeof raw.claudeBinaryPath === 'string') {
    result.claudeBinaryPath = raw.claudeBinaryPath;
  } else if (raw.claudeBinaryPath !== undefined) {
    addDiagnostic(
      'claudeBinaryPath',
      'Claude config field claudeBinaryPath must be a string.',
      'Invalid binary path config would be silently dropped, causing Claude binary resolution to fall back to auto-detection.'
    );
  }

  return { config: result, diagnostics };
}
