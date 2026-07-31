'use client';

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Heart, Star, Wallet } from 'lucide-react';
import { CachedImage } from '@/components/shared/CachedImage';
import type { FeaturedProviderCategory } from '@/lib/featured-provider';
import type { WalkInProvider } from '@/lib/mergeWalkInDiscoveryBatches';

/** Walk-in card — 128×228px; content overlaps image base so spacing polish fits without clipping. */
export const CARD_WIDTH_PX = 128;
export const CARD_IMAGE_HEIGHT_PX = 104;
export const CARD_CONTENT_PADDING_Y_PX = 8;
export const CARD_CONTENT_PADDING_X_PX = 11;
export const CARD_DISTANCE_BUTTON_GAP_PX = 7;
export const CARD_CONTENT_OVERLAP_PX = 25;

/** Fixed content slots — declare before CARD_HEIGHT_PX / derived exports (avoids TDZ). */
export const CARD_TITLE_HEIGHT_PX = 36;
export const CARD_CATEGORY_HEIGHT_PX = 18;
export const CARD_META_HEIGHT_PX = 14;
export const CARD_DISTANCE_ROW_HEIGHT_PX = 18;
export const CARD_PAY_BUTTON_HEIGHT_PX = 40;

export const CARD_HEIGHT_PX = 228;
export const CARD_CONTENT_MIN_HEIGHT_PX =
  CARD_HEIGHT_PX - CARD_IMAGE_HEIGHT_PX + CARD_CONTENT_OVERLAP_PX;
export const CARD_IMAGE_RATIO = CARD_IMAGE_HEIGHT_PX / CARD_HEIGHT_PX;

const CARD_WIDTH_CLASS = 'w-[128px]';
const CARD_BUTTON_RADIUS = 'rounded-[14px]';
const CARD_HEART_INSET_PX = 8;
const CARD_RADIUS = 'rounded-[14px]';
const CARD_SHADOW = 'shadow-[0_4px_16px_rgba(0,0,0,0.08)]';

const CATEGORY_STOCK_IMAGE: Partial<Record<FeaturedProviderCategory, string>> = {
  vet: '/images/home/Vet/clinic-visit.webp',
  grooming: '/images/home/Grooming/grooming-center.webp',
  training: '/images/home/Training/header.webp',
  boarding: '/images/home/Boarding/header-img.webp',
};

export function walkInCategoryDisplayLabel(
  category: FeaturedProviderCategory,
  subtitle?: string
): string {
  const trimmed = (subtitle || '').trim();
  const roleLike =
    trimmed &&
    !/professional pet|general vet|certified pet|per visit|starts at|^from$/i.test(trimmed);

  if (roleLike) return trimmed;

  switch (category) {
    case 'vet':
      return 'Veterinary Clinic';
    case 'grooming':
      return 'Pet Grooming';
    case 'training':
      return 'Training Center';
    case 'boarding':
      return 'Pet Boarding';
    case 'sitting':
      return 'Pet Sitting';
    case 'walker':
      return 'Dog Walking';
    default:
      return trimmed || 'Walk-in Service';
  }
}

function categoryStockImage(category: FeaturedProviderCategory): string {
  return CATEGORY_STOCK_IMAGE[category] || '/images/home/vet.webp';
}

