'use client';

import { Heart } from 'lucide-react';
import { markWishlistOpenedFromShop } from '@/lib/go-back-or-replace';
import { useWishlistCount } from '@/lib/use-wishlist-count';
import { WishlistCountBadge } from '@/components/customer/WishlistCountBadge';
import { cn } from '@/components/ui/utils';

export type WishlistNavHeartVariant = 'shop' | 'shell';

export type WishlistNavHeartProps = {
  variant: WishlistNavHeartVariant;
  /** Shell header: navigate to wishlist screen */
  onNavigate?: (screen: string) => void;
  className?: string;
  heartClassName?: string;
};

function wishlistAriaLabel(count: number): string {
  if (count <= 0) return 'Wishlist';
  const noun = count === 1 ? 'saved item' : 'saved items';
  return `Wishlist, ${count > 99 ? '99+' : count} ${noun}`;
}

/**
 * In-place wrapper for existing single nav hearts (shop + shell headers).
 * Does not add a new heart — replaces the existing markup at those call sites.
 */
export function WishlistNavHeart({
  variant,
  onNavigate,
  className,
  heartClassName,
}: WishlistNavHeartProps) {
  const count = useWishlistCount();
  const ariaLabel = wishlistAriaLabel(count);

  if (variant === 'shop') {
    return (
      <a
        href="/wishlist"
        onClick={() => markWishlistOpenedFromShop()}
        className={cn(
          'relative z-10 ml-auto shrink-0 w-10 h-10 flex items-center justify-center rounded-xl text-slate-600 active:scale-95 transition-transform',
          className
        )}
        aria-label={ariaLabel}
      >
        <Heart className={cn('w-5 h-5', heartClassName)} />
        <WishlistCountBadge count={count} size="md" />
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onNavigate?.('wishlist')}
      className={cn(
        'relative w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors',
        className
      )}
      aria-label={ariaLabel}
    >
      <Heart className={cn('w-4 h-4 text-white', heartClassName)} />
      <WishlistCountBadge count={count} size="sm" />
    </button>
  );
}
