'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Card,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from '@warmpawz/ui';
import { RefreshCw, Layers, Gauge, PieChart as PieIcon } from 'lucide-react';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { isoRangeFromPreset } from '@/hooks/product-analytics/useProductAnalyticsRange';

/** Sum of dwell time in range — API returns bigint as string sometimes. */
function formatDurationMsTotal(raw: unknown): string {
  const n = raw != null && raw !== '' ? Number(raw) : 0;
  if (!Number.isFinite(n) || n <= 0) return '—';
  const sec = Math.round(n / 1000);
  if (sec < 120) return `${sec}s`;
  const min = n / 60000;
  if (min < 120) return `${min.toFixed(1)} min`;
  return `${(min / 60).toFixed(2)} h`;
}

function formatDurationMsAvg(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ProductAnalyticsPage() {
  const [preset, setPreset] = useState('7d');
  const [app, setApp] = useState<'all' | 'customer_web' | 'vendor_web'>('all');
  const [tab, setTab] = useState('summary');
  const [loading, setLoading] = useState(false);

  const [summary, setSummary] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [screens, setScreens] = useState<any[]>([]);
  const [errorCases, setErrorCases] = useState<any[]>([]);
  const [errorCasesPagination, setErrorCasesPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null>(null);
  const [assignees, setAssignees] = useState<{ id: string; email: string; name: string | null }[]>([]);
  const [ecPage, setEcPage] = useState(1);
  const [ecStatus, setEcStatus] = useState<string>('');
  const [ecPriority, setEcPriority] = useState<string>('');
  const [ecAssigned, setEcAssigned] = useState<string>('');
  const [ecQ, setEcQ] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [caseDetail, setCaseDetail] = useState<{ case: any; occurrences: any[] } | null>(null);
  const [patchDraft, setPatchDraft] = useState<{
    status: string;
    priority: string;
    deadline_at: string;
    assigned_admin_id: string;
    notes: string;
  } | null>(null);
  const [savingCase, setSavingCase] = useState(false);
  const [loadingCaseDetail, setLoadingCaseDetail] = useState(false);
  const [performance, setPerformance] = useState<any[]>([]);
  const [searchAgg, setSearchAgg] = useState<any[]>([]);
  const [flows, setFlows] = useState<any[]>([]);
  const [funnelSteps, setFunnelSteps] = useState('');
  const [funnelRes, setFunnelRes] = useState<any>(null);
  const [retention, setRetention] = useState<any>(null);

  const { start, end } = isoRangeFromPreset(preset);
  const q = (path: string, extra = '') => {
    const appQ = app === 'all' ? '' : `&app=${app}`;
    return `/admin/analytics/product/${path}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}${appQ}${extra}`;
  };

  const unwrap = (res: any) => (res && typeof res === 'object' && 'data' in res ? res.data : res);

  const loadTab = async () => {
    setLoading(true);
    try {
      if (tab === 'summary') {
        const res = await apiClient.get<any>(q('summary'));
        setSummary(unwrap(res));
      } else if (tab === 'events') {
        const res = await apiClient.get<any>(q('events'));
        setEvents(unwrap(res) ?? []);
      } else if (tab === 'screens') {
        const res = await apiClient.get<any>(q('screens'));
        setScreens(unwrap(res) ?? []);
      } else if (tab === 'errors') {
        const qs = new URLSearchParams();
        qs.set('start', start);
        qs.set('end', end);
        qs.set('page', String(ecPage));
        qs.set('limit', '50');
        if (ecStatus) qs.set('status', ecStatus);
        if (ecPriority) qs.set('priority', ecPriority);
        if (ecAssigned) qs.set('assigned_admin_id', ecAssigned);
        if (ecQ.trim()) qs.set('q', ecQ.trim());
        const res = await apiClient.get<any>(`/admin/analytics/error-cases?${qs.toString()}`);
        setErrorCases(Array.isArray(res?.data) ? res.data : []);
        setErrorCasesPagination(res?.pagination ?? null);
      } else if (tab === 'performance') {
        const res = await apiClient.get<any>(q('performance'));
        setPerformance(unwrap(res) ?? []);
      } else if (tab === 'search') {
        const res = await apiClient.get<any>(q('search'));
        setSearchAgg(unwrap(res) ?? []);
      } else if (tab === 'flows') {
        const res = await apiClient.get<any>(q('flows') + '&depth=2');
        setFlows(unwrap(res) ?? []);
      } else if (tab === 'funnel') {
        if (!funnelSteps.trim()) {
          toast.message('Enter comma-separated event_name steps for funnel');
          setLoading(false);
          return;
        }
        const res = await apiClient.get<any>(q('funnel', `&steps=${encodeURIComponent(funnelSteps)}`));
        setFunnelRes(unwrap(res));
      } else if (tab === 'retention') {
        const res = await apiClient.get<any>(q('retention'));
        setRetention(unwrap(res));
      }
    } catch (e: any) {
      toast.error(e?.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTab();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, preset, app, ecPage, ecStatus, ecPriority, ecAssigned, ecQ]);

  useEffect(() => {
    if (tab !== 'errors') return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiClient.get<any>('/admin/analytics/error-cases/assignees');
        const rows = unwrap(res);
        if (!cancelled && Array.isArray(rows)) {
          setAssignees(rows);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  useEffect(() => {
    if (tab !== 'errors' || !selectedCaseId) {
      setCaseDetail(null);
      setPatchDraft(null);
      return;
    }
    let cancelled = false;
    setLoadingCaseDetail(true);
    void (async () => {
      try {
        const res = await apiClient.get<any>(`/admin/analytics/error-cases/${selectedCaseId}`);
        const raw = unwrap(res);
        if (cancelled || !raw?.case) return;
        setCaseDetail(raw);
        const c = raw.case;
        setPatchDraft({
          status: c.status ?? 'open',
          priority: c.priority ?? 'p3',
          deadline_at: isoToDatetimeLocal(c.deadline_at),
          assigned_admin_id: c.assigned_admin_id ?? '',
          notes: c.notes ?? '',
        });
      } catch (e: any) {
        if (!cancelled) toast.error(e?.message || 'Failed to load case');
      } finally {
        if (!cancelled) setLoadingCaseDetail(false);
      }
    })();
    return () => {
      cancelled = true;
      setLoadingCaseDetail(false);
    };
  }, [tab, selectedCaseId]);

  const saveCasePatch = async () => {
    if (!selectedCaseId || !patchDraft) return;
    setSavingCase(true);
    try {
      const payload: Record<string, unknown> = {
        status: patchDraft.status,
        priority: patchDraft.priority,
        notes: patchDraft.notes.trim() === '' ? null : patchDraft.notes,
        assigned_admin_id: patchDraft.assigned_admin_id === '' ? null : patchDraft.assigned_admin_id,
        deadline_at:
          patchDraft.deadline_at === '' ? null : new Date(patchDraft.deadline_at).toISOString(),
      };
      await apiClient.patch(`/admin/analytics/error-cases/${selectedCaseId}`, payload);
      toast.success('Case updated');
      void loadTab();
      const res = await apiClient.get<any>(`/admin/analytics/error-cases/${selectedCaseId}`);
      const raw = unwrap(res);
      if (raw?.case) {
        setCaseDetail(raw);
        const c = raw.case;
        setPatchDraft({
          status: c.status ?? 'open',
          priority: c.priority ?? 'p3',
          deadline_at: isoToDatetimeLocal(c.deadline_at),
          assigned_admin_id: c.assigned_admin_id ?? '',
          notes: c.notes ?? '',
        });
      }
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    } finally {
      setSavingCase(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Product analytics (Allyticas)</h1>
            <p className="text-sm text-gray-600 mt-1">
              Behavioral telemetry from RDS. Date range required — using {preset} (
              {new Date(start).toLocaleString()} → {new Date(end).toLocaleString()}).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={app} onValueChange={(v: string) => setApp(v as typeof app)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="App" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All apps</SelectItem>
                <SelectItem value="customer_web">Customer web</SelectItem>
                <SelectItem value="vendor_web">Vendor web</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => loadTab()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="screens">Screens</TabsTrigger>
            <TabsTrigger value="errors">Errors</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="search">Search</TabsTrigger>
            <TabsTrigger value="flows">Flows</TabsTrigger>
            <TabsTrigger value="funnel">Funnel</TabsTrigger>
            <TabsTrigger value="retention">Retention</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="p-4">
                <div className="text-sm text-gray-500">Total events</div>
                <div className="text-2xl font-semibold">{summary?.totalEvents ?? '—'}</div>
              </Card>
              <Card className="p-4">
                <div className="text-sm text-gray-500">Sessions</div>
                <div className="text-2xl font-semibold">{summary?.distinctSessions ?? '—'}</div>
              </Card>
              <Card className="p-4">
                <div className="text-sm text-gray-500">Error events</div>
                <div className="text-2xl font-semibold">{summary?.errorEvents ?? '—'}</div>
              </Card>
              <Card className="p-4">
                <div className="text-sm text-gray-500">Screen views</div>
                <div className="text-2xl font-semibold">{summary?.screenViews ?? '—'}</div>
              </Card>
            </div>
            {summary?.p95DurationMs != null && (
              <Card className="p-4 mt-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Gauge className="w-4 h-4" /> P95 duration (screen/api timing){' '}
                  <Badge variant="secondary">{Math.round(summary.p95DurationMs)} ms</Badge>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="events" className="mt-6">
            <Card className="p-0 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>App</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Screen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(events || []).slice(0, 100).map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{r.occurred_at}</TableCell>
                      <TableCell>{r.app}</TableCell>
                      <TableCell>{r.event_type}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.event_name}</TableCell>
                      <TableCell className="max-w-[160px] truncate">{r.screen_name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="screens" className="mt-6">
            <p className="text-xs text-gray-500 mb-2">
              Sorted by total time on screen in this range (sum of all visits). Lowest totals appear lower; rows with
              views but no recorded dwell yet show &ldquo;—&rdquo; for total time.
            </p>
            <Card className="p-0 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Screen</TableHead>
                    <TableHead>Total time</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Avg / visit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(screens || []).map((r: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="max-w-[280px]">{r.screen_name}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDurationMsTotal(r.total_duration_ms)}
                      </TableCell>
                      <TableCell>{r.views}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {r.avg_duration_ms != null ? formatDurationMsAvg(Number(r.avg_duration_ms)) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="errors" className="mt-6 space-y-4">
            <p className="text-xs text-gray-500">
              Triage grouped error cases (fingerprint). Date range filters <code className="text-[11px]">last_seen_at</code>
              .
            </p>
            <Card className="p-4 space-y-3">
              <div className="flex flex-wrap gap-2 items-end">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Status</label>
                  <Select
                    value={ecStatus || '_any'}
                    onValueChange={(v: string) => setEcStatus(v === '_any' ? '' : v)}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_any">Any</SelectItem>
                      <SelectItem value="open">open</SelectItem>
                      <SelectItem value="in_progress">in_progress</SelectItem>
                      <SelectItem value="resolved">resolved</SelectItem>
                      <SelectItem value="ignored">ignored</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Priority</label>
                  <Select
                    value={ecPriority || '_any'}
                    onValueChange={(v: string) => setEcPriority(v === '_any' ? '' : v)}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_any">Any</SelectItem>
                      <SelectItem value="p1">p1</SelectItem>
                      <SelectItem value="p2">p2</SelectItem>
                      <SelectItem value="p3">p3</SelectItem>
                      <SelectItem value="p4">p4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Assignee</label>
                  <Select
                    value={ecAssigned || '_any'}
                    onValueChange={(v: string) => setEcAssigned(v === '_any' ? '' : v)}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_any">Any</SelectItem>
                      {assignees.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {(a.name || a.email || a.id).slice(0, 48)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs text-gray-500 block mb-1">Search title / fingerprint</label>
                  <input
                    className="w-full border rounded px-2 py-1.5 text-sm"
                    value={ecQ}
                    onChange={(e) => setEcQ(e.target.value)}
                    placeholder="Substring match"
                  />
                </div>
              </div>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-0 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Prio</TableHead>
                      <TableHead>Last seen</TableHead>
                      <TableHead>#</TableHead>
                      <TableHead>Title</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(errorCases || []).map((r: any) => (
                      <TableRow
                        key={r.id}
                        className={`cursor-pointer ${selectedCaseId === r.id ? 'bg-emerald-50' : ''}`}
                        onClick={() => setSelectedCaseId(r.id)}
                      >
                        <TableCell>
                          <Badge variant="secondary">{r.status}</Badge>
                        </TableCell>
                        <TableCell>{r.priority}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {r.last_seen_at ? new Date(r.last_seen_at).toLocaleString() : '—'}
                        </TableCell>
                        <TableCell>{r.occurrence_count ?? '—'}</TableCell>
                        <TableCell className="max-w-[220px]">
                          <div className="truncate text-sm font-medium">{r.title || '—'}</div>
                          <div className="truncate text-xs text-gray-500 font-mono">{r.fingerprint}</div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {errorCasesPagination && (
                  <div className="flex items-center justify-between px-4 py-2 border-t text-sm text-gray-600">
                    <span>
                      Page {errorCasesPagination.page} / {errorCasesPagination.totalPages} (
                      {errorCasesPagination.total} cases)
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={ecPage <= 1 || loading}
                        onClick={() => setEcPage((p) => Math.max(1, p - 1))}
                      >
                        Prev
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={ecPage >= (errorCasesPagination.totalPages ?? 1) || loading}
                        onClick={() => setEcPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </Card>

              <Card className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                {!selectedCaseId && (
                  <p className="text-sm text-gray-500">Select a case to view occurrences and edit triage fields.</p>
                )}
                {selectedCaseId && loadingCaseDetail && (
                  <p className="text-sm text-gray-500">Loading case…</p>
                )}
                {selectedCaseId && !loadingCaseDetail && caseDetail?.case && patchDraft && (
                  <>
                    <div>
                      <h3 className="font-semibold text-gray-900">{caseDetail.case.title || 'Untitled case'}</h3>
                      <p className="text-xs font-mono text-gray-500 break-all">{caseDetail.case.fingerprint}</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs text-gray-500">Status</label>
                        <Select
                          value={patchDraft.status}
                          onValueChange={(v: string) => setPatchDraft((d) => (d ? { ...d, status: v } : d))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">open</SelectItem>
                            <SelectItem value="in_progress">in_progress</SelectItem>
                            <SelectItem value="resolved">resolved</SelectItem>
                            <SelectItem value="ignored">ignored</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Priority</label>
                        <Select
                          value={patchDraft.priority}
                          onValueChange={(v: string) => setPatchDraft((d) => (d ? { ...d, priority: v } : d))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="p1">p1</SelectItem>
                            <SelectItem value="p2">p2</SelectItem>
                            <SelectItem value="p3">p3</SelectItem>
                            <SelectItem value="p4">p4</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs text-gray-500">Assignee</label>
                        <Select
                          value={patchDraft.assigned_admin_id || '_none'}
                          onValueChange={(v: string) =>
                            setPatchDraft((d) =>
                              d ? { ...d, assigned_admin_id: v === '_none' ? '' : v } : d
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Unassigned</SelectItem>
                            {assignees.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {(a.name || a.email || a.id).slice(0, 48)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs text-gray-500">Deadline (local)</label>
                        <input
                          type="datetime-local"
                          className="w-full border rounded px-2 py-1.5 text-sm"
                          value={patchDraft.deadline_at}
                          onChange={(e) =>
                            setPatchDraft((d) => (d ? { ...d, deadline_at: e.target.value } : d))
                          }
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs text-gray-500">Notes</label>
                        <Textarea
                          rows={3}
                          value={patchDraft.notes}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                            setPatchDraft((d) => (d ? { ...d, notes: e.target.value } : d))
                          }
                        />
                      </div>
                    </div>

                    <Button size="sm" onClick={() => void saveCasePatch()} disabled={savingCase}>
                      {savingCase ? 'Saving…' : 'Save changes'}
                    </Button>

                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium text-gray-800 mb-2">Occurrences</h4>
                      <div className="space-y-3">
                        {(caseDetail.occurrences || []).map((o: any) => (
                          <Card key={o.event_id || o.occurrence_id} className="p-3 bg-gray-50">
                            <div className="text-xs text-gray-600 flex flex-wrap gap-x-3 gap-y-1">
                              <span>{o.occurred_at ? new Date(o.occurred_at).toLocaleString() : '—'}</span>
                              <Badge variant="outline">{o.app}</Badge>
                              <span className="font-mono text-[11px]">{o.event_id}</span>
                            </div>
                            <div className="text-sm mt-1">
                              <span className="text-gray-500">Screen:</span> {o.screen_name || '—'}
                            </div>
                            <details className="mt-2">
                              <summary className="text-xs cursor-pointer text-emerald-700">properties JSON</summary>
                              <pre className="mt-2 text-[11px] overflow-x-auto bg-white border rounded p-2 max-h-48 overflow-y-auto">
                                {JSON.stringify(o.properties ?? {}, null, 2)}
                              </pre>
                            </details>
                          </Card>
                        ))}
                        {(caseDetail.occurrences || []).length === 0 && (
                          <p className="text-sm text-gray-500">No linked events (retention may have removed rows).</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="mt-6">
            <Card className="p-0 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>API</TableHead>
                    <TableHead>P50 ms</TableHead>
                    <TableHead>P95 ms</TableHead>
                    <TableHead>Samples</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(performance || []).map((r: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{r.api_name}</TableCell>
                      <TableCell>{r.p50_ms != null ? Math.round(r.p50_ms) : '—'}</TableCell>
                      <TableCell>{r.p95_ms != null ? Math.round(r.p95_ms) : '—'}</TableCell>
                      <TableCell>{r.samples}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="search" className="mt-6">
            <Card className="p-0 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>event_name</TableHead>
                    <TableHead>Searches</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(searchAgg || []).map((r: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="max-w-[320px] truncate">{r.event_name}</TableCell>
                      <TableCell>{r.searches}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="flows" className="mt-6">
            <Card className="p-4">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                <Layers className="w-4 h-4" /> Top consecutive screen_view pairs (depth 2)
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Path</TableHead>
                    <TableHead>Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(flows || []).map((r: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{r.path}</TableCell>
                      <TableCell>{r.cnt}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="funnel" className="mt-6">
            <Card className="p-4 space-y-4">
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs text-gray-500">Steps (comma-separated event_name)</label>
                  <input
                    className="w-full border rounded px-2 py-1 text-sm mt-1"
                    value={funnelSteps}
                    onChange={(e) => setFunnelSteps(e.target.value)}
                    placeholder="page_home,page_booking,booking_payment_initiated"
                  />
                </div>
                <Button size="sm" onClick={() => loadTab()}>
                  Run funnel
                </Button>
              </div>
              {funnelRes?.steps && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Step</TableHead>
                      <TableHead>Sessions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {funnelRes.steps.map((s: any) => (
                      <TableRow key={s.step}>
                        <TableCell>{s.step}</TableCell>
                        <TableCell>{s.sessions}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="retention" className="mt-6">
            <Card className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <PieIcon className="w-4 h-4" /> MVP retention proxy
              </div>
              <p className="text-sm text-gray-500">{retention?.note}</p>
              <div className="text-lg font-medium">
                Active users (screen_view, identified): {retention?.activeUsersInRange ?? '—'}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
