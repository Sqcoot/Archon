import type { EvidenceRef, ParseResult } from '@archon/aco-core';
import {
  buildCommandCatalog,
  commandDescriptorById,
  type AcoCommandCatalog,
  type AcoCommandDescriptor,
} from '@archon/aco-cli-contracts';
import { buildContextStatus, type ContextStatus } from '@archon/aco-context';
import { buildWorkflowParityBundle, type WorkflowParityBundle } from '@archon/aco-workflows';
import {
  API_UI_PARITY_ROUTE,
  API_UI_PARITY_UI_ROUTE,
  API_UI_SURFACE_EVIDENCE,
  S10_CONSENSUS_EVIDENCE,
  TERMINAL_NEXT_SLICE,
} from './constants';
import { checkApiUiParityBundle, checkApiUiParityViewModel } from './checks';
import { apiUiParityBundleSchema, apiUiParityViewModelSchema } from './schemas';
import type {
  ApiUiLedgerCoverage,
  ApiUiCommandCoverage,
  ApiUiPackageCoverage,
  ApiUiParityBundle,
  ApiUiParityViewModel,
  ApiUiRemainingGate,
  ApiUiSurfaceContract,
  ApiUiWorkflowCoverage,
} from './schemas';

export interface ApiUiParityBuildInput {
  readonly catalog?: AcoCommandCatalog;
  readonly contextStatus?: ContextStatus;
  readonly workflowBundle?: WorkflowParityBundle;
}

export function buildApiUiParityBundle(
  input: ApiUiParityBuildInput = {}
): ParseResult<ApiUiParityBundle> {
  const catalog =
    input.catalog === undefined
      ? defaultCommandCatalog()
      : ({ ok: true, value: input.catalog } as const);
  if (!catalog.ok) return catalog;

  const contextStatus =
    input.contextStatus === undefined
      ? defaultContextStatus()
      : ({ ok: true, value: input.contextStatus } as const);
  if (!contextStatus.ok) return contextStatus;

  const workflowBundle =
    input.workflowBundle === undefined
      ? defaultWorkflowBundle()
      : ({ ok: true, value: input.workflowBundle } as const);
  if (!workflowBundle.ok) return workflowBundle;

  const bundle = {
    kind: 'aco-api-ui-parity-bundle',
    schemaVersion: 'aco.api-ui-parity-bundle.v1',
    id: 'aco.api-ui.s10.parity',
    status: 'terminal',
    readiness: 'complete-with-approval-gates',
    nextSlice: null,
    sourceTerminality: {
      contextNextSlice: contextStatus.value.nextSlice,
      workflowNextSlice: workflowBundle.value.nextSlice,
      terminal:
        contextStatus.value.nextSlice === TERMINAL_NEXT_SLICE &&
        workflowBundle.value.nextSlice === TERMINAL_NEXT_SLICE,
    },
    packageCoverage: packageCoverage(),
    ledgerCoverage: ledgerCoverage(),
    commandCoverage: commandCoverage(catalog.value),
    workflowCoverage: workflowCoverage(workflowBundle.value),
    contextCoverage: {
      statusReadiness: contextStatus.value.readiness,
      nextSlice: contextStatus.value.nextSlice,
      deferredSurfaces: contextStatus.value.deferredSurfaces,
      workflowParityDeferred: contextStatus.value.deferredSurfaces.some((surface: string) =>
        surface.toLowerCase().includes('workflow parity')
      ),
    },
    remainingApprovalGates: remainingApprovalGates(catalog.value),
    surfaceContracts: surfaceContracts(),
    terminalCriteria: [
      'API exposes committed ACO parity state',
      'UI consumes the API parity bundle without inventing policy',
      'workflow and context parity are committed, not deferred',
      'remaining work is limited to explicit approval/deferred gates',
      'no S11 is planned unless S10 discovers a concrete missing public boundary',
    ],
    evidence: evidenceRefs(),
  } as const;

  const parsed = apiUiParityBundleSchema.safeParse(bundle);
  if (!parsed.success)
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  const issues = checkApiUiParityBundle(parsed.data);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: parsed.data };
}

