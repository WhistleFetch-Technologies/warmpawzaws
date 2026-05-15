'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Heart } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';
import {
  readWishlistIds,
  setWishlistIds,
  WISHLIST_UPDATED_EVENT,
} from '@/lib/warmpawz-wishlist-local';
import { cn } from '@/components/ui/utils';

export type WishlistHeartVisualVariant = 'shop-floating' | 'header-toolbar';

function visualStateClass(variant: WishlistHeartVisualVariant, isWishlisted: boolean): string {
  if (variant === 'header-toolbar') {
    return isWishlisted ? 'bg-red-50 text-red-500' : 'hover:bg-slate-100 text-slate-600';
  }
  return isWishlisted
    ? 'bg-red-500 text-white'
    : 'bg-white/90 text-slate-400 backdrop-blur-sm active:scale-95';
}

export type WishlistProductHeartButtonProps = {
  /** Canonical product id (caller should use `canonicalProductId` + fallback). */
  productId: string;
  visualVariant: WishlistHeartVisualVariant;
  className?: string;
  heartClassName?: string;
  /** Match `/shop` ProductCard: GET wishlist after successful add (logging / parity). */
  verifyAfterAdd?: boolean;
};

/**
 * Single source of truth for marketplace wishlist hearts: localStorage + `wishlist-updated`
 * event, with optional API sync when a customer id is resolved.
 */
export function WishlistProductHeartButton({
  productId,
  visualVariant,
  className,
  heartClassName = 'w-3.5 h-3.5',
  verifyAfterAdd = true,
}: WishlistProductHeartButtonProps) {
  const [isWishlisted, setIsWishlisted] = useState(false);
  const syncInFlight = useRef(false);

  const pid = (productId || '').trim();

  useEffect(() => {
    if (!pid || typeof window === 'undefined') return;
    const sync = () => {
      setIsWishlisted(readWishlistIds().some((id: string) => String(id) === String(pid)));
    };
    sync();
    window.addEventListener(WISHLIST_UPDATED_EVENT, sync);
    return () => window.removeEventListener(WISHLIST_UPDATED_EVENT, sync);
  }, [pid]);

  const onClick = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (!pid) {
        console.warn('[wishlist] WishlistProductHeartButton: missing product id');
        return;
      }
      const customerId = getResolvedCustomerId();
      if (customerId) {
        if (syncInFlight.current) return;
        syncInFlight.current = true;
      }

      const wishlist = readWishlistIds();
      const wasInList = wishlist.some((id: string) => String(id) === String(pid));
      const previous = [...wishlist];

      if (wasInList) {
        setWishlistIds(wishlist.filter((id: string) => String(id) !== String(pid)));
        setIsWishlisted(false);
      } else {
        const next = [...wishlist];
        if (!next.some((id: string) => String(id) === String(pid))) {
          next.push(pid);
        }
        setWishlistIds(next);
        setIsWishlisted(true);
      }

      if (!customerId) {
        console.warn('[wishlist] no customerId; saved locally only', { productId: pid });
        return;
      }

      const action = wasInList ? 'remove' : 'add';
      try {
        await apiClient.post(`/customer/${customerId}/wishlist`, {
          productId: pid,
          action,
        });
        if (verifyAfterAdd && action === 'add') {
          try {
            await apiClient.get(`/customer/${customerId}/wishlist`);
          } catch {
            /* non-fatal */
          }
        }
      } catch (err) {
        console.error('[wishlist] POST failed', { productId: pid, customerId, err });
        setWishlistIds(previous);
        setIsWishlisted(previous.some((id: string) => String(id) === String(pid)));
      } finally {
        syncInFlight.current = false;
      }
    },
    [pid, verifyAfterAdd]
  );

  if (!pid) return null;

  const baseLayout =
    visualVariant === 'header-toolbar'
      ? 'flex items-center justify-center p-2 rounded-xl transition-colors'
      : 'flex items-center justify-center rounded-full shadow-sm transition-all';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(baseLayout, visualStateClass(visualVariant, isWishlisted), className)}
      aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
    >
      <Heart className={cn(heartClassName, isWishlisted ? 'fill-current' : '')} />
    </button>
  );
}
