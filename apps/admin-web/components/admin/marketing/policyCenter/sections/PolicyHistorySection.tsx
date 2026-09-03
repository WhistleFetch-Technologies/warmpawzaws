'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Input, Badge, Button } from '@warmpawz/ui';
import { Search, Undo2 } from 'lucide-react';
import { fetchPolicyHistory, rollbackPolicy } from '@/lib/discount-policy/discount-policy-api';
import { ComingSoonPanel } from '../shared/ApiPendingBanner';
import type { PolicyHistoryEntry } from '@/lib/discount-policy/types';

export function PolicyHistorySection() {
  const [history, setHistory] = useState<PolicyHistoryEntry[] | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setHistory(await fetchPolicyHistory());
      setLoading(false);
    })();
  }, []);

  const filtered =
    history?.filter(
      (h) =>
        !query ||
        h.version.includes(query) ||
        h.policyFingerprint.includes(query) ||
        (h.publishedBy ?? '').toLowerCase().includes(query.toLowerCase())
    ) ?? [];

  if (history === null && !loading) {
    return (
      <ComingSoonPanel
        title="Policy history not available"
        description="Version history, diff, and rollback targets require GET /admin/discount-policy/history (Phase 8)."
        apiPath="GET /admin/discount-policy/history"
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Policy history</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input
            className="pl-9"
            placeholder="Search version, fingerprint, publisher…"
            value={query}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
            aria-label="Search policy history"
          />
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading history…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-500">No published policy versions yet.</p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">v{entry.version}</span>
                    {entry.rollbackAvailable ? (
                      <Badge variant="outline">Rollback available</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 font-mono text-xs text-slate-600">{entry.policyFingerprint}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {entry.publishedBy ?? 'System'} · {new Date(entry.publishedAt).toLocaleString()}
                  </p>
                  {entry.summary ? <p className="mt-1 text-sm text-slate-600">{entry.summary}</p> : null}
                </div>
                {entry.rollbackAvailable ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void rollbackPolicy(entry.id)}
                  >
                    <Undo2 className="mr-1.5 h-4 w-4" aria-hidden />
                    Rollback
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
