'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
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

export default function ProductAnalyticsPage() {
  const [preset, setPreset] = useState('7d');
  const [app, setApp] = useState<'all' | 'customer_web' | 'vendor_web'>('all');
  const [tab, setTab] = useState('summary');
  const [loading, setLoading] = useState(false);

  const [summary, setSummary] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [screens, setScreens] = useState<any[]>([]);
  const [errors, setErrors] = useState<any[]>([]);
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
        const res = await apiClient.get<any>(q('errors'));
        setErrors(unwrap(res) ?? []);
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
  }, [tab, preset, app]);

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
            <Select value={app} onValueChange={(v) => setApp(v as typeof app)}>
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

          <TabsContent value="errors" className="mt-6">
            <Card className="p-0 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead>Sample event</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(errors || []).map((r: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{r.error_code}</TableCell>
                      <TableCell>{r.cnt}</TableCell>
                      <TableCell className="max-w-[240px] truncate">{r.sample_event_name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
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
