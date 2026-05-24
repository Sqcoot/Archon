#!/usr/bin/env bun
import { runAcoCodexHook } from '../../packages/context-orchestrator/src/index';

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const cwd = valueAfter(args, '--cwd') ?? process.cwd();
  const maxBytesRaw = valueAfter(args, '--max-bytes');
  const maxBytes = maxBytesRaw === undefined ? 4_000 : Number(maxBytesRaw);
  if (!Number.isInteger(maxBytes) || maxBytes < 500) {
    console.error('--max-bytes must be an integer >= 500');
    return 1;
  }

  const input = await readStdinJson();
  const result = await runAcoCodexHook({
    cwd,
    input,
    maxBytes,
    runId: process.env.ACO_TEST_RUN_ID,
    logPath: process.env.ACO_HOOK_LOG,
  });
  process.stdout.write(result.outputText);
  return 0;
}

async function readStdinJson(): Promise<Record<string, unknown>> {
  const text = await new Response(Bun.stdin.stream()).text();
  if (!text.trim()) return {};
  const parsed = JSON.parse(text) as unknown;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Hook input must be a JSON object.');
  }
  return parsed as Record<string, unknown>;
}

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

main()
  .then(code => {
    process.exitCode = code;
  })
  .catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
