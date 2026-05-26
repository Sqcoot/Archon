import {
  confidenceValues,
  freshnessValues,
  mutationClassValues,
  surfaceCompatibilityValues,
} from '@archon/aco-core';
import type {
  Confidence,
  EvidenceRef,
  Freshness,
  LedgerEntry,
  MutationClass,
  ParseResult,
  SurfaceCompatibility,
} from '@archon/aco-core';
import { z } from 'zod';
import { parseCsv } from './csv';
import {
  artifactLedgerRowSchema,
  capabilityLedgerRowSchema,
  commandLedgerRowSchema,
  ledgerBundleSchema,
  ledgerNameValues,
  riskLedgerRowSchema,
  toolAvailabilityLedgerRowSchema,
  unknownsLedgerRowSchema,
  workflowLedgerRowSchema,
} from './schemas';
import type {
  AcoLedgerEntry,
  ArtifactLedgerEntry,
  ArtifactLedgerRow,
  ArtifactLedgerStatus,
  CapabilityLedgerEntry,
  CapabilityLedgerRow,
  CapabilityLedgerStatus,
  CommandLedgerEntry,
  CommandLedgerRow,
  CommandLedgerStatus,
  LedgerBundle,
  LedgerBundleInput,
  LedgerCompatibility,
  LedgerCsvInputs,
  LedgerName,
  LedgerObjectInputs,
  LedgerSafety,
  LedgerSourceRef,
  RiskLedgerEntry,
  RiskLedgerRow,
  SourceLedgerProvenance,
  ToolAvailabilityLedgerEntry,
  ToolAvailabilityLedgerRow,
  ToolLedgerStatus,
  UnknownLedgerStatus,
  UnknownsLedgerEntry,
  UnknownsLedgerRow,
  WorkflowLedgerEntry,
  WorkflowLedgerRow,
  WorkflowLedgerStatus,
} from './schemas';

interface RowWithSource<TRow> {
  readonly row: TRow;
  readonly source: LedgerSourceRef;
}

interface ParsedLedgerRowsForLedger<TRow> {
  readonly header: readonly string[];
  readonly rows: readonly RowWithSource<TRow>[];
}

interface ParsedLedgerRows {
  readonly artifact: ParsedLedgerRowsForLedger<ArtifactLedgerRow>;
  readonly capability: ParsedLedgerRowsForLedger<CapabilityLedgerRow>;
  readonly command: ParsedLedgerRowsForLedger<CommandLedgerRow>;
  readonly risk: ParsedLedgerRowsForLedger<RiskLedgerRow>;
  readonly tool: ParsedLedgerRowsForLedger<ToolAvailabilityLedgerRow>;
  readonly unknowns: ParsedLedgerRowsForLedger<UnknownsLedgerRow>;
  readonly workflow: ParsedLedgerRowsForLedger<WorkflowLedgerRow>;
}

type IssueList = readonly string[];
const OPTIONAL_FRESHNESS_HEADER = 'freshness';

const LEDGER_SPECS = {
  artifact: {
    fileName: 'artifact-ledger.csv',
    header: ['artifact', 'schema', 'producer', 'consumer', 'required'],
  },
  capability: {
    fileName: 'capability-inventory.csv',
    header: [
      'id',
      'capability',
      'current_surface',
      'rewrite_action',
      'required_artifact',
      'status',
      'confidence',
    ],
  },
  command: {
    fileName: 'command-ledger.csv',
    header: [
      'command',
      'surface',
      'purpose',
      'safety',
      'mutates',
      'approval_required',
      'owner',
      'compatibility',
    ],
  },
  risk: {
    fileName: 'risk-ledger.csv',
    header: ['risk', 'impact', 'mitigation', 'owner'],
  },
  tool: {
    fileName: 'tool-availability-ledger.csv',
    header: ['tool', 'category', 'status', 'safety', 'preconditions', 'fallback'],
  },
  unknowns: {
    fileName: 'unknowns-ledger.csv',
    header: ['unknown', 'status', 'resolution', 'router_required'],
  },
  workflow: {
    fileName: 'workflow-ledger.csv',
    header: [
      'workflow',
      'purpose',
      'mutates_checkout',
      'artifact_contract',
      'role_contracts',
      'compatibility',
    ],
  },
} as const satisfies Record<
  LedgerName,
  { readonly fileName: string; readonly header: readonly string[] }
