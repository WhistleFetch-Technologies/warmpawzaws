'use client';

import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

export function MarketplacePageHeader({
  title,
  subtitle,
  onBack,
  rightSlot,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightSlot?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] text-white shadow-md">
      <div className="mx-auto flex max-w-customer items-center gap-3 px-4 py-4">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">{title}</h1>
          {subtitle ? <p className="truncate text-xs text-white/80">{subtitle}</p> : null}
        </div>
        {rightSlot}
      </div>
    </header>
  );
}
