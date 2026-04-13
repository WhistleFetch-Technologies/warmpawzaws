'use client';

/**
 * ============================================================================
 * RATING & REVIEW POPUP COMPONENT
 * ============================================================================
 * 
 * Popup modal for customers to rate and review completed bookings
 * - Appears after booking completion
 * - Star rating system
 * - Optional text review
 * - Quick feedback tags
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { 
  Star, X, Send, ThumbsUp, Clock, Heart, 
  Sparkles, Shield, MessageSquare, Loader2, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface RatingReviewPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: ReviewData) => void;
  bookingId: string;
  vendorId: string;
  vendorName: string;
  serviceName: string;
  serviceStyle?: 'at_home' | 'at_center' | 'tele';
  staffId?: string;
  staffName?: string;
  customerPhone: string;
  customerId?: string;
}

interface ReviewData {
  rating: number;
  review: string;
  tags: string[];
}

const WARMPAWZ_REVIEW_SUBMITTED_BOOKING_IDS_KEY = 'warmpawz_review_submitted_booking_ids';

function persistSubmittedReviewBookingId(bookingId: string) {
  if (typeof window === 'undefined' || !bookingId) return;
  const id = String(bookingId);
  try {
    const raw = localStorage.getItem(WARMPAWZ_REVIEW_SUBMITTED_BOOKING_IDS_KEY);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    if (!arr.includes(id)) {
      arr.push(id);
      localStorage.setItem(WARMPAWZ_REVIEW_SUBMITTED_BOOKING_IDS_KEY, JSON.stringify(arr));
    }
  } catch {
    /* ignore */
  }
}

const QUICK_TAGS = {
  at_home: [
    { id: 'punctual', label: 'Punctual', icon: Clock },
    { id: 'professional', label: 'Professional', icon: Shield },
    { id: 'friendly', label: 'Friendly', icon: Heart },
    { id: 'skilled', label: 'Skilled', icon: Sparkles },
    { id: 'clean', label: 'Neat & Clean', icon: Sparkles },
    { id: 'recommended', label: 'Highly Recommended', icon: ThumbsUp },
  ],
  at_center: [
    { id: 'clean_facility', label: 'Clean Facility', icon: Sparkles },
    { id: 'friendly_staff', label: 'Friendly Staff', icon: Heart },
    { id: 'well_equipped', label: 'Well Equipped', icon: Shield },
    { id: 'easy_parking', label: 'Easy Parking', icon: ThumbsUp },
    { id: 'recommended', label: 'Highly Recommended', icon: ThumbsUp },
    { id: 'value_for_money', label: 'Value for Money', icon: Sparkles },
  ],
  tele: [
    { id: 'knowledgeable', label: 'Knowledgeable', icon: Shield },
    { id: 'patient', label: 'Patient & Caring', icon: Heart },
    { id: 'clear_explanation', label: 'Clear Explanation', icon: MessageSquare },
    { id: 'quick_response', label: 'Quick Response', icon: Clock },
    { id: 'helpful', label: 'Very Helpful', icon: ThumbsUp },
    { id: 'recommended', label: 'Highly Recommended', icon: ThumbsUp },
  ],
};

