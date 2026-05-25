import {
  AcoCommandRouter,
  acoCliContractsFixtureGate,
  buildCommandCatalog,
  commandDescriptorById,
  deniedCommandResult,
  okCommandResult,
  renderCliResultJson,
  renderCommandHelpMarkdown,
  renderCommandPlanMarkdown,
  unsupportedCommandResult,
} from '@archon/aco-cli-contracts';
import type {
  AcoCommandCatalog,
  AcoCommandDescriptor,
  AcoCommandId,
  AcoCommandOutputMode,
  AcoCommandResultEnvelope,
  CommandHandlerRegistration,
  CommandInvocation,
  JsonValue,
} from '@archon/aco-cli-contracts';
import {
  buildCodexBootstrapArtifacts,
  codexBootstrapEventTypeValues,
  defaultCodexBootstrapInput,
} from '@archon/aco-codex';
import type { CodexBootstrapEventType } from '@archon/aco-codex';
import { buildGraphWaiverClosure, renderGraphWaiverClosureJson } from '@archon/aco-research';

export interface AcoCliOptions {
  readonly json?: boolean;
  readonly event?: string;
  readonly format?: string;
  readonly writeArtifact?: boolean;
}

type AcoResolution =
  | { readonly ok: true; readonly invocation: CommandInvocation }
  | { readonly ok: false; readonly result: AcoCommandResultEnvelope };

export async function acoCommand(
  cwd: string,
  positionals: readonly string[],
  options: AcoCliOptions = {}
): Promise<number> {
  const catalog = buildCommandCatalog();
  if (!catalog.ok) {
    return writeResult(
      unsupportedCommandResult(`invalid S7 command catalog: ${catalog.issues.join('; ')}`),
      'json'
    );
  }

  const resolution = resolveAcoCommandInvocation(cwd, positionals, options);
  if (!resolution.ok) {
    return writeResult(resolution.result, options.json ? 'json' : 'markdown');
  }

  const router = new AcoCommandRouter({
    descriptors: catalog.value.descriptors,
    handlers: createAcoCliHandlers(cwd),
  });
  const result = await router.dispatch(resolution.invocation);
  return writeResult(result, resolution.invocation.outputMode);
}

export function resolveAcoCommandInvocation(
  cwd: string,
  positionals: readonly string[],
  options: AcoCliOptions = {}
): AcoResolution {
  const command = positionals[0];
  const subcommand = positionals[1];
  const jsonMode = options.json === true;
  const outputMode = resolveOutputMode(options.format, jsonMode);
  if (!outputMode.ok) return { ok: false, result: outputMode.result };

  if (command === 'aco') {
    if (subcommand === 'status') {
      return invocation('archon.aco.status', cwd, positionals, {}, outputMode.value);
    }
    if (subcommand === 'bootstrap-codex') {
      const event = options.event;
      const format = options.format ?? 'markdown';
      if (event === undefined || event.trim().length === 0) {
        const descriptor = descriptorOrThrow('archon.aco.bootstrap-codex');
        return {
          ok: false,
          result: deniedCommandResult(
            descriptor.id,
            descriptor.display,
            'missing required --event <event>'
          ),
        };
      }
      if (format !== 'markdown' && format !== 'json') {
        const descriptor = descriptorOrThrow('archon.aco.bootstrap-codex');
        return {
          ok: false,
          result: deniedCommandResult(
            descriptor.id,
            descriptor.display,
            'invalid --format; expected markdown or json'
          ),
        };
      }
      return invocation(
        'archon.aco.bootstrap-codex',
        cwd,
        positionals,
        { event, format, writeArtifact: options.writeArtifact === true },
        format,
        options.writeArtifact === true ? ['writes-artifacts'] : []
      );
    }
  }

  if (command === 'context') {
    switch (subcommand) {
      case 'status':
        return invocation(
          'archon.context.status',
          cwd,
          positionals,
          promptArgs(positionals, 2),
          outputMode.value
        );
      case 'ledgers':
        return invocation(
          'archon.context.ledgers',
          cwd,
          positionals,
          promptArgs(positionals, 2),
          outputMode.value
        );
      case 'route': {
        const args = promptArgs(positionals, 2);
        if (args.prompt.length === 0) {
          const descriptor = descriptorOrThrow('archon.context.route');
          return {
            ok: false,
            result: deniedCommandResult(
              descriptor.id,
              descriptor.display,
              'missing required <prompt>'
            ),
          };
        }
        return invocation('archon.context.route', cwd, positionals, args, outputMode.value);
      }
      case 'compile':
        return invocation(
          'archon.context.compile',
          cwd,
          positionals,
          promptArgs(positionals, 2),
          outputMode.value,
          ['writes-artifacts']
        );
      case 'approval-capsule':
        return invocation(
          'archon.context.approval-capsule',
          cwd,
          positionals,
          promptArgs(positionals, 2),
          outputMode.value,
          ['writes-artifacts']
        );
      case 'approval-capsule-verify':
        return invocation(
          'archon.context.approval-capsule-verify',
          cwd,
          positionals,
          {},
          outputMode.value
        );
      case 'graph-waivers':
        return invocation('archon.context.graph-waivers', cwd, positionals, {}, outputMode.value);
      case 'validate':
        return invocation('archon.context.validate', cwd, positionals, {}, outputMode.value);
      default:
        return { ok: false, result: unsupportedCommandResult(positionals.join(' ')) };
    }
  }

  return { ok: false, result: unsupportedCommandResult(positionals.join(' ')) };
}

