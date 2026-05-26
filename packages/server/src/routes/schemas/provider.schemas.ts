/**
 * Zod schemas for provider API endpoints.
 */
import { z } from '@hono/zod-openapi';

/** Provider hook/runtime capability details. */
const providerHookCapabilitiesSchema = z
  .object({
    workflowNodeHooks: z.enum(['enforced', 'unsupported']),
    runtimeConfigHooks: z.enum(['possible', 'disabled', 'unknown']),
    hookInventoryObservable: z.boolean(),
    hookTrustObservable: z.boolean(),
    hookEventStreaming: z.boolean(),
  })
  .openapi('ProviderHookCapabilities');

/** Provider capability flags and mode details. */
const providerCapabilitiesSchema = z
  .object({
    sessionResume: z.boolean(),
    mcp: z.boolean(),
    hookCapabilities: providerHookCapabilitiesSchema,
    hooks: z.boolean(),
    skills: z.boolean(),
    agents: z.boolean(),
    toolRestrictions: z.boolean(),
    structuredOutput: z.boolean(),
    structuredOutputMode: z.enum(['enforced', 'best_effort', 'unsupported']),
    systemPrompt: z.boolean(),
    systemPromptMode: z.enum(['full', 'string_only', 'unsupported']),
    envInjection: z.boolean(),
    costControl: z.boolean(),
    effortControl: z.boolean(),
    thinkingControl: z.boolean(),
    fallbackModel: z.boolean(),
    sandbox: z.boolean(),
    betaFlags: z.boolean(),
  })
  .openapi('ProviderCapabilities');

/** A single provider info entry (API-safe projection of ProviderRegistration). */
export const providerInfoSchema = z
  .object({
    id: z.string(),
    displayName: z.string(),
    capabilities: providerCapabilitiesSchema,
    builtIn: z.boolean(),
  })
  .openapi('ProviderInfo');

/** Response for GET /api/providers. */
export const providerListResponseSchema = z
  .object({
    providers: z.array(providerInfoSchema),
  })
  .openapi('ProviderListResponse');
