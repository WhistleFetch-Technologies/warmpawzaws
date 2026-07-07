'use client';

import React, { useCallback, useRef } from 'react';

const SWIPE_THRESHOLD_PX = 48;

export interface ProductImageGalleryProps {
  images: string[];
  alt: string;
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
  fallbackEmoji?: string;
  className?: string;
  /** Renders inside the main frame (e.g. back button, discount badge). */
  overlayTopLeft?: React.ReactNode;
  overlayTopRight?: React.ReactNode;
  /** Full-frame overlay (e.g. out-of-stock dimmer). */
  overlayCenter?: React.ReactNode;
  showThumbnails?: boolean;
}

function isHttpImage(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

export function ProductImageGallery({
  images,
  alt,
  selectedIndex,
  onSelectedIndexChange,
  fallbackEmoji = '🐾',
  className = '',
  overlayTopLeft,
  overlayTopRight,
  overlayCenter,
  showThumbnails = true,
}: ProductImageGalleryProps) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const clampedIndex =
    images.length > 0 ? Math.min(Math.max(selectedIndex, 0), images.length - 1) : 0;

  const goPrev = useCallback(() => {
    if (images.length <= 1) return;
    onSelectedIndexChange((clampedIndex - 1 + images.length) % images.length);
  }, [clampedIndex, images.length, onSelectedIndexChange]);

  const goNext = useCallback(() => {
    if (images.length <= 1) return;
    onSelectedIndexChange((clampedIndex + 1) % images.length);
  }, [clampedIndex, images.length, onSelectedIndexChange]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || images.length <= 1) return;

    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) <= Math.abs(dy)) return;

    if (dx < 0) goNext();
    else goPrev();
  };

  const current = images[clampedIndex];

  return (
    <div className={`w-full min-w-0 ${className}`}>
      <div
        className="relative aspect-square w-full max-w-full overflow-hidden rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white touch-pan-y"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        role={images.length > 1 ? 'region' : undefined}
        aria-label={images.length > 1 ? `${alt} image gallery` : undefined}
      >
        <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4">
          {current && isHttpImage(current) ? (
            <img
              src={current}
              alt={alt}
              className="max-h-full max-w-full h-auto w-auto object-contain select-none"
              draggable={false}
            />
          ) : current ? (
            <span className="text-7xl sm:text-8xl select-none" aria-hidden>
              {current}
            </span>
          ) : (
            <span className="text-7xl sm:text-8xl select-none" aria-hidden>
              {fallbackEmoji}
            </span>
          )}
        </div>

        {overlayTopLeft ? (
          <div className="absolute top-3 left-3 z-20 flex items-start gap-2 pointer-events-none [&>*]:pointer-events-auto">
            {overlayTopLeft}
          </div>
        ) : null}

        {overlayTopRight ? (
          <div className="absolute top-3 right-3 z-20 pointer-events-none [&>*]:pointer-events-auto">
            {overlayTopRight}
          </div>
        ) : null}

        {overlayCenter ? (
          <div className="absolute inset-0 z-10 pointer-events-none [&>*]:pointer-events-auto">
            {overlayCenter}
          </div>
        ) : null}

        {images.length > 1 ? (
          <>
            <div
              className="absolute bottom-3 left-0 right-0 z-20 flex justify-center gap-1.5 px-4 pointer-events-none"
              aria-hidden
            >
              {images.map((_, index) => (
                <span
                  key={index}
                  className={`h-1.5 rounded-full transition-all ${
                    index === clampedIndex ? 'w-5 bg-orange-500' : 'w-1.5 bg-slate-300/90'
                  }`}
                />
              ))}
            </div>
            <p className="sr-only">
              Image {clampedIndex + 1} of {images.length}. Swipe left or right to change.
            </p>
          </>
        ) : null}
      </div>

      {showThumbnails && images.length > 1 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {images.map((img, index) => (
            <button
              key={`${img}-${index}`}
              type="button"
              onClick={() => onSelectedIndexChange(index)}
              className={`flex-shrink-0 h-16 w-16 sm:h-20 sm:w-20 rounded-xl overflow-hidden border-2 transition-all bg-white ${
                clampedIndex === index
                  ? 'border-orange-500 ring-2 ring-orange-200'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
              aria-label={`Show image ${index + 1}`}
              aria-current={clampedIndex === index ? 'true' : undefined}
            >
              {isHttpImage(img) ? (
                <img src={img} alt="" className="h-full w-full object-contain p-0.5" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-slate-50 text-2xl">
                  {img || fallbackEmoji}
                </span>
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
