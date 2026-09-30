'use client';

import React, { useEffect, useState } from 'react';
import { Input, Label } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';

type VendorHit = { id: string; business_name?: string; businessName?: string; role_display_name?: string };

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
  const [hits, setHits] = useState<VendorHit[]>([]);
  useEffect(() => {
    const t = window.setTimeout(() => {
      const query = q.trim();
      if (query.length < 2) {
        setHits([]);
        return;
      }
      void apiClient
        .get<{ vendors?: VendorHit[] }>(`/admin/vendors?q=${encodeURIComponent(query)}&limit=20`)
        .then((res) => setHits(Array.isArray(res.vendors) ? res.vendors : []))
        .catch(() => setHits([]));
    }, 250);
    return () => window.clearTimeout(t);
  }, [q]);

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
        placeholder="Search business name to add"
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
        className="min-h-11"
      />
      {hits.length ? (
        <ul className="max-h-40 overflow-y-auto rounded-lg border bg-white text-sm">
          {hits.map((v) => {
            const name = v.business_name || v.businessName || v.id;
            const already = ids.includes(v.id);
            return (
              <li key={v.id}>
                <button
                  type="button"
                  disabled={already}
                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-40"
                  onClick={() => {
                    onChange([...ids, v.id], [...names, name]);
                    setQ('');
                    setHits([]);
                  }}
                >
                  <span>{name}</span>
                  <span className="text-xs text-slate-500">{already ? 'Added' : v.role_display_name || ''}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
