import { mkdir, mkdtemp, writeFile } from 'fs/promises';
import { isAbsolute, join, resolve } from 'path';
import { tmpdir } from 'os';
import type { CodexProviderDefaults } from '../types';
import type { GeneratedCodexAgents } from './agent-config';

type CodexRuntimeStatus = 'planned' | 'running' | 'completed' | 'failed';

interface CodexWorkerArtifact {
  id: string;
  label: string;
  itemType: string;
  status: 'started' | 'completed' | 'failed';
  output?: string;
  error?: string;
  rawStatus?: string;
}

export class CodexRuntimeArtifactRecorder {
  readonly directory: string;
  readonly planFile: string;
  readonly workerOutputsFile: string;
  readonly workerFailuresFile: string;
  readonly reductionSummaryFile: string;

  private readonly generatedAgents: GeneratedCodexAgents | undefined;
  private readonly config: CodexProviderDefaults;
  private readonly startedWorkers = new Map<string, CodexWorkerArtifact>();
  private readonly workerOutputs = new Map<string, CodexWorkerArtifact>();
  private readonly workerFailures = new Map<string, CodexWorkerArtifact>();
  private anonymousCounter = 0;
  private finalized = false;

  constructor(options: {
    directory: string;
    config: CodexProviderDefaults;
    generatedAgents?: GeneratedCodexAgents;
  }) {
    this.directory = options.directory;
    this.config = options.config;
    this.generatedAgents = options.generatedAgents;
    this.planFile = join(options.directory, 'fanout-plan.json');
    this.workerOutputsFile = join(options.directory, 'worker-outputs.json');
    this.workerFailuresFile = join(options.directory, 'worker-failures.json');
    this.reductionSummaryFile = join(options.directory, 'reduction-summary.json');
  }

  async initialize(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    await writeJson(this.planFile, {
      schemaVersion: 'archon.codex.runtime-plan.v1',
      directory: this.directory,
      generatedAgentManifest: this.generatedAgents?.manifestFile,
      agentIds: this.generatedAgents?.agentIds ?? [],
      features: {
        multiAgent: Boolean(this.generatedAgents) || this.config.features?.multiAgent === true,
        multiAgentV2: this.config.features?.multiAgentV2 === true,
        enableFanout:
          this.config.features?.enableFanout === true || this.config.fanout?.enabled === true,
      },
      agents: {
        maxThreads: this.config.agents?.maxThreads,
        maxDepth: this.config.agents?.maxDepth,
        jobMaxRuntimeSeconds: this.config.agents?.jobMaxRuntimeSeconds,
        interruptMessage: this.config.agents?.interruptMessage,
        strict: this.config.agents?.strict,
      },
      fanout: {
        enabled: this.config.fanout?.enabled,
        maxConcurrency: this.config.fanout?.maxConcurrency,
        strict: this.config.fanout?.strict,
      },
      observability:
        'Records Codex spawned-worker events only when the SDK emits recognizable worker item types.',
    });
    await this.writeWorkerFiles('planned');
  }

  async recordWorkerStarted(item: Record<string, unknown>, label: string): Promise<void> {
    const record = this.buildWorkerRecord(item, label, 'started');
    this.startedWorkers.set(record.id, record);
    await this.writeWorkerFiles('running');
  }

  async recordWorkerCompleted(
    item: Record<string, unknown>,
    label: string,
    output: string | undefined
  ): Promise<void> {
    const error = getWorkerError(item);
    const failed = item.status === 'failed' || Boolean(error);
    const record = this.buildWorkerRecord(item, label, failed ? 'failed' : 'completed', output);
    if (error) record.error = error;
    if (failed) {
      this.workerFailures.set(record.id, record);
    } else {
      this.workerOutputs.set(record.id, record);
    }
    await this.writeWorkerFiles('running');
  }

  async recordTurnFailure(message: string): Promise<void> {
    const id = `turn-${String(this.workerFailures.size + 1).padStart(3, '0')}`;
    this.workerFailures.set(id, {
      id,
      label: 'codex-turn',
      itemType: 'turn',
      status: 'failed',
      error: message,
    });
    await this.writeWorkerFiles('failed');
  }

  async finalize(status: 'completed' | 'failed', detail?: Record<string, unknown>): Promise<void> {
    if (this.finalized) return;
    this.finalized = true;
    await this.writeWorkerFiles(status, detail);
  }

