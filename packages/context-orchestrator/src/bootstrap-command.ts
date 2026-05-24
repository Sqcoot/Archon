import { join, relative, resolve } from 'path';
import {
  acoBootstrapEvents,
  buildAcoBootstrapContext,
  buildCapabilitySnapshot,
  type AcoBootstrapContext,
  type AcoBootstrapEvent,
  type AcoGoalStatus,
  type CapabilityClaimStatus,
  type CapabilityConfidence,
  type CapabilityEvidenceClaim,
  type CapabilityRisk,
  type CapabilitySnapshot,
} from './capability-snapshot';
import {
  containsSecretLikeValue,
  prepareArchiveDirectory,
  redactSecrets,
  validateSafeRunId,
  writeFileNoFollow,
} from './security';

export const ACO_BOOTSTRAP_CODEX_COMMAND_SCHEMA_VERSION = 'aco.bootstrap-codex-command.v1' as const;
export const ACO_BOOTSTRAP_CODEX_COMMAND = '/aco:bootstrap-codex' as const;
export const acoBootstrapFormats = ['markdown', 'json'] as const;

export type AcoBootstrapFormat = (typeof acoBootstrapFormats)[number];

export interface RunAcoBootstrapCodexCommandOptions {
  cwd: string;
  event?: AcoBootstrapEvent;
  prompt?: string;
  maxBytes?: number;
  format?: AcoBootstrapFormat;
  writeArtifact?: boolean;
  strict?: boolean;
  evaluator?: boolean;
  timestamp?: string;
  goalStatus?: AcoGoalStatus;
  nextGoalObjective?: string;
  archiveRoot?: string;
  runId?: string;
}

export interface AcoBootstrapCodexArtifactRefs {
  root: string;
  capsuleMarkdown: string;
  capsuleJson: string;
  snapshotJson: string;
  evidenceJsonl: string;
}

export interface AcoBootstrapCodexSnapshotRef {
  schemaVersion: CapabilitySnapshot['schemaVersion'];
  generatedAt: string;
  artifact?: string;
  evidenceClaims: number;
}

export interface AcoBootstrapCodexEvidenceClaimSummary {
  id: string;
  status: CapabilityClaimStatus;
  confidence: CapabilityConfidence;
  verificationSource: string;
  sourceArtifact?: string;
  command?: string;
  safeToInject: boolean;
  budget: CapabilityEvidenceClaim['budget'];
}

export interface AcoBootstrapCodexEvidenceSummary {
  totalClaims: number;
  statusCounts: Record<CapabilityClaimStatus, number>;
  sourceRefs: number;
  claims: AcoBootstrapCodexEvidenceClaimSummary[];
  summarizedClaims: number;
}

export interface AcoBootstrapCodexRisksUnknowns {
  risks: CapabilityRisk[];
  unknowns: CapabilityRisk[];
}

export interface AcoBootstrapCodexOutput {
  format: AcoBootstrapFormat;
  text: string;
  bytes: number;
  truncated: boolean;
}

export interface AcoBootstrapCodexBudget {
  maxBytes: number;
  markdownBytes: number;
  jsonBytes: number;
  truncated: boolean;
  summarized: string[];
}

export interface AcoBootstrapCodexMutationReport {
  userConfigMutated: false;
  activeHooksChanged: false;
  graphRefreshAttempted: false;
  authMutated: false;
  notes: string[];
}

export interface AcoBootstrapCodexCommandResult {
  schemaVersion: typeof ACO_BOOTSTRAP_CODEX_COMMAND_SCHEMA_VERSION;
  generatedAt: string;
  command: typeof ACO_BOOTSTRAP_CODEX_COMMAND;
  aliases: string[];
  cwd: string;
  event: AcoBootstrapEvent;
  format: AcoBootstrapFormat;
  snapshotRef: AcoBootstrapCodexSnapshotRef;
  bootstrapContext: {
    schemaVersion: AcoBootstrapContext['schemaVersion'];
    generatedAt: string;
    event: AcoBootstrapEvent;
    maxBytes: number;
    truncated: boolean;
  };
  evidenceSummary: AcoBootstrapCodexEvidenceSummary;
  risksUnknowns: AcoBootstrapCodexRisksUnknowns;
  continuation: AcoBootstrapContext['json']['continuation'];
  artifacts?: AcoBootstrapCodexArtifactRefs;
  budget: AcoBootstrapCodexBudget;
  mutationReport: AcoBootstrapCodexMutationReport;
  output: AcoBootstrapCodexOutput;
}

