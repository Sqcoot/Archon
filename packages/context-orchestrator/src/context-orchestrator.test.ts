import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import {
  applyCavemanPolicy,
  compilePromptPackage,
  createArchivedPolicyDecision,
  isPathInside,
  readArtifactPackageManifest,
  redactSecrets,
  routeBmad,
  stringifyArchivedPolicyDecision,
  validateContextOrchestrator,
  writeArchivedPolicyDecision,
} from './index';

const repoRoot = resolve(import.meta.dir, '../../..');

describe('context orchestrator core', () => {
  test('routes ambiguous tasks to BMAD help', () => {
    expect(routeBmad({ prompt: 'help' }).steps).toEqual(['bmad-help']);
  });

  test('preserves fenced artifacts under Caveman policy', () => {
    const input =
      'Keep this:\n```json\n{"path":"docs/context-orchestrator/specs/007-caveman-policy-spec.md"}\n```';
    expect(applyCavemanPolicy(input, 'ultra')).toContain(
      '```json\n{"path":"docs/context-orchestrator/specs/007-caveman-policy-spec.md"}\n```'
    );
  });

  test('rejects paths outside archive root', () => {
    expect(isPathInside('/tmp/aco-root', '/tmp/aco-root/package')).toBe(true);
    expect(isPathInside('/tmp/aco-root', '/tmp/not-aco-root/package')).toBe(false);
  });

  test('ACO-POLICY-DECISION-001 AC-LEDGER-004 AC-LEDGER-008 compiles a deterministic redacted archive', async () => {
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-core-'));
    const result = await compilePromptPackage({
      cwd: repoRoot,
      prompt: 'Implement safely with SECRET_TOKEN=hidden-value.',
      archiveRoot,
      runId: 'aco-core-test',
      timestamp: '2026-05-17T12:00:00.000Z',
    });

    expect(result.package.runId).toBe('aco-core-test');
    expect(result.package.originalPrompt).toContain('SECRET_TOKEN=[REDACTED]');
    expect(result.package.nextArchonCommand).toEqual([
      'bun',
      'run',
      'cli',
      'context',
      'compile',
      '--cwd',
      repoRoot,
      '--',
      'Implement safely with SECRET_TOKEN=[REDACTED]',
    ]);
    expect(result.files['manifest.json']).toContain('manifest.json');
    expect(result.files['prompt-package.json']).toContain('prompt-package.json');
    expect(result.files['policy-decision.json']).toContain('policy-decision.json');
    expect(result.files['decision-dossier.json']).toContain('decision-dossier.json');
    expect(result.files['decision-dossier.md']).toContain('decision-dossier.md');
    expect(result.files['target-intent-boundary.json']).toContain('target-intent-boundary.json');
    expect(result.files['tool-availability-ledger.json']).toContain(
      'tool-availability-ledger.json'
    );
    expect(result.files['tool-availability-ledger.md']).toContain('tool-availability-ledger.md');
    expect(result.files['commands-ledger.json']).toContain('commands-ledger.json');
    expect(result.files['commands-ledger.md']).toContain('commands-ledger.md');
    expect(Object.keys(result.files)).toHaveLength(24);

    const policyInput = JSON.parse(await readFile(result.files['prompt-package.json'], 'utf8')) as {
      schema_version: string;
      package_id: string;
      artifacts: { path: string }[];
      evidence: {
        graph?: unknown;
        docs?: unknown;
        bmad?: unknown;
        acceptance?: unknown;
        security?: unknown;
        ledgers?: { schemaVersion?: string; toolAvailability?: unknown[]; commands?: unknown[] };
        nextDecision?: { schemaVersion?: string; kind?: string; evidenceBlockerIds?: string[] };
        targetIntentBoundary?: {
          schemaVersion?: string;
          scope?: { nonEnforcementBoundary?: true };
        };
      };
    };
    expect(policyInput.schema_version).toBe('aco.prompt-package.policy-input.v1');
    expect(policyInput.package_id).toBe('aco-core-test');
    expect(policyInput.evidence.graph).toBeDefined();
    expect(policyInput.evidence.docs).toBeDefined();
    expect(policyInput.evidence.bmad).toBeDefined();
    expect(policyInput.evidence.acceptance).toBeDefined();
    expect(policyInput.evidence.security).toBeDefined();
    expect(policyInput.evidence.ledgers?.schemaVersion).toBe('aco.ledger-bundle.v1');
    expect(policyInput.evidence.nextDecision?.schemaVersion).toBe('aco.next-decision.v1');
    expect(policyInput.evidence.targetIntentBoundary?.schemaVersion).toBe(
      'aco.target-intent-boundary.v1'
    );
    expect(policyInput.evidence.targetIntentBoundary?.scope?.nonEnforcementBoundary).toBe(true);
    expectCurrentCompileNextDecisionKind(policyInput.evidence.nextDecision);
    expect(policyInput.evidence.ledgers?.toolAvailability?.length).toBeGreaterThan(0);
    expect(policyInput.evidence.ledgers?.commands?.length).toBeGreaterThan(0);
    expect(policyInput.artifacts.map(artifact => artifact.path)).not.toContain(
      'policy-decision.json'
    );
    expect(policyInput.artifacts.map(artifact => artifact.path)).toContain(
      'tool-availability-ledger.json'
    );
    expect(policyInput.artifacts.map(artifact => artifact.path)).toContain('commands-ledger.json');
    expect(policyInput.artifacts.map(artifact => artifact.path)).toContain(
      'target-intent-boundary.json'
    );

    const manifest = JSON.parse(await readFile(result.files['manifest.json'], 'utf8')) as {
      ledgerSchemaVersion?: string;
      ledgerArtifacts?: string[];
      decisionDossierSchemaVersion?: string;
      decisionDossierArtifacts?: string[];
      targetIntentBoundaryArtifact?: string;
      targetIntentBoundarySchemaVersion?: string;
      nextDecision?: { schemaVersion?: string; kind?: string; evidenceBlockerIds?: string[] };
      ledgerSummary?: unknown;
    };
    expect(manifest.ledgerSchemaVersion).toBe('aco.ledger-bundle.v1');
    expect(manifest.ledgerArtifacts).toEqual([
      'tool-availability-ledger.json',
      'tool-availability-ledger.md',
      'commands-ledger.json',
      'commands-ledger.md',
    ]);
    expect(manifest.decisionDossierSchemaVersion).toBe('aco.decision-dossier.v1');
    expect(manifest.decisionDossierArtifacts).toEqual([
      'decision-dossier.json',
      'decision-dossier.md',
    ]);
    expect(manifest.targetIntentBoundaryArtifact).toBe('target-intent-boundary.json');
    expect(manifest.targetIntentBoundarySchemaVersion).toBe('aco.target-intent-boundary.v1');
    expect(manifest.nextDecision?.schemaVersion).toBe('aco.next-decision.v1');
    expectCurrentCompileNextDecisionKind(manifest.nextDecision);
    expect(manifest.ledgerSummary).toBeDefined();

    const toolLedger = JSON.parse(
      await readFile(result.files['tool-availability-ledger.json'], 'utf8')
    ) as { schemaVersion?: string; toolAvailability?: unknown[] };
    const commandLedger = JSON.parse(
      await readFile(result.files['commands-ledger.json'], 'utf8')
    ) as {
      schemaVersion?: string;
      commands?: unknown[];
    };
    expect(toolLedger.schemaVersion).toBe('aco.ledger-bundle.v1');
    expect(commandLedger.schemaVersion).toBe('aco.ledger-bundle.v1');
    expect(toolLedger.toolAvailability?.length).toBeGreaterThan(0);
    expect(commandLedger.commands?.length).toBeGreaterThan(0);

    const finalPackage = await readFile(result.files['final-prompt-package.md'], 'utf8');
    const codexPrompt = await readFile(result.files['codex-prompt.md'], 'utf8');
    const decisionDossier = JSON.parse(
      await readFile(result.files['decision-dossier.json'], 'utf8')
    ) as {
      schemaVersion?: string;
      nextGoalObjective?: string;
      approvalRequired?: boolean;
      nextDecision?: { kind?: string; evidenceBlockerIds?: string[] };
    };
    const decisionDossierMarkdown = await readFile(result.files['decision-dossier.md'], 'utf8');
    const goalCommand = `/goal ${decisionDossier.nextGoalObjective ?? ''}`;
    expect(decisionDossier.schemaVersion).toBe('aco.decision-dossier.v1');
    expect(typeof decisionDossier.nextGoalObjective).toBe('string');
    expect(decisionDossier.approvalRequired).toBe(true);
    expectCurrentCompileNextDecisionKind(decisionDossier.nextDecision);
    expect(decisionDossierMarkdown).toContain('# ACO Decision Dossier');
    expect(finalPackage).toContain('## Ledger Guidance');
    expect(finalPackage).toContain('tool-availability-ledger.json');
    expect(finalPackage).toContain('## Decision Dossier');
    expect(finalPackage).toContain('## Next Decision');
    expect(finalPackage).toContain('decision-dossier.json');
    expect(codexPrompt).toContain('Ledger requirements');
    expect(codexPrompt).toContain('Avoid commands marked `forbidden`');
    expect(codexPrompt).toContain('Decision dossier requirements');
    expect(finalPackage).toContain('## Codex Goal Handoff');
    expect(codexPrompt).toContain('## Codex Goal Handoff');
    expect(codexPrompt).toContain('features.goals');
    expect(codexPrompt).toContain('Codex session control only');
    expect(codexPrompt).toContain(goalCommand);
    expect(codexPrompt).not.toContain('Implement ACO Acceptance Reality Gate');
    expect(goalCommand.length).toBeLessThan(4000);

    const policyDecision = JSON.parse(
      await readFile(result.files['policy-decision.json'], 'utf8')
    ) as {
      schema_version: string;
      decision: { allow: boolean; warn: unknown[] };
      codes: { warn: string[] };
      counts: { warn: number };
      input: { path: string; sha256: string };
      policy: { version: string; sha256: string };
      opa: { available: boolean; version: string | null };
    };
    expect(policyDecision.schema_version).toBe('aco.policy-decision.v1');
    expect(policyDecision.decision.allow).toBe(true);
    expect(policyDecision.input.path).toBe('prompt-package.json');
    expect(policyDecision.input.sha256).toHaveLength(64);
    expect(policyDecision.policy.version).toBe('aco-prompt-package-v1');
    expect(policyDecision.policy.sha256).toHaveLength(64);
    expect(policyDecision.opa.available).toBe(true);
    if (result.package.graphContext.waiverCount > 0) {
      expect(policyDecision.codes.warn).toContain('ACO_POLICY_GRAPH_WAIVER');
    } else {
      expect(policyDecision.codes.warn).not.toContain('ACO_POLICY_GRAPH_WAIVER');
    }
    expect(policyDecision.codes.warn).not.toContain('ACO_POLICY_UNRESOLVED_DOCS');
    expect(policyDecision.counts.warn).toBe(policyDecision.decision.warn.length);
  });

  test('AC-CONFIDENCE-001 emits byte-stable ledger artifacts for repeated compiles', async () => {
    const prompt = 'aco confidence closure';
    const timestamp = '2026-05-18T12:00:00.000Z';
    const firstArchiveRoot = await mkdtemp(join(tmpdir(), 'aco-confidence-a-'));
    const secondArchiveRoot = await mkdtemp(join(tmpdir(), 'aco-confidence-b-'));

    const first = await compilePromptPackage({
      cwd: repoRoot,
      prompt,
      archiveRoot: firstArchiveRoot,
      runId: 'aco-confidence',
      timestamp,
    });
    const second = await compilePromptPackage({
      cwd: repoRoot,
      prompt,
      archiveRoot: secondArchiveRoot,
      runId: 'aco-confidence',
      timestamp,
    });

    for (const artifact of [
      'tool-availability-ledger.json',
      'tool-availability-ledger.md',
      'commands-ledger.json',
      'commands-ledger.md',
    ]) {
      expect(await readFile(first.files[artifact], 'utf8')).toBe(
        await readFile(second.files[artifact], 'utf8')
      );
    }
  });

  test('rejects unsafe archive run IDs', async () => {
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-core-'));
    await expect(
      compilePromptPackage({
        cwd: process.cwd(),
        prompt: 'Compile safely.',
        archiveRoot,
        runId: '../escape',
      })
    ).rejects.toThrow('Invalid ACO archive runId');
    await expect(
      compilePromptPackage({
        cwd: process.cwd(),
        prompt: 'Compile safely.',
        archiveRoot,
        runId: '/tmp/escape',
      })
    ).rejects.toThrow('Invalid ACO archive runId');
    await expect(
      compilePromptPackage({
        cwd: process.cwd(),
        prompt: 'Compile safely.',
        archiveRoot,
        runId: 'bad\\id',
      })
    ).rejects.toThrow('Invalid ACO archive runId');
  });

  test('AC-P1-API reads manifest-backed artifact packages and rejects traversal IDs', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'aco-cwd-'));
    const localArchiveRoot = join(cwd, '.archon/artifacts/context-orchestrator');
    const archivePath = join(localArchiveRoot, 'lookup-run');
    await mkdir(archivePath, { recursive: true });
    await writeFile(
      join(archivePath, 'manifest.json'),
      `${JSON.stringify({ runId: 'lookup-run', ledgerSchemaVersion: 'aco.ledger-bundle.v1' })}\n`
    );
    await writeFile(join(archivePath, 'commands-ledger.json'), '{}\n');

    await expect(readArtifactPackageManifest(cwd, '../escape')).rejects.toThrow(
      'Invalid ACO archive runId'
    );
    const lookup = await readArtifactPackageManifest(cwd, 'lookup-run');
    expect(lookup.manifest.runId).toBe('lookup-run');
    expect(lookup.files.map(file => file.name)).toContain('manifest.json');

    if (process.platform !== 'win32') {
      const outside = await mkdtemp(join(tmpdir(), 'aco-package-outside-'));
      await writeFile(join(outside, 'manifest.json'), '{}\n');
      await symlink(outside, join(localArchiveRoot, 'symlink-run'), 'dir');
      await expect(readArtifactPackageManifest(cwd, 'symlink-run')).rejects.toThrow(
        'Archive real path escapes root'
      );
    }
  });

  test('rejects symlink archive roots and file collisions', async () => {
    if (process.platform === 'win32') return;

    const outside = await mkdtemp(join(tmpdir(), 'aco-outside-'));
    const symlinkRoot = join(await mkdtemp(join(tmpdir(), 'aco-link-parent-')), 'archive-root');
    await symlink(outside, symlinkRoot, 'dir');
    await expect(
      compilePromptPackage({
        cwd: process.cwd(),
        prompt: 'Compile safely.',
        archiveRoot: symlinkRoot,
        runId: 'aco-symlink-root',
      })
    ).rejects.toThrow('Archive root must not be a symbolic link');

    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-core-'));
    const archivePath = join(archiveRoot, 'aco-file-collision');
    await mkdir(archivePath);
    const outsideFile = join(outside, 'manifest.json');
    await writeFile(outsideFile, 'outside');
    await symlink(outsideFile, join(archivePath, 'manifest.json'));
    await expect(
      compilePromptPackage({
        cwd: process.cwd(),
        prompt: 'Compile safely.',
        archiveRoot,
        runId: 'aco-file-collision',
      })
    ).rejects.toThrow('Archive file must not be a symbolic link');
  });

  test('redacts broad secret-like values', () => {
    const privateKey = ['-----BEGIN PRIVATE KEY-----', 'abc123', '-----END PRIVATE KEY-----'].join(
      '\n'
    );
    const input = [
      'secret_token=lowercase-secret',
      'ApiKey: "json-style-secret"',
      'password: yaml-style-secret',
      'Authorization: Bearer abcdefghijklmnopqrstuvwxyz',
      'openai=sk-abcdefghijklmnopqrstuvwxyz',
      'github=ghp_abcdefghijklmnopqrstuvwxyz',
      'npm=npm_abcdefghijklmnopqrstuvwxyz',
      'aws=AKIAABCDEFGHIJKLMNOP',
      'url=https://user:pass@example.com/path',
      privateKey,
    ].join('\n');
    const redacted = redactSecrets(input);
    expect(redacted).not.toContain('lowercase-secret');
    expect(redacted).not.toContain('json-style-secret');
    expect(redacted).not.toContain('yaml-style-secret');
    expect(redacted).not.toContain('abcdefghijklmnopqrstuvwxyz');
    expect(redacted).not.toContain('AKIAABCDEFGHIJKLMNOP');
    expect(redacted).not.toContain('user:pass');
    expect(redacted).not.toContain(privateKey);
    expect(redacted).toContain('[REDACTED]');
  });

  test('archive output does not contain rendered prompt secrets', async () => {
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-core-'));
    const result = await compilePromptPackage({
      cwd: process.cwd(),
      prompt: 'Plan with api_key: "json-secret-value" and token=npm_abcdefghijklmnop.',
      archiveRoot,
      runId: 'aco-redacted-output',
      timestamp: '2026-05-17T12:00:00.000Z',
    });
    const finalPackage = await readFile(result.files['final-prompt-package.md'], 'utf8');
    const manifest = await readFile(result.files['manifest.json'], 'utf8');
    const policyInput = await readFile(result.files['prompt-package.json'], 'utf8');
    expect(finalPackage).not.toContain('json-secret-value');
    expect(finalPackage).not.toContain('npm_abcdefghijklmnop');
    expect(manifest).not.toContain('json-secret-value');
    expect(manifest).not.toContain('npm_abcdefghijklmnop');
    expect(policyInput).not.toContain('json-secret-value');
    expect(policyInput).not.toContain('npm_abcdefghijklmnop');
  });

  test('reports explicit local OPA policy skip for aggregate validation only', async () => {
    const originalSkip = process.env.ARCHON_SKIP_OPA;
    const originalCi = process.env.CI;
    try {
      process.env.ARCHON_SKIP_OPA = '1';
      delete process.env.CI;
      const cwd = await writeValidationFixture();
      const report = await validateContextOrchestrator({ cwd });
      const policyCheck = report.checks.find(check => check.id === 'aco-policy');
      expect(report.status).toBe('warning');
      expect(policyCheck?.status).toBe('warning');
      expect(policyCheck?.message).toContain('local aggregate validation only');
    } finally {
      if (originalSkip === undefined) {
        delete process.env.ARCHON_SKIP_OPA;
      } else {
        process.env.ARCHON_SKIP_OPA = originalSkip;
      }
      if (originalCi === undefined) {
        delete process.env.CI;
      } else {
        process.env.CI = originalCi;
      }
    }
  });

  test('fails closed when OPA policy skip is requested in CI', async () => {
    const originalSkip = process.env.ARCHON_SKIP_OPA;
    const originalCi = process.env.CI;
    try {
      process.env.ARCHON_SKIP_OPA = '1';
      process.env.CI = 'true';
      const report = await validateContextOrchestrator({ cwd: repoRoot });
      const policyCheck = report.checks.find(check => check.id === 'aco-policy');
      expect(report.status).toBe('failed');
      expect(policyCheck?.status).toBe('failed');
      expect(policyCheck?.message).toContain('forbidden');
    } finally {
      if (originalSkip === undefined) {
        delete process.env.ARCHON_SKIP_OPA;
      } else {
        process.env.ARCHON_SKIP_OPA = originalSkip;
      }
      if (originalCi === undefined) {
        delete process.env.CI;
      } else {
        process.env.CI = originalCi;
      }
    }
  });

  test('fails aggregate validation when a selected acceptance surface returns to placeholder text', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'aco-acceptance-placeholder-'));
    await mkdir(join(cwd, 'docs/context-orchestrator/specs'), { recursive: true });
    await mkdir(join(cwd, 'docs/context-orchestrator/research'), { recursive: true });
    await mkdir(join(cwd, 'tests/acceptance/context-orchestrator'), { recursive: true });
    await writeFile(
      join(cwd, 'docs/context-orchestrator/specs/000-product-charter.md'),
      '# Charter\n',
      'utf8'
    );
    await writeFile(
      join(cwd, 'docs/context-orchestrator/research/upstream-manifest.json'),
      '{}\n',
      'utf8'
    );
    await writeFile(
      join(cwd, 'package.json'),
      `${JSON.stringify({
        scripts: {
          'research:bootstrap': 'true',
          'research:update-upstreams': 'true',
          'research:graph': 'true',
          'research:merge-graphs': 'true',
          'research:validate-corpus': 'true',
          'aco:context-intake': 'true',
          'aco:completion-preconditions': 'true',
          'aco:target-intent': 'true',
          'aco:goal-bound-evidence': 'true',
          'aco:gates:test': 'true',
          'aco:policy:test': 'true',
          'aco:policy:fixtures': 'true',
          'aco:policy': 'true',
          'aco:traceability': 'true',
          'aco:test:acceptance': 'true',
        },
      })}\n`,
      'utf8'
    );
    await writeFile(
      join(cwd, 'tests/acceptance/context-orchestrator/api.acceptance.test.ts'),
      "import { test } from 'bun:test';\ntest.todo('AC-P1-API placeholder');\n",
      'utf8'
    );
    await writeFile(
      join(cwd, 'tests/acceptance/context-orchestrator/command.acceptance.test.ts'),
      "import { test } from 'bun:test';\ntest('AC-P1-SLASH executable', () => {});\n",
      'utf8'
    );
    await writeFile(
      join(cwd, 'tests/acceptance/context-orchestrator/workflow.acceptance.test.ts'),
      "import { test } from 'bun:test';\ntest('AC-P3-WF executable', () => {});\n",
      'utf8'
    );
    await writeFile(
      join(cwd, 'tests/acceptance/context-orchestrator/events.acceptance.test.ts'),
      "import { test } from 'bun:test';\ntest('ACO-EVENTS-001 executable', () => {});\n",
      'utf8'
    );
    await writeFile(
      join(cwd, 'tests/acceptance/context-orchestrator/traceability.acceptance.test.ts'),
      "import { test } from 'bun:test';\ntest('ACO-TRACE-001 ACO-TRACE-002 ACO-TRACE-003 executable', () => {});\n",
      'utf8'
    );

    const originalSkip = process.env.ARCHON_SKIP_OPA;
    try {
      process.env.ARCHON_SKIP_OPA = '1';
      const report = await validateContextOrchestrator({ cwd });
      const acceptanceCheck = report.checks.find(check => check.id === 'aco-acceptance');
      expect(report.status).toBe('failed');
      expect(acceptanceCheck?.status).toBe('failed');
      expect(acceptanceCheck?.message).toContain('AC-P1-API API');
      expect(acceptanceCheck?.message).toContain('still uses test.todo');
    } finally {
      if (originalSkip === undefined) {
        delete process.env.ARCHON_SKIP_OPA;
      } else {
        process.env.ARCHON_SKIP_OPA = originalSkip;
      }
    }
  });

  test('ACO-POLICY-DECISION-002 writes policy decision artifact for denied policy inputs', async () => {
    const archivePath = await mkdtemp(join(tmpdir(), 'aco-policy-deny-'));
    const policyDecisionPath = join(archivePath, 'policy-decision.json');
    await writeArchivedPolicyDecision({
      archivePath,
      inputPath: join(
        repoRoot,
        'packages/context-orchestrator/policies/prompt-package/fixtures/invalid-missing-acceptance.json'
      ),
      outputPath: policyDecisionPath,
    });

    const decision = JSON.parse(await readFile(policyDecisionPath, 'utf8')) as {
      decision: { allow: boolean; deny: { code: string }[] };
      codes: { deny: string[] };
    };
    expect(decision.decision.allow).toBe(false);
    expect(decision.codes.deny).toContain('ACO_POLICY_MISSING_ACCEPTANCE_EVIDENCE');
  });

  test('ACO-POLICY-DECISION-003 does not write policy decision artifact when OPA is unavailable', async () => {
    const archiveRoot = await mkdtemp(join(tmpdir(), 'aco-policy-missing-opa-'));
    const originalPath = process.env.PATH;
    try {
      process.env.PATH = '';
      await expect(
        compilePromptPackage({
          cwd: process.cwd(),
          prompt: 'Compile safely.',
          archiveRoot,
          runId: 'aco-missing-opa',
          timestamp: '2026-05-17T12:00:00.000Z',
        })
      ).rejects.toThrow('Open Policy Agent CLI `opa` is required');
    } finally {
      if (originalPath === undefined) {
        delete process.env.PATH;
      } else {
        process.env.PATH = originalPath;
      }
    }

    expect(
      await Bun.file(join(archiveRoot, 'aco-missing-opa', 'policy-decision.json')).exists()
    ).toBe(false);
  });

  test('policy decision output is deterministic and hash-backed', async () => {
    const fixturePath = join(
      repoRoot,
      'packages/context-orchestrator/policies/prompt-package/fixtures/warn-unresolved-docs.json'
    );
    const first = await createArchivedPolicyDecision({ inputPath: fixturePath });
    const second = await createArchivedPolicyDecision({ inputPath: fixturePath });

    expect(stringifyArchivedPolicyDecision(first)).toBe(stringifyArchivedPolicyDecision(second));
    expect(first.input.sha256).toHaveLength(64);
    expect(first.policy.sha256).toHaveLength(64);
    expect(first.codes.warn).toEqual(['ACO_POLICY_UNRESOLVED_DOCS']);
    expect(first.counts.warn).toBe(1);
  });

  test('policy decision suppresses duplicate findings deterministically', async () => {
    const policyDir = await mkdtemp(join(tmpdir(), 'aco-policy-duplicates-'));
    const inputPath = join(
      repoRoot,
      'packages/context-orchestrator/policies/prompt-package/fixtures/valid-minimal.json'
    );
    await writeFile(
      join(policyDir, 'prompt_package.rego'),
      [
        'package archon.context_orchestrator.prompt_package',
        'decision := {',
        '  "allow": true,',
        '  "deny": [],',
        '  "warn": [',
        '    {"code": "ACO_POLICY_UNRESOLVED_DOCS", "message": "duplicate", "path": "/evidence/docs", "severity": "warn"},',
        '    {"code": "ACO_POLICY_UNRESOLVED_DOCS", "message": "duplicate", "path": "/evidence/docs", "severity": "warn"}',
        '  ],',
        '  "policy_version": "duplicate-test"',
        '}',
      ].join('\n'),
      'utf8'
    );

    const decision = await createArchivedPolicyDecision({ inputPath, policyDir });
    expect(decision.counts.warn).toBe(1);
    expect(decision.duplicates_suppressed).toBe(1);
  });

  test('policy decision hashes change with input and policy bytes', async () => {
    const policyDir = await mkdtemp(join(tmpdir(), 'aco-policy-hash-'));
    const inputDir = await mkdtemp(join(tmpdir(), 'aco-input-hash-'));
    const inputPath = join(inputDir, 'prompt-package.json');
    const baseInput = await readFile(
      join(
        repoRoot,
        'packages/context-orchestrator/policies/prompt-package/fixtures/valid-minimal.json'
      ),
      'utf8'
    );
    await writeFile(inputPath, baseInput, 'utf8');
    const policyPath = join(policyDir, 'prompt_package.rego');
    const policy = [
      'package archon.context_orchestrator.prompt_package',
      'decision := {"allow": true, "deny": [], "warn": [], "policy_version": "hash-test"}',
    ].join('\n');
    await writeFile(policyPath, policy, 'utf8');

    const first = await createArchivedPolicyDecision({ inputPath, policyDir });
    await writeFile(inputPath, baseInput.replace('aco-policy-valid', 'aco-policy-valid-2'), 'utf8');
    const changedInput = await createArchivedPolicyDecision({ inputPath, policyDir });
    await writeFile(
      policyPath,
      `${policy}\n# policy hash change without decision behavior change\n`,
      'utf8'
    );
    const changedPolicy = await createArchivedPolicyDecision({ inputPath, policyDir });

    expect(changedInput.input.sha256).not.toBe(first.input.sha256);
    expect(changedInput.policy.sha256).toBe(first.policy.sha256);
    expect(changedPolicy.policy.sha256).not.toBe(changedInput.policy.sha256);
  });

  test('ACO-POLICY-DECISION-003 malformed OPA output does not produce an archived policy decision', async () => {
    const policyDir = await mkdtemp(join(tmpdir(), 'aco-policy-malformed-'));
    const inputPath = join(
      repoRoot,
      'packages/context-orchestrator/policies/prompt-package/fixtures/valid-minimal.json'
    );
    await writeFile(
      join(policyDir, 'prompt_package.rego'),
      [
        'package archon.context_orchestrator.prompt_package',
        'decision := {"allow": true, "deny": [], "warn": []}',
      ].join('\n'),
      'utf8'
    );

    await expect(createArchivedPolicyDecision({ inputPath, policyDir })).rejects.toThrow(
      'missing policy_version'
    );
    await rm(policyDir, { recursive: true, force: true });
  });
});

