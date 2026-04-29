'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Lock,
  Navigation,
  Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { setHomeServiceTrackingReturnHref } from '@/lib/vendor-live-tracker-nav';

type SessionRow = {
  id?: string;
  session_number?: number;
  sessionNumber?: number;
  display_status?: string;
  displayStatus?: string;
  status?: string;
  scheduled_date?: string;
  scheduledDate?: string;
  scheduled_time?: string;
  scheduledTime?: string;
  booking_status?: string;
  booking_date?: string;
  booking_time?: string;
  booking_id?: string;
  bookingId?: string;
  service_type?: string;
  serviceType?: string;
  service_style?: string;
  serviceStyle?: string;
};

function sessionNeedsWalkTracker(s: SessionRow): boolean {
  const t = String(s.service_type || s.serviceType || '').toLowerCase();
  const st = String(s.service_style || s.serviceStyle || '').toLowerCase();
  const atHome = st === 'at_home' || st === 'home' || st === 'home_visit';
  const walkish = t.includes('walk') || t === 'walking' || t.includes('sit');
  return atHome && walkish;
}

/** "06:16:00" → "06:16 AM" / "13:00" → "01:00 PM". Falls back to raw input. */
function formatTimeLabel(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return s;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${String(h).padStart(2, '0')}:${min} ${ampm}`;
}

/** "2026-05-26" or ISO datetime → "Tue, 26 May 2026". Falls back to raw. */
function formatDateLabel(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  // Strip time portion if present
  const dateOnly = s.length > 10 ? s.slice(0, 10) : s;
  const parts = dateOnly.split('-');
  if (parts.length !== 3) return s;
  const y = parseInt(parts[0], 10);
  const mo = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return s;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (Number.isNaN(dt.getTime())) return s;
  return dt.toLocaleDateString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function PackagePurchaseSessionsVendorView({
  packagePurchaseId,
}: {
  packagePurchaseId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [pkg, setPkg] = useState<Record<string, unknown> | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = (await apiClient.get(
        `/vendor/packages/${encodeURIComponent(packagePurchaseId)}/sessions`
      )) as {
        success?: boolean;
        package?: Record<string, unknown>;
        sessions?: SessionRow[];
        summary?: Record<string, number>;
        error?: string;
      };
      if (res?.error) {
        toast.error(String(res.error));
        setPkg(null);
        setSessions([]);
        setSummary(null);
        return;
      }
      setPkg(res.package ?? null);
      setSessions(Array.isArray(res.sessions) ? res.sessions : []);
      setSummary(res.summary ?? null);
    } catch (e: unknown) {
      console.error('[PackagePurchaseSessionsVendorView]', e);
      toast.error('Could not load package sessions.');
      setPkg(null);
      setSessions([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [packagePurchaseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const pkgName =
    (pkg?.package_name as string) ||
    (pkg?.packageName as string) ||
    'Package';
  const totalFromPkg =
    pkg?.total_sessions != null && pkg.total_sessions !== ''
      ? Number(pkg.total_sessions)
      : 0;
  const total =
    summary?.total != null && summary.total > 0
      ? summary.total
      : totalFromPkg > 0
        ? totalFromPkg
        : sessions.length;
  const completed = summary?.completed ?? 0;
  const remaining =
    summary?.remaining ??
    (pkg?.remaining_sessions != null ? Number(pkg.remaining_sessions) : 0);
  const unlimited = Boolean(pkg?.unlimited_usage);
  const progressPct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

  const customerName =
    (pkg?.customer_name as string) ||
    (pkg?.customerName as string) ||
    '';
  const expiresRaw = (pkg?.expires_at as string) || (pkg?.expiresAt as string) || '';

  const nextSessionNumber = useMemo(() => {
    const rows = sessions.map((s, idx) => ({
      s,
      n: Number(s.session_number ?? s.sessionNumber ?? idx + 1) || idx + 1,
    }));
    rows.sort((a, b) => a.n - b.n);
    for (const { s, n } of rows) {
      const disp = String(s.display_status || s.displayStatus || s.status || '')
        .toLowerCase()
        .trim();
      if (disp !== 'completed' && disp !== 'cancelled' && disp !== 'no_show') return n;
    }
    return null;
  }, [sessions]);

  const openLiveJourney = (bookingId: string) => {
    try {
      setHomeServiceTrackingReturnHref(
        typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '/'
      );
    } catch {
      /* ignore */
    }
    router.push(`/bookings/home-service/${encodeURIComponent(bookingId)}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Universal page header — matches /bookings, /calendar, /customers */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            aria-label="Back"
            className="-ml-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
              <Package className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-gray-900">
                Package sessions
              </h1>
              <p className="truncate text-xs text-gray-500">
                {customerName ? `${customerName} · ` : ''}
                {total > 0 ? `${total} sessions total` : 'Session tracker'}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-4 p-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-orange-500" />
          </div>
        ) : (
          <>
            {/* Summary card */}
            <Card className="overflow-hidden border-orange-100">
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 px-4 py-4">
                <p className="text-sm font-semibold text-gray-900">{pkgName}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-gray-700">
                  <span className="font-medium">
                    {unlimited ? `${completed} completed` : `${completed} of ${total || sessions.length || '—'} completed`}
                  </span>
                  {!unlimited && typeof remaining === 'number' ? (
                    <>
                      <span className="text-gray-400">·</span>
                      <span>{remaining} remaining</span>
                    </>
                  ) : null}
                  {unlimited ? (
                    <>
                      <span className="text-gray-400">·</span>
                      <span>Unlimited</span>
                    </>
                  ) : null}
                  {expiresRaw ? (
                    <>
                      <span className="text-gray-400">·</span>
                      <span>Expires {formatDateLabel(expiresRaw)}</span>
                    </>
                  ) : null}
                </div>

                {!unlimited && total > 0 ? (
                  <div className="mt-3">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/80">
                      <div
                        className="h-full rounded-full bg-orange-500 transition-all"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-orange-700">
                      {progressPct}% complete
                    </p>
                  </div>
                ) : null}
              </div>
            </Card>

            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Sessions</h2>
              <p className="text-xs text-gray-500">
                Open the booking row in your calendar to verify OTP.
              </p>
            </div>

            {sessions.length === 0 ? (
              <Card className="p-6 text-center text-sm text-gray-500">
                No scheduled session rows.
              </Card>
            ) : (
              <ul className="space-y-2">
                {sessions.map((s, idx) => {
                  const n = Number(s.session_number ?? s.sessionNumber ?? idx + 1) || idx + 1;
                  const st = (
                    s.display_status ||
                    s.displayStatus ||
                    s.status ||
                    s.booking_status ||
                    'pending'
                  ).toString();
                  const stLower = st.toLowerCase();
                  const date = s.scheduled_date || s.scheduledDate || s.booking_date || '';
                  const timeRaw = s.scheduled_time || s.scheduledTime || s.booking_time || '';
                  const isNextUp = nextSessionNumber != null && n === nextSessionNumber;
                  const isFutureLocked =
                    nextSessionNumber != null &&
                    n > nextSessionNumber &&
                    stLower !== 'completed' &&
                    stLower !== 'in_progress';
                  const statusLabel =
                    stLower === 'completed'
                      ? 'Completed'
                      : stLower === 'in_progress'
                        ? 'In progress'
                        : stLower === 'arrived'
                          ? 'Arrived'
                          : stLower === 'scheduled' || (stLower === 'pending' && !!date)
                            ? 'Scheduled'
                            : stLower === 'pending'
                              ? 'Pending'
                              : st;
                  const bid = String(s.bookingId || s.booking_id || '').trim();
                  const bst = String(s.booking_status || '').toLowerCase();
                  const showLive =
                    !!bid &&
                    sessionNeedsWalkTracker(s) &&
                    [
                      'confirmed',
                      'pending',
                      'traveling',
                      'vendor_on_way',
                      'in_progress',
                      'arrived',
                    ].includes(bst);

                  return (
                    <li key={s.id || `${n}-${idx}`}>
                      <Card
                        className={`overflow-hidden transition-shadow ${
                          isNextUp
                            ? 'border-orange-300 ring-1 ring-orange-300'
                            : isFutureLocked
                              ? 'border-gray-200 opacity-80'
                              : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 p-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                                stLower === 'completed'
                                  ? 'bg-green-100 text-green-700'
                                  : isNextUp
                                    ? 'bg-orange-500 text-white'
                                    : isFutureLocked
                                      ? 'bg-gray-100 text-gray-500'
                                      : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {stLower === 'completed' ? (
                                <CheckCircle2 className="h-5 w-5" />
                              ) : isFutureLocked ? (
                                <Lock className="h-4 w-4" />
                              ) : (
                                n
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-gray-900">
                                  Session {n}
                                  {total ? ` of ${total}` : ''}
                                </p>
                                {isNextUp ? (
                                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-700">
                                    Next
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                                {date ? (
                                  <span className="inline-flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5" />
                                    {formatDateLabel(date)}
                                  </span>
                                ) : null}
                                {timeRaw ? (
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5" />
                                    {formatTimeLabel(timeRaw)}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          <Badge
                            className={
                              stLower === 'completed'
                                ? 'border-green-200 bg-green-100 text-green-800'
                                : stLower === 'in_progress'
                                  ? 'border-purple-200 bg-purple-100 text-purple-800'
                                  : stLower === 'arrived'
                                    ? 'border-amber-200 bg-amber-100 text-amber-800'
                                    : stLower === 'scheduled' || (stLower === 'pending' && !!date)
                                      ? 'border-blue-200 bg-blue-100 text-blue-800'
                                      : 'bg-gray-100 text-gray-700'
                            }
                          >
                            {statusLabel}
                          </Badge>
                        </div>

                        {showLive ? (
                          <div className="border-t border-gray-100 bg-gray-50/60 px-3 py-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                              onClick={() => openLiveJourney(bid)}
                            >
                              <Navigation className="h-3.5 w-3.5" />
                              Live journey
                            </Button>
                          </div>
                        ) : null}
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="px-1 pt-2 text-center text-[11px] text-gray-500">
              Each session also appears as its own booking. Use that booking row to verify start
              and end OTPs with the customer.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
