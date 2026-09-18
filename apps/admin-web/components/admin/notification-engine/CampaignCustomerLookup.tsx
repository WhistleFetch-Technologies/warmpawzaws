'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api-client';

export type CampaignCustomerHit = {
  id: string;
  full_name: string;
  phone: string;
  created_at: string;
  has_active_token?: boolean;
};

function mergeIds(existing: string, ids: string[]): string {
  const current = existing
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const next = [...current];
  for (const id of ids) {
    if (!next.includes(id)) next.push(id);
  }
  return next.join(', ');
}

function removeIds(existing: string, ids: string[]): string {
  const drop = new Set(ids);
  return existing
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((id) => id && !drop.has(id))
    .join(', ');
}

/**
 * Search customers by name, phone, or UUID (optional signup date range)
 * and write selected ids into the Specific Users field.
 */
export function CampaignCustomerLookup({
  userIdsText,
  onUserIdsText,
}: {
  userIdsText: string;
  onUserIdsText: (value: string) => void;
}) {
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<CampaignCustomerHit[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const search = async () => {
    setError('');
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await apiClient.get<{ customers?: CampaignCustomerHit[]; error?: string }>(
        `/admin/notifications/customer-lookup?${params.toString()}`
      );
      const list = res.customers || [];
      setRows(list);
      setSelected([]);
      if (!list.length) setError('No customers matched');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lookup failed';
      setError(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const applySelection = (next: string[]) => {
    const removed = selected.filter((id) => !next.includes(id));
    const added = next.filter((id) => !selected.includes(id));
    let text = userIdsText;
    if (removed.length) text = removeIds(text, removed);
    if (added.length) text = mergeIds(text, added);
    setSelected(next);
    onUserIdsText(text);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-3">
      <p className="text-sm font-medium text-gray-800">Find customers</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input
          className="border rounded-lg px-3 py-2 text-sm"
          placeholder="Name, phone, or UUID"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <input
          type="date"
          className="border rounded-lg px-3 py-2 text-sm"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          aria-label="Signed up from"
        />
        <input
          type="date"
          className="border rounded-lg px-3 py-2 text-sm"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          aria-label="Signed up to"
        />
      </div>
      <button
        type="button"
        onClick={() => void search()}
        disabled={loading || (!q.trim() && !from && !to)}
        className="px-3 py-1.5 bg-white border rounded-lg text-sm disabled:opacity-50"
      >
        {loading ? 'Searching…' : 'Search'}
      </button>
      {error ? <p className="text-xs text-amber-700">{error}</p> : null}
      {rows.length > 0 ? (
        <div className="max-h-48 overflow-y-auto border rounded-lg bg-white divide-y">
          {rows.map((row) => {
            const checked = selected.includes(row.id);
            return (
              <label key={row.id} className="flex items-start gap-2 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checked}
                  onChange={() => {
                    const next = checked
                      ? selected.filter((id) => id !== row.id)
                      : [...selected, row.id];
                    applySelection(next);
                  }}
                />
                <span>
                  <span className="font-medium text-gray-900">{row.full_name || 'Unnamed'}</span>
                  <span className="text-gray-500"> · {row.phone || 'no phone'}</span>
                  <span className="block font-mono text-[11px] text-gray-500">{row.id}</span>
                  <span className="text-[11px] text-gray-400">
                    signed up {String(row.created_at || '').slice(0, 10)}
                    {row.has_active_token ? ' · active push token' : ' · no active token'}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
