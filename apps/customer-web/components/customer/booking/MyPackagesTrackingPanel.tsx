'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, ChevronRight, MessageSquare, Package, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { PackageSessionTrackingPanel } from '@/components/customer/booking/PackageSessionTrackingPanel';

export type MyPackageSummaryRow = {
  id: string;
  packageName: string;
  vendorName?: string;
  vendorId?: string;
  totalSessions: number;
  sessionsUsed: number;
  remainingSessions: number;
  expiresAt?: string;
  serviceStyle?: string;
  status: string;
  expiringSoon?: boolean;
};

export function mapPackagesApiToSummaryRows(pkgs: unknown): MyPackageSummaryRow[] {
  const arr = Array.isArray(pkgs) ? pkgs : [];
  const out: MyPackageSummaryRow[] = [];
  for (const item of arr) {
    if (item == null || typeof item !== 'object') continue;
    const p = item as Record<string, unknown>;
    const id = String(
      p.id ?? p.purchase_id ?? p.package_purchase_id ?? p.packagePurchaseId ?? ''
    ).trim();
    if (!id) continue;
    const total = Number(p.total_sessions ?? p.totalSessions ?? 0);
    const used = Number(p.sessions_used ?? p.sessionsUsed ?? 0);
    const rawRemaining = p.remaining_sessions ?? p.remainingSessions;
    const remaining =
      typeof rawRemaining === 'string' && rawRemaining.toLowerCase() === 'unlimited'
        ? Number.MAX_SAFE_INTEGER
        : Number(rawRemaining ?? Math.max(0, total - used) ?? 0);
    const status = String(p.status ?? p.computed_status ?? 'active').toLowerCase();
    let expiringSoon = false;
    const exp = p.expires_at ?? p.expiresAt;
    if (exp && typeof exp === 'string') {
      const ms = new Date(exp).getTime() - Date.now();
      const days = ms / 86400000;
      expiringSoon = days >= 0 && days <= 7;
    }
    const vn = p.vendor_name ?? p.vendorName;
    const vendorId = p.vendor_id ?? p.vendorId;
    const serviceStyle = p.service_style ?? p.serviceStyle;
    const row: MyPackageSummaryRow = {
      id,
      packageName: String(p.package_name ?? p.packageName ?? 'Package'),
      totalSessions: total,
      sessionsUsed: used,
      remainingSessions: Number.isFinite(remaining) ? Math.max(0, remaining) : Number.MAX_SAFE_INTEGER,
      expiresAt: typeof exp === 'string' ? exp : undefined,
      serviceStyle: typeof serviceStyle === 'string' ? serviceStyle.toLowerCase() : undefined,
      status,
      expiringSoon,
    };
    if (typeof vn === 'string' && vn.trim()) row.vendorName = vn.trim();
    if (typeof vendorId === 'string' && vendorId.trim()) row.vendorId = vendorId.trim();
    out.push(row);
  }
  return out;
}

