import { describe, expect, test } from 'bun:test';
import {
  APPROVAL_REQUIRED_GRAPH_COMMAND,
  APPROVAL_REQUIRED_GRAPH_SAFETY_CLASS,
  REQUIRED_AGENTIC_SEARCH_SECTIONS,
  REQUIRED_RESEARCH_ARTIFACTS,
  acoResearchFixtureGate,
  buildAgenticSearchReport,
  buildGraphArtifactMetadata,
  buildGraphWaiverClosure,
  buildResearchArtifacts,
  buildResearchArtifactMetadata,
  buildUpstreamGraphManifest,
  checkGraphEvidenceRef,
  graphEvidenceRef,
  parseResearchArtifactBundle,
  readGraphEvidence,
  renderAgenticSearchMarkdown,
  renderAgenticSearchReportJson,
  renderGraphWaiverClosureJson,
  renderUpstreamGraphManifestJson,
} from './index';
import type { GraphEvidenceRef, ResearchArtifactBundle } from './index';

const GOLDEN_FILE_NAMES = {
  'upstream-graph-manifest.json': 'upstream-graph-manifest.expected.json',
  'graph-waiver-closure.json': 'graph-waiver-closure.expected.json',
  'agentic-search-report.json': 'agentic-search-report.expected.json',
  'agentic-search.md': 'agentic-search.expected.md',
} as const;

