'use client';

import React, { memo, useCallback, useEffect, useState } from 'react';
import { Calendar, Star, Wallet } from 'lucide-react';
import { CachedImage } from '@/components/shared/CachedImage';
import type { FeaturedProviderCategory } from '@/lib/featured-provider';
import type { WalkInProvider } from '@/lib/mergeWalkInDiscoveryBatches';

/** Walk-in card — 128px wide; square API thumbs use a 128×128 image band. */
export const CARD_WIDTH_PX = 128;
/** Image band before square slot fix. */
export const CARD_IMAGE_HEIGHT_PREVIOUS_PX = 104;
/** Home carousel: 1:1 slot at card width — matches 400×400 list thumbs. */
export const CARD_IMAGE_HEIGHT_CAROUSEL_PX = 128;
/** /walk-in stack: same band height as carousel for a consistent photo strip. */
export const CARD_IMAGE_HEIGHT_STACK_PX = 128;
/** @deprecated Prefer layout-specific height constants. */
export const CARD_IMAGE_HEIGHT_PX = CARD_IMAGE_HEIGHT_CAROUSEL_PX;
export const CARD_CONTENT_PADDING_Y_PX = 8;
export const CARD_CONTENT_PADDING_X_PX = 11;
export const CARD_DISTANCE_BUTTON_GAP_PX = 7;
export const CARD_CONTENT_OVERLAP_PX = 10;
/** Tight gap between category/meta and distance row (reference layout). */
export const CARD_META_TO_ACTIONS_GAP_PX = 6;

/** Fixed content slots — declare before derived height exports (avoids TDZ). */
export const CARD_TITLE_HEIGHT_PX = 36;
export const CARD_CATEGORY_HEIGHT_PX = 18;
export const CARD_META_HEIGHT_PX = 14;
export const CARD_DISTANCE_ROW_HEIGHT_PX = 18;
export const CARD_PAY_BUTTON_HEIGHT_PX = 40;
export const CARD_BOOK_BUTTON_HEIGHT_PX = 40;
export const CARD_BUTTON_STACK_GAP_PX = 8;

/** Total card height before rebalancing (128px image squeezed into 276px). */
export const CARD_HEIGHT_PREVIOUS_PX = 276;

export function walkInCardImageHeightPx(layout: 'carousel' | 'stack' = 'carousel'): number {
  return layout === 'stack' ? CARD_IMAGE_HEIGHT_STACK_PX : CARD_IMAGE_HEIGHT_CAROUSEL_PX;
}

/** White content panel height — fixed slots + meta→actions gap (meta row collapses when empty). */
export function walkInCardContentMinHeightPx(_layout: 'carousel' | 'stack' = 'carousel'): number {
  return (
    CARD_CONTENT_PADDING_Y_PX * 2 +
    CARD_TITLE_HEIGHT_PX +
    CARD_CATEGORY_HEIGHT_PX +
    CARD_META_TO_ACTIONS_GAP_PX +
    CARD_DISTANCE_ROW_HEIGHT_PX +
    CARD_DISTANCE_BUTTON_GAP_PX +
    CARD_PAY_BUTTON_HEIGHT_PX +
    CARD_BUTTON_STACK_GAP_PX +
    CARD_BOOK_BUTTON_HEIGHT_PX
  );
}

/** image + content − overlap; grows with image band instead of compressing actions. */
export function walkInCardHeightPx(layout: 'carousel' | 'stack' = 'carousel'): number {
  return (
    walkInCardImageHeightPx(layout) +
    walkInCardContentMinHeightPx(layout) -
    CARD_CONTENT_OVERLAP_PX
  );
}

export const CARD_HEIGHT_CAROUSEL_PX = walkInCardHeightPx('carousel');
export const CARD_HEIGHT_STACK_PX = walkInCardHeightPx('stack');
/** Carousel card height (128px image + full content stack). */
export const CARD_HEIGHT_PX = CARD_HEIGHT_CAROUSEL_PX;
export const CARD_IMAGE_RATIO = CARD_IMAGE_HEIGHT_CAROUSEL_PX / CARD_HEIGHT_PX;
export const CARD_IMAGE_SLOT_ASPECT =
  CARD_WIDTH_PX / CARD_IMAGE_HEIGHT_CAROUSEL_PX;

