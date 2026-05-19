import { lstat, realpath } from 'fs/promises';
import { resolve } from 'path';
import { execFileAsync } from '@archon/git';
import { normalizeObjective } from './intent';
import { assertPathInside, redactSecrets } from './security';
import {
  TARGET_INTENT_BOUNDARY_SCHEMA_VERSION,
  targetIntentBoundarySchema,
} from './schemas/target-intent-boundary';
import type {
  TargetIntentBoundaryArtifact,
  TargetIntentBoundaryConfidence,
  TargetIntentBoundaryDirtyState,
  TargetIntentBoundaryMutationPolicy,
  TargetIntentBoundaryRelationship,
  TargetIntentBoundarySourceSignal,
  TargetIntentBoundaryWarning,
  TargetIntentBoundaryWorkIntent,
} from './schemas/target-intent-boundary';

interface CreateTargetIntentBoundaryOptions {
  cwd: string;
  objective: string;
  timestamp: string;
  archivePath: string;
  boundaryPath: string;
  routeId?: string;
  contextArtifacts?: string[];
  ledgerArtifacts?: string[];
  normalizedObjective?: string;
  commitSha?: string;
  explicitTargetRoot?: string;
  explicitTargetRelationship?: TargetIntentBoundaryRelationship;
}

interface TargetResolution {
  relationship: TargetIntentBoundaryRelationship;
  root: string | null;
  equalsHarness: boolean;
  confidence: TargetIntentBoundaryConfidence;
  signals: TargetIntentBoundarySourceSignal[];
  warnings: TargetIntentBoundaryWarning[];
  unresolvedRegisteredProject: boolean;
  unresolvedExternalReference: boolean;
}

export async function createTargetIntentBoundary(
  options: CreateTargetIntentBoundaryOptions
): Promise<TargetIntentBoundaryArtifact> {
  const harnessRoot = resolve(options.cwd);
  const artifactsRoot = resolve(options.archivePath);
  const resolvedBoundaryPath = resolve(options.boundaryPath);
  assertPathInside(artifactsRoot, resolvedBoundaryPath);

  const rawObjective = redactSecrets(options.objective);
  const normalized = redactSecrets(options.normalizedObjective ?? normalizeObjective(rawObjective));
  const branch = redactSecrets(await getGitBranch(harnessRoot));
  const commit = redactSecrets(options.commitSha ?? (await getGitCommit(harnessRoot)));
  const workIntent = classifyWorkIntent(normalized);
  const routeId = options.routeId ?? 'unknown';
  const target = await resolveTarget({
    harnessRoot,
    rawObjective,
    normalizedObjective: normalized,
    workIntent,
    explicitTargetRoot: options.explicitTargetRoot,
    explicitTargetRelationship: options.explicitTargetRelationship,
  });
  const dirtyState =
    target.relationship === 'artifact_only'
      ? 'not_applicable'
      : await getDirtyState(target.root ?? harnessRoot);
  const warnings = [
    ...target.warnings,
    ...createIntentWarnings(workIntent),
    ...createConfidenceWarnings(target.confidence),
  ];
  const mutationPolicy = chooseMutationPolicy(target.relationship, workIntent);
  const safety = createSafety(target, workIntent, warnings);
  const nextDecision = createNextDecision(target.relationship, workIntent, safety.requiresApproval);
  const contextArtifacts = options.contextArtifacts ?? [];
  const ledgerArtifacts = options.ledgerArtifacts ?? [];
  const artifact: TargetIntentBoundaryArtifact = {
    schemaVersion: TARGET_INTENT_BOUNDARY_SCHEMA_VERSION,
    generatedAt: redactSecrets(options.timestamp),
    objective: {
      raw: rawObjective,
      normalized,
      workIntent,
    },
    harness: {
      root: harnessRoot,
      branch,
      commit,
    },
    target: {
      relationship: target.relationship,
      root: target.root,
      equalsHarness: target.equalsHarness,
      dirtyState,
      confidence: target.confidence,
    },
    artifacts: {
      root: artifactsRoot,
      boundaryPath: resolvedBoundaryPath,
      contextPackagePath: `${artifactsRoot}/final-prompt-package.md`,
      ledgersPath: `${artifactsRoot}/commands-ledger.json`,
    },
    scope: {
      mutationPolicy,
      allowedPaths: chooseAllowedPaths(
        target.relationship,
        target.root,
        harnessRoot,
        artifactsRoot
      ),
      forbiddenPaths: ['.env', '**/.env', '**/.env.*', '**/secrets/**'],
      approvalRequiredPaths: chooseApprovalRequiredPaths(target.relationship, target.root),
      nonEnforcementBoundary: true,
    },
    evidence: {
      sourceSignals: [
        {
          kind: 'user_request',
          source: 'objective.raw',
          value: summarizeSignal(rawObjective),
          confidence: 'high',
        },
        {
          kind: 'compile_input',
          source: 'options.cwd',
          value: harnessRoot,
          confidence: 'high',
        },
        {
          kind: 'route',
          source: 'options.routeId',
          value: routeId,
          confidence: routeId === 'unknown' ? 'unknown' : 'medium',
        },
        {
          kind: 'inferred',
          source: 'objective.workIntent',
          value: workIntent,
          confidence: workIntent === 'unknown' ? 'unknown' : 'medium',
        },
        ...target.signals,
      ],
      baselineRequired: workIntent === 'bug_fix',
      contextArtifacts,
      ledgerArtifacts,
      warnings,
    },
    validation: {
      baselineCommands:
        workIntent === 'bug_fix'
          ? ['capture baseline reproduction or failing validation before source mutation']
          : [],
      implementationCommands: ['bun run type-check', 'bun run test'],
      evaluatorCommands: ['bun run validate'],
    },
    safety,
    nextDecision,
  };

  return targetIntentBoundarySchema.parse(artifact);
}

