'use client';

import React, { useMemo, useState } from 'react';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@warmpawz/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { filterPromoEngineRows } from '@/lib/promo-engine/draft';
import { canTransition } from '@/lib/promo-engine/status';
import { labelsForCatalogSlugs } from '@/lib/promo-engine/catalog-categories';
import { useCatalogServiceCategories } from '@/lib/promo-engine/use-catalog-categories';
import {
  PROMO_ENGINE_STATUSES,
  RULE_TYPES,
  type PromoEngineListItem,
  type PromoEngineStatus,
} from '@/lib/promo-engine/types';
import { PromotionEngineStatusBadge } from './PromotionEngineStatusBadge';

const PAGE_SIZE = 10;

export function PromotionEngineList({
  rows,
  loading = false,
  onCreate,
  onEdit,
  onStatusChange,
  onFiltersChange,
}: {
  rows: PromoEngineListItem[];
  loading?: boolean;
  onCreate: () => void;
  onEdit: (id: string) => void;
  onStatusChange: (id: string, status: PromoEngineStatus) => void;
  onFiltersChange?: (filters: { query: string; status: string; service: string }) => void;
}) {
  const { categories } = useCatalogServiceCategories();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [service, setService] = useState('all');
  const [type, setType] = useState('all');
  const [page, setPage] = useState(0);

  const emitFilters = (next: { query?: string; status?: string; service?: string }) => {
    onFiltersChange?.({
      query: next.query ?? query,
      status: next.status ?? status,
      service: next.service ?? service,
    });
  };

  const filtered = useMemo(
    () => filterPromoEngineRows(rows, { query, status, service, type }),
    [rows, query, status, service, type],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Input
            placeholder="Search promotions…"
            value={query}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setQuery(e.target.value);
              setPage(0);
              emitFilters({ query: e.target.value });
            }}
            className="min-h-11"
            aria-label="Search engine promotions"
          />
          <Select
            value={status}
            onValueChange={(v: string) => {
              setStatus(v);
              setPage(0);
              emitFilters({ status: v });
            }}
          >
            <SelectTrigger className="min-h-11 bg-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {PROMO_ENGINE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={service}
            onValueChange={(v: string) => {
              setService(v);
              setPage(0);
              emitFilters({ service: v });
            }}
          >
            <SelectTrigger className="min-h-11 bg-white">
              <SelectValue placeholder="Service" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All services</SelectItem>
              {categories.map((s) => (
                <SelectItem key={s.slug} value={s.slug}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={type}
            onValueChange={(v: string) => {
              setType(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="min-h-11 bg-white">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {RULE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t === 'CUSTOMER_JOURNEY' ? 'Journey' : 'Generic'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" onClick={onCreate} className="min-h-11 shrink-0">
          Create promotion
        </Button>
      </div>

      <div className="space-y-3 md:hidden">
        {pageRows.length === 0 ? (
          <div className="rounded-2xl border bg-white px-4 py-10 text-center text-slate-500">
            {loading
              ? 'Loading promotions…'
              : rows.length === 0
                ? 'No engine promotions yet. Create one to start.'
                : 'No promotions match your filters'}
          </div>
        ) : (
          pageRows.map((row) => (
            <article key={row.id} className="space-y-3 rounded-2xl border bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{row.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{row.code || '—'}</p>
                </div>
                <PromotionEngineStatusBadge status={row.status} />
              </div>
              <p className="text-sm text-slate-600">
                {labelsForCatalogSlugs(row.serviceCategories, categories) || 'No service'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => onEdit(row.id)}>
                  Edit
                </Button>
                {canTransition(row.status, 'PAUSED') ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => onStatusChange(row.id, 'PAUSED')}>
                    Pause
                  </Button>
                ) : null}
                {canTransition(row.status, 'ACTIVE') ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => onStatusChange(row.id, 'ACTIVE')}>
                    Activate
                  </Button>
                ) : null}
                {canTransition(row.status, 'ARCHIVED') ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => onStatusChange(row.id, 'ARCHIVED')}>
                    Archive
                  </Button>
                ) : null}
              </div>
            </article>
          ))
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border bg-white md:block">
        <Table>
          <TableHeader className="sticky top-0 bg-slate-50">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-slate-500">
                  {loading
                    ? 'Loading promotions…'
                    : rows.length === 0
                      ? 'No engine promotions yet. Create one to start.'
                      : 'No promotions match your filters'}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row) => (
                <TableRow key={row.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-xs text-slate-500">{row.code || '—'}</TableCell>
                  <TableCell>
                    <PromotionEngineStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="text-xs">
                    {labelsForCatalogSlugs(row.serviceCategories, categories) || '—'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.ruleType === 'CUSTOMER_JOURNEY' ? 'Journey' : 'Generic'}
                  </TableCell>
                  <TableCell className="text-xs">{row.usageCount}</TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Button type="button" size="sm" variant="ghost" onClick={() => onEdit(row.id)}>
                        Edit
                      </Button>
                      {canTransition(row.status, 'PAUSED') ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => onStatusChange(row.id, 'PAUSED')}
                        >
                          Pause
                        </Button>
                      ) : null}
                      {canTransition(row.status, 'ACTIVE') ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => onStatusChange(row.id, 'ACTIVE')}
                        >
                          Activate
                        </Button>
                      ) : null}
                      {canTransition(row.status, 'ARCHIVED') ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => onStatusChange(row.id, 'ARCHIVED')}
                        >
                          Archive
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          {filtered.length} promotion{filtered.length === 1 ? '' : 's'}
        </span>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <span>
            Page {page + 1} / {pageCount}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page >= pageCount - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