/** @deprecated Use walkInCardContentMinHeightPx(layout). */
export const CARD_CONTENT_MIN_HEIGHT_PX = walkInCardContentMinHeightPx('carousel');

const CARD_WIDTH_CLASS = 'w-[128px]';
const CARD_BUTTON_RADIUS = 'rounded-[14px]';
const CARD_RADIUS = 'rounded-[14px]';
const CARD_SHADOW = 'shadow-[0_4px_16px_rgba(0,0,0,0.08)]';

export function walkInCategoryDisplayLabel(
  category: FeaturedProviderCategory | string,
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
    case 'nutrition':
    case 'nutritionist':
      return 'Pet Nutrition';
    case 'behaviorist':
    case 'behaviourist':
      return 'Behavior Specialist';
    default:
      return trimmed || 'Walk-in Service';
  }
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
  onBook?: () => void;
  /** @deprecated Capability flags on the provider are authoritative. */
  showPayActions?: boolean;
  layout?: 'carousel' | 'stack';
  className?: string;
}

function WalkInProviderCardComponent({
  provider,
  badges,
  onSelect,
  onBook,
  showPayActions: _showPayActions,
  layout = 'carousel',
  className = '',
}: WalkInProviderCardProps) {
  const photoUrl = provider.photoUrl?.trim() || null;
  const vendorInitial = provider.displayName?.charAt(0)?.toUpperCase() || 'P';
  const [imageFailed, setImageFailed] = useState(false);
  const showVendorPhoto = Boolean(photoUrl) && !imageFailed;
  const imageHeightPx = walkInCardImageHeightPx(layout);

  useEffect(() => {
    setImageFailed(false);
  }, [photoUrl]);

  const handleImageUnavailable = useCallback(() => {
    setImageFailed(true);
  }, []);

  const categoryLabel = walkInCategoryDisplayLabel(
    provider.category,
    provider.subtitle
  );
  const distanceText = formatWalkInDistance(provider.distanceKm);
  const priceText = formatWalkInPrice(provider.fromPrice, provider.priceLabel);
  const showRating = shouldShowRating(provider.rating, provider.reviewCount);
  const visibleBadges = (badges || []).filter((b) => String(b).trim().length > 0);
  const hasOptionalMeta = visibleBadges.length > 0 || Boolean(priceText);
  const optionalMetaHeightPx = hasOptionalMeta ? CARD_META_HEIGHT_PX : 0;
  const showPayBill = provider.warmpawzPayEligible === true;
  const showBookNow = provider.appointmentEligible === true;
  const actionCount = (showPayBill ? 1 : 0) + (showBookNow ? 1 : 0);
  const extraActionHeight =
    actionCount <= 1 ? -(CARD_BOOK_BUTTON_HEIGHT_PX + CARD_BUTTON_STACK_GAP_PX) : 0;
  const widthClass = layout === 'stack' ? 'w-full max-w-customer' : CARD_WIDTH_CLASS;
  const layoutClass =
    layout === 'stack' ? 'snap-none' : 'shrink-0 snap-start';
  const contentMinHeightPx =
    walkInCardContentMinHeightPx(layout) + optionalMetaHeightPx + extraActionHeight;
  const cardHeightPx =
    walkInCardHeightPx(layout) + optionalMetaHeightPx + extraActionHeight;

  return (
    <article
      className={`${widthClass} flex ${layoutClass} flex-col overflow-hidden ${CARD_RADIUS} bg-white ${CARD_SHADOW} ${className}`}
      style={{ height: cardHeightPx }}
    >
      <div
        className="relative w-full shrink-0 overflow-hidden bg-gradient-to-br from-orange-50/80 via-slate-50 to-slate-100"
        style={{ height: imageHeightPx }}
      >
        {showVendorPhoto ? (
          <CachedImage
            src={photoUrl}
            alt={provider.displayName}
            fill
            loading="eager"
            className="object-contain object-center"
            onUnavailable={handleImageUnavailable}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#FF8C42] to-[#FF7029]"
            aria-hidden
          >
            <span className="text-2xl font-bold text-white">{vendorInitial}</span>
          </div>
        )}
      </div>

      <div
        className={`relative z-10 flex shrink-0 flex-col bg-white ${CARD_RADIUS} rounded-t-none`}
        style={{
          minHeight: contentMinHeightPx,
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
          style={{ height: hasOptionalMeta ? CARD_META_HEIGHT_PX : 0 }}
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
          ) : null}
        </div>

        <div
          className="shrink-0"
          style={{ height: CARD_META_TO_ACTIONS_GAP_PX }}
          aria-hidden
        />

        <div className="shrink-0">
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

          {showPayBill ? (
          <button
            type="button"
            className={`inline-flex w-full shrink-0 items-center justify-center gap-1.5 ${CARD_BUTTON_RADIUS} bg-[#FF8C42] text-xs font-semibold leading-none text-white shadow-[0_2px_8px_rgba(255,140,66,0.32)] active:scale-[0.98]`}
            style={{ height: CARD_PAY_BUTTON_HEIGHT_PX, minHeight: CARD_PAY_BUTTON_HEIGHT_PX }}
            onClick={(event) => {
              event.stopPropagation();
              onSelect?.();
            }}
          >
            <Wallet className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} aria-hidden />
            <span>Pay Bill</span>
          </button>
          ) : null}

          {showBookNow ? (
          <button
            type="button"
            className={`inline-flex w-full shrink-0 items-center justify-center gap-1.5 ${CARD_BUTTON_RADIUS} border border-[#FF8C42] bg-white text-xs font-semibold leading-none text-[#FF8C42] active:scale-[0.98]`}
            style={{
              height: CARD_BOOK_BUTTON_HEIGHT_PX,
              minHeight: CARD_BOOK_BUTTON_HEIGHT_PX,
              marginTop: showPayBill ? CARD_BUTTON_STACK_GAP_PX : 0,
            }}
            onClick={(event) => {
              event.stopPropagation();
              onBook?.();
            }}
          >
            <Calendar className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} aria-hidden />
            <span>Book Now</span>
          </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export const WalkInProviderCard = memo(WalkInProviderCardComponent);

export function WalkInProviderCardSkeleton({
  className = '',
  layout = 'carousel',
}: {
  className?: string;
  layout?: 'carousel' | 'stack';
}) {
  const widthClass = layout === 'stack' ? 'w-full max-w-customer' : CARD_WIDTH_CLASS;
  const layoutClass = layout === 'stack' ? 'snap-none' : 'shrink-0 snap-start';
  const imageHeightPx = walkInCardImageHeightPx(layout);
  const contentMinHeightPx = walkInCardContentMinHeightPx(layout);
  const cardHeightPx = walkInCardHeightPx(layout);

  return (
    <div
      className={`${widthClass} flex ${layoutClass} flex-col overflow-hidden ${CARD_RADIUS} bg-white ${CARD_SHADOW} ${className}`}
      style={{ height: cardHeightPx }}
      aria-hidden
    >
      <div className="animate-pulse bg-gray-200" style={{ height: imageHeightPx }} />
      <div
        className={`relative z-10 flex shrink-0 flex-col bg-white ${CARD_RADIUS} rounded-t-none`}
        style={{
          minHeight: contentMinHeightPx,
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
          className="shrink-0"
          style={{ height: CARD_META_TO_ACTIONS_GAP_PX }}
          aria-hidden
        />
        <div className="shrink-0">
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
          <div
            className={`animate-pulse border border-gray-200 bg-gray-100 ${CARD_BUTTON_RADIUS}`}
            style={{
              height: CARD_BOOK_BUTTON_HEIGHT_PX,
              marginTop: CARD_BUTTON_STACK_GAP_PX,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export { CARD_WIDTH_CLASS };