function classifyWorkIntent(normalizedObjective: string): TargetIntentBoundaryWorkIntent {
  if (/\b(fix|bug|crash|failing|failure|regression|broken)\b/.test(normalizedObjective)) {
    return 'bug_fix';
  }
  if (/\b(refactor|restructure|simplify|cleanup|clean up)\b/.test(normalizedObjective)) {
    return 'refactor';
  }
  if (/\b(investigate|diagnose|debug|root cause|why)\b/.test(normalizedObjective)) {
    return 'investigation';
  }
  if (
    /\b(validate|validation|evaluate|evaluation|verify|coverage|audit)\b/.test(normalizedObjective)
  ) {
    return 'validation_evaluation';
  }
  if (/\b(docs|documentation|spec|workflow|yaml)\b/.test(normalizedObjective)) {
    return 'docs_spec_workflow';
  }
  if (
    /\b(archon|aco|agentic context orchestrator|context orchestrator|context-orchestrator|bmad|harness)\b/.test(
      normalizedObjective
    )
  ) {
    return 'harness_improvement';
  }
  if (/\b(add|create|implement|support|feature|build|enable)\b/.test(normalizedObjective)) {
    return 'feature_change';
  }
  return 'unknown';
}

async function resolveTarget(input: {
  harnessRoot: string;
  rawObjective: string;
  normalizedObjective: string;
  workIntent: TargetIntentBoundaryWorkIntent;
  explicitTargetRoot?: string;
  explicitTargetRelationship?: TargetIntentBoundaryRelationship;
}): Promise<TargetResolution> {
  if (input.explicitTargetRoot !== undefined || input.explicitTargetRelationship !== undefined) {
    return resolveExplicitTarget(input);
  }

  const sourceSignals: TargetIntentBoundarySourceSignal[] = [];
  const warnings: TargetIntentBoundaryWarning[] = [];
  const normalized = input.normalizedObjective;

  if (isArtifactOnlyObjective(normalized, input.workIntent)) {
    return {
      relationship: 'artifact_only',
      root: null,
      equalsHarness: false,
      confidence: 'high',
      signals: [
        {
          kind: 'inferred',
          source: 'objective.normalized',
          value: 'artifact_only',
          confidence: 'high',
        },
      ],
      warnings,
      unresolvedRegisteredProject: false,
      unresolvedExternalReference: false,
    };
  }

  if (/\bcurrent repo(?:sitory)?\b/.test(normalized)) {
    return {
      relationship: 'current_repo',
      root: input.harnessRoot,
      equalsHarness: true,
      confidence: 'high',
      signals: [
        {
          kind: 'user_request',
          source: 'objective.normalized',
          value: 'current repo',
          confidence: 'high',
        },
      ],
      warnings,
      unresolvedRegisteredProject: false,
      unresolvedExternalReference: false,
    };
  }

  if (/\bregistered project\b|\bproject id\b/.test(normalized)) {
    warnings.push({
      code: 'source_missing',
      message: 'Registered project target was requested, but no resolver is available in v1.',
      source: 'objective.normalized',
    });
    warnings.push({
      code: 'target_unknown',
      message: 'Target remains unknown until registered project evidence is resolved.',
      source: 'objective.normalized',
    });
    return unknownTarget(sourceSignals, warnings, true, false);
  }

  const explicitPath = findExplicitAbsolutePath(input.rawObjective);
  if (explicitPath !== null) {
    const resolvedPath = await resolveExistingPath(explicitPath);
    if (resolvedPath !== null) {
      const equalsHarness = resolvedPath === input.harnessRoot;
      return {
        relationship: equalsHarness ? 'same_as_harness' : 'external_repo',
        root: resolvedPath,
        equalsHarness,
        confidence: 'high',
        signals: [
          {
            kind: 'user_request',
            source: 'objective.normalized',
            value: resolvedPath,
            confidence: 'high',
          },
        ],
        warnings,
        unresolvedRegisteredProject: false,
        unresolvedExternalReference: false,
      };
    }
    warnings.push({
      code: 'source_missing',
      message: 'External path reference was present but could not be resolved safely.',
      source: explicitPath,
    });
    warnings.push({
      code: 'target_unknown',
      message: 'Target remains unknown until the external path is resolved.',
      source: explicitPath,
    });
    return unknownTarget(sourceSignals, warnings, false, true);
  }

  if (
    /\b(archon|aco|agentic context orchestrator|context orchestrator|context-orchestrator|bmad)\b/.test(
      normalized
    )
  ) {
    return {
      relationship: 'same_as_harness',
      root: input.harnessRoot,
      equalsHarness: true,
      confidence: 'high',
      signals: [
        {
          kind: 'user_request',
          source: 'objective.normalized',
          value: 'archon/aco/context-orchestrator',
          confidence: 'high',
        },
      ],
      warnings,
      unresolvedRegisteredProject: false,
      unresolvedExternalReference: false,
    };
  }

  warnings.push({
    code: 'target_unknown',
    message:
      'Objective did not explicitly select Archon, current repo, registered project, external repo, or artifact-only work.',
    source: 'objective.normalized',
  });
  return unknownTarget(sourceSignals, warnings, false, false);
}

