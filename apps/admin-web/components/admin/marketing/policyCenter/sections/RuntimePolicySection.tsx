'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '@warmpawz/ui';
import { Copy, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { fetchRuntimeDiagnostics } from '@/lib/discount-policy/discount-policy-api';
import {
  ensureBusinessRules,
  getApplicationStrategyLabel,
  getWinningStrategyLabel,
} from '@/lib/discount-policy/business-rules-mapper';
import { FEATURE_FLAG_LABELS } from '@/lib/discount-policy/option-registry';
import type { DiscountPolicyBundle, RuntimePolicyDiagnostics } from '@/lib/discount-policy/types';
import { CommercialHelpTooltip } from '@/components/admin/commercial-ai/CommercialHelpTooltip';

export function RuntimePolicySection({ draft }: { draft: DiscountPolicyBundle }) {
  const [diagnostics, setDiagnostics] = useState<Partial<RuntimePolicyDiagnostics> | null>(null);
  const [loading, setLoading] = useState(true);
  const rules = ensureBusinessRules(draft);

  const load = async () => {
    setLoading(true);
    try {
      setDiagnostics(await fetchRuntimeDiagnostics());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const fingerprint = diagnostics?.policyFingerprint;

  const copyFingerprint = async () => {
    if (!fingerprint) {
      toast.message('Fingerprint is computed on publish — not available in draft mode.');
      return;
    }
    await navigator.clipboard.writeText(fingerprint);
    toast.success('Fingerprint copied');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-1.5 text-lg">
            Active policy strategy
            <CommercialHelpTooltip glossaryId="runtime_policy" />
          </CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {[
            ['Discount application', getApplicationStrategyLabel(rules.applicationStrategy)],
            [
              'Winning offer strategy',
              rules.applicationStrategy === 'BEST_OFFER_ONLY' && rules.winningStrategy
                ? getWinningStrategyLabel(rules.winningStrategy)
                : '— (not applicable)',
            ],
            ['Business rules version', rules.version],
            ['Policy version (stack)', draft.stack.version],
            ['Policy version (priority)', draft.priority.version],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border bg-violet-50/30 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{String(value)}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Runtime policy diagnostics</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {[
            ['Priority version', draft.priority.version],
            ['Stack version', draft.stack.version],
            ['Funding version', draft.funding.version],
            ['Limits version', draft.limits.version],
            ['Publish ID', diagnostics?.publishId ?? '—'],
            ['Published by', diagnostics?.publishedBy ?? '—'],
            ['Published at', diagnostics?.publishedAt ?? '—'],
            ['Status', diagnostics?.status ?? 'unknown'],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border bg-slate-50/50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 font-mono text-sm text-slate-900">{String(value)}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Combination matrix (published)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(diagnostics?.combinationMatrix ?? rules.combinationMatrix).map((rule) => (
            <div
              key={rule.id ?? `${rule.left}-${rule.right}`}
              className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
            >
              <span>
                {rule.left} + {rule.right}
              </span>
              <Badge variant={rule.allowed ? 'default' : 'secondary'}>
                {rule.allowed ? 'Allowed' : 'Blocked'}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Engine modes (read-only)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {[
            ['Resolver mode', diagnostics?.resolverMode ?? 'unknown'],
            ['Settlement mode', diagnostics?.settlementMode ?? 'unknown'],
            ['Stack mode', diagnostics?.stackMode ?? 'unknown'],
            ['Priority mode', diagnostics?.priorityMode ?? 'unknown'],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border bg-slate-50/50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 font-mono text-sm text-slate-900">{String(value)}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Policy fingerprint</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <code className="flex-1 rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {fingerprint ?? 'Computed when policy is published via backend (Phase 8 API)'}
            </code>
            <Button type="button" variant="outline" size="sm" onClick={() => void copyFingerprint()}>
              <Copy className="mr-1.5 h-4 w-4" aria-hidden />
              Copy
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Feature flags (read-only)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {Object.entries(FEATURE_FLAG_LABELS).map(([key, label]) => {
            const value = diagnostics?.featureFlags?.[key];
            return (
              <Badge key={key} variant={value ? 'default' : 'secondary'} className="font-normal">
                {label}: {value ?? 'not exposed'}
              </Badge>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
