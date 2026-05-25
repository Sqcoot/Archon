export type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

export type Confidence = 'low' | 'medium' | 'high';
export type Freshness = 'fresh' | 'stale' | 'unknown' | 'waived';
export type MutationClass =
  | 'read-only'
  | 'writes-artifacts'
  | 'writes-tracked-files'
  | 'writes-user-files'
  | 'writes-config'
  | 'writes-credentials'
  | 'writes-remotes'
  | 'writes-graph-cache'
  | 'destructive'
  | 'network'
  | 'unknown';

export type CapabilityClaimStatus =
  | 'supported'
  | 'unsupported'
  | 'unknown'
  | 'deferred'
  | 'approval_required';

export type SurfaceCompatibility = 'preserve' | 'preserve-gated' | 'preserve-harden' | 'shim';

export interface EvidenceRef {
  readonly id: string;
  readonly source: string;
  readonly summary: string;
  readonly confidence: Confidence;
  readonly freshness: Freshness;
}

export interface RegistryContract<TKind extends string> {
  readonly kind: TKind;
  readonly id: string;
}

export interface Registry<TKind extends string, TContract extends RegistryContract<TKind>> {
  readonly kind: TKind;
  readonly bootloaded: boolean;
  get(id: string): TContract | undefined;
  list(): readonly TContract[];
  register(contract: TContract): Registry<TKind, TContract>;
  bootload(): Registry<TKind, TContract>;
}

export type GateRunResult<TResult> =
  | {
      readonly status: 'passed';
      readonly value: TResult;
      readonly evidence: readonly EvidenceRef[];
    }
  | {
      readonly status: 'failed';
      readonly errors: readonly string[];
      readonly evidence: readonly EvidenceRef[];
    }
  | {
      readonly status: 'unknown';
      readonly reason: string;
      readonly evidence: readonly EvidenceRef[];
    };

export interface Gate<TInput, TResult> extends RegistryContract<'gate'> {
  readonly mutates: MutationClass;
  run(input: TInput): Promise<GateRunResult<TResult>>;
}

export type RepoRoot = Brand<string, 'RepoRoot'>;
export type SourceRoot = Brand<string, 'SourceRoot'>;
export type ArtifactRoot = Brand<string, 'ArtifactRoot'>;
export type WorktreeRoot = Brand<string, 'WorktreeRoot'>;
export type GraphCacheRoot = Brand<string, 'GraphCacheRoot'>;
export type UserConfigRoot = Brand<string, 'UserConfigRoot'>;
export type ArtifactPath = Brand<string, 'ArtifactPath'>;

export type AcoPathKind =
  | 'repo'
  | 'source'
  | 'artifact'
  | 'worktree'
  | 'graph-cache'
  | 'user-config';

export type AcoPathFor<TKind extends AcoPathKind> = TKind extends 'repo'
  ? RepoRoot
  : TKind extends 'source'
    ? SourceRoot
    : TKind extends 'artifact'
      ? ArtifactRoot
      : TKind extends 'worktree'
        ? WorktreeRoot
        : TKind extends 'graph-cache'
          ? GraphCacheRoot
          : UserConfigRoot;

export interface BrandedPath<TKind extends AcoPathKind> {
  readonly kind: TKind;
  readonly value: AcoPathFor<TKind>;
}

export interface ArtifactRef<TSchema extends string> extends RegistryContract<'artifact-ref'> {
  readonly schemaVersion: TSchema;
  readonly path: ArtifactPath;
  readonly sha256: string;
  readonly evidence: readonly EvidenceRef[];
}

export interface ProviderCapability<
  TProvider extends string,
  TTool extends string,
> extends RegistryContract<'provider-capability'> {
  readonly provider: TProvider;
  readonly tool: TTool;
  readonly status: CapabilityClaimStatus;
  readonly confidence: Confidence;
  readonly evidence: readonly EvidenceRef[];
  readonly approvalRequired: boolean;
}

export interface LedgerEntry<
  TSubject,
  TStatus extends string,
> extends RegistryContract<'ledger-entry'> {
  readonly subject: TSubject;
  readonly status: TStatus;
  readonly confidence: Confidence;
  readonly freshness: Freshness;
  readonly evidence: readonly EvidenceRef[];
}

export type ApprovalDecision =
  | {
      readonly status: 'approved';
      readonly approvedBy: string;
      readonly scope: readonly MutationClass[];
      readonly evidence: readonly EvidenceRef[];
    }
  | {
      readonly status: 'approval_required';
      readonly reason: string;
      readonly scope: readonly MutationClass[];
      readonly evidence: readonly EvidenceRef[];
    }
  | {
      readonly status: 'rejected';
      readonly reason: string;
      readonly evidence: readonly EvidenceRef[];
    };

