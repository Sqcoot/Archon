import { readFile } from 'fs/promises';
import { isAbsolute, join, resolve } from 'path';

const SCHEMA_VERSION = 'aco.traceability.v1';
const DEFAULT_MANIFEST = 'docs/context-orchestrator/specs/traceability/aco-traceability.json';
const MATRIX_PATH = 'docs/context-orchestrator/specs/spec-traceability-matrix.md';
const PACKAGE_JSON_PATH = 'package.json';
const CI_WORKFLOW_PATH = '.github/workflows/test.yml';
const TRACEABILITY_SCRIPT = 'bun scripts/context-orchestrator/validate-traceability.ts';
const TRACEABILITY_COMMAND = 'bun run aco:traceability';
const REQUIRED_SCRIPT = 'aco:traceability';
const VALID_LABELS = new Set(['VERIFIED', 'INFERRED', 'HYPOTHESIS']);
const VALID_KINDS = new Set(['policy', 'policy-decision', 'traceability-gate', 'ledger']);
const VALID_STATUSES = new Set(['enforced']);
const ID_PATTERN = /(?:ACO|AC)-[A-Z0-9-]+/g;

type TraceabilityStatus = 'passed' | 'failed';
type CheckStatus = TraceabilityStatus;

interface TraceabilityCheck {
  id: string;
  status: CheckStatus;
  message: string;
}

interface TraceabilityError {
  requirement_id?: string;
  ref?: string;
  marker?: string;
  message: string;
}

interface TraceabilityReport {
  status: TraceabilityStatus;
  checks: TraceabilityCheck[];
  errors: TraceabilityError[];
}

interface TraceabilityManifest {
  schema_version: string;
  scope: {
    enforced_prefixes: string[];
  };
  requirements: TraceabilityRequirement[];
}

interface TraceabilityRequirement {
  requirement_id: string;
  kind: 'policy' | 'policy-decision' | 'traceability-gate' | 'ledger';
  spec: string;
  matrix: string;
  acceptance: TraceabilityRef;
  evidence: TraceabilityEvidence[];
  status: 'enforced';
  exemption?: {
    reason: string;
  };
}

interface TraceabilityRef {
  ref: string;
  markers: string[];
}

interface TraceabilityEvidence extends TraceabilityRef {
  label: 'VERIFIED' | 'INFERRED' | 'HYPOTHESIS';
  summary: string;
}

interface ValidateTraceabilityOptions {
  root: string;
  manifestPath: string;
}

interface CliOptions extends ValidateTraceabilityOptions {
  json: boolean;
}

export async function validateTraceability(
  options: ValidateTraceabilityOptions
): Promise<TraceabilityReport> {
  const checks: TraceabilityCheck[] = [];
  const errors: TraceabilityError[] = [];
  const addError = (error: TraceabilityError): void => {
    errors.push(error);
  };

  const manifestText = await readOptionalText(options.manifestPath);
  if (manifestText === null) {
    addError({
      ref: relativeRef(options.root, options.manifestPath),
      message: 'Traceability manifest is missing.',
    });
    checks.push(failedCheck('manifest', 'Traceability manifest is missing.'));
    return toReport(checks, errors);
  }

  const manifest = parseManifest(
    manifestText,
    relativeRef(options.root, options.manifestPath),
    errors
  );
  if (manifest === null) {
    checks.push(failedCheck('manifest', 'Traceability manifest is invalid.'));
    return toReport(checks, errors);
  }
  checks.push(passedCheck('manifest', 'Traceability manifest parsed.'));

  const shapeErrorCount = errors.length;
  validateRequirementShape(manifest, errors);
  if (errors.length > shapeErrorCount) {
    checks.push(failedCheck('manifest-shape', 'Traceability manifest shape is invalid.'));
    return toReport(checks, errors);
  }
  checks.push(passedCheck('manifest-shape', 'Traceability manifest shape is valid.'));

  const duplicateIds = findDuplicateIds(
    manifest.requirements.map(requirement => requirement.requirement_id)
  );
  for (const duplicateId of duplicateIds) {
    addError({
      requirement_id: duplicateId,
      message: `Duplicate traceability requirement ID: ${duplicateId}.`,
    });
  }

  const matrixPath = join(options.root, MATRIX_PATH);
  const matrixText = await readOptionalText(matrixPath);
  if (matrixText === null) {
    addError({ ref: MATRIX_PATH, message: 'Spec traceability matrix is missing.' });
    checks.push(failedCheck('matrix', 'Spec traceability matrix is missing.'));
    return toReport(checks, errors);
  }
  checks.push(passedCheck('matrix', 'Spec traceability matrix found.'));

  const requirementIds = new Set(
    manifest.requirements.map(requirement => requirement.requirement_id)
  );
  const enforcedMatrixIds = extractIds(matrixText).filter(id =>
    manifest.scope.enforced_prefixes.some(prefix => id.startsWith(prefix))
  );
  for (const matrixId of enforcedMatrixIds) {
    if (!requirementIds.has(matrixId)) {
      addError({
        requirement_id: matrixId,
        ref: MATRIX_PATH,
        message: `Matrix ID ${matrixId} has no manifest entry.`,
      });
    }
  }

  for (const requirement of manifest.requirements) {
    await validateRequirement(options.root, requirement, matrixText, addError);
  }

  await validatePackageScript(options.root, addError);
  await validateCiWorkflow(options.root, addError);

  checks.push(
    errors.length === 0
      ? passedCheck('traceability-links', 'Traceability links are complete.')
      : failedCheck('traceability-links', 'Traceability links have drift.')
  );

  return toReport(checks, errors);
}

