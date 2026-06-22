'use client';

import { useMemo, useRef, useState, type LucideIcon } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Calendar,
  CalendarClock,
  ChevronRight,
  MessageSquare,
  Package,
  PlayCircle,
  ShieldCheck,
  Stethoscope,
  Syringe,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { PackageSessionTrackingPanel } from '@/components/customer/booking/PackageSessionTrackingPanel';
import { useCustomerBookingMessagesModal } from '@/components/customer/messaging/CustomerBookingMessagesModalProvider';
import { cn } from '@/components/ui/utils';
import { myBookingsCardClass } from '@/components/customer/booking/my-bookings-ui';

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

type ListFilter = 'all' | 'active' | 'expired';

/** Resolve the canonical parent booking id for package-scoped vendor chat. */
export async function resolvePackageParentBookingId(
  packagePurchaseId: string,
  customerPhone?: string | null
): Promise<string> {
  let bookingId = '';
  try {
    const ses = (await apiClient.get(
      `/packages/${encodeURIComponent(packagePurchaseId)}/sessions`
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
        return pp && pp === packagePurchaseId && !isChild;
      });
      bookingId = String(matched?.id ?? matched?.bookingId ?? '').trim();
    } catch (err) {
      console.warn('[MyPackages] failed to resolve parent bookingId via /customer/:phone/bookings', err);
    }
  }

  return bookingId;
}

const PACKAGE_CARD_CLASS = cn(
  myBookingsCardClass,
  'overflow-hidden rounded-3xl border-stone-200/90 shadow-[0_8px_24px_rgba(0,0,0,0.06)]'
);

const STAT_CARD_CLASS =
  'flex flex-col rounded-[20px] border border-stone-200/90 bg-white p-3 text-center shadow-[0_4px_20px_rgba(15,23,42,0.06)]';

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

function resolvePackageIcon(row: MyPackageSummaryRow): {
  Icon: LucideIcon;
  chipClass: string;
  iconClass: string;
} {
  const name = row.packageName.toLowerCase();
  const style = (row.serviceStyle ?? '').toLowerCase();
  if (
    style.includes('vet') ||
    name.includes('vet') ||
    name.includes('clinic') ||
    name.includes('doctor')
  ) {
    return {
      Icon: Stethoscope,
      chipClass: 'bg-violet-50',
      iconClass: 'text-violet-600',
    };
  }
  if (
    style.includes('vaccin') ||
    name.includes('vaccin') ||
    name.includes('immun')
  ) {
    return {
      Icon: Syringe,
      chipClass: 'bg-sky-50',
      iconClass: 'text-sky-600',
    };
  }
  if (name.includes('insur') || name.includes('protect') || name.includes('care plan')) {
    return {
      Icon: ShieldCheck,
      chipClass: 'bg-emerald-50',
      iconClass: 'text-emerald-600',
    };
  }
  return {
    Icon: Package,
    chipClass: 'bg-orange-50',
    iconClass: 'text-[#FF8C42]',
  };
}

function resolvePackageStatus(row: MyPackageSummaryRow): {
  label: string;
  badgeClass: string;
  progressBarClass: string;
} {
  const isExpired = row.status === 'expired';
  const isCancelled = row.status === 'cancelled';
  const noSessionsLeft =
    row.remainingSessions !== Number.MAX_SAFE_INTEGER && row.remainingSessions <= 0;
  if (isCancelled) {
    return {
      label: 'Cancelled',
      badgeClass: 'bg-red-100 text-red-700',
      progressBarClass: 'bg-red-400',
    };
  }
  if (isExpired) {
    return {
      label: 'Expired',
      badgeClass: 'bg-amber-100 text-amber-800',
      progressBarClass: 'bg-amber-500',
    };
  }
  if (noSessionsLeft || ['exhausted', 'completed'].includes(row.status)) {
    return {
      label: 'Completed',
      badgeClass: 'bg-gray-100 text-gray-700',
      progressBarClass: 'bg-gray-400',
    };
  }
  const { chipClass } = resolvePackageIcon(row);
  const progressBarClass = chipClass.includes('violet')
    ? 'bg-violet-500'
    : chipClass.includes('emerald')
      ? 'bg-emerald-500'
      : 'bg-emerald-500';
  return {
    label: 'Active',
    badgeClass: 'bg-green-100 text-green-700',
    progressBarClass,
  };
}

function filterRows(rows: MyPackageSummaryRow[], filter: ListFilter): MyPackageSummaryRow[] {
  if (filter === 'active') {
    return rows.filter(
      (r) =>
        !['expired', 'cancelled'].includes(r.status) &&
        (r.remainingSessions === Number.MAX_SAFE_INTEGER || r.remainingSessions > 0)
    );
  }
  if (filter === 'expired') {
    return rows.filter((r) => r.status === 'expired');
  }
  return rows.filter((r) => r.status !== 'cancelled');
}

