import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, Copy, FileArchive, GitBranch, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useProject } from '@/contexts/ProjectContext';
import { compileAcoPackage, getAcoRoute, getAcoStatus } from '@/lib/api';
import type { AcoCompileResponse, AcoRouteResponse, AcoStatusResponse } from '@/lib/api';
import {
  acoLedgerCountOrder,
  formatAcoHandoffNarrative,
  getAcoReadinessLabel,
} from '@/lib/aco-readiness';

const supportedNextDecisionSchemaVersion = 'aco.next-decision.v1';

// AC-ACO-STATUS-004: selectedProject.default_cwd is the only cwd sent to status, route, and compile APIs.
// AC-ACO-STATUS-005: User-facing labels say Context Orchestrator and Needs approval.
export function AcoStatusPage(): React.ReactElement {
  const { selectedProjectId, codebases, isLoadingCodebases } = useProject();
  const selectedProject = useMemo(
    () => codebases?.find(codebase => codebase.id === selectedProjectId) ?? null,
    [codebases, selectedProjectId]
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ['aco-status', selectedProject?.default_cwd],
    queryFn: () => getAcoStatus(selectedProject?.default_cwd ?? ''),
    enabled: Boolean(selectedProject?.default_cwd),
    refetchInterval: 30_000,
  });

  return (
    <>
      <Header title="Context Orchestrator" subtitle={selectedProject?.default_cwd} />
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          {!selectedProject && !isLoadingCodebases ? (
            <EmptyState />
          ) : error ? (
            <ErrorState message={error instanceof Error ? error.message : String(error)} />
          ) : isLoading || isLoadingCodebases || !data ? (
            <div className="text-sm text-muted-foreground">Loading ACO Status...</div>
          ) : (
            <AcoStatusContent status={data} />
          )}
        </div>
      </div>
    </>
  );
}