  private buildWorkerRecord(
    item: Record<string, unknown>,
    label: string,
    status: CodexWorkerArtifact['status'],
    output?: string
  ): CodexWorkerArtifact {
    const itemId =
      typeof item.id === 'string' && item.id.trim()
        ? item.id
        : `${label || 'worker'}-${String(++this.anonymousCounter).padStart(3, '0')}`;
    return {
      id: itemId,
      label,
      itemType: typeof item.type === 'string' ? item.type : 'unknown',
      status,
      ...(output ? { output } : {}),
      ...(typeof item.status === 'string' ? { rawStatus: item.status } : {}),
    };
  }

  private async writeWorkerFiles(
    status: CodexRuntimeStatus,
    detail?: Record<string, unknown>
  ): Promise<void> {
    const outputs = sortRecords(this.workerOutputs);
    const failures = sortRecords(this.workerFailures);
    const started = sortRecords(this.startedWorkers);

    await writeJson(this.workerOutputsFile, {
      schemaVersion: 'archon.codex.worker-outputs.v1',
      workers: outputs,
    });
    await writeJson(this.workerFailuresFile, {
      schemaVersion: 'archon.codex.worker-failures.v1',
      workers: failures,
    });
    await writeJson(this.reductionSummaryFile, {
      schemaVersion: 'archon.codex.reduction-summary.v1',
      status,
      agentIds: this.generatedAgents?.agentIds ?? [],
      workerStartedIds: started.map(worker => worker.id),
      workerOutputIds: outputs.map(worker => worker.id),
      workerFailureIds: failures.map(worker => worker.id),
      outputCount: outputs.length,
      failureCount: failures.length,
      summary:
        outputs.length > 0 || failures.length > 0
          ? `Observed ${String(outputs.length)} worker output(s) and ${String(failures.length)} worker failure(s).`
          : 'No recognizable Codex worker result events observed.',
      files: {
        plan: this.planFile,
        workerOutputs: this.workerOutputsFile,
        workerFailures: this.workerFailuresFile,
      },
      ...(detail ? { detail } : {}),
    });
  }
}

export async function createCodexRuntimeArtifactRecorder(options: {
  config: CodexProviderDefaults;
  cwd: string;
  artifactDir?: string;
  generatedAgents?: GeneratedCodexAgents;
}): Promise<CodexRuntimeArtifactRecorder | undefined> {
  if (!shouldRecordCodexRuntimeArtifacts(options.config, options.generatedAgents)) {
    return undefined;
  }

  const directory =
    options.generatedAgents?.directory ??
    (await createStandaloneArtifactDirectory(options.cwd, options.artifactDir));
  const recorder = new CodexRuntimeArtifactRecorder({
    directory,
    config: options.config,
    ...(options.generatedAgents ? { generatedAgents: options.generatedAgents } : {}),
  });
  await recorder.initialize();
  return recorder;
}

function shouldRecordCodexRuntimeArtifacts(
  config: CodexProviderDefaults,
  generatedAgents: GeneratedCodexAgents | undefined
): boolean {
  return Boolean(
    generatedAgents ||
    config.features?.multiAgent === true ||
    config.features?.multiAgentV2 === true ||
    config.features?.enableFanout === true ||
    config.fanout?.enabled === true ||
    (config.agents && Object.keys(config.agents).length > 0)
  );
}

async function createStandaloneArtifactDirectory(
  cwd: string,
  artifactDir: string | undefined
): Promise<string> {
  if (artifactDir) {
    const resolvedArtifactDir = isAbsolute(artifactDir) ? artifactDir : resolve(cwd, artifactDir);
    const parentDir = join(resolvedArtifactDir, 'codex-fanout');
    await mkdir(parentDir, { recursive: true });
    return mkdtemp(join(parentDir, 'run-'));
  }

  return mkdtemp(join(tmpdir(), 'archon-codex-fanout-'));
}

function getWorkerError(item: Record<string, unknown>): string | undefined {
  const error = item.error;
  if (typeof error === 'string' && error.trim()) return error;
  if (typeof error === 'object' && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return undefined;
}

function sortRecords(records: Map<string, CodexWorkerArtifact>): CodexWorkerArtifact[] {
  return [...records.values()].sort((a, b) => a.id.localeCompare(b.id));
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}
