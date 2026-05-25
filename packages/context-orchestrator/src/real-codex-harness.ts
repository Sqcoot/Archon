import { createHash } from 'crypto';
import { existsSync } from 'fs';
import { lstat, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { dirname, join, relative, resolve } from 'path';
import { pathToFileURL } from 'url';
import { runAcoBootstrapCodexCommand } from './bootstrap-command';
import { buildAcoCodexHookManifestTemplate } from './aco-codex-hook-templates';
import {
  ACO_CLEANUP_CODEX_MANIFEST_SCHEMA_VERSION,
  runAcoCleanupCodexCommand,
  type AcoCleanupCodexCommandResult,
  type AcoCleanupManifest,
} from './cleanup-codex';
import { planDocumentation } from './docs';
import { redactSecrets } from './security';

export interface RealCodexHookSmokeOptions {
  cwd: string;
  enabled?: boolean;
  timestamp?: string;
  timeoutMs?: number;
  allowGraphifyRefreshInTempHarness?: boolean;
  graphifyInputMode?: RealCodexGraphifyInputMode;
  targetRepo?: string;
}

export interface RealCodexEvidence {
  status: 'available' | 'blocked' | 'unknown';
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type RealCodexGraphifyInputMode = 'fixture-repo' | 'temp-copy-of-target-repo';

export type RealCodexDomainId =
  | 'commands'
  | 'workflows'
  | 'artifacts'
  | 'tools'
  | 'adapters'
  | 'gates'
  | 'manifests'
  | 'mcp-tools'
  | 'context7-docs'
  | 'bmad'
  | 'subagents-roles'
  | 'research-agentic-search'
  | 'context-bootload'
  | 'hooks'
  | 'plugins'
  | 'ledgers'
  | 'graph-graphify'
  | 'providers-future';

export interface RealCodexDomainEvidence {
  status: 'available' | 'blocked' | 'unknown' | 'deferred';
  sources: string[];
  behaviorProof: string[];
  deniedSources: string[];
  blockedReason?: string;
  cleanupProof: string[];
  notes: string[];
}

export interface RealCodexHookDiscoveryProof {
  sourceLayer: string;
  event: string;
  matcher: string | null;
  trustState: 'trusted' | 'untrusted' | 'managed-trusted' | 'blocked' | 'simulated' | 'skipped';
  timeoutMs: number;
  cwd: string;
  artifact: string;
  behavior: string;
  skippedReason?: string;
}

export interface RealCodexGraphifyProof {
  graphifyExecuted: boolean;
  inputMode: RealCodexGraphifyInputMode;
  inputPath: string;
  outputRoot: string;
  manifestEntries: string[];
  deniedModes: string[];
  blockedReason?: string;
}

export interface RealCodexGeneratedAgentProof {
  status: 'passed' | 'blocked';
  providerPath: 'CodexProvider.sendQuery';
  mocked: false;
  role: string;
  artifactDir: string;
  configFile: string;
  manifest: string;
  fanoutPlan: string;
  workerOutputs: string;
  workerFailures: string;
  reductionSummary: string;
  featureFlags: string[];
  experimentalFeatureFlags: string[];
  codexExecIncluded: boolean;
  behaviorProof: string[];
  blocker?: string;
}

export interface RealCodexResidueProof {
  runId: string;
  checkedBeforeTempRootRemoval: boolean;
  remainingAcoOwnedPaths: string[];
  cleanupManifestRemoved: boolean;
  hookLogRemoved: boolean;
  hookConfigRemoved: boolean;
  graphifyOutputsRemoved: boolean;
  tempRootRemoved: boolean;
}

export interface RealCodexHookSmokeResult {
  schemaVersion: 'aco.real-codex-hook-smoke.v1';
  status: 'passed' | 'blocked';
  generatedAt: string;
  preflight: {
    codexPath: RealCodexEvidence;
    version: RealCodexEvidence;
    execHelp: RealCodexEvidence;
    featuresList: RealCodexEvidence;
    loginStatus: RealCodexEvidence;
  };
  authMode: 'temp-codex-home-no-active-auth-read' | 'unknown';
  cleanRoomMethod: string;
  hookTrustMethod: string;
  eventsObserved: string[];
  runIds: string[];
  cleanupRuns: AcoCleanupCodexCommandResult[];
  residueProof: RealCodexResidueProof[];
  hookDiscoveryProof: RealCodexHookDiscoveryProof[];
  graphifyProof: RealCodexGraphifyProof;
  generatedAgentProof: RealCodexGeneratedAgentProof[];
  domainEvidence: Record<RealCodexDomainId, RealCodexDomainEvidence>;
  blockers: string[];
}

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

const requiredExecHelpMarkers = [
  '--cd',
  '--json',
  '--ignore-user-config',
  '--sandbox',
  '--enable',
  '--config',
];

const domainIds = [
  'commands',
  'workflows',
  'artifacts',
  'tools',
  'adapters',
  'gates',
  'manifests',
  'mcp-tools',
  'context7-docs',
  'bmad',
  'subagents-roles',
  'research-agentic-search',
  'context-bootload',
  'hooks',
  'plugins',
  'ledgers',
  'graph-graphify',
  'providers-future',
] as const satisfies readonly RealCodexDomainId[];

export async function runRealCodexHookSmoke(
  options: RealCodexHookSmokeOptions
): Promise<RealCodexHookSmokeResult> {
  const generatedAt = options.timestamp ?? new Date().toISOString();
  const timeoutMs = options.timeoutMs ?? 120_000;
  const preflightRuntime = await makeCleanCodexRuntime('aco-real-codex-preflight-');
  const preflight = await runPreflight(timeoutMs, preflightRuntime.env);
  await rm(preflightRuntime.root, { recursive: true, force: true });
  const domainFixture = await writeDomainEvidenceFixture(options, generatedAt);
  const hookDiscoveryProof = buildHookDiscoveryProof(domainFixture, timeoutMs);
  const graphifyProof = await buildGraphifyProof(domainFixture, options, timeoutMs);
  const blockers = preflightBlockers(preflight);
  if (options.enabled !== true) {
    blockers.push('RUN_REAL_CODEX=1 not set; real Codex smoke blocked by opt-in gate.');
  }

  const cleanupRuns: AcoCleanupCodexCommandResult[] = [];
  const residueProof: RealCodexResidueProof[] = [];
  const generatedAgentProof: RealCodexGeneratedAgentProof[] = [];
  const runIds: string[] = [];
  const observed = new Set<string>();
  const runtimeReady = blockers.length === 0;
  if (runtimeReady) {
    const providerRunId = `aco-real-codex-provider-agents-${Date.now()}`;
    const providerSmoke = await runProviderGeneratedAgentSmoke({
      runId: providerRunId,
      timeoutMs,
    });
    generatedAgentProof.push(providerSmoke.proof);
    if (providerSmoke.blocker !== undefined) blockers.push(providerSmoke.blocker);
  } else {
    generatedAgentProof.push(buildBlockedGeneratedAgentProof(blockers));
  }

  if (runtimeReady) {
    for (const index of [1, 2]) {
      const runId = `aco-real-codex-${String(index)}-${Date.now()}`;
      runIds.push(runId);
      const smoke = await runSingleSmoke({
        runId,
        timeoutMs,
        timestamp: generatedAt,
      });
      smoke.events.forEach(event => observed.add(event));
      cleanupRuns.push(smoke.cleanup);
      residueProof.push(smoke.residue);
      if (smoke.blocker !== undefined) blockers.push(smoke.blocker);
    }
  }

  const requiredEvents = [
    'SessionStart',
    'UserPromptSubmit',
    'PreToolUse',
    'PermissionRequest',
    'PostToolUse',
    'Stop',
  ];
  if (runtimeReady) {
    const missing = requiredEvents.filter(event => !observed.has(event));
    if (missing.length > 0) {
      blockers.push(`real Codex hook smoke missing events: ${missing.join(', ')}`);
    }
  }
  if (!observed.has('PermissionRequest')) {
    blockers.push(
      'PermissionRequest real hook proof blocked: noninteractive temp CODEX_HOME path did not observe an approval request; active auth/config intentionally not read.'
    );
  }

  const domainEvidence = buildDomainEvidence({
    preflight,
    blockers,
    eventsObserved: [...observed].sort(),
    cleanupRuns,
    residueProof,
    hookDiscoveryProof,
    graphifyProof,
    generatedAgentProof,
    domainFixture,
  });
  await rm(domainFixture.root, { recursive: true, force: true });
  graphifyProof.manifestEntries.push(
    `domain fixture root removed=${String(!existsSync(domainFixture.root))}`
  );

  return {
    schemaVersion: 'aco.real-codex-hook-smoke.v1',
    status: blockers.length === 0 ? 'passed' : 'blocked',
    generatedAt,
    preflight,
    authMode: 'temp-codex-home-no-active-auth-read',
    cleanRoomMethod:
      'temp HOME and temp CODEX_HOME; codex -a never exec --ignore-user-config with project-local temp .codex/hooks.json, generated requirements.toml fixture, and session-only [hooks] inline config',
    hookTrustMethod:
      'non-managed command hooks require hash review/trust; temp harness records /hooks or bypass absence as blocked evidence; managed requirements hooks are policy-trusted and not user-disabled',
    eventsObserved: [...observed].sort(),
    runIds,
    cleanupRuns,
    residueProof,
    hookDiscoveryProof,
    graphifyProof,
    generatedAgentProof,
    domainEvidence,
    blockers: blockers.map(redactSecrets),
  };
}

async function runPreflight(
  timeoutMs: number,
  env: Record<string, string>
): Promise<RealCodexHookSmokeResult['preflight']> {
  const codexPath = toEvidence(
    'command -v codex',
    await runCommand(['sh', '-lc', 'command -v codex'], timeoutMs, { env })
  );
  const version = toEvidence(
    'codex --version',
    await runCommand(['codex', '--version'], timeoutMs, { env })
  );
  const execHelp = toEvidence(
    'codex exec --help',
    await runCommand(['codex', 'exec', '--help'], timeoutMs, { env })
  );
  const featuresList = toEvidence(
    'codex features list',
    await runCommand(['codex', 'features', 'list'], timeoutMs, { env })
  );
  const loginStatus = toEvidence(
    'codex login status',
    await runCommand(['codex', 'login', 'status'], timeoutMs, { env })
  );
  return { codexPath, version, execHelp, featuresList, loginStatus };
}

function preflightBlockers(preflight: RealCodexHookSmokeResult['preflight']): string[] {
  const blockers: string[] = [];
  if (preflight.codexPath.status !== 'available') blockers.push('codex binary missing.');
  if (preflight.version.status !== 'available') blockers.push('codex --version failed.');
  if (preflight.loginStatus.status !== 'available') {
    blockers.push(
      'codex login status failed in temp CODEX_HOME; active auth intentionally not read.'
    );
  }
  const loginOutput = `${preflight.loginStatus.stdout}\n${preflight.loginStatus.stderr}`;
  const loggedIn = /\bLogged in\b/i.test(loginOutput) && !/\bnot logged in\b/i.test(loginOutput);
  if (!loggedIn) {
    blockers.push(
      'codex login status is not authenticated in temp CODEX_HOME; active auth intentionally not read.'
    );
  }
  for (const marker of requiredExecHelpMarkers) {
    if (!preflight.execHelp.stdout.includes(marker)) {
      blockers.push(`codex exec --help missing required marker ${marker}.`);
    }
  }
  const featureOutput = `${preflight.featuresList.stdout}\n${preflight.featuresList.stderr}`;
  if (preflight.featuresList.status === 'available' && !/codex_hooks|hooks/i.test(featureOutput)) {
    blockers.push('codex features list did not expose hooks feature evidence.');
  }
  return blockers;
}

interface CleanCodexRuntime {
  root: string;
  home: string;
  codexHome: string;
  env: Record<string, string>;
}

interface DomainEvidenceFixture {
  root: string;
  repo: string;
  graphifyInputPath: string;
  graphifyOutputRoot: string;
  sources: {
    packageJson: string;
    workflow: string;
    mcpFixture: string;
    bmadManifest: string;
    bmadSkills: string;
    agenticSearchMap: string;
    graphManifest: string;
    honoZodCode: string;
    hooksJson: string;
    inlineHooks: string;
    disabledConfig: string;
    requirementsToml: string;
    disabledRequirementsToml: string;
    pluginHooksJson: string;
    pluginJson: string;
    codexAgentConfig: string;
    codexAgentManifest: string;
    codexConfigOverride: string;
  };
}

async function makeCleanCodexRuntime(prefix: string): Promise<CleanCodexRuntime> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  const home = join(root, 'home');
  const codexHome = join(root, 'codex-home');
  await mkdir(home, { recursive: true });
  await mkdir(codexHome, { recursive: true });
  return {
    root,
    home,
    codexHome,
    env: cleanCommandEnv(home, codexHome),
  };
}

function cleanCommandEnv(home: string, codexHome: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of ['PATH', 'SHELL', 'TERM', 'TMPDIR', 'TMP', 'TEMP', 'LANG', 'LC_ALL']) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  env.HOME = home;
  env.CODEX_HOME = codexHome;
  env.CI = '1';
  return env;
}

