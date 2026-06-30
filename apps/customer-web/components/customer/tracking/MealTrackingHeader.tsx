'use client';

import { ArrowLeft, CircleHelp, Share2 } from 'lucide-react';

export interface MealTrackingHeaderProps {
  orderDisplayId: string;
  backSlot: React.ReactNode;
  onSupport?: () => void;
  onShare?: () => void;
  headerExtra?: React.ReactNode;
}

export function MealTrackingHeader({
  orderDisplayId,
  backSlot,
  onSupport,
  onShare,
  headerExtra,
}: MealTrackingHeaderProps) {
  return (
    <header className="shrink-0 border-b border-orange-100/90 bg-orange-50/95 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-sm">
      <div className="flex items-start gap-2 px-4 pb-3 pt-1">
        <div className="mt-0.5 shrink-0">{backSlot}</div>

        <div className="min-w-0 flex-1 pt-0.5">
          <h1 className="text-xl font-bold leading-snug tracking-tight text-slate-900 sm:text-[1.35rem]">
            Track Order
          </h1>
          <p className="mt-0.5 truncate text-sm font-medium text-slate-500">{orderDisplayId}</p>
        </div>

        <div className="flex shrink-0 items-start gap-0.5 pt-0.5">
          {headerExtra}
          {onSupport ? (
            <button
              type="button"
              onClick={onSupport}
              className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-1 text-slate-700 transition active:bg-white/70"
              aria-label="Support"
            >
              <CircleHelp className="h-5 w-5" strokeWidth={2} />
              <span className="text-[10px] font-medium text-slate-500">Support</span>
            </button>
          ) : null}
          {onShare ? (
            <button
              type="button"
              onClick={onShare}
              className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-1 text-slate-700 transition active:bg-white/70"
              aria-label="Share order"
            >
              <Share2 className="h-5 w-5" strokeWidth={2} />
              <span className="text-[10px] font-medium text-slate-500">Share</span>
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function MealTrackingBackButton({
  onClick,
  href,
}: {
  onClick?: () => void;
  href?: string;
}) {
  const className =
    'flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-800 shadow-sm ring-1 ring-black/[0.06] transition active:scale-[0.97] active:bg-orange-50/80';

  if (href) {
    return (
      <a href={href} className={className} aria-label="Go back">
        <ArrowLeft className="h-5 w-5" strokeWidth={2.25} />
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className} aria-label="Go back">
      <ArrowLeft className="h-5 w-5" strokeWidth={2.25} />
    </button>
  );
}