function resolveExplicitTarget(input: {
  harnessRoot: string;
  explicitTargetRoot?: string;
  explicitTargetRelationship?: TargetIntentBoundaryRelationship;
}): TargetResolution {
  const root = input.explicitTargetRoot ? resolve(input.explicitTargetRoot) : input.harnessRoot;
  const equalsHarness = root === input.harnessRoot;
  const relationship =
    input.explicitTargetRelationship ?? (equalsHarness ? 'same_as_harness' : 'external_repo');
  return {
    relationship,
    root: relationship === 'artifact_only' ? null : root,
    equalsHarness,
    confidence: 'high',
    signals: [
      {
        kind: 'compile_input',
        source: 'explicitTargetRoot',
        value: root,
        confidence: 'high',
      },
    ],
    warnings: [],
    unresolvedRegisteredProject: false,
    unresolvedExternalReference: false,
  };
}

function unknownTarget(
  signals: TargetIntentBoundarySourceSignal[],
  warnings: TargetIntentBoundaryWarning[],
  unresolvedRegisteredProject: boolean,
  unresolvedExternalReference: boolean
): TargetResolution {
  return {
    relationship: 'unknown',
    root: null,
    equalsHarness: false,
    confidence: 'unknown',
    signals: [
      ...signals,
      {
        kind: 'inferred',
        source: 'target.relationship',
        value: 'unknown',
        confidence: 'unknown',
      },
    ],
    warnings,
    unresolvedRegisteredProject,
    unresolvedExternalReference,
  };
}

function isArtifactOnlyObjective(
  normalizedObjective: string,
  workIntent: TargetIntentBoundaryWorkIntent
): boolean {
  return (
    workIntent === 'validation_evaluation' &&
    (/\b(no source|without source|no code|artifact-only|read-only)\b/.test(normalizedObjective) ||
      /\b(spec coverage|traceability|validate)\b/.test(normalizedObjective))
  );
}

