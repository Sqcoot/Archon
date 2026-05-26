import type { PiProviderDefaults } from '../../types';

export type { PiProviderDefaults };

export interface PiConfigDiagnostic {
  field: string;
  message: string;
  badBehaviour: {
    pattern: 'silent_behavior';
    classification: 'bug';
    rationale: string;
  };
}

export interface ParsedPiConfig {
  config: PiProviderDefaults;
  diagnostics: PiConfigDiagnostic[];
}

/**
 * Parse raw YAML-derived config into typed Pi defaults.
 * Defensive: invalid fields are dropped and returned as diagnostics by
 * parsePiConfigWithDiagnostics(). This compatibility wrapper preserves the
 * historical plain-object return shape used by tests and external callers;
 * provider execution must inspect diagnostics and fail closed.
 */
export function parsePiConfig(raw: Record<string, unknown>): PiProviderDefaults {
  return parsePiConfigWithDiagnostics(raw).config;
}

/**
 * Parse raw YAML-derived config into typed Pi defaults plus non-throwing
 * diagnostics. Invalid fields are excluded from the typed config so callers can
 * present a precise error before execution instead of silently running with a
 * partially applied provider configuration.
 */
export function parsePiConfigWithDiagnostics(raw: Record<string, unknown>): ParsedPiConfig {
  const result: PiProviderDefaults = {};
  const diagnostics: PiConfigDiagnostic[] = [];

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
      'Pi config field model must be a string.',
      'Invalid model config would be silently dropped, causing Pi to fail model resolution or fall back to node-level model selection.'
    );
  }

  if (typeof raw.enableExtensions === 'boolean') {
    result.enableExtensions = raw.enableExtensions;
  } else if (raw.enableExtensions !== undefined) {
    addDiagnostic(
      'enableExtensions',
      'Pi config field enableExtensions must be a boolean.',
      'Invalid extension config would be silently dropped, causing Pi to fall back to default extension loading behavior.'
    );
  }

  if (typeof raw.interactive === 'boolean') {
    result.interactive = raw.interactive;
  } else if (raw.interactive !== undefined) {
    addDiagnostic(
      'interactive',
      'Pi config field interactive must be a boolean.',
      'Invalid interactive config would be silently dropped, causing Pi to fall back to default UI-context behavior.'
    );
  }

  if (
    raw.extensionFlags &&
    typeof raw.extensionFlags === 'object' &&
    !Array.isArray(raw.extensionFlags)
  ) {
    const flags: Record<string, boolean | string> = {};
    for (const [key, value] of Object.entries(raw.extensionFlags as Record<string, unknown>)) {
      if (typeof value === 'boolean' || typeof value === 'string') {
        flags[key] = value;
      }
    }
    const dropped =
      Object.keys(raw.extensionFlags as Record<string, unknown>).length - Object.keys(flags).length;
    if (dropped > 0) {
      addDiagnostic(
        'extensionFlags',
        `${dropped} Pi extensionFlags entr${dropped === 1 ? 'y was' : 'ies were'} not boolean/string.`,
        'Invalid extension flags would be silently dropped, causing extensions to miss intended startup configuration.'
      );
    }
    if (Object.keys(flags).length > 0) {
      result.extensionFlags = flags;
    }
  } else if (raw.extensionFlags !== undefined) {
    addDiagnostic(
      'extensionFlags',
      'Pi config field extensionFlags must be an object of boolean/string values.',
      'Invalid extension flags config would be silently dropped, causing extensions to miss intended startup configuration.'
    );
  }

  if (raw.env && typeof raw.env === 'object' && !Array.isArray(raw.env)) {
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw.env as Record<string, unknown>)) {
      if (typeof value === 'string') {
        env[key] = value;
      }
    }
    const dropped =
      Object.keys(raw.env as Record<string, unknown>).length - Object.keys(env).length;
    if (dropped > 0) {
      addDiagnostic(
        'env',
        `${dropped} Pi env entr${dropped === 1 ? 'y was' : 'ies were'} not a string.`,
        'Invalid env entries would be silently dropped, causing extensions/subprocesses to lose intended runtime configuration.'
      );
    }
    if (Object.keys(env).length > 0) {
      result.env = env;
    }
  } else if (raw.env !== undefined) {
    addDiagnostic(
      'env',
      'Pi config field env must be an object of string values.',
      'Invalid env config would be silently dropped, causing extensions/subprocesses to lose intended runtime configuration.'
    );
  }

  if (
    typeof raw.maxConcurrent === 'number' &&
    Number.isInteger(raw.maxConcurrent) &&
    raw.maxConcurrent > 0
  ) {
    result.maxConcurrent = raw.maxConcurrent;
  } else if (raw.maxConcurrent !== undefined) {
    addDiagnostic(
      'maxConcurrent',
      'Pi config field maxConcurrent must be a positive integer.',
      'Invalid concurrency config would be silently dropped, causing Pi to fall back to unbounded request concurrency.'
    );
  }

  return { config: result, diagnostics };
}
