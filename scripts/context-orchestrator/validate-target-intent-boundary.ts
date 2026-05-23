import { execFileSync } from 'node:child_process';
import { lstatSync, realpathSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

export const TARGET_INTENT_BOUNDARY_SCHEMA_VERSION = 'aco.target-intent-boundary.v1' as const;

export type TargetIntentState = 'ready' | 'blocked' | 'needs_decision' | 'unknown';
export type TargetIntentSeverity = 'blocker' | 'decision' | 'warning';
export type TargetIntentCode =
  | 'objective_missing'
  | 'target_unknown'
  | 'target_relationship_conflict'
  | 'intent_unknown'
  | 'baseline_evidence_required'
  | 'external_target_requires_decision'
  | 'registered_project_unresolved'
  | 'target_path_unresolved'
  | 'target_confidence_low'
  | 'git_inspection_failed';

export type WorkIntent =
  | 'bug_fix'
  | 'feature_change'
  | 'refactor'
  | 'investigation'
  | 'docs_spec_workflow'
  | 'validation_evaluation'
  | 'harness_improvement'
  | 'unknown';

export type TargetRelationship =
  | 'same_as_harness'
  | 'current_repo'
  | 'registered_project'
  | 'external_repo'
  | 'artifact_only'
  | 'unknown';

export type DirtyState = 'clean' | 'dirty' | 'unknown' | 'not_applicable';
export type Confidence = 'high' | 'medium' | 'low' | 'unknown';
export type MutationPolicy =
  | 'read_only'
  | 'artifact_only'
  | 'target_only'
  | 'harness_only'
  | 'target_and_harness';

export interface TargetIntentFinding {
  code: TargetIntentCode;
  severity: TargetIntentSeverity;
  message: string;
  evidence?: string;
}

export interface TargetIntentReason {
  code: TargetIntentCode;
  severity: TargetIntentSeverity;
  count: number;
  message: string;
}

export interface TargetIntentEvidence {
  kind: 'git' | 'source_signal' | 'finding';
  summary: string;
}

export interface SourceSignal {
  kind: 'user_request' | 'compile_input' | 'explicit_input' | 'inferred' | 'git';
  source: string;
  value: string;
  confidence: Confidence;
}

export interface BoundaryWarning {
  code: TargetIntentCode;
  message: string;
  source?: string;
}

export interface TargetIntentBoundary {
  schemaVersion: typeof TARGET_INTENT_BOUNDARY_SCHEMA_VERSION;
  generatedAt?: string;
  objective: {
    raw: string;
    normalized: string;
    workIntent: WorkIntent;
  };
  harness: {
    root: string;
    branch: string;
    commit: string;
    dirtyState: DirtyState;
  };
  target: {
    relationship: TargetRelationship;
    root: string | null;
    equalsHarness: boolean;
    confidence: Confidence;
  };
  scope: {
    mutationPolicy: MutationPolicy;
    allowedPaths: string[];
    forbiddenPaths: string[];
    approvalRequiredPaths: string[];
    nonEnforcementBoundary: true;
  };
  evidence: {
    sourceSignals: SourceSignal[];
    baselineRequired: boolean;
    baselineEvidence: string[];
    warnings: BoundaryWarning[];
  };
  safety: {
    requiresApproval: boolean;
    approvalReasons: string[];
  };
  nextDecision: {
    kind: 'ready_for_implementation' | 'decision_required' | 'blocked' | 'correct_course_required';
    reason: string;
  };
}

export interface TargetIntentReport {
  schemaVersion: typeof TARGET_INTENT_BOUNDARY_SCHEMA_VERSION;
  state: TargetIntentState;
  summary: string;
  reasons: TargetIntentReason[];
  blockers: TargetIntentFinding[];
  warnings: TargetIntentFinding[];
  evidence: TargetIntentEvidence[];
  nextRecommendedAction: string;
  checkedAt?: string;
  boundary: TargetIntentBoundary;
}

export interface GitSnapshot {
  branch: string;
  commit: string;
  dirtyState: DirtyState;
  inspectionErrors?: string[];
}

export interface EvaluateTargetIntentOptions {
  cwd: string;
  objective?: string;
  timestamp?: string;
  targetRoot?: string;
  targetRelationship?: TargetRelationship;
  baselineEvidence?: string[];
  gitSnapshot?: GitSnapshot;
}

interface TargetResolution {
  relationship: TargetRelationship;
  root: string | null;
  equalsHarness: boolean;
  confidence: Confidence;
  signals: SourceSignal[];
  findings: TargetIntentFinding[];
}

export async function evaluateTargetIntentBoundary(
  options: EvaluateTargetIntentOptions
): Promise<TargetIntentReport> {
  const harnessRoot = resolve(options.cwd);
  const rawObjective = redactSensitiveText(options.objective?.trim() ?? '');
  const normalizedObjective = normalizeObjective(rawObjective);
  const gitSnapshot = options.gitSnapshot ?? collectGitSnapshot(harnessRoot);
  const baselineEvidence = (options.baselineEvidence ?? []).map(redactSensitiveText);
  const workIntent =
    rawObjective.length === 0 ? 'unknown' : classifyWorkIntent(normalizedObjective);
  const target = resolveTarget({
    harnessRoot,
    rawObjective,
    normalizedObjective,
    workIntent,
    targetRoot: options.targetRoot,
    targetRelationship: options.targetRelationship,
  });
  const findings = [
    ...gitFindings(gitSnapshot),
    ...objectiveFindings(rawObjective, workIntent),
    ...target.findings,
    ...baselineFindings(workIntent, baselineEvidence),
  ];
  const boundary = buildBoundary({
    timestamp: options.timestamp,
    harnessRoot,
    rawObjective,
    normalizedObjective,
    workIntent,
    gitSnapshot,
    target,
    baselineEvidence,
    findings,
  });
  const blockers = findings.filter(finding => finding.severity === 'blocker');
  const decisions = findings.filter(finding => finding.severity === 'decision');
  const warnings = findings.filter(finding => finding.severity === 'warning');
  const state: TargetIntentState =
    blockers.length > 0
      ? 'blocked'
      : decisions.length > 0
        ? 'needs_decision'
        : warnings.length > 0
          ? 'unknown'
          : 'ready';

  return {
    schemaVersion: TARGET_INTENT_BOUNDARY_SCHEMA_VERSION,
    state,
    summary: summaryFor(state, blockers.length, decisions.length, warnings.length),
    reasons: summarizeReasons(findings),
    blockers: [...blockers, ...decisions],
    warnings,
    evidence: evidenceFor(gitSnapshot, boundary, findings),
    nextRecommendedAction: nextActionFor(state),
    checkedAt: options.timestamp,
    boundary,
  };
}

export function renderTargetIntentReport(report: TargetIntentReport): string {
  return [
    '# ACO Target Intent Boundary Gate',
    '',
    `State: ${report.state}`,
    `Summary: ${report.summary}`,
    `Next: ${report.nextRecommendedAction}`,
    '',
    `Target: ${report.boundary.target.relationship}`,
    `Work Intent: ${report.boundary.objective.workIntent}`,
    `Mutation Policy: ${report.boundary.scope.mutationPolicy}`,
    '',
    '## Reasons',
    ...renderReasons(report.reasons),
    '',
    '## Blockers',
    ...renderFindings(report.blockers),
    '',
    '## Warnings',
    ...renderFindings(report.warnings),
  ].join('\n');
}

function buildBoundary(input: {
  timestamp?: string;
  harnessRoot: string;
  rawObjective: string;
  normalizedObjective: string;
  workIntent: WorkIntent;
  gitSnapshot: GitSnapshot;
  target: TargetResolution;
  baselineEvidence: string[];
  findings: TargetIntentFinding[];
}): TargetIntentBoundary {
  const mutationPolicy = chooseMutationPolicy(input.target.relationship);
  const approvalRequiredPaths =
    input.target.relationship === 'external_repo'
      ? [input.target.root ?? '<target-root>']
      : input.target.relationship === 'unknown'
        ? ['<target-root>']
        : [];
  const sourceSignals: SourceSignal[] = [
    {
      kind: 'user_request',
      source: 'objective.raw',
      value: summarizeSignal(input.rawObjective || '<missing>'),
      confidence: input.rawObjective.length > 0 ? 'high' : 'unknown',
    },
    {
      kind: 'compile_input',
      source: 'options.cwd',
      value: input.harnessRoot,
      confidence: 'high',
    },
    {
      kind: 'git',
      source: 'git branch',
      value: input.gitSnapshot.branch || '<detached>',
      confidence: input.gitSnapshot.branch.length > 0 ? 'medium' : 'unknown',
    },
    {
      kind: 'inferred',
      source: 'objective.workIntent',
      value: input.workIntent,
      confidence: input.workIntent === 'unknown' ? 'unknown' : 'medium',
    },
    ...input.target.signals,
  ];
  const approvalReasons = input.findings
    .filter(finding => finding.code === 'external_target_requires_decision')
    .map(finding => finding.message);

  return {
    schemaVersion: TARGET_INTENT_BOUNDARY_SCHEMA_VERSION,
    generatedAt: input.timestamp,
    objective: {
      raw: input.rawObjective || '<missing>',
      normalized: input.normalizedObjective || '<missing>',
      workIntent: input.workIntent,
    },
    harness: {
      root: input.harnessRoot,
      branch: input.gitSnapshot.branch || 'unknown',
      commit: input.gitSnapshot.commit || 'unknown',
      dirtyState:
        input.target.relationship === 'artifact_only'
          ? 'not_applicable'
          : input.gitSnapshot.dirtyState,
    },
    target: {
      relationship: input.target.relationship,
      root: input.target.root,
      equalsHarness: input.target.equalsHarness,
      confidence: input.target.confidence,
    },
    scope: {
      mutationPolicy,
      allowedPaths: chooseAllowedPaths(input.target, input.harnessRoot),
      forbiddenPaths: ['.env', '**/.env', '**/.env.*', '**/secrets/**'],
      approvalRequiredPaths,
      nonEnforcementBoundary: true,
    },
    evidence: {
      sourceSignals,
      baselineRequired: input.workIntent === 'bug_fix',
      baselineEvidence: input.baselineEvidence,
      warnings: input.findings
        .filter(finding => finding.severity !== 'blocker')
        .map(finding => ({
          code: finding.code,
          message: finding.message,
          ...(finding.evidence !== undefined ? { source: finding.evidence } : {}),
        })),
    },
    safety: {
      requiresApproval: approvalReasons.length > 0,
      approvalReasons,
    },
    nextDecision: nextDecisionFor(input.findings),
  };
}

function resolveTarget(input: {
  harnessRoot: string;
  rawObjective: string;
  normalizedObjective: string;
  workIntent: WorkIntent;
  targetRoot?: string;
  targetRelationship?: TargetRelationship;
}): TargetResolution {
  if (input.targetRoot !== undefined || input.targetRelationship !== undefined) {
    return resolveExplicitTarget(input.harnessRoot, input.targetRoot, input.targetRelationship);
  }

  if (isArtifactOnlyObjective(input.normalizedObjective, input.workIntent)) {
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
      findings: [],
    };
  }

  if (/\bcurrent repo(?:sitory)?\b/.test(input.normalizedObjective)) {
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
      findings: [],
    };
  }

  if (/\bregistered project\b|\bproject id\b/.test(input.normalizedObjective)) {
    return unknownTarget([
      finding(
        'registered_project_unresolved',
        'decision',
        'Registered project target was requested, but this script-level gate has no project resolver.'
      ),
    ]);
  }

  const explicitPath = findExplicitAbsolutePath(input.rawObjective);
  if (explicitPath !== null) {
    const resolvedPath = resolveExistingDirectory(explicitPath);
    if (resolvedPath === null) {
      return unknownTarget([
        finding(
          'target_path_unresolved',
          'blocker',
          'External path reference was present but could not be resolved as a directory.',
          redactSensitiveText(explicitPath)
        ),
      ]);
    }
    const equalsHarness = resolvedPath === input.harnessRoot;
    const relationship = equalsHarness ? 'same_as_harness' : 'external_repo';
    const findings =
      relationship === 'external_repo'
        ? [
            finding(
              'external_target_requires_decision',
              'decision',
              'External target path requires an explicit handoff decision before mutation.',
              resolvedPath
            ),
          ]
        : [];
    return {
      relationship,
      root: resolvedPath,
      equalsHarness,
      confidence: 'high',
      signals: [
        {
          kind: 'user_request',
          source: 'objective.path',
          value: resolvedPath,
          confidence: 'high',
        },
      ],
      findings,
    };
  }

  if (
    /\b(archon|aco|agentic context orchestrator|context orchestrator|context-orchestrator|bmad|harness)\b/.test(
      input.normalizedObjective
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
      findings: [],
    };
  }

  return unknownTarget([
    finding(
      'target_unknown',
      'decision',
      'Objective did not explicitly select Archon, current repo, registered project, external repo, or artifact-only work.'
    ),
  ]);
}

