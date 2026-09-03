'use client';

import React, { useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
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
import { Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { downloadCsv } from '@/lib/marketing-analytics/format';
import type { CommercialCampaignRecord, CampaignLifecycleStatus } from '@/lib/commercial-campaign/types';
import { CAMPAIGN_LIFECYCLE_LABELS } from '@/lib/commercial-campaign/types';
import { CampaignStatusBadge } from './CampaignStatusBadge';

const PAGE_SIZE = 10;

type SortKey = 'name' | 'updatedAt' | 'status' | 'campaignType';

export function CampaignList({
  campaigns,
  onSelect,
  onBulkArchive,
}: {
  campaigns: CommercialCampaignRecord[];
  onSelect: (c: CommercialCampaignRecord) => void;
  onBulkArchive?: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let rows = [...campaigns];
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.campaignType.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      rows = rows.filter((c) => c.status === statusFilter);
    }
    rows.sort((a, b) => {
      const av = sortKey === 'name' ? a.name : sortKey === 'status' ? a.status : sortKey === 'campaignType' ? a.campaignType : a.updatedAt;
      const bv = sortKey === 'name' ? b.name : sortKey === 'status' ? b.status : sortKey === 'campaignType' ? b.campaignType : b.updatedAt;
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [campaigns, query, statusFilter, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleAll = () => {
    if (selected.size === pageRows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pageRows.map((r) => r.id)));
    }
  };

  const exportCsv = () => {
    downloadCsv(
      'commercial-campaigns.csv',
      ['Name', 'Type', 'Status', 'Funding', 'Schedule', 'Updated'],
      filtered.map((c) => [
        c.name,
        c.campaignType,
        c.status,
        c.funding.type,
        c.scheduleType,
        c.updatedAt,
      ])
    );
  };

  const formatSchedule = (c: CommercialCampaignRecord) => {
    if (c.scheduleType === 'immediate') return 'Immediate';
    const start = c.startAt ? new Date(c.startAt).toLocaleDateString() : '—';
    const end = c.endAt ? new Date(c.endAt).toLocaleDateString() : '—';
    return `${start} → ${end}`;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search campaigns…"
            value={query}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            className="max-w-xs"
            aria-label="Search campaigns"
          />
          <Select
            value={statusFilter}
            onValueChange={(v: string) => {
              setStatusFilter(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-40 bg-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(CAMPAIGN_LIFECYCLE_LABELS) as CampaignLifecycleStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {CAMPAIGN_LIFECYCLE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortKey} onValueChange={(v: string) => setSortKey(v as SortKey)}>
            <SelectTrigger className="w-40 bg-white">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updatedAt">Last updated</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="campaignType">Type</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}>
            {sortDir === 'asc' ? 'Asc' : 'Desc'}
          </Button>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && onBulkArchive ? (
            <Button type="button" size="sm" variant="outline" onClick={() => onBulkArchive([...selected])}>
              Archive selected ({selected.size})
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-1.5 h-4 w-4" aria-hidden />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <Table>
          <TableHeader className="sticky top-0 bg-slate-50">
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={pageRows.length > 0 && selected.size === pageRows.length}
                  onCheckedChange={toggleAll}
                  aria-label="Select all on page"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Funding</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Audience</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-slate-500">
                  No campaigns match your filters
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((c) => (
                <TableRow key={c.id} className="hover:bg-slate-50">
                  <TableCell>
                    <Checkbox
                      checked={selected.has(c.id)}
                      onCheckedChange={(checked: boolean) => {
                        const next = new Set(selected);
                        if (checked) next.add(c.id);
                        else next.delete(c.id);
                        setSelected(next);
                      }}
                      aria-label={`Select ${c.name}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.campaignType}</TableCell>
                  <TableCell>
                    <CampaignStatusBadge status={c.status} />
                  </TableCell>
                  <TableCell>{c.funding.type}</TableCell>
                  <TableCell className="text-xs">{formatSchedule(c)}</TableCell>
                  <TableCell className="text-xs">{c.audience.kind}</TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {new Date(c.updatedAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Button type="button" size="sm" variant="ghost" onClick={() => onSelect(c)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          {filtered.length} campaign{filtered.length === 1 ? '' : 's'}
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