>;

const REQUIRED_LEDGER_KEYS = new Set<string>(ledgerNameValues);
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

export function parseLedgerCsvInputs(input: LedgerCsvInputs): ParseResult<LedgerObjectInputs> {
  const parsed = parseLedgerRows(input);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    value: {
      artifact: parsed.value.artifact.rows.map(item => item.row),
      capability: parsed.value.capability.rows.map(item => item.row),
      command: parsed.value.command.rows.map(item => item.row),
      risk: parsed.value.risk.rows.map(item => item.row),
      tool: parsed.value.tool.rows.map(item => item.row),
      unknowns: parsed.value.unknowns.rows.map(item => item.row),
      workflow: parsed.value.workflow.rows.map(item => item.row),
    },
  };
}

export function buildLedgerBundle(input: LedgerBundleInput): ParseResult<LedgerBundle> {
  const parsedRows = parseLedgerRows(input);
  if (!parsedRows.ok) return parsedRows;

  const issues: string[] = [];
  const artifacts = collectMapped(parsedRows.value.artifact.rows, toArtifactEntry, issues);
  const capabilities = collectMapped(parsedRows.value.capability.rows, toCapabilityEntry, issues);
  const commands = collectMapped(parsedRows.value.command.rows, toCommandEntry, issues);
  const risks = collectMapped(parsedRows.value.risk.rows, toRiskEntry, issues);
  const tools = collectMapped(parsedRows.value.tool.rows, toToolEntry, issues);
  const unknowns = collectMapped(parsedRows.value.unknowns.rows, toUnknownEntry, issues);
  const workflows = collectMapped(parsedRows.value.workflow.rows, toWorkflowEntry, issues);
  const entries = sortEntries([
    ...artifacts,
    ...capabilities,
    ...commands,
    ...risks,
    ...tools,
    ...unknowns,
    ...workflows,
  ]);

  issues.push(...findDuplicateIds(entries));
  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const bundle = {
    kind: 'ledger-bundle',
    id: 'aco.ledger-bundle.fixture',
    schemaVersion: 'aco.ledger-bundle.v1',
    generatedFrom: ledgerNameValues.map(ledger =>
      sourceLedgerProvenance(
        ledger,
        parsedRows.value[ledger].header,
        parsedRows.value[ledger].rows.length
      )
    ),
    counts: {
      artifact: artifacts.length,
      capability: capabilities.length,
      command: commands.length,
      risk: risks.length,
      tool: tools.length,
      unknowns: unknowns.length,
      workflow: workflows.length,
      total: entries.length,
    },
    artifacts: sortEntries(artifacts),
    capabilities: sortEntries(capabilities),
    commands: sortEntries(commands),
    risks: sortEntries(risks),
    tools: sortEntries(tools),
    unknowns: sortEntries(unknowns),
    workflows: sortEntries(workflows),
    entries,
  } as const;

  const validation = ledgerBundleSchema.safeParse(bundle);
  if (!validation.success) {
    return { ok: false, issues: validation.error.issues.map(issue => issue.message) };
  }

  return { ok: true, value: validation.data };
}

export function parseLedgerBundle(input: unknown): ParseResult<LedgerBundle> {
  const parsed = ledgerBundleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  }
  return { ok: true, value: parsed.data };
}