export function RatingReviewPopup({
  isOpen,
  onClose,
  onSubmit,
  bookingId,
  vendorId,
  vendorName,
  serviceName,
  serviceStyle = 'at_center',
  staffId,
  staffName,
  customerPhone,
  customerId,
}: RatingReviewPopupProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const scrollY = window.scrollY;
    const prevOverflow = document.body.style.overflow;
    const prevPosition = document.body.style.position;
    const prevTop = document.body.style.top;
    const prevWidth = document.body.style.width;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.position = prevPosition;
      document.body.style.top = prevTop;
      document.body.style.width = prevWidth;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  const tags = QUICK_TAGS[serviceStyle] || QUICK_TAGS.at_center;

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(t => t !== tagId)
        : [...prev, tagId]
    );
  };

  const getRatingLabel = (r: number) => {
    switch (r) {
      case 1: return 'Poor';
      case 2: return 'Fair';
      case 3: return 'Good';
      case 4: return 'Very Good';
      case 5: return 'Excellent!';
      default: return 'Rate your experience';
    }
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    setSubmitting(true);

    try {
      // Submit review to API
      await apiClient.post('/reviews/create', {
        bookingId,
        vendorId,
        staffId,
        customerId,
        customerPhone,
        rating,
        review: review.trim(),
        tags: selectedTags,
        serviceStyle,
      });

      persistSubmittedReviewBookingId(bookingId);
      setSubmitted(true);
      
      if (onSubmit) {
        onSubmit({ rating, review, tags: selectedTags });
      }

      toast.success('Thank you for your feedback!');

      // Auto close after showing success
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error: any) {
      console.error('Error submitting review:', error);
      toast.error(error.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    // Track skip action
    apiClient.post('/reviews/skip', {
      bookingId,
      vendorId,
      customerId,
      customerPhone,
    }).catch(() => {});
    
    onClose();
  };

  if (!isOpen) return null;

  // Success state
  if (submitted) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4 overscroll-none touch-none">
        <div className="bg-white rounded-3xl max-w-md w-full p-8 text-center animate-in fade-in zoom-in duration-300 touch-auto">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
          <p className="text-gray-600">Your feedback helps us improve our services</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end items-stretch sm:justify-center sm:items-center bg-black/50 overscroll-none touch-none sm:touch-auto sm:p-4">
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[min(90dvh,calc(100dvh-env(safe-area-inset-bottom,0px)))] flex flex-col min-h-0 overflow-hidden animate-in slide-in-from-bottom duration-300 shadow-xl touch-auto sm:mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-white p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Rate Your Experience</h2>
          <button 
            onClick={handleSkip}
            className="p-2 hover:bg-gray-100 rounded-full transition"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="min-h-0 flex-1 basis-0 overflow-y-auto overscroll-y-contain p-6 pb-8 [-webkit-overflow-scrolling:touch] touch-pan-y">
          {/* Service Info */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-[#FF8C42] to-[#FF7029] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900 text-lg">{serviceName}</h3>
            <p className="text-gray-500 text-sm">
              {staffName ? `${staffName} at ` : ''}{vendorName}
            </p>
          </div>

          {/* Star Rating */}
          <div className="text-center mb-6">
            <div className="flex justify-center gap-2 mb-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition-transform hover:scale-110 active:scale-95"
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
            <p className={`text-sm font-medium transition-colors ${
              rating > 0 ? 'text-[#FF8C42]' : 'text-gray-400'
            }`}>
              {getRatingLabel(hoverRating || rating)}
            </p>
          </div>

          {/* Quick Tags */}
          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-3">What did you like? (Optional)</p>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const TagIcon = tag.icon;
                const isSelected = selectedTags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all ${
                      isSelected
                        ? 'bg-[#FF8C42] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <TagIcon className="w-3.5 h-3.5" />
                    {tag.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Written Review */}
          <div className="mb-6">
            <label className="block text-sm text-gray-600 mb-2">
              Share your experience (Optional)
            </label>
            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Tell others about your experience..."
              className="w-full h-24 px-4 py-3 border border-gray-200 rounded-xl resize-none focus:border-[#FF8C42] focus:ring-2 focus:ring-[#FF8C42]/20 outline-none transition"
              maxLength={500}
            />
            <p className="text-right text-xs text-gray-400 mt-1">
              {review.length}/500
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={handleSkip}
              variant="outline"
              className="flex-1"
              disabled={submitting}
            >
              Skip
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={rating === 0 || submitting}
              className="flex-1 bg-[#FF8C42] hover:bg-[#E67A35]"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Submit
            </Button>
          </div>

          {/* Privacy note */}
          <p className="text-center text-xs text-gray-400 mt-4">
            Your review will be displayed publicly to help other pet parents
          </p>
        </div>
      </div>
    </div>
  );
}

export default RatingReviewPopup;
