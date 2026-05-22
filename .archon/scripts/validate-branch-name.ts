#!/usr/bin/env bun
import { execFileSync } from 'node:child_process';

interface BranchValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const SAFE_BRANCH_PATTERN = /^[A-Za-z0-9._/-]+$/;
const UNSAFE_SHELL_PATTERN = /[\s;&|$`"'(){}<>\\[\]*?!#\n\r\t]/;
const ALLOWED_PREFIXES = [
  'archon/',
  'codex/',
  'stabilization/',
  'feature/',
  'feat/',
  'fix/',
  'bugfix/',
  'chore/',
  'docs/',
  'refactor/',
  'test/',
  'hotfix/',
  'release/',
];
const ALLOWED_EXACT = new Set(['main', 'dev', 'develop']);

function git(args: string[]): string {
  return execFileSync('git', args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}

function currentBranch(): string {
  return git(['branch', '--show-current']);
}

export function validateBranchName(branchName: string): BranchValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (branchName.trim().length === 0) {
    errors.push('branch name is empty or detached');
    return { ok: false, errors, warnings };
  }

  if (branchName !== branchName.trim()) {
    errors.push('branch name has leading or trailing whitespace');
  }
  if (UNSAFE_SHELL_PATTERN.test(branchName)) {
    errors.push('branch name contains whitespace or shell metacharacters');
  }
  if (!SAFE_BRANCH_PATTERN.test(branchName)) {
    errors.push('branch name must use only letters, numbers, dot, underscore, slash, and dash');
  }
  if (branchName.startsWith('-')) {
    errors.push('branch name must not start with a dash');
  }
  if (branchName.startsWith('/') || branchName.endsWith('/')) {
    errors.push('branch name must not start or end with slash');
  }
  if (branchName.includes('//')) {
    errors.push('branch name must not contain consecutive slashes');
  }
  if (branchName.includes('..')) {
    errors.push('branch name must not contain consecutive dots');
  }
  if (branchName.includes('@{')) {
    errors.push('branch name must not contain @{');
  }
  if (branchName.endsWith('.lock')) {
    errors.push('branch name must not end with .lock');
  }
  if (branchName.split('/').some(part => part === '.' || part === '..' || part.length === 0)) {
    errors.push('branch path components must not be empty, dot, or dot-dot');
  }

  try {
    execFileSync('git', ['check-ref-format', '--branch', branchName], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    errors.push('git check-ref-format rejected this branch name');
  }

  const hasKnownPrefix =
    ALLOWED_EXACT.has(branchName) || ALLOWED_PREFIXES.some(prefix => branchName.startsWith(prefix));
  if (!hasKnownPrefix) {
    warnings.push(
      `branch does not use a documented prefix (${ALLOWED_PREFIXES.join(', ')} or main/dev/develop)`
    );
  }

  return { ok: errors.length === 0, errors, warnings };
}

function usage(): void {
  console.error('Usage: bun .archon/scripts/validate-branch-name.ts [branch-name]');
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.length > 1) {
    usage();
    process.exit(2);
  }

  let branchName = args[0];
  if (branchName === undefined) {
    try {
      branchName = currentBranch();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`FAIL could not detect current branch: ${message}`);
      process.exit(1);
    }
  }

  const result = validateBranchName(branchName);
  if (result.ok) {
    console.log(`PASS branch name is valid: ${branchName}`);
  } else {
    console.error(`FAIL branch name is invalid: ${branchName}`);
    for (const error of result.errors) {
      console.error(`  - ${error}`);
    }
  }

  for (const warning of result.warnings) {
    console.warn(`WARN ${warning}`);
  }

  if (!result.ok) {
    console.error('Use a branch like archon/task/<slug>, codex/<slug>, stabilization/<slug>, or fix/<slug>.');
    process.exit(1);
  }
}
