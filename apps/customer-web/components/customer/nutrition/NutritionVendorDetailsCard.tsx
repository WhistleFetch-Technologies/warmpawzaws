'use client';

import { MapPin, UtensilsCrossed, Clock } from 'lucide-react';
import { resolveNextAvailableLabel } from '@/lib/available-slots-response';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StarRating } from '@/components/customer/shared/StarRating';
import {
  MealKitchenClosedBadge,
  MealKitchenStatusBanner,
} from '@/components/customer/nutrition/MealKitchenStatusBanner';
import { isMealKitchenClosed, mealKitchenClosedMessage } from '@/lib/meal-kitchen-availability';
import { normalizeProviderListPhoto } from '@/lib/resolve-display-image-url';

/** Vendor shape from discovery, meal search rows, or navigation snapshot */
export type NutritionVendorCardModel = {
  id?: string;
  vendorId?: string;
  businessName?: string;
  name?: string;
  vendor_name?: string;
  rating?: number;
  vendor_rating?: number;
  reviewCount?: number;
  review_count?: number;
  address?: string;
  vendor_address?: string;
  city?: string;
  photo?: string;
  profile_photo_url?: string;
  acceptingMealOrders?: boolean;
  kitchenClosedMessage?: string | null;
  nextAvailableSlot?: string;
};

function displayName(v: NutritionVendorCardModel): string {
  return (
    v.businessName ||
    v.name ||
    v.vendor_name ||
    'Nutritionist'
  ).trim();
}

function ratingOf(v: NutritionVendorCardModel): number | undefined {
  const r = v.rating ?? v.vendor_rating;
  if (r == null || Number.isNaN(Number(r))) return undefined;
  return Number(r);
}

function reviewsOf(v: NutritionVendorCardModel): number | undefined {
  const c = v.reviewCount ?? v.review_count;
  if (c == null || Number.isNaN(Number(c))) return undefined;
  return Number(c);
}

/** Map discovery / merged nutrition provider rows to {@link NutritionVendorCardModel}. */
export function nutritionVendorFromDiscoveryRow(
  row: Record<string, unknown> | null | undefined
): NutritionVendorCardModel {
  if (!row || typeof row !== 'object') return {};
  const vendorId = String(row.id ?? row.vendorId ?? '').trim();
  const label =
    (row.businessName as string | undefined) ??
    (row.name as string | undefined) ??
    (row.vendor_name as string | undefined);
  const ratingRaw = row.rating ?? row.vendor_rating;
  const rating =
    ratingRaw != null && Number.isFinite(Number(ratingRaw)) ? Number(ratingRaw) : undefined;
  const rcRaw = row.reviewCount ?? row.review_count;
  const reviewCount =
    rcRaw != null && Number.isFinite(Number(rcRaw)) ? Math.round(Number(rcRaw)) : undefined;

  const rawNextAvailable = resolveNextAvailableLabel(row as { nextAvailable?: unknown; nextAvailableSlot?: unknown; nextAvailability?: unknown });
  const nextAvailableSlot =
    rawNextAvailable && rawNextAvailable !== 'Tap to view availability'
      ? rawNextAvailable
      : undefined;

  return {
    id: vendorId || undefined,
    vendorId: vendorId || undefined,
    businessName: label,
    name: (row.name as string | undefined) ?? (row.businessName as string | undefined),
    vendor_name:
      (row.vendor_name as string | undefined) ?? label,
    rating,
    vendor_rating: rating,
    reviewCount,
    review_count: reviewCount,
    address:
      (row.address as string | undefined) ?? (row.vendor_address as string | undefined),
    vendor_address:
      (row.vendor_address as string | undefined) ?? (row.address as string | undefined),
    city: (row.city as string | undefined) ?? (row.vendor_city as string | undefined),
    photo: normalizeProviderListPhoto(row),
    profile_photo_url: row.profile_photo_url as string | undefined,
    nextAvailableSlot,
  };
}

