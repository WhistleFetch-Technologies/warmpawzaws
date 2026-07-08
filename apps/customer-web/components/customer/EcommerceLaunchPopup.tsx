'use client';

import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ECOMMERCE_LAUNCH_HERO_IMAGE,
  hasSeenEcommerceLaunchPopup,
  markEcommerceLaunchPopupSeen,
} from '@/lib/ecommerce-launch-promo';

type EcommerceLaunchPopupProps = {
  /** When false, never open (e.g. ecommerce feature flag off). */
  enabled?: boolean;
  onExploreShop?: () => void;
};

/**
 * Mid-screen ecommerce launch promo — once per browser/app session.
 * Closing (X / No thanks / Shop) marks the session so it won't reopen.
 */
export function EcommerceLaunchPopup({
  enabled = true,
  onExploreShop,
}: EcommerceLaunchPopupProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    if (hasSeenEcommerceLaunchPopup()) return;

    const timer = window.setTimeout(() => {
      if (!hasSeenEcommerceLaunchPopup()) setOpen(true);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [enabled]);

  const dismiss = useCallback(() => {
    markEcommerceLaunchPopupSeen();
    setOpen(false);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) dismiss();
      else setOpen(true);
    },
    [dismiss]
  );

  const exploreShop = useCallback(() => {
    dismiss();
    onExploreShop?.();
  }, [dismiss, onExploreShop]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="fixed left-1/2 top-1/2 z-50 w-[min(100vw-1.5rem,22rem)] max-h-[min(92vh,480px)] -translate-x-1/2 -translate-y-1/2 gap-0 overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-2xl sm:max-w-[22rem]"
        aria-describedby="ecommerce-launch-desc"
      >
        <DialogTitle className="sr-only">We just launched ecommerce</DialogTitle>
        <DialogDescription id="ecommerce-launch-desc" className="sr-only">
          We have just launched ecommerce. Explore clothes, food, and pet accessories and check out
          our products now.
        </DialogDescription>

        <button
          type="button"
          onClick={dismiss}
          className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center text-white active:opacity-80"
          aria-label="Close"
        >
          <X className="h-5 w-5" strokeWidth={2.5} />
        </button>

        <div className="relative flex h-40 w-full shrink-0 items-end justify-center overflow-hidden bg-gradient-to-b from-[#FF9A55] via-[#FF8C42] to-[#FF7A29] px-3 pt-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ECOMMERCE_LAUNCH_HERO_IMAGE}
            alt=""
            className="max-h-[8.75rem] w-auto max-w-[92%] origin-bottom scale-[1.08] object-contain object-bottom drop-shadow-md"
          />
        </div>

        <div className="flex flex-col gap-4 px-4 pb-4 pt-3">
          <div className="space-y-2 text-center">
            <p className="text-base font-bold leading-snug text-gray-900">
              We have just launched ecommerce!
            </p>
            <p className="text-sm leading-relaxed text-gray-600">
              Explore clothes, food, and pet accessories — check out our products now.
            </p>
          </div>

          <button
            type="button"
            onClick={exploreShop}
            className="w-full rounded-full bg-[#FF8C42] py-3 text-sm font-semibold text-white shadow-md active:scale-[0.98]"
          >
            Shop Now
          </button>

          <button
            type="button"
            onClick={dismiss}
            className="py-0.5 text-center text-xs text-gray-500 underline underline-offset-2"
          >
            No, thanks
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
