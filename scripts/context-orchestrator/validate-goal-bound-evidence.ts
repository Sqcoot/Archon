import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  evaluateTargetIntentBoundary,
  type GitSnapshot,
  type TargetIntentState,
  type TargetRelationship,
  type WorkIntent,
} from './validate-target-intent-boundary';

export const GOAL_BOUND_EVIDENCE_SCHEMA_VERSION = 'aco.goal-bound-evidence.v1' as const;

export type GoalBoundEvidenceState = 'ready' | 'blocked' | 'needs_decision' | 'unknown';
export type GoalBoundEvidenceSeverity = 'blocker' | 'decision' | 'warning';
export type GoalBoundEvidenceCode =
  | 'objective_missing'
  | 'target_intent_not_ready'
  | 'required_evidence_missing'
  | 'evidence_failed'
  | 'evidence_unknown'
  | 'evidence_stale'
  | 'evidence_missing_provenance'
  | 'evidence_unbound_to_objective'
  | 'evidence_objective_mismatch'
  | 'validation_command_missing'
  | 'generated_artifact_lifecycle_missing'
  | 'approval_required';

export type EvidenceKind =
  | 'baseline'
  | 'implementation'
  | 'validation'
  | 'docs'
  | 'decision'
  | 'handoff'
  | 'investigation'
  | 'generated_artifact'
  | 'risk';

export type EvidenceStatus =
  | 'passed'
  | 'failed'
  | 'blocked'
  | 'unknown'
  | 'not_applicable'
  | 'waived';

export type EvidenceFreshness = 'fresh' | 'stale' | 'unknown' | 'waived';

export interface GoalBoundEvidenceInputItem {
  id: string;
  kind: EvidenceKind;
  status: EvidenceStatus;
  summary: string;
  source: string;
  command?: string;
  objectiveHash?: string;
  freshness?: EvidenceFreshness;
  requiresApproval?: boolean;
  consumer?: string;
  sourceInput?: string;
  regenerationCommand?: string;
  driftPolicy?: string;
}

export interface GoalBoundEvidenceFinding {
  code: GoalBoundEvidenceCode;
  severity: GoalBoundEvidenceSeverity;
  message: string;
  evidenceId?: string;
  evidence?: string;
}

export interface GoalBoundEvidenceReason {
  code: GoalBoundEvidenceCode;
  severity: GoalBoundEvidenceSeverity;
  count: number;
  message: string;
}

export interface GoalBoundEvidenceOutputItem {
  kind: 'intent' | 'target_intent' | 'evidence_item' | 'finding';
  summary: string;
}

export interface EvidenceRequirement {
  kind: EvidenceKind;
  reason: string;
  satisfied: boolean;
  evidenceIds: string[];
}

export interface GoalBoundEvidenceClosureItem {
  evidenceId: string;
  kind: EvidenceKind;
  resolver: 'manual' | 'validation' | 'approval';
  reason: string;
  nextAction: string;
  requiresApproval: boolean;
  expectedSuccessEvidence: string[];
}

export interface GoalBoundEvidenceReport {
  schemaVersion: typeof GOAL_BOUND_EVIDENCE_SCHEMA_VERSION;
  state: GoalBoundEvidenceState;
  summary: string;
  reasons: GoalBoundEvidenceReason[];
  blockers: GoalBoundEvidenceFinding[];
  warnings: GoalBoundEvidenceFinding[];
  evidence: GoalBoundEvidenceOutputItem[];
  nextRecommendedAction: string;
  checkedAt?: string;
  contextIntent: {
    objective: string;
    normalizedObjective: string;
    intentHash: string;
    workIntent: WorkIntent;
  };
  requiredEvidence: EvidenceRequirement[];
  closureItems: GoalBoundEvidenceClosureItem[];
}

export interface EvaluateGoalBoundEvidenceOptions {
  cwd: string;
  objective?: string;
  timestamp?: string;
  targetRoot?: string;
  targetRelationship?: TargetRelationship;
  gitSnapshot?: GitSnapshot;
  evidence?: GoalBoundEvidenceInputItem[];
}