function resolveExplicitTarget(
  harnessRoot: string,
  targetRoot: string | undefined,
  targetRelationship: TargetRelationship | undefined
): TargetResolution {
  if (targetRelationship === 'unknown') {
    return unknownTarget([
      finding('target_unknown', 'decision', 'Explicit target relationship was unknown.'),
    ]);
  }

  if (targetRelationship === 'registered_project') {
    return {
      relationship: 'registered_project',
      root: null,
      equalsHarness: false,
      confidence: 'medium',
      signals: [
        {
          kind: 'explicit_input',
          source: 'targetRelationship',
          value: 'registered_project',
          confidence: 'medium',
        },
      ],
      findings: [
        finding(
          'registered_project_unresolved',
          'decision',
          'Registered project target was provided, but this script-level gate has no project resolver.'
        ),
      ],
    };
  }

  const resolvedRoot =
    targetRoot === undefined ? undefined : resolveTargetRoot(harnessRoot, targetRoot);
  const relationship =
    targetRelationship ?? (resolvedRoot === undefined ? 'same_as_harness' : 'external_repo');
  const root =
    relationship === 'artifact_only' ||
    (relationship === 'external_repo' && resolvedRoot === undefined)
      ? null
      : (resolvedRoot ?? harnessRoot);
  const equalsHarness = root === harnessRoot;
  const conflictFinding = explicitTargetConflictFinding(relationship, resolvedRoot, equalsHarness);
  const findings =
    conflictFinding !== null
      ? [conflictFinding]
      : relationship === 'external_repo'
        ? [
            finding(
              'external_target_requires_decision',
              'decision',
              'External target path requires an explicit handoff decision before mutation.',
              root ?? '<target-root>'
            ),
          ]
        : [];

  return {
    relationship,
    root,
    equalsHarness,
    confidence: conflictFinding === null ? 'high' : 'low',
    signals: [
      {
        kind: 'explicit_input',
        source: targetRoot === undefined ? 'targetRelationship' : 'targetRoot',
        value: root ?? relationship,
        confidence: 'high',
      },
    ],
    findings,
  };
}

