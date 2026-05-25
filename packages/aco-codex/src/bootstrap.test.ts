import { describe, expect, test } from 'bun:test';
import {
  BOOTSTRAP_CODEX_COMMAND,
  REQUIRED_CODEX_BOOTSTRAP_ARTIFACTS,
  bootstrapCodexCommand,
  buildCodexBootstrapArtifacts,
  buildCodexHarnessCapabilityReport,
  codexBootstrapFixtureGate,
  codexBootstrapInputSchema,
  codexCapabilityStatusValues,
  defaultCodexBootstrapInput,
  parseCodexBootstrapArtifactBundle,
} from './index';
import type { CodexHarness, CodexHarnessCapability } from './index';

const GOLDEN_FILE_NAMES = {
  'codex-bootstrap-capsule.md': 'codex-bootstrap-capsule.expected.md',
  'codex-bootstrap-context.json': 'codex-bootstrap-context.expected.json',
  'capability-snapshot.json': 'capability-snapshot.expected.json',
  'codex-harness-capability-report.json': 'codex-harness-capability-report.expected.json',
  'codex-continuation-handoff.md': 'codex-continuation-handoff.expected.md',
} as const;

describe('codex bootstrap artifacts', () => {
  test('renders all required artifacts deterministically against goldens', async () => {
    const input = defaultCodexBootstrapInput();
    const bundle = buildCodexBootstrapArtifacts(input);

    expect(bundle.ok).toBe(true);
    if (!bundle.ok) throw new Error(bundle.issues.join('\n'));
    expect(bundle.value.artifacts.map(artifact => artifact.name)).toEqual([
      ...REQUIRED_CODEX_BOOTSTRAP_ARTIFACTS,
    ]);

    for (const artifact of bundle.value.artifacts) {
      const expected = await loadGolden(GOLDEN_FILE_NAMES[artifact.name]);
      expect(artifact.content).toBe(expected);
      expect(artifact.content).not.toContain('generatedAt');
      expect(artifact.content).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    }

    const secondRender = buildCodexBootstrapArtifacts(input);
    expect(secondRender.ok).toBe(true);
    if (!secondRender.ok) throw new Error(secondRender.issues.join('\n'));
    expect(secondRender.value).toEqual(bundle.value);
  });

  test('preserves bootstrap-codex command metadata without live CLI wiring', () => {
    expect(bootstrapCodexCommand).toMatchObject({
      command: BOOTSTRAP_CODEX_COMMAND,
      owner: 'aco-codex',
      compatibility: 'preserve',
      defaultMutates: 'read-only',
      writeArtifactMutates: 'writes-artifacts',
      approvalRequired: false,
    });
    expect(bootstrapCodexCommand.manifest).toMatchObject({
      kind: 'command-manifest',
      mutates: 'read-only',
      owner: 'aco-codex',
      compatibility: 'preserve',
    });
  });

  test('keeps capability statuses exact and runtime non-claims explicit', () => {
    const report = buildCodexHarnessCapabilityReport();

    expect(report.ok).toBe(true);
    if (!report.ok) throw new Error(report.issues.join('\n'));
    expect(codexCapabilityStatusValues).toEqual([
      'supported',
      'partial',
      'unsupported',
      'unknown',
      'deferred_by_design',
    ]);
    expect(report.value.summary).toEqual({
      supported: 0,
      partial: 3,
      unsupported: 2,
      unknown: 4,
      deferred_by_design: 1,
    });
    expect(
      report.value.checks.filter(check => check.status !== 'supported').map(check => check.id)
    ).toContain('tool-restriction-enforcement');
    expect(report.value.checks.every(check => !check.runtimeClaimed)).toBe(true);
  });

  test('fails closed on invalid capabilities and malformed artifact bundles', () => {
    const report = buildCodexHarnessCapabilityReport();
    expect(report.ok).toBe(true);
    if (!report.ok) throw new Error(report.issues.join('\n'));

    const invalidStatusCapabilities = report.value.checks.map((capability, index) =>
      index === 0 ? { ...capability, status: 'claimed' } : capability
    ) as readonly CodexHarnessCapability[];
    const invalidStatus = buildCodexHarnessCapabilityReport(invalidStatusCapabilities);
    expect(invalidStatus.ok).toBe(false);

    const missingCapability = buildCodexHarnessCapabilityReport(report.value.checks.slice(1));
    expect(missingCapability.ok).toBe(false);
    if (!missingCapability.ok) {
      expect(missingCapability.issues.join('\n')).toContain('missing required Codex capability');
    }

    const runtimeClaimedCapabilities = report.value.checks.map(capability =>
      capability.id === 'runtime-event-observation'
        ? { ...capability, runtimeClaimed: true }
        : capability
    );
    const runtimeClaimed = buildCodexHarnessCapabilityReport(runtimeClaimedCapabilities);
    expect(runtimeClaimed.ok).toBe(false);

    const bundle = buildCodexBootstrapArtifacts(defaultCodexBootstrapInput());
    expect(bundle.ok).toBe(true);
    if (!bundle.ok) throw new Error(bundle.issues.join('\n'));

    const duplicateBundle = {
      ...bundle.value,
      artifacts: bundle.value.artifacts.map((artifact, index) =>
        index === 1 ? { ...artifact, name: bundle.value.artifacts[0]?.name } : artifact
      ),
    };
    const duplicateParsed = parseCodexBootstrapArtifactBundle(duplicateBundle);
    expect(duplicateParsed.ok).toBe(false);
    if (!duplicateParsed.ok) {
      expect(duplicateParsed.issues.join('\n')).toContain('duplicate Codex bootstrap artifact');
    }

    const missingArtifactBundle = {
      ...bundle.value,
      artifacts: bundle.value.artifacts.slice(1),
    };
    expect(parseCodexBootstrapArtifactBundle(missingArtifactBundle).ok).toBe(false);

    const withoutCommand: Record<string, unknown> = { ...bundle.value };
    delete withoutCommand.command;
    expect(parseCodexBootstrapArtifactBundle(withoutCommand).ok).toBe(false);
  });

  test('fixture gate passes default input and remains read-only', async () => {
    const result = await codexBootstrapFixtureGate.run(defaultCodexBootstrapInput());

    expect(codexBootstrapFixtureGate.id).toBe('codex-bootstrap-fixture-gate');
    expect(codexBootstrapFixtureGate.mutates).toBe('read-only');
    expect(result.status).toBe('passed');
    if (result.status !== 'passed') throw new Error('fixture gate failed');
    expect(result.value.artifactNames).toEqual([...REQUIRED_CODEX_BOOTSTRAP_ARTIFACTS]);
    expect(result.value.capabilitySummary.unsupported).toBe(2);
  });

  test('CodexHarness contract exposes manifest, start, send, attachArtifacts, and close', async () => {
    const harness: CodexHarness<{ readonly id: string }, { readonly type: string }> = {
      manifest: {
        kind: 'provider-manifest',
        id: 'provider.codex.contract-only',
        provider: 'codex',
        capabilities: [],
        evidence: [
          {
            id: 'evidence.test.codex-harness',
            source: 'bootstrap.test.ts',
            summary: 'Test harness manifest proves contract shape',
            confidence: 'high',
            freshness: 'unknown',
          },
        ],
      },
      start(input) {
        const parsed = codexBootstrapInputSchema.parse(input);
        return Promise.resolve({ id: parsed.id });
      },
      send(_session, _event) {
        return Promise.resolve({
          kind: 'codex-harness-result',
          schemaVersion: 'aco.codex-harness-result.v1',
          status: 'unknown',
          artifacts: [],
          evidence: [
            {
              id: 'evidence.test.codex-result',
              source: 'bootstrap.test.ts',
              summary: 'Contract-only result does not claim runtime support',
              confidence: 'high',
              freshness: 'unknown',
            },
          ],
        });
      },
      attachArtifacts(_session, _artifacts) {
        return Promise.resolve();
      },
      close(_session) {
        return Promise.resolve();
      },
    };

    const session = await harness.start(defaultCodexBootstrapInput());
    const result = await harness.send(session, { type: 'Stop' });
    await harness.attachArtifacts(session, []);
    await harness.close(session);

    expect(harness.manifest.provider).toBe('codex');
    expect(session.id).toBe('aco.codex-bootstrap.fixture');
    expect(result.status).toBe('unknown');
  });
});

async function loadGolden(fileName: string): Promise<string> {
  const root = new URL('../../../tests/fixtures/aco/codex/', import.meta.url);
  return Bun.file(new URL(fileName, root)).text();
}
