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
    ])
  );

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
