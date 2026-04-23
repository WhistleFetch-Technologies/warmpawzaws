'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, CheckCircle2, Clock, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

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
  status?: string;
  scheduled_date?: string;
  scheduledDate?: string;
  scheduled_time?: string;
  scheduledTime?: string;
  booking_status?: string;
  booking_date?: string;
  booking_time?: string;
  completed_at?: string;
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
                  const st = (s.status || s.booking_status || 'pending').toString();
                  const date =
                    s.scheduled_date ||
                    s.scheduledDate ||
                    s.booking_date ||
                    '';
                  const time = s.scheduled_time || s.scheduledTime || s.booking_time || '';
                  return (
                    <li key={s.id || `${n}-${idx}`}>
                      <Card className="flex items-start justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">
                            Session {n}
                            {total ? ` of ${total}` : ''}
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
                            st === 'completed'
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : st === 'scheduled'
                                ? 'bg-blue-100 text-blue-800 border-blue-200'
                                : 'bg-gray-100 text-gray-700'
                          }
                        >
                          {st === 'completed' ? (
                            <span className="inline-flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Done
                            </span>
                          ) : (
                            st
                          )}
                        </Badge>
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
