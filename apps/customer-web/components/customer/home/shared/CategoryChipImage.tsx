'use client';

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { CachedImage } from '@/components/shared/CachedImage';
import { getCategoryCardImageUrl } from '../constants/category-card-images';

export interface CategoryChipImageProps {
  screen: string;
  categoryId: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
  alt: string;
  showSoonBadge?: boolean;
  className?: string;
}

function CategoryChipImageComponent({
  screen,
  categoryId,
  icon: Icon,
  color,
  alt,
  showSoonBadge = false,
  className = '',
}: CategoryChipImageProps) {
  const [imageUnavailable, setImageUnavailable] = useState(false);

  const imageUrl = useMemo(() => {
    return (
      getCategoryCardImageUrl(screen) ||
      getCategoryCardImageUrl(categoryId) ||
      undefined
    );
  }, [screen, categoryId]);

  const showImage = Boolean(imageUrl) && !imageUnavailable;

  const handleImageUnavailable = useCallback(() => {
    setImageUnavailable(true);
  }, []);

  useEffect(() => {
    setImageUnavailable(false);
  }, [imageUrl]);

  return (
    <div
      className={`relative h-14 w-14 overflow-hidden rounded-2xl shadow-sm ${
        showImage ? '' : `${color} flex items-center justify-center`
      } ${className}`}
    >
      {showSoonBadge ? (
        <span className="absolute -top-0.5 -right-0.5 z-[1] rounded-md bg-amber-500 px-1 py-0.5 text-[7px] font-bold uppercase leading-none text-white shadow-sm">
          Soon
        </span>
      ) : null}
      {showImage && imageUrl ? (
        <CachedImage
          src={imageUrl}
          alt={alt}
          fill
          className="object-cover"
          sizes="56px"
          onUnavailable={handleImageUnavailable}
        />
      ) : (
        <Icon className="h-6 w-6" aria-hidden />
      )}
    </div>
  );
}

/** w-14 category chip — static /images/home, S3 via PresignableImage, else icon + color. */
export const CategoryChipImage = memo(CategoryChipImageComponent);
