import { createHash } from 'crypto';
import { execFileAsync } from '@archon/git';
import { redactSecrets } from './security';
import type { ContextIntent } from './types';

export interface CreateContextIntentOptions {
  cwd: string;
  objective?: string;
  timestamp?: string;
  commitSha?: string;
}

export async function createContextIntent(
  options: CreateContextIntentOptions
): Promise<ContextIntent> {
  const generatedAt = options.timestamp ?? new Date().toISOString();
  const objective = redactSecrets(
    normalizeWhitespace(options.objective ?? deriveDefaultObjective(options.cwd))
  );
  const normalizedObjective = normalizeObjective(objective);
  const commitSha = redactSecrets(options.commitSha ?? (await getCommitSha(options.cwd)));
  const intentHash = hashIntent(normalizedObjective, options.cwd, commitSha);

  return {
    objective,
    normalizedObjective,
    intentHash,
    cwd: redactSecrets(options.cwd),
    commitSha,
    generatedAt: redactSecrets(generatedAt),
  };
}

export function deriveDefaultObjective(cwd: string): string {
  return `Inspect Context Orchestrator readiness for ${cwd}`;
}

export function normalizeObjective(objective: string): string {
  return normalizeWhitespace(objective).toLowerCase();
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function hashIntent(normalizedObjective: string, cwd: string, commitSha: string): string {
  return createHash('sha256')
    .update(redactSecrets(normalizedObjective))
    .update('\n')
    .update(redactSecrets(cwd))
    .update('\n')
    .update(redactSecrets(commitSha))
    .digest('hex');
}

async function getCommitSha(cwd: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['-C', cwd, 'rev-parse', 'HEAD'], {
      timeout: 5000,
    });
    const sha = stdout.trim();
    return sha.length > 0 ? sha : 'unknown';
  } catch {
    return 'unknown';
  }
}
