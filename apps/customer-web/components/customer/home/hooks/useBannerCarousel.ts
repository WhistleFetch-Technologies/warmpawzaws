'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

const DEFAULT_INTERVAL_MS = 4000;
const SWIPE_THRESHOLD_PX = 48;

export interface UseBannerCarouselOptions {
  /** Auto-advance interval in ms. Default 4000. Set 0 to disable. */
  intervalMs?: number;
  swipeThresholdPx?: number;
}

/**
 * Hero / middle banner carousel state: index, auto-scroll, swipe handlers.
 * Extracted from CustomerHomeComplete banner carousel logic.
 */
export function useBannerCarousel(
  bannerCount: number,
  options: UseBannerCarouselOptions = {}
) {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const swipeThreshold = options.swipeThresholdPx ?? SWIPE_THRESHOLD_PX;

  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setCurrentIndex((prev) => (bannerCount > 0 ? prev % bannerCount : 0));
  }, [bannerCount]);

  useEffect(() => {
    if (bannerCount <= 1 || intervalMs <= 0) return undefined;
    const id = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % bannerCount);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [bannerCount, intervalMs]);

  const goToIndex = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  const goToNext = useCallback(() => {
    if (bannerCount <= 0) return;
    setCurrentIndex((prev) => (prev + 1) % bannerCount);
  }, [bannerCount]);

  const goToPrev = useCallback(() => {
    if (bannerCount <= 0) return;
    setCurrentIndex((prev) => (prev - 1 + bannerCount) % bannerCount);
  }, [bannerCount]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touchStartX.current;
      touchStartX.current = null;
      if (start == null || bannerCount <= 1) return;
      const end = e.changedTouches[0]?.clientX ?? start;
      const dx = end - start;
      if (dx < -swipeThreshold) {
        goToNext();
      } else if (dx > swipeThreshold) {
        goToPrev();
      }
    },
    [bannerCount, swipeThreshold, goToNext, goToPrev]
  );

  const touchHandlers = useMemo(
    () => ({ onTouchStart, onTouchEnd }),
    [onTouchStart, onTouchEnd]
  );

  return {
    currentIndex,
    setCurrentIndex,
    goToIndex,
    goToNext,
    goToPrev,
    touchHandlers,
  };
}
