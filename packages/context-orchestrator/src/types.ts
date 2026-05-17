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

export interface GraphContext {
  status: 'available' | 'partial' | 'unavailable';
  repositories: GraphRepositoryStatus[];
  waiverCount: number;
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
