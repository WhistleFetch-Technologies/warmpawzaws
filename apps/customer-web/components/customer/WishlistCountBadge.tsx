'use client';

import { formatWishlistBadgeCount } from '@/lib/use-wishlist-count';
import { cn } from '@/components/ui/utils';

export type WishlistCountBadgeSize = 'sm' | 'md';

const sizeClasses: Record<WishlistCountBadgeSize, string> = {
  sm: 'min-w-[14px] h-3.5 text-[9px] -top-0.5 -right-0.5',
  md: 'min-w-[16px] h-4 text-[10px] -top-0.5 -right-0.5',
};

export type WishlistCountBadgeProps = {
  count: number;
  size?: WishlistCountBadgeSize;
  className?: string;
};

/** Overlay pill for an existing heart button — hidden when count is 0. */
export function WishlistCountBadge({
  count,
  size = 'md',
  className,
}: WishlistCountBadgeProps) {
  const label = formatWishlistBadgeCount(count);
  if (!label) return null;

  return (
    <span
      className={cn(
        'absolute z-10 rounded-full bg-red-500 px-1 font-bold text-white tabular-nums flex items-center justify-center pointer-events-none',
        sizeClasses[size],
        className
      )}
      aria-hidden
    >
      {label}
    </span>
  );
}
