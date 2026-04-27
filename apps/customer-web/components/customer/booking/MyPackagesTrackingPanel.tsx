'use client';

import { useRouter } from 'next/navigation';
import { ChevronRight, Package } from 'lucide-react';

export type MyPackageSummaryRow = {
  id: string;
  packageName: string;
  vendorName?: string;
  totalSessions: number;
  sessionsUsed: number;
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
    const status = String(p.status ?? p.computed_status ?? 'active').toLowerCase();
    let expiringSoon = false;
    const exp = p.expires_at ?? p.expiresAt;
    if (exp && typeof exp === 'string') {
      const ms = new Date(exp).getTime() - Date.now();
      const days = ms / 86400000;
      expiringSoon = days >= 0 && days <= 7;
    }
    const vn = p.vendor_name ?? p.vendorName;
    const row: MyPackageSummaryRow = {
      id,
      packageName: String(p.package_name ?? p.packageName ?? 'Package'),
      totalSessions: total,
      sessionsUsed: used,
      status,
      expiringSoon,
    };
    if (typeof vn === 'string' && vn.trim()) row.vendorName = vn.trim();
    out.push(row);
  }
  return out;
}

/**
 * Orange “hub” — stats + deep links to `/packages/:id` (Package progress, source of truth).
 * `fullPage`: wallet-style white card + beige stat tiles; host supplies shell header (e.g. `/my-packages`).
 */
export function MyPackagesTrackingPanel({
  rows,
  variant = 'default',
}: {
  rows: MyPackageSummaryRow[];
  variant?: 'default' | 'fullPage';
}) {
  const router = useRouter();

  const activeCount = rows.filter((r) => !['expired', 'exhausted', 'cancelled'].includes(r.status)).length;
  const sessionsLeft = rows.reduce((acc, r) => {
    const t = Number(r.totalSessions) || 0;
    if (t <= 0) return acc;
    return acc + Math.max(0, t - (Number(r.sessionsUsed) || 0));
  }, 0);
  const expiringCount = rows.filter((r) => r.expiringSoon).length;

  const statTiles = [
    { v: String(activeCount), l: 'Active' },
    { v: String(sessionsLeft), l: 'Sessions left' },
    { v: String(expiringCount), l: 'Expiring' },
  ];

  if (variant === 'fullPage') {
    return (
      <div className="px-3 pb-8 pt-1 sm:px-4">
        <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-sm">
          <p className="text-sm leading-relaxed text-gray-600">
            Tap a package for full session progress, dates, and OTPs when available.
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            {statTiles.map((s) => (
              <div
                key={s.l}
                className="flex flex-col justify-center rounded-xl bg-[#F3EBE0] px-2 py-3 text-center sm:px-3 sm:py-3.5"
              >
                <p className="text-lg font-bold tabular-nums text-gray-900 sm:text-xl">{s.v}</p>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-gray-600 sm:text-[11px]">
                  {s.l}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Your packages</p>
            {rows.length === 0 ? (
              <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-stone-200 bg-stone-50/80 px-6 py-12 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-500">
                  <Package className="h-7 w-7" aria-hidden />
                </span>
                <p className="mt-4 text-base font-semibold text-gray-800">No packages yet</p>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-gray-600">
                  Purchased bundles and session packs will show up here so you can track usage and OTPs.
                </p>
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-100">
                {rows.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => router.push(`/packages/${encodeURIComponent(r.id)}`)}
                      className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-orange-50/60 active:bg-orange-50/80 sm:px-5 sm:py-5"
                    >
                      <span className="flex min-w-0 items-center gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
                          <Package className="h-6 w-6" aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-base font-semibold text-gray-900">{r.packageName}</span>
                          {r.vendorName ? (
                            <span className="mt-0.5 block truncate text-sm text-gray-500">{r.vendorName}</span>
                          ) : null}
                          <span className="mt-1 block text-sm text-gray-600">
                            {Number(r.sessionsUsed) || 0}/{r.totalSessions || '—'} sessions used
                          </span>
                        </span>
                      </span>
                      <ChevronRight className="h-5 w-5 shrink-0 text-orange-400" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
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
