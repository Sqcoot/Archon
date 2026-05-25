import { serializeStableJson } from '@archon/aco-workflows';
import type { ApiUiParityBundle, ApiUiParityViewModel } from './schemas';

export function renderApiUiParityBundleJson(bundle: ApiUiParityBundle): string {
  return serializeStableJson(bundle);
}

export function renderApiUiParityViewModelJson(view: ApiUiParityViewModel): string {
  return serializeStableJson(view);
}

export function renderFinalParityLedgerJson(bundle: ApiUiParityBundle): string {
  return serializeStableJson({
    packageCoverage: bundle.packageCoverage,
    workflowCoverage: bundle.workflowCoverage,
    remainingApprovalGates: bundle.remainingApprovalGates,
    terminalCriteria: bundle.terminalCriteria,
    nextSlice: bundle.nextSlice,
  });
}

export function renderApiUiSummaryMarkdown(bundle: ApiUiParityBundle): string {
  const lines = [
    '# ACO API/UI Parity',
    '',
    `schemaVersion: ${bundle.schemaVersion}`,
    `id: ${bundle.id}`,
    `status: ${bundle.status}`,
    `readiness: ${bundle.readiness}`,
    'nextSlice: null',
    '',
    '## Public Surfaces',
    '',
    ...bundle.surfaceContracts.map(
      surface =>
        `- ${surface.method} ${surface.route}: ${surface.status}; readOnly=${surface.readOnly}`
    ),
    '',
    '## Workflow Parity',
    '',
    ...bundle.workflowCoverage.map(
      workflow =>
        `- ${workflow.name}: ${workflow.status}; default=${workflow.bundledDefaultFile}; nodes=${workflow.nodeCount}`
    ),
    '',
    '## Remaining Gates',
    '',
    ...bundle.remainingApprovalGates.map(gate => `- ${gate.display}: ${gate.status}`),
  ];

  return `${lines.join('\n')}\n`;
}