async function writeDomainEvidenceFixture(
  options: RealCodexHookSmokeOptions,
  generatedAt: string
): Promise<DomainEvidenceFixture> {
  const root = await mkdtemp(join(tmpdir(), 'aco-domain-evidence-'));
  const repo = join(root, 'repo');
  await mkdir(join(repo, 'src'), { recursive: true });
  await mkdir(join(repo, '.archon/workflows/defaults'), { recursive: true });
  await mkdir(join(repo, '.archon/capabilities'), { recursive: true });
  await mkdir(join(repo, '_bmad/_config'), { recursive: true });
  await mkdir(join(repo, 'docs/context-orchestrator/research'), { recursive: true });
  await mkdir(join(repo, '.codex'), { recursive: true });
  await mkdir(join(repo, 'plugins/aco-fixture/hooks'), { recursive: true });
  await mkdir(join(repo, '.archon/artifacts/context-orchestrator/graphify-fixture'), {
    recursive: true,
  });

  const sources = {
    packageJson: join(repo, 'package.json'),
    workflow: join(repo, '.archon/workflows/defaults/context-orchestrate.yaml'),
    mcpFixture: join(repo, '.archon/capabilities/mcp-fixture.json'),
    bmadManifest: join(repo, '_bmad/_config/manifest.yaml'),
    bmadSkills: join(repo, '_bmad/_config/skill-manifest.csv'),
    agenticSearchMap: join(repo, 'docs/context-orchestrator/research/agentic-search-map.json'),
    graphManifest: join(repo, 'docs/context-orchestrator/research/upstream-manifest.json'),
    honoZodCode: join(repo, 'src/hono-zod-fixture.ts'),
    hooksJson: join(repo, '.codex/hooks.json'),
    inlineHooks: join(repo, '.codex/config.toml'),
    disabledConfig: join(repo, '.codex/config-disabled.toml'),
    requirementsToml: join(repo, 'requirements.toml'),
    disabledRequirementsToml: join(repo, 'requirements-disabled.toml'),
    pluginHooksJson: join(repo, 'plugins/aco-fixture/hooks/hooks.json'),
    pluginJson: join(repo, 'plugins/aco-fixture/plugin.json'),
    codexAgentConfig: join(
      repo,
      '.archon/artifacts/context-orchestrator/generated-codex-agents/code-reviewer.toml'
    ),
    codexAgentManifest: join(
      repo,
      '.archon/artifacts/context-orchestrator/generated-codex-agents/manifest.json'
    ),
    codexConfigOverride: join(repo, '.codex/generated-agents-config.toml'),
  };
  await mkdir(dirname(sources.codexAgentConfig), { recursive: true });

  await writeFile(
    sources.packageJson,
    `${JSON.stringify({ scripts: { 'aco:test:acceptance': 'bun test' } }, null, 2)}\n`
  );
  await writeFile(sources.workflow, 'name: context-orchestrate\n');
  await writeFile(
    sources.mcpFixture,
    `${JSON.stringify(
      {
        mcpServers: [{ id: 'mcp.fixture', label: 'Committed-safe MCP fixture' }],
        runtimeStateRead: false,
      },
      null,
      2
    )}\n`
  );
  await writeFile(
    sources.bmadManifest,
    'name: bmad-fixture\nversion: 1\nroleManifests:\n  - skill-manifest.csv\n'
  );
  await writeFile(
    sources.bmadSkills,
    [
      'canonicalId,name,description,module,path',
      '"bmad-agent-dev","bmad-agent-dev","Developer agent role","bmm","_bmad/dev/SKILL.md"',
      '"bmad-code-review","bmad-code-review","Review contract role","bmm","_bmad/review/SKILL.md"',
    ].join('\n') + '\n'
  );
  await writeFile(
    sources.agenticSearchMap,
    `${JSON.stringify(
      {
        schemaVersion: 'aco.agentic-search-map.v1',
        generatedAt,
        readOnly: true,
        implementationSurfaces: ['packages/context-orchestrator/src/real-codex-harness.ts'],
        tests: ['tests/acceptance/context-orchestrator/bootstrap-real-codex.acceptance.test.ts'],
        gaps: ['PermissionRequest runtime proof may be blocked by temp auth/noninteractive mode'],
        docsTargets: ['Context7:Hono', 'Context7:Zod', 'OpenAI Docs MCP:Codex MCP configuration'],
        blockedLookups: ['active MCP OAuth state', 'active Codex auth/config'],
        graphEvidenceState: 'fixture-only-no-mutation',
      },
      null,
      2
    )}\n`
  );
  await writeFile(
    sources.graphManifest,
    '{"repositories":[{"name":"fixture","graphStatus":"complete","nodes":2,"edges":1,"waiverRequired":false}]}\n'
  );
  await writeFile(
    sources.honoZodCode,
    [
      "import { Hono } from 'hono';",
      "import { z } from 'zod';",
      'const app = new Hono();',
      'const Payload = z.object({ name: z.string() });',
      "app.post('/fixture', c => c.json(Payload.safeParse({ name: 'aco' })));",
      'export default app;',
    ].join('\n') + '\n'
  );
  await writeFile(
    sources.hooksJson,
    JSON.stringify(
      {
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash|apply_patch|Edit|Write|mcp__.*',
              hooks: [{ type: 'command', command: 'echo repo-hook', timeout: 10 }],
            },
          ],
        },
      },
      null,
      2
    ) + '\n'
  );
  await writeFile(
    sources.inlineHooks,
    [
      '[features]',
      'hooks = true',
      'codex_hooks = true # deprecated alias fixture; installed 0.128 still lists codex_hooks',
      '',
      '[[hooks.PreToolUse]]',
      'matcher = "Bash|apply_patch|Edit|Write|mcp__.*"',
      'hooks = [{ type = "command", command = "echo inline-hook", timeout = 10 }]',
    ].join('\n') + '\n'
  );
  await writeFile(
    sources.disabledConfig,
    [
      '[features]',
      'hooks = false',
      'codex_hooks = false # deprecated alias fixture',
      '',
      '[[hooks.PreToolUse]]',
      'matcher = "Bash"',
      'hooks = [{ type = "command", command = "echo disabled-config-hook", timeout = 10 }]',
    ].join('\n') + '\n'
  );
  await writeFile(
    sources.requirementsToml,
    [
      'allow_managed_hooks_only = true',
      '',
      '[features]',
      'hooks = true',
      '',
      '[[hooks.PreToolUse]]',
      'matcher = "Bash"',
      'hooks = [{ type = "command", command = "echo managed-hook", timeout = 10 }]',
    ].join('\n') + '\n'
  );
  await writeFile(
    sources.disabledRequirementsToml,
    [
      '[features]',
      'hooks = false',
      '',
      '[[hooks.PreToolUse]]',
      'matcher = "Bash"',
      'hooks = [{ type = "command", command = "echo disabled-requirements-hook", timeout = 10 }]',
    ].join('\n') + '\n'
  );
  await writeFile(
    sources.pluginHooksJson,
    JSON.stringify(
      {
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [{ type: 'command', command: 'echo plugin-hooks-json', timeout: 10 }],
            },
          ],
        },
      },
      null,
      2
    ) + '\n'
  );
  await writeFile(
    sources.pluginJson,
    JSON.stringify(
      {
        id: 'aco-fixture',
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [{ type: 'command', command: 'echo plugin-json-hook', timeout: 10 }],
            },
          ],
        },
      },
      null,
      2
    ) + '\n'
  );
  await writeFile(
    sources.codexAgentConfig,
    [
      'name = "Code Reviewer"',
      'description = "Read-only review role used by the real Codex harness fixture."',
      'developer_instructions = """',
      'Review only the generated temp fixture files. Do not edit files or inspect credentials.',
      '"""',
    ].join('\n') + '\n'
  );
  await writeFile(
    sources.codexAgentManifest,
    `${JSON.stringify(
      {
        schemaVersion: 'archon.codex.generated-agents.v1',
        agentIds: ['code-reviewer'],
        generatedBy: 'real-codex-harness-fixture',
        featureFlags: ['multi_agent'],
        experimentalFeatureFlags: [],
      },
      null,
      2
    )}\n`
  );
  await writeFile(
    sources.codexConfigOverride,
    [
      '[features]',
      'multi_agent = true',
      '',
      '[agents]',
      'max_threads = 1',
      'max_depth = 1',
      '',
      '[agents.code-reviewer]',
      'description = "Read-only review role used by the real Codex harness fixture."',
      `config_file = ${tomlString(
        './.archon/artifacts/context-orchestrator/generated-codex-agents/code-reviewer.toml'
      )}`,
      'nickname_candidates = ["reviewer"]',
    ].join('\n') + '\n'
  );

  const graphifyInputPath =
    options.graphifyInputMode === 'temp-copy-of-target-repo' && options.targetRepo !== undefined
      ? await copySafeTargetRepo(options.targetRepo, join(root, 'target-copy'))
      : repo;
  const graphifyOutputRoot = join(
    repo,
    '.archon/artifacts/context-orchestrator/graphify-fixture/graphify-out'
  );

  return { root, repo, graphifyInputPath, graphifyOutputRoot, sources };
}