function findExplicitAbsolutePath(normalizedObjective: string): string | null {
  const tokens = normalizedObjective.split(/\s+/);
  for (const token of tokens) {
    const cleaned = token.replace(/^[("'`]+|[).,"'`]+$/g, '');
    if (cleaned.startsWith('/') && !cleaned.includes('..') && cleaned.length > 1) {
      return cleaned;
    }
  }
  return null;
}

async function resolveExistingPath(path: string): Promise<string | null> {
  try {
    const stats = await lstat(path);
    if (!stats.isDirectory()) return null;
    return await realpath(path);
  } catch {
    return null;
  }
}

function chooseMutationPolicy(
  relationship: TargetIntentBoundaryRelationship,
  workIntent: TargetIntentBoundaryWorkIntent
): TargetIntentBoundaryMutationPolicy {
  if (relationship === 'artifact_only') {
    return workIntent === 'validation_evaluation' ? 'read_only' : 'artifact_only';
  }
  if (relationship === 'same_as_harness') return 'harness_only';
  if (relationship === 'current_repo' || relationship === 'external_repo') return 'target_only';
  return 'read_only';
}

function chooseAllowedPaths(
  relationship: TargetIntentBoundaryRelationship,
  targetRoot: string | null,
  harnessRoot: string,
  artifactsRoot: string
): string[] {
  if (relationship === 'artifact_only') return [artifactsRoot];
  if (targetRoot !== null) return [targetRoot];
  if (relationship === 'same_as_harness') return [harnessRoot];
  return [artifactsRoot];
}

function chooseApprovalRequiredPaths(
  relationship: TargetIntentBoundaryRelationship,
  targetRoot: string | null
): string[] {
  if (relationship === 'unknown') return ['<target-root>'];
  if (relationship === 'external_repo' && targetRoot !== null) return [targetRoot];
  return [];
}

function createSafety(
  target: TargetResolution,
  workIntent: TargetIntentBoundaryWorkIntent,
  warnings: TargetIntentBoundaryWarning[]
): TargetIntentBoundaryArtifact['safety'] {
  const approvalReasons: string[] = [];
  if (target.relationship === 'unknown') {
    approvalReasons.push('Target relationship is unknown.');
  }
  if (target.unresolvedRegisteredProject) {
    approvalReasons.push('Registered project resolver is not available in v1.');
  }
  if (target.unresolvedExternalReference) {
    approvalReasons.push('External repository path could not be resolved safely.');
  }
  if (workIntent === 'unknown') {
    approvalReasons.push('Work intent is unknown.');
  }
  for (const warning of warnings) {
    if (warning.code === 'source_conflict') {
      approvalReasons.push(warning.message);
    }
  }
  return {
    requiresApproval: approvalReasons.length > 0,
    approvalReasons,
  };
}

function createNextDecision(
  relationship: TargetIntentBoundaryRelationship,
  workIntent: TargetIntentBoundaryWorkIntent,
  requiresApproval: boolean
): TargetIntentBoundaryArtifact['nextDecision'] {
  if (requiresApproval) {
    return {
      kind: 'approval_required',
      reason: 'Target or intent evidence is not explicit enough for implementation.',
    };
  }
  if (relationship === 'unknown') {
    return {
      kind: 'blocked',
      reason: 'Target relationship could not be inferred.',
    };
  }
  if (workIntent === 'unknown') {
    return {
      kind: 'needs_correct_course',
      reason: 'Work intent could not be inferred.',
    };
  }
  return {
    kind: 'ready_for_implementation',
    reason: 'Target, intent, and mutation policy are explicit enough for implementation planning.',
  };
}

function createIntentWarnings(
  workIntent: TargetIntentBoundaryWorkIntent
): TargetIntentBoundaryWarning[] {
  if (workIntent !== 'unknown') return [];
  return [
    {
      code: 'intent_unknown',
      message: 'Objective did not contain enough signal to classify work intent.',
      source: 'objective.normalized',
    },
  ];
}

function createConfidenceWarnings(
  confidence: TargetIntentBoundaryConfidence
): TargetIntentBoundaryWarning[] {
  if (confidence !== 'low' && confidence !== 'unknown') return [];
  return [
    {
      code: 'low_confidence',
      message: 'Target relationship confidence is weak.',
      source: 'target.confidence',
    },
  ];
}

function summarizeSignal(value: string): string {
  const singleLine = value.replace(/\s+/g, ' ').trim();
  return singleLine.length <= 160 ? singleLine : `${singleLine.slice(0, 157)}...`;
}

async function getGitBranch(cwd: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['-C', cwd, 'branch', '--show-current'], {
      timeout: 5000,
    });
    const branch = stdout.trim();
    return branch.length > 0 ? branch : 'unknown';
  } catch {
    return 'unknown';
  }
}

async function getGitCommit(cwd: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['-C', cwd, 'rev-parse', 'HEAD'], {
      timeout: 5000,
    });
    const commit = stdout.trim();
    return commit.length > 0 ? commit : 'unknown';
  } catch {
    return 'unknown';
  }
}

async function getDirtyState(cwd: string): Promise<TargetIntentBoundaryDirtyState> {
  try {
    const { stdout } = await execFileAsync('git', ['-C', cwd, 'status', '--short'], {
      timeout: 5000,
    });
    return stdout.trim().length > 0 ? 'dirty' : 'clean';
  } catch {
    return 'unknown';
  }
}