type ResultCore = Omit<AcoBootstrapCodexCommandResult, 'output' | 'budget'> & {
  budget: Omit<AcoBootstrapCodexBudget, 'markdownBytes' | 'jsonBytes' | 'truncated'>;
};

interface ArtifactPaths {
  refs: AcoBootstrapCodexArtifactRefs;
  absolute: AcoBootstrapCodexArtifactRefs;
}

const textEncoder = new TextEncoder();
const defaultPrompt = 'Bootstrap ACO into Codex.';
const aliases = ['aco bootstrap-codex', 'aco bootstrap codex', 'bootstrap-codex'];

export async function runAcoBootstrapCodexCommand(
  options: RunAcoBootstrapCodexCommandOptions
): Promise<AcoBootstrapCodexCommandResult> {
  const normalized = normalizeOptions(options);
  const capabilitySnapshot = await buildCapabilitySnapshot({
    cwd: normalized.cwd,
    prompt: normalized.prompt,
    timestamp: normalized.timestamp,
  });
  const bootstrapContext = await buildAcoBootstrapContext({
    cwd: normalized.cwd,
    prompt: normalized.prompt,
    event: normalized.event,
    maxBytes: normalized.maxBytes,
    timestamp: normalized.timestamp,
    snapshot: capabilitySnapshot,
    goalStatus: normalized.evaluator ? normalized.goalStatus : 'complete',
    nextGoalObjective: normalized.nextGoalObjective,
  });

  const artifactPaths = normalized.writeArtifact
    ? await makeArtifactPaths({
        cwd: normalized.cwd,
        timestamp: bootstrapContext.generatedAt,
        archiveRoot: normalized.archiveRoot,
        runId: normalized.runId,
      })
    : undefined;
  const core = buildResultCore({
    options: normalized,
    capabilitySnapshot,
    bootstrapContext,
    artifactRefs: artifactPaths?.refs,
  });
  const jsonPayload = toJsonPayload(core);
  const jsonText = `${JSON.stringify(jsonPayload, null, 2)}\n`;
  const markdownText = renderCommandMarkdown(core, bootstrapContext.markdown);
  const limitedMarkdown = limitBytes(markdownText, normalized.maxBytes);
  const outputText = normalized.format === 'json' ? jsonText : limitedMarkdown.text;
  const output: AcoBootstrapCodexOutput = {
    format: normalized.format,
    text: outputText,
    bytes: byteLength(outputText),
    truncated: normalized.format === 'markdown' ? limitedMarkdown.truncated : false,
  };
  const result: AcoBootstrapCodexCommandResult = {
    ...core,
    budget: {
      ...core.budget,
      markdownBytes: byteLength(limitedMarkdown.text),
      jsonBytes: byteLength(jsonText),
      truncated: output.truncated || bootstrapContext.truncated,
    },
    output,
  };

  validateResult(result, capabilitySnapshot, normalized.strict);

  if (artifactPaths !== undefined) {
    await writeArtifacts({
      paths: artifactPaths.absolute,
      archiveRoot: resolve(
        normalized.archiveRoot ?? join(normalized.cwd, '.archon/artifacts/context-orchestrator')
      ),
      result,
      markdownText: limitedMarkdown.text,
      jsonText,
      snapshot: capabilitySnapshot,
    });
  }

  return result;
}

function normalizeOptions(
  options: RunAcoBootstrapCodexCommandOptions
): Required<
  Pick<
    RunAcoBootstrapCodexCommandOptions,
    | 'cwd'
    | 'event'
    | 'prompt'
    | 'maxBytes'
    | 'format'
    | 'writeArtifact'
    | 'strict'
    | 'evaluator'
    | 'timestamp'
  >
