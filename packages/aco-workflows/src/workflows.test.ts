import { describe, expect, test } from 'bun:test';
import { BUNDLED_WORKFLOWS } from '@archon/workflows/defaults';
import {
  buildBundledDefaultInventory,
  buildWorkflowParityBundle,
  checkBundledDefaultInventory,
  checkWorkflowYamlMetadata,
  parseWorkflowYamlMetadata,
  renderBundledDefaultInventoryJson,
  renderDeferredApprovalReportJson,
  renderWorkflowDefaultYaml,
  renderWorkflowParityBundleJson,
  renderWorkflowParitySummaryMarkdown,
  renderWorkflowYamlMetadataJson,
  serializeStableJson,
} from './index';
import type { AcoWorkflowId, BundledDefaultInventoryInput, WorkflowYamlMetadata } from './index';

describe('ACO workflow parity contracts', () => {
  test('renders deterministic S9 workflow contract fixtures', async () => {
    const bundle = buildBundleOrThrow();

    expect(JSON.parse(renderWorkflowParityBundleJson(bundle))).toEqual(
      await loadGoldenJson('workflow-manifest.expected.json')
    );
    expect(renderWorkflowParitySummaryMarkdown(bundle)).toBe(
      await loadGolden('workflow-summary.expected.md')
    );
    expect(JSON.parse(renderDeferredApprovalReportJson(bundle))).toEqual(
      await loadGoldenJson('deferred-approval-required.expected.json')
    );
  });

  test('bundled defaults match workflow contracts and on-disk generated defaults', async () => {
    const bundle = buildBundleOrThrow();
    const metadata = bundledWorkflowMetadata();
    const inventory = unwrap(buildBundledDefaultInventory(bundledInventoryInputs(metadata)));

    expect(checkBundledDefaultInventory(inventory, bundle)).toEqual([]);
    expect(JSON.parse(renderBundledDefaultInventoryJson(inventory))).toEqual(
      await loadGoldenJson('bundled-default-inventory.expected.json')
    );
    expect(JSON.parse(renderWorkflowYamlMetadataJson(metadata))).toEqual(
      await loadGoldenJson('valid-workflow-yaml-metadata.expected.json')
    );

    for (const contract of bundle.contracts) {
      const bundled = BUNDLED_WORKFLOWS[contract.name];
      expect(bundled).toBe(renderWorkflowDefaultYaml(contract));
    }
  });

  test('fails closed for missing workflow, malformed node, and stale bundled default', async () => {
    const bundle = buildBundleOrThrow();
    const metadata = bundledWorkflowMetadata();
    const inputs = bundledInventoryInputs(metadata);

    const missingInventory = unwrap(
      buildBundledDefaultInventory(inputs.filter(input => input.name !== 'context-orchestrate'))
    );
    expect(
      JSON.parse(serializeStableJson(checkBundledDefaultInventory(missingInventory, bundle)))
    ).toEqual(await loadGoldenJson('missing-workflow-failure.expected.json'));

    const malformed = metadata.map(item =>
      item.name === 'context-orchestrate'
        ? { ...item, nodes: item.nodes.filter(node => node.id !== 'compile') }
        : item
    );
    const contextContract = contractOrThrow(bundle, 'context-orchestrate');
    const contextMetadata = malformed.find(item => item.name === 'context-orchestrate');
    if (contextMetadata === undefined) throw new Error('missing context metadata');
    expect(
      JSON.parse(serializeStableJson(checkWorkflowYamlMetadata(contextMetadata, contextContract)))
    ).toEqual(await loadGoldenJson('malformed-node-failure.expected.json'));

    const staleInventory = unwrap(
      buildBundledDefaultInventory(
        inputs.map(input =>
          input.name === 'archon-aco-adversarial-loop'
            ? { ...input, content: `${input.content}\n# stale` }
            : input
        )
      )
    );
    expect(
      JSON.parse(serializeStableJson(checkBundledDefaultInventory(staleInventory, bundle)))
    ).toEqual(await loadGoldenJson('stale-bundled-default-failure.expected.json'));
  });

  test('fixture gate proves S9 workflow parity is read-only and contractual', async () => {
    const { acoWorkflowsFixtureGate } = await import('./index');
    const result = await acoWorkflowsFixtureGate.run(undefined);

    expect(acoWorkflowsFixtureGate.mutates).toBe('read-only');
    expect(result.status).toBe('passed');
    if (result.status !== 'passed') throw new Error('workflow fixture gate did not pass');
    expect(result.value.bundle.contracts.map(contract => contract.name).sort()).toEqual([
      'archon-aco-adversarial-loop',
      'context-orchestrate',
    ]);
  });
});

async function loadGolden(fileName: string): Promise<string> {
  const root = new URL('../../../tests/fixtures/aco/workflows/', import.meta.url);
  return Bun.file(new URL(fileName, root)).text();
}

async function loadGoldenJson(fileName: string): Promise<unknown> {
  return JSON.parse(await loadGolden(fileName));
}

function buildBundleOrThrow() {
  return unwrap(buildWorkflowParityBundle());
}

function bundledWorkflowMetadata(): readonly WorkflowYamlMetadata[] {
  return (['context-orchestrate', 'archon-aco-adversarial-loop'] as const).map(name => {
    const content = BUNDLED_WORKFLOWS[name];
    if (content === undefined) throw new Error(`missing bundled workflow ${name}`);
    const parsed = parseWorkflowYamlMetadata(Bun.YAML.parse(content));
    if (!parsed.ok) throw new Error(parsed.issues.join('; '));
    const contract = contractOrThrow(buildBundleOrThrow(), name);
    const issues = checkWorkflowYamlMetadata(parsed.value, contract);
    if (issues.length > 0) throw new Error(issues.join('; '));
    return parsed.value;
  });
}

function bundledInventoryInputs(
  metadata: readonly WorkflowYamlMetadata[]
): readonly BundledDefaultInventoryInput[] {
  return metadata.map(item => {
    const content = BUNDLED_WORKFLOWS[item.name];
    if (content === undefined) throw new Error(`missing bundled workflow ${item.name}`);
    return {
      name: item.name,
      fileName: `${item.name}.yaml`,
      content,
      nodeIds: item.nodes.map(node => node.id),
    };
  });
}

function contractOrThrow(bundle: ReturnType<typeof buildBundleOrThrow>, name: AcoWorkflowId) {
  const contract = bundle.contracts.find(item => item.name === name);
  if (contract === undefined) throw new Error(`missing contract ${name}`);
  return contract;
}

function unwrap<T>(
  result:
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly issues: readonly string[] }
): T {
  if (!result.ok) throw new Error(result.issues.join('; '));
  return result.value;
}
