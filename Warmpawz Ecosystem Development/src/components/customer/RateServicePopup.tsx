import { useState } from 'react';
import { Star, X, ThumbsUp, MessageSquare, Camera, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';
import { toast } from 'sonner';

interface RateServicePopupProps {
  booking: {
    bookingId: string;
    serviceName: string;
    vendorId: string;
    vendorName: string;
    petName: string;
    serviceType: string;
    completedAt?: string;
  };
  customerPhone: string;
  onSubmit: (data: { rating: number; review: string; tags: string[] }) => void;
  onSkip: () => void;
  onClose: () => void;
}

const QUICK_TAGS = [
  { id: 'professional', label: 'Professional', emoji: '👔' },
  { id: 'punctual', label: 'Punctual', emoji: '⏰' },
  { id: 'friendly', label: 'Friendly', emoji: '😊' },
  { id: 'clean', label: 'Clean & Hygienic', emoji: '✨' },
  { id: 'value', label: 'Good Value', emoji: '💰' },
  { id: 'skilled', label: 'Skilled', emoji: '🎯' },
  { id: 'caring', label: 'Pet-Caring', emoji: '❤️' },
  { id: 'recommend', label: 'Would Recommend', emoji: '👍' }
];

const RATING_LABELS = [
  { rating: 1, label: 'Poor', emoji: '😞', color: 'text-red-500' },
  { rating: 2, label: 'Fair', emoji: '😐', color: 'text-orange-500' },
  { rating: 3, label: 'Good', emoji: '🙂', color: 'text-yellow-500' },
  { rating: 4, label: 'Very Good', emoji: '😊', color: 'text-green-500' },
  { rating: 5, label: 'Excellent', emoji: '🤩', color: 'text-green-600' }
];

export function RateServicePopup({ booking, customerPhone, onSubmit, onSkip, onClose }: RateServicePopupProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [review, setReview] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const API_BASE = getApiBaseUrl();

  const handleTagToggle = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(t => t !== tagId)
        : [...prev, tagId]
    );
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    try {
      setSubmitting(true);

      // Submit review to backend
      const response = await fetch(`${API_BASE}/customer/review`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bookingId: booking.bookingId,
          vendorId: booking.vendorId,
          customerPhone,
          rating,
          review: review.trim(),
          tags: selectedTags,
          serviceType: booking.serviceType
        })
      });

      if (response.ok) {
        setSubmitted(true);
        toast.success('Thank you for your feedback!');
        
        // Call parent callback
        setTimeout(() => {
          onSubmit({ rating, review, tags: selectedTags });
        }, 1500);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to submit review');
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error('Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const currentRating = hoveredRating || rating;
  const ratingInfo = RATING_LABELS.find(r => r.rating === currentRating);

  // Success state
  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl w-full max-w-sm p-8 text-center animate-in zoom-in duration-300">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Thank You!</h3>
          <p className="text-gray-600 mb-4">
            Your feedback helps {booking.vendorName} improve their service.
          </p>
          <div className="flex items-center justify-center gap-1 mb-4">
            {[1, 2, 3, 4, 5].map(star => (
              <Star
                key={star}
                className={`w-6 h-6 ${star <= rating ? 'fill-amber-500 text-amber-500' : 'text-gray-300'}`}
              />
            ))}
          </div>
          <p className="text-sm text-green-600 font-medium">
            +10 Warmpawz Coins Earned! 🎉
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center animate-in fade-in duration-200">
      <div className="bg-white rounded-t-[32px] sm:rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-br from-[#FF8C42] to-[#FF7029] px-6 py-5 rounded-t-[32px] sm:rounded-t-2xl text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="text-center">
            <h2 className="text-xl font-bold mb-1">How was your experience?</h2>
            <p className="text-white/90 text-sm">
              Rate your {booking.serviceName} with {booking.vendorName}
            </p>
            <Badge className="mt-2 bg-white/20 text-white border-white/30">
              Pet: {booking.petName}
            </Badge>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Star Rating */}
          <div className="text-center">
            <div className="flex justify-center gap-2 mb-3">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-transform hover:scale-110 active:scale-95"
                >
                  <Star
                    className={`w-10 h-10 transition-colors ${
                      star <= currentRating
                        ? 'fill-amber-500 text-amber-500'
                        : 'text-gray-300 hover:text-amber-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            
            {ratingInfo && (
              <div className={`text-lg font-semibold ${ratingInfo.color}`}>
                {ratingInfo.emoji} {ratingInfo.label}
              </div>
            )}
            
            {!currentRating && (
              <p className="text-sm text-gray-500">Tap a star to rate</p>
            )}
          </div>

          {/* Quick Tags - Only show after rating */}
          {rating > 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <p className="text-sm font-medium text-gray-700 mb-3">What did you like?</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_TAGS.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => handleTagToggle(tag.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      selectedTags.includes(tag.id)
                        ? 'bg-[#FF8C42] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {tag.emoji} {tag.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Review Text - Only show after rating */}
          {rating > 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 delay-100">
              <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Write a review (optional)
              </label>
              <textarea
                value={review}
                onChange={(e) => setReview(e.target.value)}
                placeholder={`Share your experience with ${booking.vendorName}...`}
                className="w-full p-4 border-2 border-gray-200 rounded-xl resize-none focus:border-[#FF8C42] focus:outline-none transition-colors"
                rows={3}
                maxLength={500}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Help others make a decision</span>
                <span>{review.length}/500</span>
              </div>
            </div>
          )}

          {/* Reward Info */}
          <div className="bg-amber-50 rounded-xl p-4 flex items-center gap-3 border border-amber-200">
            <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-lg">🪙</span>
            </div>
            <div>
              <p className="font-medium text-amber-900">Earn 10 Warmpawz Coins</p>
              <p className="text-xs text-amber-700">Complete your review to earn rewards!</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 space-y-2">
          <Button
            onClick={handleSubmit}
            disabled={rating === 0 || submitting}
            className="w-full h-12 bg-[#FF8C42] hover:bg-[#FF7029] text-white font-semibold disabled:opacity-50"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <ThumbsUp className="w-5 h-5" />
                Submit Review
              </span>
            )}
          </Button>
          
          <button
            onClick={onSkip}
            className="w-full py-3 text-gray-500 text-sm font-medium hover:text-gray-700 transition-colors"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
