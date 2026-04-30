'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calendar, Check, CheckCircle2, Clock, Copy, Eye, EyeOff, Key, Loader2, Lock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useRouter } from 'next/navigation';

type SessionItem = {
  id: string;
  bookingId: string;
  parentBookingId?: string;
  packagePurchaseId?: string;
  sessionNumber: number;
  status: string;
  serviceStyle?: string;
  serviceType?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  otpCode?: string;
  completionOtp?: string;
};

function normalizeSessionDateOnly(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const ymd = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (ymd?.[1]) return ymd[1];
  return raw.includes('T') ? raw.split('T')[0] : raw;
}

function normalizeSessionRows(rows: unknown): SessionItem[] {
  if (!Array.isArray(rows)) return [];
  const firstBookingId = rows
    .map((raw) => {
      if (!raw || typeof raw !== 'object') return '';
      const s = raw as Record<string, unknown>;
      return String(s.bookingId ?? s.booking_id ?? '').trim();
    })
    .find(Boolean) || '';
  return rows
    .map((raw, idx) => {
      if (!raw || typeof raw !== 'object') return null;
      const s = raw as Record<string, unknown>;
      const sessionNumber = Number(s.session_number ?? s.sessionNumber ?? idx + 1) || idx + 1;
      return {
        id: String(s.id ?? `session-${sessionNumber}`),
        bookingId: String(s.bookingId ?? s.booking_id ?? firstBookingId ?? ''),
        parentBookingId: String(s.parentBookingId ?? s.parent_booking_id ?? ''),
        packagePurchaseId: String(s.packagePurchaseId ?? s.package_purchase_id ?? ''),
        sessionNumber,
        status: String(s.display_status ?? s.displayStatus ?? s.status ?? 'pending').toLowerCase(),
        serviceStyle: String(s.service_style ?? s.serviceStyle ?? ''),
        serviceType: String(s.service_type ?? s.serviceType ?? ''),
        scheduledDate: normalizeSessionDateOnly(
          s.scheduled_date ?? s.scheduledDate ?? s.booking_date ?? ''
        ),
        scheduledTime: String(s.scheduled_time ?? s.scheduledTime ?? s.booking_time ?? ''),
        otpCode: String(s.otp_code ?? s.otpCode ?? s.start_otp ?? s.startOTP ?? ''),
        completionOtp: String(s.completion_otp ?? s.completionOtp ?? ''),
      } as SessionItem;
    })
    .filter((x): x is SessionItem => Boolean(x))
    .sort((a, b) => a.sessionNumber - b.sessionNumber);
}

function notificationStorageKey(packagePurchaseId: string, sessionNumber: number): string {
  return `warmpawz_pkg_reminder_${packagePurchaseId}_${sessionNumber}`;
}

async function scheduleCapacitorReminder(
  session: SessionItem,
  packagePurchaseId: string,
  notifyAtMs: number
): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as {
    Capacitor?: {
      Plugins?: {
        LocalNotifications?: {
          requestPermissions?: () => Promise<{ display?: 'granted' | 'denied' }>;
          schedule?: (args: {
            notifications: Array<{
              id: number;
              title: string;
              body: string;
              schedule: { at: Date; allowWhileIdle?: boolean };
              extra?: Record<string, unknown>;
            }>;
          }) => Promise<unknown>;
        };
      };
    };
  }).Capacitor;
  const plugin = cap?.Plugins?.LocalNotifications;
  if (!plugin?.schedule) return false;
  try {
    const p = await plugin.requestPermissions?.();
    if (p?.display === 'denied') return false;
    const notificationId = Number(`${Date.now()}`.slice(-6)) + session.sessionNumber;
    await plugin.schedule({
      notifications: [
        {
          id: notificationId,
          title: 'Session starts in 30 minutes',
          body: `Package session ${session.sessionNumber} is coming up.`,
          schedule: { at: new Date(notifyAtMs), allowWhileIdle: true },
          extra: {
            packagePurchaseId,
            sessionNumber: session.sessionNumber,
          },
        },
      ],
    });
    return true;
  } catch {
    return false;
  }
}

function scheduleBrowserReminder(session: SessionItem, packagePurchaseId: string, notifyAtMs: number) {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return false;
  if (!session.scheduledDate || !session.scheduledTime) return;
  if (session.status === 'completed') return;

  const delay = notifyAtMs - Date.now();
  if (!Number.isFinite(delay) || delay <= 0) return false;

  const enqueue = () => {
    window.setTimeout(() => {
      try {
        new Notification('Session starts in 30 minutes', {
          body: `Package session ${session.sessionNumber} is coming up.`,
        });
      } catch {
        // Browser-level notification may fail silently.
      }
    }, delay);
  };

  if (Notification.permission === 'granted') {
    enqueue();
    return true;
  }
  if (Notification.permission !== 'denied') {
    void Notification.requestPermission().then((p) => {
      if (p === 'granted') enqueue();
    });
    return true;
  }
  return false;
}

