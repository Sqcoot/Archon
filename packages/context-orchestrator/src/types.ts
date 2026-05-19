import type { NextDecision } from './schemas/next-decision';
import type { TargetIntentBoundaryArtifact } from './schemas/target-intent-boundary';
export type { NextDecision } from './schemas/next-decision';

export type McpReadinessState =
  | 'available'
  | 'configured-but-unverified'
  | 'unavailable'
  | 'optional-skipped'
  | 'required-missing'
  | 'blocked';

export type GraphStatus = 'not-started' | 'complete' | 'failed' | 'waived';

export interface GraphRepositoryStatus {
  name: string;
  graphStatus: GraphStatus;
  cloneStatus: string;
  branch: string | null;
  commitSha: string | null;
  waiverRequired: boolean;
  nodes: number;
  edges: number;
}

export interface GraphWaiver {
  id: string;
  repository: string;
  owner: string;
  reason: string;
  evidence: string;
  expiryCondition: string;
}

export interface GraphContext {
  status: 'available' | 'partial' | 'forbidden' | 'unavailable';
  repositories: GraphRepositoryStatus[];
  waiverCount: number;
  waivers: GraphWaiver[];
  summary: string;
}

export type GraphWaiverClosureDecision =
  | 'unresolved'
  | 'rebuild_available'
  | 'manual_action_required'
  | 'justified_waiver'
  | 'cleared';

export type GraphWaiverArtifactStatus =
  | 'valid'
  | 'empty-waiver'
  | 'empty-complete'
  | 'missing'
  | 'malformed';

export type GraphWaiverClosureApprovalStatus = 'approval_required' | 'not_required';

export interface GraphWaiverClosureCommand {
  command: string;
  safety: CommandSafety;
  requiresApproval: boolean;
  willRun: boolean;
  reason: string;
}

export interface GraphWaiverArtifactDiagnostic {
  path: string;
  metadataPath: string;
  reportPath: string;
  status: GraphWaiverArtifactStatus;
  graphStatus: string;
  nodes: number;
  edges: number;
  message: string;
}

export interface GraphWaiverClosureDiagnostic {
  waiverId: string;
  repository: string;
  owner: string;
  graphStatus: GraphStatus | 'unknown';
  cloneStatus: string;
  waiverRequired: boolean;
  reason: string;
  evidence: string;
  expiryCondition: string;
  graphArtifact: GraphWaiverArtifactDiagnostic;
  failureSummary: string;
  affectedLedgerRows: string[];
  decision: GraphWaiverClosureDecision;
  diagnosis: string;
  recommendedAction: string;
  recommendedCommands: GraphWaiverClosureCommand[];
  expectedSuccessEvidence: string[];
  approvalStatus: GraphWaiverClosureApprovalStatus;
}

export interface GraphWaiverClosureReport {
  schemaVersion: 'aco.graph-waiver-closure.v1';
  generatedAt?: string;
  cwd: string;
  readiness: ContextOrchestratorReadiness;
  graphStatus: GraphContext['status'];
  validationStatus: string;
  approvalRequired: boolean;
  waiverCount: number;
  diagnostics: GraphWaiverClosureDiagnostic[];
  summary: {
    total: number;
    byDecision: Record<GraphWaiverClosureDecision, number>;
    approvalRequired: boolean;
  };
}

export type DocumentationSource = 'openai-docs-mcp' | 'context7' | 'generic';
export type DocumentationTargetStatus = 'resolved' | 'unresolved' | 'not-required';

export interface DocumentationTarget {
  source: DocumentationSource;
  topic: string;
  status: DocumentationTargetStatus;
  libraryId?: string;
  reason: string;
}

export interface DocumentationPlan {
  readiness: {
    openaiDocsMcp: McpReadinessState;
    context7: McpReadinessState;
  };
  targets: DocumentationTarget[];
  unresolved: string[];
}

export interface BmadRoute {
  id: 'brownfield-architecture' | 'quick-contained' | 'correct-course' | 'unknown-help';
  label: string;
  steps: string[];
  rationale: string;
}

export interface AcceptanceScenario {
  id: string;
  spec: string;
  given: string;
  when: string;
  then: string;
}

export interface AcceptancePlan {
  status: 'ready' | 'missing';
  scenarios: AcceptanceScenario[];
}

export interface Capability {
  id: string;
  label: string;
  required: boolean;
  reason: string;
}

export interface CapabilityRoute {
  capabilities: Capability[];
}

export interface ValidationCheck {
  id: string;
  status: 'passed' | 'warning' | 'failed';
  message: string;
}

