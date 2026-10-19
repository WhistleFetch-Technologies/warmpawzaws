'use client';

import { useRouter } from 'next/navigation';
import { ChevronRight, Package } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { MyPackagesPanel, type OwnedPackageCard } from '@/components/customer/packages/ServicePackagesExperience';

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
  petName?: string;
  petPhoto?: string;
  purchasedAt?: string;
  packageType?: string;
};

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
    const petName = p.pet_name ?? p.petName;
    const petPhoto = p.pet_photo ?? p.petPhoto;
    const purchasedAt = p.purchased_at ?? p.purchasedAt ?? p.created_at ?? p.createdAt;
    const packageType = p.package_type ?? p.packageType;
    const row: MyPackageSummaryRow = {
      id,
      packageName: String(p.package_name ?? p.packageName ?? 'Package'),
      totalSessions: total,
      sessionsUsed: used,
      remainingSessions: Number.isFinite(remaining) ? Math.max(0, remaining) : Number.MAX_SAFE_INTEGER,
      expiresAt: typeof exp === 'string' ? exp : undefined,
      serviceStyle: typeof serviceStyle === 'string' ? serviceStyle.toLowerCase() : undefined,
      petName: typeof petName === 'string' ? petName : undefined,
      petPhoto: typeof petPhoto === 'string' ? petPhoto : undefined,
      purchasedAt: typeof purchasedAt === 'string' ? purchasedAt : undefined,
      packageType: typeof packageType === 'string' ? packageType : undefined,
      status,
      expiringSoon,
    };
    if (typeof vn === 'string' && vn.trim()) row.vendorName = vn.trim();
    if (typeof vendorId === 'string' && vendorId.trim()) row.vendorId = vendorId.trim();
    out.push(row);
  }
  return out;
}

export function MyPackagesTrackingPanel({
  rows,
  variant = 'default',
}: {
  rows: MyPackageSummaryRow[];
  customerPhone?: string | null;
  variant?: 'default' | 'fullPage';
}) {
  const router = useRouter();

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

  const statTiles: Array<{ v: string; l: string }> = [
    { v: String(activeCount), l: 'Active' },
    { v: String(sessionsLeft), l: 'Sessions left' },
    { v: String(allPackagesCount), l: 'All packages' },
  ];

  if (variant === 'fullPage') {
    const cards: OwnedPackageCard[] = rows
      .filter((row) => row.status !== 'cancelled')
      .map((row) => {
        const blob = `${row.packageName} ${row.serviceStyle || ''} ${row.packageType || ''}`.toLowerCase();
        const serviceLabel = blob.includes('walk')
          ? 'Private walker'
          : blob.includes('groom')
            ? 'Grooming'
            : blob.includes('train')
              ? 'Training'
              : blob.includes('vet') || blob.includes('clinic')
                ? 'Vet care'
                : row.vendorName || 'Service package';
        const unlimited = row.remainingSessions === Number.MAX_SAFE_INTEGER;
        return {
          id: row.id,
          packageName: row.packageName,
          serviceLabel,
          petName: row.petName,
          petPhoto: row.petPhoto,
          purchasedAt: row.purchasedAt,
          expiresAt: row.expiresAt,
          status: row.status,
          totalSessions: row.totalSessions,
          completedSessions: row.sessionsUsed,
          remainingSessions: unlimited ? Number.MAX_SAFE_INTEGER : row.remainingSessions,
          unlimited,
        };
      });
    return (
      <div className="px-4 pb-8 pt-2">
        <MyPackagesPanel
          packages={cards}
          onViewDetails={(id) => router.push(`/packages/${encodeURIComponent(id)}`)}
        />
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
