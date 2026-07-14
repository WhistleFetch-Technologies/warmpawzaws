'use client';

import { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Input,
  Button,
} from '@warmpawz/ui';
import { Download } from 'lucide-react';
import { downloadCsv } from '@/lib/marketing-analytics/format';

export function MetricTable<T extends Record<string, unknown>>({
  rows,
  columns,
  searchKeys,
  exportFilename,
  onRowClick,
  emptyLabel = 'No rows',
}: {
  rows: T[];
  columns: { key: keyof T & string; label: string; render?: (row: T) => React.ReactNode }[];
  searchKeys: (keyof T & string)[];
  exportFilename: string;
  onRowClick?: (row: T) => void;
  emptyLabel?: string;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      searchKeys.some((k) => String(row[k] ?? '').toLowerCase().includes(q))
    );
  }, [rows, query, searchKeys]);

  const exportRows = () => {
    downloadCsv(
      exportFilename,
      columns.map((c) => c.label),
      filtered.map((row) =>
        columns.map((c) => {
          const val = c.render ? String(c.render(row) ?? '') : String(row[c.key] ?? '');
          return val;
        })
      )
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
          aria-label="Search table"
        />
        <Button type="button" variant="outline" size="sm" onClick={exportRows}>
          <Download className="mr-1.5 h-4 w-4" aria-hidden />
          Export CSV
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <Table>
          <TableHeader className="sticky top-0 bg-slate-50">
            <TableRow>
              {columns.map((c) => (
                <TableHead key={String(c.key)}>{c.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-slate-500 py-8">
                  {emptyLabel}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row, i) => (
                <TableRow
                  key={i}
                  className={onRowClick ? 'cursor-pointer hover:bg-slate-50' : undefined}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((c) => (
                    <TableCell key={String(c.key)}>
                      {c.render ? c.render(row) : String(row[c.key] ?? '—')}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
