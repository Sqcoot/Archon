import { afterEach, describe, expect, test } from 'bun:test';
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { runCodexHookBootloaderPreflight } from './hooks-preflight';

const tempRoots: string[] = [];
const originalHome = process.env.HOME;

afterEach(async () => {
  if (originalHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = originalHome;
  }
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe('runCodexHookBootloaderPreflight', () => {
  test('writes a standalone artifact policy that matches the bootloader report', async () => {
    const cwd = await makeTempRoot('codex-hooks-cwd-');
    const home = await makeTempRoot('codex-hooks-home-');
    const artifactRoot = join(cwd, '.archon', 'artifacts', 'run-1', 'codex-hooks-preflight');
    process.env.HOME = home;

    const result = await runCodexHookBootloaderPreflight({
      cwd,
      approvalPolicy: 'never',
      artifactRoot,
      configuredBinaryPath: join(cwd, 'missing-codex-binary'),
    });

    const realArtifactRoot = await realpath(artifactRoot);
    expect(result.artifactPaths.artifactPolicy).toBe(
      resolve(realArtifactRoot, 'codex-hook-artifact-policy.json')
    );
    expect(result.artifactPaths.manifest).toBe(
      resolve(realArtifactRoot, 'codex-hook-artifacts-manifest.json')
    );

    const report = JSON.parse(await readFile(result.artifactPaths.report, 'utf8')) as {
      artifactPolicy?: { artifactRoot?: string; restrictions?: string[] };
      artifactPaths?: { artifactPolicy?: string };
      providerHookCapabilities?: {
        workflowNodeHooks?: string;
        runtimeConfigHooks?: string;
        hookInventoryObservable?: boolean;
        hookTrustObservable?: boolean;
        hookEventStreaming?: boolean;
      };
    };
    const policy = JSON.parse(await readFile(result.artifactPaths.artifactPolicy, 'utf8')) as {
      artifactRoot?: string;
      source?: string;
      restrictions?: string[];
    };

    expect(report.artifactPaths?.artifactPolicy).toBe(result.artifactPaths.artifactPolicy);
    expect(report.artifactPolicy?.artifactRoot).toBe(policy.artifactRoot);
    expect(report.providerHookCapabilities).toMatchObject({
      workflowNodeHooks: 'unsupported',
      runtimeConfigHooks: 'possible',
      hookInventoryObservable: true,
      hookTrustObservable: true,
      hookEventStreaming: false,
    });
    expect(policy.source).toBe('explicit:artifact-root');
    expect(policy.restrictions).toContain(
      'artifact writes are scoped run artifacts, not checkout mutations'
    );

    const inventory = JSON.parse(await readFile(result.artifactPaths.inventory, 'utf8')) as {
      kind?: string;
      schemaVersion?: string;
      generatedAt?: string;
      providerHookCapabilities?: { workflowNodeHooks?: string; runtimeConfigHooks?: string };
    };
    expect(inventory.kind).toBe('codex-hooks-inventory');
    expect(inventory.schemaVersion).toBe('archon.codex-hooks.inventory.v1');
    expect(inventory.generatedAt).toBe(result.report.generatedAt);
    expect(inventory.providerHookCapabilities).toMatchObject({
      workflowNodeHooks: 'unsupported',
      runtimeConfigHooks: 'possible',
    });

    const trustStatus = JSON.parse(await readFile(result.artifactPaths.trustStatus, 'utf8')) as {
      providerHookCapabilities?: { workflowNodeHooks?: string; runtimeConfigHooks?: string };
    };
    expect(trustStatus.providerHookCapabilities).toMatchObject({
      workflowNodeHooks: 'unsupported',
      runtimeConfigHooks: 'possible',
    });

    const contract = JSON.parse(await readFile(result.artifactPaths.contract, 'utf8')) as {
      kind?: string;
      schemaVersion?: string;
      generatedAt?: string;
    };
    expect(contract.kind).toBe('codex-hook-contract');
    expect(contract.schemaVersion).toBe('archon.codex-hooks.contract.v1');
    expect(contract.generatedAt).toBe(result.report.generatedAt);

    const permissionPolicy = JSON.parse(
      await readFile(result.artifactPaths.permissionRequestPolicy, 'utf8')
    ) as {
      providerHookCapabilities?: { workflowNodeHooks?: string; runtimeConfigHooks?: string };
    };
    expect(permissionPolicy.providerHookCapabilities).toMatchObject({
      workflowNodeHooks: 'unsupported',
      runtimeConfigHooks: 'possible',
    });

    const stopPolicy = JSON.parse(
      await readFile(result.artifactPaths.stopContinuationPolicy, 'utf8')
    ) as {
      providerHookCapabilities?: { workflowNodeHooks?: string; runtimeConfigHooks?: string };
    };
    expect(stopPolicy.providerHookCapabilities).toMatchObject({
      workflowNodeHooks: 'unsupported',
      runtimeConfigHooks: 'possible',
    });

    const stopMarkdown = await readFile(result.artifactPaths.stopContinuation, 'utf8');
    expect(stopMarkdown).toContain('Hook inventory observable: yes');
    expect(stopMarkdown).toContain('Hook trust observable: yes');

    const permissionMarkdown = await readFile(result.artifactPaths.permissionRequest, 'utf8');
    expect(permissionMarkdown).toContain('Hook inventory observable: yes');
    expect(permissionMarkdown).toContain('Hook trust observable: yes');

    const manifest = JSON.parse(await readFile(result.artifactPaths.manifest, 'utf8')) as {
      kind?: string;
      schemaVersion?: string;
      generatedAt?: string;
      providerHookCapabilities?: { workflowNodeHooks?: string; runtimeConfigHooks?: string };
      contractCompatibility?: {
        installedRuntimeContractStatus?: string;
        installedRuntimeContractIssue?: string | null;
        installedRuntimeContractCompatible?: boolean | 'unknown';
        installedHookEventCompatibility?: string;
        installedHookEventNames?: string[];
        installedHookEventCompatibilityIssues?: string[];
        declaredVsObserved?: {
          comparison?: string;
          certainty?: string;
          declared?: { source?: string; supportedEventCount?: number };
          observed?: {
            schemaFingerprintCount?: number;
            installedHookEventCompatibility?: string;
            installedRuntimeContractCompatible?: boolean | 'unknown';
          };
          explicitStatus?: string;
        };
      };
      requiredArtifacts?: Record<string, { relativePath?: string; digestStatus?: string }>;
      files?: { relativePath?: string; digestStatus?: string }[];
    };
    expect(manifest.kind).toBe('codex-hook-artifacts-manifest');
    expect(manifest.schemaVersion).toBe('archon.codex-hooks.artifacts-manifest.v1');
    expect(manifest.generatedAt).toBe(result.report.generatedAt);
    expect(manifest.providerHookCapabilities).toMatchObject({
      workflowNodeHooks: 'unsupported',
      runtimeConfigHooks: 'possible',
    });
    expect(manifest.contractCompatibility).toMatchObject({
      installedRuntimeContractStatus: 'embedded-docs-only',
      installedRuntimeContractCompatible: 'unknown',
      installedHookEventCompatibility: 'unavailable',
      installedHookEventNames: [],
      installedHookEventCompatibilityIssues: [],
    });
    expect(manifest.contractCompatibility?.installedRuntimeContractIssue).toContain(
      'Installed Codex hook schema/source files were not fingerprinted'
    );
    expect(manifest.contractCompatibility?.declaredVsObserved).toMatchObject({
      comparison: 'declared-only',
      certainty: 'unknown',
      declared: {
        source: 'embedded-context7-official-docs',
        supportedEventCount: 10,
      },
      observed: {
        schemaFingerprintCount: 0,
        installedHookEventCompatibility: 'unavailable',
        installedRuntimeContractCompatible: 'unknown',
      },
    });
    expect(manifest.contractCompatibility?.declaredVsObserved?.explicitStatus).toContain(
      'not fingerprinted'
    );
    const requiredArtifactPaths = [
      'codex-hook-bootloader-report.json',
      'codex-hooks-inventory.json',
      'codex-hook-coverage.md',
      'codex-hook-trust-status.md',
      'codex-hook-trust-status.json',
      'codex-hook-artifact-policy.json',
      'codex-stop-continuation-policy.md',
      'codex-stop-continuation-policy.json',
      'codex-hook-contract.json',
      'codex-hook-contract-evidence.md',
      'codex-permission-request-policy.md',
      'codex-permission-request-policy.json',
      'codex-hook-bad-behaviour-lint.json',
      'codex-hook-artifacts-manifest.json',
    ];
    expect(
      Object.values(manifest.requiredArtifacts ?? {})
        .map(file => file.relativePath)
        .sort()
    ).toEqual([...requiredArtifactPaths].sort());
    expect(manifest.files?.map(file => file.relativePath).sort()).toEqual(
      [...requiredArtifactPaths].sort()
    );
    expect(manifest.requiredArtifacts?.artifactPolicy?.relativePath).toBe(
      'codex-hook-artifact-policy.json'
    );
    expect(manifest.requiredArtifacts?.manifest?.relativePath).toBe(
      'codex-hook-artifacts-manifest.json'
    );
    expect(manifest.requiredArtifacts?.manifest?.digestStatus).toContain('self-referential');
    expect(
      manifest.files?.some(
        file =>
          file.relativePath === 'codex-hook-artifacts-manifest.json' &&
          file.digestStatus?.includes('self-referential')
      )
    ).toBe(true);

    const badBehaviourLint = JSON.parse(
      await readFile(result.artifactPaths.badBehaviourLint, 'utf8')
    ) as {
      summary?: {
        byPattern?: Record<string, number>;
        byClassification?: Record<string, number>;
      };
    };
    expect(badBehaviourLint.summary?.byPattern?.deferred_behavior).toBeGreaterThanOrEqual(1);
    expect(badBehaviourLint.summary?.byPattern?.unsupported_ignored).toBeGreaterThanOrEqual(1);
    expect(badBehaviourLint.summary?.byClassification?.['warning-only']).toBeGreaterThanOrEqual(1);

    const manifestWithLint = JSON.parse(await readFile(result.artifactPaths.manifest, 'utf8')) as {
      badBehaviourLintSummary?: {
        byPattern?: Record<string, number>;
        byClassification?: Record<string, number>;
      };
    };
    expect(
      manifestWithLint.badBehaviourLintSummary?.byPattern?.deferred_behavior
    ).toBeGreaterThanOrEqual(1);
    expect(
      manifestWithLint.badBehaviourLintSummary?.byPattern?.unsupported_ignored
    ).toBeGreaterThanOrEqual(1);
  });

  test('labels default hook preflight artifact roots distinctly from explicit roots', async () => {
    const cwd = await makeTempRoot('codex-hooks-cwd-');
    const home = await makeTempRoot('codex-hooks-home-');
    process.env.HOME = home;

    const result = await runCodexHookBootloaderPreflight({
      cwd,
      approvalPolicy: 'never',
      configuredBinaryPath: join(cwd, 'missing-codex-binary'),
    });

    const policy = JSON.parse(await readFile(result.artifactPaths.artifactPolicy, 'utf8')) as {
      artifactRoot?: string;
      source?: string;
    };

    expect(policy.source).toBe('default:codex-hooks-preflight');
    expect(policy.artifactRoot).toContain('.archon');
    expect(policy.artifactRoot).toContain('codex-hooks-preflight');
  });

  test('warns instead of blocking when hook inventory is empty and workflow does not rely on hooks', async () => {
    const cwd = await makeTempRoot('codex-hooks-cwd-');
    const home = await makeTempRoot('codex-hooks-home-');
    const artifactRoot = join(cwd, '.archon', 'artifacts', 'run-1', 'codex-hooks-preflight');
    process.env.HOME = home;

    const result = await runCodexHookBootloaderPreflight({
      cwd,
      approvalPolicy: 'never',
      artifactRoot,
      configuredBinaryPath: join(cwd, 'missing-codex-binary'),
    });

    expect(result.report.decision).toBe('warn');
    expect(result.report.workflowNodeHooks.present).toBe(false);
    expect(result.report.coverage.inventoriedHookHandlers).toBe(0);
    expect(result.report.coverage.enforcedHookHandlers).toBe(0);
    expect(result.report.warnings).toContain(
      'Codex hook inventory is unknown or empty; workflow does not declare hooks.'
    );
    expect(result.report.reasons).not.toContain(
      'Codex hooks are disabled by config while hooks are configured or workflow hooks are declared.'
    );

    const badBehaviourLint = JSON.parse(
      await readFile(result.artifactPaths.badBehaviourLint, 'utf8')
    ) as {
      summary?: {
        byPattern?: Record<string, number>;
        byClassification?: Record<string, number>;
      };
    };
    expect(badBehaviourLint.summary?.byPattern?.missing_control).toBeGreaterThanOrEqual(1);
    expect(badBehaviourLint.summary?.byClassification?.['warning-only']).toBeGreaterThanOrEqual(1);
  });

  test('blocks workflow YAML hooks that reach the Codex provider', async () => {
    const cwd = await makeTempRoot('codex-hooks-cwd-');
    const home = await makeTempRoot('codex-hooks-home-');
    const artifactRoot = join(cwd, '.archon', 'artifacts', 'run-1', 'codex-hooks-preflight');
    process.env.HOME = home;

    const result = await runCodexHookBootloaderPreflight({
      cwd,
      approvalPolicy: 'never',
      artifactRoot,
      configuredBinaryPath: join(cwd, 'missing-codex-binary'),
      nodeConfig: {
        hooks: {
          PostToolUse: [
            {
              matcher: 'Write',
              response: {
                systemMessage: 'Remember to summarize output.',
              },
            },
          ],
        },
      },
    });

    expect(result.report.decision).toBe('block');
    expect(result.report.workflowNodeHooks.present).toBe(true);
    expect(result.report.reasons).toContain(
      'Archon workflow YAML hooks are not mapped into Codex runtime hooks; remove workflow hooks or use provider-native runtime hooks covered by the Codex hook bootloader.'
    );
  });

  test('blocks sensitive hooks excluded by managed-only policy', async () => {
    const cwd = await makeTempRoot('codex-hooks-cwd-');
    const home = await makeTempRoot('codex-hooks-home-');
    const codexHome = join(home, '.codex');
    const artifactRoot = join(cwd, '.archon', 'artifacts', 'run-1', 'codex-hooks-preflight');
    process.env.HOME = home;
    await mkdir(codexHome, { recursive: true });
    await writeFile(
      join(codexHome, 'requirements.toml'),
      'allow_managed_hooks_only = true\n',
      'utf8'
    );
    await writeFile(
      join(codexHome, 'hooks.json'),
      JSON.stringify(
        {
          hooks: {
            PermissionRequest: [
              {
                matcher: 'Bash',
                hooks: [
                  {
                    type: 'command',
                    command: 'python3 ~/.codex/hooks/permission_request.py',
                  },
                ],
              },
            ],
            Stop: [
              {
                hooks: [
                  {
                    type: 'command',
                    command: 'python3 ~/.codex/hooks/stop_continue.py',
                  },
                ],
              },
            ],
          },
        },
        null,
        2
      ),
      'utf8'
    );

    const result = await runCodexHookBootloaderPreflight({
      cwd,
      approvalPolicy: 'never',
      artifactRoot,
      configuredBinaryPath: join(cwd, 'missing-codex-binary'),
    });

    expect(result.report.coverage.allowManagedHooksOnly).toBe(true);
    expect(result.report.coverage.excludedHookHandlers).toBe(2);
    expect(result.report.coverage.excludedSensitiveHookHandlers).toBe(2);
    expect(result.report.coverage.excludedContinuationHookHandlers).toBe(1);
    expect(result.report.coverage.excludedPermissionRequestHookHandlers).toBe(1);
    expect(result.report.decision).toBe('block');
    expect(result.report.reasons).toContain(
      '2 non-managed safety/privacy hook handler(s) are excluded by allow_managed_hooks_only=true and will not run.'
    );

    const inventory = JSON.parse(await readFile(result.artifactPaths.inventory, 'utf8')) as {
      enforcement?: {
        excludedSensitiveHookHandlers?: number;
        excludedContinuationHookHandlers?: number;
        excludedPermissionRequestHookHandlers?: number;
      };
    };
    expect(inventory.enforcement?.excludedSensitiveHookHandlers).toBe(2);
    expect(inventory.enforcement?.excludedContinuationHookHandlers).toBe(1);
    expect(inventory.enforcement?.excludedPermissionRequestHookHandlers).toBe(1);

    const trustStatus = JSON.parse(await readFile(result.artifactPaths.trustStatus, 'utf8')) as {
      coverage?: {
        excludedSensitiveHookHandlers?: number;
        excludedContinuationHookHandlers?: number;
        excludedPermissionRequestHookHandlers?: number;
      };
    };
    expect(trustStatus.coverage?.excludedSensitiveHookHandlers).toBe(2);
    expect(trustStatus.coverage?.excludedContinuationHookHandlers).toBe(1);
    expect(trustStatus.coverage?.excludedPermissionRequestHookHandlers).toBe(1);
  });

  test('inventories managed requirements hooks as trusted policy hooks', async () => {
    const cwd = await makeTempRoot('codex-hooks-cwd-');
    const home = await makeTempRoot('codex-hooks-home-');
    const codexHome = join(home, '.codex');
    const managedDir = join(home, 'enterprise-hooks');
    const managedHookCommand = join(managedDir, 'pre_tool_use_policy.py');
    const artifactRoot = join(cwd, '.archon', 'artifacts', 'run-1', 'codex-hooks-preflight');
    process.env.HOME = home;
    await mkdir(codexHome, { recursive: true });
    await mkdir(managedDir, { recursive: true });
    await writeFile(managedHookCommand, '#!/usr/bin/env python3\n', 'utf8');
    await chmod(managedHookCommand, 0o755);
    await writeFile(
      join(codexHome, 'requirements.toml'),
      [
        '[hooks]',
        `managed_dir = "${managedDir}"`,
        '',
        '[[hooks.PreToolUse]]',
        'matcher = "^Bash$"',
        '',
        '[[hooks.PreToolUse.hooks]]',
        'type = "command"',
        `command = "${managedHookCommand}"`,
        'timeout = 30',
        '',
      ].join('\n'),
      'utf8'
    );

    const result = await runCodexHookBootloaderPreflight({
      cwd,
      approvalPolicy: 'never',
      artifactRoot,
      configuredBinaryPath: join(cwd, 'missing-codex-binary'),
    });

    expect(result.report.decision).not.toBe('block');
    expect(result.report.trust.status).toBe('managed');
    expect(
      result.report.sources.some(
        source => source.kind === 'managed' && source.trusted === 'managed' && source.exists
      )
    ).toBe(true);
    expect(
      result.report.hooks.some(
        hook =>
          hook.event === 'PreToolUse' &&
          hook.command === managedHookCommand &&
          hook.timeoutSeconds === 30
      )
    ).toBe(true);
  });

  test('blocks managed safety hooks whose command is outside managed_dir', async () => {
    const cwd = await makeTempRoot('codex-hooks-cwd-');
    const home = await makeTempRoot('codex-hooks-home-');
    const codexHome = join(home, '.codex');
    const managedDir = join(home, 'enterprise-hooks');
    const outsideHookCommand = join(home, 'outside-hooks', 'pre_tool_use_policy.py');
    const artifactRoot = join(cwd, '.archon', 'artifacts', 'run-1', 'codex-hooks-preflight');
    process.env.HOME = home;
    await mkdir(codexHome, { recursive: true });
    await mkdir(managedDir, { recursive: true });
    await writeFile(
      join(codexHome, 'requirements.toml'),
      [
        '[hooks]',
        `managed_dir = "${managedDir}"`,
        '',
        '[[hooks.PreToolUse]]',
        'matcher = "^Bash$"',
        '',
        '[[hooks.PreToolUse.hooks]]',
        'type = "command"',
        `command = "${outsideHookCommand}"`,
        'timeout = 30',
        '',
      ].join('\n'),
      'utf8'
    );

    const result = await runCodexHookBootloaderPreflight({
      cwd,
      approvalPolicy: 'never',
      artifactRoot,
      configuredBinaryPath: join(cwd, 'missing-codex-binary'),
    });

    expect(result.report.decision).toBe('block');
    expect(
      result.report.hooks.some(hook =>
        hook.issues.some(issue => issue.includes('not anchored under hooks.managed_dir'))
      )
    ).toBe(true);
    expect(
      result.report.reasons.some(reason =>
        reason.includes('not anchored to managed hook directories')
      )
    ).toBe(true);
    expect(result.report.coverage.unsupportedSensitiveHookHandlers).toBe(1);

    const inventory = JSON.parse(await readFile(result.artifactPaths.inventory, 'utf8')) as {
      enforcement?: { unsupportedSensitiveHookHandlers?: number };
    };
    expect(inventory.enforcement?.unsupportedSensitiveHookHandlers).toBe(1);

    const trustStatus = JSON.parse(await readFile(result.artifactPaths.trustStatus, 'utf8')) as {
      coverage?: { unsupportedSensitiveHookHandlers?: number };
    };
    expect(trustStatus.coverage?.unsupportedSensitiveHookHandlers).toBe(1);

    const coverage = await readFile(result.artifactPaths.coverage, 'utf8');
    expect(coverage).toContain('Unsupported/skipped safety/privacy hook handlers: 1');
  });

  test('blocks managed safety hooks whose managed_dir command is a symlink escape', async () => {
    const cwd = await makeTempRoot('codex-hooks-cwd-');
    const home = await makeTempRoot('codex-hooks-home-');
    const codexHome = join(home, '.codex');
    const managedDir = join(home, 'enterprise-hooks');
    const outsideDir = join(home, 'outside-hooks');
    const outsideHookCommand = join(outsideDir, 'pre_tool_use_policy.py');
    const symlinkHookCommand = join(managedDir, 'pre_tool_use_policy.py');
    const artifactRoot = join(cwd, '.archon', 'artifacts', 'run-1', 'codex-hooks-preflight');
    process.env.HOME = home;
    await mkdir(codexHome, { recursive: true });
    await mkdir(managedDir, { recursive: true });
    await mkdir(outsideDir, { recursive: true });
    await writeFile(outsideHookCommand, '#!/usr/bin/env python3\n', 'utf8');
    await symlink(outsideHookCommand, symlinkHookCommand);
    await writeFile(
      join(codexHome, 'requirements.toml'),
      [
        '[hooks]',
        `managed_dir = "${managedDir}"`,
        '',
        '[[hooks.PreToolUse]]',
        'matcher = "^Bash$"',
        '',
        '[[hooks.PreToolUse.hooks]]',
        'type = "command"',
        `command = "${symlinkHookCommand}"`,
        'timeout = 30',
        '',
      ].join('\n'),
      'utf8'
    );

    const result = await runCodexHookBootloaderPreflight({
      cwd,
      approvalPolicy: 'never',
      artifactRoot,
      configuredBinaryPath: join(cwd, 'missing-codex-binary'),
    });

    expect(result.report.decision).toBe('block');
    expect(
      result.report.hooks.some(hook =>
        hook.issues.some(issue => issue.includes('anchor path is a symlink'))
      )
    ).toBe(true);
    expect(
      result.report.hooks.some(hook =>
        hook.issues.some(issue => issue.includes('realpath resolves outside hooks.managed_dir'))
      )
    ).toBe(true);
  });

  test('blocks managed safety hooks whose windows_managed_dir is relative', async () => {
    const cwd = await makeTempRoot('codex-hooks-cwd-');
    const home = await makeTempRoot('codex-hooks-home-');
    const codexHome = join(home, '.codex');
    const managedDir = join(home, 'enterprise-hooks');
    const managedHookCommand = join(managedDir, 'pre_tool_use_policy.py');
    const artifactRoot = join(cwd, '.archon', 'artifacts', 'run-1', 'codex-hooks-preflight');
    process.env.HOME = home;
    await mkdir(codexHome, { recursive: true });
    await mkdir(managedDir, { recursive: true });
    await writeFile(managedHookCommand, '#!/usr/bin/env python3\n', 'utf8');
    await chmod(managedHookCommand, 0o755);
    await writeFile(
      join(codexHome, 'requirements.toml'),
      [
        '[hooks]',
        `managed_dir = "${managedDir}"`,
        'windows_managed_dir = "relative-windows-hooks"',
        '',
        '[[hooks.PreToolUse]]',
        'matcher = "^Bash$"',
        '',
        '[[hooks.PreToolUse.hooks]]',
        'type = "command"',
        `command = "${managedHookCommand}"`,
        'command_windows = "relative-windows-hooks/pre_tool_use_policy.ps1"',
        'timeout = 30',
        '',
      ].join('\n'),
      'utf8'
    );

    const result = await runCodexHookBootloaderPreflight({
      cwd,
      approvalPolicy: 'never',
      artifactRoot,
      configuredBinaryPath: join(cwd, 'missing-codex-binary'),
    });

    expect(result.report.decision).toBe('block');
    expect(
      result.report.hooks.some(hook =>
        hook.issues.some(issue => issue.includes('hooks.windows_managed_dir is not absolute'))
      )
    ).toBe(true);
  });

  test('blocks matcher-ignored prompt hooks and fragile relative sensitive commands', async () => {
    const cwd = await makeTempRoot('codex-hooks-cwd-');
    const home = await makeTempRoot('codex-hooks-home-');
    const codexHome = join(home, '.codex');
    const artifactRoot = join(cwd, '.archon', 'artifacts', 'run-1', 'codex-hooks-preflight');
    process.env.HOME = home;
    await mkdir(codexHome, { recursive: true });
    await writeFile(
      join(codexHome, 'hooks.json'),
      JSON.stringify(
        {
          hooks: {
            UserPromptSubmit: [
              {
                matcher: 'Bash',
                hooks: [
                  {
                    type: 'command',
                    command: '/usr/bin/python3 /tmp/prompt_privacy.py',
                    timeout: 30,
                  },
                ],
              },
            ],
            PreToolUse: [
              {
                matcher: 'Bash',
                hooks: [
                  {
                    type: 'command',
                    command: 'python3 .codex/hooks/pre_tool_use_policy.py',
                    timeout: 30,
                  },
                ],
              },
            ],
          },
        },
        null,
        2
      ),
      'utf8'
    );

    const result = await runCodexHookBootloaderPreflight({
      cwd,
      approvalPolicy: 'never',
      artifactRoot,
      configuredBinaryPath: join(cwd, 'missing-codex-binary'),
    });

    expect(result.report.decision).toBe('block');
    expect(result.report.coverage.matcherIgnoredSensitiveHookHandlers).toBe(1);
    expect(result.report.coverage.fragileRelativeSensitiveHookHandlers).toBe(1);
    expect(result.report.reasons).toContain(
      '1 safety/privacy hook handler(s) declare matcher filters that Codex ignores for this event.'
    );
    expect(result.report.reasons).toContain(
      '1 safety/privacy repo-local hook command(s) use fragile relative paths; Codex runs hooks from the session cwd.'
    );

    const inventory = JSON.parse(await readFile(result.artifactPaths.inventory, 'utf8')) as {
      hooks?: { definitionSha256?: string }[];
      enforcement?: {
        matcherIgnoredSensitiveHookHandlers?: number;
        fragileRelativeSensitiveHookHandlers?: number;
      };
    };
    expect(inventory.hooks?.every(hook => /^[a-f0-9]{64}$/.test(hook.definitionSha256 ?? ''))).toBe(
      true
    );
    expect(inventory.enforcement?.matcherIgnoredSensitiveHookHandlers).toBe(1);
    expect(inventory.enforcement?.fragileRelativeSensitiveHookHandlers).toBe(1);
  });

  test('reports project-local hook source trust uncertainty', async () => {
    const cwd = await makeTempRoot('codex-hooks-cwd-');
    const home = await makeTempRoot('codex-hooks-home-');
    const projectCodex = join(cwd, '.codex');
    const artifactRoot = join(cwd, '.archon', 'artifacts', 'run-1', 'codex-hooks-preflight');
    process.env.HOME = home;
    await mkdir(projectCodex, { recursive: true });
    await writeFile(
      join(projectCodex, 'hooks.json'),
      JSON.stringify(
        {
          hooks: {
            SessionStart: [
              {
                hooks: [
                  {
                    type: 'command',
                    command: '/usr/bin/python3 /tmp/session_start.py',
                    timeout: 30,
                  },
                ],
              },
            ],
          },
        },
        null,
        2
      ),
      'utf8'
    );

    const result = await runCodexHookBootloaderPreflight({
      cwd,
      approvalPolicy: 'never',
      artifactRoot,
      configuredBinaryPath: join(cwd, 'missing-codex-binary'),
    });

    expect(result.report.trust.unknownProjectHookSources).toBe(1);
    expect(result.report.trust.unknownNonManagedHookSources).toBe(1);
    expect(result.report.trust.issues).toContain(
      '1 project-local hook source(s) exist, but Archon cannot observe whether Codex trusts the project .codex layer.'
    );
    expect(result.report.decision).toBe('warn');
    expect(result.report.warnings).toContain(
      '1 non-managed Codex hook source(s) have unobservable trust state; Archon will block safety/privacy handlers from these sources but treats non-safety inventory as diagnostic-only.'
    );

    const inventory = JSON.parse(await readFile(result.artifactPaths.inventory, 'utf8')) as {
      enforcement?: {
        unknownProjectHookSources?: number;
        unknownNonManagedHookSources?: number;
      };
    };
    expect(inventory.enforcement?.unknownProjectHookSources).toBe(1);
    expect(inventory.enforcement?.unknownNonManagedHookSources).toBe(1);
  });

  test('inventories plugin-bundled hooks and blocks unknown-trust safety hooks', async () => {
    const cwd = await makeTempRoot('codex-hooks-cwd-');
    const home = await makeTempRoot('codex-hooks-home-');
    const pluginHooks = join(home, '.codex', 'plugins', 'enabled', 'repo-policy', 'hooks');
    const artifactRoot = join(cwd, '.archon', 'artifacts', 'run-1', 'codex-hooks-preflight');
    process.env.HOME = home;
    await mkdir(pluginHooks, { recursive: true });
    await writeFile(
      join(pluginHooks, 'hooks.json'),
      JSON.stringify(
        {
          hooks: {
            PreToolUse: [
              {
                matcher: 'Bash',
                hooks: [
                  {
                    type: 'command',
                    command: '/usr/bin/python3 /tmp/plugin_pre_tool_policy.py',
                    timeout: 30,
                  },
                ],
              },
            ],
          },
        },
        null,
        2
      ),
      'utf8'
    );

    const result = await runCodexHookBootloaderPreflight({
      cwd,
      approvalPolicy: 'never',
      artifactRoot,
      configuredBinaryPath: join(cwd, 'missing-codex-binary'),
    });

    expect(result.report.decision).toBe('block');
    expect(result.report.sources.some(source => source.kind === 'plugin' && source.exists)).toBe(
      true
    );
    expect(result.report.hooks.some(hook => hook.event === 'PreToolUse')).toBe(true);
    expect(result.report.trust.unknownPluginHookSources).toBe(1);
    expect(result.report.trust.unknownNonManagedHookSources).toBe(1);
    expect(
      result.report.reasons.some(reason => reason.includes('Archon cannot prove they are trusted'))
    ).toBe(true);
  });

  test('marks plugin manifest inline hooks unsupported and blocks skipped safety hooks', async () => {
    const cwd = await makeTempRoot('codex-hooks-cwd-');
    const home = await makeTempRoot('codex-hooks-home-');
    const pluginManifestDir = join(
      home,
      '.codex',
      'plugins',
      'enabled',
      'manifest-policy',
      '.codex-plugin'
    );
    const artifactRoot = join(cwd, '.archon', 'artifacts', 'run-1', 'codex-hooks-preflight');
    process.env.HOME = home;
    await mkdir(pluginManifestDir, { recursive: true });
    await writeFile(
      join(pluginManifestDir, 'plugin.json'),
      JSON.stringify(
        {
          name: 'manifest-policy',
          hooks: [
            {
              hooks: {
                PreToolUse: [
                  {
                    matcher: 'Bash',
                    hooks: [
                      {
                        type: 'command',
                        command: '/usr/bin/python3 /tmp/manifest_plugin_pre_tool_policy.py',
                        timeout: 30,
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
        null,
        2
      ),
      'utf8'
    );

    const result = await runCodexHookBootloaderPreflight({
      cwd,
      approvalPolicy: 'never',
      artifactRoot,
      configuredBinaryPath: join(cwd, 'missing-codex-binary'),
    });

    expect(result.report.decision).toBe('block');
    expect(
      result.report.sources.some(
        source => source.kind === 'plugin' && source.format === 'plugin-manifest' && source.exists
      )
    ).toBe(true);
    expect(
      result.report.sources.some(source =>
        source.issues.some(issue => issue.includes("plugin manifest field 'hooks' is unsupported"))
      )
    ).toBe(true);
    expect(
      result.report.hooks.some(
        hook =>
          hook.event === 'PreToolUse' &&
          hook.issues.some(issue => issue.includes('skipped by Codex'))
      )
    ).toBe(true);
    expect(result.report.coverage.unsupportedSensitiveHookHandlers).toBe(1);
    expect(result.report.trust.unknownPluginHookSources).toBe(1);
    expect(result.report.trust.unknownNonManagedHookSources).toBe(1);
  });

  test('inventories plugin hooks json even when manifest declares unsupported hooks field', async () => {
    const cwd = await makeTempRoot('codex-hooks-cwd-');
    const home = await makeTempRoot('codex-hooks-home-');
    const pluginRoot = join(home, '.codex', 'plugins', 'enabled', 'bundled-policy');
    const pluginManifestDir = join(pluginRoot, '.codex-plugin');
    const artifactRoot = join(cwd, '.archon', 'artifacts', 'run-1', 'codex-hooks-preflight');
    process.env.HOME = home;
    await mkdir(pluginManifestDir, { recursive: true });
    await mkdir(join(pluginRoot, 'hooks'), { recursive: true });
    await writeFile(
      join(pluginManifestDir, 'plugin.json'),
      JSON.stringify(
        {
          name: 'bundled-policy',
          hooks: [],
        },
        null,
        2
      ),
      'utf8'
    );
    await writeFile(
      join(pluginRoot, 'hooks', 'hooks.json'),
      JSON.stringify(
        {
          hooks: {
            PreToolUse: [
              {
                matcher: 'Bash',
                hooks: [
                  {
                    type: 'command',
                    command: '/usr/bin/python3 /tmp/bundled_plugin_pre_tool_policy.py',
                    timeout: 30,
                  },
                ],
              },
            ],
          },
        },
        null,
        2
      ),
      'utf8'
    );

    const result = await runCodexHookBootloaderPreflight({
      cwd,
      approvalPolicy: 'never',
      artifactRoot,
      configuredBinaryPath: join(cwd, 'missing-codex-binary'),
    });

    expect(
      result.report.sources.some(source =>
        source.issues.some(issue => issue.includes("plugin manifest field 'hooks' is unsupported"))
      )
    ).toBe(true);
    expect(
      result.report.hooks.some(
        hook => hook.sourceId.startsWith('plugin-hooks-') && hook.event === 'PreToolUse'
      )
    ).toBe(true);
  });

  test('does not load plugin manifest hook paths that escape the plugin root', async () => {
    const cwd = await makeTempRoot('codex-hooks-cwd-');
    const home = await makeTempRoot('codex-hooks-home-');
    const pluginManifestDir = join(
      home,
      '.codex',
      'plugins',
      'enabled',
      'escape-policy',
      '.codex-plugin'
    );
    const artifactRoot = join(cwd, '.archon', 'artifacts', 'run-1', 'codex-hooks-preflight');
    process.env.HOME = home;
    await mkdir(pluginManifestDir, { recursive: true });
    await writeFile(
      join(pluginManifestDir, 'plugin.json'),
      JSON.stringify(
        {
          name: 'escape-policy',
          hooks: './../outside/hooks.json',
        },
        null,
        2
      ),
      'utf8'
    );

    const result = await runCodexHookBootloaderPreflight({
      cwd,
      approvalPolicy: 'never',
      artifactRoot,
      configuredBinaryPath: join(cwd, 'missing-codex-binary'),
    });

    expect(result.report.hooks).toHaveLength(0);
    expect(
      result.report.sources.some(source =>
        source.issues.some(issue => issue.includes('resolves outside plugin root'))
      )
    ).toBe(true);
  });

  test('does not load plugin manifest hook paths through symlinked plugin directories', async () => {
    const cwd = await makeTempRoot('codex-hooks-cwd-');
    const home = await makeTempRoot('codex-hooks-home-');
    const outside = await makeTempRoot('codex-hooks-outside-');
    const pluginRoot = join(home, '.codex', 'plugins', 'enabled', 'symlink-policy');
    const pluginManifestDir = join(pluginRoot, '.codex-plugin');
    const artifactRoot = join(cwd, '.archon', 'artifacts', 'run-1', 'codex-hooks-preflight');
    process.env.HOME = home;
    await mkdir(pluginManifestDir, { recursive: true });
    await mkdir(join(outside, 'hooks'), { recursive: true });
    await writeFile(
      join(outside, 'hooks', 'hooks.json'),
      JSON.stringify(
        {
          hooks: {
            PreToolUse: [
              {
                matcher: 'Bash',
                hooks: [
                  {
                    type: 'command',
                    command: '/usr/bin/python3 /tmp/outside_plugin_policy.py',
                    timeout: 30,
                  },
                ],
              },
            ],
          },
        },
        null,
        2
      ),
      'utf8'
    );
    await symlink(join(outside, 'hooks'), join(pluginRoot, 'linked-hooks'));
    await writeFile(
      join(pluginManifestDir, 'plugin.json'),
      JSON.stringify(
        {
          name: 'symlink-policy',
          hooks: './linked-hooks/hooks.json',
        },
        null,
        2
      ),
      'utf8'
    );

    const result = await runCodexHookBootloaderPreflight({
      cwd,
      approvalPolicy: 'never',
      artifactRoot,
      configuredBinaryPath: join(cwd, 'missing-codex-binary'),
    });

    expect(result.report.hooks).toHaveLength(0);
    expect(
      result.report.sources.some(source =>
        source.issues.some(issue => issue.includes('realpath resolves outside plugin root'))
      )
    ).toBe(true);
  });

  test('blocks overlapping safety hook matcher groups', async () => {
    const cwd = await makeTempRoot('codex-hooks-cwd-');
    const home = await makeTempRoot('codex-hooks-home-');
    const codexHome = join(home, '.codex');
    const artifactRoot = join(cwd, '.archon', 'artifacts', 'run-1', 'codex-hooks-preflight');
    process.env.HOME = home;
    await mkdir(codexHome, { recursive: true });
    await writeFile(
      join(codexHome, 'hooks.json'),
      JSON.stringify(
        {
          hooks: {
            PreToolUse: [
              {
                matcher: 'Bash',
                hooks: [
                  {
                    type: 'command',
                    command: '/usr/bin/python3 /tmp/pre_tool_policy_a.py',
                    timeout: 30,
                  },
                  {
                    type: 'command',
                    command: '/usr/bin/python3 /tmp/pre_tool_policy_b.py',
                    timeout: 30,
                  },
                ],
              },
            ],
          },
        },
        null,
        2
      ),
      'utf8'
    );

    const result = await runCodexHookBootloaderPreflight({
      cwd,
      approvalPolicy: 'never',
      artifactRoot,
      configuredBinaryPath: join(cwd, 'missing-codex-binary'),
    });

    expect(result.report.decision).toBe('block');
    expect(result.report.coverage.overlappingHookGroups).toHaveLength(1);
    expect(result.report.coverage.overlappingHookGroups[0]?.event).toBe('PreToolUse');
    expect(result.report.coverage.overlappingHookGroups[0]?.matcher).toBe('Bash');
    expect(result.report.coverage.overlappingHookGroups[0]?.sensitive).toBe(true);
    expect(result.report.reasons).toContain(
      '1 safety/privacy hook event/matcher group(s) overlap; one matching hook cannot prevent another matching hook from starting.'
    );

    const inventory = JSON.parse(await readFile(result.artifactPaths.inventory, 'utf8')) as {
      enforcement?: {
        overlappingHookGroups?: { event?: string; sensitive?: boolean }[];
      };
    };
    expect(inventory.enforcement?.overlappingHookGroups?.[0]?.event).toBe('PreToolUse');
    expect(inventory.enforcement?.overlappingHookGroups?.[0]?.sensitive).toBe(true);
  });

  test('blocks timeoutless PermissionRequest hooks', async () => {
    const cwd = await makeTempRoot('codex-hooks-cwd-');
    const home = await makeTempRoot('codex-hooks-home-');
    const codexHome = join(home, '.codex');
    const artifactRoot = join(cwd, '.archon', 'artifacts', 'run-1', 'codex-hooks-preflight');
    process.env.HOME = home;
    await mkdir(codexHome, { recursive: true });
    await writeFile(
      join(codexHome, 'hooks.json'),
      JSON.stringify(
        {
          hooks: {
            PermissionRequest: [
              {
                matcher: 'Bash',
                hooks: [
                  {
                    type: 'command',
                    command: '/usr/bin/python3 /tmp/permission_request.py',
                  },
                ],
              },
            ],
          },
        },
        null,
        2
      ),
      'utf8'
    );

    const result = await runCodexHookBootloaderPreflight({
      cwd,
      approvalPolicy: 'on-request',
      artifactRoot,
      configuredBinaryPath: join(cwd, 'missing-codex-binary'),
    });

    expect(result.report.decision).toBe('block');
    expect(result.report.permissionRequest.timeoutlessPermissionRequestHooks).toBe(1);
    expect(result.report.reasons).toContain(
      '1 PermissionRequest hook(s) omit timeout; Codex default is 600s.'
    );

    const badBehaviourLint = JSON.parse(
      await readFile(result.artifactPaths.badBehaviourLint, 'utf8')
    ) as {
      summary?: {
        byPattern?: Record<string, number>;
        byClassification?: Record<string, number>;
      };
    };
    expect(badBehaviourLint.summary?.byPattern?.unsupported_control).toBeGreaterThanOrEqual(1);
    expect(badBehaviourLint.summary?.byClassification?.bug).toBeGreaterThanOrEqual(1);

    const manifest = JSON.parse(await readFile(result.artifactPaths.manifest, 'utf8')) as {
      badBehaviourLintSummary?: {
        byPattern?: Record<string, number>;
        byClassification?: Record<string, number>;
      };
    };
    expect(manifest.badBehaviourLintSummary?.byPattern?.unsupported_control).toBeGreaterThanOrEqual(
      1
    );
    expect(manifest.badBehaviourLintSummary?.byClassification?.bug).toBeGreaterThanOrEqual(1);
  });

  test('blocks PermissionRequest-only safety hooks when approval prompts are disabled', async () => {
    const cwd = await makeTempRoot('codex-hooks-cwd-');
    const home = await makeTempRoot('codex-hooks-home-');
    const codexHome = join(home, '.codex');
    const artifactRoot = join(cwd, '.archon', 'artifacts', 'run-1', 'codex-hooks-preflight');
    process.env.HOME = home;
    await mkdir(codexHome, { recursive: true });
    await writeFile(
      join(codexHome, 'hooks.json'),
      JSON.stringify(
        {
          hooks: {
            PermissionRequest: [
              {
                matcher: 'Bash',
                hooks: [
                  {
                    type: 'command',
                    command: '/usr/bin/python3 /tmp/permission_request.py',
                    timeout: 30,
                  },
                ],
              },
            ],
          },
        },
        null,
        2
      ),
      'utf8'
    );

    const result = await runCodexHookBootloaderPreflight({
      cwd,
      approvalPolicy: 'never',
      artifactRoot,
      configuredBinaryPath: join(cwd, 'missing-codex-binary'),
    });

    expect(result.report.decision).toBe('block');
    expect(result.report.permissionRequest.permissionOnlyNoApprovalGap).toBe(true);
    expect(result.report.reasons).toContain(
      'PermissionRequest hooks are present without PreToolUse hooks while Codex approval policy disables prompts; PermissionRequest may not run.'
    );
  });

  test('marks PermissionRequest auto-approval unbounded when PreToolUse fallback is not bounded', async () => {
    const cwd = await makeTempRoot('codex-hooks-cwd-');
    const home = await makeTempRoot('codex-hooks-home-');
    const codexHome = join(home, '.codex');
    const artifactRoot = join(cwd, '.archon', 'artifacts', 'run-1', 'codex-hooks-preflight');
    process.env.HOME = home;
    await mkdir(codexHome, { recursive: true });
    await writeFile(
      join(codexHome, 'hooks.json'),
      JSON.stringify(
        {
          hooks: {
            PermissionRequest: [
              {
                matcher: 'Bash',
                hooks: [
                  {
                    type: 'command',
                    command: '/usr/bin/python3 /tmp/permission_request.py',
                    timeout: 30,
                  },
                ],
              },
            ],
            PreToolUse: [
              {
                matcher: 'Bash',
                hooks: [
                  {
                    type: 'command',
                    command: '/usr/bin/python3 /tmp/pre_tool_use.py',
                  },
                ],
              },
            ],
          },
        },
        null,
        2
      ),
      'utf8'
    );

    const result = await runCodexHookBootloaderPreflight({
      cwd,
      approvalPolicy: 'never',
      artifactRoot,
      configuredBinaryPath: join(cwd, 'missing-codex-binary'),
    });

    expect(result.report.decision).toBe('block');
    expect(result.report.permissionRequest.permissionOnlyNoApprovalGap).toBe(false);
    expect(result.report.permissionRequest.preToolUseHooks).toBe(1);
    expect(result.report.permissionRequest.preToolUseFallbackBounded).toBe(false);
    expect(result.report.permissionRequest.preToolUseFallbackIssues).toContain(
      '1 PreToolUse fallback hook(s) omit timeout.'
    );
    expect(result.report.permissionRequest.bounded).toBe(false);
    expect(result.report.permissionRequest.autoApprovalPolicy.boundedBy).toBe('pre-tool-use-hooks');
    expect(result.report.permissionRequest.autoApprovalPolicy.issue).toContain(
      'PreToolUse fallback exists but is not bounded'
    );
  });

  test('blocks overlong PermissionRequest hooks', async () => {
    const cwd = await makeTempRoot('codex-hooks-cwd-');
    const home = await makeTempRoot('codex-hooks-home-');
    const codexHome = join(home, '.codex');
    const artifactRoot = join(cwd, '.archon', 'artifacts', 'run-1', 'codex-hooks-preflight');
    process.env.HOME = home;
    await mkdir(codexHome, { recursive: true });
    await writeFile(
      join(codexHome, 'hooks.json'),
      JSON.stringify(
        {
          hooks: {
            PermissionRequest: [
              {
                matcher: 'Bash',
                hooks: [
                  {
                    type: 'command',
                    command: '/usr/bin/python3 /tmp/permission_request.py',
                    timeout: 1200,
                  },
                ],
              },
            ],
          },
        },
        null,
        2
      ),
      'utf8'
    );

    const result = await runCodexHookBootloaderPreflight({
      cwd,
      approvalPolicy: 'on-request',
      artifactRoot,
      configuredBinaryPath: join(cwd, 'missing-codex-binary'),
    });

    expect(result.report.decision).toBe('block');
    expect(result.report.permissionRequest.overlongPermissionRequestHooks).toBe(1);
    expect(result.report.permissionRequest.maxObservedTimeoutSeconds).toBe(1200);
    expect(
      result.report.reasons.some(reason => reason.includes('PermissionRequest hook(s) exceed'))
    ).toBe(true);
  });

  test('blocks disabled safety hooks', async () => {
    const cwd = await makeTempRoot('codex-hooks-cwd-');
    const home = await makeTempRoot('codex-hooks-home-');
    const codexHome = join(home, '.codex');
    const artifactRoot = join(cwd, '.archon', 'artifacts', 'run-1', 'codex-hooks-preflight');
    process.env.HOME = home;
    await mkdir(codexHome, { recursive: true });
    await writeFile(
      join(codexHome, 'hooks.json'),
      JSON.stringify(
        {
          hooks: {
            PreToolUse: [
              {
                matcher: 'Bash',
                hooks: [
                  {
                    type: 'command',
                    command: '/usr/bin/python3 /tmp/pre_tool_policy.py',
                    timeout: 30,
                    enabled: false,
                  },
                ],
              },
            ],
          },
        },
        null,
        2
      ),
      'utf8'
    );

    const result = await runCodexHookBootloaderPreflight({
      cwd,
      approvalPolicy: 'never',
      artifactRoot,
      configuredBinaryPath: join(cwd, 'missing-codex-binary'),
    });

    expect(result.report.decision).toBe('block');
    expect(result.report.coverage.disabledSensitiveHookHandlers).toBe(1);
    expect(result.report.reasons).toContain(
      '1 safety/privacy hook handler(s) are marked disabled and will not run.'
    );

    const inventory = JSON.parse(await readFile(result.artifactPaths.inventory, 'utf8')) as {
      enforcement?: { disabledSensitiveHookHandlers?: number };
    };
    expect(inventory.enforcement?.disabledSensitiveHookHandlers).toBe(1);
  });

  test('blocks configured hooks when the Codex hooks feature is disabled', async () => {
    const cwd = await makeTempRoot('codex-hooks-cwd-');
    const home = await makeTempRoot('codex-hooks-home-');
    const codexHome = join(home, '.codex');
    const artifactRoot = join(cwd, '.archon', 'artifacts', 'run-1', 'codex-hooks-preflight');
    process.env.HOME = home;
    await mkdir(codexHome, { recursive: true });
    await writeFile(join(codexHome, 'config.toml'), '[features]\nhooks = false\n', 'utf8');
    await writeFile(
      join(codexHome, 'hooks.json'),
      JSON.stringify(
        {
          hooks: {
            PreToolUse: [
              {
                matcher: 'Bash',
                hooks: [
                  {
                    type: 'command',
                    command: '/usr/bin/python3 /tmp/pre_tool_policy.py',
                    timeout: 30,
                  },
                ],
              },
            ],
          },
        },
        null,
        2
      ),
      'utf8'
    );

    const result = await runCodexHookBootloaderPreflight({
      cwd,
      approvalPolicy: 'never',
      artifactRoot,
      configuredBinaryPath: join(cwd, 'missing-codex-binary'),
    });

    expect(result.report.decision).toBe('block');
    expect(result.report.hooksFeatureEnabled).toBe(false);
    expect(result.report.coverage.inventoriedHookHandlers).toBe(1);
    expect(result.report.reasons).toContain(
      'Codex hooks are disabled by config while hooks are configured or workflow hooks are declared.'
    );
  });

  test('blocks Stop continuation hooks that rely on ignored matchers', async () => {
    const cwd = await makeTempRoot('codex-hooks-cwd-');
    const home = await makeTempRoot('codex-hooks-home-');
    const codexHome = join(home, '.codex');
    const artifactRoot = join(cwd, '.archon', 'artifacts', 'run-1', 'codex-hooks-preflight');
    process.env.HOME = home;
    await mkdir(codexHome, { recursive: true });
    await writeFile(
      join(codexHome, 'hooks.json'),
      JSON.stringify(
        {
          hooks: {
            Stop: [
              {
                matcher: 'manual-review',
                hooks: [
                  {
                    type: 'command',
                    command: '/usr/bin/python3 /tmp/stop_continue.py',
                    timeout: 30,
                  },
                ],
              },
            ],
          },
        },
        null,
        2
      ),
      'utf8'
    );

    const result = await runCodexHookBootloaderPreflight({
      cwd,
      approvalPolicy: 'never',
      artifactRoot,
      configuredBinaryPath: join(cwd, 'missing-codex-binary'),
    });

    expect(result.report.decision).toBe('block');
    expect(result.report.continuation.matcherIgnoredContinuationHooks).toBe(1);
    expect(result.report.continuation.issues).toContain(
      '1 Stop/SubagentStop continuation hook(s) declare matcher filters that Codex ignores for this event.'
    );
  });

  test('marks Stop continuation unbounded when continuation hook trust is unobservable', async () => {
    const cwd = await makeTempRoot('codex-hooks-cwd-');
    const home = await makeTempRoot('codex-hooks-home-');
    const codexHome = join(home, '.codex');
    const artifactRoot = join(cwd, '.archon', 'artifacts', 'run-1', 'codex-hooks-preflight');
    process.env.HOME = home;
    await mkdir(codexHome, { recursive: true });
    await writeFile(
      join(codexHome, 'hooks.json'),
      JSON.stringify(
        {
          hooks: {
            Stop: [
              {
                hooks: [
                  {
                    type: 'command',
                    command: '/usr/bin/python3 /tmp/stop_continue.py',
                    timeout: 10,
                  },
                ],
              },
            ],
          },
        },
        null,
        2
      ),
      'utf8'
    );

    const result = await runCodexHookBootloaderPreflight({
      cwd,
      approvalPolicy: 'never',
      artifactRoot,
      configuredBinaryPath: join(cwd, 'missing-codex-binary'),
    });

    expect(result.report.decision).toBe('block');
    expect(result.report.continuation.stopContinuationHooks).toBe(1);
    expect(result.report.continuation.bounded).toBe(false);
    expect(result.report.continuation.issues).toContain(
      '1 Stop/SubagentStop continuation hook(s) have unobservable trust status.'
    );
  });

  test('blocks overlong Stop continuation hooks', async () => {
    const cwd = await makeTempRoot('codex-hooks-cwd-');
    const home = await makeTempRoot('codex-hooks-home-');
    const codexHome = join(home, '.codex');
    const artifactRoot = join(cwd, '.archon', 'artifacts', 'run-1', 'codex-hooks-preflight');
    process.env.HOME = home;
    await mkdir(codexHome, { recursive: true });
    await writeFile(
      join(codexHome, 'hooks.json'),
      JSON.stringify(
        {
          hooks: {
            Stop: [
              {
                hooks: [
                  {
                    type: 'command',
                    command: '/usr/bin/python3 /tmp/stop_continue.py',
                    timeout: 1200,
                  },
                ],
              },
            ],
          },
        },
        null,
        2
      ),
      'utf8'
    );

    const result = await runCodexHookBootloaderPreflight({
      cwd,
      approvalPolicy: 'never',
      artifactRoot,
      configuredBinaryPath: join(cwd, 'missing-codex-binary'),
    });

    expect(result.report.decision).toBe('block');
    expect(result.report.continuation.maxObservedTimeoutSeconds).toBe(1200);
    expect(result.report.continuation.bounded).toBe(false);
    expect(
      result.report.continuation.issues.some(issue =>
        issue.includes('Stop/SubagentStop continuation hook(s) exceed')
      )
    ).toBe(true);
  });

  test('captures installed binary package schema fingerprints when available', async () => {
    const cwd = await makeTempRoot('codex-hooks-cwd-');
    const home = await makeTempRoot('codex-hooks-home-');
    const packageRoot = await makeTempRoot('codex-package-root-');
    const binDir = join(packageRoot, 'bin');
    const schemaDir = join(packageRoot, 'codex-rs', 'hooks', 'schema', 'generated');
    const managedHooksDir = join(
      packageRoot,
      'codex-rs',
      'app-server-protocol',
      'schema',
      'typescript',
      'v2'
    );
    const protocolDir = join(packageRoot, 'codex-rs', 'protocol', 'src');
    const binaryPath = join(binDir, 'codex');
    const artifactRoot = join(cwd, '.archon', 'artifacts', 'run-1', 'codex-hooks-preflight');
    process.env.HOME = home;
    await mkdir(binDir, { recursive: true });
    await mkdir(schemaDir, { recursive: true });
    await mkdir(managedHooksDir, { recursive: true });
    await mkdir(protocolDir, { recursive: true });
    await writeFile(
      join(packageRoot, 'package.json'),
      JSON.stringify({ name: '@openai/codex', version: '0.128.0' }),
      'utf8'
    );
    await writeFile(binaryPath, '#!/bin/sh\necho codex-cli 0.128.0\n', 'utf8');
    await chmod(binaryPath, 0o755);
    await writeFile(
      join(schemaDir, 'hooks.schema.json'),
      JSON.stringify({ title: 'Codex hook schema', type: 'object' }),
      'utf8'
    );
    await writeFile(
      join(managedHooksDir, 'ManagedHooksRequirements.ts'),
      'export type ManagedHooksRequirements = { PreToolUse?: unknown; PermissionRequest?: unknown; Stop?: unknown; managedDir?: string; windowsManagedDir?: string; };\n',
      'utf8'
    );
    await writeFile(
      join(protocolDir, 'protocol.rs'),
      'pub enum HookEventName { PreToolUse, PermissionRequest, PostToolUse, PreCompact, PostCompact, SessionStart, UserPromptSubmit, SubagentStart, SubagentStop, Stop }\n',
      'utf8'
    );

    const result = await runCodexHookBootloaderPreflight({
      cwd,
      approvalPolicy: 'never',
      artifactRoot,
      configuredBinaryPath: binaryPath,
    });

    expect(result.report.codexRuntime.binaryPackage?.root).toBe(await realpath(packageRoot));
    expect(result.report.hookContract.installedRuntimeEvidence.packageSchemasFound).toBe(true);
    expect(
      result.report.hookContract.installedRuntimeEvidence.packageSchemaFilesFound
    ).toBeGreaterThanOrEqual(1);
    expect(
      result.report.hookContract.installedRuntimeEvidence.packageSchemaFingerprints.some(item =>
        item.includes('hooks.schema.json')
      )
    ).toBe(true);
    expect(
      result.report.hookContract.installedRuntimeEvidence.packageSchemaFingerprints.some(item =>
        item.includes('ManagedHooksRequirements.ts')
      )
    ).toBe(true);
    expect(
      result.report.hookContract.installedRuntimeEvidence.packageSchemaFingerprints.some(item =>
        item.includes('protocol.rs')
      )
    ).toBe(true);
    expect(
      result.report.hookContract.installedRuntimeEvidence.installedHookEventCompatibility
    ).toBe('matched');
    expect(result.report.hookContract.installedRuntimeContractCompatible).toBe(true);
    expect(result.report.hookContract.installedHookEventCompatibility).toBe('matched');
    expect(result.report.hookContract.installedRuntimeEvidence.installedHookEventNames).toEqual([
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
    const manifest = JSON.parse(await readFile(result.artifactPaths.manifest, 'utf8')) as {
      contractCompatibility?: {
        installedRuntimeContractStatus?: string;
        installedRuntimeContractCompatible?: boolean | 'unknown';
        installedHookEventCompatibility?: string;
        installedHookEventNames?: string[];
        installedHookEventCompatibilityIssues?: string[];
        declaredVsObserved?: {
          comparison?: string;
          certainty?: string;
          observed?: { schemaFingerprintCount?: number; installedHookEventCompatibility?: string };
        };
      };
    };
    expect(manifest.contractCompatibility).toMatchObject({
      installedRuntimeContractStatus: 'schema-fingerprinted',
      installedRuntimeContractCompatible: true,
      installedHookEventCompatibility: 'matched',
      installedHookEventNames: [
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
      ],
      installedHookEventCompatibilityIssues: [],
    });
    expect(manifest.contractCompatibility?.declaredVsObserved).toMatchObject({
      comparison: 'declared-vs-observed-match',
      certainty: 'verified',
      observed: {
        installedHookEventCompatibility: 'matched',
      },
    });
    expect(
      manifest.contractCompatibility?.declaredVsObserved?.observed?.schemaFingerprintCount
    ).toBeGreaterThanOrEqual(1);
  });

  test('blocks when installed hook event source differs from embedded contract', async () => {
    const cwd = await makeTempRoot('codex-hooks-cwd-');
    const home = await makeTempRoot('codex-hooks-home-');
    const packageRoot = await makeTempRoot('codex-package-root-');
    const binDir = join(packageRoot, 'bin');
    const protocolDir = join(packageRoot, 'codex-rs', 'protocol', 'src');
    const binaryPath = join(binDir, 'codex');
    const artifactRoot = join(cwd, '.archon', 'artifacts', 'run-1', 'codex-hooks-preflight');
    process.env.HOME = home;
    await mkdir(binDir, { recursive: true });
    await mkdir(protocolDir, { recursive: true });
    await writeFile(
      join(packageRoot, 'package.json'),
      JSON.stringify({ name: '@openai/codex', version: '0.129.0' }),
      'utf8'
    );
    await writeFile(binaryPath, '#!/bin/sh\necho codex-cli 0.129.0\n', 'utf8');
    await chmod(binaryPath, 0o755);
    await writeFile(
      join(protocolDir, 'protocol.rs'),
      'pub enum HookEventName { PreToolUse, PermissionRequest, PostToolUse, PreCompact, PostCompact, SessionStart, UserPromptSubmit, SubagentStart, SubagentStop, Stop, NewRuntimeHook }\n',
      'utf8'
    );

    const result = await runCodexHookBootloaderPreflight({
      cwd,
      approvalPolicy: 'never',
      artifactRoot,
      configuredBinaryPath: binaryPath,
    });

    expect(result.report.decision).toBe('block');
    expect(
      result.report.hookContract.installedRuntimeEvidence.installedHookEventCompatibility
    ).toBe('mismatch');
    expect(result.report.hookContract.installedRuntimeContractCompatible).toBe(false);
    expect(result.report.hookContract.installedHookEventCompatibility).toBe('mismatch');
    expect(
      result.report.hookContract.installedRuntimeEvidence.installedHookEventCompatibilityIssues.some(
        issue => issue.includes('NewRuntimeHook')
      )
    ).toBe(true);
    expect(
      result.report.reasons.some(reason =>
        reason.includes('Installed Codex hook event contract differs')
      )
    ).toBe(true);
    const manifest = JSON.parse(await readFile(result.artifactPaths.manifest, 'utf8')) as {
      contractCompatibility?: {
        installedRuntimeContractStatus?: string;
        installedRuntimeContractCompatible?: boolean | 'unknown';
        installedHookEventCompatibility?: string;
        installedHookEventCompatibilityIssues?: string[];
        declaredVsObserved?: {
          comparison?: string;
          certainty?: string;
          explicitStatus?: string;
        };
      };
    };
    expect(manifest.contractCompatibility).toMatchObject({
      installedRuntimeContractStatus: 'schema-fingerprinted',
      installedRuntimeContractCompatible: false,
      installedHookEventCompatibility: 'mismatch',
    });
    expect(
      manifest.contractCompatibility?.installedHookEventCompatibilityIssues?.some(issue =>
        issue.includes('NewRuntimeHook')
      )
    ).toBe(true);
    expect(manifest.contractCompatibility?.declaredVsObserved).toMatchObject({
      comparison: 'declared-vs-observed-mismatch',
      certainty: 'conflict',
    });
    expect(manifest.contractCompatibility?.declaredVsObserved?.explicitStatus).toContain(
      'NewRuntimeHook'
    );
  });
});

async function makeTempRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

test('blocks no-approval PermissionRequest when PreToolUse fallback matcher does not cover it', async () => {
  const cwd = await makeTempRoot('codex-hooks-cwd-');
  const home = await makeTempRoot('codex-hooks-home-');
  const codexHome = join(home, '.codex');
  const artifactRoot = join(cwd, '.archon', 'artifacts', 'run-1', 'codex-hooks-preflight');
  process.env.HOME = home;
  await mkdir(codexHome, { recursive: true });
  await writeFile(
    join(codexHome, 'hooks.json'),
    JSON.stringify(
      {
        hooks: {
          PermissionRequest: [
            {
              matcher: 'Bash',
              hooks: [
                {
                  type: 'command',
                  command: '/usr/bin/python3 /tmp/permission_request.py',
                  timeout: 30,
                },
              ],
            },
          ],
          PreToolUse: [
            {
              matcher: 'Read',
              hooks: [
                {
                  type: 'command',
                  command: '/usr/bin/python3 /tmp/pre_tool_use.py',
                  timeout: 30,
                },
              ],
            },
          ],
        },
      },
      null,
      2
    ),
    'utf8'
  );

  const result = await runCodexHookBootloaderPreflight({
    cwd,
    approvalPolicy: 'never',
    artifactRoot,
    configuredBinaryPath: join(cwd, 'missing-codex-binary'),
  });

  expect(result.report.decision).toBe('block');
  expect(result.report.permissionRequest.preToolUseFallbackBounded).toBe(false);
  expect(result.report.permissionRequest.preToolUseFallbackIssues).toContain(
    '1 PermissionRequest hook(s) are not covered by a matching PreToolUse fallback matcher in no-approval mode: Bash.'
  );
  expect(result.report.permissionRequest.bounded).toBe(false);
  expect(result.report.permissionRequest.preToolUseFallbackCoverage).toEqual({
    requiredMatchers: ['Bash'],
    coveredMatchers: [],
    uncoveredMatchers: ['Bash'],
  });

  const permissionPolicy = JSON.parse(
    await readFile(result.artifactPaths.permissionRequestPolicy, 'utf8')
  ) as {
    permissionRequest?: {
      preToolUseFallbackCoverage?: {
        requiredMatchers?: string[];
        coveredMatchers?: string[];
        uncoveredMatchers?: string[];
      };
    };
  };
  expect(permissionPolicy.permissionRequest?.preToolUseFallbackCoverage).toEqual({
    requiredMatchers: ['Bash'],
    coveredMatchers: [],
    uncoveredMatchers: ['Bash'],
  });

  const permissionMarkdown = await readFile(result.artifactPaths.permissionRequest, 'utf8');
  expect(permissionMarkdown).toContain('## PreToolUse fallback coverage');
  expect(permissionMarkdown).toContain('Required PermissionRequest matchers: Bash');
  expect(permissionMarkdown).toContain('Covered PermissionRequest matchers: none');
  expect(permissionMarkdown).toContain('Uncovered PermissionRequest matchers: Bash');

  const coverageMarkdown = await readFile(result.artifactPaths.coverage, 'utf8');
  expect(coverageMarkdown).toContain('Required PermissionRequest fallback matchers: Bash');
  expect(coverageMarkdown).toContain('Covered PermissionRequest fallback matchers: none');
  expect(coverageMarkdown).toContain('Uncovered PermissionRequest fallback matchers: Bash');

  const inventory = JSON.parse(await readFile(result.artifactPaths.inventory, 'utf8')) as {
    enforcement?: {
      permissionRequestFallbackCoverage?: {
        requiredMatchers?: string[];
        coveredMatchers?: string[];
        uncoveredMatchers?: string[];
      };
    };
  };
  expect(inventory.enforcement?.permissionRequestFallbackCoverage).toEqual({
    requiredMatchers: ['Bash'],
    coveredMatchers: [],
    uncoveredMatchers: ['Bash'],
  });

  const trustStatus = JSON.parse(await readFile(result.artifactPaths.trustStatus, 'utf8')) as {
    coverage?: {
      permissionRequestFallbackCoverage?: {
        requiredMatchers?: string[];
        coveredMatchers?: string[];
        uncoveredMatchers?: string[];
      };
    };
  };
  expect(trustStatus.coverage?.permissionRequestFallbackCoverage).toEqual({
    requiredMatchers: ['Bash'],
    coveredMatchers: [],
    uncoveredMatchers: ['Bash'],
  });

  const badBehaviourLint = JSON.parse(
    await readFile(result.artifactPaths.badBehaviourLint, 'utf8')
  ) as {
    kind?: string;
    summary?: {
      byPattern?: Record<string, number>;
      byClassification?: Record<string, number>;
    };
  };
  expect(badBehaviourLint.kind).toBe('codex-hook-bad-behaviour-lint');
  expect(badBehaviourLint.summary?.byPattern?.fail_open_behavior).toBe(1);
  expect(badBehaviourLint.summary?.byPattern?.fail_closed_enforcement).toBe(1);
  expect(badBehaviourLint.summary?.byClassification?.bug).toBeGreaterThanOrEqual(1);
  expect(badBehaviourLint.summary?.byClassification?.intentional).toBeGreaterThanOrEqual(1);

  const manifest = JSON.parse(await readFile(result.artifactPaths.manifest, 'utf8')) as {
    badBehaviourLintSummary?: {
      byPattern?: Record<string, number>;
      byClassification?: Record<string, number>;
    };
  };
  expect(manifest.badBehaviourLintSummary?.byPattern?.fail_open_behavior).toBe(1);
  expect(manifest.badBehaviourLintSummary?.byPattern?.fail_closed_enforcement).toBe(1);
  expect(manifest.badBehaviourLintSummary?.byClassification?.bug).toBeGreaterThanOrEqual(1);
  expect(manifest.badBehaviourLintSummary?.byClassification?.intentional).toBeGreaterThanOrEqual(1);
});
