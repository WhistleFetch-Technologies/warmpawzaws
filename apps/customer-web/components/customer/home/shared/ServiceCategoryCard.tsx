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

  const tintHover = theme.tintColorHover ?? theme.tintColor;

  return (
    <div
      className={`relative flex h-[6.5rem] w-[4.5rem] flex-shrink-0 flex-col rounded-2xl ${className}`}
      style={
        {
          '--card-tint': theme.tintColor,
          '--card-tint-hover': tintHover,
          '--icon-accent': theme.iconColor,
        } as React.CSSProperties
      }
    >
      <div
        className="relative min-h-0 w-full flex-1 rounded-t-2xl bg-[var(--card-tint)] p-[5px] transition-[background-color,box-shadow] duration-300 ease-out group-hover:bg-[var(--card-tint-hover)] group-hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55)]"
      >
        {showSoonBadge ? (
          <span className="absolute left-2 top-2 z-30 rounded-md bg-amber-500 px-1 py-0.5 text-[7px] font-bold uppercase leading-none text-white shadow-sm">
            Soon
          </span>
        ) : null}

        <div className="relative h-full w-full">
          <div
            className={`relative h-full w-full overflow-hidden shadow-sm transition-[transform,box-shadow] duration-300 ease-out group-hover:shadow-md ${IMAGE_RADIUS_CLASS}`}
            style={!showPhoto ? { backgroundColor: theme.tintColor } : undefined}
          >
            {showPhoto && imageUrl ? (
              isStaticLocal ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt=""
                  className={`${HERO_IMG_CLASS} transition-transform duration-300 ease-out group-hover:scale-[1.04]`}
                  onError={handleImageUnavailable}
                />
              ) : (
                <PresignableImage
                  src={imageUrl}
                  alt=""
                  className={`${HERO_IMG_CLASS} transition-transform duration-300 ease-out group-hover:scale-[1.04]`}
                  onUnavailable={handleImageUnavailable}
                />
              )
            ) : null}
          </div>
        </div>

        <div className="pointer-events-none absolute right-[3px] top-[3px] z-30 flex h-7 w-7 translate-x-[30%] -translate-y-[30%] items-center justify-center rounded-full border-[1.5px] border-[color-mix(in_srgb,var(--icon-accent)_22%,#ffffff)] bg-white shadow-[0_2px_8px_rgba(15,23,42,0.08)] transition-[box-shadow,border-color,background-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:border-[color-mix(in_srgb,var(--icon-accent)_52%,#ffffff)] group-hover:bg-[color-mix(in_srgb,var(--icon-accent)_6%,#ffffff)] group-hover:shadow-[0_4px_14px_rgba(15,23,42,0.12)]">
          <Icon
            className="h-3.5 w-3.5 shrink-0 transition-[color,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-95"
            style={{ color: theme.iconColor }}
            strokeWidth={1.75}
            aria-hidden
          />
        </div>
      </div>

      <div className="relative z-10 flex shrink-0 items-center justify-center rounded-b-2xl bg-white px-1.5 py-1.5">
        <span className="text-center text-[11px] font-bold leading-tight text-gray-900 transition-colors duration-300 ease-out group-hover:text-gray-950 line-clamp-2">
          {label}
        </span>
      </div>
    </div>
  );
}

/** Vertical home category tile — hero photo with floating icon badge + label strip. */
export const ServiceCategoryCard = memo(ServiceCategoryCardComponent);