function parseLedgerRows(input: LedgerBundleInput): ParseResult<ParsedLedgerRows> {
  const record = toInputRecord(input);
  if (!record.ok) return record;

  const missing = ledgerNameValues.filter(ledger => record.value[ledger] === undefined);
  const unsupported = Object.keys(record.value).filter(key => !REQUIRED_LEDGER_KEYS.has(key));
  if (missing.length > 0 || unsupported.length > 0) {
    return {
      ok: false,
      issues: [
        ...missing.map(ledger => `missing required ledger ${ledger}`),
        ...unsupported.map(ledger => `unsupported ledger ${ledger}`),
      ],
    };
  }

  const artifact = parseRowsForLedger('artifact', record.value.artifact, artifactLedgerRowSchema);
  const capability = parseRowsForLedger(
    'capability',
    record.value.capability,
    capabilityLedgerRowSchema
  );
  const command = parseRowsForLedger('command', record.value.command, commandLedgerRowSchema);
  const risk = parseRowsForLedger('risk', record.value.risk, riskLedgerRowSchema);
  const tool = parseRowsForLedger('tool', record.value.tool, toolAvailabilityLedgerRowSchema);
  const unknowns = parseRowsForLedger('unknowns', record.value.unknowns, unknownsLedgerRowSchema);
  const workflow = parseRowsForLedger('workflow', record.value.workflow, workflowLedgerRowSchema);
  const issues = collectIssues(artifact, capability, command, risk, tool, unknowns, workflow);
  if (issues.length > 0) {
    return { ok: false, issues };
  }
  if (
    !artifact.ok ||
    !capability.ok ||
    !command.ok ||
    !risk.ok ||
    !tool.ok ||
    !unknowns.ok ||
    !workflow.ok
  ) {
    return { ok: false, issues: ['unreachable ledger parse failure'] };
  }

  return {
    ok: true,
    value: {
      artifact: artifact.value,
      capability: capability.value,
      command: command.value,
      risk: risk.value,
      tool: tool.value,
      unknowns: unknowns.value,
      workflow: workflow.value,
    },
  };
}

function parseRowsForLedger<TRow>(
  ledger: LedgerName,
  value: unknown,
  schema: z.ZodType<TRow>
): ParseResult<ParsedLedgerRowsForLedger<TRow>> {
  const spec = LEDGER_SPECS[ledger];
  let parsed: ParseResult<{ readonly header: readonly string[]; readonly rows: readonly TRow[] }>;
  if (typeof value === 'string') {
    parsed = parseCsvRows(ledger, value, schema);
  } else {
    const objectRows = parseObjectRows(value, schema);
    if (!objectRows.ok) return objectRows;
    parsed = { ok: true, value: { header: [...spec.header], rows: objectRows.value } };
  }
  if (!parsed.ok) return parsed;

  return {
    ok: true,
    value: {
      header: parsed.value.header,
      rows: parsed.value.rows.map((row, index) => ({
        row,
        source: {
          ledger,
          fileName: spec.fileName,
          rowNumber: index + 2,
        },
      })),
    },
  };
}

function parseCsvRows<TRow>(
  ledger: LedgerName,
  input: string,
  schema: z.ZodType<TRow>
): ParseResult<{ readonly header: readonly string[]; readonly rows: readonly TRow[] }> {
  const spec = LEDGER_SPECS[ledger];
  const parsed = parseCsv(input);
  if (!parsed.ok) return parsed;
  const [header, ...records] = parsed.value;
  if (header === undefined) {
    return { ok: false, issues: [`${ledger} ledger has no header`] };
  }
  const resolvedHeader = resolveCsvHeader(ledger, header, spec.header);
  if (!resolvedHeader.ok) {
    return {
      ok: false,
      issues: resolvedHeader.issues,
    };
  }

  const rows: Record<string, string>[] = [];
  const issues: string[] = [];
  records.forEach((record, index) => {
    if (record.length !== resolvedHeader.value.length) {
      issues.push(
        `${ledger} ledger row ${index + 2} has ${record.length} cells; expected ${resolvedHeader.value.length}`
      );
      return;
    }
    rows.push(
      Object.fromEntries(
        resolvedHeader.value.map((column, columnIndex) => [column, record[columnIndex] ?? ''])
      )
    );
  });
  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const parsedRows = parseObjectRows(rows, schema);
  if (!parsedRows.ok) return parsedRows;
  return { ok: true, value: { header: resolvedHeader.value, rows: parsedRows.value } };
}

function parseObjectRows<TRow>(
  value: unknown,
  schema: z.ZodType<TRow>
): ParseResult<readonly TRow[]> {
  if (!Array.isArray(value)) {
    return { ok: false, issues: ['ledger input must be a CSV string or row object array'] };
  }
  const parsed = z.array(schema).safeParse(value);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(issue => issue.message) };
  }
  return { ok: true, value: parsed.data };
}