async function copySafeTargetRepo(targetRepo: string, destination: string): Promise<string> {
  await mkdir(destination, { recursive: true });
  await copySafeTargetRepoInner(resolve(targetRepo), destination, 0);
  return destination;
}

async function copySafeTargetRepoInner(
  source: string,
  destination: string,
  depth: number
): Promise<void> {
  if (depth > 4) return;
  let entries: {
    name: string;
    isDirectory(): boolean;
    isFile(): boolean;
    isSymbolicLink(): boolean;
  }[];
  try {
    entries = await readdir(source, { withFileTypes: true, encoding: 'utf8' });
  } catch {
    return;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 80)) {
    if (isDeniedTargetRepoEntry(entry.name) || entry.isSymbolicLink()) continue;
    const sourcePath = join(source, entry.name);
    const destinationPath = join(destination, entry.name);
    if (entry.isDirectory()) {
      await mkdir(destinationPath, { recursive: true });
      await copySafeTargetRepoInner(sourcePath, destinationPath, depth + 1);
      continue;
    }
    if (!entry.isFile() || !/\.(ts|tsx|js|jsx|json|md|txt|yaml|yml)$/i.test(entry.name)) continue;
    try {
      const stats = await lstat(sourcePath);
      if (stats.size > 200_000) continue;
      await writeFile(destinationPath, await readFile(sourcePath, 'utf8'));
    } catch {
      // Skip unreadable files; target-copy mode is best-effort fixture evidence.
    }
  }
}

function isDeniedTargetRepoEntry(name: string): boolean {
  return (
    name === '.git' ||
    name === '.codex' ||
    name === 'node_modules' ||
    name === 'graphify-out' ||
    name === 'research' ||
    name.startsWith('.env') ||
    /auth|oauth|credential|secret|token/i.test(name)
  );
}

