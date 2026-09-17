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
import {
  PROMO_ENGINE_STATUSES,
  RULE_TYPES,
  SERVICE_CATEGORIES,
  type PromoEngineListItem,
  type PromoEngineStatus,
} from '@/lib/promo-engine/types';
import { PromotionEngineStatusBadge } from './PromotionEngineStatusBadge';

const PAGE_SIZE = 10;

export function PromotionEngineList({
  rows,
  onCreate,
  onEdit,
  onStatusChange,
}: {
  rows: PromoEngineListItem[];
  onCreate: () => void;
  onEdit: (id: string) => void;
  onStatusChange: (id: string, status: PromoEngineStatus) => void;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [service, setService] = useState('all');
  const [type, setType] = useState('all');
  const [page, setPage] = useState(0);

  const filtered = useMemo(
    () => filterPromoEngineRows(rows, { query, status, service, type }),
    [rows, query, status, service, type],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search promotions…"
            value={query}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            className="max-w-xs"
            aria-label="Search engine promotions"
          />
          <Select
            value={status}
            onValueChange={(v: string) => {
              setStatus(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-40 bg-white">
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
            }}
          >
            <SelectTrigger className="w-40 bg-white">
              <SelectValue placeholder="Service" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All services</SelectItem>
              {SERVICE_CATEGORIES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
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
            <SelectTrigger className="w-44 bg-white">
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
        <Button type="button" onClick={onCreate}>
          Create promotion
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
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
                  {rows.length === 0
                    ? 'No engine promotions yet. Create a draft, or wait for Abhi CRUD to load from RDS.'
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
                  <TableCell className="text-xs">{row.serviceCategories.join(', ') || '—'}</TableCell>
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