function explicitTargetConflictFinding(
  relationship: Exclude<TargetRelationship, 'registered_project' | 'unknown'>,
  resolvedRoot: string | undefined,
  equalsHarness: boolean
): TargetIntentFinding | null {
  if ((relationship === 'same_as_harness' || relationship === 'current_repo') && !equalsHarness) {
    return finding(
      'target_relationship_conflict',
      'decision',
      'Explicit target relationship requires the harness root, but target root points elsewhere.',
      resolvedRoot
    );
  }

  if (relationship === 'artifact_only' && resolvedRoot !== undefined) {
    return finding(
      'target_relationship_conflict',
      'decision',
      'Artifact-only target relationship must not include a mutable target root.',
      resolvedRoot
    );
  }

  if (relationship === 'external_repo' && resolvedRoot !== undefined && equalsHarness) {
    return finding(
      'target_relationship_conflict',
      'decision',
      'External target relationship points at the harness root.',
      resolvedRoot
    );
  }

  return null;
}

function unknownTarget(findings: TargetIntentFinding[]): TargetResolution {
  return {
    relationship: 'unknown',
    root: null,
    equalsHarness: false,
    confidence: 'unknown',
    signals: [
      {
        kind: 'inferred',
        source: 'target.relationship',
        value: 'unknown',
        confidence: 'unknown',
      },
    ],
    findings: [
      ...findings,
      finding('target_confidence_low', 'warning', 'Target relationship confidence is weak.'),
    ],
  };
}