async function scheduleSessionReminder(session: SessionItem, packagePurchaseId: string) {
  if (typeof window === 'undefined') return;
  if (!session.scheduledDate || !session.scheduledTime) return;
  if (session.status === 'completed') return;
  const sessionAt = new Date(`${session.scheduledDate}T${session.scheduledTime}`);
  const notifyAtMs = sessionAt.getTime() - 30 * 60 * 1000;
  if (!Number.isFinite(notifyAtMs) || notifyAtMs <= Date.now()) return;

  const key = notificationStorageKey(packagePurchaseId, session.sessionNumber);
  if (localStorage.getItem(key) === 'scheduled') return;

  const viaCapacitor = await scheduleCapacitorReminder(session, packagePurchaseId, notifyAtMs);
  if (viaCapacitor) {
    localStorage.setItem(key, 'scheduled');
    return;
  }
  if (scheduleBrowserReminder(session, packagePurchaseId, notifyAtMs)) {
    localStorage.setItem(key, 'scheduled');
  }
}

export function PackageSessionTrackingPanel({
  packagePurchaseId,
  packageServiceStyle,
}: {
  packagePurchaseId: string;
  packageServiceStyle?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [showOtpForSession, setShowOtpForSession] = useState<number | null>(null);
  const [copiedOtpForSession, setCopiedOtpForSession] = useState<number | null>(null);

  const loadSessions = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = (await apiClient.get(
        `/packages/${encodeURIComponent(packagePurchaseId)}/sessions`
      )) as { sessions?: unknown };
      setSessions(normalizeSessionRows(res?.sessions));
    } catch {
      setSessions([]);
      setErrorMessage('Could not load sessions. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSessions();
  }, [packagePurchaseId]);

  useEffect(() => {
    void Promise.all(sessions.map((s) => scheduleSessionReminder(s, packagePurchaseId)));
  }, [sessions, packagePurchaseId]);

  const firstPendingSession = useMemo(
    () => sessions.find((s) => s.status !== 'completed')?.sessionNumber ?? null,
    [sessions]
  );

  const resolveBookingIdForRow = async (row: SessionItem): Promise<string> => {
    const direct = String(row.bookingId || '').trim();
    if (direct) return direct;
    const res = (await apiClient.get(
      `/packages/${encodeURIComponent(packagePurchaseId)}/sessions`
    )) as {
      sessions?: Array<{ bookingId?: string; booking_id?: string }>;
      package?: Record<string, unknown>;
    };
    const sessions = Array.isArray(res?.sessions) ? res.sessions : [];
    const fromSession = String(
      sessions.find((s) => String(s?.bookingId ?? s?.booking_id ?? '').trim())?.bookingId ??
        sessions.find((s) => String(s?.bookingId ?? s?.booking_id ?? '').trim())?.booking_id ??
        ''
    ).trim();
    if (fromSession) return fromSession;
    const fromPackage = String(
      (res?.package?.last_booking_id as string) ??
        (res?.package?.booking_id as string) ??
        ''
    ).trim();
    return fromPackage;
  };

  const openSessionTracking = async (row: SessionItem) => {
    const bookingId = await resolveBookingIdForRow(row);
    if (!bookingId) {
      toast.info('Booking id not linked yet for this package.');
      return;
    }
    const phone =
      typeof window !== 'undefined'
        ? localStorage.getItem('customerPhone') || localStorage.getItem('customer_phone')
        : '';
    const base = `/tracking/${encodeURIComponent(bookingId)}`;
    const href = phone ? `${base}?phone=${encodeURIComponent(phone)}` : base;
    router.push(href);
  };

  const copyOtp = async (otp: string, sessionNumber: number) => {
    const val = String(otp || '').trim();
    if (!val) return;
    try {
      await navigator.clipboard.writeText(val);
      setCopiedOtpForSession(sessionNumber);
      window.setTimeout(() => setCopiedOtpForSession((cur) => (cur === sessionNumber ? null : cur)), 1400);
      toast.success('OTP copied');
    } catch {
      toast.error('Unable to copy OTP');
    }
  };

  const openSessionDirections = async (row: SessionItem) => {
    const bookingId = await resolveBookingIdForRow(row);
    if (!bookingId) {
      toast.info('Location not linked yet for this session.');
      return;
    }
    try {
      const res = (await apiClient.get(`/tracking/booking/${encodeURIComponent(bookingId)}`)) as Record<string, any>;
      const destination = (res?.destination || res?.destinationLocation || res?.current_location || res?.currentLocation || {}) as Record<string, unknown>;
      const lat = Number(
        (destination as any).latitude ??
          (destination as any).lat ??
          res?.vendor_latitude ??
          res?.vendorLatitude ??
          res?.tracking?.vendor_latitude ??
          res?.tracking?.vendorLatitude
      );
      const lng = Number(
        (destination as any).longitude ??
          (destination as any).lng ??
          res?.vendor_longitude ??
          res?.vendorLongitude ??
          res?.tracking?.vendor_longitude ??
          res?.tracking?.vendorLongitude
      );
      const address = String(
        (destination as any).address ??
          res?.destination_address ??
          res?.vendor_address ??
          res?.tracking?.vendor_address ??
          ''
      ).trim();
      const placeName = String(
        res?.vendor_name ?? res?.vendorName ?? res?.tracking?.vendor_name ?? res?.tracking?.vendorName ?? ''
      ).trim();
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
        return;
      }
      if (address) {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
        return;
      }
      if (placeName) {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName)}`, '_blank');
        return;
      }
      toast.info('Center location is not available yet for directions.');
    } catch {
      toast.info('Unable to open directions right now. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-stone-200 bg-white p-6">
        <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50 p-4 text-sm text-gray-600">
        {errorMessage || 'No session rows yet for this package.'}
        {errorMessage ? (
          <button
            type="button"
            onClick={() => void loadSessions()}
            className="ml-2 inline-flex items-center gap-1 rounded-md border border-stone-300 px-2 py-1 text-xs font-semibold text-gray-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sessions.map((row) => {
        const key = row.id || String(row.sessionNumber);
        const locked =
          firstPendingSession != null &&
          row.sessionNumber > firstPendingSession &&
          row.status !== 'completed';
        const isCurrent = firstPendingSession === row.sessionNumber && row.status !== 'completed';
        const otpValue = row.completionOtp || row.otpCode || '';
        const style = (packageServiceStyle || row.serviceStyle || row.serviceType || '').toLowerCase();
        const isAtCenter = style === 'at_center';
        const isAtHome = style === 'at_home';

        return (
          <div
            key={key}
            className={`rounded-xl border p-3 ${
              locked ? 'border-stone-200 bg-stone-50 opacity-70' : 'border-stone-200 bg-white'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-900">Session {row.sessionNumber}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  {row.scheduledDate ? (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {row.scheduledDate}
                    </span>
                  ) : null}
                  {row.scheduledTime ? (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {row.scheduledTime}
                    </span>
                  ) : null}
                </div>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  row.status === 'completed'
                    ? 'bg-green-100 text-green-700'
                    : isCurrent
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-gray-100 text-gray-600'
                }`}
              >
                {row.status === 'completed' ? 'Completed' : isCurrent ? 'Pending' : 'Locked'}
              </span>
            </div>

            {locked ? (
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-gray-500">
                <Lock className="h-3.5 w-3.5" />
                Complete previous session to unlock
              </p>
            ) : null}

            <div className="mt-3">
              <button
                type="button"
                onClick={() => {
                  if (isAtCenter) {
                    void openSessionDirections(row);
                    return;
                  }
                  void openSessionTracking(row);
                }}
                disabled={locked}
                className="h-9 rounded-lg border border-blue-300 px-3 text-xs font-semibold text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isAtCenter ? 'Directions' : isAtHome ? 'Tracker' : 'Track'}
              </button>
            </div>

            {row.status === 'completed' ? (
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-green-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                This session is completed
              </p>
            ) : isCurrent ? (
              <div className="mt-3 space-y-2">
                {/*
                 * Inline OTP only for at_center sessions (per product split):
                 *   - at_center: customer shares OTP with vendor at the desk → show inline.
                 *   - at_home:   OTP lives on the dedicated per-session tracking page
                 *                (mirrors a normal home booking) → "Open tracker" CTA.
                 *   - tele:      no OTP at all.
                 */}
                {isAtCenter ? (
                  <>
                    <p className="inline-flex items-center gap-1 text-xs font-medium text-gray-700">
                      <Key className="h-3.5 w-3.5 text-orange-600" />
                      Check-in OTP
                    </p>
                    {otpValue ? (
                      <div className="rounded-lg bg-orange-50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-mono text-base font-bold tracking-widest text-gray-900">
                            {showOtpForSession === row.sessionNumber ? otpValue : '••••••'}
                          </p>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setShowOtpForSession((cur) => (cur === row.sessionNumber ? null : row.sessionNumber))
                              }
                              className="rounded p-1 hover:bg-orange-100"
                              aria-label={showOtpForSession === row.sessionNumber ? 'Hide OTP' : 'Show OTP'}
                            >
                              {showOtpForSession === row.sessionNumber ? (
                                <EyeOff className="h-4 w-4 text-orange-700" />
                              ) : (
                                <Eye className="h-4 w-4 text-orange-700" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => void copyOtp(otpValue, row.sessionNumber)}
                              className="rounded p-1 hover:bg-orange-100"
                              aria-label="Copy OTP"
                            >
                              {copiedOtpForSession === row.sessionNumber ? (
                                <Check className="h-4 w-4 text-green-700" />
                              ) : (
                                <Copy className="h-4 w-4 text-orange-700" />
                              )}
                            </button>
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-gray-600">
                          Share this OTP with the vendor at check-in.
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">
                        OTP not available yet. Use refresh after provider starts this session.
                      </p>
                    )}
                  </>
                ) : null}
                {/*
                 * Refresh is only meaningful when the customer is waiting on the
                 * inline at_center check-in OTP to appear. For at_home sessions
                 * the OTP / status lives on the dedicated tracker page, so the
                 * button is hidden to keep the row clean.
                 */}
                {isAtCenter ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void loadSessions()}
                      className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-stone-300 px-3 text-xs font-semibold text-gray-700"
                      aria-label="Refresh sessions"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Refresh
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

