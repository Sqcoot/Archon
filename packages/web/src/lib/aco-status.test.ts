import { afterEach, describe, expect, mock, test } from 'bun:test';
import {
  compileAcoPackage,
  getAcoArtifactPackage,
  getAcoLedgers,
  getAcoRoute,
  getAcoStatus,
} from './api';

describe('getAcoStatus', () => {
  const originalFetch = globalThis.fetch;
  const contextIntent = {
    objective: 'Implement native loop',
    normalizedObjective: 'implement native loop',
    intentHash: 'intent-123',
    cwd: '/tmp/project',
    commitSha: 'abc123',
    generatedAt: '2026-05-18T12:00:00.000Z',
  };

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('AC-ACO-STATUS-004 builds the selected project cwd endpoint', async () => {
    const fetchMock = mock(async (_input: RequestInfo | URL) => {
      return new Response(
        JSON.stringify({
          cwd: '/tmp/project with space',
          contextIntent,
          validationStatus: 'passed',
          graphStatus: 'forbidden',
          graphWaivers: 2,
          graphWaiverIds: [
            'graph-waiver.bmad-plugins-marketplace',
            'graph-waiver.bmad-sample-data',
          ],
          waivers: [],
          approvalRequired: true,
          readiness: 'needs_approval',
          ledgerSchemaVersion: 'aco.ledger-bundle.v1',
          evidenceBlockers: [],
          evidenceResolution: { required: false, items: [] },
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

    const status = await getAcoStatus('/tmp/project with space', 'Implement native loop');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/aco/status?cwd=%2Ftmp%2Fproject+with+space&objective=Implement+native+loop',
      undefined
    );
    expect(status.contextIntent.intentHash).toBe('intent-123');
    expect(status.ledgerSchemaVersion).toBe('aco.ledger-bundle.v1');
    expect(status.graphWaiverIds).toContain('graph-waiver.bmad-sample-data');
    expect(status.readiness).toBe('needs_approval');
  });

  test('AC-P1-WEB calls route, ledgers, compile, and artifact package endpoints', async () => {
    const fetchMock = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('/api/aco/ledgers')) {
        return jsonResponse({
          schemaVersion: 'aco.ledger-bundle.v1',
          contextIntent,
          evidenceBlockers: [],
          summary: {},
        });
      }
      if (url === '/api/aco/route') {
        expect(init?.method).toBe('POST');
        return jsonResponse({
          id: 'brownfield-architecture',
          label: 'Brownfield Architecture',
          steps: ['bmad-investigate'],
          rationale: 'Architecture-sensitive request.',
        });
      }
      if (url === '/api/aco/compile') {
        expect(init?.method).toBe('POST');
        return jsonResponse({
          runId: 'run-1',
          contextIntent,
          archivePath: '/tmp/project/.archon/artifacts/context-orchestrator/run-1',
          files: {},
          route: {
            id: 'brownfield-architecture',
            label: 'Brownfield Architecture',
            steps: ['bmad-investigate'],
            rationale: 'Architecture-sensitive request.',
          },
          graphStatus: 'forbidden',
          graphWaivers: 2,
          graphWaiverIds: [],
          waivers: [],
          approvalRequired: true,
          readiness: 'needs_approval',
          validationStatus: 'passed',
          ledgerSchemaVersion: 'aco.ledger-bundle.v1',
          evidenceBlockers: [],
          evidenceResolution: { required: false, items: [] },
          ledgerSummary: {},
        });
      }
      if (url.startsWith('/api/aco/artifact-packages/run-1')) {
        return jsonResponse({
          runId: 'run-1',
          archivePath: '/tmp/package',
          manifest: {},
          files: [],
        });
      }
      return new Response('not found', { status: 404 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await getAcoLedgers('/tmp/project');
    await getAcoRoute('/tmp/project', 'Implement native loop');
    await compileAcoPackage('/tmp/project', 'Implement native loop');
    await getAcoArtifactPackage('/tmp/project', 'run-1');

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
