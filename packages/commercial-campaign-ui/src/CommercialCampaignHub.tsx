'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Megaphone, Plus, RefreshCw } from 'lucide-react';
import {
  discountDomainForSurface,
  formatCampaignInr,
  resolveHealth,
  type CampaignApiClient,
  type CampaignLifecycleStatus,
  type CampaignSurface,
  type CommercialCampaignRecord,
  CAMPAIGN_LIFECYCLE_LABELS,
} from './types';
import { CampaignStatusBadge } from './CampaignStatusBadge';
import { CampaignHealthBadge } from './CampaignHealthBadge';
import { CampaignTimeline } from './CampaignTimeline';
import { CampaignCalendarView } from './CampaignCalendarView';

const LIFECYCLE_ACTIONS: Partial<Record<CampaignLifecycleStatus, CampaignLifecycleStatus[]>> = {
  draft: ['review', 'cancelled'],
  review: ['approved', 'draft', 'cancelled'],
  approved: ['scheduled', 'running', 'cancelled'],
  scheduled: ['running', 'paused', 'cancelled'],
  running: ['paused', 'completed', 'cancelled'],
  paused: ['running', 'cancelled'],
  completed: ['archived'],
  cancelled: ['archived'],
  expired: ['archived'],
};

export interface CommercialCampaignHubProps {
  surface?: CampaignSurface;
  /** When true: hide create/templates/lifecycle mutations unless ownerAllowMutate. */
  readOnly?: boolean;
  /** Vendor/seller id — enables ownership labelling and participant-scoped UX. */
  participantVendorId?: string;
  api: CampaignApiClient;
  /** Optional admin-only builder launcher rendered when !readOnly */
  renderBuilder?: (opts: {
    open: boolean;
    onClose: () => void;
    cloneFrom: CommercialCampaignRecord | null;
    templateId?: string;
    onSuccess: () => void;
  }) => ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
  /** Fired when campaign detail drawer opens/closes — for Commercial AI entity context. */
  onEntityFocus?: (entity: { type: 'campaign'; id: string; name: string } | null) => void;
}

function canMutate(campaign: CommercialCampaignRecord, participantVendorId?: string, readOnly?: boolean) {
  if (!readOnly) return true;
  if (!participantVendorId) return false;
  return campaign.vendorId === participantVendorId;
}