function toArtifactEntry(item: RowWithSource<ArtifactLedgerRow>): ParseResult<ArtifactLedgerEntry> {
  const status = normalizeArtifactStatus(item.row.required);
  const freshness = normalizeFreshness(item.row.freshness, 'unknown', item.source);
  if (!status.ok || !freshness.ok) return { ok: false, issues: collectIssues(status, freshness) };

  const id = `artifact.${slugify(item.row.artifact)}`;
  const compatibility: LedgerCompatibility =
    status.value === 'conditional' ? 'preserve-gated' : 'preserve';
  return {
    ok: true,
    value: {
      kind: 'ledger-entry',
      ledger: 'artifact',
      id,
      source: item.source,
      owner: item.row.producer,
      status: status.value,
      confidence: 'high',
      freshness: freshness.value,
      evidence: [
        ledgerEvidence(id, item.source, `artifact ${item.row.artifact}`, 'high', freshness.value),
      ],
      raw: rawRecord(item.row),
      subject: {
        artifact: item.row.artifact,
        schemaVersion: item.row.schema,
        producer: item.row.producer,
        consumer: item.row.consumer,
        required: item.row.required,
      },
      compatibility,
      approvalRequired: false,
    },
  };
}

function toCapabilityEntry(
  item: RowWithSource<CapabilityLedgerRow>
): ParseResult<CapabilityLedgerEntry> {
  const status = normalizeCapabilityStatus(item.row.status);
  const confidence = normalizeConfidence(item.row.confidence, item.source);
  const freshness = normalizeFreshness(item.row.freshness, 'unknown', item.source);
  const compatibility = normalizeLedgerCompatibility(item.row.rewrite_action, item.source);
  if (!status.ok || !confidence.ok || !freshness.ok || !compatibility.ok) {
    return { ok: false, issues: collectIssues(status, confidence, freshness, compatibility) };
  }

  const id = `capability.${slugify(item.row.id)}`;
  return {
    ok: true,
    value: {
      kind: 'ledger-entry',
      ledger: 'capability',
      id,
      source: item.source,
      owner: `aco-${item.row.id}`,
      status: status.value,
      confidence: confidence.value,
      freshness: freshness.value,
      evidence: [
        ledgerEvidence(
          id,
          item.source,
          `capability ${item.row.id}`,
          confidence.value,
          freshness.value
        ),
      ],
      raw: rawRecord(item.row),
      subject: {
        id: item.row.id,
        capability: item.row.capability,
        currentSurface: item.row.current_surface,
        rewriteAction: compatibility.value,
        requiredArtifact: item.row.required_artifact,
      },
      compatibility: compatibility.value,
      approvalRequired: status.value === 'approval-required',
    },
  };
}

function toCommandEntry(item: RowWithSource<CommandLedgerRow>): ParseResult<CommandLedgerEntry> {
  const safety = normalizeSafety(item.row.safety, item.source);
  const mutates = normalizeMutation(item.row.mutates, item.source);
  const approval = normalizeApproval(item.row.approval_required, item.source);
  const compatibility = normalizeSurfaceCompatibility(item.row.compatibility, item.source);
  const freshness = normalizeFreshness(item.row.freshness, 'unknown', item.source);
  if (!safety.ok || !mutates.ok || !approval.ok || !compatibility.ok || !freshness.ok) {
    return {
      ok: false,
      issues: collectIssues(safety, mutates, approval, compatibility, freshness),
    };
  }

  const approvalIssue = validateApproval(mutates.value, approval.value, item.source);
  if (approvalIssue.length > 0) return { ok: false, issues: approvalIssue };

  const id = `command.${slugify(item.row.command)}`;
  return {
    ok: true,
    value: {
      kind: 'ledger-entry',
      ledger: 'command',
      id,
      source: item.source,
      owner: item.row.owner,
      status: compatibility.value,
      confidence: 'high',
      freshness: freshness.value,
      evidence: [
        ledgerEvidence(id, item.source, `command ${item.row.command}`, 'high', freshness.value),
      ],
      raw: rawRecord(item.row),
      subject: {
        command: item.row.command,
        surface: item.row.surface,
        purpose: item.row.purpose,
        safety: safety.value,
        mutates: mutates.value,
        approvalRequired: approval.value,
        owner: item.row.owner,
        compatibility: compatibility.value,
      },
      compatibility: compatibility.value,
      safety: safety.value,
      mutates: mutates.value,
      approvalRequired: approval.value,
    },
  };
}

