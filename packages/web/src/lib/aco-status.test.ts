import { afterEach, describe, expect, mock, test } from 'bun:test';
import { getAcoStatus } from './api';

describe('getAcoStatus', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('AC-ACO-STATUS-004 builds the selected project cwd endpoint', async () => {
    const fetchMock = mock(async (_input: RequestInfo | URL) => {
      return new Response(
        JSON.stringify({
          cwd: '/tmp/project with space',
          validationStatus: 'passed',
          graphStatus: 'forbidden',
          graphWaivers: 2,
          graphWaiverIds: [
            'graph-waiver.bmad-plugins-marketplace',
            'graph-waiver.bmad-sample-data',
          ],
          ledgerSchemaVersion: 'aco.ledger-bundle.v1',
          ledgerSummary: {
            toolAvailability: { total: 20, counts: {} },
            commands: { total: 19, counts: {} },
            combined: { total: 39, counts: {} },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const status = await getAcoStatus('/tmp/project with space');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/aco/status?cwd=%2Ftmp%2Fproject+with+space',
      undefined
    );
    expect(status.ledgerSchemaVersion).toBe('aco.ledger-bundle.v1');
    expect(status.graphWaiverIds).toContain('graph-waiver.bmad-sample-data');
  });
});
