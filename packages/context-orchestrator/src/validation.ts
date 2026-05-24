import { access, readFile } from 'fs/promises';
import { join } from 'path';
import type { ValidationCheck, ValidationReport } from './types';

export interface ValidateContextOrchestratorOptions {
  cwd: string;
}

const selectedAcceptanceSurfaces = [
  {
    id: 'AC-P1-API',
    label: 'API',
    path: 'tests/acceptance/context-orchestrator/api.acceptance.test.ts',
    markers: ['AC-P1-API'],
  },
  {
    id: 'AC-P1-SLASH',
    label: 'slash command',
    path: 'tests/acceptance/context-orchestrator/command.acceptance.test.ts',
    markers: ['AC-P1-SLASH'],
  },
  {
    id: 'AC-P3-WF',
    label: 'workflow',
    path: 'tests/acceptance/context-orchestrator/workflow.acceptance.test.ts',
    markers: ['AC-P3-WF'],
  },
  {
    id: 'ACO-EVENTS-001',
    label: 'events',
    path: 'tests/acceptance/context-orchestrator/events.acceptance.test.ts',
    markers: ['ACO-EVENTS-001'],
  },
] as const;
const VALIDATION_COMMAND_TIMEOUT_MS = 10_000;

export async function validateContextOrchestrator(
  options: ValidateContextOrchestratorOptions
): Promise<ValidationReport> {
  const checks: ValidationCheck[] = [];

  checks.push(
    await fileCheck(
      'aco-specs',
      join(options.cwd, 'docs/context-orchestrator/specs/000-product-charter.md')
    )
  );
  checks.push(
    await fileCheck(
      'aco-upstream-manifest',
      join(options.cwd, 'docs/context-orchestrator/research/upstream-manifest.json')
    )
  );
  checks.push(
    await packageScriptCheck(options.cwd, [
      'research:bootstrap',
      'research:update-upstreams',
      'research:graph',
      'research:merge-graphs',
      'research:validate-corpus',
      'aco:policy:test',
      'aco:policy:fixtures',
      'aco:policy',
      'aco:traceability',
      'aco:test:acceptance',
    ])
  );
  checks.push(await acceptanceRealityCheck(options.cwd));
  checks.push(await policyCheck(options.cwd));
  checks.push(await traceabilityCheck(options.cwd));

  const failed = checks.some(check => check.status === 'failed');
  const warned = checks.some(check => check.status === 'warning');
  return {
    status: failed ? 'failed' : warned ? 'warning' : 'passed',
    checks,
  };
}

async function acceptanceRealityCheck(cwd: string): Promise<ValidationCheck> {
  const failures: string[] = [];

  for (const surface of selectedAcceptanceSurfaces) {
    const absolutePath = join(cwd, surface.path);
    let content: string;
    try {
      content = await readFile(absolutePath, 'utf8');
    } catch {
      failures.push(`${surface.id} ${surface.label}: ${surface.path} is missing`);
      continue;
    }

    if (content.includes('test.todo')) {
      failures.push(`${surface.id} ${surface.label}: still uses test.todo`);
    }
    if (content.includes('deferred from CLI MVP')) {
      failures.push(`${surface.id} ${surface.label}: still claims deferred from CLI MVP`);
    }

    const missingMarkers = surface.markers.filter(marker => !content.includes(marker));
    if (missingMarkers.length > 0) {
      failures.push(
        `${surface.id} ${surface.label}: missing acceptance marker(s) ${missingMarkers.join(', ')}`
      );
    }
  }

  if (failures.length > 0) {
    return {
      id: 'aco-acceptance',
      status: 'failed',
      message: `ACO acceptance reality check failed: ${failures.join('; ')}`,
    };
  }

  return {
    id: 'aco-acceptance',
    status: 'passed',
    message: 'ACO acceptance reality check passed for API, slash command, workflow, and events.',
  };
}