function toRiskEntry(item: RowWithSource<RiskLedgerRow>): ParseResult<RiskLedgerEntry> {
  const freshness = normalizeFreshness(item.row.freshness, 'unknown', item.source);
  if (!freshness.ok) return freshness;

  const id = `risk.${slugify(item.row.risk)}`;
  return {
    ok: true,
    value: {
      kind: 'ledger-entry',
      ledger: 'risk',
      id,
      source: item.source,
      owner: item.row.owner,
      status: 'tracked',
      confidence: 'medium',
      freshness: freshness.value,
      evidence: [
        ledgerEvidence(id, item.source, `risk ${item.row.risk}`, 'medium', freshness.value),
      ],
      raw: rawRecord(item.row),
      subject: {
        risk: item.row.risk,
        impact: item.row.impact,
        mitigation: item.row.mitigation,
      },
      compatibility: 'preserve',
      approvalRequired: false,
    },
  };
}

function toToolEntry(
  item: RowWithSource<ToolAvailabilityLedgerRow>
): ParseResult<ToolAvailabilityLedgerEntry> {
  const status = normalizeToolStatus(item.row.status, item.source);
  const safety = normalizeSafety(item.row.safety, item.source);
  const freshness = normalizeFreshness(item.row.freshness, 'unknown', item.source);
  if (!status.ok || !safety.ok || !freshness.ok) {
    return { ok: false, issues: collectIssues(status, safety, freshness) };
  }

  const approvalRequired =
    status.value === 'approval-required' ||
    item.row.fallback.includes('approval_required') ||
    item.row.preconditions.includes('approved');
  const compatibility: LedgerCompatibility = approvalRequired ? 'preserve-gated' : 'preserve';
  const confidence: Confidence = status.value === 'required' ? 'medium' : 'low';
  const id = `tool.${slugify(item.row.tool)}`;
  return {
    ok: true,
    value: {
      kind: 'ledger-entry',
      ledger: 'tool',
      id,
      source: item.source,
      owner: 'aco-ledgers',
      status: status.value,
      confidence,
      freshness: freshness.value,
      evidence: [
        ledgerEvidence(id, item.source, `tool ${item.row.tool}`, confidence, freshness.value),
      ],
      raw: rawRecord(item.row),
      subject: {
        tool: item.row.tool,
        category: item.row.category,
        safety: safety.value,
        preconditions: item.row.preconditions,
        fallback: item.row.fallback,
      },
      compatibility,
      safety: safety.value,
      approvalRequired,
    },
  };
}

function toUnknownEntry(item: RowWithSource<UnknownsLedgerRow>): ParseResult<UnknownsLedgerEntry> {
  const status = normalizeUnknownStatus(item.row.status, item.source);
  const routerRequired = normalizeBoolean(item.row.router_required, item.source, 'router_required');
  const freshness = normalizeFreshness(item.row.freshness, 'unknown', item.source);
  if (!status.ok || !routerRequired.ok || !freshness.ok) {
    return { ok: false, issues: collectIssues(status, routerRequired, freshness) };
  }

  const compatibility: LedgerCompatibility = routerRequired.value ? 'preserve-gated' : 'preserve';
  const confidence: Confidence = status.value === 'unknown' ? 'low' : 'medium';
  const id = `unknown.${slugify(item.row.unknown)}`;
  return {
    ok: true,
    value: {
      kind: 'ledger-entry',
      ledger: 'unknowns',
      id,
      source: item.source,
      owner: 'aco-ledgers',
      status: status.value,
      confidence,
      freshness: freshness.value,
      evidence: [
        ledgerEvidence(id, item.source, `unknown ${item.row.unknown}`, confidence, freshness.value),
      ],
      raw: rawRecord(item.row),
      subject: {
        unknown: item.row.unknown,
        resolution: item.row.resolution,
        routerRequired: routerRequired.value,
      },
      compatibility,
      approvalRequired: status.value === 'approval-required',
    },
  };
}

