'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Key,
  Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { customerBookingStatusShowsCheckInOtp } from '@/lib/booking-display-utils';
import { toast } from 'sonner';

function copyTextToClipboard(text: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(text);
    return;
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  } catch {
    /* ignore */
  }
}

export type PackagePurchaseSessionsViewProps = {
  packagePurchaseId: string;
  /** Used for display / secondary calls; optional when JWT suffices. */
  phone?: string;
  onBack?: () => void;
};

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
  completed_at?: string;
  bookingId?: string;
  booking_id?: string;
  otpCode?: string;
  otp_code?: string;
  startOTP?: string;
  start_otp?: string;
  completionOTP?: string;
  completion_otp?: string;
  otpVerified?: boolean;
  otp_verified?: boolean;
  serviceType?: string;
  service_type?: string;
  serviceStyle?: string;
  service_style?: string;
};

export function PackagePurchaseSessionsView({
  packagePurchaseId,
  phone: _phone,
  onBack,
}: PackagePurchaseSessionsViewProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [pkg, setPkg] = useState<Record<string, unknown> | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [showOtpForKey, setShowOtpForKey] = useState<string | null>(null);
  const [showEndOtpForKey, setShowEndOtpForKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = (await apiClient.get(
        `/packages/${encodeURIComponent(packagePurchaseId)}/sessions`
      )) as {
        success?: boolean;
        package?: Record<string, unknown>;
        sessions?: SessionRow[];
        summary?: Record<string, number>;
        error?: string;
      };
      if (!res?.success && res?.error) {
        toast.error(res.error);
        setPkg(null);
        setSessions([]);
        setSummary(null);
        return;
      }
      setPkg(res.package ?? null);
      setSessions(Array.isArray(res.sessions) ? res.sessions : []);
      setSummary(res.summary ?? null);
    } catch (e: unknown) {
      console.error('[PackagePurchaseSessionsView]', e);
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

  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  const pkgName =
    (pkg?.package_name as string) ||
    (pkg?.packageName as string) ||
    'Your package';
  const vendorName = (pkg?.vendor_name as string) || '';
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

  /** First session (by number) not completed/cancelled — highlight as “next”. */
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

  /** API may return `YYYY-MM-DD` or ISO timestamps — avoid raw `...T00:00:00.000Z` in the UI. */
  const formatSessionDateLabel = (raw: string) => {
    const x = String(raw || '').trim();
    if (!x) return '';
    const d = x.includes('T') ? new Date(x) : new Date(`${x.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return x.length >= 10 ? x.slice(0, 10) : x;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen min-h-[100dvh] w-full max-w-customer mx-auto bg-gray-50 cw-header-safe-top cw-header-safe-x pb-24">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-white/95 px-3 py-3 backdrop-blur">
        <Button type="button" variant="ghost" size="icon" onClick={handleBack} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Package className="h-5 w-5 shrink-0 text-purple-600" />
            Package progress
          </h1>
          {vendorName ? (
            <p className="truncate text-xs text-gray-500">{vendorName}</p>
          ) : null}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-orange-500" />
          </div>
        ) : (
          <>
            <Card className="p-4 border-purple-100 bg-gradient-to-r from-purple-50 to-indigo-50">
              <p className="font-semibold text-gray-900">{pkgName}</p>
              <p className="mt-2 text-sm text-purple-800">
                {completed}/{total > 0 ? total : sessions.length || '—'} sessions completed
                {typeof remaining === 'number' && !pkg?.unlimited_usage ? (
                  <span className="text-gray-600"> · {remaining} remaining</span>
                ) : null}
                {pkg?.unlimited_usage ? (
                  <span className="text-gray-600"> · Unlimited</span>
                ) : null}
              </p>
            </Card>

            <h2 className="text-sm font-semibold text-gray-800 px-1">Sessions</h2>
            {sessions.length === 0 ? (
              <Card className="p-6 text-center text-sm text-gray-500">
                No session rows yet. Bookings linked to this package will appear here when scheduled.
              </Card>
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
                  const dateRaw =
                    s.scheduled_date ||
                    s.scheduledDate ||
                    s.booking_date ||
                    '';
                  const date = formatSessionDateLabel(String(dateRaw));
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
                  const rowKey = String(s.id || s.bookingId || s.booking_id || `${n}-${idx}`);
                  const bookingId = (s.bookingId || s.booking_id || '').toString();
                  const visitStatus = (
                    s.booking_status ||
                    s.display_status ||
                    s.displayStatus ||
                    s.status ||
                    ''
                  )
                    .toString()
                    .toLowerCase();
                  const otpCode = (s.otpCode || s.otp_code || '').toString().trim();
                  const startOTP = (s.startOTP || s.start_otp || '').toString().trim();
                  const completionOTP = (s.completionOTP || s.completion_otp || '').toString().trim();
                  const primaryOtp = (otpCode || startOTP || completionOTP).trim();
                  const otpVerified = Boolean(s.otpVerified ?? s.otp_verified);
                  const serviceType = (s.serviceType || s.service_type || '').toString().toLowerCase();
                  const serviceStyle = (s.serviceStyle || s.service_style || serviceType || '').toString().toLowerCase();
                  const atHome = serviceStyle === 'at_home' || serviceType === 'at_home';
                  const showCheckInOtp =
                    !!bookingId &&
                    !!primaryOtp &&
                    customerBookingStatusShowsCheckInOtp(visitStatus) &&
                    !otpVerified;
                  const showEndOtp =
                    otpVerified &&
                    visitStatus === 'in_progress' &&
                    atHome &&
                    !!(completionOTP || otpCode);
                  const endCode = (completionOTP || otpCode).trim();
                  const otpLabel =
                    serviceStyle === 'at_home' || serviceType === 'at_home'
                      ? 'Service OTP'
                      : serviceStyle === 'at_center' || serviceType === 'at_center'
                        ? 'Check-in OTP'
                        : 'Session OTP';
                  const otpHint =
                    serviceStyle === 'at_home' || serviceType === 'at_home'
                      ? 'Share with the vendor when they arrive for this session.'
                      : serviceStyle === 'at_center' || serviceType === 'at_center'
                        ? 'Share with the vendor at check-in for this session.'
                        : 'Share with the vendor for this session.';
                  return (
                    <li key={s.id || `${n}-${idx}`}>
                      <Card
                        className={`flex flex-col gap-3 p-3 ${
                          isNextUp ? 'ring-2 ring-orange-400 ring-offset-2 border-orange-200' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900">
                              Session {n}
                              {total ? ` of ${total}` : ''}
                              {isNextUp ? (
                                <span className="ml-2 text-xs font-semibold text-orange-600">· Next</span>
                              ) : null}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
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
                            variant="secondary"
                            className={
                              stLower === 'completed'
                                ? 'bg-green-100 text-green-800 border-green-200'
                                : stLower === 'scheduled' || (stLower === 'pending' && date)
                                  ? 'bg-blue-100 text-blue-800 border-blue-200'
                                  : stLower === 'in_progress'
                                    ? 'bg-purple-100 text-purple-800 border-purple-200'
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

                        {showCheckInOtp ? (
                          <div className="rounded-lg border border-orange-200 bg-orange-50/90 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <Key className="h-4 w-4 shrink-0 text-orange-700" />
                                <span className="text-sm font-medium text-orange-900">{otpLabel}</span>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <span className="font-mono text-base font-bold tracking-wider text-orange-700">
                                  {showOtpForKey === rowKey ? primaryOtp : '••••••'}
                                </span>
                                <button
                                  type="button"
                                  className="rounded p-1 hover:bg-orange-100"
                                  aria-label={showOtpForKey === rowKey ? 'Hide OTP' : 'Show OTP'}
                                  onClick={() =>
                                    setShowOtpForKey(showOtpForKey === rowKey ? null : rowKey)
                                  }
                                >
                                  {showOtpForKey === rowKey ? (
                                    <EyeOff className="h-4 w-4 text-orange-700" />
                                  ) : (
                                    <Eye className="h-4 w-4 text-orange-700" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  className="rounded p-1 hover:bg-orange-100"
                                  aria-label="Copy OTP"
                                  onClick={() => {
                                    copyTextToClipboard(primaryOtp);
                                    setCopiedKey(`${rowKey}-start`);
                                    toast.success('OTP copied');
                                    setTimeout(() => setCopiedKey(null), 2000);
                                  }}
                                >
                                  {copiedKey === `${rowKey}-start` ? (
                                    <Check className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <Copy className="h-4 w-4 text-orange-700" />
                                  )}
                                </button>
                              </div>
                            </div>
                            <p className="mt-2 text-xs text-orange-900/85">{otpHint}</p>
                          </div>
                        ) : null}

                        {otpVerified && visitStatus !== 'completed' ? (
                          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50/90 p-2 text-green-800">
                            <Check className="h-4 w-4 shrink-0" />
                            <span className="text-sm">Check-in verified for this visit</span>
                          </div>
                        ) : null}

                        {showEndOtp ? (
                          <div className="rounded-lg border border-amber-200 bg-amber-50/90 p-3">
                            <div className="mb-1 flex items-center gap-2">
                              <Key className="h-4 w-4 text-amber-900" />
                              <span className="text-sm font-semibold text-amber-950">End-of-service OTP</span>
                            </div>
                            <p className="mb-2 text-xs text-amber-900/90">
                              When this visit is finished, share this code so your provider can complete the booking.
                            </p>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-base font-bold tracking-wider text-amber-950">
                                {showEndOtpForKey === rowKey ? endCode : '••••••'}
                              </span>
                              <div className="flex shrink-0 gap-1">
                                <button
                                  type="button"
                                  className="rounded p-1 hover:bg-amber-100"
                                  aria-label={showEndOtpForKey === rowKey ? 'Hide end OTP' : 'Show end OTP'}
                                  onClick={() =>
                                    setShowEndOtpForKey(showEndOtpForKey === rowKey ? null : rowKey)
                                  }
                                >
                                  {showEndOtpForKey === rowKey ? (
                                    <EyeOff className="h-4 w-4 text-amber-900" />
                                  ) : (
                                    <Eye className="h-4 w-4 text-amber-900" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  className="rounded p-1 hover:bg-amber-100"
                                  aria-label="Copy end OTP"
                                  onClick={() => {
                                    copyTextToClipboard(endCode);
                                    setCopiedKey(`${rowKey}-end`);
                                    toast.success('End OTP copied');
                                    setTimeout(() => setCopiedKey(null), 2000);
                                  }}
                                >
                                  {copiedKey === `${rowKey}-end` ? (
                                    <Check className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <Copy className="h-4 w-4 text-amber-900" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