const requiredEvidenceByIntent: Record<WorkIntent, EvidenceRequirement[]> = {
  bug_fix: [
    {
      kind: 'baseline',
      reason:
        'Bug fixes require baseline reproduction, failing validation, or an explicit no-repro decision.',
      satisfied: false,
      evidenceIds: [],
    },
    {
      kind: 'implementation',
      reason: 'Bug fixes require changed-files or implementation evidence before completion.',
      satisfied: false,
      evidenceIds: [],
    },
    {
      kind: 'validation',
      reason: 'Bug fixes require post-change validation evidence before completion.',
      satisfied: false,
      evidenceIds: [],
    },
  ],
  feature_change: [
    {
      kind: 'implementation',
      reason: 'Feature work requires implementation evidence before completion.',
      satisfied: false,
      evidenceIds: [],
    },
    {
      kind: 'validation',
      reason: 'Feature work requires validation evidence before completion.',
      satisfied: false,
      evidenceIds: [],
    },
  ],
  refactor: [
    {
      kind: 'implementation',
      reason: 'Refactors require changed-files or implementation evidence before completion.',
      satisfied: false,
      evidenceIds: [],
    },
    {
      kind: 'validation',
      reason: 'Refactors require validation evidence before completion.',
      satisfied: false,
      evidenceIds: [],
    },
  ],
  investigation: [
    {
      kind: 'investigation',
      reason: 'Investigations require findings, evidence, or a next-action report.',
      satisfied: false,
      evidenceIds: [],
    },
  ],
  docs_spec_workflow: [
    {
      kind: 'implementation',
      reason: 'Docs, specs, and workflows require changed-artifact evidence before completion.',
      satisfied: false,
      evidenceIds: [],
    },
    {
      kind: 'validation',
      reason:
        'Docs, specs, and workflows require validation or contract-check evidence before completion.',
      satisfied: false,
      evidenceIds: [],
    },
  ],
  validation_evaluation: [
    {
      kind: 'validation',
      reason: 'Validation/evaluation work requires command, audit, or report evidence.',
      satisfied: false,
      evidenceIds: [],
    },
  ],
  harness_improvement: [
    {
      kind: 'implementation',
      reason: 'Harness improvements require implementation evidence before completion.',
      satisfied: false,
      evidenceIds: [],
    },
    {
      kind: 'validation',
      reason: 'Harness improvements require validation evidence before completion.',
      satisfied: false,
      evidenceIds: [],
    },
  ],
  unknown: [],
};

export async function evaluateGoalBoundEvidence(
  options: EvaluateGoalBoundEvidenceOptions
): Promise<GoalBoundEvidenceReport> {
  const objective = redactSensitiveText(options.objective?.trim() ?? '');
  const normalizedObjective = normalizeObjective(objective);
  const intentHash = hashIntent(normalizedObjective);
  const evidenceItems = (options.evidence ?? []).map(redactEvidenceItem);
  const targetIntent = await evaluateTargetIntentBoundary({
    cwd: options.cwd,
    objective,
    timestamp: options.timestamp,
    targetRoot: options.targetRoot,
    targetRelationship: options.targetRelationship,
    gitSnapshot: options.gitSnapshot,
    baselineEvidence: evidenceItems
      .filter(item => item.kind === 'baseline' && item.status === 'passed')
      .map(item => item.summary),
  });
  const requirements = requirementsFor(targetIntent.boundary.objective.workIntent, evidenceItems);
  const findings = [
    ...objectiveFindings(objective),
    ...targetIntentFindings(targetIntent.state),
    ...requiredEvidenceFindings(requirements, evidenceItems),
    ...evidenceItemFindings(evidenceItems, requirements, intentHash),
  ];
  const blockers = findings.filter(finding => finding.severity === 'blocker');
  const decisions = findings.filter(finding => finding.severity === 'decision');
  const warnings = findings.filter(finding => finding.severity === 'warning');
  const state: GoalBoundEvidenceState =
    blockers.length > 0
      ? 'blocked'
      : decisions.length > 0
        ? 'needs_decision'
        : warnings.length > 0
          ? 'unknown'
          : 'ready';

  return {
    schemaVersion: GOAL_BOUND_EVIDENCE_SCHEMA_VERSION,
    state,
    summary: summaryFor(state, blockers.length, decisions.length, warnings.length),
    reasons: summarizeReasons(findings),
    blockers: [...blockers, ...decisions],
    warnings,
    evidence: evidenceFor(intentHash, targetIntent.state, evidenceItems, findings),
    nextRecommendedAction: nextActionFor(state),
    checkedAt: options.timestamp,
    contextIntent: {
      objective: objective || '<missing>',
      normalizedObjective: normalizedObjective || '<missing>',
      intentHash,
      workIntent: targetIntent.boundary.objective.workIntent,
    },
    requiredEvidence: requirements,
    closureItems: closureItemsFor(findings, requirements),
  };
}

