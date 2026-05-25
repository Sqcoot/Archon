import { describe, expect, test } from 'bun:test';
import { buildContextStatus } from '@archon/aco-context';
import {
  acoApiUiFixtureGate,
  buildApiUiParityBundle,
  buildApiUiParityViewModel,
  checkApiUiParityBundle,
  checkApiUiParityViewModel,
  renderApiUiParityBundleJson,
  renderApiUiParityViewModelJson,
  renderApiUiSummaryMarkdown,
  renderFinalParityLedgerJson,
} from './index';

describe('ACO API/UI parity contracts', () => {
  test('renders deterministic terminal S10 fixtures', async () => {
    const bundle = buildBundleOrThrow();
    const view = buildViewOrThrow(bundle);

    expect(JSON.parse(renderApiUiParityBundleJson(bundle))).toEqual(
      await loadGoldenJson('api-parity.expected.json')
    );
    expect(JSON.parse(renderApiUiParityViewModelJson(view))).toEqual(
      await loadGoldenJson('web-view-model.expected.json')
    );
    expect(renderApiUiSummaryMarkdown(bundle)).toBe(await loadGolden('ui-summary.expected.md'));
    expect(JSON.parse(renderFinalParityLedgerJson(bundle))).toEqual(
      await loadGoldenJson('final-parity-ledger.expected.json')
    );
    const terminalFixture = (await loadGoldenJson('terminal-next-slice.expected.json')) as {
      nextSlice: null;
      sourceTerminality: typeof bundle.sourceTerminality;
    };
    expect({ nextSlice: bundle.nextSlice, sourceTerminality: bundle.sourceTerminality }).toEqual(
      terminalFixture
    );
  });

  test('fails closed for stale S9 terminality and missing API/UI contracts', async () => {
    const bundle = buildBundleOrThrow();

    const staleContext = unwrap(buildContextStatus({ prompt: 'S10 stale' }));
    const staleContextInput = {
      ...bundle,
      sourceTerminality: {
        ...bundle.sourceTerminality,
        contextNextSlice: 'S10 API/UI parity after workflow contracts are committed',
        terminal: false,
      },
      contextCoverage: {
        ...bundle.contextCoverage,
        nextSlice: staleContext.nextSlice,
      },
    };
    expect(JSON.parse(stableFailure(checkApiUiParityBundle(staleContextInput)))).toEqual(
      await loadGoldenJson('stale-s9-fixture-failure.expected.json')
    );

    const missingApi = {
      ...bundle,
      surfaceContracts: bundle.surfaceContracts.filter(surface => surface.id !== 'api.aco.parity'),
    };
    expect(JSON.parse(stableFailure(checkApiUiParityBundle(missingApi)))).toEqual(
      await loadGoldenJson('missing-api-contract-failure.expected.json')
    );

    const missingUi = {
      ...bundle,
      surfaceContracts: bundle.surfaceContracts.filter(surface => surface.id !== 'ui.aco.parity'),
    };
    expect(JSON.parse(stableFailure(checkApiUiParityBundle(missingUi)))).toEqual(
      await loadGoldenJson('missing-ui-contract-failure.expected.json')
    );
  });

  test('fails closed for unknown parity surfaces and view model drift', async () => {
    const bundle = buildBundleOrThrow();
    const unknownSurface = {
      ...bundle,
      surfaceContracts: [
        bundle.surfaceContracts[0],
        {
          ...bundle.surfaceContracts[1],
          id: 'ui.aco.future',
        },
      ],
    };
    expect(JSON.parse(stableFailure(checkApiUiParityBundle(unknownSurface)))).toEqual(
      await loadGoldenJson('unknown-parity-surface-failure.expected.json')
    );

    const view = buildViewOrThrow(bundle);
    const driftedView = {
      ...view,
      summary: {
        ...view.summary,
        workflowCount: 0,
      },
    };
    expect(JSON.parse(stableFailure(checkApiUiParityViewModel(driftedView, bundle)))).toEqual(
      await loadGoldenJson('missing-ui-view-model-failure.expected.json')
    );
  });

  test('fixture gate proves S10 API/UI parity is terminal and read-only', async () => {
    const result = await acoApiUiFixtureGate.run(undefined);

    expect(acoApiUiFixtureGate.mutates).toBe('read-only');
    expect(result.status).toBe('passed');
    if (result.status !== 'passed') throw new Error('API/UI fixture gate did not pass');
    expect(result.value.bundle.nextSlice).toBeNull();
    expect(result.value.bundle.sourceTerminality.terminal).toBe(true);
  });
});

async function loadGolden(fileName: string): Promise<string> {
  const root = new URL('../../../tests/fixtures/aco/api-ui/', import.meta.url);
  return Bun.file(new URL(fileName, root)).text();
}

async function loadGoldenJson(fileName: string): Promise<unknown> {
  return JSON.parse(await loadGolden(fileName));
}

function buildBundleOrThrow() {
  return unwrap(buildApiUiParityBundle());
}

function buildViewOrThrow(bundle: ReturnType<typeof buildBundleOrThrow>) {
  return unwrap(buildApiUiParityViewModel(bundle));
}

function unwrap<T>(
  result:
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly issues: readonly string[] }
): T {
  if (!result.ok) throw new Error(result.issues.join('; '));
  return result.value;
}

function stableFailure(issues: readonly string[]): string {
  return JSON.stringify([...issues].sort(), null, 2);
}