const LIST_FILTER_TABS: { id: ListFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'expired', label: 'Expired' },
];

function PackageStatCard({
  value,
  label,
  icon: Icon,
  accentBarClass,
  iconWrapClass,
  iconClass,
}: {
  value: string;
  label: string;
  icon: LucideIcon;
  accentBarClass: string;
  iconWrapClass: string;
  iconClass: string;
}) {
  return (
    <div className={cn(STAT_CARD_CLASS, 'relative pb-4')}>
      <span
        className={cn(
          'mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl',
          iconWrapClass
        )}
      >
        <Icon className={cn('h-[18px] w-[18px]', iconClass)} strokeWidth={2.25} aria-hidden />
      </span>
      <p className="text-xl font-bold tabular-nums text-gray-900">{value}</p>
      <p className="mt-1 text-[11px] font-medium text-gray-500">{label}</p>
      <span
        className={cn('absolute bottom-0 left-3 right-3 h-1 rounded-full', accentBarClass)}
        aria-hidden
      />
    </div>
  );
}

/**
 * Orange “hub” — stats + deep links to `/packages/:id` (Package progress, source of truth).
 * `fullPage`: independent sections on #FAF6F0; host supplies shell header (e.g. `/my-packages`).
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
  const { openBookingChat } = useCustomerBookingMessagesModal();
  const [listFilter, setListFilter] = useState<ListFilter>('all');
  const [expandedPackageId, setExpandedPackageId] = useState<string | null>(null);
  const [messagingVendorId, setMessagingVendorId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const activeCount = rows.filter(
    (r) =>
      !['expired', 'cancelled'].includes(r.status) &&
      (r.remainingSessions === Number.MAX_SAFE_INTEGER || r.remainingSessions > 0)
  ).length;
  const sessionsLeft = rows.reduce((acc, r) => {
    if (r.remainingSessions === Number.MAX_SAFE_INTEGER) return acc;
    return acc + Math.max(0, Number(r.remainingSessions) || 0);
  }, 0);
  const allPackagesCount = rows.filter((r) => r.status !== 'cancelled').length;

  const visibleRows = useMemo(() => filterRows(rows, listFilter), [rows, listFilter]);

  const statTiles: Array<{ v: string; l: string }> = [
    { v: String(activeCount), l: 'Active' },
    { v: String(sessionsLeft), l: 'Sessions left' },
    { v: String(allPackagesCount), l: 'All packages' },
  ];

  const openMessages = async (row: MyPackageSummaryRow) => {
    setMessagingVendorId(row.vendorId ?? row.id);
    const bookingId = await resolvePackageParentBookingId(row.id, customerPhone);
    setMessagingVendorId(null);

    if (!bookingId) {
      toast.error('Booking not linked yet for this package');
      return;
    }
    openBookingChat(bookingId, row.vendorName || 'Provider');
  };

  const onListFilterChange = (f: ListFilter) => {
    setListFilter(f);
    setExpandedPackageId(null);
    window.setTimeout(() => {
      listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  if (variant === 'fullPage') {
    return (
      <div className="space-y-5 px-4 pb-8 pt-2">
        {/* 1 — Stats (display-only) */}
        <div className="my-bookings-fade-in grid grid-cols-3 gap-3">
          <PackageStatCard
            value={String(activeCount)}
            label="Active"
            icon={Calendar}
            accentBarClass="bg-violet-500"
            iconWrapClass="bg-violet-50"
            iconClass="text-violet-600"
          />
          <PackageStatCard
            value={String(sessionsLeft)}
            label="Sessions left"
            icon={Activity}
            accentBarClass="bg-[#FF8C42]"
            iconWrapClass="bg-orange-50"
            iconClass="text-[#FF8C42]"
          />
          <PackageStatCard
            value={String(allPackagesCount)}
            label="All packages"
            icon={Package}
            accentBarClass="bg-emerald-500"
            iconWrapClass="bg-emerald-50"
            iconClass="text-emerald-600"
          />
        </div>

        {/* 2 — Benefit banner (single soft gradient) */}
        <div
          className={cn(
            myBookingsCardClass,
            'my-bookings-fade-in flex gap-3 rounded-[20px] border-orange-100/80 bg-gradient-to-br from-[#FFF4EB] via-[#FFFAF5] to-[#FFF0E6] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.10)]'
          )}
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF8C42] to-[#FF7A35] shadow-[0_4px_14px_rgba(255,140,66,0.35)]">
            <ShieldCheck className="h-6 w-6 text-white" strokeWidth={2.25} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900">Complete care for a happier pet</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-600">
              Our packages are designed to keep your pet healthy, happy and protected.
            </p>
          </div>
        </div>

        {/* 3 — Filters */}
        <div ref={listRef} className="scroll-mt-24">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold text-gray-900">Your packages</h2>
            <div
              className="flex gap-2"
              role="tablist"
              aria-label="Filter packages"
            >
              {LIST_FILTER_TABS.map((tab) => {
                const active = listFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => onListFilterChange(tab.id)}
                    className={cn(
                      'min-h-[36px] rounded-full px-4 py-1.5 text-xs font-semibold transition-colors duration-200 active:scale-[0.98]',
                      active
                        ? 'bg-[#FF8C42] text-white shadow-[0_4px_12px_rgba(255,140,66,0.35)]'
                        : 'border border-stone-200/90 bg-white text-gray-600 hover:bg-stone-50'
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4 — Package cards */}
          {visibleRows.length === 0 ? (
            <div
              className={cn(
                PACKAGE_CARD_CLASS,
                'my-bookings-fade-in mt-4 flex min-h-[220px] flex-col items-center justify-center px-6 py-12 text-center'
              )}
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#FF8C42]">
                <Package className="h-7 w-7" aria-hidden />
              </span>
              <p className="mt-4 text-base font-semibold text-gray-800">No packages for this filter</p>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-gray-500">
                Try another filter or purchase a package to start tracking sessions and OTPs.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {visibleRows.map((r, index) => {
                const progress = computeProgressPct(r);
                const remaining =
                  r.remainingSessions === Number.MAX_SAFE_INTEGER
                    ? 'Unlimited'
                    : String(Math.max(0, r.remainingSessions));
                const { label: statusLabel, badgeClass, progressBarClass } = resolvePackageStatus(r);
                const isCancelled = r.status === 'cancelled';
                const disabled = isCancelled;
                const expanded = expandedPackageId === r.id;
                const { Icon: PackageIcon, chipClass, iconClass } = resolvePackageIcon(r);

                return (
                  <article
                    key={r.id}
                    className={cn(
                      PACKAGE_CARD_CLASS,
                      'my-bookings-fade-in flex min-h-[220px] flex-col'
                    )}
                    style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                  >
                    <div className="flex flex-1 flex-col p-4">
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
                            chipClass
                          )}
                        >
                          <PackageIcon className={cn('h-6 w-6', iconClass)} strokeWidth={2.25} aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-lg font-bold text-gray-900">{r.packageName}</p>
                              <p className="mt-0.5 truncate text-sm text-gray-500">
                                {r.vendorName || 'Provider'}
                              </p>
                            </div>
                            <span
                              className={cn(
                                'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold',
                                badgeClass
                              )}
                            >
                              {statusLabel}
                            </span>
                          </div>
                          <p className="mt-3 flex items-center gap-1 text-xs text-gray-500">
                            <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            <span>
                              Expiry: {formatExpiry(r.expiresAt)} · Sessions left: {remaining}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-1 flex-col justify-end gap-3">
                        <div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-gray-600">Sessions used</span>
                            <span className="font-bold tabular-nums text-gray-900">
                              {Number(r.sessionsUsed) || 0}/{r.totalSessions || '—'}
                            </span>
                          </div>
                          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-stone-100">
                            <div
                              className={cn(
                                'h-2.5 rounded-full transition-[width] duration-500 ease-out',
                                progressBarClass
                              )}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (disabled) return;
                              setExpandedPackageId(expanded ? null : r.id);
                            }}
                            disabled={disabled}
                            className={cn(
                              'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[14px] border-2 border-violet-300 bg-violet-50/50 px-3 text-sm font-semibold text-violet-800 transition-colors duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50'
                            )}
                          >
                            <PlayCircle className="h-4 w-4 shrink-0" aria-hidden />
                            Track progress
                          </button>
                          <button
                            type="button"
                            onClick={() => void openMessages(r)}
                            disabled={!r.vendorId || messagingVendorId === r.vendorId}
                            className={cn(
                              'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[14px] border-2 border-orange-200 bg-orange-50/60 px-3 text-sm font-semibold text-[#E67A35] transition-colors duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50'
                            )}
                          >
                            <MessageSquare className="h-4 w-4 shrink-0" aria-hidden />
                            {messagingVendorId === r.vendorId ? 'Opening…' : 'Message'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {expanded ? (
                      <div className="border-t border-stone-200/90 bg-stone-50/80 p-4">
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
