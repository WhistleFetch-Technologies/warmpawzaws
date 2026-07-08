'use client';

import { useMemo } from 'react';
import {
  Megaphone,
  Play,
  Clock,
  FileEdit,
  Pause,
  CheckCircle2,
  XCircle,
  Archive,
  TrendingUp,
  PiggyBank,
} from 'lucide-react';
import { StatCard } from '@/components/admin/shared/StatCard';
import type { CommercialCampaignRecord, CampaignLifecycleStatus } from '@/lib/commercial-campaign/types';
import { CampaignStatusBadge } from './CampaignStatusBadge';
import { formatInr } from '@/lib/marketing-analytics/format';

const STATUS_BUCKETS: CampaignLifecycleStatus[] = [
  'running',
  'scheduled',
  'draft',
  'paused',
  'completed',
  'expired',
  'cancelled',
];

export function CampaignDashboard({ campaigns }: { campaigns: CommercialCampaignRecord[] }) {
  const stats = useMemo(() => {
    const byStatus = (s: CampaignLifecycleStatus) =>
      campaigns.filter((c) => c.status === s).length;

    const recent = [...campaigns]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);

    const top = [...campaigns]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    const budgetSpentTotal = campaigns.reduce((sum, c) => sum + Number(c.budgetSpent ?? 0), 0);
    const budgetCapTotal = campaigns.reduce((sum, c) => {
      const cap = c.budgetCap;
      return sum + (cap != null && Number.isFinite(Number(cap)) ? Number(cap) : 0);
    }, 0);
    const hasBudget = campaigns.some(
      (c) => (c.budgetSpent != null && Number(c.budgetSpent) > 0) || c.budgetCap != null
    );

    return { byStatus, recent, top, total: campaigns.length, budgetSpentTotal, budgetCapTotal, hasBudget };
  }, [campaigns]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total campaigns" value={stats.total} icon={Megaphone} iconColor="orange" />
        <StatCard title="Running" value={stats.byStatus('running')} icon={Play} iconColor="green" />
        <StatCard title="Scheduled" value={stats.byStatus('scheduled')} icon={Clock} iconColor="purple" />
        <StatCard title="Draft" value={stats.byStatus('draft')} icon={FileEdit} iconColor="blue" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Paused" value={stats.byStatus('paused')} icon={Pause} iconColor="orange" />
        <StatCard title="Completed" value={stats.byStatus('completed')} icon={CheckCircle2} iconColor="green" />
        <StatCard title="Expired" value={stats.byStatus('expired')} icon={Archive} iconColor="blue" />
        <StatCard title="Cancelled" value={stats.byStatus('cancelled')} icon={XCircle} iconColor="red" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title={stats.hasBudget ? 'Budget spent' : 'Campaign revenue'}
          value={stats.hasBudget ? formatInr(stats.budgetSpentTotal) : '—'}
          icon={TrendingUp}
          iconColor="green"
          className="opacity-90"
        />
        <StatCard
          title={stats.hasBudget ? 'Budget cap (total)' : 'Customer savings'}
          value={stats.hasBudget && stats.budgetCapTotal > 0 ? formatInr(stats.budgetCapTotal) : '—'}
          icon={PiggyBank}
          iconColor="purple"
          className="opacity-90"
        />
        <StatCard title="Funding mix" value="See details" icon={Megaphone} iconColor="orange" className="opacity-90" />
      </div>
      <p className="text-xs text-slate-500">
        {stats.hasBudget
          ? `Budget spent ${formatInr(stats.budgetSpentTotal)}${
              stats.budgetCapTotal > 0 ? ` of ${formatInr(stats.budgetCapTotal)} cap` : ''
            } across listed campaigns.`
          : 'Revenue, savings, and funding aggregates appear per-campaign on Analytics tab (Phase 9 bridge) when analytics mode is AUTHORITATIVE.'}
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Recent campaigns</h3>
          <ul className="space-y-2">
            {stats.recent.length === 0 ? (
              <li className="text-sm text-slate-500">No campaigns yet</li>
            ) : (
              stats.recent.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{c.name}</span>
                  <CampaignStatusBadge status={c.status} />
                </li>
              ))
            )}
          </ul>
        </section>
        <section className="rounded-xl border bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Top campaigns (by created date)</h3>
          <ul className="space-y-2">
            {stats.top.length === 0 ? (
              <li className="text-sm text-slate-500">No campaigns yet</li>
            ) : (
              stats.top.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{c.name}</span>
                  <span className="text-xs text-slate-500">{c.campaignType}</span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