export function renderGoalBoundEvidenceReport(report: GoalBoundEvidenceReport): string {
  return [
    '# ACO Goal-Bound Evidence Gate',
    '',
    `State: ${report.state}`,
    `Summary: ${report.summary}`,
    `Intent Hash: ${report.contextIntent.intentHash}`,
    `Work Intent: ${report.contextIntent.workIntent}`,
    `Next: ${report.nextRecommendedAction}`,
    '',
    '## Required Evidence',
    ...report.requiredEvidence.map(
      item =>
        `- ${item.kind}: ${item.satisfied ? 'satisfied' : 'missing'} (${item.evidenceIds.join(', ') || 'none'})`
    ),
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

function objectiveFindings(objective: string): GoalBoundEvidenceFinding[] {
  return objective.length === 0
    ? [finding('objective_missing', 'blocker', 'Objective is required.')]
    : [];
}

function targetIntentFindings(state: TargetIntentState): GoalBoundEvidenceFinding[] {
  if (state === 'ready') return [];
  const severity: GoalBoundEvidenceSeverity =
    state === 'blocked' ? 'blocker' : state === 'needs_decision' ? 'decision' : 'warning';
  return [
    finding(
      'target_intent_not_ready',
      severity,
      `Target intent boundary returned ${state}; close target/intent issues before claiming goal-bound evidence ready.`
    ),
  ];
}

function requirementsFor(
  workIntent: WorkIntent,
  evidenceItems: GoalBoundEvidenceInputItem[]
): EvidenceRequirement[] {
  return requiredEvidenceByIntent[workIntent].map(requirement => {
    const matching = evidenceItems.filter(
      item => item.kind === requirement.kind && evidenceSatisfiesRequirement(item)
    );
    return {
      ...requirement,
      satisfied: matching.length > 0,
      evidenceIds: matching.map(item => item.id),
    };
  });
}

function requiredEvidenceFindings(
  requirements: EvidenceRequirement[],
  evidenceItems: GoalBoundEvidenceInputItem[]
): GoalBoundEvidenceFinding[] {
  return requirements
    .filter(requirement => !requirement.satisfied)
    .filter(requirement => !evidenceItems.some(item => item.kind === requirement.kind))
    .map(requirement =>
      finding(
        'required_evidence_missing',
        'blocker',
        `Required ${requirement.kind} evidence is missing. ${requirement.reason}`,
        requirement.kind
      )
    );
}

function evidenceItemFindings(
  evidenceItems: GoalBoundEvidenceInputItem[],
  requirements: EvidenceRequirement[],
  intentHash: string
): GoalBoundEvidenceFinding[] {
  const requiredKinds = new Set(requirements.map(requirement => requirement.kind));
  const findings: GoalBoundEvidenceFinding[] = [];

  for (const item of evidenceItems) {
    const isRequiredKind = requiredKinds.has(item.kind);
    if (
      item.id.trim().length === 0 ||
      item.summary.trim().length === 0 ||
      item.source.trim().length === 0
    ) {
      findings.push(
        finding(
          'evidence_missing_provenance',
          'blocker',
          'Evidence item must include id, summary, and source provenance.',
          item.id || item.kind
        )
      );
    }

    if (isRequiredKind && item.objectiveHash === undefined) {
      findings.push(
        finding(
          'evidence_unbound_to_objective',
          'blocker',
          `Required ${item.kind} evidence is not bound to the current intent hash.`,
          item.id
        )
      );
    } else if (item.objectiveHash !== undefined && item.objectiveHash !== intentHash) {
      findings.push(
        finding(
          'evidence_objective_mismatch',
          'blocker',
          `Evidence item intent hash does not match current intent hash ${intentHash}.`,
          item.id
        )
      );
    }

    if (item.status === 'failed' || item.status === 'blocked') {
      findings.push(
        finding(
          'evidence_failed',
          'blocker',
          `Evidence item ${item.id} is ${item.status}.`,
          item.id
        )
      );
    } else if (item.status === 'unknown') {
      findings.push(
        finding('evidence_unknown', 'warning', `Evidence item ${item.id} is unknown.`, item.id)
      );
    }

    if (item.status === 'waived' || item.freshness === 'waived' || item.requiresApproval === true) {
      findings.push(
        finding(
          'approval_required',
          'decision',
          `Evidence item ${item.id} requires approval or an accepted waiver.`,
          item.id
        )
      );
    } else if (isRequiredKind && (item.freshness === 'stale' || item.freshness === 'unknown')) {
      findings.push(
        finding(
          'evidence_stale',
          'blocker',
          `Required ${item.kind} evidence ${item.id} is ${item.freshness}.`,
          item.id
        )
      );
    }

    if (item.kind === 'validation' && item.command === undefined) {
      findings.push(
        finding(
          'validation_command_missing',
          'blocker',
          'Validation evidence must include the command that produced it.',
          item.id
        )
      );
    }

    if (item.kind === 'generated_artifact') {
      const missingLifecycle = [
        ['consumer', item.consumer],
        ['sourceInput', item.sourceInput],
        ['regenerationCommand', item.regenerationCommand],
        ['driftPolicy', item.driftPolicy],
      ]
        .filter(([, value]) => value === undefined || value.trim().length === 0)
        .map(([name]) => name);
      if (missingLifecycle.length > 0) {
        findings.push(
          finding(
            'generated_artifact_lifecycle_missing',
            'blocker',
            `Generated artifact evidence is missing lifecycle field(s): ${missingLifecycle.join(', ')}.`,
            item.id
          )
        );
      }
    }
  }

  return findings;
}

function evidenceSatisfiesRequirement(item: GoalBoundEvidenceInputItem): boolean {
  return item.status === 'passed' && (item.freshness ?? 'fresh') === 'fresh';
}

function closureItemsFor(
  findings: GoalBoundEvidenceFinding[],
  requirements: EvidenceRequirement[]
): GoalBoundEvidenceClosureItem[] {
  const items: GoalBoundEvidenceClosureItem[] = [];
  for (const requirement of requirements.filter(item => !item.satisfied)) {
    items.push({
      evidenceId: requirement.kind,
      kind: requirement.kind,
      resolver: requirement.kind === 'validation' ? 'validation' : 'manual',
      reason: requirement.reason,
      nextAction: nextActionForRequirement(requirement.kind),
      requiresApproval: false,
      expectedSuccessEvidence: [
        `${requirement.kind} evidence item has status passed, freshness fresh, source provenance, and matching objectiveHash.`,
      ],
    });
  }
  for (const finding of findings.filter(item => item.code === 'approval_required')) {
    items.push({
      evidenceId: finding.evidenceId ?? 'approval_required',
      kind: 'decision',
      resolver: 'approval',
      reason: finding.message,
      nextAction: 'Record the approval, accepted waiver, or decision before claiming ready.',
      requiresApproval: true,
      expectedSuccessEvidence: ['approval_required no longer appears as a decision finding.'],
    });
  }
  return items;
}

function nextActionForRequirement(kind: EvidenceKind): string {
  switch (kind) {
    case 'baseline':
      return 'Record baseline reproduction, failing validation, or explicit no-repro decision evidence.';
    case 'implementation':
      return 'Record changed files, implementation summary, and source provenance.';
    case 'validation':
      return 'Run the relevant validation command and record its command/result evidence.';
    case 'investigation':
      return 'Record findings, cited evidence, and the next recommended action.';
    default:
      return `Record ${kind} evidence with provenance.`;
  }
}

function evidenceFor(
  intentHash: string,
  targetIntentState: TargetIntentState,
  evidenceItems: GoalBoundEvidenceInputItem[],
  findings: GoalBoundEvidenceFinding[]
): GoalBoundEvidenceOutputItem[] {
  return [
    { kind: 'intent', summary: `intentHash=${intentHash}` },
    { kind: 'target_intent', summary: `state=${targetIntentState}` },
    ...evidenceItems.map(item => ({
      kind: 'evidence_item' as const,
      summary: `${item.id}:${item.kind}:${item.status}:${item.freshness ?? 'fresh'}`,
    })),
    ...findings.map(item => ({
      kind: 'finding' as const,
      summary: `${item.code}: ${item.message}`,
    })),
  ];
}

function summarizeReasons(findings: GoalBoundEvidenceFinding[]): GoalBoundEvidenceReason[] {
  const byKey = new Map<string, GoalBoundEvidenceReason>();
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

function summaryFor(
  state: GoalBoundEvidenceState,
  blockerCount: number,
  decisionCount: number,
  warningCount: number
): string {
  if (state === 'ready') return 'Required goal-bound evidence is closed.';
  return `Goal-bound evidence found ${String(blockerCount)} blocker(s), ${String(decisionCount)} decision item(s), and ${String(warningCount)} warning(s).`;
}

function nextActionFor(state: GoalBoundEvidenceState): string {
  switch (state) {
    case 'ready':
      return 'Proceed with handoff, completion, push, PR, or the next ACO stage as appropriate.';
    case 'blocked':
      return 'Add or refresh required evidence, then rerun the goal-bound evidence gate.';
    case 'needs_decision':
      return 'Resolve approval, waiver, or target/intent decisions before claiming ready.';
    case 'unknown':
      return 'Review unknown evidence and rerun with stronger provenance.';
  }
}

function finding(
  code: GoalBoundEvidenceCode,
  severity: GoalBoundEvidenceSeverity,
  message: string,
  evidenceId?: string
): GoalBoundEvidenceFinding {
  return {
    code,
    severity,
    message: redactSensitiveText(message),
    ...(evidenceId !== undefined ? { evidenceId: redactSensitiveText(evidenceId) } : {}),
  };
}

function renderReasons(reasons: GoalBoundEvidenceReason[]): string[] {
  if (reasons.length === 0) return ['- none'];
  return reasons.map(
    reason => `- ${reason.code} (${reason.severity}, ${String(reason.count)}): ${reason.message}`
  );
}

function renderFindings(findings: GoalBoundEvidenceFinding[]): string[] {
  if (findings.length === 0) return ['- none'];
  return findings.map(item => {
    const evidence = item.evidenceId === undefined ? '' : ` - ${item.evidenceId}`;
    return `- ${item.code} (${item.severity}): ${item.message}${evidence}`;
  });
}

function hashIntent(normalizedObjective: string): string {
  return createHash('sha256')
    .update(normalizedObjective || '<missing>')
    .digest('hex')
    .slice(0, 16);
}

function normalizeObjective(objective: string): string {
  return objective.toLowerCase().replace(/\s+/g, ' ').trim();
}

function redactEvidenceItem(item: GoalBoundEvidenceInputItem): GoalBoundEvidenceInputItem {
  return {
    ...item,
    id: redactSensitiveText(item.id),
    summary: redactSensitiveText(item.summary),
    source: redactSensitiveText(item.source),
    ...(item.command !== undefined ? { command: redactSensitiveText(item.command) } : {}),
    ...(item.consumer !== undefined ? { consumer: redactSensitiveText(item.consumer) } : {}),
    ...(item.sourceInput !== undefined
      ? { sourceInput: redactSensitiveText(item.sourceInput) }
      : {}),
    ...(item.regenerationCommand !== undefined
      ? { regenerationCommand: redactSensitiveText(item.regenerationCommand) }
      : {}),
    ...(item.driftPolicy !== undefined
      ? { driftPolicy: redactSensitiveText(item.driftPolicy) }
      : {}),
  };
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/\b(?:sk|sk-proj|sk-ant|ghp|github_pat)_[A-Za-z0-9_-]{12,}\b/g, '<redacted-secret>')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '<redacted-email>');
}

interface CliOptions extends EvaluateGoalBoundEvidenceOptions {
  json: boolean;
}

function parseArgs(args: string[]): CliOptions {
  let cwd = process.cwd();
  let objective: string | undefined;
  let timestamp: string | undefined;
  let targetRoot: string | undefined;
  let targetRelationship: TargetRelationship | undefined;
  let json = false;
  const evidence: GoalBoundEvidenceInputItem[] = [];

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
    } else if (arg === '--evidence-json' && args[index + 1] !== undefined) {
      evidence.push(...parseEvidenceValue(args[index + 1]));
      index += 1;
    } else if (arg === '--evidence-file' && args[index + 1] !== undefined) {
      const path = resolve(cwd, args[index + 1] ?? '');
      evidence.push(...parseEvidenceValue(readFileSync(path, 'utf8')));
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  return { cwd, objective, timestamp, targetRoot, targetRelationship, evidence, json };
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

function parseEvidenceValue(value: string): GoalBoundEvidenceInputItem[] {
  const parsed = JSON.parse(value) as unknown;
  const rawItems = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.evidence)
      ? parsed.evidence
      : [parsed];
  return rawItems.map(parseEvidenceItem);
}

function parseEvidenceItem(value: unknown): GoalBoundEvidenceInputItem {
  if (!isRecord(value)) throw new Error('Evidence item must be a JSON object.');
  const id = stringField(value, 'id');
  const kind = parseEvidenceKind(stringField(value, 'kind'));
  const status = parseEvidenceStatus(stringField(value, 'status'));
  const summary = stringField(value, 'summary');
  const source = stringField(value, 'source');
  return {
    id,
    kind,
    status,
    summary,
    source,
    ...optionalString(value, 'command'),
    ...optionalString(value, 'objectiveHash'),
    ...optionalFreshness(value),
    ...optionalBoolean(value, 'requiresApproval'),
    ...optionalString(value, 'consumer'),
    ...optionalString(value, 'sourceInput'),
    ...optionalString(value, 'regenerationCommand'),
    ...optionalString(value, 'driftPolicy'),
  };
}

function stringField(value: Record<string, unknown>, key: string): string {
  const raw = value[key];
  if (typeof raw !== 'string') throw new Error(`Evidence item field ${key} must be a string.`);
  return raw;
}

function optionalString<T extends string>(
  value: Record<string, unknown>,
  key: T
): Record<T, string> | Record<string, never> {
  const raw = value[key];
  if (raw === undefined) return {};
  if (typeof raw !== 'string') throw new Error(`Evidence item field ${key} must be a string.`);
  return { [key]: raw } as Record<T, string>;
}

function optionalBoolean<T extends string>(
  value: Record<string, unknown>,
  key: T
): Record<T, boolean> | Record<string, never> {
  const raw = value[key];
  if (raw === undefined) return {};
  if (typeof raw !== 'boolean') throw new Error(`Evidence item field ${key} must be a boolean.`);
  return { [key]: raw } as Record<T, boolean>;
}

function optionalFreshness(
  value: Record<string, unknown>
): { freshness: EvidenceFreshness } | Record<string, never> {
  const raw = value.freshness;
  if (raw === undefined) return {};
  if (typeof raw !== 'string') throw new Error('Evidence item field freshness must be a string.');
  return { freshness: parseEvidenceFreshness(raw) };
}

function parseEvidenceKind(value: string): EvidenceKind {
  const allowed: EvidenceKind[] = [
    'baseline',
    'implementation',
    'validation',
    'docs',
    'decision',
    'handoff',
    'investigation',
    'generated_artifact',
    'risk',
  ];
  if (allowed.includes(value as EvidenceKind)) return value as EvidenceKind;
  throw new Error(`Invalid evidence kind: ${value}`);
}

function parseEvidenceStatus(value: string): EvidenceStatus {
  const allowed: EvidenceStatus[] = [
    'passed',
    'failed',
    'blocked',
    'unknown',
    'not_applicable',
    'waived',
  ];
  if (allowed.includes(value as EvidenceStatus)) return value as EvidenceStatus;
  throw new Error(`Invalid evidence status: ${value}`);
}

function parseEvidenceFreshness(value: string): EvidenceFreshness {
  const allowed: EvidenceFreshness[] = ['fresh', 'stale', 'unknown', 'waived'];
  if (allowed.includes(value as EvidenceFreshness)) return value as EvidenceFreshness;
  throw new Error(`Invalid evidence freshness: ${value}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function main(args: string[]): Promise<number> {
  const options = parseArgs(args);
  const report = await evaluateGoalBoundEvidence(options);
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderGoalBoundEvidenceReport(report));
  }
  return report.state === 'ready' ? 0 : 1;
}

if (import.meta.main) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`ACO goal-bound evidence failed: ${message}`);
    process.exitCode = 1;
  }
}