export function buildApiUiParityViewModel(
  bundle: ApiUiParityBundle
): ParseResult<ApiUiParityViewModel> {
  const view = {
    kind: 'aco-api-ui-view-model',
    schemaVersion: 'aco.api-ui-view-model.v1',
    route: API_UI_PARITY_UI_ROUTE,
    title: 'ACO Parity',
    statusLabel: 'Complete with approval gates',
    summary: {
      readiness: bundle.readiness,
      packageCount: bundle.packageCoverage.length,
      workflowCount: bundle.workflowCoverage.length,
      remainingGateCount: bundle.remainingApprovalGates.length,
    },
    sections: [
      {
        id: 'packages',
        title: 'Committed Packages',
        rows: bundle.packageCoverage.map(item => ({
          label: item.slice,
          value: `${item.packageName} - ${item.ownerSurface}`,
          status: item.status,
        })),
      },
      {
        id: 'workflows',
        title: 'Workflow Parity',
        rows: bundle.workflowCoverage.map(item => ({
          label: item.name,
          value: `${item.nodeCount.toString()} nodes; ${item.bundledDefaultFile}`,
          status: item.status,
        })),
      },
      {
        id: 'gates',
        title: 'Remaining Gates',
        rows: bundle.remainingApprovalGates.map(item => ({
          label: item.display,
          value: item.reason,
          status: item.status,
        })),
      },
      {
        id: 'public-surfaces',
        title: 'Public Surfaces',
        rows: bundle.surfaceContracts.map(item => ({
          label: item.route,
          value: `${item.layer.toUpperCase()} ${item.method}; ${item.produces.join(', ')}`,
          status: 'committed',
        })),
      },
    ],
  } as const;

  const parsed = apiUiParityViewModelSchema.safeParse(view);
  if (!parsed.success)
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  const issues = checkApiUiParityViewModel(parsed.data, bundle);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: parsed.data };
}

function defaultCommandCatalog(): ParseResult<AcoCommandCatalog> {
  return buildCommandCatalog();
}

function defaultContextStatus(): ParseResult<ContextStatus> {
  return buildContextStatus({ prompt: 'S10 API/UI parity' });
}

function defaultWorkflowBundle(): ParseResult<WorkflowParityBundle> {
  return buildWorkflowParityBundle();
}

function packageCoverage(): readonly ApiUiPackageCoverage[] {
  return [
    coverage('S1', '@archon/aco-core', 'manifest compatibility and pure gates', 'committed'),
    coverage('S2', '@archon/aco-ledgers', 'ledger parity fixtures', 'committed'),
    coverage('S3', '@archon/aco-codex', 'Codex bootstrap contracts', 'committed'),
    coverage('S4', '@archon/aco-bmad-contracts', 'BMAD role/adversarial contracts', 'committed'),
    coverage('S5', '@archon/aco-research', 'research graph waiver contracts', 'committed'),
    coverage('S6', '@archon/aco-cli-contracts', 'command safety catalog', 'committed'),
    coverage('S7', '@archon/aco-cli-contracts', 'CLI router parity adapters', 'committed'),
    coverage('S8', '@archon/aco-context', 'context package and approval capsule', 'committed'),
    coverage('S9', '@archon/aco-workflows', 'workflow parity contracts', 'committed'),
    coverage('S10', '@archon/aco-api-ui', 'terminal API/UI parity', 'committed'),
  ];
}

function coverage(
  slice: string,
  packageName: string,
  ownerSurface: string,
  status: ApiUiPackageCoverage['status']
): ApiUiPackageCoverage {
  return {
    slice,
    packageName,
    ownerSurface,
    status,
    evidenceId: S10_CONSENSUS_EVIDENCE.id,
  };
}