describe('ACO research artifacts', () => {
  test('renders all required artifacts deterministically against goldens', async () => {
    const bundle = buildResearchArtifacts();

    expect(bundle.ok).toBe(true);
    if (!bundle.ok) throw new Error(bundle.issues.join('\n'));
    expect(bundle.value.artifacts.map(artifact => artifact.name)).toEqual([
      ...REQUIRED_RESEARCH_ARTIFACTS,
    ]);

    for (const artifact of bundle.value.artifacts) {
      const expected = await loadGolden(GOLDEN_FILE_NAMES[artifact.name]);
      if (artifact.name.endsWith('.json')) {
        expect(JSON.parse(artifact.content)).toEqual(JSON.parse(expected));
      } else {
        expect(artifact.content).toBe(expected);
      }
      expect(artifact.content).not.toContain('generatedAt');
      expect(artifact.content).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    }

    const secondRender = buildResearchArtifacts();
    expect(secondRender.ok).toBe(true);
    if (!secondRender.ok) throw new Error(secondRender.issues.join('\n'));
    expect(secondRender.value).toEqual(bundle.value);
  });

  test('preserves exact graph evidence states and fails closed on malformed refs', async () => {
    const complete = await loadGraphRef('graph-evidence.complete.json');
    const failed = await loadGraphRef('graph-evidence.failed.json');
    const waived = await loadGraphRef('graph-evidence.waived.json');
    const notStarted = await loadGraphRef('graph-evidence.not-started.json');

    expect(readGraphEvidence(complete).ok).toBe(true);
    expect(readGraphEvidence(failed).ok).toBe(true);
    expect(readGraphEvidence(waived).ok).toBe(true);
    expect(readGraphEvidence(notStarted).ok).toBe(true);
    expect([complete.status, failed.status, waived.status, notStarted.status]).toEqual([
      'complete',
      'failed',
      'waived',
      'not-started',
    ]);

    const missingStatus: Record<string, unknown> = { ...complete };
    delete missingStatus.status;
    expect(readGraphEvidence(missingStatus).ok).toBe(false);
    expect(
      checkGraphEvidenceRef({ ...complete, graphPath: 'https://example.test/graph.json' })
    ).toEqual(expect.arrayContaining([expect.stringContaining('must not be a network URL')]));
  });

  test('returns approval_required for missing or stale required graph evidence without executing', async () => {
    const staleRef = graphEvidenceRef('archon', 'complete', { nodes: 10, edges: 20 });
    const staleArtifacts = buildGraphArtifactMetadata([staleRef], 'stale');
    const staleClosure = buildGraphWaiverClosure({
      required: true,
      graphRefs: [staleRef],
      artifacts: staleArtifacts,
    });

    expect(staleClosure.ok).toBe(true);
    if (!staleClosure.ok) throw new Error(staleClosure.issues.join('\n'));
    expect(staleClosure.value.status).toBe('approval_required');
    expect(staleClosure.value.command).toBe(APPROVAL_REQUIRED_GRAPH_COMMAND);
    expect(staleClosure.value.safetyClass).toBe(APPROVAL_REQUIRED_GRAPH_SAFETY_CLASS);
    expect(JSON.parse(renderGraphWaiverClosureJson(staleClosure.value))).toEqual(
      JSON.parse(await loadGolden('graph-waiver-closure.stale-approval-required.expected.json'))
    );

    const missingClosure = buildGraphWaiverClosure({
      required: true,
      graphRefs: [staleRef],
      artifacts: [],
    });
    expect(missingClosure.ok).toBe(true);
    if (!missingClosure.ok) throw new Error(missingClosure.issues.join('\n'));
    expect(missingClosure.value.status).toBe('approval_required');
  });

  test('closes waived graph evidence only when waiver and metadata are explicit', () => {
    const waivedRef = graphEvidenceRef('context7', 'waived', {
      nodes: 0,
      edges: 0,
      waiverRequired: true,
    });
    const waivedArtifacts = buildGraphArtifactMetadata([waivedRef], 'waived');
    const closure = buildGraphWaiverClosure({
      required: true,
      graphRefs: [waivedRef],
      artifacts: waivedArtifacts,
    });
    expect(closure.ok).toBe(true);
    if (!closure.ok) throw new Error(closure.issues.join('\n'));
    expect(closure.value.status).toBe('closed');
    expect(closure.value.findings).toContain('context7 graph evidence waived');

    const unsafeWaiver = readGraphEvidence({
      ...waivedRef,
      waiverRequired: false,
    });
    expect(unsafeWaiver.ok).toBe(false);
  });

  test('renders required Agentic Search sections from JSON source of truth', () => {
    const manifest = buildUpstreamGraphManifest();
    expect(manifest.ok).toBe(true);
    if (!manifest.ok) throw new Error(manifest.issues.join('\n'));

    const report = buildAgenticSearchReport(manifest.value);
    expect(report.ok).toBe(true);
    if (!report.ok) throw new Error(report.issues.join('\n'));

    const markdown = renderAgenticSearchMarkdown(report.value);
    const json = renderAgenticSearchReportJson(report.value);
    for (const section of REQUIRED_AGENTIC_SEARCH_SECTIONS) {
      expect(markdown).toContain(`## ${section}`);
    }
    expect(JSON.parse(json).schemaVersion).toBe('aco.agentic-search-report.v1');
    expect(markdown).toContain(report.value.intentHash);
    expect(markdown).toContain('S7');
  });

  test('fixture gate passes defaults and fails duplicate artifacts', async () => {
    const result = await acoResearchFixtureGate.run(undefined);

    expect(acoResearchFixtureGate.mutates).toBe('read-only');
    expect(result.status).toBe('passed');
    if (result.status !== 'passed') throw new Error('fixture gate did not pass');
    expect(result.value.artifactNames).toEqual([...REQUIRED_RESEARCH_ARTIFACTS]);
    expect(result.value.graphStatuses).toEqual(['complete', 'failed', 'waived', 'not-started']);

    const bundle = buildResearchArtifacts();
    expect(bundle.ok).toBe(true);
    if (!bundle.ok) throw new Error(bundle.issues.join('\n'));

    const duplicateBundle: ResearchArtifactBundle = {
      ...bundle.value,
      artifacts: bundle.value.artifacts.map((artifact, index) =>
        index === 1
          ? { ...artifact, name: bundle.value.artifacts[0]?.name ?? artifact.name }
          : artifact
      ),
    };
    expect(parseResearchArtifactBundle(duplicateBundle).ok).toBe(false);
    const duplicateResult = await acoResearchFixtureGate.run(duplicateBundle);
    expect(duplicateResult.status).toBe('failed');
    if (duplicateResult.status !== 'failed') throw new Error('expected duplicate artifact failure');
    expect(duplicateResult.errors.join('\n')).toContain('duplicate research artifact');
  });

  test('metadata checksum and freshness validation are schema-backed', () => {
    const metadata = buildResearchArtifactMetadata({
      path: 'graph/archon/graph-context.json',
      freshness: 'fresh',
    });
    expect(metadata.ok).toBe(true);
    if (!metadata.ok) throw new Error(metadata.issues.join('\n'));
    expect(metadata.value.checksum).toMatch(/^[a-f0-9]{64}$/);

    const invalid = buildResearchArtifactMetadata({
      path: '/tmp/graph-context.json',
      freshness: 'fresh',
    });
    expect(invalid.ok).toBe(false);
  });

  test('upstream manifest fixture covers readonly graph evidence repositories', () => {
    const manifest = buildUpstreamGraphManifest();
    expect(manifest.ok).toBe(true);
    if (!manifest.ok) throw new Error(manifest.issues.join('\n'));

    expect(manifest.value.repositories.map(ref => ref.repository)).toEqual([
      'archon',
      'bmad-automator',
      'bmad-builder',
      'bmad-cis',
      'bmad-method',
      'bmad-plugins-marketplace',
      'bmad-sample-data',
      'bmad-tea',
      'bmad-ui',
      'bmad-wds',
      'caveman',
      'codex',
      'context7',
    ]);
    expect(renderUpstreamGraphManifestJson(manifest.value)).not.toContain('generatedAt');
  });
});

async function loadGolden(fileName: string): Promise<string> {
  const root = new URL('../../../tests/fixtures/aco/research/', import.meta.url);
  return Bun.file(new URL(fileName, root)).text();
}

async function loadGraphRef(fileName: string): Promise<GraphEvidenceRef> {
  const content = await loadGolden(fileName);
  return JSON.parse(content) as GraphEvidenceRef;
}
