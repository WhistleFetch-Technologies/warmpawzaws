'use client';

/**
 * ============================================================================
 * RATING REQUEST POPUP
 * ============================================================================
 * 
 * Popup that appears after service completion asking for rating/review
 * 
 * Fixes GAP: CC-4 - Rating/Review Popup After Completion
 * 
 * Date: 2026-01-21
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { X, Star, Check, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface RatingRequestPopupProps {
  bookingId: string;
  vendorId?: string;
  vendorName: string;
  serviceName: string;
  serviceDate: string;
  petName?: string;
  customerId?: string;
  onClose: () => void;
  onSubmit?: () => void;
}

export function RatingRequestPopup({
  bookingId,
  vendorId,
  vendorName,
  serviceName,
  serviceDate,
  petName,
  customerId,
  onClose,
  onSubmit,
}: RatingRequestPopupProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showReviewInput, setShowReviewInput] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }
    if (!vendorId) {
      toast.error('Missing vendor information for review');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/reviews/create', {
        bookingId,
        vendorId,
        customerId,
        rating,
        review: review.trim() || null,
      });

      setSubmitted(true);
      toast.success('Thank you for your feedback! 🎉');
      
      // Close after showing success message
      setTimeout(() => {
        onSubmit?.();
        onClose();
      }, 2000);

    } catch (error: any) {
      console.error('Error submitting review:', error);
      toast.error(error.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const getRatingText = (r: number) => {
    switch (r) {
      case 1: return 'Poor';
      case 2: return 'Fair';
      case 3: return 'Good';
      case 4: return 'Very Good';
      case 5: return 'Excellent!';
      default: return 'Tap to rate';
    }
  };

  const getRatingEmoji = (r: number) => {
    switch (r) {
      case 1: return '😞';
      case 2: return '😐';
      case 3: return '🙂';
      case 4: return '😊';
      case 5: return '🤩';
      default: return '⭐';
    }
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in">
        <div className="bg-white rounded-2xl w-full max-w-sm p-8 text-center animate-in zoom-in-95">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-10 h-10 text-green-600" />
          </div>
          <h3 className="text-xl font-bold mb-2">Thank You!</h3>
          <p className="text-gray-600">
            Your feedback helps us improve and helps other pet parents find great services.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-sm p-6 animate-in slide-in-from-bottom sm:zoom-in-95">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">{getRatingEmoji(rating || hoverRating)}</div>
          <h3 className="text-xl font-bold mb-1">How was your experience?</h3>
          <p className="text-gray-600 text-sm">
            {serviceName} with <span className="font-medium">{vendorName}</span>
            {petName && <span> for {petName}</span>}
          </p>
          <p className="text-gray-400 text-xs mt-1">{serviceDate}</p>
        </div>

        {/* Star Rating */}
        <div className="flex justify-center gap-2 mb-3">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star
                className={`w-10 h-10 transition-colors ${
                  star <= (hoverRating || rating)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-300'
                }`}
              />
            </button>
          ))}
        </div>

        {/* Rating Text */}
        <p className="text-center text-sm font-medium mb-4">
          {getRatingText(hoverRating || rating)}
        </p>

        {/* Review Toggle */}
        {rating > 0 && !showReviewInput && (
          <button
            onClick={() => setShowReviewInput(true)}
            className="w-full flex items-center justify-center gap-2 py-2 text-[#FF8C42] hover:bg-orange-50 rounded-lg mb-4"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="text-sm font-medium">Add a written review</span>
          </button>
        )}

        {/* Review Input */}
        {showReviewInput && (
          <div className="mb-4">
            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Tell us about your experience..."
              className="w-full p-3 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-gray-400 text-right mt-1">
              {review.length}/500 characters
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Skip
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={rating === 0 || submitting}
            className="flex-1 bg-[#FF8C42] hover:bg-[#FF7C32] text-white"
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to check for pending rating requests
 * Shows popup on customer home screen for completed bookings without reviews
 */
export function usePendingRatingRequests(customerPhone: string) {
  const [pendingReview, setPendingReview] = useState<{
    bookingId: string;
    vendorId?: string;
    vendorName: string;
    serviceName: string;
    serviceDate: string;
    petName?: string;
  } | null>(null);

  useEffect(() => {
    const checkPendingReviews = async () => {
      if (!customerPhone) return;

      try {
        const result = await apiClient.get<any>(
          `/reviews/pending/${encodeURIComponent(customerPhone)}`
        );

        if (result.success && result.hasPending && result.booking) {
          const booking = result.booking; // Show first pending
          setPendingReview({
            bookingId: booking.id || booking.bookingId,
            vendorId: booking.vendorId || booking.vendor_id,
            vendorName: booking.vendorName || booking.vendor_name,
            serviceName: booking.serviceName || booking.service_name,
            serviceDate: booking.bookingDate || booking.booking_date || booking.completedAt,
            petName: booking.petName || booking.pet_name,
          });
        }
      } catch (error) {
        console.log('No pending reviews or error fetching');
      }
    };

    // Check after a delay to not block initial load
    const timer = setTimeout(checkPendingReviews, 2000);
    return () => clearTimeout(timer);
  }, [customerPhone]);

  return {
    pendingReview,
    clearPendingReview: () => setPendingReview(null),
  };
}
