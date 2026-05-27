'use client';

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { PresignableImage } from '@/components/shared/PresignableImage';
import { getCategoryCardImageUrl } from '../constants/category-card-images';
import { getCategoryCardTheme, type CategoryCardTheme } from '../constants/category-card-themes';

/** Bottom zone height — includes padding so the photo is not clipped by the card edge. */
const CARD_PHOTO_ZONE_HEIGHT_PX = 62;

const PHOTO_IMG_CLASS =
  'block h-full w-full max-h-full max-w-full rounded-lg object-contain object-bottom';

export interface ServiceCategoryCardProps {
  screen: string;
  categoryId: string;
  icon: ComponentType<{ className?: string; style?: React.CSSProperties; strokeWidth?: number }>;
  color: string;
  label: string;
  theme?: CategoryCardTheme;
  showSoonBadge?: boolean;
  className?: string;
}

function ServiceCategoryCardComponent({
  screen,
  categoryId,
  icon: Icon,
  color,
  label,
  theme: themeProp,
  showSoonBadge = false,
  className = '',
}: ServiceCategoryCardProps) {
  const [imageUnavailable, setImageUnavailable] = useState(false);

  const imageUrl = useMemo(() => {
    return (
      getCategoryCardImageUrl(screen) ||
      getCategoryCardImageUrl(categoryId) ||
      undefined
    );
  }, [screen, categoryId]);

  const theme = useMemo(
    () =>
      themeProp ||
      getCategoryCardTheme(categoryId || screen, color) ||
      getCategoryCardTheme(screen, color),
    [themeProp, categoryId, screen, color]
  );

  const showPhoto = Boolean(imageUrl) && !imageUnavailable;
  const isStaticLocal = Boolean(
    imageUrl?.startsWith('/') && !imageUrl.includes('amazonaws.com')
  );

  const handleImageUnavailable = useCallback(() => {
    setImageUnavailable(true);
  }, []);

  useEffect(() => {
    setImageUnavailable(false);
  }, [imageUrl]);

  return (
    <div
      className={`relative h-[7.75rem] w-[5.25rem] flex-shrink-0 overflow-hidden rounded-2xl ${className}`}
      style={{ backgroundColor: theme.tintColor }}
    >
      {showSoonBadge ? (
        <span className="absolute right-1 top-1 z-20 rounded-md bg-amber-500 px-1 py-0.5 text-[7px] font-bold uppercase leading-none text-white shadow-sm">
          Soon
        </span>
      ) : null}

      {/* Bottom photo — padded, rounded, object-contain (no edge crop) */}
      {showPhoto && imageUrl ? (
        <div
          className="absolute inset-x-0 bottom-0 z-0 box-border flex items-end justify-center p-1.5"
          style={{ height: CARD_PHOTO_ZONE_HEIGHT_PX }}
        >
          {isStaticLocal ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              className={PHOTO_IMG_CLASS}
              onError={handleImageUnavailable}
            />
          ) : (
            <PresignableImage
              src={imageUrl}
              alt=""
              className={PHOTO_IMG_CLASS}
              onUnavailable={handleImageUnavailable}
            />
          )}
        </div>
      ) : null}

      {/* Top: line icon + label only */}
      <div
        className="relative z-10 flex min-h-0 flex-col items-center px-2 pb-1 pt-3"
        style={{
          height: showPhoto ? `calc(100% - ${CARD_PHOTO_ZONE_HEIGHT_PX}px)` : '100%',
          backgroundColor: showPhoto ? 'rgba(255, 255, 255, 0.97)' : theme.tintColor,
        }}
      >
        <Icon
          className="mb-1.5 h-6 w-6 shrink-0"
          style={{ color: theme.iconColor }}
          strokeWidth={1.75}
          aria-hidden
        />
        <span className="text-center text-[11px] font-bold leading-tight text-gray-900 line-clamp-2">
          {label}
        </span>
      </div>
    </div>
  );
}

/** Vertical home category tile — line icon + label on top, single photo strip at bottom. */
export const ServiceCategoryCard = memo(ServiceCategoryCardComponent);
