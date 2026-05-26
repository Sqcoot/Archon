import { describe, expect, test } from 'bun:test';
import { parseCodexConfig } from './config';

describe('parseCodexConfig', () => {
  test('classifies invalid safety and resource controls as bugs', () => {
    const parsed = parseCodexConfig({
      sandboxMode: 'invalid',
      approvalPolicy: 'sometimes',
      networkAccessEnabled: 'yes',
      webSearchMode: 'always',
      additionalDirectories: ['/repo', 123],
      codexBinaryPath: 42,
    });

    expect(parsed.diagnostics.map(diagnostic => diagnostic.field)).toEqual([
      'sandboxMode',
      'approvalPolicy',
      'networkAccessEnabled',
      'webSearchMode',
      'additionalDirectories',
      'codexBinaryPath',
    ]);
    expect(
      parsed.diagnostics.every(diagnostic => diagnostic.badBehaviour.classification === 'bug')
    ).toBe(true);
  });

  test('normalizes no-approval aliases as intentional behavior', () => {
    const parsed = parseCodexConfig({ approvalPolicy: 'dontAsk' });

    expect(parsed.approvalPolicy).toBe('never');
    expect(parsed.diagnostics).toHaveLength(1);
    expect(parsed.diagnostics[0]?.badBehaviour.pattern).toBe('alias_normalized');
    expect(parsed.diagnostics[0]?.badBehaviour.classification).toBe('intentional');
  });
});