function toWorkflowEntry(item: RowWithSource<WorkflowLedgerRow>): ParseResult<WorkflowLedgerEntry> {
  const status = normalizeWorkflowStatus(item.row.compatibility, item.source);
  const freshness = normalizeFreshness(item.row.freshness, 'unknown', item.source);
  if (!status.ok || !freshness.ok) return { ok: false, issues: collectIssues(status, freshness) };

  const mutatesCheckout = normalizeMutatesCheckout(item.row.mutates_checkout);
  const id = `workflow.${slugify(item.row.workflow)}`;
  return {
    ok: true,
    value: {
      kind: 'ledger-entry',
      ledger: 'workflow',
      id,
      source: item.source,
      owner: 'aco-workflows',
      status: status.value,
      confidence: 'medium',
      freshness: freshness.value,
      evidence: [
        ledgerEvidence(id, item.source, `workflow ${item.row.workflow}`, 'medium', freshness.value),
      ],
      raw: rawRecord(item.row),
      subject: {
        workflow: item.row.workflow,
        purpose: item.row.purpose,
        mutatesCheckout,
        mutatesCheckoutRaw: item.row.mutates_checkout,
        artifactContract: item.row.artifact_contract,
        roleContracts: splitList(item.row.role_contracts),
        compatibility: status.value,
      },
      compatibility: status.value,
      approvalRequired: mutatesCheckout,
    },
  };
}

function sourceLedgerProvenance(
  ledger: LedgerName,
  parsedHeader: readonly string[],
  rowCount: number
): SourceLedgerProvenance {
  const spec = LEDGER_SPECS[ledger];
  const header = parsedHeader.length > 0 ? parsedHeader : spec.header;
  return {
    ledger,
    fileName: spec.fileName,
    header: [...header],
    rowCount,
    evidence: {
      id: `evidence.ledger.${ledger}.source`,
      source: spec.fileName,
      summary: `${ledger} ledger oracle CSV with ${rowCount} data rows`,
      confidence: 'high',
      freshness: 'unknown',
    },
  };
}

function ledgerEvidence(
  entryId: string,
  source: LedgerSourceRef,
  summary: string,
  confidence: Confidence,
  freshness: Freshness
): EvidenceRef {
  return {
    id: `evidence.ledger.${source.ledger}.${source.rowNumber - 1}`,
    source: `${source.fileName}#L${source.rowNumber}`,
    summary: `${summary} from ${entryId}`,
    confidence,
    freshness,
  };
}

function normalizeArtifactStatus(value: string): ParseResult<ArtifactLedgerStatus> {
  const normalized = value === 'yes' || value === 'yes for ACO workflows' ? 'required' : value;
  if (normalized === 'required' || normalized === 'conditional') {
    return { ok: true, value: normalized };
  }
  return { ok: false, issues: [`invalid status for artifact required value ${value}`] };
}

function normalizeCapabilityStatus(value: string): ParseResult<CapabilityLedgerStatus> {
  const normalized = value.replaceAll('_', '-');
  if (
    normalized === 'planned' ||
    normalized === 'supported' ||
    normalized === 'unsupported' ||
    normalized === 'unknown' ||
    normalized === 'deferred' ||
    normalized === 'blocked' ||
    normalized === 'partial' ||
    normalized === 'approval-required' ||
    normalized === 'not-used' ||
    normalized === 'forbidden'
  ) {
    return { ok: true, value: normalized };
  }
  return { ok: false, issues: [`invalid status for capability value ${value}`] };
}

function normalizeToolStatus(
  value: string,
  source: LedgerSourceRef
): ParseResult<ToolLedgerStatus> {
  if (value.startsWith('required')) {
    return { ok: true, value: 'required' };
  }
  const normalized = normalizeToken(value);
  if (
    normalized === 'required' ||
    normalized === 'optional-conditional' ||
    normalized === 'existing-built-in' ||
    normalized === 'community-reference' ||
    normalized === 'blocked' ||
    normalized === 'unknown' ||
    normalized === 'deferred' ||
    normalized === 'approval-required' ||
    normalized === 'not-used' ||
    normalized === 'forbidden'
  ) {
    return { ok: true, value: normalized };
  }
  return {
    ok: false,
    issues: [`${source.fileName}#L${source.rowNumber}: invalid status ${value}`],
  };
}

function normalizeUnknownStatus(
  value: string,
  source: LedgerSourceRef
): ParseResult<UnknownLedgerStatus> {
  if (value === 'unknown in this session' || value === 'unknown')
    return { ok: true, value: 'unknown' };
  if (value === 'not found in visible branch evidence') return { ok: true, value: 'not-found' };
  if (
    value === 'partial' ||
    value === 'blocked' ||
    value === 'deferred' ||
    value === 'approval-required'
  ) {
    return { ok: true, value };
  }
  return {
    ok: false,
    issues: [`${source.fileName}#L${source.rowNumber}: invalid status ${value}`],
  };
}