async function fileCheck(id: string, path: string): Promise<ValidationCheck> {
  try {
    await access(path);
    return { id, status: 'passed', message: `${path} exists.` };
  } catch {
    return { id, status: 'failed', message: `${path} is missing.` };
  }
}

async function policyCheck(cwd: string): Promise<ValidationCheck> {
  const skipRequested = process.env.ARCHON_SKIP_OPA === '1';
  const ci = process.env.CI === 'true';

  if (skipRequested && ci) {
    return {
      id: 'aco-policy',
      status: 'failed',
      message: 'ARCHON_SKIP_OPA=1 is forbidden when CI=true.',
    };
  }

  if (skipRequested) {
    return {
      id: 'aco-policy',
      status: 'warning',
      message:
        'ARCHON_SKIP_OPA=1 requested; OPA policy validation skipped for local aggregate validation only.',
    };
  }

  try {
    const { stdout, stderr, exitCode } = await runBunScript(cwd, 'aco:policy');
    const output = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');

    if (exitCode === 0) {
      return {
        id: 'aco-policy',
        status: 'passed',
        message: summarizeOutput(output, 'OPA prompt-package policy validation passed.'),
      };
    }

    return {
      id: 'aco-policy',
      status: 'failed',
      message: summarizeOutput(
        output,
        `OPA prompt-package policy validation failed (${exitCode}).`
      ),
    };
  } catch (error) {
    return {
      id: 'aco-policy',
      status: 'failed',
      message: `OPA prompt-package policy validation could not run: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function traceabilityCheck(cwd: string): Promise<ValidationCheck> {
  try {
    const { stdout, stderr, exitCode } = await runBunScript(cwd, 'aco:traceability');
    const output = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');

    if (exitCode === 0) {
      return {
        id: 'aco-traceability',
        status: 'passed',
        message: summarizeOutput(output, 'ACO traceability validation passed.'),
      };
    }

    return {
      id: 'aco-traceability',
      status: 'failed',
      message: summarizeOutput(output, `ACO traceability validation failed (${exitCode}).`),
    };
  } catch (error) {
    return {
      id: 'aco-traceability',
      status: 'failed',
      message: `ACO traceability validation could not run: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function runBunScript(
  cwd: string,
  script: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  let proc: ReturnType<typeof Bun.spawn> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    proc = Bun.spawn([process.execPath, 'run', script], {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
      env: process.env,
    });
    const commandResult: Promise<[string, string, number]> = Promise.all([
      new Response(proc.stdout as ReadableStream<Uint8Array>).text(),
      new Response(proc.stderr as ReadableStream<Uint8Array>).text(),
      proc.exited,
    ]);
    const timeoutResult = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        proc?.kill();
        reject(
          new Error(`bun run ${script} timed out after ${String(VALIDATION_COMMAND_TIMEOUT_MS)}ms`)
        );
      }, VALIDATION_COMMAND_TIMEOUT_MS);
    });
    const [stdout, stderr, exitCode] = await Promise.race([commandResult, timeoutResult]);
    return { stdout, stderr, exitCode };
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

function summarizeOutput(output: string, fallback: string): string {
  if (output.length === 0) return fallback;
  const normalized = output.replace(/\s+/g, ' ').trim();
  return normalized.length > 400 ? `${normalized.slice(0, 397)}...` : normalized;
}

async function packageScriptCheck(cwd: string, scripts: string[]): Promise<ValidationCheck> {
  try {
    const pkg = JSON.parse(await readFile(join(cwd, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const missing = scripts.filter(script => pkg.scripts?.[script] === undefined);
    if (missing.length > 0) {
      return {
        id: 'aco-package-scripts',
        status: 'failed',
        message: `Missing package scripts: ${missing.join(', ')}`,
      };
    }
    return {
      id: 'aco-package-scripts',
      status: 'passed',
      message: 'Required ACO research and validation package scripts exist.',
    };
  } catch {
    return {
      id: 'aco-package-scripts',
      status: 'failed',
      message: 'package.json could not be read.',
    };
  }
}