function buildHookDiscoveryProof(
  fixture: DomainEvidenceFixture,
  timeoutMs: number
): RealCodexHookDiscoveryProof[] {
  const cwd = redactSecrets(fixture.repo);
  return [
    {
      sourceLayer: 'temp CODEX_HOME config.toml inline [hooks]',
      event: 'PreToolUse',
      matcher: 'Bash|apply_patch|Edit|Write|mcp__.*',
      trustState: 'trusted',
      timeoutMs,
      cwd,
      artifact: toFixturePath(fixture, fixture.sources.inlineHooks),
      behavior:
        'inline [hooks] fixture merges with same-layer hooks.json and records merge/warn expectation; higher-precedence config does not replace lower matching hooks in ACO merge model.',
    },
    {
      sourceLayer: 'temp CODEX_HOME config.toml disabled hooks',
      event: 'PreToolUse',
      matcher: 'Bash',
      trustState: 'blocked',
      timeoutMs,
      cwd,
      artifact: toFixturePath(fixture, fixture.sources.disabledConfig),
      behavior:
        'config.toml [features].hooks=false and deprecated codex_hooks=false disable non-managed hooks in fixture proof.',
      skippedReason: 'disabled hooks are not executed by harness.',
    },
    {
      sourceLayer: 'temp repo .codex/hooks.json',
      event: 'PreToolUse',
      matcher: 'Bash|apply_patch|Edit|Write|mcp__.*',
      trustState: 'untrusted',
      timeoutMs,
      cwd,
      artifact: toFixturePath(fixture, fixture.sources.hooksJson),
      behavior: `project .codex hook requires trusted temp project/hash review before command execution; commandHash=${digestText('echo repo-hook')} changedHash=${digestText('echo repo-hook-changed')} becomes untrusted.`,
    },
    {
      sourceLayer: 'managed requirements.toml hooks',
      event: 'PreToolUse',
      matcher: 'Bash',
      trustState: 'managed-trusted',
      timeoutMs,
      cwd,
      artifact: toFixturePath(fixture, fixture.sources.requirementsToml),
      behavior:
        'allow_managed_hooks_only is valid only in requirements.toml; managed hooks remain enabled and are not user-disabled.',
    },
    {
      sourceLayer: 'plugin hooks/hooks.json',
      event: 'PreToolUse',
      matcher: 'Bash',
      trustState: 'untrusted',
      timeoutMs,
      cwd,
      artifact: toFixturePath(fixture, fixture.sources.pluginHooksJson),
      behavior: `plugin command hooks use same trust flow as non-managed command hooks; commandHash=${digestText('echo plugin-hooks-json')}; plugin_hooks remains disabled unless enabled by release/config.`,
    },
    {
      sourceLayer: 'plugin.json hooks entries',
      event: 'PreToolUse',
      matcher: 'Bash',
      trustState: 'untrusted',
      timeoutMs,
      cwd,
      artifact: toFixturePath(fixture, fixture.sources.pluginJson),
      behavior:
        'plugin.json hooks entries are fixture-covered as discoverable but require installed Codex plugin-hook support before runtime proof.',
      skippedReason:
        'installed codex-cli 0.128.0 lists plugin_hooks under development and disabled.',
    },
    {
      sourceLayer: 'requirements.toml disabled hooks',
      event: 'PreToolUse',
      matcher: 'Bash',
      trustState: 'blocked',
      timeoutMs,
      cwd,
      artifact: toFixturePath(fixture, fixture.sources.disabledRequirementsToml),
      behavior:
        'requirements.toml [features].hooks=false fixture records policy-level hook disablement as blocked evidence.',
      skippedReason: 'policy-disabled hooks are not executed by harness.',
    },
    {
      sourceLayer: 'unsupported hook types',
      event: 'PreToolUse',
      matcher: null,
      trustState: 'skipped',
      timeoutMs,
      cwd,
      artifact: 'generated fixture only',
      behavior: 'only type=command is runnable; prompt, agent, and async hook types are skipped.',
      skippedReason: 'ACO harness does not execute non-command hook types.',
    },
  ];
}

async function buildGraphifyProof(
  fixture: DomainEvidenceFixture,
  options: RealCodexHookSmokeOptions,
  timeoutMs: number
): Promise<RealCodexGraphifyProof> {
  await mkdir(fixture.graphifyOutputRoot, { recursive: true });
  const graphJson = join(fixture.graphifyOutputRoot, 'graph.json');
  const graphReport = join(fixture.graphifyOutputRoot, 'GRAPH_REPORT.md');
  await writeFile(
    graphJson,
    `${JSON.stringify(
      {
        schemaVersion: 'aco.graphify-fixture.v1',
        graphifyExecuted: false,
        inputPath: toFixturePath(fixture, fixture.graphifyInputPath),
        nodes: [
          { id: 'Hono', kind: 'library' },
          { id: 'Zod', kind: 'library' },
        ],
        edges: [{ from: 'Hono', to: 'Zod', kind: 'VALIDATES_REQUESTS_WITH' }],
      },
      null,
      2
    )}\n`
  );
  await writeFile(
    graphReport,
    [
      '# Fixture Graphify Summary',
      '',
      'Hono route uses Zod validation. Output is run-owned fixture evidence only.',
      '',
    ].join('\n')
  );

  let blockedReason =
    options.allowGraphifyRefreshInTempHarness === true
      ? undefined
      : 'Graphify execution disabled; generated scoped fixture output only.';
  let graphifyExecuted = false;
  if (options.allowGraphifyRefreshInTempHarness === true) {
    const runtime = await makeCleanCodexRuntime('aco-graphify-probe-');
    const graphify = await runCommand(['sh', '-lc', 'command -v graphify'], timeoutMs, {
      env: runtime.env,
      cwd: fixture.repo,
    });
    await rm(runtime.root, { recursive: true, force: true });
    if (graphify.exitCode !== 0) {
      blockedReason = 'Graphify executable unavailable in temp harness.';
    } else {
      blockedReason =
        'Graphify executable detected but real execution deferred to avoid unscoped service/remote/durable modes in acceptance smoke.';
      graphifyExecuted = false;
    }
  }

  return {
    graphifyExecuted,
    inputMode: options.graphifyInputMode ?? 'fixture-repo',
    inputPath: toFixturePath(fixture, fixture.graphifyInputPath),
    outputRoot: toFixturePath(fixture, fixture.graphifyOutputRoot),
    manifestEntries: [toFixturePath(fixture, graphJson), toFixturePath(fixture, graphReport)],
    deniedModes: [
      'implicit-current-directory',
      'live-working-copy',
      'watch-mode',
      'mcp-server-mode',
      'remote-url-ingestion',
      'neo4j-push',
      'research:graph',
      'refresh-graph',
    ],
    blockedReason,
  };
}

