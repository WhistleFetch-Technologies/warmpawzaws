'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, CheckCircle2, Clock, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

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
};

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
                  const date =
                    s.scheduled_date || s.scheduledDate || s.booking_date || '';
                  const time = s.scheduled_time || s.scheduledTime || s.booking_time || '';
                  return (
                    <li key={s.id || `${n}-${idx}`}>
                      <Card className="flex items-start justify-between gap-3 p-3">
                        <div>
                          <p className="font-medium text-gray-900">
                            Session {n}
                            {total ? ` of ${total}` : ''}
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
                            st === 'completed'
                              ? 'border-green-200 bg-green-100 text-green-800'
                              : st === 'scheduled'
                                ? 'border-blue-200 bg-blue-100 text-blue-800'
                                : st === 'in_progress'
                                  ? 'border-purple-200 bg-purple-100 text-purple-800'
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