function formatWalkInDistance(km: number | null | undefined): string | null {
  if (km == null || !Number.isFinite(km) || km < 0) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function formatWalkInPrice(
  fromPrice: number | null | undefined,
  priceLabel: string | undefined
): string | null {
  if (fromPrice == null || !Number.isFinite(fromPrice) || fromPrice <= 0) return null;
  const unit = (priceLabel || '').trim();
  const lower = unit.toLowerCase();
  if (lower === 'per visit') return `₹${Math.round(fromPrice)} / visit`;
  if (lower === '/night') return `₹${Math.round(fromPrice)} / night`;
  if (lower === 'starts at' || lower === 'starting' || lower === 'from') {
    return `From ₹${Math.round(fromPrice)}`;
  }
  if (!unit) return `₹${Math.round(fromPrice)}`;
  return `₹${Math.round(fromPrice)} / ${unit}`;
}

function shouldShowRating(rating: number, reviewCount: number): boolean {
  return reviewCount > 0 && Number.isFinite(rating) && rating >= 1 && rating <= 5;
}

function isPayViaBadge(label: string): boolean {
  const lower = label.toLowerCase();
  return lower.includes('pay via') || lower.includes('warmpawz pay');
}

function WalkInBadge({ label }: { label: string }) {
  if (isPayViaBadge(label)) {
    return (
      <span className="rounded-md bg-orange-50 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-[#FF8C42]">
        {label}
      </span>
    );
  }

  return (
    <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-emerald-700">
      {label}
    </span>
  );
}

export interface WalkInProviderCardProps {
  provider: WalkInProvider;
  badges?: string[];
  onSelect?: () => void;
  className?: string;
}

function WalkInProviderCardComponent({
  provider,
  badges,
  onSelect,
  className = '',
}: WalkInProviderCardProps) {
  const photoUrl = provider.photoUrl?.trim() || null;
  const stockImage = useMemo(
    () => categoryStockImage(provider.category),
    [provider.category]
  );
  const [imageSrc, setImageSrc] = useState<string | null>(photoUrl || stockImage);

  useEffect(() => {
    setImageSrc(photoUrl || stockImage);
  }, [photoUrl, stockImage]);

  const handleImageUnavailable = useCallback(() => {
    setImageSrc((current) => {
      if (photoUrl && current === photoUrl) return stockImage;
      return null;
    });
  }, [photoUrl, stockImage]);

  const categoryLabel = walkInCategoryDisplayLabel(
    provider.category,
    provider.subtitle
  );
  const distanceText = formatWalkInDistance(provider.distanceKm);
  const priceText = formatWalkInPrice(provider.fromPrice, provider.priceLabel);
  const showRating = shouldShowRating(provider.rating, provider.reviewCount);
  const visibleBadges = (badges || []).filter((b) => String(b).trim().length > 0);
  const hasOptionalMeta = visibleBadges.length > 0 || Boolean(priceText);

  return (
    <article
      className={`${CARD_WIDTH_CLASS} flex shrink-0 snap-start flex-col overflow-hidden ${CARD_RADIUS} bg-white ${CARD_SHADOW} ${className}`}
      style={{ height: CARD_HEIGHT_PX }}
    >
      <div
        className="relative w-full shrink-0 overflow-hidden"
        style={{ height: CARD_IMAGE_HEIGHT_PX }}
      >
        {imageSrc ? (
          <CachedImage
            src={imageSrc}
            alt={provider.displayName}
            fill
            loading="eager"
            className="object-cover object-center"
            onUnavailable={handleImageUnavailable}
          />
        ) : null}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-black/12 to-transparent"
          aria-hidden
        />
        <button
          type="button"
          aria-label="Save provider"
          className="absolute z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-gray-500 shadow-[0_2px_6px_rgba(0,0,0,0.1)] active:scale-95"
          style={{
            top: CARD_HEART_INSET_PX,
            right: CARD_HEART_INSET_PX,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Heart className="h-3 w-3" strokeWidth={1.75} />
        </button>
      </div>

      <div
        className={`relative z-10 flex min-h-0 flex-1 flex-col bg-white ${CARD_RADIUS} rounded-t-none`}
        style={{
          minHeight: CARD_CONTENT_MIN_HEIGHT_PX,
          marginTop: -CARD_CONTENT_OVERLAP_PX,
          paddingTop: CARD_CONTENT_PADDING_Y_PX,
          paddingBottom: CARD_CONTENT_PADDING_Y_PX,
          paddingLeft: CARD_CONTENT_PADDING_X_PX,
          paddingRight: CARD_CONTENT_PADDING_X_PX,
        }}
      >
        <h3
          className="line-clamp-2 shrink-0 overflow-hidden text-[15px] font-semibold leading-[18px] tracking-tight text-gray-900"
          style={{ height: CARD_TITLE_HEIGHT_PX }}
        >
          {provider.displayName}
        </h3>

        <p
          className="shrink-0 overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-normal leading-[18px] text-gray-400"
          style={{ height: CARD_CATEGORY_HEIGHT_PX }}
        >
          {categoryLabel}
        </p>

        <div
          className="flex shrink-0 items-center overflow-hidden"
          style={{ height: CARD_META_HEIGHT_PX }}
        >
          {hasOptionalMeta ? (
            <div className="flex h-full min-w-0 flex-nowrap items-center gap-1 overflow-hidden">
              {visibleBadges.map((badge) => (
                <WalkInBadge key={badge} label={badge} />
              ))}
              {priceText ? (
                <p className="min-w-0 shrink truncate text-[11px] font-semibold leading-none text-[#FF8C42]">
                  {priceText}
                </p>
              ) : null}
            </div>
          ) : (
            <span className="invisible select-none" aria-hidden>
              &nbsp;
            </span>
          )}
        </div>

        <div className="min-h-0 flex-1" aria-hidden />

        <div className="mt-auto shrink-0">
          <div
            className="flex shrink-0 items-center overflow-hidden text-[12px] leading-[18px] text-gray-500"
            style={{
              height: CARD_DISTANCE_ROW_HEIGHT_PX,
              marginBottom: CARD_DISTANCE_BUTTON_GAP_PX,
            }}
          >
            {showRating || distanceText ? (
              <p className="flex min-w-0 items-center gap-1 truncate">
                {showRating ? (
                  <>
                    <Star className="h-3 w-3 shrink-0 fill-[#FF8C42] text-[#FF8C42]" />
                    <span className="font-medium text-gray-800">
                      {provider.rating.toFixed(1)}
                    </span>
                  </>
                ) : null}
                {showRating && distanceText ? (
                  <span className="shrink-0 px-0.5 text-gray-300" aria-hidden>
                    ·
                  </span>
                ) : null}
                {distanceText ? <span className="truncate">{distanceText}</span> : null}
              </p>
            ) : (
              <span className="invisible select-none" aria-hidden>
                &nbsp;
              </span>
            )}
          </div>

          <button
            type="button"
            className={`inline-flex w-full shrink-0 items-center justify-center gap-1.5 ${CARD_BUTTON_RADIUS} bg-[#FF8C42] text-xs font-semibold leading-none text-white shadow-[0_2px_8px_rgba(255,140,66,0.32)] active:scale-[0.98]`}
            style={{ height: CARD_PAY_BUTTON_HEIGHT_PX, minHeight: CARD_PAY_BUTTON_HEIGHT_PX }}
            onClick={onSelect}
          >
            <Wallet className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} aria-hidden />
            <span>Pay Now</span>
          </button>
        </div>
      </div>
    </article>
  );
}

export const WalkInProviderCard = memo(WalkInProviderCardComponent);

export function WalkInProviderCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`${CARD_WIDTH_CLASS} flex shrink-0 snap-start flex-col overflow-hidden ${CARD_RADIUS} bg-white ${CARD_SHADOW} ${className}`}
      style={{ height: CARD_HEIGHT_PX }}
      aria-hidden
    >
      <div className="animate-pulse bg-gray-200" style={{ height: CARD_IMAGE_HEIGHT_PX }} />
      <div
        className={`relative z-10 flex min-h-0 flex-1 flex-col bg-white ${CARD_RADIUS} rounded-t-none`}
        style={{
          minHeight: CARD_CONTENT_MIN_HEIGHT_PX,
          marginTop: -CARD_CONTENT_OVERLAP_PX,
          paddingTop: CARD_CONTENT_PADDING_Y_PX,
          paddingBottom: CARD_CONTENT_PADDING_Y_PX,
          paddingLeft: CARD_CONTENT_PADDING_X_PX,
          paddingRight: CARD_CONTENT_PADDING_X_PX,
        }}
      >
        <div
          className="shrink-0 animate-pulse rounded bg-gray-200"
          style={{ height: CARD_TITLE_HEIGHT_PX }}
        />
        <div
          className="shrink-0 animate-pulse rounded bg-gray-100"
          style={{ height: CARD_CATEGORY_HEIGHT_PX }}
        />
        <div
          className="shrink-0 animate-pulse rounded bg-gray-100"
          style={{ height: CARD_META_HEIGHT_PX }}
        />
        <div className="min-h-0 flex-1" aria-hidden />
        <div className="mt-auto shrink-0">
          <div
            className="animate-pulse rounded bg-gray-100"
            style={{
              height: CARD_DISTANCE_ROW_HEIGHT_PX,
              marginBottom: CARD_DISTANCE_BUTTON_GAP_PX,
            }}
          />
          <div
            className={`animate-pulse bg-gray-200 ${CARD_BUTTON_RADIUS}`}
            style={{ height: CARD_PAY_BUTTON_HEIGHT_PX }}
          />
        </div>
      </div>
    </div>
  );
}

export { CARD_WIDTH_CLASS };
