'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

export interface VendorHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  /** Icon-sized controls only (max 2–3); use shrink-0 on each */
  actions?: ReactNode[];
  className?: string;
  /** Brand (orange) bar — use instead of duplicate gradient/sticky top bars */
  tone?: 'default' | 'brand';
}

/**
 * Universal mobile-safe vendor app header: safe-area inset, sticky chrome,
 * centered truncated title, symmetric left/right slots.
 */
export function VendorHeader({
  title,
  subtitle,
  showBack = true,
  onBack,
  actions,
  className = '',
  tone = 'default',
}: VendorHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  const hasActions = Boolean(actions?.length);
  const isBrand = tone === 'brand';

  return (
    <header
      className={`sticky top-0 z-10 shrink-0 safe-area-top border-b ${
        isBrand
          ? 'border-orange-300/40 bg-[#FF8C42]'
          : 'border-gray-200 bg-white'
      } ${className}`.trim()}
    >
      <div className="flex items-center justify-between gap-2 p-4 flex-nowrap min-h-[56px]">
        <div className="flex items-center gap-2 shrink-0">
          {showBack ? (
            <button
              type="button"
              onClick={handleBack}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${
                isBrand
                  ? 'hover:bg-white/15 active:bg-white/25'
                  : 'hover:bg-gray-100 active:bg-gray-200'
              }`}
              aria-label="Go back"
            >
              <ArrowLeft
                className={`w-6 h-6 ${isBrand ? 'text-white' : 'text-gray-700'}`}
                aria-hidden
              />
            </button>
          ) : (
            <div className="h-11 w-11 shrink-0" aria-hidden />
          )}
        </div>

        <div className="flex-1 min-w-0 text-center px-1">
          <h1
            className={`text-lg font-bold truncate overflow-hidden text-ellipsis whitespace-nowrap ${
              isBrand ? 'text-white' : 'text-gray-900'
            }`}
          >
            {title}
          </h1>
          {subtitle ? (
            <p
              className={`text-xs truncate overflow-hidden text-ellipsis whitespace-nowrap ${
                isBrand ? 'text-white/85' : 'text-gray-500'
              }`}
            >
              {subtitle}
            </p>
          ) : null}
        </div>

        <div
          className={`flex h-11 min-w-[44px] items-center gap-3 shrink-0 flex-nowrap justify-end ${
            isBrand ? 'text-white [&_button]:hover:bg-white/15 [&_svg]:text-white' : ''
          }`}
        >
          {hasActions
            ? actions!.map((node, i) => (
                <span key={i} className="flex shrink-0 items-center">
                  {node}
                </span>
              ))
            : (
                <div className="h-11 w-11 shrink-0" aria-hidden />
              )}
        </div>
      </div>
    </header>
  );
}