function ledgerCoverage(): readonly ApiUiLedgerCoverage[] {
  return [
    'artifact-ledger.csv',
    'capability-inventory.csv',
    'command-ledger.csv',
    'risk-ledger.csv',
    'tool-availability-ledger.csv',
    'unknowns-ledger.csv',
    'workflow-ledger.csv',
  ].map(name => ({
    name,
    ownerSurface: 'tests/fixtures/aco/ledgers',
    status: 'committed' as const,
  }));
}

function commandCoverage(catalog: AcoCommandCatalog): ApiUiCommandCoverage {
  const descriptors = catalog.descriptors;
  return {
    total: descriptors.length,
    supported: descriptors.filter(descriptor => descriptor.implementationStatus === 'supported')
      .length,
    deferred: descriptors.filter(descriptor => descriptor.implementationStatus === 'deferred')
      .length,
    approvalRequired: descriptors.filter(
      descriptor => descriptor.implementationStatus === 'approval-required'
    ).length,
    readOnlySupported: descriptors.filter(
      descriptor =>
        descriptor.implementationStatus === 'supported' && descriptor.mutates === 'read-only'
    ).length,
  };
}

function workflowCoverage(bundle: WorkflowParityBundle): readonly ApiUiWorkflowCoverage[] {
  return bundle.contracts.map(contract => ({
    name: contract.name,
    status: 'committed',
    nodeCount: contract.requiredNodes.length,
    bundledDefaultFile: contract.bundledDefault.fileName,
    bundledDefaultChecksum: contract.bundledDefault.checksum,
  }));
}

function remainingApprovalGates(catalog: AcoCommandCatalog): readonly ApiUiRemainingGate[] {
  const roleContracts = descriptorOrThrow(catalog, 'bun.aco.role-contracts');
  const researchGraph = descriptorOrThrow(catalog, 'bun.research.graph');
  return [
    {
      commandId: roleContracts.id,
      display: roleContracts.display,
      ownerSurface: roleContracts.owner,
      status: 'deferred',
      mutationScope: roleContracts.safetyClasses,
      reason: 'role-contract script remains outside terminal API/UI parity',
      stopCondition:
        'implement only if a future explicit role-contract execution slice is approved',
    },
    {
      commandId: researchGraph.id,
      display: researchGraph.display,
      ownerSurface: researchGraph.owner,
      status: 'approval-gated',
      mutationScope: researchGraph.safetyClasses,
      reason: 'research graph refresh requires network and graph-cache writes',
      stopCondition: 'run only with explicit user approval for graph refresh',
    },
  ];
}

function surfaceContracts(): readonly ApiUiSurfaceContract[] {
  return [
    {
      id: 'api.aco.parity',
      layer: 'api',
      route: API_UI_PARITY_ROUTE,
      method: 'GET',
      status: 'contractual',
      readOnly: true,
      consumes: ['@archon/aco-api-ui'],
      produces: ['aco.api-ui-parity-bundle.v1'],
    },
    {
      id: 'ui.aco.parity',
      layer: 'ui',
      route: API_UI_PARITY_UI_ROUTE,
      method: 'GET',
      status: 'contractual',
      readOnly: true,
      consumes: [API_UI_PARITY_ROUTE],
      produces: ['aco.api-ui-view-model.v1'],
    },
  ];
}

function evidenceRefs(): readonly EvidenceRef[] {
  return [S10_CONSENSUS_EVIDENCE, API_UI_SURFACE_EVIDENCE];
}

function descriptorOrThrow(
  catalog: AcoCommandCatalog,
  id: AcoCommandDescriptor['id']
): AcoCommandDescriptor {
  const descriptor = catalog.descriptors.find(item => item.id === id) ?? commandDescriptorById(id);
  if (descriptor === undefined) throw new Error(`missing descriptor ${id}`);
  return descriptor;
}
