import type { MutationClass } from '@archon/aco-core';
import { ACO_COMMAND_DESCRIPTORS, REQUIRED_ACO_COMMAND_SURFACES } from './constants';
import { acoCommandCatalogSchema, acoCommandDescriptorSchema } from './schemas';
import type { AcoCommandDescriptor, AcoCommandId, AcoCommandImplementationStatus } from './schemas';

const HIGH_RISK_MUTATIONS: readonly MutationClass[] = [
  'writes-tracked-files',
  'writes-user-files',
  'writes-config',
  'writes-credentials',
  'writes-remotes',
  'writes-graph-cache',
  'destructive',
  'network',
  'unknown',
];

export function checkCommandDescriptor(input: unknown): readonly string[] {
  const parsed = acoCommandDescriptorSchema.safeParse(input);
  if (!parsed.success) {
    return parsed.error.issues.map(issue => `invalid command descriptor: ${issue.message}`);
  }

  const descriptor = parsed.data;
  const errors: string[] = [];
  if (!requiredSurfaces().includes(descriptor.display)) {
    errors.push(`${descriptor.id} display is not a command-ledger surface`);
  }
  if (!descriptor.safetyClasses.includes(descriptor.mutates)) {
    errors.push(`${descriptor.id} mutates must be listed in safetyClasses`);
  }
  if (descriptor.implementationStatus === 'approval-required' && !descriptor.approvalRequired) {
    errors.push(`${descriptor.id} approval-required status must require approval`);
  }
  if (descriptor.safetyClasses.includes('unknown')) {
    errors.push(`${descriptor.id} must not use unknown safety metadata`);
  }
  if (hasHighRiskMutation(descriptor.safetyClasses) && descriptor.surface === 'script') {
    if (!descriptor.approvalRequired) {
      errors.push(`${descriptor.id} high-risk script must require approval`);
    }
  }
  for (const option of descriptor.options) {
    if (
      option.safetyClassWhenEnabled !== null &&
      option.safetyClassWhenEnabled !== 'read-only' &&
      option.description.length === 0
    ) {
      errors.push(`${descriptor.id} high-risk option ${option.name} needs a description`);
    }
  }
  return errors;
}

export function checkCommandCatalog(input: unknown): readonly string[] {
  const parsed = acoCommandCatalogSchema.safeParse(input);
  if (!parsed.success) {
    return parsed.error.issues.map(issue => `invalid command catalog: ${issue.message}`);
  }
  return checkDescriptorCoverage(parsed.data.descriptors);
}

export function checkDescriptorCoverage(
  descriptors: readonly AcoCommandDescriptor[] = ACO_COMMAND_DESCRIPTORS
): readonly string[] {
  const errors: string[] = descriptors.flatMap(descriptor => checkCommandDescriptor(descriptor));
  const ids = descriptors.map(descriptor => descriptor.id);
  const displays = descriptors.map(descriptor => descriptor.display);

  errors.push(...duplicates(ids).map(id => `duplicate command descriptor id ${id}`));
  errors.push(
    ...duplicates(displays).map(display => `duplicate command descriptor display ${display}`)
  );

  for (const required of REQUIRED_ACO_COMMAND_SURFACES) {
    if (!displays.includes(required)) {
      errors.push(`missing command-ledger surface ${required}`);
    }
  }
  for (const display of displays) {
    if (!requiredSurfaces().includes(display)) {
      errors.push(`unexpected command surface ${display}`);
    }
  }
  return errors;
}

export function commandDescriptorById(
  id: string,
  descriptors: readonly AcoCommandDescriptor[] = ACO_COMMAND_DESCRIPTORS
): AcoCommandDescriptor | undefined {
  return descriptors.find(descriptor => descriptor.id === id);
}

export function commandDescriptorByDisplay(
  display: string,
  descriptors: readonly AcoCommandDescriptor[] = ACO_COMMAND_DESCRIPTORS
): AcoCommandDescriptor | undefined {
  return descriptors.find(descriptor => descriptor.display === display);
}

export function implementationStatusCounts(
  descriptors: readonly AcoCommandDescriptor[] = ACO_COMMAND_DESCRIPTORS
): Record<AcoCommandImplementationStatus, number> {
  return descriptors.reduce<Record<AcoCommandImplementationStatus, number>>(
    (counts, descriptor) => ({
      ...counts,
      [descriptor.implementationStatus]: counts[descriptor.implementationStatus] + 1,
    }),
    { supported: 0, deferred: 0, 'approval-required': 0 }
  );
}

export function supportedCommandIds(
  descriptors: readonly AcoCommandDescriptor[] = ACO_COMMAND_DESCRIPTORS
): readonly AcoCommandId[] {
  return descriptors
    .filter(descriptor => descriptor.implementationStatus === 'supported')
    .map(descriptor => descriptor.id);
}

export function requestedMutationsForDescriptor(
  descriptor: AcoCommandDescriptor,
  requested: readonly MutationClass[] = []
): readonly MutationClass[] {
  if (requested.length > 0) return uniqueMutations(requested);
  return uniqueMutations([descriptor.mutates]);
}

export function hasHighRiskMutation(values: readonly MutationClass[]): boolean {
  return values.some(value => value !== 'read-only' && HIGH_RISK_MUTATIONS.includes(value));
}

export function coversMutationApproval(
  requested: readonly MutationClass[],
  approved: readonly MutationClass[]
): boolean {
  return requested.every(mutation => mutation === 'read-only' || approved.includes(mutation));
}

function duplicates(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const duplicateValues = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicateValues.add(value);
    } else {
      seen.add(value);
    }
  }
  return [...duplicateValues].sort();
}

function uniqueMutations(values: readonly MutationClass[]): readonly MutationClass[] {
  return [...new Set(values)].sort();
}

function requiredSurfaces(): readonly string[] {
  return REQUIRED_ACO_COMMAND_SURFACES;
}