> &
  Pick<
    RunAcoBootstrapCodexCommandOptions,
    'goalStatus' | 'nextGoalObjective' | 'archiveRoot' | 'runId'
  > {
  const event = options.event ?? 'SessionStart';
  if (!acoBootstrapEvents.includes(event)) {
    throw new Error(`Invalid ACO bootstrap event: ${event}`);
  }
  const format = options.format ?? 'markdown';
  if (!acoBootstrapFormats.includes(format)) {
    throw new Error(`Invalid ACO bootstrap format: ${format}`);
  }
  const maxBytes = options.maxBytes ?? 4_000;
  if (!Number.isInteger(maxBytes) || maxBytes < 500) {
    throw new Error(`--max-bytes must be an integer >= 500: ${String(maxBytes)}`);
  }

  return {
    cwd: resolve(options.cwd),
    event,
    prompt: redactSecrets(options.prompt?.trim() || defaultPrompt),
    maxBytes,
    format,
    writeArtifact: options.writeArtifact ?? true,
    strict: options.strict ?? false,
    evaluator: options.evaluator ?? true,
    timestamp: options.timestamp ?? new Date().toISOString(),
    goalStatus: options.goalStatus,
    nextGoalObjective:
      options.nextGoalObjective === undefined
        ? undefined
        : redactSecrets(options.nextGoalObjective),
    archiveRoot: options.archiveRoot,
    runId: options.runId,
  };
}

function buildResultCore(input: {
  options: ReturnType<typeof normalizeOptions>;
  capabilitySnapshot: CapabilitySnapshot;
  bootstrapContext: AcoBootstrapContext;
  artifactRefs?: AcoBootstrapCodexArtifactRefs;
}): ResultCore {
  return {
    schemaVersion: ACO_BOOTSTRAP_CODEX_COMMAND_SCHEMA_VERSION,
    generatedAt: input.bootstrapContext.generatedAt,
    command: ACO_BOOTSTRAP_CODEX_COMMAND,
    aliases,
    cwd: redactSecrets(input.options.cwd),
    event: input.options.event,
    format: input.options.format,
    snapshotRef: {
      schemaVersion: input.capabilitySnapshot.schemaVersion,
      generatedAt: input.capabilitySnapshot.generatedAt,
      artifact: input.artifactRefs?.snapshotJson,
      evidenceClaims: input.capabilitySnapshot.evidenceClaims.length,
    },
    bootstrapContext: {
      schemaVersion: input.bootstrapContext.schemaVersion,
      generatedAt: input.bootstrapContext.generatedAt,
      event: input.bootstrapContext.event,
      maxBytes: input.bootstrapContext.maxBytes,
      truncated: input.bootstrapContext.truncated,
    },
    evidenceSummary: summarizeEvidence(input.capabilitySnapshot),
    risksUnknowns: {
      risks: input.capabilitySnapshot.risks,
      unknowns: input.capabilitySnapshot.unknowns,
    },
    continuation: input.bootstrapContext.json.continuation,
    artifacts: input.artifactRefs,
    budget: {
      maxBytes: input.options.maxBytes,
      summarized: [
        'CapabilitySnapshot is referenced by artifact path when artifacts are enabled.',
        'Evidence claims are summarized in command output and fully retained in snapshot artifact.',
        'Raw auth, credentials, MCP OAuth state, active hooks, and graph refresh output are never collected.',
      ],
    },
    mutationReport: {
      userConfigMutated: false,
      activeHooksChanged: false,
      graphRefreshAttempted: false,
      authMutated: false,
      notes: [
        'Command performs read-only discovery plus repo-conventional ACO artifact writes.',
        'Hook activation and graph refresh remain approval-gated and were not attempted.',
      ],
    },
  };
}

function summarizeEvidence(snapshot: CapabilitySnapshot): AcoBootstrapCodexEvidenceSummary {
  const statusCounts: Record<CapabilityClaimStatus, number> = {
    verified: 0,
    unknown: 0,
    blocked: 0,
    deferred: 0,
  };
  for (const claim of snapshot.evidenceClaims) {
    statusCounts[claim.status] += 1;
  }
  const claims = snapshot.evidenceClaims.slice(0, 20).map(claim => ({
    id: claim.id,
    status: claim.status,
    confidence: claim.confidence,
    verificationSource: claim.verificationSource,
    ...(claim.sourceArtifact !== undefined ? { sourceArtifact: claim.sourceArtifact } : {}),
    ...(claim.command !== undefined ? { command: claim.command } : {}),
    safeToInject: claim.safeToInject,
    budget: claim.budget,
  }));

  return {
    totalClaims: snapshot.evidenceClaims.length,
    statusCounts,
    sourceRefs: snapshot.sourceRefs.length,
    claims,
    summarizedClaims: Math.max(0, snapshot.evidenceClaims.length - claims.length),
  };
}