function parseArgs(args: string[]): CliOptions {
  let root = process.cwd();
  let manifest = DEFAULT_MANIFEST;
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      json = true;
    } else if (arg === '--root' && args[index + 1]) {
      root = args[index + 1];
      index += 1;
    } else if (arg === '--manifest' && args[index + 1]) {
      manifest = args[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  const resolvedRoot = resolve(root);
  return {
    root: resolvedRoot,
    manifestPath: resolveInputPath(resolvedRoot, manifest),
    json,
  };
}

function parseManifest(
  text: string,
  ref: string,
  errors: TraceabilityError[]
): TraceabilityManifest | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    errors.push({
      ref,
      message: `Traceability manifest is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    });
    return null;
  }

  if (!isRecord(parsed)) {
    errors.push({ ref, message: 'Traceability manifest must be an object.' });
    return null;
  }
  if (parsed.schema_version !== SCHEMA_VERSION) {
    errors.push({
      ref,
      message: `Traceability manifest schema_version must be ${SCHEMA_VERSION}.`,
    });
    return null;
  }
  if (!isRecord(parsed.scope) || !isStringArray(parsed.scope.enforced_prefixes)) {
    errors.push({ ref, message: 'Traceability manifest scope.enforced_prefixes must be strings.' });
    return null;
  }
  if (!Array.isArray(parsed.requirements)) {
    errors.push({ ref, message: 'Traceability manifest requirements must be an array.' });
    return null;
  }

  return parsed as unknown as TraceabilityManifest;
}

function validateRequirementShape(
  manifest: TraceabilityManifest,
  errors: TraceabilityError[]
): void {
  for (const requirement of manifest.requirements) {
    if (!isRecord(requirement)) {
      errors.push({ message: 'Traceability requirement must be an object.' });
      continue;
    }
    const id = getString(requirement.requirement_id);
    if (id === null) {
      errors.push({ message: 'Traceability requirement is missing requirement_id.' });
      continue;
    }
    if (!VALID_KINDS.has(requirement.kind)) {
      errors.push({
        requirement_id: id,
        message: `Traceability requirement ${id} has invalid kind.`,
      });
    }
    if (!VALID_STATUSES.has(requirement.status)) {
      errors.push({
        requirement_id: id,
        message: `Traceability requirement ${id} has invalid status.`,
      });
    }
    for (const field of ['spec', 'matrix'] as const) {
      if (getString(requirement[field]) === null) {
        errors.push({
          requirement_id: id,
          message: `Traceability requirement ${id} is missing ${field}.`,
        });
      }
    }
    validateTraceabilityRef(id, requirement.acceptance, 'acceptance', errors);
    if (!Array.isArray(requirement.evidence) || requirement.evidence.length === 0) {
      errors.push({
        requirement_id: id,
        message: `Traceability requirement ${id} must include evidence.`,
      });
    } else {
      for (const evidence of requirement.evidence) {
        validateEvidence(id, evidence, errors);
      }
    }
  }
}

function validateTraceabilityRef(
  requirementId: string,
  value: unknown,
  label: string,
  errors: TraceabilityError[]
): void {
  if (!isRecord(value)) {
    errors.push({
      requirement_id: requirementId,
      message: `Traceability requirement ${requirementId} ${label} must be an object.`,
    });
    return;
  }
  if (
    getString(value.ref) === null ||
    !isStringArray(value.markers) ||
    value.markers.length === 0
  ) {
    errors.push({
      requirement_id: requirementId,
      message: `Traceability requirement ${requirementId} ${label} must include ref and markers.`,
    });
  }
}

function validateEvidence(
  requirementId: string,
  value: unknown,
  errors: TraceabilityError[]
): void {
  validateTraceabilityRef(requirementId, value, 'evidence', errors);
  if (!isRecord(value)) return;
  if (!VALID_LABELS.has(String(value.label))) {
    errors.push({
      requirement_id: requirementId,
      message: `Traceability requirement ${requirementId} has invalid evidence label.`,
    });
  }
  if (getString(value.summary) === null) {
    errors.push({
      requirement_id: requirementId,
      message: `Traceability requirement ${requirementId} evidence is missing summary.`,
    });
  }
}

async function validateRequirement(
  root: string,
  requirement: TraceabilityRequirement,
  matrixText: string,
  addError: (error: TraceabilityError) => void
): Promise<void> {
  await validateFileContains(
    root,
    requirement.requirement_id,
    requirement.spec,
    [requirement.requirement_id],
    'spec',
    addError
  );
  await validateFileContains(
    root,
    requirement.requirement_id,
    requirement.matrix,
    [requirement.requirement_id],
    'matrix',
    addError,
    matrixText
  );
  await validateFileContains(
    root,
    requirement.requirement_id,
    requirement.acceptance.ref,
    requirement.acceptance.markers,
    'acceptance',
    addError
  );
  for (const evidence of requirement.evidence) {
    await validateFileContains(
      root,
      requirement.requirement_id,
      evidence.ref,
      evidence.markers,
      'evidence',
      addError
    );
  }
}

async function validateFileContains(
  root: string,
  requirementId: string,
  ref: string,
  markers: string[],
  relation: string,
  addError: (error: TraceabilityError) => void,
  providedText?: string
): Promise<void> {
  const text = providedText ?? (await readOptionalText(resolveInputPath(root, ref)));
  if (text === null) {
    addError({
      requirement_id: requirementId,
      ref,
      message: `${relation} reference is missing: ${ref}.`,
    });
    return;
  }

  for (const marker of markers) {
    if (!text.includes(marker)) {
      addError({
        requirement_id: requirementId,
        ref,
        marker,
        message: `${relation} reference ${ref} is missing marker ${marker}.`,
      });
    }
  }
}

async function validatePackageScript(
  root: string,
  addError: (error: TraceabilityError) => void
): Promise<void> {
  const packageText = await readOptionalText(join(root, PACKAGE_JSON_PATH));
  if (packageText === null) {
    addError({ ref: PACKAGE_JSON_PATH, message: 'package.json is missing.' });
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(packageText);
  } catch (error) {
    addError({
      ref: PACKAGE_JSON_PATH,
      message: `package.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    });
    return;
  }

  const scripts = isRecord(parsed) && isRecord(parsed.scripts) ? parsed.scripts : {};
  if (scripts[REQUIRED_SCRIPT] !== TRACEABILITY_SCRIPT) {
    addError({
      ref: PACKAGE_JSON_PATH,
      message: `package.json must define ${REQUIRED_SCRIPT} as "${TRACEABILITY_SCRIPT}".`,
    });
  }
}

