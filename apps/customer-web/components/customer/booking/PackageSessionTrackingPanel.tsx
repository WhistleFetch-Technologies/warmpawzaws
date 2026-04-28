'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Clock, Key, Loader2, Lock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useRouter } from 'next/navigation';

type SessionItem = {
  id: string;
  bookingId: string;
  sessionNumber: number;
  status: string;
  serviceStyle?: string;
  serviceType?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  otpCode?: string;
  completionOtp?: string;
};

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
        sessionNumber,
        status: String(s.display_status ?? s.displayStatus ?? s.status ?? 'pending').toLowerCase(),
        serviceStyle: String(s.service_style ?? s.serviceStyle ?? ''),
        serviceType: String(s.service_type ?? s.serviceType ?? ''),
        scheduledDate: String(s.scheduled_date ?? s.scheduledDate ?? s.booking_date ?? ''),
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

  const openSessionDirections = async (row: SessionItem) => {
    const bookingId = await resolveBookingIdForRow(row);
    if (!bookingId) {
      toast.info('Booking id not linked yet for this package.');
      return;
    }
    try {
      const res = (await apiClient.get(`/tracking/booking/${encodeURIComponent(bookingId)}`)) as Record<string, any>;
      const destination = (res?.destination || res?.destinationLocation || res?.current_location || res?.currentLocation || {}) as Record<string, unknown>;
      const lat = Number((destination as any).latitude ?? (destination as any).lat);
      const lng = Number((destination as any).longitude ?? (destination as any).lng);
      const address = String((destination as any).address ?? '').trim();
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
        return;
      }
      if (address) {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
        return;
      }
      await openSessionTracking(row);
    } catch {
      await openSessionTracking(row);
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
        const style = (row.serviceStyle || row.serviceType || packageServiceStyle || '').toLowerCase();
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
                <p className="inline-flex items-center gap-1 text-xs font-medium text-gray-700">
                  <Key className="h-3.5 w-3.5 text-orange-600" />
                  OTP for active session
                </p>
                {otpValue ? (
                  <p className="font-mono text-base font-bold tracking-widest text-gray-900">{otpValue}</p>
                ) : (
                  <p className="text-xs text-gray-500">
                    OTP not available yet. Use refresh after provider starts this session.
                  </p>
                )}
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
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