async function makeArtifactPaths(input: {
  cwd: string;
  timestamp: string;
  archiveRoot?: string;
  runId?: string;
}): Promise<ArtifactPaths> {
  const timestampSlug = timestampToSlug(input.timestamp);
  const runId = validateSafeRunId(input.runId ?? `aco-bootstrap-codex-${timestampSlug}`);
  const archiveRoot = resolve(
    input.archiveRoot ?? join(input.cwd, '.archon/artifacts/context-orchestrator')
  );
  const archivePath = await prepareArchiveDirectory(archiveRoot, runId);
  const filenames = {
    root: archivePath,
    capsuleMarkdown: join(archivePath, `aco-codex-bootstrap-${timestampSlug}.md`),
    capsuleJson: join(archivePath, `aco-codex-bootstrap-${timestampSlug}.json`),
    snapshotJson: join(archivePath, `capability-snapshot-${timestampSlug}.json`),
    evidenceJsonl: join(archivePath, `bootstrap-command-evidence-${timestampSlug}.jsonl`),
  };
  return {
    refs: {
      root: toRepoRelative(input.cwd, filenames.root),
      capsuleMarkdown: toRepoRelative(input.cwd, filenames.capsuleMarkdown),
      capsuleJson: toRepoRelative(input.cwd, filenames.capsuleJson),
      snapshotJson: toRepoRelative(input.cwd, filenames.snapshotJson),
      evidenceJsonl: toRepoRelative(input.cwd, filenames.evidenceJsonl),
    },
    absolute: filenames,
  };
}

async function writeArtifacts(input: {
  paths: AcoBootstrapCodexArtifactRefs;
  archiveRoot: string;
  result: AcoBootstrapCodexCommandResult;
  markdownText: string;
  jsonText: string;
  snapshot: CapabilitySnapshot;
}): Promise<void> {
  await writeFileNoFollow(
    input.archiveRoot,
    input.paths.capsuleMarkdown,
    `${input.markdownText}\n`
  );
  await writeFileNoFollow(input.archiveRoot, input.paths.capsuleJson, input.jsonText);
  await writeFileNoFollow(
    input.archiveRoot,
    input.paths.snapshotJson,
    `${JSON.stringify(input.snapshot, null, 2)}\n`
  );
  await writeFileNoFollow(
    input.archiveRoot,
    input.paths.evidenceJsonl,
    `${JSON.stringify(toEvidenceRow(input.result))}\n`
  );
}

function toJsonPayload(core: ResultCore): Record<string, unknown> {
  return {
    schemaVersion: core.schemaVersion,
    command: core.command,
    aliases: core.aliases,
    generatedAt: core.generatedAt,
    cwd: core.cwd,
    event: core.event,
    format: core.format,
    snapshotRef: core.snapshotRef,
    bootstrapContext: core.bootstrapContext,
    evidenceSummary: core.evidenceSummary,
    risksUnknowns: core.risksUnknowns,
    continuation: core.continuation,
    artifacts: core.artifacts ?? null,
    budget: core.budget,
    mutationReport: core.mutationReport,
  };
}

function toEvidenceRow(result: AcoBootstrapCodexCommandResult): Record<string, unknown> {
  return {
    schemaVersion: 'aco.bootstrap-codex-command-evidence.v1',
    generatedAt: result.generatedAt,
    command: result.command,
    event: result.event,
    format: result.format,
    snapshotRef: result.snapshotRef,
    artifacts: result.artifacts,
    evidenceClaims: result.evidenceSummary.totalClaims,
    statusCounts: result.evidenceSummary.statusCounts,
    risks: result.risksUnknowns.risks.map(item => item.id),
    unknowns: result.risksUnknowns.unknowns.map(item => item.id),
    continuation: result.continuation,
    mutationReport: result.mutationReport,
    outputBytes: result.output.bytes,
  };
}

