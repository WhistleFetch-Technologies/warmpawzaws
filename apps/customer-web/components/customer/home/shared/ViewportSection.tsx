'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Preload distance (px) — mount shortly before the section enters view while scrolling. */
const VIEWPORT_PRELOAD_PX = 300;
/** IntersectionObserver root margin — bottom preload only (matches VIEWPORT_PRELOAD_PX). */
const VIEWPORT_ROOT_MARGIN = `${VIEWPORT_PRELOAD_PX}px 0px`;
/** Fire as soon as any pixel intersects; mount still requires scroll + geometry gates. */
const VIEWPORT_THRESHOLD = 0;

function isNearViewport(el: HTMLElement, preloadPx: number): boolean {
  const rect = el.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  return rect.top <= viewportHeight + preloadPx && rect.bottom > 0;
}

export interface ViewportSectionProps {
  children: ReactNode;
  /** Preserves layout height before the section mounts (px number or CSS length). */
  placeholderMinHeight: number | string;
  className?: string;
}

/**
 * Defers mounting `children` until the user scrolls near the placeholder.
 * Once mounted, children stay mounted (no scroll unmount).
 */
export function ViewportSection({
  children,
  placeholderMinHeight,
  className = '',
}: ViewportSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = useState(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (shouldRender || mountedRef.current) return;

    const el = containerRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      mountedRef.current = true;
      setShouldRender(true);
      return;
    }

    let observer: IntersectionObserver | null = null;
    let layoutReady = false;
    let scrollEngaged = false;
    let baselineScrollY = 0;
    let cancelled = false;
    let raf1 = 0;
    let raf2 = 0;

    const passiveCapture = { passive: true, capture: true } as const;

    const commitMount = () => {
      if (cancelled || mountedRef.current) return;
      mountedRef.current = true;
      setShouldRender(true);
      observer?.disconnect();
      observer = null;
      window.removeEventListener('scroll', onScroll, passiveCapture);
    };

    const tryMount = () => {
      if (cancelled || mountedRef.current) return;
      if (!layoutReady || !scrollEngaged) return;
      if (isNearViewport(el, VIEWPORT_PRELOAD_PX)) {
        commitMount();
      }
    };

    const attachObserver = () => {
      if (cancelled || mountedRef.current || observer) return;

      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            tryMount();
          }
        },
        { rootMargin: VIEWPORT_ROOT_MARGIN, threshold: VIEWPORT_THRESHOLD }
      );
      observer.observe(el);
    };

    const onScroll = () => {
      if (window.scrollY !== baselineScrollY) {
        if (!scrollEngaged) {
          scrollEngaged = true;
          attachObserver();
        }
      }
      tryMount();
    };

    const startObserving = () => {
      layoutReady = true;
      baselineScrollY = window.scrollY;
      scrollEngaged = baselineScrollY > 0;

      // Scroll-restored landing: mount sections already in/near the viewport.
      if (scrollEngaged) {
        if (isNearViewport(el, VIEWPORT_PRELOAD_PX)) {
          commitMount();
          return;
        }
        attachObserver();
      }

      window.addEventListener('scroll', onScroll, passiveCapture);
    };

    // Defer until after hydration paint + initial layout expansion settle.
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (!cancelled) {
          startObserving();
        }
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      observer?.disconnect();
      window.removeEventListener('scroll', onScroll, passiveCapture);
    };
  }, [shouldRender]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={shouldRender ? undefined : { minHeight: placeholderMinHeight }}
    >
      {shouldRender ? children : null}
    </div>
  );
}