function normalizeWorkflowStatus(
  value: string,
  source: LedgerSourceRef
): ParseResult<WorkflowLedgerStatus> {
  const normalized = normalizeToken(value);
  if (
    normalized === 'preserve' ||
    normalized === 'preserve-harden' ||
    normalized === 'existing-reference-only' ||
    normalized === 'preserve-existing'
  ) {
    return { ok: true, value: normalized };
  }
  return {
    ok: false,
    issues: [`${source.fileName}#L${source.rowNumber}: unsupported compatibility ${value}`],
  };
}

function normalizeSafety(value: string, source: LedgerSourceRef): ParseResult<LedgerSafety> {
  const safetyByValue = new Map<string, LedgerSafety>([
    ['read-only', 'read-only'],
    ['read-only by default', 'read-only-by-default'],
    ['read-only if configured', 'read-only'],
    ['read-only or writes-artifacts', 'read-only-or-writes-artifacts'],
    ['artifact-only when flag set', 'artifact-only'],
    ['can run tests/scripts', 'can-run-tests'],
    ['may need auth/OAuth', 'may-need-auth'],
    ['writes-artifacts', 'writes-artifacts'],
    ['writes graph artifacts', 'writes-graph-artifacts'],
    ['network/writes-artifacts', 'network-writes-artifacts'],
    ['read-only advisory', 'read-only'],
    ['runtime dependent', 'runtime-dependent'],
  ]);
  const safety = safetyByValue.get(value);
  if (safety !== undefined) return { ok: true, value: safety };
  return {
    ok: false,
    issues: [`${source.fileName}#L${source.rowNumber}: invalid safety ${value}`],
  };
}

function normalizeMutation(value: string, source: LedgerSourceRef): ParseResult<MutationClass> {
  const mutationByValue = new Map<string, MutationClass>([
    ['no', 'read-only'],
    ['read-only', 'read-only'],
    ['artifact-only', 'writes-artifacts'],
    ['artifact-only when flag set', 'writes-artifacts'],
    ['graph cache artifacts', 'writes-graph-cache'],
    ['writes-artifacts', 'writes-artifacts'],
  ]);
  const mutation = mutationByValue.get(value);
  if (mutation !== undefined) return { ok: true, value: mutation };
  if (isMutationClass(value)) return { ok: true, value };
  return {
    ok: false,
    issues: [`${source.fileName}#L${source.rowNumber}: invalid mutation ${value}`],
  };
}

function normalizeApproval(value: string, source: LedgerSourceRef): ParseResult<boolean> {
  if (
    value === 'no' ||
    value === 'no for artifact writes' ||
    value === 'no unless graph/config mutation requested' ||
    value === 'no to create capsule'
  ) {
    return { ok: true, value: false };
  }
  if (value === 'yes' || value === 'yes in readonly contexts') {
    return { ok: true, value: true };
  }
  return {
    ok: false,
    issues: [`${source.fileName}#L${source.rowNumber}: invalid approval value ${value}`],
  };
}

function validateApproval(
  mutation: MutationClass,
  approvalRequired: boolean,
  source: LedgerSourceRef
): IssueList {
  if (mutation === 'read-only' && approvalRequired) {
    return [`${source.fileName}#L${source.rowNumber}: approval mismatch for read-only command`];
  }
  if (HIGH_RISK_MUTATIONS.includes(mutation) && !approvalRequired) {
    return [`${source.fileName}#L${source.rowNumber}: approval mismatch for ${mutation}`];
  }
  return [];
}

function normalizeSurfaceCompatibility(
  value: string,
  source: LedgerSourceRef
): ParseResult<CommandLedgerStatus> {
  if (isSurfaceCompatibility(value)) return { ok: true, value };
  return {
    ok: false,
    issues: [`${source.fileName}#L${source.rowNumber}: unsupported compatibility ${value}`],
  };
}

function normalizeLedgerCompatibility(
  value: string,
  source: LedgerSourceRef
): ParseResult<LedgerCompatibility> {
  const normalized = normalizeToken(value);
  if (
    isSurfaceCompatibility(normalized) ||
    normalized === 'rewrite' ||
    normalized === 'existing-reference-only' ||
    normalized === 'preserve-existing'
  ) {
    return { ok: true, value: normalized };
  }
  return {
    ok: false,
    issues: [`${source.fileName}#L${source.rowNumber}: unsupported compatibility ${value}`],
  };
}

