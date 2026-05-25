import { describe, expect, test } from 'bun:test';
import {
  AcoCommandRouter,
  REQUIRED_ACO_COMMAND_SURFACES,
  acoCliContractsFixtureGate,
  approvalRequiredCommandResult,
  buildCommandCatalog,
  checkDescriptorCoverage,
  commandDescriptorById,
  commandDescriptors,
  renderCliResultJson,
  renderCommandCatalogJson,
  renderCommandHelpMarkdown,
  renderCommandPlanMarkdown,
  renderSafetyMatrixJson,
} from './index';
import type { AcoCommandDescriptor, CommandInvocation } from './index';
import type { AcoCommandCatalog } from './schemas';

describe('ACO CLI command contracts', () => {
  test('covers every command-ledger surface and renders stable catalog fixtures', async () => {
    const catalog = buildCatalogOrThrow();

    expect(checkDescriptorCoverage(catalog.descriptors)).toEqual([]);
    expect(catalog.descriptors.map(descriptor => descriptor.display).sort()).toEqual(
      [...REQUIRED_ACO_COMMAND_SURFACES].sort()
    );
    expect(JSON.parse(renderCommandCatalogJson(catalog))).toEqual(
      JSON.parse(await loadGolden('command-catalog.expected.json'))
    );
    expect(renderCommandHelpMarkdown(catalog)).toBe(await loadGolden('command-help.expected.md'));
    expect(JSON.parse(renderSafetyMatrixJson(catalog))).toEqual(
      JSON.parse(await loadGolden('safety-matrix.expected.json'))
    );
  });

  test('renders supported and deferred command plans deterministically', async () => {
    const supported = descriptorOrThrow('archon.aco.status');
    const deferred = descriptorOrThrow('archon.context.compile');

    expect(renderCommandPlanMarkdown(supported)).toBe(
      await loadGolden('supported-command-plan.expected.md')
    );
    expect(renderCommandPlanMarkdown(deferred)).toBe(
      await loadGolden('deferred-command-plan.expected.md')
    );
  });

  test('routes supported commands through injected handlers only', async () => {
    const catalog = buildCatalogOrThrow();
    const router = new AcoCommandRouter({
      descriptors: catalog.descriptors,
      handlers: [
        {
          commandId: 'archon.aco.status',
          handler: (_invocation, descriptor) => ({
            kind: 'aco-cli-command-result',
            schemaVersion: 'aco.cli-command-result.v1',
            commandId: descriptor.id,
            display: descriptor.display,
            status: 'ok',
            exitCode: 0,
            stdout: 'status ok\n',
            stderr: '',
            data: { handler: 'fake' },
            evidence: descriptor.evidence,
          }),
        },
      ],
    });

    const result = await router.dispatch(invocation('archon.aco.status'));
    expect(result.status).toBe('ok');
    expect(result.stdout).toBe('status ok\n');

    const unregistered = await new AcoCommandRouter({ descriptors: catalog.descriptors }).dispatch(
      invocation('archon.aco.status')
    );
    expect(unregistered.status).toBe('deferred');
    expect(unregistered.stderr).toContain('no S7 handler is registered');
  });

  test('fails closed for unknown commands, readonly mutation, and missing approval', async () => {
    const catalog = buildCatalogOrThrow();
    const router = new AcoCommandRouter({ descriptors: catalog.descriptors });

    const unknown = await router.dispatch(invocation('archon context nope'));
    expect(JSON.parse(renderCliResultJson(unknown))).toEqual(
      JSON.parse(await loadGolden('unsupported-command-diagnostic.expected.json'))
    );

    const readonlyMutation = await router.dispatch(
      invocation('archon.context.compile', ['writes-artifacts'], true)
    );
    expect(readonlyMutation.status).toBe('denied');
    expect(readonlyMutation.stderr).toContain('readonly context forbids');

    const graph = await router.dispatch(invocation('bun.research.graph', ['writes-graph-cache']));
    expect(JSON.parse(renderCliResultJson(graph))).toEqual(
      JSON.parse(await loadGolden('approval-required-diagnostic.expected.json'))
    );
  });

  test('fixture gate proves descriptor parity', async () => {
    const result = await acoCliContractsFixtureGate.run(undefined);

    expect(acoCliContractsFixtureGate.mutates).toBe('read-only');
    expect(result.status).toBe('passed');
    if (result.status !== 'passed') throw new Error('fixture gate did not pass');
    expect(result.value.descriptorCount).toBe(REQUIRED_ACO_COMMAND_SURFACES.length);
    expect(result.value.statusCounts).toEqual({
      supported: 6,
      deferred: 5,
      'approval-required': 1,
    });

    const duplicate = commandDescriptors().map((descriptor, index) =>
      index === 1
        ? { ...descriptor, display: commandDescriptors()[0]?.display ?? descriptor.display }
        : descriptor
    );
    const failed = await acoCliContractsFixtureGate.run(duplicate);
    expect(failed.status).toBe('failed');
  });

  test('approval-required helper uses descriptor evidence and stable exit code', () => {
    const descriptor = descriptorOrThrow('archon.context.compile');
    const result = approvalRequiredCommandResult(descriptor, ['writes-artifacts']);

    expect(result.status).toBe('approval_required');
    expect(result.exitCode).toBe(2);
    expect(result.evidence).toEqual(descriptor.evidence);
  });
});

async function loadGolden(fileName: string): Promise<string> {
  const root = new URL('../../../tests/fixtures/aco/cli-contracts/', import.meta.url);
  return Bun.file(new URL(fileName, root)).text();
}

function buildCatalogOrThrow(): AcoCommandCatalog {
  const catalog = buildCommandCatalog();
  if (!catalog.ok) throw new Error(catalog.issues.join('\n'));
  return catalog.value;
}

function descriptorOrThrow(id: string): AcoCommandDescriptor {
  const descriptor = commandDescriptorById(id);
  if (descriptor === undefined) throw new Error(`missing descriptor ${id}`);
  return descriptor;
}

function invocation(
  commandId: string,
  requestedMutations: readonly CommandInvocation['requestedMutations'][number][] = [],
  readonlyContext = false
): CommandInvocation {
  return {
    commandId,
    argv: [],
    args: {},
    options: {},
    cwd: '/repo',
    outputMode: 'markdown',
    requestedMutations,
    readonlyContext,
    approval: null,
  };
}
