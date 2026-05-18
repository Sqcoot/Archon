import { access, readFile } from 'fs/promises';
import { join } from 'path';
import type { ValidationCheck, ValidationReport } from './types';

export interface ValidateContextOrchestratorOptions {
  cwd: string;
}

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
    ])
  );
  checks.push(await policyCheck(options.cwd));

  const failed = checks.some(check => check.status === 'failed');
  const warned = checks.some(check => check.status === 'warning');
  return {
    status: failed ? 'failed' : warned ? 'warning' : 'passed',
    checks,
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
    const proc = Bun.spawn(['bun', 'run', 'aco:policy'], {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
      env: process.env,
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
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
      message: 'Required ACO research package scripts exist.',
    };
  } catch {
    return {
      id: 'aco-package-scripts',
      status: 'failed',
      message: 'package.json could not be read.',
    };
  }
}
