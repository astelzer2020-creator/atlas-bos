'use client';

import { Badge } from '@atlas/ui';

export interface DataTableColumn<T> {
  readonly key: string;
  readonly header: string;
  readonly cell: (row: T) => React.ReactNode;
  readonly className?: string;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  onRowClick,
}: {
  columns: readonly DataTableColumn<T>[];
  data: readonly T[];
  onRowClick?: (row: T) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[640px] text-left text-body-sm">
        <thead>
          <tr className="border-b border-border bg-subtle/60">
            {columns.map((column) => (
              <th
                key={column.key}
                className="px-4 py-3 text-label-sm font-medium text-foreground-secondary"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={row.id}
              className={`border-b border-border last:border-b-0 ${onRowClick ? 'cursor-pointer hover:bg-subtle/40' : ''}`}
              onClick={onRowClick ? () => { onRowClick(row); } : undefined}
            >
              {columns.map((column) => (
                <td key={column.key} className={`px-4 py-3 text-foreground-primary ${column.className ?? ''}`}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase().replace(/_/g, ' ');
  const variant =
    ['active', 'open', 'published', 'enabled', 'completed', 'posted', 'approved', 'done'].some((s) =>
      normalized.includes(s),
    )
      ? 'success'
      : ['draft', 'pending', 'planning', 'running', 'waiting', 'init'].some((s) => normalized.includes(s))
        ? 'warning'
        : ['failed', 'cancelled', 'rejected', 'lost', 'archived', 'inactive'].some((s) =>
              normalized.includes(s),
            )
          ? 'error'
          : 'neutral';

  return (
    <Badge variant={variant} className="capitalize">
      {normalized}
    </Badge>
  );
}