export interface ValidationReport {
  status: 'passed' | 'warning' | 'failed';
  checks: ValidationCheck[];
}

export interface ContextIntent {
  objective: string;
  normalizedObjective: string;
  intentHash: string;
  cwd: string;
  commitSha: string;
  generatedAt: string;
}

export type LedgerFreshness = 'fresh' | 'stale' | 'unknown' | 'waived';

export type LedgerVerificationMethod =
  | 'command'
  | 'file'
  | 'tool'
  | 'static'
  | 'policy'
  | 'manual'
  | 'unknown';

export interface EvidenceBlocker {
  id: string;
  kind: 'tool' | 'command' | 'graph' | 'validation' | 'docs';
  status: string;
  freshness: LedgerFreshness;
  reason: string;
  sourceArtifact: string;
  nextVerificationAction: string;
}

export type EvidenceResolutionTargetKind =
  | 'openai'
  | 'third-party'
  | 'unknown'
  | 'graph'
  | 'validation';

export type EvidenceResolutionResolver = 'openai-docs-mcp' | 'context7' | 'manual' | 'approval';

export interface EvidenceResolutionItem {
  evidenceId: string;
  capabilityId: string;
  targetKind: EvidenceResolutionTargetKind;
  targetName: string;
  resolver: EvidenceResolutionResolver;
  reason: string;
  nextAction: string;
  requiresApproval: boolean;
  blockingAcceptanceIds: string[];
  expectedSuccessEvidence: string[];
}

export interface EvidenceClosurePlan {
  required: boolean;
  items: EvidenceResolutionItem[];
}

export type LedgerStatus =
  | 'available'
  | 'partial'
  | 'blocked'
  | 'deferred'
  | 'forbidden'
  | 'not used'
  | 'unknown';

export type LedgerConfidence = 'observed' | 'declared' | 'inferred' | 'unknown';

export type CommandSafety =
  | 'read-only'
  | 'writes-artifacts'
  | 'writes-tracked-files'
  | 'destructive'
  | 'network'
  | 'unknown';

export interface LedgerEvidence {
  sourceType: 'command' | 'file' | 'tool' | 'static' | 'unknown';
  sourceEvidence: string;
  invocationPath: string;
  confidence: LedgerConfidence;
  reason: string;
  lastVerifiedAt: string;
  verificationSource: string;
  verificationMethod: LedgerVerificationMethod;
  sourceArtifact: string;
  nextVerificationAction: string;
  freshness: LedgerFreshness;
}

export interface LedgerEntryBase {
  id: string;
  category: string;
  status: LedgerStatus;
  sourceEvidence: string;
  invocationPath: string;
  scope: string;
  preconditions: string;
  verification: string;
  primaryUse: string;
  failureMode: string;
  fallback: string;
  owner: string;
  lastVerified: string;
  lastVerifiedAt: string;
  verificationSource: string;
  verificationMethod: LedgerVerificationMethod;
  sourceArtifact: string;
  nextVerificationAction: string;
  freshness: LedgerFreshness;
  notes: string;
  confidence: LedgerConfidence;
  evidence: LedgerEvidence[];
}

export interface ToolAvailabilityLedgerEntry extends LedgerEntryBase {
  name: string;
}

export interface CommandLedgerEntry extends LedgerEntryBase {
  command: string;
  mutatesTrackedFiles: boolean;
  requiresApproval: boolean;
  safety: CommandSafety;
}

export type LedgerStatusCounts = Record<LedgerStatus, number>;

export interface LedgerSummary {
  total: number;
  counts: LedgerStatusCounts;
}

export interface LedgerBundleSummary {
  toolAvailability: LedgerSummary;
  commands: LedgerSummary;
  combined: LedgerSummary;
}

export interface LedgerBundle {
  schemaVersion: 'aco.ledger-bundle.v1';
  generatedAt?: string;
  contextIntent: ContextIntent;
  toolAvailability: ToolAvailabilityLedgerEntry[];
  commands: CommandLedgerEntry[];
  evidenceBlockers: EvidenceBlocker[];
  summary: LedgerBundleSummary;
}

export type ContextOrchestratorReadiness = 'ready' | 'blocked' | 'needs_approval' | 'unknown';

export interface DecisionDossierEvidence {
  id: string;
  kind: 'route' | 'graph' | 'validation' | 'ledger' | 'waiver' | 'acceptance';
  status: string;
  source: string;
  summary: string;
}

export interface DecisionDossierBlockedItem {
  id: string;
  kind: 'graph' | 'validation' | 'tool' | 'command';
  status: string;
  reason: string;
  sourceEvidence: string;
  command?: string;
}

