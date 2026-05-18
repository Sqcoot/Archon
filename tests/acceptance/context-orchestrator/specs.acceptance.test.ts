import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { validateContextOrchestrator } from '@archon/context-orchestrator';

const specDir = join(process.cwd(), 'docs/context-orchestrator/specs');
const traceabilityManifestPath = join(specDir, 'traceability', 'aco-traceability.json');
const requiredSections = [
  '## Purpose',
  '## Scope',
  '## Non-Goals',
  '## Generic Behavior',
  '## Archon-Specific Behavior',
  '## Inputs',
  '## Outputs',
  '## Known Unknowns',
  '## Evidence References',
  '## Acceptance Scenarios',
  '## Failure Behavior',
  '## Security Constraints',
  '## Open Questions',
];

const specs = [
  '000-product-charter.md',
  '001-domain-glossary.md',
  '002-capability-model.md',
  '003-evidence-model.md',
  '004-graph-context-spec.md',
  '005-documentation-resolution-spec.md',
  '006-bmad-routing-spec.md',
  '007-caveman-policy-spec.md',
  '008-prompt-package-spec.md',
  '009-archive-artifact-spec.md',
  '010-codex-readiness-spec.md',
  '011-command-contract.md',
  '012-cli-contract.md',
  '014-workflow-contracts.md',
  '015-security-threat-model.md',
  '016-acceptance-test-plan.md',
  '017-implementation-discovery-protocol.md',
  '018-release-readiness-spec.md',
  '019-observability-and-events-spec.md',
  '020-package-scripts-and-research-corpus-spec.md',
  '021-opa-prompt-package-policy-spec.md',
  '022-sdd-atdd-traceability-gate-spec.md',
];

interface TraceabilityManifest {
  requirements: Array<{
    evidence: Array<{
      markers: string[];
    }>;
  }>;
}

describe('ACO spec acceptance', () => {
  test('Spec: 016-acceptance-test-plan.md Acceptance: ACO-SPECS-001 required specs are sectioned', async () => {
    for (const spec of specs) {
      const content = await readFile(join(specDir, spec), 'utf8');
      for (const section of requiredSections) {
        expect(content).toContain(section);
      }
    }
  });

  test('Spec: 022-sdd-atdd-traceability-gate-spec.md Acceptance: ACO-TRACE-001 manifest links ACO-POLICY-001 ACO-POLICY-002 ACO-POLICY-003 ACO-POLICY-DECISION-001 ACO-POLICY-DECISION-002 ACO-POLICY-DECISION-003', async () => {
    const report = await runTraceability(['--json']);
    expect(report.status).toBe('passed');
    expect(report.errors).toHaveLength(0);
  });

  test('Spec: 022-sdd-atdd-traceability-gate-spec.md Acceptance: ACO-TRACE-002 temp manifest missing marker fails without mutating committed manifest', async () => {
    const manifest = JSON.parse(
      await readFile(traceabilityManifestPath, 'utf8')
    ) as TraceabilityManifest;
    manifest.requirements[0].evidence[0].markers = ['__missing_trace_marker__'];
    const tempDir = await mkdtemp(join(tmpdir(), 'aco-traceability-'));
    const tempManifestPath = join(tempDir, 'aco-traceability.json');
    await writeFile(tempManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    const report = await runTraceability(['--json', '--manifest', tempManifestPath], 1);
    expect(report.status).toBe('failed');
    expect(
      report.errors.some(
        error =>
          error.requirement_id === 'ACO-POLICY-001' && error.marker === '__missing_trace_marker__'
      )
    ).toBe(true);
  });

  test('Spec: 022-sdd-atdd-traceability-gate-spec.md Acceptance: ACO-TRACE-003 aggregate validation reports traceability check', async () => {
    const report = await validateContextOrchestrator({ cwd: process.cwd() });
    const traceabilityCheck = report.checks.find(check => check.id === 'aco-traceability');
    expect(traceabilityCheck?.status).toBe('passed');
  });
});

async function runTraceability(
  args: string[],
  expectedExitCode = 0
): Promise<{
  status: 'passed' | 'failed';
  errors: Array<{ requirement_id?: string; marker?: string }>;
}> {
  const proc = Bun.spawn(
    [process.execPath, 'scripts/context-orchestrator/validate-traceability.ts', ...args],
    {
      cwd: process.cwd(),
      stdout: 'pipe',
      stderr: 'pipe',
      env: process.env,
    }
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  expect(stderr).toBe('');
  expect(exitCode).toBe(expectedExitCode);
  return JSON.parse(stdout) as {
    status: 'passed' | 'failed';
    errors: Array<{ requirement_id?: string; marker?: string }>;
  };
}