function createAcoCliHandlers(cwd: string): readonly CommandHandlerRegistration[] {
  return [
    {
      commandId: 'archon.aco.status',
      handler: (_invocation, descriptor) =>
        okCommandResult({
          descriptor,
          stdout: renderAcoStatusMarkdown(cwd),
          data: statusData(cwd),
        }),
    },
    {
      commandId: 'archon.aco.bootstrap-codex',
      handler: invocationItem => renderBootstrapCodex(invocationItem),
    },
    {
      commandId: 'archon.context.ledgers',
      handler: (_invocation, descriptor): AcoCommandResultEnvelope => {
        const catalog = buildCatalogOrThrow();
        return okCommandResult({
          descriptor,
          stdout: renderCommandHelpMarkdown(catalog),
          data: { commandCount: catalog.descriptors.length },
        });
      },
    },
    {
      commandId: 'archon.context.route',
      handler: (invocationItem, descriptor): AcoCommandResultEnvelope => {
        const prompt = stringArg(invocationItem.args.prompt, '');
        return okCommandResult({
          descriptor,
          stdout: `${renderCommandPlanMarkdown(descriptor)}prompt: ${prompt}\n`,
          data: { prompt },
        });
      },
    },
    {
      commandId: 'archon.context.graph-waivers',
      handler: (_invocation, descriptor) => renderGraphWaivers(descriptor),
    },
    {
      commandId: 'archon.context.validate',
      handler: async (_invocation, descriptor): Promise<AcoCommandResultEnvelope> => {
        const result = await acoCliContractsFixtureGate.run(undefined);
        if (result.status !== 'passed') {
          return deniedCommandResult(
            descriptor.id,
            descriptor.display,
            result.status === 'failed' ? result.errors.join('; ') : result.reason
          );
        }
        return okCommandResult({
          descriptor,
          stdout: `ACO CLI contracts valid: ${result.value.descriptorCount} command descriptors\n`,
          data: {
            descriptorCount: result.value.descriptorCount,
            commandIds: result.value.commandIds,
            statusCounts: result.value.statusCounts,
          },
        });
      },
    },
  ];
}

function renderBootstrapCodex(invocationItem: CommandInvocation): AcoCommandResultEnvelope {
  const descriptor = descriptorOrThrow('archon.aco.bootstrap-codex');
  const event = stringArg(invocationItem.args.event, 'Unknown');
  const format = invocationItem.args.format === 'json' ? 'json' : 'markdown';
  const input = defaultCodexBootstrapInput();
  const normalizedEvent = normalizeCodexEvent(event);
  const bundle = buildCodexBootstrapArtifacts({
    ...input,
    id: 'aco.cli.bootstrap-codex.s7',
    goal: 'S7 CLI parity bootstrap-codex invocation',
    repository: {
      ...input.repository,
      repoPath: invocationItem.cwd ?? input.repository.repoPath,
    },
    event: {
      ...input.event,
      type: normalizedEvent,
      label: event,
      payloadContract: 'S7 CLI adapter preserves event label; runtime payload is deferred',
    },
  });
  if (!bundle.ok) {
    return deniedCommandResult(descriptor.id, descriptor.display, bundle.issues.join('; '));
  }

  const artifactName =
    format === 'json' ? 'codex-bootstrap-context.json' : 'codex-bootstrap-capsule.md';
  const artifact = bundle.value.artifacts.find(item => item.name === artifactName);
  if (artifact === undefined) {
    return deniedCommandResult(descriptor.id, descriptor.display, `missing ${artifactName}`);
  }

  return okCommandResult({
    descriptor,
    stdout: artifact.content,
    data: {
      event: normalizedEvent,
      format,
      artifact: artifact.name,
      artifactCount: bundle.value.artifacts.length,
    },
  });
}

