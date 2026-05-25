import type { MutationClass } from '@archon/aco-core';
import { commandDescriptorById } from './checks';
import { deferredCommandResult, enforceCommandSafety, unsupportedCommandResult } from './gates';
import type {
  AcoApproval,
  AcoCommandDescriptor,
  AcoCommandOutputMode,
  AcoCommandResultEnvelope,
  JsonValue,
} from './schemas';

export interface CommandInvocation<
  TArgs extends Readonly<Record<string, JsonValue>> = Readonly<Record<string, JsonValue>>,
> {
  readonly commandId: string;
  readonly argv: readonly string[];
  readonly args: TArgs;
  readonly options: Readonly<Record<string, string | boolean>>;
  readonly cwd: string | null;
  readonly outputMode: AcoCommandOutputMode;
  readonly requestedMutations: readonly MutationClass[];
  readonly readonlyContext: boolean;
  readonly approval?: AcoApproval | null;
}

export type CommandHandler<
  TArgs extends Readonly<Record<string, JsonValue>> = Readonly<Record<string, JsonValue>>,
  TResult extends AcoCommandResultEnvelope = AcoCommandResultEnvelope,
> = (
  invocation: CommandInvocation<TArgs>,
  descriptor: AcoCommandDescriptor
) => TResult | Promise<TResult>;

export interface CommandHandlerRegistration {
  readonly commandId: string;
  readonly handler: CommandHandler;
}

export class AcoCommandRouter {
  private readonly descriptors: readonly AcoCommandDescriptor[];
  private readonly handlers: ReadonlyMap<string, CommandHandler>;

  constructor(input: {
    readonly descriptors: readonly AcoCommandDescriptor[];
    readonly handlers?: readonly CommandHandlerRegistration[];
  }) {
    this.descriptors = input.descriptors;
    this.handlers = new Map(
      (input.handlers ?? []).map(registration => [registration.commandId, registration.handler])
    );
  }

  async dispatch(invocation: CommandInvocation): Promise<AcoCommandResultEnvelope> {
    const descriptor = commandDescriptorById(invocation.commandId, this.descriptors);
    if (descriptor === undefined) {
      return unsupportedCommandResult(invocation.commandId);
    }

    const safetyResult = enforceCommandSafety(descriptor, invocation);
    if (safetyResult !== null) return safetyResult;

    if (descriptor.implementationStatus !== 'supported') {
      return deferredCommandResult(descriptor);
    }

    const handler = this.handlers.get(descriptor.id);
    if (handler === undefined) {
      return deferredCommandResult(descriptor, 'no S7 handler is registered');
    }

    return handler(invocation, descriptor);
  }
}
