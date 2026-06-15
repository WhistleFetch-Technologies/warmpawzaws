'use client';

interface BannerManagementProps {
  sellerId: string;
}

export function BannerManagement({ sellerId }: BannerManagementProps) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Banners</h3>
      <p className="mt-2 text-sm text-slate-500">
        Banner management for seller {sellerId.slice(0, 8)}… is coming soon.
      </p>
    </div>
  );
}