function renderGraphWaivers(descriptor: AcoCommandDescriptor): AcoCommandResultEnvelope {
  const closure = buildGraphWaiverClosure();
  if (!closure.ok) {
    return deniedCommandResult(descriptor.id, descriptor.display, closure.issues.join('; '));
  }

  return okCommandResult({
    descriptor,
    stdout: renderGraphWaiverClosureJson(closure.value),
    data: {
      status: closure.value.status,
      graphRefs: closure.value.graphRefs.length,
      artifactMetadata: closure.value.artifacts.length,
    },
  });
}

function renderAcoStatusMarkdown(cwd: string): string {
  const catalog = buildCatalogOrThrow();
  const supported = catalog.descriptors.filter(
    descriptor => descriptor.implementationStatus === 'supported'
  ).length;
  const deferred = catalog.descriptors.filter(
    descriptor => descriptor.implementationStatus === 'deferred'
  ).length;
  const approvalRequired = catalog.descriptors.filter(
    descriptor => descriptor.implementationStatus === 'approval-required'
  ).length;

  return [
    '# ACO CLI Status',
    '',
    `cwd: ${cwd}`,
    `schemaVersion: ${catalog.schemaVersion}`,
    `commands: ${catalog.descriptors.length}`,
    `supported: ${supported}`,
    `deferred: ${deferred}`,
    `approvalRequired: ${approvalRequired}`,
    '',
    'S7 exposes command parity through @archon/aco-cli-contracts and thin CLI adapters.',
    '',
  ].join('\n');
}

function statusData(cwd: string): Readonly<Record<string, JsonValue>> {
  const catalog = buildCatalogOrThrow();
  return {
    cwd,
    schemaVersion: catalog.schemaVersion,
    commands: catalog.descriptors.length,
    supported: catalog.descriptors.filter(
      descriptor => descriptor.implementationStatus === 'supported'
    ).length,
    deferred: catalog.descriptors.filter(
      descriptor => descriptor.implementationStatus === 'deferred'
    ).length,
    approvalRequired: catalog.descriptors.filter(
      descriptor => descriptor.implementationStatus === 'approval-required'
    ).length,
  };
}

function resolveOutputMode(
  format: string | undefined,
  jsonMode: boolean
):
  | { readonly ok: true; readonly value: AcoCommandOutputMode }
  | { readonly ok: false; readonly result: AcoCommandResultEnvelope } {
  if (jsonMode) return { ok: true, value: 'json' };
  if (format === undefined) return { ok: true, value: 'markdown' };
  if (format === 'markdown' || format === 'json') return { ok: true, value: format };
  return {
    ok: false,
    result: deniedCommandResult(
      'aco.cli.format',
      'aco command format',
      'invalid --format; expected markdown or json'
    ),
  };
}

function invocation(
  commandId: AcoCommandId,
  cwd: string,
  argv: readonly string[],
  args: Readonly<Record<string, JsonValue>>,
  outputMode: AcoCommandOutputMode,
  requestedMutations: readonly CommandInvocation['requestedMutations'][number][] = []
): AcoResolution {
  return {
    ok: true,
    invocation: {
      commandId,
      argv,
      args,
      options: {},
      cwd,
      outputMode,
      requestedMutations,
      readonlyContext: true,
      approval: null,
    },
  };
}

function promptArgs(
  positionals: readonly string[],
  start: number
): Readonly<Record<string, string>> {
  return { prompt: positionals.slice(start).join(' ') };
}

function stringArg(value: JsonValue | undefined, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function descriptorOrThrow(id: AcoCommandId): AcoCommandDescriptor {
  const descriptor = commandDescriptorById(id);
  if (descriptor === undefined) throw new Error(`missing descriptor ${id}`);
  return descriptor;
}

function buildCatalogOrThrow(): AcoCommandCatalog {
  const catalog = buildCommandCatalog();
  if (!catalog.ok) throw new Error(catalog.issues.join('\n'));
  return catalog.value;
}

function normalizeCodexEvent(event: string): CodexBootstrapEventType {
  const match = codexBootstrapEventTypeValues.find(value => value === event);
  return match ?? 'Unknown';
}

function writeResult(result: AcoCommandResultEnvelope, outputMode: AcoCommandOutputMode): number {
  if (outputMode === 'json') {
    console.log(renderCliResultJson(result).trimEnd());
  } else {
    if (result.stdout.length > 0) console.log(result.stdout.trimEnd());
    if (result.stderr.length > 0) console.error(result.stderr);
  }
  return result.exitCode;
}
