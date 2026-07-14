'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dedupeHeroPhotoUrls } from '@/lib/vendor-display-media';
import { CachedImage } from '@/components/shared/CachedImage';

type VendorHeroPhotoCarouselProps = {
  photos: string[];
  /** Used for alt text on images */
  name: string;
  /** Outer frame: sizing, rounding (e.g. aspect ratio or fixed height) */
  frameClassName: string;
};

/**
 * Hero gallery: horizontal swipe (scroll-snap) with dot indicators.
 * Single photo renders as a static image.
 */
export function VendorHeroPhotoCarousel({ photos, name, frameClassName }: VendorHeroPhotoCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const uniquePhotos = useMemo(() => dedupeHeroPhotoUrls(photos), [photos]);
  const photosKey = uniquePhotos.join('|');

  const updateIndexFromScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || uniquePhotos.length <= 1) return;
    const w = el.clientWidth || 1;
    const i = Math.round(el.scrollLeft / w);
    setActiveIndex(Math.min(uniquePhotos.length - 1, Math.max(0, i)));
  }, [uniquePhotos.length]);

  useEffect(() => {
    setActiveIndex(0);
    const el = scrollerRef.current;
    if (el) el.scrollLeft = 0;
  }, [photosKey]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || uniquePhotos.length <= 1) return;
    const onScrollEnd = () => updateIndexFromScroll();
    el.addEventListener('scrollend', onScrollEnd);
    return () => el.removeEventListener('scrollend', onScrollEnd);
  }, [photosKey, uniquePhotos.length, updateIndexFromScroll]);

  const goTo = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const w = el.clientWidth || 1;
    el.scrollTo({ left: w * i, behavior: 'smooth' });
    setActiveIndex(i);
  };

  if (uniquePhotos.length === 0) return null;

  if (uniquePhotos.length === 1) {
    return (
      <div className={frameClassName}>
        <CachedImage src={uniquePhotos[0]} alt={name} className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/40 via-transparent to-transparent" />
      </div>
    );
  }

  return (
    <div className={`${frameClassName} relative`}>
      <div
        ref={scrollerRef}
        onScroll={updateIndexFromScroll}
        className="scrollbar-hide flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain touch-pan-x"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {uniquePhotos.map((src, i) => (
          <div key={`${i}-${src}`} className="h-full w-full min-w-full flex-shrink-0 snap-center snap-always">
            <CachedImage src={src} alt={`${name} — photo ${i + 1}`} className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/45 via-transparent to-transparent" />
      {/* Page dots: centered on bottom middle, light pill so rings read like the reference */}
      <div
        className="pointer-events-auto absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 flex-row items-center gap-2 rounded-full border border-neutral-200/90 bg-white/95 px-3.5 py-2 shadow-sm backdrop-blur-sm sm:bottom-5 sm:gap-2.5 sm:px-4"
        role="tablist"
        aria-label="Photo gallery pages"
      >
        {uniquePhotos.map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === activeIndex}
            aria-label={`Photo ${i + 1} of ${uniquePhotos.length}`}
            onClick={() => goTo(i)}
            className={
              i === activeIndex
                ? 'h-2 w-2 shrink-0 rounded-full bg-neutral-900 sm:h-2.5 sm:w-2.5'
                : 'box-border h-2 w-2 shrink-0 rounded-full border border-neutral-900 bg-transparent sm:h-2.5 sm:w-2.5'
            }
          />
        ))}
      </div>
    </div>
  );
}
