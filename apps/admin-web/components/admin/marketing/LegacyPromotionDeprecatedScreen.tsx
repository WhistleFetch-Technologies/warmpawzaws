'use client';

import Link from 'next/link';
import { ArrowRight, Megaphone } from 'lucide-react';

export function LegacyPromotionDeprecatedScreen({
  title = 'This screen has been replaced',
  description = 'The new Promotion Platform is the primary experience for creating and managing promotions, coupons, and targeting.',
  promotionHubHref = '/promotions',
  promotionHubLabel = 'Open Promotion Hub',
  marketingHubHref = '/marketing',
  marketingHubLabel = 'Open Marketing Hub',
}: {
  title?: string;
  description?: string;
  promotionHubHref?: string;
  promotionHubLabel?: string;
  marketingHubHref?: string;
  marketingHubLabel?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-600">
        <Megaphone className="h-6 w-6" aria-hidden />
      </div>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
      <p className="mt-3 text-xs text-slate-400">
        Legacy code is preserved for rollback. Enable{' '}
        <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_ENABLE_LEGACY_PROMOTION_UI=true</code> for
        developers only.
      </p>
      <div className="mt-6 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
        <Link
          href={promotionHubHref}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#FF8C42] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#FF7A2E]"
        >
          {promotionHubLabel}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        <Link
          href={marketingHubHref}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {marketingHubLabel}
        </Link>
      </div>
    </div>
  );
}