function expectCurrentCompileNextDecisionKind(
  nextDecision: { kind?: string; evidenceBlockerIds?: string[] } | undefined
): void {
  expect(nextDecision).toBeDefined();
  if ((nextDecision?.evidenceBlockerIds ?? []).length > 0) {
    expect(['blocked_by_evidence', 'blocked_by_validation']).toContain(nextDecision?.kind);
    return;
  }
  expect(['approval_required', 'blocked_by_validation']).toContain(nextDecision?.kind);
}

async function writeValidationFixture(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'aco-validation-cwd-'));
  await mkdir(join(cwd, 'docs/context-orchestrator/specs'), { recursive: true });
  await mkdir(join(cwd, 'docs/context-orchestrator/research'), { recursive: true });
  await mkdir(join(cwd, 'tests/acceptance/context-orchestrator'), { recursive: true });

  await writeFile(join(cwd, 'docs/context-orchestrator/specs/000-product-charter.md'), '# ACO\n');
  await writeFile(
    join(cwd, 'docs/context-orchestrator/research/upstream-manifest.json'),
    '{"repositories":[]}\n'
  );
  await writeFile(
    join(cwd, 'package.json'),
    `${JSON.stringify({
      scripts: {
        'research:bootstrap': 'bun --version',
        'research:update-upstreams': 'bun --version',
        'research:graph': 'bun --version',
        'research:merge-graphs': 'bun --version',
        'research:validate-corpus': 'bun --version',
        'aco:context-intake': 'bun --version',
        'aco:completion-preconditions': 'bun --version',
        'aco:target-intent': 'bun --version',
        'aco:goal-bound-evidence': 'bun --version',
        'aco:gates:test': 'bun --version',
        'aco:policy:test': 'bun --version',
        'aco:policy:fixtures': 'bun --version',
        'aco:policy': 'bun --version',
        'aco:traceability': 'bun --version',
        'aco:test:acceptance': 'bun --version',
      },
    })}\n`
  );

  await writeValidationAcceptanceSurface(cwd, 'api.acceptance.test.ts', 'AC-P1-API');
  await writeValidationAcceptanceSurface(cwd, 'command.acceptance.test.ts', 'AC-P1-SLASH');
  await writeValidationAcceptanceSurface(cwd, 'workflow.acceptance.test.ts', 'AC-P3-WF');
  await writeValidationAcceptanceSurface(cwd, 'events.acceptance.test.ts', 'ACO-EVENTS-001');
  await writeValidationAcceptanceSurface(
    cwd,
    'traceability.acceptance.test.ts',
    'ACO-TRACE-001 ACO-TRACE-002 ACO-TRACE-003'
  );

  return cwd;
}

async function writeValidationAcceptanceSurface(
  cwd: string,
  file: string,
  marker: string
): Promise<void> {
  await writeFile(
    join(cwd, 'tests/acceptance/context-orchestrator', file),
    `import { test } from 'bun:test';\ntest('${marker} fixture', () => {});\n`
  );
}
