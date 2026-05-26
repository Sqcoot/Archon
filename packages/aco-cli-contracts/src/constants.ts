import type { EvidenceRef } from '@archon/aco-core';
import { acoCommandDescriptorSchema } from './schemas';
import type { AcoCommandDescriptor } from './schemas';

export const REQUIRED_ACO_COMMAND_SURFACES = [
  'archon aco status --cwd <repo> [--json]',
  'archon aco bootstrap-codex --event <event> --format markdown|json [--no-write-artifact]',
  'archon context status [prompt] [--no-write-artifact]',
  'archon context ledgers [prompt] [--no-write-artifact]',
  'archon context route <prompt> [--no-write-artifact]',
  'archon context compile <prompt> [--no-write-artifact]',
  'archon context approval-capsule <prompt> [--no-write-artifact]',
  'archon context approval-capsule-verify [--no-write-artifact]',
  'archon context graph-waivers [--no-write-artifact]',
  'archon context validate',
  'bun run research:graph',
  'bun run aco:role-contracts',
] as const;

export const COMMAND_LEDGER_EVIDENCE = {
  id: 'evidence.cli.command-ledger',
  source: 'ledgers/command-ledger.csv',
  summary: 'Readonly command ledger defines the preserved ACO/context command surface',
  confidence: 'high',
  freshness: 'unknown',
} as const satisfies EvidenceRef;

export const S7_CONSENSUS_EVIDENCE = {
  id: 'evidence.cli.s7-consensus',
  source: 'party-mode-output-s7-consensus/next_goal_4000chars.txt',
  summary: 'S7 consensus selected contract-first CLI parity with thin adapters',
  confidence: 'high',
  freshness: 'fresh',
} as const satisfies EvidenceRef;

export const S8_CONSENSUS_EVIDENCE = {
  id: 'evidence.cli.s8-consensus',
  source: 'party-mode-output-s8-consensus/next_goal_4000chars.txt',
  summary: 'S8 consensus implemented aco-context contracts behind the context CLI adapters',
  confidence: 'high',
  freshness: 'fresh',
} as const satisfies EvidenceRef;

export const COMMAND_ROUTER_TEMPLATE_EVIDENCE = {
  id: 'evidence.cli.command-router-template',
  source: 'templates/aco-command-router.ts',
  summary: 'Readonly router template preserves command names and safety boundaries',
  confidence: 'high',
  freshness: 'unknown',
} as const satisfies EvidenceRef;

