'use client';

import { useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Loader2, PawPrint } from 'lucide-react';
import { WarmpawzPayVendorCard } from '@/components/warmpawz-pay/vendor-card/WarmpawzPayVendorCard';
import type { WarmpawzPayVendorCardProps } from '@/components/warmpawz-pay/vendor-card/types';
import { STAR_RATING_LABELS, StarRatingInput } from '@/components/customer/shared/StarRatingInput';
import { FeedbackCommentField } from './FeedbackCommentField';

export type VendorFeedbackSheetProps = {
  open: boolean;
  /** e.g. "Leave a review for your previous teleconsultation" */
  subtitle: string;
  vendorCard: WarmpawzPayVendorCardProps;
  submitting?: boolean;
  errorText?: string | null;
  commentMaxLength?: number;
  onSubmit: (value: { rating: number; comment: string }) => void;
  /** "Continue to Home", backdrop tap, Escape */
  onContinue: () => void;
};

/**
 * Bottom sheet over a blurred home (covers the bottom nav — z above nav/toasts/popups).
 * Presentational only: parent owns fetching, submit, dismiss, and back handling.
 */
export function VendorFeedbackSheet({
  open,
  subtitle,
  vendorCard,
  submitting = false,
  errorText,
  commentMaxLength = 500,
  onSubmit,
  onContinue,
}: VendorFeedbackSheetProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (!open) {
      setRating(0);
      setComment('');
    }
  }, [open]);

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !submitting) onContinue();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[110] bg-black/30 backdrop-blur-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          className="fixed inset-x-0 bottom-0 z-[110] mx-auto flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom duration-300"
        >
          <div className="relative shrink-0 px-5 pt-3">
            <div className="mx-auto h-1.5 w-12 rounded-full bg-gray-200" aria-hidden />
            <PawPrint className="absolute left-4 top-6 h-5 w-5 -rotate-12 text-orange-200" aria-hidden />
            <PawPrint className="absolute right-4 top-5 h-6 w-6 rotate-12 text-orange-200" aria-hidden />
            <DialogPrimitive.Title className="mt-4 text-center text-xl font-bold text-gray-900">
              How was your experience?
            </DialogPrimitive.Title>
            <DialogPrimitive.Description
              className="mt-1 text-center text-sm leading-relaxed text-gray-500"
            >
              {subtitle}
            </DialogPrimitive.Description>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-2 pt-4">
            <WarmpawzPayVendorCard {...vendorCard} />

            <div className="flex flex-col items-center gap-1.5">
              <p className="text-sm font-semibold text-gray-900">Rate your experience</p>
              <StarRatingInput
                value={rating}
                onChange={setRating}
                disabled={submitting}
                label="Rate your experience"
              />
              <p className="h-4 text-xs font-medium text-amber-600">{STAR_RATING_LABELS[rating] ?? ''}</p>
            </div>

            <FeedbackCommentField
              value={comment}
              onChange={setComment}
              maxLength={commentMaxLength}
              disabled={submitting}
            />

            {errorText ? (
              <p className="text-center text-sm text-red-600" role="alert">
                {errorText}
              </p>
            ) : null}
          </div>

          <div className="shrink-0 space-y-2 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            <button
              type="button"
              disabled={rating === 0 || submitting}
              onClick={() => onSubmit({ rating, comment })}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#FF8C42] py-3.5 text-sm font-semibold text-white shadow-md transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Submit Feedback
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={onContinue}
              className="w-full py-2 text-center text-sm font-medium text-gray-500 disabled:opacity-50"
            >
              Continue to Home
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
