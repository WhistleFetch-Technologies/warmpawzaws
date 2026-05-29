'use client';

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { PresignableImage } from '@/components/shared/PresignableImage';
import { getCategoryCardImageUrl } from '../constants/category-card-images';
import { getCategoryCardTheme, type CategoryCardTheme } from '../constants/category-card-themes';

const IMAGE_RADIUS_CLASS = 'rounded-[17px]';
const HERO_IMG_CLASS = `absolute inset-0 h-full w-full object-cover object-center ${IMAGE_RADIUS_CLASS}`;

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
      className={`relative flex h-[6.5rem] w-[4.5rem] flex-shrink-0 flex-col overflow-hidden rounded-2xl ${className}`}
    >
      <div
        className="relative min-h-0 w-full flex-1 p-1"
        style={{ backgroundColor: theme.tintColor }}
      >
        {showSoonBadge ? (
          <span className="absolute left-2 top-2 z-30 rounded-md bg-amber-500 px-1 py-0.5 text-[7px] font-bold uppercase leading-none text-white shadow-sm">
            Soon
          </span>
        ) : null}

        <div className="relative h-full w-full">
          <div
            className={`relative h-full w-full overflow-hidden ${IMAGE_RADIUS_CLASS}`}
            style={!showPhoto ? { backgroundColor: theme.tintColor } : undefined}
          >
            {showPhoto && imageUrl ? (
              isStaticLocal ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt=""
                  className={HERO_IMG_CLASS}
                  onError={handleImageUnavailable}
                />
              ) : (
                <PresignableImage
                  src={imageUrl}
                  alt=""
                  className={HERO_IMG_CLASS}
                  onUnavailable={handleImageUnavailable}
                />
              )
            ) : null}
          </div>

          <div className="absolute -right-2 -top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">
            <Icon
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: theme.iconColor }}
              strokeWidth={1.75}
              aria-hidden
            />
          </div>
        </div>
      </div>

      <div className="relative z-10 flex shrink-0 items-center justify-center bg-white px-2 py-1.5">
        <span className="text-center text-[11px] font-bold leading-tight text-gray-900 line-clamp-2">
          {label}
        </span>
      </div>
    </div>
  );
}

/** Vertical home category tile — hero photo with floating icon badge + label strip. */
export const ServiceCategoryCard = memo(ServiceCategoryCardComponent);