function AcoStatusContent({ status }: { status: AcoStatusResponse }): React.ReactElement {
  const [prompt, setPrompt] = useState('');
  const routeMutation = useMutation({
    mutationFn: () => getAcoRoute(status.cwd, prompt),
  });
  const compileMutation = useMutation({
    mutationFn: () => compileAcoPackage(status.cwd, prompt),
  });
  const readiness = getAcoReadinessLabel(status);
  const badgeVariant =
    readiness === 'Blocked' || readiness === 'Needs approval' ? 'destructive' : 'default';
  const graphLimitLabel = status.approvalRequired
    ? 'approval-required graph limits'
    : 'accepted graph limits';
  const waiverTitle = status.approvalRequired ? 'Approval Required' : 'Accepted Confidence Limits';
  const trimmedPrompt = prompt.trim();
  const canSubmit =
    trimmedPrompt.length > 0 && !routeMutation.isPending && !compileMutation.isPending;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Context Readiness
              </CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                {status.validationStatus} with {String(status.graphWaivers)} {graphLimitLabel}
              </p>
            </div>
            <Badge variant={badgeVariant}>{readiness}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="validation" value={status.validationStatus} />
            <Metric label="intent" value={status.contextIntent.intentHash} />
            <Metric label="graph" value={status.graphStatus} />
            <Metric label="waivers" value={String(status.graphWaivers)} />
            <Metric
              label="approval"
              value={status.approvalRequired ? 'required' : 'not required'}
            />
            <Metric label="schema" value={status.ledgerSchemaVersion} />
          </div>
        </CardContent>
      </Card>

      <NextDecisionPanel status={status} />

      <Card>
        <CardHeader>
          <CardTitle>Route and Compile</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Textarea
            value={prompt}
            onChange={event => {
              setPrompt(event.target.value);
            }}
            rows={4}
            placeholder="Describe the implementation or review request"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!canSubmit}
              onClick={() => {
                routeMutation.mutate();
              }}
            >
              <GitBranch className="mr-2 h-4 w-4" />
              Route
            </Button>
            <Button
              type="button"
              disabled={!canSubmit}
              onClick={() => {
                compileMutation.mutate();
              }}
            >
              <FileArchive className="mr-2 h-4 w-4" />
              Compile
            </Button>
          </div>
          {routeMutation.error ? <InlineError message={routeMutation.error.message} /> : null}
          {compileMutation.error ? <InlineError message={compileMutation.error.message} /> : null}
          {routeMutation.data ? <RouteResult route={routeMutation.data} /> : null}
          {compileMutation.data ? (
            <CompileResult result={compileMutation.data} cwd={status.cwd} />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ledger Coverage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <LedgerSection title="Combined" section={status.ledgerSummary.combined} />
            <LedgerSection
              title="Tool Availability"
              section={status.ledgerSummary.toolAvailability}
            />
            <LedgerSection title="Commands" section={status.ledgerSummary.commands} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evidence Blockers</CardTitle>
        </CardHeader>
        <CardContent>
          {status.evidenceBlockers.length === 0 ? (
            <div className="text-sm text-muted-foreground">No evidence blockers.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {status.evidenceBlockers.map(blocker => (
                <div
                  key={blocker.id}
                  className="rounded-md border border-border bg-surface p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-text-primary">{blocker.id}</span>
                    <Badge variant="secondary">
                      {blocker.status} · {blocker.freshness}
                    </Badge>
                  </div>
                  <div className="mt-2 text-muted-foreground">{blocker.nextVerificationAction}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evidence Resolution</CardTitle>
        </CardHeader>
        <CardContent>
          {status.evidenceResolution.items.length === 0 ? (
            <div className="text-sm text-muted-foreground">No evidence resolution actions.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {status.evidenceResolution.items.map(item => (
                <div
                  key={`${item.evidenceId}-${item.targetName}`}
                  className="rounded-md border border-border bg-surface p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-text-primary">{item.evidenceId}</span>
                    <Badge variant={item.requiresApproval ? 'destructive' : 'secondary'}>
                      {item.resolver} · {item.targetKind}
                    </Badge>
                  </div>
                  <div className="mt-2 font-medium text-text-primary">{item.targetName}</div>
                  <div className="mt-1 text-muted-foreground">{item.nextAction}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{waiverTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {status.graphWaiverIds.length === 0 ? (
            <div className="text-sm text-muted-foreground">No graph waivers.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {status.graphWaiverIds.map(waiverId => (
                <WaiverRow key={waiverId} waiverId={waiverId} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <HandoffNarrative status={status} />
    </>
  );
}

function RouteResult({ route }: { route: AcoRouteResponse }): React.ReactElement {
  return (
    <div className="rounded-md border border-border bg-surface p-3 text-sm">
      <div className="font-medium text-text-primary">{route.label}</div>
      <div className="mt-1 text-muted-foreground">{route.rationale}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {route.steps.map(step => (
          <Badge key={step} variant="secondary">
            {step}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function CompileResult({
  result,
  cwd,
}: {
  result: AcoCompileResponse;
  cwd: string;
}): React.ReactElement {
  const packageUrl = `/api/aco/artifact-packages/${encodeURIComponent(
    result.runId
  )}?cwd=${encodeURIComponent(cwd)}`;
  return (
    <div className="rounded-md border border-border bg-surface p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-medium text-text-primary">Context package created</div>
          <div className="mt-1 font-mono text-xs text-muted-foreground">{result.runId}</div>
          <div className="mt-1 font-mono text-xs text-muted-foreground">
            {result.contextIntent.intentHash}
          </div>
        </div>
        <Badge variant={result.approvalRequired ? 'destructive' : 'default'}>
          {result.approvalRequired ? 'Needs approval' : 'Ready'}
        </Badge>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <Metric label="route" value={result.route.label} />
        <Metric label="blockers" value={String(result.evidenceBlockers.length)} />
        <Metric label="closure actions" value={String(result.evidenceResolution.items.length)} />
        <Metric label="next decision" value={formatNextDecisionKind(result.nextDecision)} />
        <Metric label="archive" value={result.archivePath} />
      </div>
      <a className="mt-3 inline-flex text-sm text-primary underline" href={packageUrl}>
        Artifact package
      </a>
    </div>
  );
}

function NextDecisionPanel({ status }: { status: AcoStatusResponse }): React.ReactElement {
  const decision = status.nextDecision;
  if (!hasSupportedNextDecisionSchema(decision)) {
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Next Decision</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                Unsupported decision schema. Review ACO status manually before taking action.
              </p>
            </div>
            <Badge variant="destructive">manual fallback</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="rounded-md border border-border bg-surface p-3">
            <div className="text-sm font-medium text-text-primary">Review ACO status manually</div>
            <div className="mt-1 text-xs text-muted-foreground">
              manual · willRun=false · approval=no
            </div>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <Metric label="schema" value={decision.schemaVersion} />
            <Metric label="waivers" value="unknown" />
            <Metric label="blockers" value="unknown" />
          </div>
        </CardContent>
      </Card>
    );
  }
  const action = decision.primaryAction;
  const approvalContract = getApprovalContract(action.payload);
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Next Decision</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">{decision.summary}</p>
          </div>
          <Badge variant={action.requiresApproval ? 'destructive' : 'secondary'}>
            {decision.kind}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="rounded-md border border-border bg-surface p-3">
          <div className="text-sm font-medium text-text-primary">{action.label}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {action.kind} · willRun={String(action.willRun)} · approval=
            {action.requiresApproval ? 'yes' : 'no'}
          </div>
        </div>
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <Metric label="schema" value={decision.schemaVersion} />
          <Metric label="waivers" value={String(decision.waiverIds.length)} />
          <Metric label="blockers" value={String(decision.evidenceBlockerIds.length)} />
          {approvalContract ? (
            <>
              <Metric label="contract" value={approvalContract.contractId} />
              <Metric label="contract hash" value={approvalContract.contractHash} />
              <Metric label="scope" value={approvalContract.approvalScope.summary} />
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function getApprovalContract(payload: unknown): {
  schemaVersion: string;
  contractId: string;
  contractHash: string;
  approvalScope: { summary: string };
} | null {
  if (payload === null || typeof payload !== 'object') return null;
  const value = payload as Record<string, unknown>;
  const approvalScope = value.approvalScope;
  if (
    value.schemaVersion !== 'aco.approval-contract.v1' ||
    typeof value.contractId !== 'string' ||
    typeof value.contractHash !== 'string' ||
    approvalScope === null ||
    typeof approvalScope !== 'object' ||
    typeof (approvalScope as Record<string, unknown>).summary !== 'string'
  ) {
    return null;
  }
  return {
    schemaVersion: value.schemaVersion,
    contractId: value.contractId,
    contractHash: value.contractHash,
    approvalScope: { summary: (approvalScope as Record<string, string>).summary },
  };
}

function hasSupportedNextDecisionSchema(decision: AcoStatusResponse['nextDecision']): boolean {
  return (
    (decision as { schemaVersion?: string }).schemaVersion === supportedNextDecisionSchemaVersion
  );
}

function formatNextDecisionKind(decision: AcoCompileResponse['nextDecision']): string {
  if (!hasSupportedNextDecisionSchema(decision)) return 'manual fallback';
  return decision.kind;
}

function InlineError({ message }: { message: string }): React.ReactElement {
  return <div className="text-sm text-destructive">{message}</div>;
}

function LedgerSection({
  title,
  section,
}: {
  title: string;
  section: AcoStatusResponse['ledgerSummary']['combined'];
}): React.ReactElement {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-text-primary">{title}</span>
        <span className="font-mono text-xs text-muted-foreground">total {section.total}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {acoLedgerCountOrder.map(status => (
          <div key={status} className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">{status}</span>
            <span className="font-mono text-text-primary">{section.counts[status]}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        approval rows are confidence guardrails
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-mono text-sm text-text-primary" title={value}>
        {value}
      </div>
    </div>
  );
}

function WaiverRow({ waiverId }: { waiverId: string }): React.ReactElement {
  const [copied, setCopied] = useState(false);

  function copyWaiver(): void {
    void navigator.clipboard.writeText(waiverId).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 1500);
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2">
      <span className="min-w-0 truncate font-mono text-sm text-text-primary" title={waiverId}>
        {waiverId}
      </span>
      <Button variant="ghost" size="sm" className="h-8 px-2" onClick={copyWaiver}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

function HandoffNarrative({ status }: { status: AcoStatusResponse }): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const narrative = formatAcoHandoffNarrative(status);

  function copyNarrative(): void {
    void navigator.clipboard.writeText(narrative).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 1500);
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Handoff</CardTitle>
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={copyNarrative}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <pre className="whitespace-pre-wrap rounded-md border border-border bg-surface p-3 text-xs text-text-primary">
          {narrative}
        </pre>
      </CardContent>
    </Card>
  );
}

function EmptyState(): React.ReactElement {
  return (
    <Card>
      <CardContent className="flex min-h-48 flex-col items-center justify-center gap-2 text-center">
        <ShieldCheck className="h-10 w-10 text-muted-foreground" />
        <div className="text-sm font-medium text-text-primary">No project selected</div>
        <div className="max-w-md text-sm text-muted-foreground">
          Select a registered project to view Context Orchestrator status.
        </div>
      </CardContent>
    </Card>
  );
}

function ErrorState({ message }: { message: string }): React.ReactElement {
  return (
    <Card>
      <CardContent className="flex min-h-48 flex-col items-center justify-center gap-2 text-center">
        <TriangleAlert className="h-10 w-10 text-destructive" />
        <div className="text-sm font-medium text-text-primary">
          Context Orchestrator unavailable
        </div>
        <div className="max-w-xl text-sm text-muted-foreground">{message}</div>
      </CardContent>
    </Card>
  );
}
