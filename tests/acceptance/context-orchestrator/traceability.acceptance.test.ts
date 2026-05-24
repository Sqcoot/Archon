import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { validateContextOrchestrator } from '../../../packages/context-orchestrator/src/validation';

interface TraceabilityManifest {
  requirements: Array<{
    requirement_id: string;
    acceptance: {
      markers: string[];
    };
  }>;
}

describe('ACO traceability acceptance', () => {
  test('Spec: 022-sdd-atdd-traceability-gate-spec.md Acceptance: ACO-TRACE-001 validates the committed manifest', async () => {
    const result = await runTraceability(['--json']);

    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.stdout).toContain('"status": "passed"');
  });

  test('Spec: 022-sdd-atdd-traceability-gate-spec.md Acceptance: ACO-TRACE-002 fails a drifted temporary manifest', async () => {
    const manifestPath = 'docs/context-orchestrator/specs/traceability/aco-traceability.json';
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as TraceabilityManifest;
    const apiRequirement = manifest.requirements.find(
      requirement => requirement.requirement_id === 'AC-P1-API'
    );
    expect(apiRequirement).toBeDefined();
    apiRequirement!.acceptance.markers = ['AC-P1-API-MISSING-MARKER'];

    const tempDir = await mkdtemp(join(tmpdir(), 'aco-traceability-drift-'));
    const tempManifest = join(tempDir, 'aco-traceability.json');
    await writeFile(tempManifest, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    const result = await runTraceability(['--manifest', tempManifest, '--json']);

    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toContain('missing marker');
    expect(result.stdout).toContain('AC-P1-API-MISSING-MARKER');
  });

  test('Spec: 022-sdd-atdd-traceability-gate-spec.md Acceptance: ACO-TRACE-003 aggregate validation reports traceability and selected acceptance', async () => {
    const report = await validateContextOrchestrator({ cwd: process.cwd() });
    const traceability = report.checks.find(check => check.id === 'aco-traceability');
    const acceptance = report.checks.find(check => check.id === 'aco-acceptance');

    expect(report.status).toBe('passed');
    expect(traceability?.status).toBe('passed');
    expect(acceptance?.status).toBe('passed');
    expect(acceptance?.message).toContain('traceability');
  });
});

async function runTraceability(
  args: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const timeoutMs = 10_000;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const proc = Bun.spawn(
    [process.execPath, 'scripts/context-orchestrator/validate-traceability.ts', ...args],
    {
      cwd: process.cwd(),
      stdout: 'pipe',
      stderr: 'pipe',
      env: process.env,
    }
  );
  try {
    const commandResult = Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    const timeoutResult = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        proc.kill();
        reject(new Error(`traceability validation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    const [stdout, stderr, exitCode] = await Promise.race([commandResult, timeoutResult]);
    return { stdout, stderr, exitCode };
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}
