import type { ParseResult } from '@archon/aco-core';
import {
  ACO_COMMAND_DESCRIPTORS,
  COMMAND_LEDGER_EVIDENCE,
  S7_CONSENSUS_EVIDENCE,
} from './constants';
import { acoCommandCatalogSchema, acoCommandDescriptorSchema } from './schemas';
import type { AcoCommandCatalog, AcoCommandDescriptor } from './schemas';
import { checkCommandCatalog, checkCommandDescriptor } from './checks';

export function commandDescriptors(): readonly AcoCommandDescriptor[] {
  return [...ACO_COMMAND_DESCRIPTORS].sort((left, right) => left.id.localeCompare(right.id));
}

export function buildCommandCatalog(
  descriptors: readonly AcoCommandDescriptor[] = commandDescriptors()
): ParseResult<AcoCommandCatalog> {
  const catalog = {
    kind: 'aco-cli-command-catalog',
    schemaVersion: 'aco.cli-command-catalog.v1',
    descriptors: [...descriptors].sort((left, right) => left.display.localeCompare(right.display)),
    evidence: [COMMAND_LEDGER_EVIDENCE, S7_CONSENSUS_EVIDENCE],
  } as const;

  const parsed = acoCommandCatalogSchema.safeParse(catalog);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  }
  const issues = checkCommandCatalog(parsed.data);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: parsed.data };
}

export function parseCommandDescriptor(input: unknown): ParseResult<AcoCommandDescriptor> {
  const parsed = acoCommandDescriptorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  }
  const issues = checkCommandDescriptor(parsed.data);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: parsed.data };
}

export function parseCommandCatalog(input: unknown): ParseResult<AcoCommandCatalog> {
  const parsed = acoCommandCatalogSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  }
  const issues = checkCommandCatalog(parsed.data);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: parsed.data };
}