function renderCommandMarkdown(core: ResultCore, bootstrapMarkdown: string): string {
  return [
    '# ACO Codex Bootstrap Capsule',
    '',
    `Command: ${core.command}`,
    `Aliases: ${core.aliases.join(', ')}`,
    `Event: ${core.event}`,
    `Generated: ${core.generatedAt}`,
    `CWD: ${core.cwd}`,
    '',
    '## Snapshot Ref',
    '',
    `Schema: ${core.snapshotRef.schemaVersion}`,
    `Generated: ${core.snapshotRef.generatedAt}`,
    `Artifact: ${core.snapshotRef.artifact ?? 'not written'}`,
    `Evidence claims: ${String(core.snapshotRef.evidenceClaims)}`,
    '',
    '## Bootstrap Context',
    '',
    stripHeading(bootstrapMarkdown),
    '',
    '## Evidence Summary',
    '',
    `Source refs: ${String(core.evidenceSummary.sourceRefs)}`,
    `Claims: ${String(core.evidenceSummary.totalClaims)} verified=${String(
      core.evidenceSummary.statusCounts.verified
    )} unknown=${String(core.evidenceSummary.statusCounts.unknown)} blocked=${String(
      core.evidenceSummary.statusCounts.blocked
    )} deferred=${String(core.evidenceSummary.statusCounts.deferred)}`,
    `Summarized/dropped: ${String(core.evidenceSummary.summarizedClaims)} claim(s) summarized; full snapshot is in the snapshot ref when written.`,
    ...core.evidenceSummary.claims
      .slice(0, 8)
      .map(
        claim =>
          `- ${claim.id}: ${claim.status}; confidence=${claim.confidence}; source=${claim.sourceArtifact ?? claim.command ?? claim.verificationSource}; safe=${String(claim.safeToInject)}`
      ),
    '',
    '## Risks and Unknowns',
    '',
    ...renderRiskLines(core.risksUnknowns),
    '',
    '## Artifacts',
    '',
    ...(core.artifacts
      ? [
          `- capsule markdown: ${core.artifacts.capsuleMarkdown}`,
          `- capsule json: ${core.artifacts.capsuleJson}`,
          `- snapshot json: ${core.artifacts.snapshotJson}`,
          `- evidence jsonl: ${core.artifacts.evidenceJsonl}`,
        ]
      : ['- not written']),
    '',
    '## Safety',
    '',
    '- Read-only discovery by default; artifact writes are repo-conventional ACO evidence.',
    '- Auth, provider credentials, MCP OAuth, active hooks, user config, graph refresh, and raw env values are not mutated or collected.',
    '- Hook activation and graph refresh remain approval-gated.',
    '',
  ].join('\n');
}

function renderRiskLines(risksUnknowns: AcoBootstrapCodexRisksUnknowns): string[] {
  const lines = [
    ...risksUnknowns.risks
      .slice(0, 8)
      .map(item => `- risk ${item.id}: ${item.status}; ${item.summary}`),
    ...risksUnknowns.unknowns
      .slice(0, 8)
      .map(item => `- unknown ${item.id}: ${item.status}; ${item.summary}`),
  ];
  return lines.length > 0 ? lines : ['- none'];
}

function validateResult(
  result: AcoBootstrapCodexCommandResult,
  snapshot: CapabilitySnapshot,
  strict: boolean
): void {
  if (containsSecretLikeValue(result.output.text)) {
    throw new Error('Refusing to emit ACO bootstrap output with unredacted secret-like values.');
  }
  if (!strict) return;
  const unbacked = snapshot.evidenceClaims.filter(
    claim =>
      claim.status === 'verified' &&
      claim.verificationSource === 'unknown' &&
      claim.sourceArtifact === undefined &&
      claim.command === undefined
  );
  if (unbacked.length > 0) {
    throw new Error(
      `Strict ACO bootstrap refused unbacked verified claims: ${unbacked
        .map(claim => claim.id)
        .join(', ')}`
    );
  }
}

function stripHeading(markdown: string): string {
  return markdown.replace(/^# ACO Bootstrap Context\n\n?/, '').trim();
}

function timestampToSlug(timestamp: string): string {
  return timestamp.replace(/[^0-9A-Za-z]+/g, '').slice(0, 32);
}

function toRepoRelative(cwd: string, path: string): string {
  return normalizePath(relative(cwd, path));
}

function normalizePath(path: string): string {
  return path.split('\\').join('/');
}

function limitBytes(text: string, maxBytes: number): { text: string; truncated: boolean } {
  if (byteLength(text) <= maxBytes) return { text, truncated: false };
  const suffix =
    '\n\n[truncated: command capsule exceeded maxBytes; full JSON/snapshot artifacts retain summarized evidence when artifact writes are enabled]\n';
  const budget = Math.max(0, maxBytes - byteLength(suffix));
  let truncated = text;
  while (byteLength(truncated) > budget && truncated.length > 0) {
    truncated = truncated.slice(0, Math.max(0, truncated.length - 128));
  }
  return { text: `${truncated}${suffix}`, truncated: true };
}

function byteLength(text: string): number {
  return textEncoder.encode(text).length;
}