function resolveTargetRoot(harnessRoot: string, targetRoot: string): string {
  const absoluteRoot = resolve(harnessRoot, targetRoot);
  return resolveExistingDirectory(absoluteRoot) ?? absoluteRoot;
}

function objectiveFindings(objective: string, workIntent: WorkIntent): TargetIntentFinding[] {
  const findings: TargetIntentFinding[] = [];
  if (objective.length === 0) {
    findings.push(finding('objective_missing', 'blocker', 'Objective is required.'));
  }
  if (workIntent === 'unknown') {
    findings.push(
      finding(
        'intent_unknown',
        'decision',
        'Objective did not contain enough signal to classify work intent.'
      )
    );
  }
  return findings;
}

function baselineFindings(
  workIntent: WorkIntent,
  baselineEvidence: string[]
): TargetIntentFinding[] {
  if (workIntent !== 'bug_fix' || baselineEvidence.length > 0) return [];
  return [
    finding(
      'baseline_evidence_required',
      'blocker',
      'Bug-fix work requires baseline reproduction, failing validation, or an explicit no-repro decision before implementation.'
    ),
  ];
}

function gitFindings(snapshot: GitSnapshot): TargetIntentFinding[] {
  return (snapshot.inspectionErrors ?? []).map(error =>
    finding('git_inspection_failed', 'warning', 'Git metadata could not be fully inspected.', error)
  );
}

