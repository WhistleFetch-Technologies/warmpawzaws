'use client';

import React, { useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import {
  resolveEffectiveMealDeliveryState,
  shouldShowDeliveryRider,
} from '@warmpawz/shared-types';
import {
  extractDestinationCoordinates,
  extractRiderCoordinates,
  resolveRiderPhoto,
} from '@/lib/meal-tracking-utils';
import { MealLiveMapSection } from '@/components/customer/tracking/MealLiveMapSection';
import { MealDeliveryAddressCard } from '@/components/customer/tracking/MealDeliveryAddressCard';
import { MealDeliveryPartnerCard } from '@/components/customer/tracking/MealDeliveryPartnerCard';
import { MealDeliveryProgressTimeline } from '@/components/customer/tracking/MealDeliveryProgressTimeline';
import { MealOrderDetailsCard } from '@/components/customer/tracking/MealOrderDetailsCard';
import { MealPaymentSummaryCard } from '@/components/customer/tracking/MealPaymentSummaryCard';
import {
  MealPlanOrderTrackingUI,
  formatMealOrderDisplayId,
} from '@/components/customer/tracking/MealPlanOrderTrackingUI';
import { MealTrackingRatingFooter } from '@/components/customer/tracking/MealTrackingRatingFooter';
import { MealTrackingReviewModal } from '@/components/customer/tracking/MealTrackingReviewModal';
import { MealTrackingSupportCard } from '@/components/customer/tracking/MealTrackingSupportCard';
import { MealTrackingStatusHero } from '@/components/customer/tracking/MealTrackingStatusHero';
import {
  buildMealTimelineTimestamps,
  resolveMealTrackingHeroVariant,
} from '@/components/customer/tracking/meal-tracking-display';
import { formatMealOrderDeliveryAddress, resolveMealPlanTitle } from '@/lib/meal-order-tracking-details';
import { parseMealRefundReview } from '@/lib/meal-refund-review';
import { MealRefundReviewTrackingCard } from '@/components/customer/meal-plans/MealRefundReviewListBanner';
import { shareContent } from '@/lib/shareUtils';

export interface MealTrackingMealViewProps {
  order: Record<string, unknown>;
  customer?: Record<string, unknown> | null;
  tracking: Record<string, unknown> | null;
  orderId: string;
  backSlot: React.ReactNode;
  onSupport: () => void;
  headerExtra?: React.ReactNode;
  reassignPending?: boolean;
}

function resolveDeliveredAt(
  order: Record<string, unknown>,
  tracking: Record<string, unknown> | null,
): string | null {
  const t = tracking?.deliveredAt ?? tracking?.delivered_at;
  if (typeof t === 'string' && t.trim()) return t;
  const o = order.delivered_at ?? order.deliveredAt;
  if (typeof o === 'string' && o.trim()) return o;
  return null;
}

export function MealTrackingMealView({
  order,
  customer,
  tracking,
  orderId,
  backSlot,
  onSupport,
  headerExtra,
  reassignPending = false,
}: MealTrackingMealViewProps) {
  const logisticsStatus = (tracking?.status as string) ?? null;
  const cancelledBy =
    (order.cancelled_by as string) ?? (order.cancelledBy as string) ?? null;
  const cancelledAt =
    (order.cancelled_at as string) ?? (order.cancelledAt as string) ?? null;

  const deliveryEff = resolveEffectiveMealDeliveryState(order.status as string, logisticsStatus, {
    reassignPending,
    cancelledBy,
    cancelledAt,
  });

  const isCancelled =
    deliveryEff === 'cancelled' || (deliveryEff === 'failed' && Boolean(cancelledBy));
  const isDelivered = deliveryEff === 'delivered' && !cancelledBy;

  const riderActive =
    !reassignPending &&
    (deliveryEff === 'picked_up' ||
      deliveryEff === 'on_the_way' ||
      shouldShowDeliveryRider(logisticsStatus, { reassignPending }));

  const riderName =
    (tracking?.rider as { name?: string })?.name?.trim() ||
    (tracking?.deliveryPerson as { name?: string })?.name?.trim() ||
    '';

  const showRiderCard =
    !isDelivered &&
    !reassignPending &&
    shouldShowDeliveryRider(logisticsStatus, { reassignPending }) &&
    Boolean(riderName);

  const otp = tracking?.deliveryOtp ?? tracking?.delivery_otp;
  const etaMinutes = (tracking?.etaMinutes ?? tracking?.eta) as number | undefined;
  const riderPhoto = resolveRiderPhoto(tracking ?? undefined);
  const riderCoords = extractRiderCoordinates(tracking ?? undefined);
  const deliveryAddressText = formatMealOrderDeliveryAddress(order);
  const destination = extractDestinationCoordinates(order, deliveryAddressText);

  const vehicleLabel =
    [
      (tracking?.rider as { vehicleType?: string })?.vehicleType ||
        (tracking?.deliveryPerson as { vehicleType?: string })?.vehicleType,
      (tracking?.rider as { vehicleNumber?: string })?.vehicleNumber ||
        (tracking?.deliveryPerson as { vehicleNumber?: string })?.vehicleNumber,
    ]
      .filter(Boolean)
      .join(' · ') || 'Delivery partner';

  const riderPhone =
    (tracking?.rider as { phone?: string })?.phone?.trim() ||
    (tracking?.deliveryPerson as { phone?: string })?.phone?.trim() ||
    '';

  const refundReview = parseMealRefundReview(order.refundReview);
  const mealPlanName = resolveMealPlanTitle(order);
  const heroVariant = resolveMealTrackingHeroVariant(order.status as string, logisticsStatus, {
    reassignPending,
    cancelledBy,
    cancelledAt,
    isCancelled,
    isDelivered,
  });

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  const existingRating = order.rating != null ? Number(order.rating) : null;
  const alreadyRated = reviewSubmitted || (existingRating != null && existingRating > 0);

  const submitReview = async () => {
    if (reviewRating < 1 || reviewRating > 5) return;
    setReviewSubmitting(true);
    try {
      await apiClient.post(`/meal/orders/${orderId}/review`, {
        rating: reviewRating,
        review: reviewText || undefined,
      });
      setReviewSubmitted(true);
      setShowReviewModal(false);
      toast.success('Thank you for your feedback!');
    } catch (err) {
      console.error('Submit review error:', err);
      toast.error('Could not submit review. Try again.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleShare = () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    void shareContent({
      title: 'Track my Warmpawz meal order',
      text: `Track order ${formatMealOrderDisplayId(order)}`,
      url,
    });
  };

  const stepTimestamps = buildMealTimelineTimestamps(order, tracking);

  return (
    <>
      <MealPlanOrderTrackingUI
        orderDisplayId={formatMealOrderDisplayId(order)}
        backSlot={backSlot}
        onSupport={onSupport}
        onShare={handleShare}
        headerExtra={headerExtra}
        statusHero={
          <MealTrackingStatusHero
            variant={heroVariant}
            mealPlanName={mealPlanName}
            deliveredAt={resolveDeliveredAt(order, tracking)}
            etaMinutes={etaMinutes}
          />
        }
        refundReviewCard={
          refundReview ? <MealRefundReviewTrackingCard refundReview={refundReview} /> : undefined
        }
        deliveryOtpBanner={
          otp && riderActive && !isDelivered ? (
            <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 shadow-sm">
              <p className="mb-2 text-sm font-medium text-amber-800">
                Handover OTP — share with delivery partner
              </p>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <span className="text-3xl font-mono font-bold tracking-[0.3em] text-amber-900">
                  {String(otp)}
                </span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(String(otp))}
                  className="min-h-11 rounded-lg bg-amber-200 px-4 py-2 text-sm font-medium text-amber-900"
                >
                  Copy
                </button>
              </div>
            </div>
          ) : undefined
        }
        liveTrackingMap={
          <MealLiveMapSection
            logisticsPartner={
              (tracking?.logistics_partner as string) ?? (tracking?.logisticsPartner as string) ?? null
            }
            logisticsType={
              (order.logistics_type as string) ?? (order.logisticsType as string) ?? null
            }
            logisticsStatus={logisticsStatus}
            orderEffectiveState={deliveryEff}
            reassignPending={reassignPending}
            riderCoords={riderCoords}
            destination={destination}
            etaMinutes={etaMinutes}
            distanceRemainingKm={tracking?.distanceRemaining as number | undefined}
            lastLocationUpdate={
              (tracking?.lastLocationUpdate as string) ??
              (tracking?.last_location_update as string) ??
              null
            }
          />
        }
        deliveryProgressTimeline={
          <MealDeliveryProgressTimeline
            orderStatus={order.status as string}
            logisticsStatus={logisticsStatus}
            progressOptions={{ reassignPending, cancelledBy, cancelledAt }}
            stepTimestamps={stepTimestamps}
          />
        }
        deliveryPartnerCard={
          showRiderCard ? (
            <MealDeliveryPartnerCard
              riderName={riderName}
              riderPhone={riderPhone}
              riderPhoto={riderPhoto}
              vehicleLabel={vehicleLabel}
              etaMinutes={etaMinutes}
            />
          ) : undefined
        }
        deliveryAddressCard={
          <MealDeliveryAddressCard order={order} customer={customer ?? null} />
        }
        orderDetailsCard={<MealOrderDetailsCard order={order} />}
        paymentSummaryCard={<MealPaymentSummaryCard order={order} />}
        supportCard={<MealTrackingSupportCard onContactSupport={onSupport} />}
        ratingFooter={
          isDelivered ? (
            <MealTrackingRatingFooter
              onRate={() => setShowReviewModal(true)}
              alreadyRated={alreadyRated}
            />
          ) : undefined
        }
      />
      <MealTrackingReviewModal
        open={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        rating={reviewRating}
        onRatingChange={setReviewRating}
        reviewText={reviewText}
        onReviewTextChange={setReviewText}
        onSubmit={() => void submitReview()}
        submitting={reviewSubmitting}
      />
    </>
  );
}

export function MealTrackingHeaderRefreshButton({
  onRefresh,
  refreshing,
}: {
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={refreshing}
      className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-1 text-slate-700 transition active:bg-white/70 disabled:opacity-50"
      aria-label="Refresh tracking"
    >
      <RefreshCcw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} strokeWidth={2} />
      <span className="text-[10px] font-medium text-slate-500">Refresh</span>
    </button>
  );
}