export function CommercialCampaignHub({
  surface = 'marketing',
  readOnly = false,
  participantVendorId,
  api,
  renderBuilder,
  title,
  subtitle,
  className = '',
  onEntityFocus,
}: CommercialCampaignHubProps) {
  const discountDomain = discountDomainForSurface(surface);
  const [campaigns, setCampaigns] = useState<CommercialCampaignRecord[]>([]);
  const [mode, setMode] = useState<{ mode: string; enabled: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'dashboard' | 'campaigns' | 'calendar'>('dashboard');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CommercialCampaignRecord | null>(null);
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [validationWarn, setValidationWarn] = useState<string[]>([]);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [cloneFrom, setCloneFrom] = useState<CommercialCampaignRecord | null>(null);
  const [query, setQuery] = useState('');

  const heading =
    title ??
    (surface === 'ecommerce' ? 'E-Commerce Campaigns' : 'Service Campaigns');
  const sub =
    subtitle ??
    (readOnly
      ? 'Campaigns you own or participate in — performance for your offers only'
      : 'Commercial campaign orchestration — Phase 10');

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const m = await api.fetchMode();
      setMode(m);
      if (!m.enabled) {
        setError('Commercial Campaign Engine is disabled.');
        setCampaigns([]);
        return;
      }
      const list = await api.listCampaigns({ discountDomain, surface });
      setCampaigns(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load campaigns');
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surface, participantVendorId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setAnalytics(null);
      return;
    }
    void (async () => {
      const c = await api.getCampaign(selectedId);
      setDetail(c);
      if (c && api.fetchAnalytics) {
        const a = (await api.fetchAnalytics(selectedId).catch(() => null)) as Record<
          string,
          unknown
        > | null;
        setAnalytics(a);
      }
      if (c && api.validatePublish && !readOnly) {
        const v = await api.validatePublish(selectedId).catch(() => null);
        setValidationWarn((v?.warnings ?? []).map((w) => w.message));
      }
    })();
  }, [selectedId, api, readOnly]);

  useEffect(() => {
    if (!onEntityFocus) return;
    if (detail?.id) {
      onEntityFocus({ type: 'campaign', id: detail.id, name: detail.name });
    } else {
      onEntityFocus(null);
    }
  }, [detail, onEntityFocus]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.campaignType.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
    );
  }, [campaigns, query]);

  const stats = useMemo(() => {
    const by = (s: CampaignLifecycleStatus) => campaigns.filter((c) => c.status === s).length;
    return {
      total: campaigns.length,
      running: by('running'),
      scheduled: by('scheduled'),
      draft: by('draft'),
    };
  }, [campaigns]);

  const formatSchedule = (c: CommercialCampaignRecord) => {
    if (c.scheduleType === 'immediate' && !c.startAt) return 'Immediate';
    const start = c.startAt ? new Date(c.startAt).toLocaleDateString() : '—';
    const end = c.endAt ? new Date(c.endAt).toLocaleDateString() : '—';
    return `${start} → ${end}`;
  };

  const ownershipLabel = (c: CommercialCampaignRecord) => {
    if (c.ownershipLabel) return c.ownershipLabel;
    if (!participantVendorId) return null;
    return c.vendorId === participantVendorId ? 'Owned by You' : 'Participating';
  };

  const transition = async (status: CampaignLifecycleStatus) => {
    if (!detail || !api.transitionLifecycle) return;
    if (!canMutate(detail, participantVendorId, readOnly)) {
      toast.error('You can only view this campaign — ownership is required to modify it.');
      return;
    }
    try {
      if (api.validatePublish && ['approved', 'scheduled', 'running'].includes(status)) {
        const v = await api.validatePublish(detail.id);
        if (v && !v.valid) {
          toast.error(v.errors.map((e) => e.message).join('; '));
          return;
        }
        if (v?.warnings?.length) {
          toast.message(`Warnings: ${v.warnings.map((w) => w.message).join('; ')}`);
        }
      }
      await api.transitionLifecycle(detail.id, status);
      toast.success(`Campaign moved to ${status}`);
      void reload();
      const c = await api.getCampaign(detail.id);
      setDetail(c);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lifecycle failed');
    }
  };

  const duplicate = async () => {
    if (!detail || !api.duplicateCampaign || readOnly) return;
    try {
      const copy = await api.duplicateCampaign(detail.id, { includeSchedule: true });
      toast.success(`Created draft "${copy.name}"`);
      void reload();
      setSelectedId(copy.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Duplicate failed');
    }
  };

  const kpis = analytics?.kpis as
    | {
        redemptions?: number;
        discountSpend?: number;
        orders?: number;
        revenue?: number;
      }
    | undefined;

  if (!loading && error && mode && !mode.enabled) {
    return (
      <div className={`mx-auto max-w-3xl px-6 py-12 ${className}`}>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <p className="font-semibold">Commercial Campaign Engine disabled</p>
          <p className="mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex min-h-screen flex-col bg-slate-50/50 ${className}`}>
      <div className="sticky top-0 z-10 border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-100 p-2">
              <Megaphone className="h-6 w-6 text-orange-600" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{heading}</h1>
              <p className="text-sm text-slate-500">{sub}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mode ? (
              <span className="rounded border px-2 py-0.5 font-mono text-xs">{mode.mode}</span>
            ) : null}
            <button
              type="button"
              className="inline-flex items-center rounded border px-3 py-1.5 text-sm"
              onClick={() => void reload()}
              disabled={loading}
            >
              <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {!readOnly ? (
              <button
                type="button"
                className="inline-flex items-center rounded bg-orange-600 px-3 py-1.5 text-sm text-white"
                onClick={() => {
                  setCloneFrom(null);
                  setBuilderOpen(true);
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                New campaign
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-6 py-6">
        {error && mode?.enabled ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {(
            [
              ['dashboard', 'Dashboard'],
              ['campaigns', 'All campaigns'],
              ['calendar', 'Calendar'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                tab === id ? 'bg-white font-semibold shadow' : 'text-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'dashboard' ? (
          loading ? (
            <p className="text-sm text-slate-500">Loading campaigns…</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Total', stats.total],
                ['Running', stats.running],
                ['Scheduled', stats.scheduled],
                ['Draft', stats.draft],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border bg-white p-4">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-1 text-2xl font-semibold">{value}</p>
                </div>
              ))}
            </div>
          )
        ) : null}

        {tab === 'calendar' ? (
          <CampaignCalendarView
            campaigns={campaigns}
            onSelect={(c) => {
              setSelectedId(c.id);
            }}
          />
        ) : null}

        {tab === 'campaigns' || tab === 'dashboard' ? (
          <div className={tab === 'dashboard' ? 'mt-6 space-y-3' : 'space-y-3'}>
            {tab === 'campaigns' ? (
              <input
                className="max-w-xs rounded border px-3 py-2 text-sm"
                placeholder="Search campaigns…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            ) : (
              <h3 className="text-sm font-semibold text-slate-800">Campaigns</h3>
            )}
            <div className="overflow-x-auto rounded-xl border bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Health</th>
                    <th className="px-3 py-2">Duration</th>
                    <th className="px-3 py-2">Funding</th>
                    <th className="px-3 py-2">Owner</th>
                    {participantVendorId ? <th className="px-3 py-2">Role</th> : null}
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {(tab === 'dashboard' ? filtered.slice(0, 8) : filtered).map((c) => {
                    const health = resolveHealth(c);
                    const role = ownershipLabel(c);
                    return (
                      <tr key={c.id} className="border-t hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium">{c.name}</td>
                        <td className="px-3 py-2">
                          <CampaignStatusBadge status={c.status} />
                        </td>
                        <td className="px-3 py-2">
                          <CampaignHealthBadge status={health.status} />
                        </td>
                        <td className="px-3 py-2 text-xs">{formatSchedule(c)}</td>
                        <td className="px-3 py-2">{c.funding.type}</td>
                        <td className="px-3 py-2 text-xs">
                          {c.vendorId ? 'Vendor' : 'Platform'}
                        </td>
                        {participantVendorId ? (
                          <td className="px-3 py-2">
                            {role ? (
                              <span className="rounded border px-2 py-0.5 text-[10px] font-semibold uppercase">
                                {role}
                              </span>
                            ) : null}
                          </td>
                        ) : null}
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="text-orange-700 hover:underline"
                            onClick={() => setSelectedId(c.id)}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {!filtered.length && !loading ? (
                    <tr>
                      <td
                        colSpan={participantVendorId ? 8 : 7}
                        className="px-3 py-8 text-center text-slate-500"
                      >
                        No campaigns yet
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>

      {/* Details drawer — read-only for participants */}
      {selectedId && detail ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-xl">
            <div className="flex items-start justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">{detail.name}</h2>
                <div className="mt-1 flex flex-wrap gap-2">
                  <CampaignStatusBadge status={detail.status} />
                  <CampaignHealthBadge status={resolveHealth(detail).status} />
                  {ownershipLabel(detail) ? (
                    <span className="rounded border px-2 py-0.5 text-[10px] font-semibold uppercase">
                      {ownershipLabel(detail)}
                    </span>
                  ) : null}
                </div>
              </div>
              <button type="button" className="text-slate-500" onClick={() => setSelectedId(null)}>
                Close
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
              {validationWarn.length ? (
                <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  {validationWarn.map((w) => (
                    <p key={w}>{w}</p>
                  ))}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-slate-500">Start</p>
                  <p>{detail.startAt ? new Date(detail.startAt).toLocaleString() : '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500">End</p>
                  <p>{detail.endAt ? new Date(detail.endAt).toLocaleString() : '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Funding</p>
                  <p>{detail.funding.type}</p>
                </div>
                <div>
                  <p className="text-slate-500">Campaign owner</p>
                  <p>{detail.vendorId ? detail.vendorId : 'Platform'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Goal</p>
                  <p>{detail.goal ?? '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Objective</p>
                  <p>{detail.objective ?? String(detail.metadata?.businessObjective ?? '—')}</p>
                </div>
              </div>

              <CampaignTimeline campaign={detail} />

              <div>
                <h4 className="mb-2 font-semibold">Your performance</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded border p-2">
                    <p className="text-xs text-slate-500">Orders</p>
                    <p className="text-lg font-semibold">{Number(kpis?.orders ?? 0)}</p>
                  </div>
                  <div className="rounded border p-2">
                    <p className="text-xs text-slate-500">Revenue</p>
                    <p className="text-lg font-semibold">
                      {formatCampaignInr(Number(kpis?.revenue ?? 0))}
                    </p>
                  </div>
                  <div className="rounded border p-2">
                    <p className="text-xs text-slate-500">Discount given</p>
                    <p className="text-lg font-semibold">
                      {formatCampaignInr(Number(kpis?.discountSpend ?? 0))}
                    </p>
                  </div>
                  <div className="rounded border p-2">
                    <p className="text-xs text-slate-500">Redemptions</p>
                    <p className="text-lg font-semibold">{Number(kpis?.redemptions ?? 0)}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {canMutate(detail, participantVendorId, readOnly)
                  ? (LIFECYCLE_ACTIONS[detail.status] ?? []).map((a) => (
                      <button
                        key={a}
                        type="button"
                        className="rounded border px-2 py-1 text-xs"
                        onClick={() => void transition(a)}
                      >
                        → {CAMPAIGN_LIFECYCLE_LABELS[a]}
                      </button>
                    ))
                  : null}
                {!readOnly && api.duplicateCampaign ? (
                  <button
                    type="button"
                    className="rounded border px-2 py-1 text-xs"
                    onClick={() => void duplicate()}
                  >
                    Duplicate campaign
                  </button>
                ) : null}
                {!readOnly ? (
                  <button
                    type="button"
                    className="rounded border px-2 py-1 text-xs"
                    onClick={() => {
                      setCloneFrom(detail);
                      setBuilderOpen(true);
                      setSelectedId(null);
                    }}
                  >
                    Clone in builder
                  </button>
                ) : null}
              </div>

              {readOnly && !canMutate(detail, participantVendorId, readOnly) ? (
                <p className="text-xs text-slate-500">
                  Read-only: you cannot publish, pause, delete, or change funding / policy /
                  structure for platform campaigns.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {!readOnly && renderBuilder
        ? renderBuilder({
            open: builderOpen,
            onClose: () => setBuilderOpen(false),
            cloneFrom,
            onSuccess: () => void reload(),
          })
        : null}
    </div>
  );
}