function buildDomainEvidence(input: {
  preflight: RealCodexHookSmokeResult['preflight'];
  blockers: string[];
  eventsObserved: string[];
  cleanupRuns: AcoCleanupCodexCommandResult[];
  residueProof: RealCodexResidueProof[];
  hookDiscoveryProof: RealCodexHookDiscoveryProof[];
  graphifyProof: RealCodexGraphifyProof;
  generatedAgentProof: RealCodexGeneratedAgentProof[];
  domainFixture: DomainEvidenceFixture;
}): Record<RealCodexDomainId, RealCodexDomainEvidence> {
  const docsPromptOnly = planDocumentation({ prompt: 'Use Hono for request routing.' });
  const docsCodebase = planDocumentation({
    prompt: 'Plan docs for generated temp codebase.',
    codebaseSignals: ['src/hono-zod-fixture.ts imports Hono and Zod'],
  });
  const docsGraph = planDocumentation({
    prompt: 'Use graph summary to plan docs.',
    graphSummary: 'Graphify summary: Hono route uses Zod validation.',
  });
  const docsOverride = planDocumentation({
    prompt: 'Codex OpenAI MCP configuration for hooks should use OpenAI docs.',
    codebaseSignals: ['Hono', 'Zod'],
    graphSummary: 'Hono Zod',
  });
  const cleanupProof = [
    ...input.residueProof.map(
      proof =>
        `${proof.runId}: remainingAcoOwnedPaths=${String(proof.remainingAcoOwnedPaths.length)} hookLogRemoved=${String(proof.hookLogRemoved)} hookConfigRemoved=${String(proof.hookConfigRemoved)} graphifyOutputsRemoved=${String(proof.graphifyOutputsRemoved)} tempRootRemoved=${String(proof.tempRootRemoved)}`
    ),
    'domain fixture root run-owned and removed after evidence build',
  ];
  const hookProof = [
    `eventsObserved=${input.eventsObserved.join(',') || 'none'}`,
    `featuresList=${input.preflight.featuresList.status}`,
    ...input.hookDiscoveryProof.map(proof => `${proof.sourceLayer}: ${proof.behavior}`),
  ];
  const generatedAgentRuntimeProof =
    input.generatedAgentProof.length > 0
      ? input.generatedAgentProof.flatMap(proof => proof.behaviorProof)
      : ['generated custom-agent runtime proof is gated by RUN_REAL_CODEX=1.'];
  const result = emptyDomainEvidence();
  result.commands = evidence('available', {
    sources: [toFixturePath(input.domainFixture, input.domainFixture.sources.packageJson)],
    behaviorProof: [
      'package script fixture exposes aco:test:acceptance without running live repo commands.',
    ],
    cleanupProof,
  });
  result.workflows = evidence('available', {
    sources: [toFixturePath(input.domainFixture, input.domainFixture.sources.workflow)],
    behaviorProof: ['context-orchestrate workflow fixture discovered as run-owned temp evidence.'],
    cleanupProof,
  });
  result.artifacts = evidence(input.cleanupRuns.length > 0 ? 'available' : 'blocked', {
    sources: input.cleanupRuns.map(run => run.manifest),
    behaviorProof: [
      'bootstrap artifacts and cleanup manifests are run-owned when real smoke reaches execution.',
    ],
    blockedReason:
      input.cleanupRuns.length > 0
        ? undefined
        : 'real smoke blocked before bootstrap artifact creation.',
    cleanupProof,
  });
  result.tools = evidence(
    input.preflight.codexPath.status === 'available' ? 'available' : 'blocked',
    {
      sources: ['codex --version', 'codex exec --help', 'codex features list'],
      behaviorProof: [
        `codexPath=${input.preflight.codexPath.status}`,
        `version=${input.preflight.version.stdout.trim() || input.preflight.version.status}`,
        `execHelp=${input.preflight.execHelp.status}`,
      ],
      cleanupProof,
    }
  );
  result.adapters = evidence('available', {
    sources: [
      'Codex hook adapter',
      'docs planner',
      'BMAD fixture',
      'MCP fixture',
      'Graphify fixture',
    ],
    behaviorProof: [
      'all adapter evidence uses generated temp fixture files or redacted preflight output.',
    ],
    cleanupProof,
  });
  result.gates = evidence('available', {
    sources: [
      'PreToolUse guard',
      'PermissionRequest approval capsule',
      'cleanup protected path policy',
    ],
    behaviorProof: [
      'PreToolUse denies graph refresh, destructive commands, auth/OAuth/credential exposure.',
      'PermissionRequest emits allow/deny decision plus approval capsule with willRun=false.',
      'Multiple matching command hooks are treated as concurrent; proof does not depend on serial blocking.',
    ],
    deniedSources: [
      'graphify',
      'research:graph',
      'refresh-graph',
      'rm -rf',
      'git reset --hard',
      'auth.json',
      'oauth',
      'credential',
    ],
    cleanupProof,
  });
  result.manifests = evidence('available', {
    sources: [
      toFixturePath(input.domainFixture, input.domainFixture.sources.hooksJson),
      toFixturePath(input.domainFixture, input.domainFixture.sources.inlineHooks),
      toFixturePath(input.domainFixture, input.domainFixture.sources.disabledConfig),
      toFixturePath(input.domainFixture, input.domainFixture.sources.requirementsToml),
      toFixturePath(input.domainFixture, input.domainFixture.sources.disabledRequirementsToml),
      toFixturePath(input.domainFixture, input.domainFixture.sources.pluginHooksJson),
      toFixturePath(input.domainFixture, input.domainFixture.sources.pluginJson),
      toFixturePath(input.domainFixture, input.domainFixture.sources.codexConfigOverride),
    ],
    behaviorProof: input.hookDiscoveryProof.map(proof => proof.behavior),
    cleanupProof,
  });
  result['mcp-tools'] = evidence('available', {
    sources: [toFixturePath(input.domainFixture, input.domainFixture.sources.mcpFixture)],
    behaviorProof: [
      'runtimeStateRead=false',
      'MCP evidence comes from committed-safe generated fixture only.',
    ],
    deniedSources: ['MCP OAuth stores', 'active runtime state', 'provider credentials'],
    cleanupProof,
    notes: ['No OAuth/auth/provider credential file is opened or hashed.'],
  });
  result['context7-docs'] = evidence('available', {
    sources: [
      'planDocumentation(prompt-only)',
      'planDocumentation(temp Hono/Zod codebase)',
      'planDocumentation(Graphify summary)',
      'planDocumentation(OpenAI Docs MCP override)',
    ],
    behaviorProof: [
      `prompt-only=${docsPromptOnly.targets.map(target => `${target.source}:${target.topic}`).join(',')}`,
      `codebase=${docsCodebase.targets.map(target => `${target.source}:${target.topic}`).join(',')}`,
      `graph=${docsGraph.targets.map(target => `${target.source}:${target.topic}`).join(',')}`,
      `override=${docsOverride.targets.map(target => `${target.source}:${target.topic}`).join(',')}`,
    ],
    cleanupProof,
  });
  result.bmad = evidence('available', {
    sources: [
      toFixturePath(input.domainFixture, input.domainFixture.sources.bmadManifest),
      toFixturePath(input.domainFixture, input.domainFixture.sources.bmadSkills),
    ],
    behaviorProof: [
      'BMAD manifest discovered.',
      'agent role=bmad-agent-dev.',
      'review/contract role=bmad-code-review.',
    ],
    cleanupProof,
  });
  result['subagents-roles'] = evidence('available', {
    sources: [
      'runAcoCodexHook SubagentStart simulation',
      'runAcoCodexHook SubagentStop simulation',
      toFixturePath(input.domainFixture, input.domainFixture.sources.codexAgentConfig),
      toFixturePath(input.domainFixture, input.domainFixture.sources.codexAgentManifest),
      toFixturePath(input.domainFixture, input.domainFixture.sources.codexConfigOverride),
      ...input.generatedAgentProof.flatMap(proof => [
        proof.configFile,
        proof.manifest,
        proof.fanoutPlan,
        proof.reductionSummary,
      ]),
    ],
    behaviorProof: [
      'SubagentStart emits roleScope, allowedEvidence, deniedEvidence, snapshotRefs, artifactExpectations.',
      'SubagentStop emits artifact collection, evidence capture, unknowns, and evaluator notes.',
      'ACO hook lifecycle simulations remain labeled separately from provider-level Codex generated agents.',
      'Codex stable custom-agent fixture uses features.multi_agent=true and agents.code-reviewer.config_file.',
      'Codex generated-agent fixture keeps experimental multi_agent_v2 and enable_fanout absent.',
      ...generatedAgentRuntimeProof,
    ],
    deniedSources: ['multi_agent_v2 default enablement', 'enable_fanout default enablement'],
    cleanupProof,
  });
  result['research-agentic-search'] = evidence('available', {
    sources: [toFixturePath(input.domainFixture, input.domainFixture.sources.agenticSearchMap)],
    behaviorProof: [
      'readOnly=true.',
      'implementation surfaces, tests, gaps, docs targets, blocked lookups, and graph evidence state are mapped.',
    ],
    deniedSources: [
      'repo mutation',
      'graph mutation',
      'config mutation',
      'auth/OAuth/provider secret access',
    ],
    cleanupProof,
  });
  result['context-bootload'] = evidence(input.cleanupRuns.length > 0 ? 'available' : 'blocked', {
    sources: input.cleanupRuns.map(run => run.manifest),
    behaviorProof: [
      'buildAcoBootstrapContext/runAcoBootstrapCodexCommand emit compact context and cleanup manifest.',
    ],
    blockedReason:
      input.cleanupRuns.length > 0
        ? undefined
        : 'real smoke blocked before context bootload execution.',
    cleanupProof,
  });
  result.hooks = evidence(input.eventsObserved.length > 0 ? 'available' : 'blocked', {
    sources: input.hookDiscoveryProof.map(proof => proof.artifact),
    behaviorProof: hookProof,
    blockedReason: input.eventsObserved.includes('PermissionRequest')
      ? undefined
      : 'PermissionRequest real hook proof blocked or absent in noninteractive temp CODEX_HOME run.',
    cleanupProof,
  });
  result.plugins = evidence('deferred', {
    sources: [
      toFixturePath(input.domainFixture, input.domainFixture.sources.pluginHooksJson),
      toFixturePath(input.domainFixture, input.domainFixture.sources.pluginJson),
    ],
    behaviorProof: [
      'plugin hook fixtures are discovered; runtime plugin_hooks support is deferred.',
    ],
    blockedReason: 'installed codex-cli 0.128.0 lists plugin_hooks under development and disabled.',
    cleanupProof,
  });
  result.ledgers = evidence(input.cleanupRuns.length > 0 ? 'available' : 'blocked', {
    sources: input.cleanupRuns.map(run => run.cleanupLedgerRow.runId),
    behaviorProof: [
      'cleanup ledger row records deleted/refused/skipped counts and before/after digest.',
    ],
    blockedReason:
      input.cleanupRuns.length > 0
        ? undefined
        : 'real smoke blocked before cleanup ledger creation.',
    cleanupProof,
  });
  result['graph-graphify'] = evidence('available', {
    sources: [input.graphifyProof.outputRoot, input.graphifyProof.inputPath],
    behaviorProof: [
      `graphifyExecuted=${String(input.graphifyProof.graphifyExecuted)}`,
      `inputMode=${input.graphifyProof.inputMode}`,
      'fixture graph summary can influence Context7 Hono/Zod selection.',
      'real graph evidence and graph waivers are not mutated.',
    ],
    deniedSources: input.graphifyProof.deniedModes,
    blockedReason: input.graphifyProof.blockedReason,
    cleanupProof,
    notes: input.graphifyProof.manifestEntries,
  });
  result['providers-future'] = evidence('unknown', {
    sources: ['provider fixture manifests only'],
    behaviorProof: [
      'future provider runtime support intentionally not inferred from credentials or auth state.',
    ],
    deniedSources: ['provider credentials', 'provider OAuth stores'],
    cleanupProof,
  });
  return result;
}

