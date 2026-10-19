'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Input, Label } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import {
  activeVendorLabel,
  activeVendorRole,
  fetchAllActiveVendors,
  filterActiveVendors,
  type ActiveVendorHit,
} from './vendor-active-list';

export function VendorMultiPicker({
  label,
  ids,
  names,
  onChange,
}: {
  label: string;
  ids: string[];
  names: string[];
  onChange: (ids: string[], names: string[]) => void;
}) {
  const [q, setQ] = useState('');
  const [vendors, setVendors] = useState<ActiveVendorHit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchAllActiveVendors((url) => apiClient.get(url))
      .then((rows) => {
        if (!cancelled) setVendors(rows);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load active vendors');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hits = useMemo(() => filterActiveVendors(vendors, q), [vendors, q]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {ids.map((id, i) => (
          <button
            key={id}
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-[#FF8C42] bg-orange-50 px-3 py-1 text-sm text-[#FF8C42]"
            onClick={() => {
              onChange(
                ids.filter((x) => x !== id),
                names.filter((_, idx) => ids[idx] !== id)
              );
            }}
          >
            {names[i] || id}
            <span aria-hidden>×</span>
          </button>
        ))}
      </div>
      <Input
        value={q}
        placeholder="Filter active vendors"
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
        className="min-h-11"
      />
      <p className="text-xs text-slate-500">
        {loading
          ? 'Loading active vendors…'
          : error
            ? error
            : `${hits.length} of ${vendors.length} active vendors`}
      </p>
      {hits.length ? (
        <ul className="max-h-72 overflow-y-auto rounded-lg border bg-white text-sm">
          {hits.map((v) => {
            const name = activeVendorLabel(v);
            const already = ids.includes(v.id);
            return (
              <li key={v.id}>
                <button
                  type="button"
                  disabled={already}
                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-40"
                  onClick={() => onChange([...ids, v.id], [...names, name])}
                >
                  <span>{name}</span>
                  <span className="text-xs text-slate-500">{already ? 'Added' : activeVendorRole(v)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
