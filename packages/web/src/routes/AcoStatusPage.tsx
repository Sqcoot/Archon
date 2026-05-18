import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useProject } from '@/contexts/ProjectContext';
import { getAcoStatus } from '@/lib/api';
import type { AcoStatusResponse } from '@/lib/api';
import {
  acoLedgerCountOrder,
  formatAcoHandoffNarrative,
  getAcoReadinessLabel,
} from '@/lib/aco-readiness';

// AC-ACO-STATUS-004: the page uses selectedProject.default_cwd and has a no-project empty state.
// AC-ACO-STATUS-005: ACO Status is the primary label; Context Readiness is supporting copy.
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
      <Header title="ACO Status" subtitle={selectedProject?.default_cwd} />
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
  const readiness = getAcoReadinessLabel(status);
  const badgeVariant = readiness.startsWith('Blocked') ? 'destructive' : 'default';
  const graphLimitLabel =
    status.graphStatus === 'forbidden' ? 'forbidden graph limits' : 'accepted graph limits';
  const waiverTitle =
    status.graphStatus === 'forbidden'
      ? 'Forbidden Graph Confidence Limits'
      : 'Accepted Confidence Limits';

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
            <Metric label="graph" value={status.graphStatus} />
            <Metric label="waivers" value={String(status.graphWaivers)} />
            <Metric label="schema" value={status.ledgerSchemaVersion} />
          </div>
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
        forbidden rows are confidence or approval guardrails
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

// AC-P3-PR: PR/handoff narrative reuses the same ACO status evidence and known-limits copy.
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
          <CardTitle>PR/Handoff Narrative</CardTitle>
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
          Select a registered project to view ACO Status.
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
        <div className="text-sm font-medium text-text-primary">ACO Status unavailable</div>
        <div className="max-w-xl text-sm text-muted-foreground">{message}</div>
      </CardContent>
    </Card>
  );
}