function emptyDomainEvidence(): Record<RealCodexDomainId, RealCodexDomainEvidence> {
  const result = {} as Record<RealCodexDomainId, RealCodexDomainEvidence>;
  for (const id of domainIds) {
    result[id] = {
      status: 'unknown',
      sources: [],
      behaviorProof: [],
      deniedSources: [],
      cleanupProof: [],
      notes: [],
    };
  }
  return result;
}

function evidence(
  status: RealCodexDomainEvidence['status'],
  input: Partial<Omit<RealCodexDomainEvidence, 'status'>>
): RealCodexDomainEvidence {
  return {
    status,
    sources: unique((input.sources ?? []).map(redactSecrets)),
    behaviorProof: unique((input.behaviorProof ?? []).map(redactSecrets)),
    deniedSources: unique((input.deniedSources ?? []).map(redactSecrets)),
    blockedReason:
      input.blockedReason === undefined ? undefined : redactSecrets(input.blockedReason),
    cleanupProof: unique((input.cleanupProof ?? []).map(redactSecrets)),
    notes: unique((input.notes ?? []).map(redactSecrets)),
  };
}

async function readCleanupManifestEntries(manifestPath: string): Promise<string[]> {
  try {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as AcoCleanupManifest;
    return manifest.entries.map(entry => entry.path);
  } catch {
    return [];
  }
}

async function inspectResidue(input: {
  root: string;
  repo: string;
  runId: string;
  manifestEntries: string[];
  hookLogPath: string;
  hookConfigPath: string;
}): Promise<RealCodexResidueProof> {
  const remainingAcoOwnedPaths = input.manifestEntries.filter(entry =>
    existsSync(resolve(input.repo, entry))
  );
  return {
    runId: input.runId,
    checkedBeforeTempRootRemoval: true,
    remainingAcoOwnedPaths,
    cleanupManifestRemoved: !remainingAcoOwnedPaths.some(path =>
      path.endsWith('cleanup-manifest.json')
    ),
    hookLogRemoved: !existsSync(input.hookLogPath),
    hookConfigRemoved: !existsSync(input.hookConfigPath),
    graphifyOutputsRemoved: !remainingAcoOwnedPaths.some(path => path.includes('graphify-out')),
    tempRootRemoved: false,
  };
}

function toFixturePath(fixture: DomainEvidenceFixture, absolutePath: string): string {
  const relativePath = relative(fixture.root, absolutePath);
  return relativePath && !relativePath.startsWith('..')
    ? `fixture://${relativePath.split('\\').join('/')}`
    : redactSecrets(absolutePath);
}

async function runProviderGeneratedAgentSmoke(input: {
  runId: string;
  timeoutMs: number;
}): Promise<{ proof: RealCodexGeneratedAgentProof; blocker?: string }> {
  const runtime = await makeCleanCodexRuntime('aco-real-codex-provider-agents-');
  const repo = join(runtime.root, 'repo');
  const artifactDir = join(
    repo,
    '.archon/artifacts/context-orchestrator',
    input.runId,
    'provider-generated-agent'
  );
  const resultFile = join(runtime.root, 'provider-result.json');
  const childScript = join(runtime.root, 'provider-generated-agent-smoke.mjs');
  await mkdir(artifactDir, { recursive: true });
  await runCommand(['git', 'init', repo], 10_000, { env: runtime.env });
  await writeFile(
    join(repo, 'AGENTS.md'),
    'Temp ACO real-Codex provider generated-agent smoke repo.\n'
  );
  await writeFile(childScript, renderProviderGeneratedAgentSmokeScript(resultFile));

  const command = await runCommand(['bun', childScript], input.timeoutMs, {
    env: {
      ...runtime.env,
      ACO_PROVIDER_REPO: repo,
      ACO_PROVIDER_ARTIFACT_DIR: artifactDir,
      ACO_PROVIDER_RESULT: resultFile,
    },
    cwd: repo,
  });
  const childResult = await readJsonMaybe<ProviderGeneratedAgentChildResult>(resultFile);
  const artifactProof = await inspectProviderGeneratedAgentArtifacts(artifactDir);
  await rm(runtime.root, { recursive: true, force: true });

  const blockers = [
    ...(command.exitCode === 0 && !command.timedOut
      ? []
      : [
          `provider generated-agent child process failed exit=${String(
            command.exitCode
          )} timedOut=${String(command.timedOut)} stderr=${command.stderr}`,
        ]),
    ...(childResult?.status === 'completed'
      ? []
      : [`CodexProvider generated-agent smoke failed: ${childResult?.error ?? 'no result file'}`]),
    ...artifactProof.blockers,
  ];
  const workerCount =
    (artifactProof.reductionSummary?.outputCount ?? 0) +
    (artifactProof.reductionSummary?.failureCount ?? 0);
  if (childResult?.status === 'completed' && workerCount === 0) {
    blockers.push(
      'CodexProvider generated-agent smoke completed without recognizable worker events.'
    );
  }

  const proof: RealCodexGeneratedAgentProof = {
    status: blockers.length === 0 ? 'passed' : 'blocked',
    providerPath: 'CodexProvider.sendQuery',
    mocked: false,
    role: 'brief-gen',
    artifactDir: redactSecrets(artifactDir),
    configFile: redactSecrets(artifactProof.configFile ?? ''),
    manifest: redactSecrets(artifactProof.manifest ?? ''),
    fanoutPlan: redactSecrets(artifactProof.fanoutPlan ?? ''),
    workerOutputs: redactSecrets(artifactProof.workerOutputs ?? ''),
    workerFailures: redactSecrets(artifactProof.workerFailures ?? ''),
    reductionSummary: redactSecrets(artifactProof.reductionSummaryFile ?? ''),
    featureFlags: artifactProof.features.multiAgent ? ['multi_agent'] : [],
    experimentalFeatureFlags: [
      ...(artifactProof.features.multiAgentV2 ? ['multi_agent_v2'] : []),
      ...(artifactProof.features.enableFanout ? ['enable_fanout'] : []),
    ],
    codexExecIncluded: childResult !== undefined || command.exitCode !== 0,
    behaviorProof: [
      'Provider smoke executes CodexProvider.sendQuery in a sanitized child process; no mocked SDK is installed.',
      'Inline nodeConfig.agents supplies brief-gen so the provider must generate run-owned custom-agent TOML.',
      `manifestAgentIds=${artifactProof.agentIds.join(',') || 'none'}`,
      `features.multiAgent=${String(artifactProof.features.multiAgent)}`,
      `features.multiAgentV2=${String(artifactProof.features.multiAgentV2)}`,
      `features.enableFanout=${String(artifactProof.features.enableFanout)}`,
      `workerOutputCount=${String(artifactProof.reductionSummary?.outputCount ?? 0)}`,
      `workerFailureCount=${String(artifactProof.reductionSummary?.failureCount ?? 0)}`,
      ...(childResult?.chunkTypes ? [`chunkTypes=${childResult.chunkTypes.join(',')}`] : []),
      ...blockers.map(blocker => `blocked=${blocker}`),
    ],
    ...(blockers.length > 0 ? { blocker: blockers.join(' | ') } : {}),
  };

  return {
    proof,
    ...(blockers.length > 0 ? { blocker: proof.blocker } : {}),
  };
}