async function validateCiWorkflow(
  root: string,
  addError: (error: TraceabilityError) => void
): Promise<void> {
  const workflowText = await readOptionalText(join(root, CI_WORKFLOW_PATH));
  if (workflowText === null) {
    addError({ ref: CI_WORKFLOW_PATH, message: 'CI workflow is missing.' });
    return;
  }

  if (!workflowText.includes(TRACEABILITY_COMMAND)) {
    addError({
      ref: CI_WORKFLOW_PATH,
      message: `CI workflow must run ${TRACEABILITY_COMMAND}.`,
    });
  }
}

function extractIds(text: string): string[] {
  return [...new Set(text.match(ID_PATTERN) ?? [])].sort((left, right) =>
    left.localeCompare(right)
  );
}

function findDuplicateIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      duplicates.add(id);
    }
    seen.add(id);
  }
  return [...duplicates].sort((left, right) => left.localeCompare(right));
}

async function readOptionalText(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

function toReport(checks: TraceabilityCheck[], errors: TraceabilityError[]): TraceabilityReport {
  return {
    status: errors.length === 0 ? 'passed' : 'failed',
    checks,
    errors,
  };
}

function passedCheck(id: string, message: string): TraceabilityCheck {
  return { id, status: 'passed', message };
}

function failedCheck(id: string, message: string): TraceabilityCheck {
  return { id, status: 'failed', message };
}

function resolveInputPath(root: string, path: string): string {
  return isAbsolute(path) ? path : join(root, path);
}

function relativeRef(root: string, path: string): string {
  const resolvedRoot = resolve(root);
  const resolvedPath = resolve(path);
  return resolvedPath.startsWith(resolvedRoot) ? resolvedPath.slice(resolvedRoot.length + 1) : path;
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string' && item.length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function main(): Promise<void> {
  let options: CliOptions;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }

  const report = await validateTraceability(options);
  if (options.json) {
    console.log(`${JSON.stringify(report, null, 2)}\n`);
  } else if (report.status === 'passed') {
    console.log('ACO traceability validation passed.');
  } else {
    console.error('ACO traceability validation failed:');
    for (const error of report.errors) {
      const id = error.requirement_id ? `${error.requirement_id}: ` : '';
      const ref = error.ref ? ` (${error.ref})` : '';
      console.error(`- ${id}${error.message}${ref}`);
    }
  }
  process.exitCode = report.status === 'passed' ? 0 : 1;
}

if (import.meta.main) {
  await main();
}