export interface DecisionDossierApprovalCommand {
  id: string;
  command: string;
  safety: CommandSafety;
  requiresApproval: true;
  willRun: false;
  reason: string;
}

export interface DecisionDossierRejectedAlternative {
  id: string;
  label: string;
  reason: string;
}

export interface DecisionDossierDecision {
  id: 'ready-for-implementation' | 'approval-required' | 'blocked' | 'needs-correct-course';
  summary: string;
  allowedNextStep: string;
  rationale: string;
}

export interface DecisionDossier {
  schemaVersion: 'aco.decision-dossier.v1';
  generatedAt?: string;
  contextIntent: ContextIntent;
  route: BmadRoute;
  decision: DecisionDossierDecision;
  evidenceUsed: DecisionDossierEvidence[];
  readiness: ContextOrchestratorReadiness;
  validationStatus: ValidationReport['status'];
  graphStatus: GraphContext['status'];
  waivers: GraphWaiver[];
  ledgerSummary: LedgerBundleSummary;
  evidenceBlockers: EvidenceBlocker[];
  evidenceResolution: EvidenceClosurePlan;
  nextDecision: NextDecision;
  blockedItems: DecisionDossierBlockedItem[];
  approvalRequired: boolean;
  approvalCommands: DecisionDossierApprovalCommand[];
  rejectedAlternatives: DecisionDossierRejectedAlternative[];
  nextGoalObjective: string;
  nextPlanPrompt: string;
}

export interface PromptPackagePolicyArtifact {
  id: string;
  path: string;
  kind: string;
}

export interface PromptPackagePolicyInput {
  schema_version: string;
  package_id: string;
  generated_at: string;
  source_request: {
    text: string;
  };
  manifest: Record<string, unknown>;
  artifacts: PromptPackagePolicyArtifact[];
  evidence: {
    graph: Record<string, unknown>;
    docs: Record<string, unknown>;
    evidenceResolution?: Record<string, unknown>;
    bmad: Record<string, unknown>;
    acceptance: Record<string, unknown>;
    security: Record<string, unknown>;
    ledgers: Record<string, unknown>;
    decisionDossier?: Record<string, unknown>;
    nextDecision?: Record<string, unknown>;
    targetIntentBoundary?: Record<string, unknown>;
  };
  validation: Record<string, unknown>;
}

export interface PolicyFinding {
  code: string;
  message: string;
  path?: string;
  severity: 'deny' | 'warn';
}

export interface PolicyDecision {
  allow: boolean;
  deny: PolicyFinding[];
  warn: PolicyFinding[];
  policy_version: string;
}

export interface ArchivedPolicyDecision {
  schema_version: 'aco.policy-decision.v1';
  input: {
    path: 'prompt-package.json';
    sha256: string;
  };
  policy: {
    package: 'archon.context_orchestrator.prompt_package';
    version: string;
    sha256: string;
  };
  opa: {
    available: true;
    version: string | null;
  };
  decision: {
    allow: boolean;
    deny: PolicyFinding[];
    warn: PolicyFinding[];
  };
  counts: {
    deny: number;
    warn: number;
  };
  codes: {
    deny: string[];
    warn: string[];
  };
  duplicates_suppressed: number;
}

export type CavemanMode = 'off' | 'lite' | 'full' | 'ultra';

export interface PromptPackage {
  runId: string;
  timestamp: string;
  originalPrompt: string;
  targetCodebase: string;
  contextIntent: ContextIntent;
  intent: string;
  evidenceSummary: string;
  targetIntentBoundary?: TargetIntentBoundaryArtifact;
  graphContext: GraphContext;
  documentationPlan: DocumentationPlan;
  bmadRoute: BmadRoute;
  acceptancePlan: AcceptancePlan;
  selectedCapabilities: CapabilityRoute;
  cavemanPolicy: {
    mode: CavemanMode;
    preservedArtifacts: string[];
  };
  securityConstraints: string[];
  unknowns: string[];
  humanPrompt: string;
  codexPrompt: string;
  nextArchonCommand: string[];
  validationReport: ValidationReport;
  ledgerBundle: LedgerBundle;
  evidenceResolution: EvidenceClosurePlan;
  nextDecision: NextDecision;
  decisionDossier: DecisionDossier;
}

export interface CompilePromptPackageOptions {
  cwd: string;
  prompt: string;
  archiveRoot?: string;
  runId?: string;
  timestamp?: string;
  cavemanMode?: CavemanMode;
  json?: boolean;
}

export interface PromptPackageResult {
  package: PromptPackage;
  archivePath: string;
  files: Record<string, string>;
}
