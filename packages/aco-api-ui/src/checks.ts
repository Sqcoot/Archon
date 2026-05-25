import {
  API_UI_PARITY_ROUTE,
  API_UI_PARITY_UI_ROUTE,
  REQUIRED_API_UI_SURFACE_IDS,
  REQUIRED_SLICE_IDS,
  TERMINAL_NEXT_SLICE,
} from './constants';
import { apiUiParityBundleSchema, apiUiParityViewModelSchema } from './schemas';
import type { ApiUiParityBundle, ApiUiParityViewModel } from './schemas';

const REQUIRED_WORKFLOWS = ['archon-aco-adversarial-loop', 'context-orchestrate'] as const;
const REQUIRED_GATE_COMMANDS = ['bun.aco.role-contracts', 'bun.research.graph'] as const;

export function checkApiUiParityBundle(input: unknown): readonly string[] {
  const parsed = apiUiParityBundleSchema.safeParse(input);
  if (!parsed.success) return parsed.error.issues.map(issue => issue.message);

  const bundle = parsed.data;
  const errors: string[] = [];

  if (bundle.nextSlice !== null) errors.push('S10 parity bundle must be terminal');
  if (bundle.sourceTerminality.contextNextSlice !== TERMINAL_NEXT_SLICE) {
    errors.push('context status must be terminal after S10');
  }
  if (bundle.sourceTerminality.workflowNextSlice !== TERMINAL_NEXT_SLICE) {
    errors.push('workflow parity bundle must be terminal after S10');
  }
  if (!bundle.sourceTerminality.terminal) {
    errors.push('source terminality must be true after S10');
  }

  const slices = new Set(bundle.packageCoverage.map(item => item.slice));
  for (const required of REQUIRED_SLICE_IDS) {
    if (!slices.has(required)) errors.push(`missing package coverage for ${required}`);
  }

  const workflows = new Set(bundle.workflowCoverage.map(item => item.name));
  for (const required of REQUIRED_WORKFLOWS) {
    if (!workflows.has(required)) errors.push(`missing workflow coverage for ${required}`);
  }
  if (bundle.workflowCoverage.some(item => item.status !== 'committed')) {
    errors.push('workflow/context parity must be committed in S10');
  }

  const surfaceIds = new Set(bundle.surfaceContracts.map(surface => surface.id));
  for (const required of REQUIRED_API_UI_SURFACE_IDS) {
    if (!surfaceIds.has(required)) errors.push(`missing API/UI surface contract ${required}`);
  }
  if (surfaceIds.size !== REQUIRED_API_UI_SURFACE_IDS.length) {
    errors.push('API/UI parity must not contain unknown public surfaces');
  }

  const apiSurface = bundle.surfaceContracts.find(surface => surface.id === 'api.aco.parity');
  if (apiSurface?.route !== API_UI_PARITY_ROUTE || apiSurface.method !== 'GET') {
    errors.push('API parity surface must be GET /api/aco/parity');
  }
  if (apiSurface?.readOnly !== true) errors.push('API parity surface must be read-only');

  const uiSurface = bundle.surfaceContracts.find(surface => surface.id === 'ui.aco.parity');
  if (uiSurface?.route !== API_UI_PARITY_UI_ROUTE) {
    errors.push('UI parity surface must be /aco');
  }
  if (!uiSurface?.consumes.includes(API_UI_PARITY_ROUTE)) {
    errors.push('UI parity surface must consume the API parity route');
  }

  const gates = new Set(bundle.remainingApprovalGates.map(gate => gate.commandId));
  for (const required of REQUIRED_GATE_COMMANDS) {
    if (!gates.has(required)) errors.push(`missing terminal gate ${required}`);
  }
  if (gates.size !== REQUIRED_GATE_COMMANDS.length) {
    errors.push(
      'remaining gates must contain only explicit role-contracts and research graph gates'
    );
  }

  if (bundle.contextCoverage.workflowParityDeferred) {
    errors.push('UI/API parity must not report workflow parity as deferred');
  }
  if (bundle.commandCoverage.deferred !== 1 || bundle.commandCoverage.approvalRequired !== 1) {
    errors.push('S10 command coverage must preserve exactly one deferred and one approval gate');
  }

  return errors;
}

export function checkApiUiParityViewModel(
  input: unknown,
  bundle: ApiUiParityBundle
): readonly string[] {
  const parsed = apiUiParityViewModelSchema.safeParse(input);
  if (!parsed.success) return parsed.error.issues.map(issue => issue.message);

  const view = parsed.data;
  const errors: string[] = [];
  if (view.route !== API_UI_PARITY_UI_ROUTE) errors.push('view model route must be /aco');
  if (!view.statusLabel.toLowerCase().includes('complete')) {
    errors.push('view model status must communicate terminal completion');
  }
  if (view.summary.packageCount !== bundle.packageCoverage.length) {
    errors.push('view model package count does not match parity bundle');
  }
  if (view.summary.workflowCount !== bundle.workflowCoverage.length) {
    errors.push('view model workflow count does not match parity bundle');
  }
  if (view.summary.remainingGateCount !== bundle.remainingApprovalGates.length) {
    errors.push('view model gate count does not match parity bundle');
  }
  const renderedLabels = view.sections.flatMap(section => section.rows.map(row => row.label));
  for (const workflow of REQUIRED_WORKFLOWS) {
    if (!renderedLabels.includes(workflow)) {
      errors.push(`view model must expose workflow ${workflow}`);
    }
  }
  return errors;
}

export function apiUiTerminalLedger(bundle: ApiUiParityBundle): readonly string[] {
  return [
    ...bundle.packageCoverage.map(item => `${item.slice}:${item.packageName}:${item.status}`),
    ...bundle.workflowCoverage.map(item => `workflow:${item.name}:${item.status}`),
    ...bundle.remainingApprovalGates.map(gate => `gate:${gate.commandId}:${gate.status}`),
  ];
}

export function assertApiUiBundle(input: unknown): ApiUiParityBundle {
  const parsed = apiUiParityBundleSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues.map(issue => issue.message).join('; '));
  const issues = checkApiUiParityBundle(parsed.data);
  if (issues.length > 0) throw new Error(issues.join('; '));
  return parsed.data;
}

export function assertApiUiViewModel(
  input: unknown,
  bundle: ApiUiParityBundle
): ApiUiParityViewModel {
  const parsed = apiUiParityViewModelSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues.map(issue => issue.message).join('; '));
  const issues = checkApiUiParityViewModel(parsed.data, bundle);
  if (issues.length > 0) throw new Error(issues.join('; '));
  return parsed.data;
}