function normalizeConfidence(value: string, source: LedgerSourceRef): ParseResult<Confidence> {
  if (isConfidence(value)) return { ok: true, value };
  return {
    ok: false,
    issues: [`${source.fileName}#L${source.rowNumber}: invalid confidence ${value}`],
  };
}

function normalizeFreshness(
  value: string | undefined,
  fallback: Freshness,
  source: LedgerSourceRef
): ParseResult<Freshness> {
  const freshness = value ?? fallback;
  if (isFreshness(freshness)) return { ok: true, value: freshness };
  return {
    ok: false,
    issues: [`${source.fileName}#L${source.rowNumber}: invalid freshness ${freshness}`],
  };
}

function normalizeBoolean(
  value: string,
  source: LedgerSourceRef,
  field: string
): ParseResult<boolean> {
  if (value === 'yes' || value === 'true') return { ok: true, value: true };
  if (value === 'no' || value === 'false') return { ok: true, value: false };
  return {
    ok: false,
    issues: [`${source.fileName}#L${source.rowNumber}: invalid ${field} ${value}`],
  };
}

function normalizeMutatesCheckout(value: string): boolean {
  return value !== 'false' && value !== 'false in artifact-only phase';
}

function isConfidence(value: string): value is Confidence {
  return confidenceValues.includes(value as Confidence);
}

function isFreshness(value: string): value is Freshness {
  return freshnessValues.includes(value as Freshness);
}

function isMutationClass(value: string): value is MutationClass {
  return mutationClassValues.includes(value as MutationClass);
}

function isSurfaceCompatibility(value: string): value is SurfaceCompatibility {
  return surfaceCompatibilityValues.includes(value as SurfaceCompatibility);
}

function collectMapped<TInput, TOutput>(
  items: readonly TInput[],
  map: (item: TInput) => ParseResult<TOutput>,
  issues: string[]
): readonly TOutput[] {
  const values: TOutput[] = [];
  for (const item of items) {
    const result = map(item);
    if (result.ok) {
      values.push(result.value);
    } else {
      issues.push(...result.issues);
    }
  }
  return values;
}

function collectIssues(...results: readonly ParseResult<unknown>[]): readonly string[] {
  return results.flatMap(result => (result.ok ? [] : result.issues));
}

function findDuplicateIds(entries: readonly AcoLedgerEntry[]): readonly string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) duplicates.add(entry.id);
    seen.add(entry.id);
  }
  return [...duplicates].sort().map(id => `duplicate ledger entry id ${id}`);
}

function sortEntries<TEntry extends LedgerEntry<unknown, string>>(
  entries: readonly TEntry[]
): readonly TEntry[] {
  return [...entries].sort((left, right) => left.id.localeCompare(right.id));
}

function sameHeader(actual: readonly string[], expected: readonly string[]): boolean {
  return (
    actual.length === expected.length && actual.every((item, index) => item === expected[index])
  );
}

function resolveCsvHeader(
  ledger: LedgerName,
  actualHeader: readonly string[],
  expectedHeader: readonly string[]
): ParseResult<readonly string[]> {
  if (sameHeader(actualHeader, expectedHeader)) {
    return { ok: true, value: expectedHeader };
  }
  const expectedWithFreshness = [...expectedHeader, OPTIONAL_FRESHNESS_HEADER];
  if (sameHeader(actualHeader, expectedWithFreshness)) {
    return { ok: true, value: expectedWithFreshness };
  }
  return {
    ok: false,
    issues: [
      `${ledger} ledger malformed header: expected ${expectedHeader.join(',')} or ${expectedWithFreshness.join(',')} but received ${actualHeader.join(',')}`,
    ],
  };
}

function toInputRecord(input: LedgerBundleInput): ParseResult<Record<string, unknown>> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, issues: ['ledger bundle input must be an object'] };
  }
  return { ok: true, value: input as unknown as Record<string, unknown> };
}

function rawRecord(row: object): Record<string, string> {
  return Object.fromEntries(
    Object.entries(row).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  );
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0);
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replaceAll('/', '-').replaceAll(' ', '-');
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/<([^>]+)>/g, '$1')
    .replace(/\[([^\]]+)\]/g, '$1')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