export const ACO_COMMAND_DESCRIPTORS: readonly AcoCommandDescriptor[] = [
  descriptor({
    id: 'archon.aco.status',
    display: 'archon aco status --cwd <repo> [--json]',
    argvPrefix: ['aco', 'status'],
    surface: 'cli',
    purpose: 'Productized ACO status and graph confidence limits',
    owner: 'aco-cli',
    implementationStatus: 'supported',
    mutates: 'read-only',
    safetyClasses: ['read-only'],
    approvalRequired: false,
    outputModes: ['markdown', 'json'],
    arguments: [],
    options: [
      option('cwd', 'path', true, 'Repository path to inspect'),
      option('json', null, false, 'Render a JSON result envelope'),
    ],
    evidence: [COMMAND_LEDGER_EVIDENCE, S7_CONSENSUS_EVIDENCE],
  }),
  descriptor({
    id: 'archon.aco.bootstrap-codex',
    display:
      'archon aco bootstrap-codex --event <event> --format markdown|json [--no-write-artifact]',
    argvPrefix: ['aco', 'bootstrap-codex'],
    surface: 'cli',
    purpose: 'Emit Codex-ready bootstrap capsule',
    owner: 'aco-codex',
    implementationStatus: 'supported',
    mutates: 'writes-artifacts',
    safetyClasses: ['read-only', 'writes-artifacts'],
    approvalRequired: false,
    outputModes: ['markdown', 'json'],
    arguments: [],
    options: [
      option('event', 'event', true, 'Codex lifecycle event label'),
      option('format', 'markdown|json', true, 'Output format', ['markdown', 'json'], 'markdown'),
      option(
        'write-artifact',
        null,
        false,
        'Write scoped artifact dossier under $ARTIFACTS_DIR or .archon/artifacts (default)',
        [],
        null,
        'writes-artifacts'
      ),
      option(
        'no-write-artifact',
        null,
        false,
        'Suppress default scoped artifact dossier output',
        [],
        null,
        'read-only'
      ),
    ],
    evidence: [COMMAND_LEDGER_EVIDENCE, S7_CONSENSUS_EVIDENCE],
  }),
  descriptor({
    id: 'archon.context.status',
    display: 'archon context status [prompt] [--no-write-artifact]',
    argvPrefix: ['context', 'status'],
    surface: 'cli',
    purpose: 'Show readiness, evidence, next decision',
    owner: 'aco-context',
    implementationStatus: 'supported',
    mutates: 'writes-artifacts',
    safetyClasses: ['read-only', 'writes-artifacts'],
    approvalRequired: false,
    outputModes: ['markdown', 'json'],
    arguments: [argument('prompt', false, true, 'Optional prompt to scope context status')],
    options: [
      option(
        'write-artifact',
        null,
        false,
        'Write scoped artifact dossier under $ARTIFACTS_DIR or .archon/artifacts (default)',
        ['ARTIFACTS_DIR'],
        null,
        'writes-artifacts'
      ),
      option(
        'no-write-artifact',
        null,
        false,
        'Suppress default scoped artifact dossier output',
        [],
        null,
        'read-only'
      ),
    ],
    evidence: [COMMAND_LEDGER_EVIDENCE, S7_CONSENSUS_EVIDENCE, S8_CONSENSUS_EVIDENCE],
  }),
  descriptor({
    id: 'archon.context.ledgers',
    display: 'archon context ledgers [prompt] [--no-write-artifact]',
    argvPrefix: ['context', 'ledgers'],
    surface: 'cli',
    purpose: 'Show tool and command ledgers',
    owner: 'aco-ledgers',
    implementationStatus: 'supported',
    mutates: 'writes-artifacts',
    safetyClasses: ['read-only', 'writes-artifacts'],
    approvalRequired: false,
    outputModes: ['markdown', 'json'],
    arguments: [argument('prompt', false, true, 'Optional prompt to scope ledger output')],
    options: [
      option(
        'write-artifact',
        null,
        false,
        'Write scoped artifact dossier under $ARTIFACTS_DIR or .archon/artifacts (default)',
        ['ARTIFACTS_DIR'],
        null,
        'writes-artifacts'
      ),
      option(
        'no-write-artifact',
        null,
        false,
        'Suppress default scoped artifact dossier output',
        [],
        null,
        'read-only'
      ),
    ],
    evidence: [COMMAND_LEDGER_EVIDENCE, S7_CONSENSUS_EVIDENCE],
  }),
  descriptor({
    id: 'archon.context.route',
    display: 'archon context route <prompt> [--no-write-artifact]',
    argvPrefix: ['context', 'route'],
    surface: 'cli',
    purpose: 'Select BMAD advisory route',
    owner: 'aco-bmad',
    implementationStatus: 'supported',
    mutates: 'writes-artifacts',
    safetyClasses: ['read-only', 'writes-artifacts'],
    approvalRequired: false,
    outputModes: ['markdown', 'json'],
    arguments: [argument('prompt', true, true, 'Prompt to route through the advisory contract')],
    options: [
      option(
        'write-artifact',
        null,
        false,
        'Write scoped artifact dossier under $ARTIFACTS_DIR or .archon/artifacts (default)',
        ['ARTIFACTS_DIR'],
        null,
        'writes-artifacts'
      ),
      option(
        'no-write-artifact',
        null,
        false,
        'Suppress default scoped artifact dossier output',
        [],
        null,
        'read-only'
      ),
    ],
    evidence: [COMMAND_LEDGER_EVIDENCE, COMMAND_ROUTER_TEMPLATE_EVIDENCE, S7_CONSENSUS_EVIDENCE],
  }),
  descriptor({
    id: 'archon.context.compile',
    display: 'archon context compile <prompt> [--no-write-artifact]',
    argvPrefix: ['context', 'compile'],
    surface: 'cli',
    purpose: 'Compile context package and artifact archive',
    owner: 'aco-context',
    implementationStatus: 'supported',
    mutates: 'writes-artifacts',
    safetyClasses: ['read-only', 'writes-artifacts'],
    approvalRequired: false,
    outputModes: ['markdown', 'json'],
    arguments: [argument('prompt', true, true, 'Prompt to compile into a context package')],
    options: [
      option(
        'write-artifact',
        null,
        false,
        'Write scoped artifact dossier under $ARTIFACTS_DIR or .archon/artifacts (default)',
        [],
        null,
        'writes-artifacts'
      ),
      option(
        'no-write-artifact',
        null,
        false,
        'Suppress default scoped artifact dossier output',
        [],
        null,
        'read-only'
      ),
    ],
    evidence: [COMMAND_LEDGER_EVIDENCE, S7_CONSENSUS_EVIDENCE, S8_CONSENSUS_EVIDENCE],
  }),
  descriptor({
    id: 'archon.context.approval-capsule',
    display: 'archon context approval-capsule <prompt> [--no-write-artifact]',
    argvPrefix: ['context', 'approval-capsule'],
    surface: 'cli',
    purpose: 'Create approval capsule for approval-required package',
    owner: 'aco-context',
    implementationStatus: 'supported',
    mutates: 'writes-artifacts',
    safetyClasses: ['read-only', 'writes-artifacts'],
    approvalRequired: false,
    outputModes: ['markdown', 'json'],
    arguments: [argument('prompt', true, true, 'Prompt requiring an approval capsule')],
    options: [
      option(
        'write-artifact',
        null,
        false,
        'Write scoped artifact dossier under $ARTIFACTS_DIR or .archon/artifacts (default)',
        [],
        null,
        'writes-artifacts'
      ),
      option(
        'no-write-artifact',
        null,
        false,
        'Suppress default scoped artifact dossier output',
        [],
        null,
        'read-only'
      ),
    ],
    evidence: [COMMAND_LEDGER_EVIDENCE, S7_CONSENSUS_EVIDENCE, S8_CONSENSUS_EVIDENCE],
  }),
  descriptor({
    id: 'archon.context.approval-capsule-verify',
    display: 'archon context approval-capsule-verify [--no-write-artifact]',
    argvPrefix: ['context', 'approval-capsule-verify'],
    surface: 'cli',
    purpose: 'Verify approval contract against artifacts',
    owner: 'aco-context',
    implementationStatus: 'supported',
    mutates: 'writes-artifacts',
    safetyClasses: ['read-only', 'writes-artifacts'],
    approvalRequired: false,
    outputModes: ['markdown', 'json'],
    arguments: [],
    options: [
      option(
        'write-artifact',
        null,
        false,
        'Write scoped artifact dossier under $ARTIFACTS_DIR or .archon/artifacts (default)',
        [],
        null,
        'writes-artifacts'
      ),
      option(
        'no-write-artifact',
        null,
        false,
        'Suppress default scoped artifact dossier output',
        [],
        null,
        'read-only'
      ),
    ],
    evidence: [COMMAND_LEDGER_EVIDENCE, S7_CONSENSUS_EVIDENCE, S8_CONSENSUS_EVIDENCE],
  }),
  descriptor({
    id: 'archon.context.graph-waivers',
    display: 'archon context graph-waivers [--no-write-artifact]',
    argvPrefix: ['context', 'graph-waivers'],
    surface: 'cli',
    purpose: 'Inspect graph waiver closure state',
    owner: 'aco-research',
    implementationStatus: 'supported',
    mutates: 'writes-artifacts',
    safetyClasses: ['read-only', 'writes-artifacts'],
    approvalRequired: false,
    outputModes: ['markdown', 'json'],
    arguments: [],
    options: [
      option(
        'write-artifact',
        null,
        false,
        'Write scoped graph-waiver dossier under $ARTIFACTS_DIR or .archon/artifacts (default)',
        [],
        null,
        'writes-artifacts'
      ),
      option(
        'no-write-artifact',
        null,
        false,
        'Suppress default scoped graph-waiver dossier output',
        [],
        null,
        'read-only'
      ),
    ],
    evidence: [COMMAND_LEDGER_EVIDENCE, S7_CONSENSUS_EVIDENCE],
  }),
  descriptor({
    id: 'archon.context.validate',
    display: 'archon context validate',
    argvPrefix: ['context', 'validate'],
    surface: 'cli',
    purpose: 'Validate ACO research/spec readiness',
    owner: 'aco-gates',
    implementationStatus: 'supported',
    mutates: 'read-only',
    safetyClasses: ['read-only'],
    approvalRequired: false,
    outputModes: ['markdown', 'json'],
    arguments: [],
    options: [],
    evidence: [COMMAND_LEDGER_EVIDENCE, S7_CONSENSUS_EVIDENCE],
  }),
  descriptor({
    id: 'bun.research.graph',
    display: 'bun run research:graph',
    argvPrefix: ['bun', 'run', 'research:graph'],
    surface: 'script',
    purpose: 'Generate graph evidence',
    owner: 'aco-research',
    implementationStatus: 'approval-required',
    mutates: 'writes-graph-cache',
    safetyClasses: ['network', 'writes-graph-cache'],
    approvalRequired: true,
    outputModes: ['text', 'json'],
    arguments: [],
    options: [],
    evidence: [COMMAND_LEDGER_EVIDENCE, S7_CONSENSUS_EVIDENCE],
  }),
  descriptor({
    id: 'bun.aco.role-contracts',
    display: 'bun run aco:role-contracts',
    argvPrefix: ['bun', 'run', 'aco:role-contracts'],
    surface: 'script',
    purpose: 'Check role contracts',
    owner: 'aco-gates',
    implementationStatus: 'deferred',
    mutates: 'read-only',
    safetyClasses: ['read-only'],
    approvalRequired: false,
    outputModes: ['text', 'json'],
    arguments: [],
    options: [],
    evidence: [COMMAND_LEDGER_EVIDENCE, S7_CONSENSUS_EVIDENCE],
  }),
];

function descriptor(
  input: Omit<AcoCommandDescriptor, 'kind' | 'schemaVersion' | 'compatibility'>
): AcoCommandDescriptor {
  return acoCommandDescriptorSchema.parse({
    kind: 'aco-cli-command-descriptor',
    schemaVersion: 'aco.cli-command-descriptor.v1',
    compatibility: 'preserve',
    ...input,
  });
}

function argument(
  name: string,
  required: boolean,
  variadic: boolean,
  description: string
): AcoCommandDescriptor['arguments'][number] {
  return { name, required, variadic, description };
}

function option(
  name: string,
  valueName: string | null,
  required: boolean,
  description: string,
  allowedValues: readonly string[] = [],
  defaultValue: string | null = null,
  safetyClassWhenEnabled: AcoCommandDescriptor['options'][number]['safetyClassWhenEnabled'] = null
): AcoCommandDescriptor['options'][number] {
  return {
    name,
    valueName,
    required,
    allowedValues: [...allowedValues],
    defaultValue,
    description,
    safetyClassWhenEnabled,
  };
}
