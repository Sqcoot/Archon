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
  toolAvailability: ToolAvailabilityLedgerEntry[];
  commands: CommandLedgerEntry[];
  summary: LedgerBundleSummary;
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
    bmad: Record<string, unknown>;
    acceptance: Record<string, unknown>;
    security: Record<string, unknown>;
    ledgers: Record<string, unknown>;
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
  intent: string;
  evidenceSummary: string;
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
