'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Star, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';

export type ShopReviewItem = {
  orderItemId: string;
  productId: string;
  productName: string;
  productEmoji?: string;
};

type ShopProductReviewModalProps = {
  isOpen: boolean;
  orderId: string;
  items: ShopReviewItem[];
  onClose: () => void;
  onSubmitted?: (productId: string) => void;
};

export function ShopProductReviewModal({
  isOpen,
  orderId,
  items,
  onClose,
  onSubmitted,
}: ShopProductReviewModalProps) {
  const [itemIndex, setItemIndex] = useState(0);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const reviewQueue = useMemo(() => items.filter((item) => item.productId), [items]);
  const currentItem = reviewQueue[itemIndex] ?? null;
  const hasMultiple = reviewQueue.length > 1;

  useEffect(() => {
    if (!isOpen) return;
    setItemIndex(0);
    setRating(0);
    setTitle('');
    setComment('');
    setSubmitting(false);
    setDone(false);
  }, [isOpen, orderId, reviewQueue.length]);

  const resetForm = () => {
    setRating(0);
    setTitle('');
    setComment('');
  };

  const handleSubmit = async () => {
    if (!currentItem) return;
    if (rating < 1) {
      toast.error('Please select a star rating');
      return;
    }

    const customerId = getResolvedCustomerId();
    if (!customerId) {
      toast.error('Please sign in to leave a review');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post(`/products/${currentItem.productId}/reviews`, {
        customerId,
        orderId,
        orderItemId: currentItem.orderItemId,
        rating,
        title: title.trim() || undefined,
        review: comment.trim() || undefined,
      });

      const nextIndex = itemIndex + 1;
      onSubmitted?.(currentItem.productId);
      if (nextIndex < reviewQueue.length) {
        toast.success('Review saved — next product');
        setItemIndex(nextIndex);
        resetForm();
        return;
      }

      setDone(true);
      toast.success('Thank you for your review!');
      setTimeout(() => onClose(), 1500);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to submit review';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || reviewQueue.length === 0) return null;

  if (done) {
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <Check className="h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Thank you!</h2>
          <p className="mt-2 text-sm text-slate-600">Your review helps other pet parents shop with confidence.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div
        className="w-full max-w-md max-h-[min(92dvh,640px)] overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Rate &amp; review</h2>
            {hasMultiple ? (
              <p className="text-xs text-slate-500">
                Product {itemIndex + 1} of {reviewQueue.length}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-2xl">
              {currentItem?.productEmoji || '📦'}
            </div>
            <h3 className="font-semibold text-slate-900">{currentItem?.productName}</h3>
            <p className="mt-1 text-sm text-slate-500">How was this product?</p>
          </div>

          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="rounded-lg p-1 focus:outline-none focus:ring-2 focus:ring-orange-300"
                aria-label={`Rate ${star} stars`}
              >
                <Star
                  className={`h-9 w-9 ${
                    star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                  }`}
                />
              </button>
            ))}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Title <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Summarize your experience"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Review <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder="What did you like or dislike?"
              className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </div>
        </div>

        <div className="border-t border-slate-100 p-4">
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSubmit()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {hasMultiple && itemIndex < reviewQueue.length - 1 ? 'Submit & next' : 'Submit review'}
          </button>
        </div>
      </div>
    </div>
  );
}
