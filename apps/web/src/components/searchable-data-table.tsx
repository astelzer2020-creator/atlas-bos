'use client';

import * as React from 'react';
import { Button, Input } from '@atlas/ui';

import { DataTable, type DataTableColumn } from '@/components/data-table';

export interface SearchableDataTableProps<T extends { id: string }> {
  readonly columns: readonly DataTableColumn<T>[];
  readonly data: readonly T[];
  readonly searchPlaceholder?: string;
  readonly searchKeys: readonly ((row: T) => string)[];
  readonly pageSize?: number;
  readonly onRowClick?: (row: T) => void;
  readonly emptyMessage?: string;
}

export function SearchableDataTable<T extends { id: string }>({
  columns,
  data,
  searchPlaceholder = 'Search...',
  searchKeys,
  pageSize = 10,
  onRowClick,
  emptyMessage = 'No results match your search.',
}: SearchableDataTableProps<T>) {
  const [query, setQuery] = React.useState('');
  const [page, setPage] = React.useState(0);

  const filtered = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return data;
    }
    return data.filter((row) =>
      searchKeys.some((keyFn) => keyFn(row).toLowerCase().includes(normalized)),
    );
  }, [data, query, searchKeys]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pageData = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  React.useEffect(() => {
    setPage(0);
  }, [query, data.length]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          label="Search"
          hideLabel
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value); }}
          aria-label="Search table"
          className="max-w-sm"
        />
        <p className="text-body-sm text-foreground-tertiary">
          {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
        </p>
      </div>

      {pageData.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-body-sm text-foreground-secondary">
          {emptyMessage}
        </p>
      ) : (
        <DataTable
          columns={columns}
          data={pageData}
          {...(onRowClick !== undefined ? { onRowClick } : {})}
        />
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={currentPage === 0}
            onClick={() => { setPage((p) => Math.max(0, p - 1)); }}
          >
            Previous
          </Button>
          <span className="text-body-sm text-foreground-secondary">
            Page {currentPage + 1} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={currentPage >= totalPages - 1}
            onClick={() => { setPage((p) => Math.min(totalPages - 1, p + 1)); }}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}