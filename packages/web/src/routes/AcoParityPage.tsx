import { useQuery } from '@tanstack/react-query';
import type {
  ApiUiCoverageStatus,
  ApiUiParityBundle,
  ApiUiRemainingGate,
  ApiUiSurfaceContract,
  ApiUiWorkflowCoverage,
} from '@archon/aco-api-ui';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  PackageCheck,
  RefreshCw,
  Route,
  ShieldAlert,
  Terminal,
  Workflow,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAcoParity } from '@/lib/api';
import { cn } from '@/lib/utils';

const statusClass: Record<ApiUiCoverageStatus, string> = {
  committed: 'border-success/30 bg-success/15 text-success',
  deferred: 'border-warning/30 bg-warning/15 text-warning',
  'approval-gated': 'border-warning/30 bg-warning/15 text-warning',
};

function formatStatus(status: string): string {
  return status.replace(/-/g, ' ');
}

function StatusBadge({ status }: { status: ApiUiCoverageStatus }): React.ReactElement {
  return (
    <Badge variant="outline" className={cn('capitalize', statusClass[status])}>
      {formatStatus(status)}
    </Badge>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = 'neutral',
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone?: 'neutral' | 'success' | 'warning';
}): React.ReactElement {
  return (
    <div className="min-w-0 rounded-md border border-border bg-surface px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-xs text-text-secondary">
        <Icon
          className={cn(
            'h-4 w-4 shrink-0',
            tone === 'success' && 'text-success',
            tone === 'warning' && 'text-warning'
          )}
        />
        <span className="truncate">{label}</span>
      </div>
      <div className="truncate text-lg font-semibold text-text-primary">{value}</div>
    </div>
  );
}

function PackageCoverage({ bundle }: { bundle: ApiUiParityBundle }): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PackageCheck className="h-4 w-4 text-success" />
          Committed Packages
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {bundle.packageCoverage.map(item => (
            <div
              key={item.slice}
              className="min-w-0 rounded-md border border-border bg-surface-inset px-3 py-2"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-text-primary">
                  {item.slice}
                </span>
                <StatusBadge status={item.status} />
              </div>
              <div className="truncate text-sm font-medium text-text-primary">
                {item.packageName}
              </div>
              <div className="mt-1 line-clamp-2 text-xs text-text-secondary">
                {item.ownerSurface}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function WorkflowCoverage({
  workflows,
}: {
  workflows: readonly ApiUiWorkflowCoverage[];
}): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Workflow className="h-4 w-4 text-primary" />
          Workflow Parity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {workflows.map(workflow => (
            <div
              key={workflow.name}
              className="grid gap-2 rounded-md border border-border bg-surface-inset px-3 py-2 md:grid-cols-[minmax(0,1fr)_auto_auto]"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-text-primary">
                  {workflow.name}
                </div>
                <div className="truncate font-mono text-xs text-text-secondary">
                  {workflow.bundledDefaultFile}
                </div>
              </div>
              <div className="text-xs text-text-secondary">{workflow.nodeCount} nodes</div>
              <StatusBadge status={workflow.status} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function GateCoverage({ gates }: { gates: readonly ApiUiRemainingGate[] }): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-4 w-4 text-warning" />
          Remaining Gates
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {gates.map(gate => (
            <div
              key={gate.commandId}
              className="grid gap-2 rounded-md border border-border bg-surface-inset px-3 py-2 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_auto]"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-text-primary">{gate.display}</div>
                <div className="truncate font-mono text-xs text-text-secondary">
                  {gate.commandId}
                </div>
              </div>
              <div className="min-w-0 text-xs text-text-secondary">{gate.reason}</div>
              <StatusBadge status={gate.status} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SurfaceCoverage({
  surfaces,
}: {
  surfaces: readonly ApiUiSurfaceContract[];
}): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Route className="h-4 w-4 text-primary" />
          Public Surfaces
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 md:grid-cols-2">
          {surfaces.map(surface => (
            <div
              key={surface.id}
              className="min-w-0 rounded-md border border-border bg-surface-inset px-3 py-2"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-medium text-text-primary">
                  {surface.route}
                </span>
                <Badge variant="outline" className="border-success/30 bg-success/15 text-success">
                  read only
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-text-secondary">
                <div>
                  <span className="text-text-tertiary">Layer </span>
                  {surface.layer.toUpperCase()}
                </div>
                <div>
                  <span className="text-text-tertiary">Method </span>
                  {surface.method}
                </div>
                <div className="col-span-2 truncate">
                  <span className="text-text-tertiary">Produces </span>
                  {surface.produces.join(', ')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TerminalCriteria({ bundle }: { bundle: ApiUiParityBundle }): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Terminal className="h-4 w-4 text-success" />
          Terminal Criteria
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 lg:grid-cols-2">
          {bundle.terminalCriteria.map(item => (
            <div key={item} className="flex min-w-0 items-start gap-2 text-sm text-text-secondary">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function AcoParityPage(): React.ReactElement {
  const parityQuery = useQuery({
    queryKey: ['aco-parity'],
    queryFn: getAcoParity,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const bundle = parityQuery.data;
  const errorMessage =
    parityQuery.error instanceof Error ? parityQuery.error.message : 'Parity bundle unavailable.';

  return (
    <>
      <Header
        title="ACO Parity"
        projectName={bundle?.id ?? 'S10 terminal API/UI parity'}
        connected={parityQuery.isSuccess}
      />
      <div className="flex-1 overflow-auto p-6">
        {parityQuery.isLoading && (
          <div className="flex h-48 items-center justify-center text-sm text-text-secondary">
            Loading parity bundle...
          </div>
        )}

        {parityQuery.isError && (
          <Card className="mx-auto max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-error" />
                Parity Unavailable
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-text-secondary">{errorMessage}</p>
              <Button
                onClick={() => {
                  void parityQuery.refetch();
                }}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {bundle && (
          <div className="mx-auto flex max-w-7xl flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                icon={CheckCircle2}
                label="Readiness"
                value={formatStatus(bundle.readiness)}
                tone="success"
              />
              <Metric icon={PackageCheck} label="Committed slices" value="S1-S10" tone="success" />
              <Metric
                icon={Workflow}
                label="Workflow defaults"
                value={bundle.workflowCoverage.length}
              />
              <Metric
                icon={ShieldAlert}
                label="Remaining gates"
                value={bundle.remainingApprovalGates.length}
                tone="warning"
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <PackageCoverage bundle={bundle} />
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <GitBranch className="h-4 w-4 text-success" />
                      Terminal State
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <div className="text-xs text-text-tertiary">Bundle status</div>
                        <div className="mt-1 font-medium capitalize text-text-primary">
                          {formatStatus(bundle.status)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-text-tertiary">Next slice</div>
                        <div className="mt-1 font-mono text-text-primary">
                          {bundle.nextSlice ?? 'null'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-text-tertiary">Context next</div>
                        <div className="mt-1 font-mono text-text-primary">
                          {bundle.sourceTerminality.contextNextSlice}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-text-tertiary">Workflow next</div>
                        <div className="mt-1 font-mono text-text-primary">
                          {bundle.sourceTerminality.workflowNextSlice}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <SurfaceCoverage surfaces={bundle.surfaceContracts} />
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <WorkflowCoverage workflows={bundle.workflowCoverage} />
              <GateCoverage gates={bundle.remainingApprovalGates} />
            </div>

            <TerminalCriteria bundle={bundle} />
          </div>
        )}
      </div>
    </>
  );
}