function collectGitSnapshot(cwd: string): GitSnapshot {
  const errors: string[] = [];
  const branch = git(cwd, ['branch', '--show-current'], errors).trim();
  const commit = git(cwd, ['rev-parse', 'HEAD'], errors).trim();
  const status = git(cwd, ['status', '--short'], errors);
  return {
    branch,
    commit,
    dirtyState: status.trim().length > 0 ? 'dirty' : 'clean',
    inspectionErrors: errors,
  };
}

function git(cwd: string, args: string[], errors: string[]): string {
  try {
    return execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
  } catch (error) {
    const failure = error as { stderr?: Buffer; message?: string };
    errors.push(failure.stderr?.toString().trim() ?? failure.message ?? 'unknown git error');
    return '';
  }
}

function classifyWorkIntent(normalizedObjective: string): WorkIntent {
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
  if (/\b(docs|documentation|spec|workflow|yaml|prompt)\b/.test(normalizedObjective)) {
    return 'docs_spec_workflow';
  }
  if (
    /\b(archon|aco|agentic context orchestrator|context orchestrator|context-orchestrator|bmad|harness)\b/.test(
      normalizedObjective
    )
  ) {
    return 'harness_improvement';
  }
  if (/\b(add|create|implement|support|feature|build|enable|port)\b/.test(normalizedObjective)) {
    return 'feature_change';
  }
  return 'unknown';
}

function normalizeObjective(objective: string): string {
  return objective.toLowerCase().replace(/\s+/g, ' ').trim();
}

