'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Navigation,
  Package,
  CheckCircle,
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

function isTeleLike(s: SessionRow): boolean {
  const t = String(s.service_type || s.serviceType || s.service_style || s.serviceStyle || '')
    .toLowerCase()
    .trim();
  return ['tele', 'video_consultation', 'tele_consultation', 'online'].includes(t) || t.includes('tele');
}

function sessionNeedsWalkTracker(s: SessionRow): boolean {
  const t = String(s.service_type || s.serviceType || '').toLowerCase();
  const st = String(s.service_style || s.serviceStyle || '').toLowerCase();
  const atHome = st === 'at_home' || st === 'home' || st === 'home_visit';
  const walkish = t.includes('walk') || t === 'walking' || t.includes('sit');
  return atHome && walkish;
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
  const [completeModalBookingId, setCompleteModalBookingId] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);

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

  const formatTimeShort = (t: string) => {
    const x = String(t || '').trim();
    if (!x) return '';
    return x.length >= 8 ? x.slice(0, 5) : x;
  };

  const vendorId =
    typeof window !== 'undefined'
      ? localStorage.getItem('vendorId') || localStorage.getItem('vendor_id') || ''
      : '';

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

  const submitCompleteOtp = async () => {
    const bid = completeModalBookingId;
    if (!bid || otp.trim().length !== 4) {
      toast.error('Enter the 4-digit OTP from the customer');
      return;
    }
    setOtpBusy(true);
    try {
      const data = (await apiClient.post(`/vendor/bookings/${encodeURIComponent(bid)}/complete`, {
        vendorId: vendorId || undefined,
        otp: otp.trim(),
      })) as { success?: boolean; error?: string };
      if (data?.success) {
        toast.success('Visit completed');
        setCompleteModalBookingId(null);
        setOtp('');
        void load();
      } else {
        toast.error(data?.error || 'Could not complete');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Request failed';
      toast.error(msg);
    } finally {
      setOtpBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <div className="mx-auto max-w-lg">
        <div className="mb-4 flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon" onClick={() => router.back()} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="flex min-w-0 flex-1 items-center gap-2 text-lg font-semibold text-gray-900">
            <Package className="h-5 w-5 shrink-0 text-orange-600" />
            <span className="truncate">Package sessions</span>
          </h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-orange-500" />
          </div>
        ) : (
          <>
            <Card className="mb-4 border-orange-100 bg-orange-50/80 p-4">
              <p className="font-semibold text-gray-900">{pkgName}</p>
              <p className="mt-2 text-sm text-gray-800">
                {completed}/{total > 0 ? total : sessions.length || '—'} completed
                {typeof remaining === 'number' && !pkg?.unlimited_usage ? (
                  <span className="text-gray-600"> · {remaining} remaining</span>
                ) : null}
                {pkg?.unlimited_usage ? <span className="text-gray-600"> · Unlimited</span> : null}
              </p>
            </Card>

            <h2 className="mb-2 text-sm font-semibold text-gray-800">Sessions</h2>
            {sessions.length === 0 ? (
              <Card className="p-6 text-center text-sm text-gray-500">No scheduled session rows.</Card>
            ) : (
              <ul className="space-y-2">
                {sessions.map((s, idx) => {
                  const n = s.session_number ?? s.sessionNumber ?? idx + 1;
                  const st = (
                    s.display_status ||
                    s.displayStatus ||
                    s.status ||
                    s.booking_status ||
                    'pending'
                  ).toString();
                  const stLower = st.toLowerCase();
                  const date =
                    s.scheduled_date || s.scheduledDate || s.booking_date || '';
                  const timeRaw = s.scheduled_time || s.scheduledTime || s.booking_time || '';
                  const time = formatTimeShort(String(timeRaw));
                  const isNextUp = nextSessionNumber != null && Number(n) === nextSessionNumber;
                  const statusLabel =
                    stLower === 'completed'
                      ? 'done'
                      : stLower === 'in_progress'
                        ? 'In progress'
                        : stLower === 'scheduled' || (stLower === 'pending' && !!date)
                          ? 'Scheduled'
                          : stLower === 'pending'
                            ? 'Pending'
                            : st;
                  const bid = String(s.bookingId || s.booking_id || '').trim();
                  const bst = String(s.booking_status || '').toLowerCase();
                  const canCompleteOtp =
                    !!bid &&
                    !isTeleLike(s) &&
                    (bst === 'confirmed' || bst === 'in_progress' || bst === 'arrived');
                  const showLive =
                    !!bid &&
                    sessionNeedsWalkTracker(s) &&
                    ['confirmed', 'pending', 'traveling', 'vendor_on_way', 'in_progress', 'arrived'].includes(bst);

                  return (
                    <li key={s.id || `${n}-${idx}`}>
                      <Card
                        className={`flex flex-col gap-2 p-3 ${
                          isNextUp ? 'ring-2 ring-orange-400 ring-offset-1 border-orange-200' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-gray-900">
                              Session {n}
                              {total ? ` of ${total}` : ''}
                              {isNextUp ? (
                                <span className="ml-2 text-xs font-semibold text-orange-600">· Next</span>
                              ) : null}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-600">
                              {date ? (
                                <span className="inline-flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {date}
                                </span>
                              ) : null}
                              {time ? (
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  {time}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <Badge
                            className={
                              stLower === 'completed'
                                ? 'border-green-200 bg-green-100 text-green-800'
                                : stLower === 'scheduled' || (stLower === 'pending' && !!date)
                                  ? 'border-blue-200 bg-blue-100 text-blue-800'
                                  : stLower === 'in_progress'
                                    ? 'border-purple-200 bg-purple-100 text-purple-800'
                                    : 'bg-gray-100 text-gray-700'
                            }
                          >
                            {stLower === 'completed' ? (
                              <span className="inline-flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Done
                              </span>
                            ) : (
                              statusLabel
                            )}
                          </Badge>
                        </div>

                        {bid ? (
                          <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-2">
                            {showLive ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="gap-1 text-blue-700 border-blue-200"
                                onClick={() => openLiveJourney(bid)}
                              >
                                <Navigation className="h-3.5 w-3.5" />
                                Live journey
                              </Button>
                            ) : null}
                            {canCompleteOtp && stLower !== 'completed' ? (
                              <Button
                                type="button"
                                size="sm"
                                className="gap-1 bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => {
                                  setOtp('');
                                  setCompleteModalBookingId(bid);
                                }}
                              >
                                <MapPin className="h-3.5 w-3.5" />
                                Complete (OTP)
                              </Button>
                            ) : null}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 border-t border-gray-100 pt-2">
                            No booking linked yet for this slot.
                          </p>
                        )}
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>

      {completeModalBookingId ? (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 sm:items-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Complete session</h3>
            <p className="mt-1 text-sm text-gray-600">
              Enter the customer&apos;s 4-digit OTP for booking{' '}
              <span className="font-mono text-xs">{completeModalBookingId.slice(0, 8)}…</span>
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="mt-4 w-full rounded-xl border border-gray-300 px-4 py-3 text-center text-2xl tracking-[0.4em] font-mono"
              placeholder="••••"
              autoComplete="one-time-code"
            />
            <div className="mt-4 flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={otpBusy}
                onClick={() => {
                  setCompleteModalBookingId(null);
                  setOtp('');
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 gap-1 bg-green-600 hover:bg-green-700"
                disabled={otpBusy || otp.length !== 4}
                onClick={() => void submitCompleteOtp()}
              >
                {otpBusy ? (
                  '…'
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Complete
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
