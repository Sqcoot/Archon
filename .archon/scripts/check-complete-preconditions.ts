#!/usr/bin/env bun
import { execFileSync } from 'node:child_process';
import { validateBranchName } from './validate-branch-name.ts';

interface GitResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  status?: number;
}

function git(args: string[]): GitResult {
  try {
    const stdout = execFileSync('git', args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    return { ok: true, stdout, stderr: '' };
  } catch (error) {
    const failure = error as { stdout?: Buffer; stderr?: Buffer; status?: number };
    return {
      ok: false,
      stdout: failure.stdout?.toString() ?? '',
      stderr: failure.stderr?.toString() ?? '',
      status: failure.status,
    };
  }
}

function currentBranch(): string {
  return git(['branch', '--show-current']).stdout.trim();
}

const branch = currentBranch();
let failed = false;

if (branch.length === 0) {
  console.error('FAIL current checkout is detached or branch could not be detected.');
  failed = true;
} else {
  const branchResult = validateBranchName(branch);
  if (branchResult.ok) {
    console.log(`PASS branch name is valid: ${branch}`);
  } else {
    console.error(`FAIL branch name is invalid: ${branch}`);
    for (const error of branchResult.errors) {
      console.error(`  - ${error}`);
    }
    failed = true;
  }
  for (const warning of branchResult.warnings) {
    console.warn(`WARN ${warning}`);
  }
}

const status = git(['status', '--porcelain']);
if (!status.ok) {
  console.error('FAIL could not inspect git status.');
  if (status.stderr.trim()) {
    console.error(status.stderr.trim());
  }
  failed = true;
} else if (status.stdout.trim().length === 0) {
  console.log('PASS working tree is clean.');
} else {
  console.error('FAIL working tree is not clean. Commit, explicitly preserve, or move these changes before complete/cleanup:');
  console.error(status.stdout.trim());
  failed = true;
}

const upstream = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
if (!upstream.ok || upstream.stdout.trim().length === 0) {
  console.warn('WARN no upstream branch is configured; merge/push status cannot be inferred.');
} else {
  const upstreamName = upstream.stdout.trim();
  const counts = git(['rev-list', '--left-right', '--count', `${upstreamName}...HEAD`]);
  if (counts.ok) {
    const [behindRaw, aheadRaw] = counts.stdout.trim().split(/\s+/);
    const behind = Number(behindRaw);
    const ahead = Number(aheadRaw);
    if (Number.isFinite(ahead) && ahead > 0) {
      console.warn(`WARN branch is ${ahead} commit(s) ahead of ${upstreamName}; push or confirm merge status before complete.`);
    }
    if (Number.isFinite(behind) && behind > 0) {
      console.warn(`WARN branch is ${behind} commit(s) behind ${upstreamName}; update deliberately before complete.`);
    }
    if (ahead === 0 && behind === 0) {
      console.log(`PASS branch matches upstream: ${upstreamName}`);
    }
  } else {
    console.warn(`WARN could not compare branch with upstream ${upstreamName}.`);
  }
}

console.log('');
console.log('No cleanup was run. After human approval and successful merge, possible follow-up commands are:');
console.log(`  bun run validate`);
if (branch.length > 0) {
  console.log(`  git push -u <remote> ${branch}`);
  console.log(`  archon complete ${branch}`);
}
console.log('Run destructive cleanup only after explicit approval and after preserving needed work.');

if (failed) {
  process.exit(1);
}