function isArtifactOnlyObjective(normalizedObjective: string, workIntent: WorkIntent): boolean {
  return (
    workIntent === 'validation_evaluation' &&
    (/\b(no source|without source|no code|artifact-only|read-only)\b/.test(normalizedObjective) ||
      /\b(spec coverage|traceability)\b/.test(normalizedObjective))
  );
}

function findExplicitAbsolutePath(objective: string): string | null {
  for (const token of objective.split(/\s+/)) {
    const cleaned = token.replace(/^[("'`]+|[).,"'`]+$/g, '');
    if (isAbsolute(cleaned) && !cleaned.includes('..') && cleaned.length > 1) {
      return cleaned;
    }
  }
  return null;
}

function resolveExistingDirectory(path: string): string | null {
  try {
    const stats = lstatSync(path);
    if (!stats.isDirectory()) return null;
    return realpathSync(path);
  } catch {
    return null;
  }
}

function chooseMutationPolicy(relationship: TargetRelationship): MutationPolicy {
  if (relationship === 'artifact_only') return 'read_only';
  if (relationship === 'same_as_harness') return 'harness_only';
  if (relationship === 'current_repo' || relationship === 'external_repo') return 'target_only';
  return 'read_only';
}

function chooseAllowedPaths(target: TargetResolution, harnessRoot: string): string[] {
  if (target.relationship === 'artifact_only') return ['<artifact-root>'];
  if (target.root !== null) return [target.root];
  if (target.relationship === 'same_as_harness') return [harnessRoot];
  if (target.relationship === 'registered_project') return ['<registered-project-root>'];
  if (target.relationship === 'external_repo') return ['<target-root>'];
  return ['<artifact-root>'];
}

function nextDecisionFor(findings: TargetIntentFinding[]): TargetIntentBoundary['nextDecision'] {
  if (findings.some(finding => finding.severity === 'blocker')) {
    return { kind: 'blocked', reason: 'Required target/intent evidence is missing.' };
  }
  if (findings.some(finding => finding.severity === 'decision')) {
    return {
      kind: 'decision_required',
      reason: 'Target or intent evidence needs an explicit decision before implementation.',
    };
  }
  if (findings.some(finding => finding.severity === 'warning')) {
    return {
      kind: 'correct_course_required',
      reason: 'Target/intent evidence has warnings that should be reviewed.',
    };
  }
  return {
    kind: 'ready_for_implementation',
    reason: 'Target, intent, and mutation policy are explicit enough for implementation planning.',
  };
}

function evidenceFor(
  snapshot: GitSnapshot,
  boundary: TargetIntentBoundary,
  findings: TargetIntentFinding[]
): TargetIntentEvidence[] {
  return [
    {
      kind: 'git',
      summary: `branch=${snapshot.branch || '<detached>'}; commit=${snapshot.commit || '<unknown>'}; dirty=${snapshot.dirtyState}`,
    },
    ...boundary.evidence.sourceSignals.slice(0, 8).map(signal => ({
      kind: 'source_signal' as const,
      summary: `${signal.kind}:${signal.source}=${signal.value}`,
    })),
    ...findings.map(item => ({
      kind: 'finding' as const,
      summary: `${item.code}: ${item.message}`,
    })),
  ];
}

function summarizeReasons(findings: TargetIntentFinding[]): TargetIntentReason[] {
  const byKey = new Map<string, TargetIntentReason>();
  for (const item of findings) {
    const key = `${item.code}:${item.severity}`;
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, {
        code: item.code,
        severity: item.severity,
        count: 1,
        message: item.message,
      });
    } else {
      existing.count += 1;
    }
  }
  return [...byKey.values()].sort((left, right) => left.code.localeCompare(right.code));
}

function finding(
  code: TargetIntentCode,
  severity: TargetIntentSeverity,
  message: string,
  evidence?: string
): TargetIntentFinding {
  return {
    code,
    severity,
    message: redactSensitiveText(message),
    ...(evidence !== undefined ? { evidence: redactSensitiveText(evidence) } : {}),
  };
}

function summaryFor(
  state: TargetIntentState,
  blockerCount: number,
  decisionCount: number,
  warningCount: number
): string {
  if (state === 'ready') return 'Target and intent boundary is ready.';
  return `Target and intent boundary found ${String(blockerCount)} blocker(s), ${String(decisionCount)} decision item(s), and ${String(warningCount)} warning(s).`;
}

function nextActionFor(state: TargetIntentState): string {
  switch (state) {
    case 'ready':
      return 'Proceed with the selected implementation stage using the reported mutation policy.';
    case 'blocked':
      return 'Add missing objective, target, or baseline evidence before implementation.';
    case 'needs_decision':
      return 'Choose or confirm the target, external mutation policy, or work intent before implementation.';
    case 'unknown':
      return 'Review warnings and rerun the target intent boundary gate with stronger evidence.';
  }
}

function renderReasons(reasons: TargetIntentReason[]): string[] {
  if (reasons.length === 0) return ['- none'];
  return reasons.map(
    reason => `- ${reason.code} (${reason.severity}, ${String(reason.count)}): ${reason.message}`
  );
}

function renderFindings(findings: TargetIntentFinding[]): string[] {
  if (findings.length === 0) return ['- none'];
  return findings.map(item => {
    const evidence = item.evidence === undefined ? '' : ` - ${item.evidence}`;
    return `- ${item.code} (${item.severity}): ${item.message}${evidence}`;
  });
}

function summarizeSignal(value: string): string {
  const singleLine = redactSensitiveText(value).replace(/\s+/g, ' ').trim();
  return singleLine.length <= 160 ? singleLine : `${singleLine.slice(0, 157)}...`;
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/\b(?:sk|sk-proj|sk-ant|ghp|github_pat)_[A-Za-z0-9_-]{12,}\b/g, '<redacted-secret>')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '<redacted-email>');
}

