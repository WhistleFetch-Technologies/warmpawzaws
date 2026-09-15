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
      <div className={`mx-auto max-w-3xl px-3 py-6 sm:px-6 sm:py-12 ${className}`}>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:p-6">
          <p className="font-semibold">Commercial Campaign Engine disabled</p>
          <p className="mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex min-h-0 flex-col bg-slate-50/50 ${className}`}>
      <div className="sticky top-0 z-10 border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="shrink-0 rounded-lg bg-orange-100 p-1.5 sm:p-2">
              <Megaphone className="h-4 w-4 text-orange-600 sm:h-6 sm:w-6" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-slate-900 sm:text-2xl">{heading}</h1>
              <p className="truncate text-[11px] text-slate-500 sm:text-sm">{sub}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {mode ? (
              <span className="hidden rounded border px-2 py-0.5 font-mono text-xs sm:inline">{mode.mode}</span>
            ) : null}
            <button
              type="button"
              className="inline-flex items-center rounded border px-2.5 py-1.5 text-xs sm:px-3 sm:text-sm"
              onClick={() => void reload()}
              disabled={loading}
            >
              <RefreshCw className={`mr-1 h-3.5 w-3.5 sm:mr-1.5 sm:h-4 sm:w-4 ${loading ? 'animate-spin' : ''}`} />
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

      <div className="mx-auto w-full max-w-6xl flex-1 space-y-3 px-3 py-3 sm:space-y-6 sm:px-6 sm:py-6">
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
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 sm:gap-4">
              {[
                ['Total', stats.total],
                ['Running', stats.running],
                ['Scheduled', stats.scheduled],
                ['Draft', stats.draft],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg border bg-white p-2.5 sm:rounded-xl sm:p-4">
                  <p className="text-[11px] text-slate-500 sm:text-xs">{label}</p>
                  <p className="mt-0.5 text-lg font-semibold sm:mt-1 sm:text-2xl">{value}</p>
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
                className="w-full max-w-xs rounded-lg border px-3 py-2 text-sm"
                placeholder="Search campaigns…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            ) : (
              <h3 className="text-sm font-semibold text-slate-800">Campaigns</h3>
            )}
            <div className="overflow-hidden rounded-xl border bg-white">
              <div className="divide-y divide-slate-100 md:hidden">
                {(tab === 'dashboard' ? filtered.slice(0, 8) : filtered).map((c) => {
                  const health = resolveHealth(c);
                  const role = ownershipLabel(c);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className="flex w-full items-start gap-2 px-3 py-2.5 text-left"
                      onClick={() => setSelectedId(c.id)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{c.name}</p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">
                          {formatSchedule(c)} · {c.funding.type}
                          {role ? ` · ${role}` : ''}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <CampaignStatusBadge status={c.status} />
                          <CampaignHealthBadge status={health.status} />
                        </div>
                      </div>
                      <span className="shrink-0 pt-0.5 text-xs font-medium text-orange-700">View</span>
                    </button>
                  );
                })}
                {!filtered.length && !loading ? (
                  <p className="px-3 py-8 text-center text-sm text-slate-500">No campaigns yet</p>
                ) : null}
              </div>
              <div className="hidden overflow-x-auto md:block">
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
          </div>
        ) : null}
      </div>

      {/* Details drawer — read-only for participants */}
      {selectedId && detail ? (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/30 sm:items-stretch">
          <div className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:h-full sm:max-h-none sm:rounded-none">
            <div className="flex items-start justify-between gap-3 border-b px-4 py-3 sm:px-5 sm:py-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold sm:text-lg">{detail.name}</h2>
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
              <button type="button" className="shrink-0 text-sm text-slate-500" onClick={() => setSelectedId(null)}>
                Close
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3 text-sm sm:px-5 sm:py-4">
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
                  <p className="break-all">{detail.vendorId ? detail.vendorId : 'Platform'}</p>
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
                    <p className="text-base font-semibold sm:text-lg">{Number(kpis?.orders ?? 0)}</p>
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
