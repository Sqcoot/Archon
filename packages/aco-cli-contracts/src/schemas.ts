import { z } from 'zod';
import {
  evidenceRefSchema,
  mutationClassValues,
  surfaceCompatibilityValues,
} from '@archon/aco-core';
import type { MutationClass, SurfaceCompatibility } from '@archon/aco-core';

export const acoCommandIdValues = [
  'archon.aco.status',
  'archon.aco.bootstrap-codex',
  'archon.context.status',
  'archon.context.ledgers',
  'archon.context.route',
  'archon.context.compile',
  'archon.context.approval-capsule',
  'archon.context.approval-capsule-verify',
  'archon.context.graph-waivers',
  'archon.context.validate',
  'bun.research.graph',
  'bun.aco.role-contracts',
] as const;

export const acoCommandSurfaceValues = ['cli', 'script'] as const;
export const acoCommandOutputModeValues = ['text', 'markdown', 'json', 'yaml'] as const;
export const acoCommandImplementationStatusValues = [
  'supported',
  'deferred',
  'approval-required',
] as const;
export const acoCommandResultStatusValues = [
  'ok',
  'deferred',
  'approval_required',
  'unsupported',
  'denied',
  'failed',
] as const;

export type AcoCommandId = (typeof acoCommandIdValues)[number];
export type AcoCommandSurface = (typeof acoCommandSurfaceValues)[number];
export type AcoCommandOutputMode = (typeof acoCommandOutputModeValues)[number];
export type AcoCommandImplementationStatus = (typeof acoCommandImplementationStatusValues)[number];
export type AcoCommandResultStatus = (typeof acoCommandResultStatusValues)[number];

export type JsonValue =
  | null
  | string
  | number
  | boolean
  | readonly JsonValue[]
  | { [key: string]: JsonValue };

const nonEmptyStringSchema = z.string().min(1);
const mutationClassSchema = z.enum(
  mutationClassValues satisfies readonly [MutationClass, ...MutationClass[]]
);
const compatibilitySchema = z.enum(
  surfaceCompatibilityValues satisfies readonly [SurfaceCompatibility, ...SurfaceCompatibility[]]
);

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(
  () =>
    z.union([
      z.null(),
      z.string(),
      z.number(),
      z.boolean(),
      z.array(jsonValueSchema),
      z.record(z.string(), jsonValueSchema),
    ]) as z.ZodType<JsonValue>
);

export const commandArgumentSchema = z
  .object({
    name: nonEmptyStringSchema,
    required: z.boolean(),
    variadic: z.boolean(),
    description: nonEmptyStringSchema,
  })
  .strict();

export const commandOptionSchema = z
  .object({
    name: nonEmptyStringSchema,
    valueName: nonEmptyStringSchema.nullable(),
    required: z.boolean(),
    allowedValues: z.array(nonEmptyStringSchema),
    defaultValue: nonEmptyStringSchema.nullable(),
    description: nonEmptyStringSchema,
    safetyClassWhenEnabled: mutationClassSchema.nullable(),
  })
  .strict();

export const acoCommandDescriptorSchema = z
  .object({
    kind: z.literal('aco-cli-command-descriptor'),
    schemaVersion: z.literal('aco.cli-command-descriptor.v1'),
    id: z.enum(acoCommandIdValues),
    display: nonEmptyStringSchema,
    argvPrefix: z.array(nonEmptyStringSchema).min(1),
    surface: z.enum(acoCommandSurfaceValues),
    purpose: nonEmptyStringSchema,
    owner: nonEmptyStringSchema,
    compatibility: compatibilitySchema,
    implementationStatus: z.enum(acoCommandImplementationStatusValues),
    mutates: mutationClassSchema,
    safetyClasses: z.array(mutationClassSchema).min(1),
    approvalRequired: z.boolean(),
    outputModes: z.array(z.enum(acoCommandOutputModeValues)).min(1),
    arguments: z.array(commandArgumentSchema),
    options: z.array(commandOptionSchema),
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict();

export const acoCommandCatalogSchema = z
  .object({
    kind: z.literal('aco-cli-command-catalog'),
    schemaVersion: z.literal('aco.cli-command-catalog.v1'),
    descriptors: z.array(acoCommandDescriptorSchema).length(acoCommandIdValues.length),
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict();

export const acoApprovalSchema = z
  .object({
    status: z.literal('approved'),
    approvedBy: nonEmptyStringSchema,
    scope: z.array(mutationClassSchema).min(1),
    evidence: z.array(evidenceRefSchema).min(1),
  })
  .strict();

export const acoCommandResultEnvelopeSchema = z
  .object({
    kind: z.literal('aco-cli-command-result'),
    schemaVersion: z.literal('aco.cli-command-result.v1'),
    commandId: z.string().min(1),
    display: z.string().min(1),
    status: z.enum(acoCommandResultStatusValues),
    exitCode: z.number().int().nonnegative(),
    stdout: z.string(),
    stderr: z.string(),
    data: z.record(z.string(), jsonValueSchema),
    evidence: z.array(evidenceRefSchema),
  })
  .strict();

export type CommandArgument = z.infer<typeof commandArgumentSchema>;
export type CommandOption = z.infer<typeof commandOptionSchema>;
export type AcoCommandDescriptor = z.infer<typeof acoCommandDescriptorSchema>;
export type AcoCommandCatalog = z.infer<typeof acoCommandCatalogSchema>;
export type AcoApproval = z.infer<typeof acoApprovalSchema>;
export type AcoCommandResultEnvelope = z.infer<typeof acoCommandResultEnvelopeSchema>;