interface ProviderGeneratedAgentChildResult {
  status: 'completed' | 'failed';
  chunkTypes: string[];
  error?: string;
}

interface ProviderGeneratedAgentArtifactProof {
  manifest?: string;
  configFile?: string;
  fanoutPlan?: string;
  workerOutputs?: string;
  workerFailures?: string;
  reductionSummaryFile?: string;
  reductionSummary?: { outputCount?: number; failureCount?: number };
  agentIds: string[];
  features: {
    multiAgent: boolean;
    multiAgentV2: boolean;
    enableFanout: boolean;
  };
  blockers: string[];
}

function renderProviderGeneratedAgentSmokeScript(resultFile: string): string {
  const providerIndex = pathToFileURL(
    resolve(process.cwd(), 'packages/providers/src/codex/provider.ts')
  );
  return [
    `const providerModule = await import(${JSON.stringify(providerIndex.href)});`,
    'const { writeFile } = await import("node:fs/promises");',
    'const repo = process.env.ACO_PROVIDER_REPO;',
    'const artifactDir = process.env.ACO_PROVIDER_ARTIFACT_DIR;',
    `const resultFile = process.env.ACO_PROVIDER_RESULT ?? ${JSON.stringify(resultFile)};`,
    'const chunks = [];',
    'const writeResult = async value => writeFile(resultFile, JSON.stringify(value, null, 2) + "\\n");',
    'try {',
    '  const provider = new providerModule.CodexProvider({ retryBaseDelayMs: 1 });',
    `  for await (const chunk of provider.sendQuery(${JSON.stringify(
      [
        'Use the configured brief-gen custom agent exactly once to inspect this temp fixture.',
        'The subagent should return one short sentence.',
        'Then provide a final one-sentence answer.',
        'Do not edit files.',
      ].join(' ')
    )}, repo, undefined, {`,
    '    artifactDir,',
    '    assistantConfig: { agents: { maxThreads: 1, maxDepth: 1, strict: true } },',
    '    env: {',
    '      HOME: process.env.HOME ?? "",',
    '      CODEX_HOME: process.env.CODEX_HOME ?? "",',
    '      PATH: process.env.PATH ?? "",',
    '      SHELL: process.env.SHELL ?? "",',
    '      TERM: process.env.TERM ?? "",',
    '      TMPDIR: process.env.TMPDIR ?? "",',
    '      TMP: process.env.TMP ?? "",',
    '      TEMP: process.env.TEMP ?? "",',
    '      LANG: process.env.LANG ?? "",',
    '      LC_ALL: process.env.LC_ALL ?? "",',
    '      CI: "1",',
    '    },',
    '    nodeConfig: {',
    '      agents: {',
    '        "brief-gen": {',
    '          description: "Read-only brief generator used by the real Codex provider harness.",',
    '          prompt: "Inspect only the temp fixture context and return one short sentence. Do not edit files or access credentials.",',
    '          tools: [],',
    '          disallowedTools: ["Bash", "Write", "Edit"],',
    '          skills: ["real-codex-harness"],',
    '          maxTurns: 1,',
    '        },',
    '      },',
    '    },',
    '  })) {',
    '    chunks.push({ type: chunk.type, content: typeof chunk.content === "string" ? chunk.content.slice(0, 400) : undefined });',
    '  }',
    '  await writeResult({ status: "completed", chunkTypes: [...new Set(chunks.map(chunk => chunk.type))], chunks });',
    '} catch (error) {',
    '  const message = error instanceof Error ? error.message : String(error);',
    '  await writeResult({ status: "failed", chunkTypes: [...new Set(chunks.map(chunk => chunk.type))], error: message, chunks });',
    '}',
    '',
  ].join('\n');
}

async function inspectProviderGeneratedAgentArtifacts(
  artifactDir: string
): Promise<ProviderGeneratedAgentArtifactProof> {
  const files = await listFilesRecursive(artifactDir);
  const manifest = files.find(
    path => path.includes('/codex-agents/run-') && path.endsWith('/manifest.json')
  );
  const fanoutPlan = files.find(
    path => path.includes('/codex-agents/run-') && path.endsWith('/fanout-plan.json')
  );
  const workerOutputs = files.find(
    path => path.includes('/codex-agents/run-') && path.endsWith('/worker-outputs.json')
  );
  const workerFailures = files.find(
    path => path.includes('/codex-agents/run-') && path.endsWith('/worker-failures.json')
  );
  const reductionSummaryFile = files.find(
    path => path.includes('/codex-agents/run-') && path.endsWith('/reduction-summary.json')
  );
  const manifestJson = manifest === undefined ? undefined : await readJsonMaybe(manifest);
  const fanoutPlanJson =
    fanoutPlan === undefined
      ? undefined
      : await readJsonMaybe<{
          agentIds?: unknown;
          features?: {
            multiAgent?: unknown;
            multiAgentV2?: unknown;
            enableFanout?: unknown;
          };
        }>(fanoutPlan);
  const reductionSummary =
    reductionSummaryFile === undefined
      ? undefined
      : await readJsonMaybe<{ outputCount?: number; failureCount?: number }>(reductionSummaryFile);
  const manifestAgents = Array.isArray((manifestJson as { agents?: unknown } | undefined)?.agents)
    ? ((manifestJson as { agents: { id?: unknown; configFile?: unknown }[] }).agents ?? [])
    : [];
  const configFile =
    typeof manifestAgents[0]?.configFile === 'string'
      ? manifestAgents[0].configFile
      : files.find(path => path.includes('/codex-agents/run-') && path.endsWith('/brief-gen.toml'));
  const agentIds = manifestAgents
    .map(agent => agent.id)
    .filter((id): id is string => typeof id === 'string')
    .sort();
  const features = {
    multiAgent: fanoutPlanJson?.features?.multiAgent === true,
    multiAgentV2: fanoutPlanJson?.features?.multiAgentV2 === true,
    enableFanout: fanoutPlanJson?.features?.enableFanout === true,
  };
  const blockers = [
    ...(manifest !== undefined ? [] : ['generated agent manifest missing']),
    ...(configFile !== undefined ? [] : ['generated brief-gen TOML missing']),
    ...(fanoutPlan !== undefined ? [] : ['fanout-plan.json missing']),
    ...(workerOutputs !== undefined ? [] : ['worker-outputs.json missing']),
    ...(workerFailures !== undefined ? [] : ['worker-failures.json missing']),
    ...(reductionSummaryFile !== undefined ? [] : ['reduction-summary.json missing']),
    ...(agentIds.includes('brief-gen') ? [] : ['manifest does not include brief-gen']),
    ...(features.multiAgent ? [] : ['fanout plan did not record stable multiAgent=true']),
    ...(!features.multiAgentV2 ? [] : ['experimental multiAgentV2 unexpectedly enabled']),
    ...(!features.enableFanout ? [] : ['experimental enableFanout unexpectedly enabled']),
  ];
  return {
    manifest,
    configFile,
    fanoutPlan,
    workerOutputs,
    workerFailures,
    reductionSummaryFile,
    reductionSummary,
    agentIds,
    features,
    blockers,
  };
}

async function listFilesRecursive(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const path = join(root, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await listFilesRecursive(path)));
      } else if (entry.isFile()) {
        files.push(path);
      }
    }
    return files.sort();
  } catch {
    return [];
  }
}

async function readJsonMaybe<T = unknown>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return undefined;
  }
}