function computeProgressPct(row: MyPackageSummaryRow): number {
  if (!row.totalSessions || row.totalSessions <= 0) return 0;
  const pct = (Math.max(0, Number(row.sessionsUsed) || 0) / row.totalSessions) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

function formatExpiry(raw?: string): string {
  if (!raw) return 'No expiry date';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Orange “hub” — stats + deep links to `/packages/:id` (Package progress, source of truth).
 * `fullPage`: wallet-style white card + beige stat tiles; host supplies shell header (e.g. `/my-packages`).
 */
export function MyPackagesTrackingPanel({
  rows,
  customerPhone,
  variant = 'default',
}: {
  rows: MyPackageSummaryRow[];
  customerPhone?: string | null;
  variant?: 'default' | 'fullPage';
}) {
  const router = useRouter();
  const [selectedFilter, setSelectedFilter] = useState<'active' | 'sessions-left' | 'expiring'>('active');
  const [expandedPackageId, setExpandedPackageId] = useState<string | null>(null);
  const [messagingVendorId, setMessagingVendorId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const activeCount = rows.filter((r) => !['expired', 'exhausted', 'cancelled'].includes(r.status)).length;
  const sessionsLeft = rows.reduce((acc, r) => {
    if (r.remainingSessions === Number.MAX_SAFE_INTEGER) return acc;
    return acc + Math.max(0, Number(r.remainingSessions) || 0);
  }, 0);
  const expiringCount = rows.filter((r) => r.expiringSoon).length;

  const visibleRows = useMemo(() => {
    const arr = [...rows];
    if (selectedFilter === 'active') {
      return arr.filter((r) => !['expired', 'exhausted', 'cancelled', 'completed'].includes(r.status));
    }
    if (selectedFilter === 'sessions-left') {
      return arr
        .filter((r) => (r.remainingSessions === Number.MAX_SAFE_INTEGER ? true : r.remainingSessions > 0))
        .sort((a, b) => b.remainingSessions - a.remainingSessions);
    }
    return arr.sort((a, b) => {
      const ta = new Date(a.expiresAt || '').getTime();
      const tb = new Date(b.expiresAt || '').getTime();
      if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
      if (Number.isNaN(ta)) return 1;
      if (Number.isNaN(tb)) return -1;
      return ta - tb;
    });
  }, [rows, selectedFilter]);

  const statTiles: Array<{ key: 'active' | 'sessions-left' | 'expiring'; v: string; l: string }> = [
    { key: 'active', v: String(activeCount), l: 'Active' },
    { key: 'sessions-left', v: String(sessionsLeft), l: 'Sessions left' },
    { key: 'expiring', v: String(expiringCount), l: 'Expiring' },
  ];

  const openMessages = async (row: MyPackageSummaryRow) => {
    // A package purchase has ONE chat thread, anchored on the parent canonical
    // booking (is_package_session = false). The /packages/:id/sessions response
    // exposes that as `package.package_booking_id`. Per-session child bookings
    // are operational rows and are NOT used for chat.
    setMessagingVendorId(row.vendorId ?? row.id);
    let bookingId = '';
    try {
      const ses = (await apiClient.get(
        `/packages/${encodeURIComponent(row.id)}/sessions`
      )) as {
        package?: {
          package_booking_id?: string;
          packageBookingId?: string;
          booking_id?: string;
          bookingId?: string;
        };
      };
      bookingId = String(
        ses?.package?.package_booking_id ??
          ses?.package?.packageBookingId ??
          ses?.package?.booking_id ??
          ses?.package?.bookingId ??
          ''
      ).trim();
    } catch (err) {
      console.warn('[MyPackages] failed to resolve parent bookingId via /packages/:id/sessions', err);
    }

    // Fallback: scan the customer's bookings list for the parent of this purchase.
    if (!bookingId && customerPhone) {
      try {
        const bookingRes = (await apiClient.get(
          `/customer/${encodeURIComponent(customerPhone)}/bookings?limit=200`
        )) as {
          bookings?: Array<{
            id?: string;
            bookingId?: string;
            packagePurchaseId?: string;
            package_purchase_id?: string;
            isPackageSession?: boolean;
            is_package_session?: boolean;
          }>;
        };
        const bookings = Array.isArray(bookingRes?.bookings) ? bookingRes.bookings : [];
        const matched = bookings.find((b) => {
          const pp = String(b.packagePurchaseId ?? b.package_purchase_id ?? '').trim();
          const isChild = Boolean(b.isPackageSession ?? b.is_package_session);
          return pp && pp === row.id && !isChild;
        });
        bookingId = String(matched?.id ?? matched?.bookingId ?? '').trim();
      } catch (err) {
        console.warn('[MyPackages] failed to resolve parent bookingId via /customer/:phone/bookings', err);
      }
    }

    setMessagingVendorId(null);

    if (!bookingId) {
      toast.error('Booking not linked yet for this package');
      return;
    }
    router.push(`/chat?bookingId=${encodeURIComponent(bookingId)}`);
  };

  const onClickFilter = (f: 'active' | 'sessions-left' | 'expiring') => {
    setSelectedFilter(f);
    setExpandedPackageId(null);
    window.setTimeout(() => {
      listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  if (variant === 'fullPage') {
    return (
      <div className="px-3 pb-8 pt-1 sm:px-4">
        <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-sm">
          <p className="text-sm leading-relaxed text-gray-600">
            Tap a package for full session progress, dates, and OTPs when available.
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            {statTiles.map((s) => {
              const selected = selectedFilter === s.key;
              return (
                <button
                  key={s.l}
                  type="button"
                  onClick={() => onClickFilter(s.key)}
                  className={`flex flex-col justify-center rounded-xl px-2 py-3 text-center transition-all sm:px-3 sm:py-3.5 ${
                    selected
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'bg-[#F3EBE0] text-gray-900 hover:bg-[#EDE2D4]'
                  }`}
                >
                  <p className="text-lg font-bold tabular-nums sm:text-xl">{s.v}</p>
                  <p className={`mt-1 text-[10px] font-medium uppercase tracking-wide sm:text-[11px] ${selected ? 'text-white/90' : 'text-gray-600'}`}>
                    {s.l}
                  </p>
                </button>
              );
            })}
          </div>

          <div ref={listRef} className="mt-6 scroll-mt-24">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Your packages</p>
            {visibleRows.length === 0 ? (
              <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-stone-200 bg-stone-50/80 px-6 py-12 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-500">
                  <Package className="h-7 w-7" aria-hidden />
                </span>
                <p className="mt-4 text-base font-semibold text-gray-800">No packages for this filter</p>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-gray-600">
                  Try another filter or purchase a package to start tracking sessions and OTPs.
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-3 transition-all duration-200">
                {visibleRows.map((r) => {
                  const progress = computeProgressPct(r);
                  const remaining = r.remainingSessions === Number.MAX_SAFE_INTEGER ? 'Unlimited' : String(Math.max(0, r.remainingSessions));
                  const isExpired = ['expired', 'cancelled', 'exhausted'].includes(r.status);
                  const noSessionsLeft = r.remainingSessions !== Number.MAX_SAFE_INTEGER && r.remainingSessions <= 0;
                  const disabled = isExpired || noSessionsLeft;
                  const expanded = expandedPackageId === r.id;
                  return (
                    <article key={r.id} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-gray-900">{r.packageName}</p>
                            <p className="truncate text-sm text-gray-500">{r.vendorName || 'Provider'}</p>
                          </div>
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              isExpired ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {isExpired ? 'Expired' : noSessionsLeft ? 'Completed' : 'Active'}
                          </span>
                        </div>
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Sessions Used</span>
                            <span className="font-semibold text-gray-900">
                              {Number(r.sessionsUsed) || 0}/{r.totalSessions || '—'}
                            </span>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-stone-100">
                            <div
                              className="h-2 rounded-full bg-orange-400 transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (disabled) return;
                              // Always open per-session actions from My Packages.
                              setExpandedPackageId(expanded ? null : r.id);
                            }}
                            disabled={disabled}
                            className="inline-flex items-center justify-center gap-1 rounded-lg border border-purple-300 px-2 py-2 text-xs font-semibold text-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <PlayCircle className="h-3.5 w-3.5" />
                            Track
                          </button>
                          <button
                            type="button"
                            onClick={() => void openMessages(r)}
                            disabled={!r.vendorId || messagingVendorId === r.vendorId}
                            className="inline-flex items-center justify-center gap-1 rounded-lg border border-orange-300 px-2 py-2 text-xs font-semibold text-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            {messagingVendorId === r.vendorId ? 'Opening...' : 'Message'}
                          </button>
                        </div>
                        <div className="mt-3 flex items-center gap-1 text-xs text-gray-500">
                          <CalendarClock className="h-3.5 w-3.5" />
                          Expiry: {formatExpiry(r.expiresAt)} · Sessions left: {remaining}
                        </div>
                      </div>
                      {expanded ? (
                        <div className="border-t border-stone-200 bg-stone-50 p-3">
                          <PackageSessionTrackingPanel
                            packagePurchaseId={r.id}
                            packageServiceStyle={r.serviceStyle}
                          />
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-3 pt-2">
      <div className="overflow-hidden rounded-2xl border border-orange-200/90 bg-white shadow-sm">
        <div className="bg-[#FF8C42] px-4 py-3">
          <h2 className="text-lg font-bold text-white">My packages and tracking</h2>
          <p className="mt-0.5 text-xs text-white/90">
            Tap a package for full session progress, dates, and OTPs when available.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 bg-gradient-to-r from-[#FF8C42] to-[#FF7A35] px-3 py-3">
          {statTiles.map((s) => (
            <div
              key={s.l}
              className="rounded-xl bg-white/20 px-2 py-2 text-center backdrop-blur-[1px]"
            >
              <div className="text-lg font-bold leading-tight text-white">{s.v}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-white/90">{s.l}</div>
            </div>
          ))}
        </div>
        <div className="divide-y divide-gray-100 bg-white">
          {rows.length === 0 ? (
            <p className="px-4 py-4 text-center text-sm text-gray-500">
              No packages on your account yet. Purchased bundles will appear here.
            </p>
          ) : (
            rows.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => router.push(`/packages/${encodeURIComponent(r.id)}`)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-orange-50/70"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
                    <Package className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-gray-900">{r.packageName}</span>
                    {r.vendorName ? (
                      <span className="block truncate text-xs text-gray-500">{r.vendorName}</span>
                    ) : null}
                    <span className="text-xs text-gray-600">
                      {Number(r.sessionsUsed) || 0}/{r.totalSessions || '—'} sessions used
                    </span>
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-orange-400" aria-hidden />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