export interface NutritionVendorDetailsCardProps {
  vendor: NutritionVendorCardModel;
  /** Browse tile: show primary CTA to open this vendor’s meal plans */
  showViewMealPlans?: boolean;
  onViewMealPlans?: () => void;
  /** Optional: tele / consultation booking */
  showBookConsultation?: boolean;
  onBookConsultation?: () => void;
  /** Optional: open vendor profile (WAPPT discovery) */
  onViewProfile?: () => void;
  /** Drill-down header: no “View Meal Plans”; optional line under title */
  subtitle?: string;
  className?: string;
}

/**
 * Shared nutritionist vendor surface for meal-plan flows and expert lists.
 */
export function NutritionVendorDetailsCard({
  vendor,
  showViewMealPlans = false,
  onViewMealPlans,
  showBookConsultation = false,
  onBookConsultation,
  onViewProfile,
  subtitle,
  className = '',
}: NutritionVendorDetailsCardProps) {
  const title = displayName(vendor);
  const rating = ratingOf(vendor);
  const reviewCount = reviewsOf(vendor);
  const addr =
    (vendor.address || vendor.vendor_address || '').trim() || undefined;
  const photo = vendor.photo || vendor.profile_photo_url;
  const kitchenClosed = isMealKitchenClosed(vendor);
  const kitchenMsg = mealKitchenClosedMessage(vendor);

  return (
    <Card
      className={`rounded-2xl border border-slate-100 bg-white p-4 shadow-sm ${className}`}
    >
      <div className="flex items-start gap-4">
        {photo ? (
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#FFF5EE] to-[#FFE8D6] text-lg font-bold text-[#FF8C42] ring-1 ring-orange-100/60">
            {title.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={`truncate font-bold text-slate-900${onViewProfile ? ' cursor-pointer hover:text-[#FF8C42]' : ''}`}
              onClick={
                onViewProfile
                  ? (e) => {
                      e.stopPropagation();
                      onViewProfile();
                    }
                  : undefined
              }
            >
              {title}
            </h3>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
              Nutritionist
            </span>
            {kitchenClosed ? <MealKitchenClosedBadge /> : null}
          </div>
          {kitchenClosed ? (
            <div className="mt-2">
              <MealKitchenStatusBanner message={kitchenMsg} />
            </div>
          ) : null}
          {subtitle ? (
            <p className="mt-1 text-xs text-slate-600">{subtitle}</p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            {rating != null && rating > 0 ? (
              <StarRating
                rating={rating}
                reviewCount={reviewCount}
                starsClassName="h-3 w-3"
                textClassName="text-xs text-slate-500"
              />
            ) : (
              <span className="text-xs text-slate-500">New on Warmpawz</span>
            )}
          </div>
          {addr ? (
            <div className="mt-2 flex items-start gap-1.5 text-xs text-slate-600">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="line-clamp-2">{addr}</span>
            </div>
          ) : null}
          {vendor.city ? (
            <p className="mt-0.5 text-xs text-slate-500">{vendor.city}</p>
          ) : null}
          {vendor.nextAvailableSlot ? (
            <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
              <Clock className="h-3 w-3" />
              <span>Next: {vendor.nextAvailableSlot}</span>
            </div>
          ) : null}

          {(showViewMealPlans || showBookConsultation) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {showViewMealPlans ? (
                <Button
                  type="button"
                  size="sm"
                  className="bg-[#FF8C42] font-semibold text-white hover:bg-[#E67A35]"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewMealPlans?.();
                  }}
                >
                  <UtensilsCrossed className="mr-1.5 h-4 w-4" />
                  View Meal Plans
                </Button>
              ) : null}
              {showBookConsultation ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-[#FF8C42] font-semibold text-[#FF8C42] hover:bg-orange-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    onBookConsultation?.();
                  }}
                >
                  View services
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
