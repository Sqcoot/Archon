#!/usr/bin/env bun
import { runRealCodexHookSmoke } from '../../packages/context-orchestrator/src/index';

const result = await runRealCodexHookSmoke({
  cwd: process.cwd(),
  enabled: process.env.RUN_REAL_CODEX === '1',
  timeoutMs: Number(process.env.ACO_REAL_CODEX_TIMEOUT_MS ?? 120_000),
  allowGraphifyRefreshInTempHarness: process.env.ALLOW_GRAPHIFY_REFRESH_IN_TEMP_HARNESS === '1',
  graphifyInputMode:
    process.env.GRAPHIFY_INPUT_MODE === 'temp-copy-of-target-repo'
      ? 'temp-copy-of-target-repo'
      : 'fixture-repo',
  targetRepo: process.env.ACO_TARGET_REPO,
});

console.log(JSON.stringify(result, null, 2));
process.exitCode = result.status === 'passed' ? 0 : 2;
