import { createHash } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { runAcoBootstrapCodexCommand } from './bootstrap-command';
import { buildAcoCodexHookManifestTemplate } from './aco-codex-hook-templates';
import {
  ACO_CLEANUP_CODEX_MANIFEST_SCHEMA_VERSION,
  runAcoCleanupCodexCommand,
  type AcoCleanupCodexCommandResult,
  type AcoCleanupManifest,
} from './cleanup-codex';
import { redactSecrets } from './security';

export interface RealCodexHookSmokeOptions {
  cwd: string;
  enabled?: boolean;
  timestamp?: string;
  timeoutMs?: number;
}

export interface RealCodexEvidence {
  status: 'available' | 'blocked' | 'unknown';
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface RealCodexHookSmokeResult {
  schemaVersion: 'aco.real-codex-hook-smoke.v1';
  status: 'passed' | 'blocked';
  generatedAt: string;
  preflight: {
    codexPath: RealCodexEvidence;
    version: RealCodexEvidence;
    execHelp: RealCodexEvidence;
    loginStatus: RealCodexEvidence;
  };
  authMode: 'existing-auth-ignore-user-config' | 'unknown';
  cleanRoomMethod: string;
  hookTrustMethod: string;
  eventsObserved: string[];
  runIds: string[];
  cleanupRuns: AcoCleanupCodexCommandResult[];
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

export async function runRealCodexHookSmoke(
  options: RealCodexHookSmokeOptions
): Promise<RealCodexHookSmokeResult> {
  const generatedAt = options.timestamp ?? new Date().toISOString();
  const timeoutMs = options.timeoutMs ?? 120_000;
  const preflight = await runPreflight(timeoutMs);
  const blockers = preflightBlockers(preflight);
  if (options.enabled !== true) {
    blockers.push('RUN_REAL_CODEX=1 not set; real Codex smoke blocked by opt-in gate.');
  }

  const cleanupRuns: AcoCleanupCodexCommandResult[] = [];
  const runIds: string[] = [];
  const observed = new Set<string>();
  if (blockers.length === 0) {
    for (const index of [1, 2]) {
      const runId = `aco-real-codex-${String(index)}-${Date.now()}`;
      runIds.push(runId);
      const smoke = await runSingleSmoke({ runId, timeoutMs, timestamp: generatedAt });
      smoke.events.forEach(event => observed.add(event));
      cleanupRuns.push(smoke.cleanup);
      if (smoke.blocker !== undefined) blockers.push(smoke.blocker);
    }
  }

  const requiredEvents = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop'];
  if (blockers.length === 0) {
    const missing = requiredEvents.filter(event => !observed.has(event));
    if (missing.length > 0) {
      blockers.push(`real Codex hook smoke missing events: ${missing.join(', ')}`);
    }
  }

  return {
    schemaVersion: 'aco.real-codex-hook-smoke.v1',
    status: blockers.length === 0 ? 'passed' : 'blocked',
    generatedAt,
    preflight,
    authMode: 'existing-auth-ignore-user-config',
    cleanRoomMethod:
      'codex -a never exec --ignore-user-config with project-local temp .codex/hooks.json and session-only -c hooks.* inline config',
    hookTrustMethod:
      'installed Codex 0.128.0 has no --dangerously-bypass-hook-trust; harness uses session-only inline hook config and temp project trust',
    eventsObserved: [...observed].sort(),
    runIds,
    cleanupRuns,
    blockers: blockers.map(redactSecrets),
  };
}

async function runPreflight(timeoutMs: number): Promise<RealCodexHookSmokeResult['preflight']> {
  const codexPath = toEvidence(
    'command -v codex',
    await runCommand(['sh', '-lc', 'command -v codex'], timeoutMs)
  );
  const version = toEvidence(
    'codex --version',
    await runCommand(['codex', '--version'], timeoutMs)
  );
  const execHelp = toEvidence(
    'codex exec --help',
    await runCommand(['codex', 'exec', '--help'], timeoutMs)
  );
  const loginStatus = toEvidence(
    'codex login status',
    await runCommand(['codex', 'login', 'status'], timeoutMs)
  );
  return { codexPath, version, execHelp, loginStatus };
}

function preflightBlockers(preflight: RealCodexHookSmokeResult['preflight']): string[] {
  const blockers: string[] = [];
  if (preflight.codexPath.status !== 'available') blockers.push('codex binary missing.');
  if (preflight.version.status !== 'available') blockers.push('codex --version failed.');
  if (preflight.loginStatus.status !== 'available') blockers.push('codex login status failed.');
  const loginOutput = `${preflight.loginStatus.stdout}\n${preflight.loginStatus.stderr}`;
  if (!/Logged in/i.test(loginOutput)) {
    blockers.push('codex login status is not authenticated.');
  }
  for (const marker of requiredExecHelpMarkers) {
    if (!preflight.execHelp.stdout.includes(marker)) {
      blockers.push(`codex exec --help missing required marker ${marker}.`);
    }
  }
  return blockers;
}

async function runSingleSmoke(input: {
  runId: string;
  timeoutMs: number;
  timestamp: string;
}): Promise<{ events: string[]; cleanup: AcoCleanupCodexCommandResult; blocker?: string }> {
  const root = await mkdtemp(join(tmpdir(), 'aco-real-codex-smoke-'));
  const repo = join(root, 'repo');
  const dotCodex = join(repo, '.codex');
  await mkdir(dotCodex, { recursive: true });
  await runCommand(['git', 'init', repo], 10_000);
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
  await extendCleanupManifest(manifestPath, input.runId, [
    '.codex/hooks.json',
    'aco-hook-log.jsonl',
    'AGENTS.md',
  ]);

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
    input.timeoutMs
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
  await rm(root, { recursive: true, force: true });

  if (execResult.exitCode !== 0 || execResult.timedOut) {
    return {
      events,
      cleanup,
      blocker: `codex exec hook smoke failed exit=${String(execResult.exitCode)} timedOut=${String(execResult.timedOut)} stderr=${redactSecrets(execResult.stderr)}`,
    };
  }
  return { events, cleanup };
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

async function runCommand(argv: string[], timeoutMs: number): Promise<CommandResult> {
  const proc = Bun.spawn(argv, {
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env,
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

export function digestText(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