function buildBlockedGeneratedAgentProof(blockers: string[]): RealCodexGeneratedAgentProof {
  const blocker = `Real Codex provider generated-agent smoke blocked before execution: ${blockers.join(
    ' | '
  )}`;
  return {
    status: 'blocked',
    providerPath: 'CodexProvider.sendQuery',
    mocked: false,
    role: 'brief-gen',
    artifactDir: '',
    configFile: '',
    manifest: '',
    fanoutPlan: '',
    workerOutputs: '',
    workerFailures: '',
    reductionSummary: '',
    featureFlags: ['multi_agent'],
    experimentalFeatureFlags: [],
    codexExecIncluded: false,
    behaviorProof: [
      'Provider generated-agent smoke is guarded by the same RUN_REAL_CODEX and clean-room preflight gates as the real Codex hook smoke.',
      'Expected stable feature is multi_agent; experimental multi_agent_v2 and enable_fanout remain absent.',
      'features.multiAgent=blocked',
      'features.multiAgentV2=false',
      'features.enableFanout=false',
      `blocked=${blocker}`,
    ],
    blocker,
  };
}

async function runSingleSmoke(input: {
  runId: string;
  timeoutMs: number;
  timestamp: string;
}): Promise<{
  events: string[];
  cleanup: AcoCleanupCodexCommandResult;
  residue: RealCodexResidueProof;
  blocker?: string;
}> {
  const runtime = await makeCleanCodexRuntime('aco-real-codex-smoke-');
  const root = runtime.root;
  const repo = join(root, 'repo');
  const dotCodex = join(repo, '.codex');
  await mkdir(dotCodex, { recursive: true });
  await runCommand(['git', 'init', repo], 10_000, { env: runtime.env });
  await writeFile(join(repo, 'AGENTS.md'), 'Temp ACO real-Codex hook smoke repo.\n');

  const logPath = join(repo, 'aco-hook-log.jsonl');
  const runnerPath = resolve(
    process.cwd(),
    'scripts/context-orchestrator/aco-codex-hook-runner.ts'
  );
  const hookCommand = `ACO_TEST_RUN_ID=${shellQuote(input.runId)} ACO_HOOK_LOG=${shellQuote(logPath)} bun ${shellQuote(runnerPath)} --cwd ${shellQuote(repo)}`;
  const hookTemplate = buildAcoCodexHookManifestTemplate({ command: hookCommand });
  await writeFile(
    join(dotCodex, 'hooks.json'),
    `${JSON.stringify(hookTemplate.activeHooksJson, null, 2)}\n`
  );

  const bootstrap = await runAcoBootstrapCodexCommand({
    cwd: repo,
    runId: input.runId,
    event: 'SessionStart',
    prompt: 'Real Codex clean-room bootstrap smoke.',
    format: 'json',
    writeArtifact: true,
    timestamp: input.timestamp,
  });
  if (bootstrap.artifacts === undefined) {
    throw new Error('bootstrap did not emit artifacts for real Codex smoke');
  }
  const manifestPath = join(repo, bootstrap.artifacts.cleanupManifest);
  const graphifyRunRelative = join(
    '.archon/artifacts/context-orchestrator',
    input.runId,
    'graphify-out',
    'graph.json'
  );
  await mkdir(dirname(join(repo, graphifyRunRelative)), { recursive: true });
  await writeFile(
    join(repo, graphifyRunRelative),
    `${JSON.stringify({ schemaVersion: 'aco.temp-graphify-output.v1', runId: input.runId })}\n`
  );
  await extendCleanupManifest(manifestPath, input.runId, [
    '.codex/hooks.json',
    'aco-hook-log.jsonl',
    'AGENTS.md',
    graphifyRunRelative,
  ]);
  const manifestEntries = await readCleanupManifestEntries(manifestPath);

  const prompt = [
    'You are in a temp hook-smoke repo.',
    "Run exactly one shell command: printf 'ACO_REAL_CODEX_HOOK_SMOKE_OK\\n'",
    'Then stop. Do not edit files.',
  ].join(' ');
  const trustConfig = `projects.${JSON.stringify(repo)}.trust_level="trusted"`;
  const execResult = await runCommand(
    [
      'codex',
      '-a',
      'never',
      'exec',
      '--cd',
      repo,
      '--ignore-user-config',
      '--enable',
      'codex_hooks',
      '-c',
      trustConfig,
      ...inlineHookConfigArgs(hookTemplate.activeHooksJson),
      '--sandbox',
      'workspace-write',
      '--json',
      prompt,
    ],
    input.timeoutMs,
    { env: runtime.env, cwd: repo }
  );

  const events = existsSync(logPath) ? parseHookLog(await readFile(logPath, 'utf8')) : [];
  const cleanup = await runAcoCleanupCodexCommand({
    cwd: repo,
    manifest: manifestPath,
    runId: input.runId,
    apply: true,
    json: true,
    timestamp: input.timestamp,
  });
  const residue = await inspectResidue({
    root,
    repo,
    runId: input.runId,
    manifestEntries,
    hookLogPath: logPath,
    hookConfigPath: join(dotCodex, 'hooks.json'),
  });
  await rm(root, { recursive: true, force: true });
  residue.tempRootRemoved = !existsSync(root);

  if (execResult.exitCode !== 0 || execResult.timedOut) {
    return {
      events,
      cleanup,
      residue,
      blocker: `codex exec hook smoke failed exit=${String(execResult.exitCode)} timedOut=${String(execResult.timedOut)} stderr=${redactSecrets(execResult.stderr)}`,
    };
  }
  return { events, cleanup, residue };
}

function inlineHookConfigArgs(
  activeHooksJson: ReturnType<typeof buildAcoCodexHookManifestTemplate>['activeHooksJson']
): string[] {
  return Object.entries(activeHooksJson.hooks).flatMap(([event, groups]) => [
    '-c',
    `hooks.${event}=${tomlArray(groups.map(tomlHookGroup))}`,
  ]);
}

function tomlHookGroup(group: {
  matcher?: string;
  hooks: { type: 'command'; command: string; timeout: number }[];
}): string {
  const fields = [
    group.matcher === undefined ? undefined : `matcher=${tomlString(group.matcher)}`,
    `hooks=${tomlArray(
      group.hooks.map(hook =>
        tomlInlineTable([
          `type=${tomlString(hook.type)}`,
          `command=${tomlString(hook.command)}`,
          `timeout=${String(hook.timeout)}`,
        ])
      )
    )}`,
  ].filter((field): field is string => field !== undefined);
  return tomlInlineTable(fields);
}

function tomlArray(values: string[]): string {
  return `[${values.join(',')}]`;
}

function tomlInlineTable(fields: string[]): string {
  return `{${fields.join(',')}}`;
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

async function extendCleanupManifest(
  manifestPath: string,
  runId: string,
  extraPaths: string[]
): Promise<void> {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as AcoCleanupManifest;
  manifest.entries.push(
    ...extraPaths.map(path => ({
      path,
      ownedBy: 'aco' as const,
      runId,
      kind: path === '.codex/hooks.json' ? 'hookConfig' : 'artifact',
    }))
  );
  manifest.schemaVersion = ACO_CLEANUP_CODEX_MANIFEST_SCHEMA_VERSION;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function parseHookLog(text: string): string[] {
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => {
      try {
        const parsed = JSON.parse(line) as { event?: unknown };
        return typeof parsed.event === 'string' ? parsed.event : undefined;
      } catch {
        return undefined;
      }
    })
    .filter((event): event is string => event !== undefined);
}

async function runCommand(
  argv: string[],
  timeoutMs: number,
  options: { env?: Record<string, string>; cwd?: string } = {}
): Promise<CommandResult> {
  const proc = Bun.spawn(argv, {
    stdout: 'pipe',
    stderr: 'pipe',
    env: options.env ?? process.env,
    cwd: options.cwd,
  });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const commandResult: Promise<[string, string, number]> = Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    const timeoutResult = new Promise<[string, string, number]>(resolveTimeout => {
      timeout = setTimeout(() => {
        proc.kill();
        resolveTimeout(['', `timed out after ${String(timeoutMs)}ms`, 124]);
      }, timeoutMs);
    });
    const [stdout, stderr, exitCode] = await Promise.race([commandResult, timeoutResult]);
    return {
      stdout: redactSecrets(stdout),
      stderr: redactSecrets(stderr),
      exitCode,
      timedOut: exitCode === 124,
    };
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

function toEvidence(command: string, result: CommandResult): RealCodexEvidence {
  return {
    status: result.exitCode === 0 ? 'available' : 'blocked',
    command,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
  };
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(item => item.trim()))];
}

export function digestText(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