interface CliOptions extends EvaluateTargetIntentOptions {
  json: boolean;
}

function parseArgs(args: string[]): CliOptions {
  let cwd = process.cwd();
  let objective: string | undefined;
  let timestamp: string | undefined;
  let targetRoot: string | undefined;
  let targetRelationship: TargetRelationship | undefined;
  let json = false;
  const baselineEvidence: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      json = true;
    } else if (arg === '--cwd' && args[index + 1] !== undefined) {
      cwd = args[index + 1] ?? cwd;
      index += 1;
    } else if (arg === '--objective' && args[index + 1] !== undefined) {
      objective = args[index + 1];
      index += 1;
    } else if (arg === '--timestamp' && args[index + 1] !== undefined) {
      timestamp = args[index + 1];
      index += 1;
    } else if (arg === '--target-root' && args[index + 1] !== undefined) {
      targetRoot = args[index + 1];
      index += 1;
    } else if (arg === '--target-relationship' && args[index + 1] !== undefined) {
      targetRelationship = parseTargetRelationship(args[index + 1]);
      index += 1;
    } else if (arg === '--baseline-evidence' && args[index + 1] !== undefined) {
      baselineEvidence.push(args[index + 1] ?? '');
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  return { cwd, objective, timestamp, targetRoot, targetRelationship, baselineEvidence, json };
}

function parseTargetRelationship(value: string): TargetRelationship {
  const allowed: TargetRelationship[] = [
    'same_as_harness',
    'current_repo',
    'registered_project',
    'external_repo',
    'artifact_only',
    'unknown',
  ];
  if (allowed.includes(value as TargetRelationship)) return value as TargetRelationship;
  throw new Error(`Invalid --target-relationship: ${value}`);
}

async function main(args: string[]): Promise<number> {
  const options = parseArgs(args);
  const report = await evaluateTargetIntentBoundary(options);
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderTargetIntentReport(report));
  }
  return report.state === 'ready' ? 0 : 1;
}

if (import.meta.main) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`ACO target intent boundary failed: ${message}`);
    process.exitCode = 1;
  }
}