export interface RouterOption {
  readonly id: string;
  readonly decision: string;
  readonly pros: readonly string[];
  readonly cons: readonly string[];
}

export interface UncertaintyRouterPacket extends RegistryContract<'uncertainty-router-packet'> {
  readonly schemaVersion: 'aco.party-mode-uncertainty-router.v1';
  readonly question: string;
  readonly context: string;
  readonly options: readonly RouterOption[];
  readonly rolesRequested: readonly string[];
  readonly confidenceBefore: Confidence;
  readonly selectedOption: string | null;
  readonly confidenceAfter: Confidence;
  readonly requiredEvidence: readonly string[];
  readonly rejectedAlternatives: readonly string[];
  readonly owner: string;
  readonly expiresWhen: string;
}

export type ManifestRecord =
  | CommandManifestRecord
  | SurfaceManifestRecord
  | ArtifactManifestRecord
  | CapabilityManifestRecord
  | WorkflowManifestRecord
  | ProviderManifestRecord
  | GateManifestRecord;

export interface CommandManifestRecord extends RegistryContract<'command-manifest'> {
  readonly command: string;
  readonly surface: string;
  readonly purpose: string;
  readonly mutates: MutationClass;
  readonly approvalRequired: boolean;
  readonly owner: string;
  readonly compatibility: SurfaceCompatibility;
  readonly evidence: readonly EvidenceRef[];
}

export interface SurfaceManifestRecord extends RegistryContract<'surface-manifest'> {
  readonly surface: string;
  readonly owner: string;
  readonly compatibility: SurfaceCompatibility;
  readonly migrationNote?: string;
  readonly evidence: readonly EvidenceRef[];
}

export interface ArtifactManifestRecord extends RegistryContract<'artifact-manifest'> {
  readonly schemaVersion: string;
  readonly owner: string;
  readonly produces: readonly string[];
  readonly evidence: readonly EvidenceRef[];
}

export interface CapabilityManifestRecord extends RegistryContract<'capability-manifest'> {
  readonly capability: string;
  readonly owner: string;
  readonly status: CapabilityClaimStatus;
  readonly evidence: readonly EvidenceRef[];
}

export interface WorkflowManifestRecord extends RegistryContract<'workflow-manifest'> {
  readonly workflow: string;
  readonly owner: string;
  readonly nodeContracts: readonly string[];
  readonly evidence: readonly EvidenceRef[];
}

export interface ProviderManifestRecord extends RegistryContract<'provider-manifest'> {
  readonly provider: string;
  readonly capabilities: readonly ProviderCapability<string, string>[];
  readonly evidence: readonly EvidenceRef[];
}

export interface GateManifestRecord extends RegistryContract<'gate-manifest'> {
  readonly gate: string;
  readonly mutates: MutationClass;
  readonly evidence: readonly EvidenceRef[];
}

export type AcoEvent =
  | {
      readonly type: 'registry.bootloaded';
      readonly registryKind: string;
      readonly count: number;
    }
  | {
      readonly type: 'gate.completed';
      readonly gateId: string;
      readonly status: GateRunResult<unknown>['status'];
    }
  | {
      readonly type: 'approval.decided';
      readonly decision: ApprovalDecision['status'];
    }
  | {
      readonly type: 'artifact.referenced';
      readonly artifactId: string;
      readonly schemaVersion: string;
    };

export type ParseResult<TValue> =
  | { readonly ok: true; readonly value: TValue }
  | { readonly ok: false; readonly issues: readonly string[] };

export interface ReferenceSurfaceCompilation {
  readonly records: readonly ManifestRecord[];
  readonly commandManifests: readonly CommandManifestRecord[];
  readonly surfaceManifests: readonly SurfaceManifestRecord[];
  readonly capabilityManifests: readonly CapabilityManifestRecord[];
  readonly workflowManifests: readonly WorkflowManifestRecord[];
  readonly gateManifests: readonly GateManifestRecord[];
  readonly requiredSurfaceAssertions: readonly string[];
  readonly registries: {
    readonly commands: Registry<'command-manifest', CommandManifestRecord>;
    readonly surfaces: Registry<'surface-manifest', SurfaceManifestRecord>;
    readonly capabilities: Registry<'capability-manifest', CapabilityManifestRecord>;
    readonly workflows: Registry<'workflow-manifest', WorkflowManifestRecord>;
    readonly gates: Registry<'gate-manifest', GateManifestRecord>;
  };
}

export interface CompatibilityGateResult {
  readonly manifestCounts: {
    readonly commands: number;
    readonly surfaces: number;
    readonly capabilities: number;
    readonly workflows: number;
    readonly gates: number;
  };
  readonly requiredSurfaces: readonly string[];
  readonly migrationPhases: readonly string[];
}
