import {
  CheckCircle2,
  FileMinus2,
  FilePenLine,
  FilePlus2,
  FileQuestion,
  XCircle,
} from 'lucide-react';
import type { PatchChangeKind, PatchEventDisplay } from '@/lib/types';
import { cn } from '@/lib/utils';

function kindLabel(kind: PatchChangeKind): string {
  switch (kind) {
    case 'add':
      return 'add';
    case 'delete':
      return 'delete';
    case 'update':
      return 'update';
    default:
      return 'unknown';
  }
}

function KindIcon({ kind }: { kind: PatchChangeKind }): React.ReactElement {
  switch (kind) {
    case 'add':
      return <FilePlus2 className="h-3.5 w-3.5 text-success" />;
    case 'delete':
      return <FileMinus2 className="h-3.5 w-3.5 text-error" />;
    case 'update':
      return <FilePenLine className="h-3.5 w-3.5 text-primary" />;
    default:
      return <FileQuestion className="h-3.5 w-3.5 text-text-tertiary" />;
  }
}

export function PatchEventCard({ event }: { event: PatchEventDisplay }): React.ReactElement {
  const failed = event.status === 'failed';
  const title =
    event.status === 'failed'
      ? 'File changes failed'
      : event.status === 'applied'
        ? 'File changes applied'
        : 'File changes pending';
  const changes = event.changes.length > 0 ? event.changes : [{ kind: event.kind ?? 'unknown' }];

  return (
    <div
      className={cn(
        'rounded-lg border bg-surface px-3 py-2 text-xs',
        failed ? 'border-error/40' : 'border-border'
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        {failed ? (
          <XCircle className="h-4 w-4 text-error" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-success" />
        )}
        <span className="font-medium text-text-primary">{title}</span>
        <span className="ml-auto text-[10px] uppercase text-text-tertiary">{event.provider}</span>
      </div>
      <div className="space-y-1">
        {changes.map((change, index) => (
          <div key={`${change.path ?? 'unknown'}-${String(index)}`} className="flex gap-2">
            <KindIcon kind={change.kind} />
            <span className="w-12 shrink-0 text-text-tertiary">{kindLabel(change.kind)}</span>
            <span className="min-w-0 flex-1 truncate font-mono text-text-secondary">
              {change.path ?? event.path ?? '(unknown file)'}
            </span>
          </div>
        ))}
      </div>
      {event.error && <div className="mt-2 text-error">{event.error}</div>}
    </div>
  );
}
