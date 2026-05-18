'use client';

import { useState, useRef } from 'react';
import { X, Star, ThumbsUp, ThumbsDown, ImagePlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
// Uses apiClient (API Gateway)
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { awardReviewPoints } from '@/lib/loyalty-helper'; // ✅ NEW
import { uploadCustomerPhotoWithProgress } from '@/lib/photo-upload-enhanced';

const MAX_REVIEW_PHOTOS = 6;

type ReviewPhotoSlot = { previewUrl: string; storageKey: string };

interface RateServiceModalProps {
  bookingId: string;
  vendorId: string;
  vendorName: string;
  customerId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function RateServiceModal({ 
  bookingId, 
  vendorId, 
  vendorName, 
  customerId, 
  onClose, 
  onSuccess 
}: RateServiceModalProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  
  // Detailed ratings
  const [serviceQuality, setServiceQuality] = useState(0);
  const [punctuality, setPunctuality] = useState(0);
  const [cleanliness, setCleanliness] = useState(0);
  const [valueForMoney, setValueForMoney] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [reviewPhotos, setReviewPhotos] = useState<ReviewPhotoSlot[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  const removeReviewPhoto = (index: number) => {
    setReviewPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleReviewPhotoFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;

    const room = MAX_REVIEW_PHOTOS - reviewPhotos.length;
    if (room <= 0) {
      toast.error(`You can add up to ${MAX_REVIEW_PHOTOS} photos`);
      return;
    }

    setUploadingPhotos(true);
    try {
      for (const file of files.slice(0, room)) {
        const res = await uploadCustomerPhotoWithProgress(file, customerId, {
          verifyUpload: false,
        });
        const previewUrl = (res.url || res.publicUrl || '').trim();
        const storageKey = res.fileName?.trim();
        if (!res.success || !previewUrl || !storageKey) {
          toast.error(res.error || 'Photo upload failed');
          continue;
        }
        setReviewPhotos((prev) => {
          if (prev.length >= MAX_REVIEW_PHOTOS) return prev;
          if (prev.some((p) => p.storageKey === storageKey)) return prev;
          return [...prev, { previewUrl, storageKey }];
        });
      }
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please provide a rating');
      return;
    }

    try {
      setSubmitting(true);
      
      const payload = {
        bookingId,
        customerId,
        vendorId,
        rating,
        review,
        serviceQuality: serviceQuality || rating,
        punctuality: punctuality || rating,
        cleanliness: cleanliness || rating,
        valueForMoney: valueForMoney || rating,
        wouldRecommend: wouldRecommend === true,
        photos: reviewPhotos.map((p) => p.storageKey),
      };

      // AWS Serverless compatible - use apiClient
      const result = await apiClient.post<{ reviewId?: string; id?: string }>('/reviews/create', payload);
      toast.success('Review submitted successfully!');
      
      // ✅ NEW: Award loyalty points for posting review
      await awardReviewPoints(
        customerId,
        result.reviewId || result.id || bookingId
      );
      
      onSuccess();
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error('Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const StarRating = ({ 
    value, 
    onChange, 
    size = 'md', 
    label 
  }: { 
    value: number, 
    onChange: (val: number) => void, 
    size?: 'sm' | 'md' | 'lg',
    label?: string
  }) => {
    const [hover, setHover] = useState(0);
    
    return (
      <div className="flex flex-col gap-1">
        {label && <span className="text-sm text-gray-600">{label}</span>}
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              className="focus:outline-none transition-transform hover:scale-110"
            >
              <Star 
                className={`${
                  size === 'lg' ? 'w-8 h-8' : size === 'sm' ? 'w-4 h-4' : 'w-6 h-6'
                } ${
                  star <= (hover || value) 
                    ? 'fill-[#FF8C42] text-[#FF8C42]' 
                    : 'text-gray-300'
                }`} 
              />
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center">
      <div 
        className="bg-white w-full max-w-customer rounded-t-[32px] sm:rounded-[32px] max-h-[90vh] overflow-y-auto"
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-[32px] z-10">
          <h2 className="font-bold text-gray-800">Rate Service</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">How was your service?</h3>
            <p className="text-sm text-gray-500">with {vendorName}</p>
            
            <div className="flex justify-center mt-4 mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => {
                    setRating(star);
                    // Pre-fill detailed ratings if not set
                    if (!serviceQuality) setServiceQuality(star);
                    if (!punctuality) setPunctuality(star);
                    if (!cleanliness) setCleanliness(star);
                    if (!valueForMoney) setValueForMoney(star);
                  }}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 focus:outline-none transition-transform hover:scale-110"
                >
                  <Star 
                    className={`w-10 h-10 ${
                      star <= (hoverRating || rating) 
                        ? 'fill-[#FF8C42] text-[#FF8C42]' 
                        : 'text-gray-300'
                    }`} 
                  />
                </button>
              ))}
            </div>
            <p className="text-sm font-medium text-[#FF8C42]">
              {rating === 1 ? 'Terrible' : 
               rating === 2 ? 'Bad' : 
               rating === 3 ? 'Okay' : 
               rating === 4 ? 'Good' : 
               rating === 5 ? 'Excellent' : 'Tap to rate'}
            </p>
          </div>

          {/* Detailed Ratings (Only show if main rating is selected) */}
          {rating > 0 && (
            <div className="space-y-4 bg-gray-50 p-4 rounded-2xl animate-in fade-in slide-in-from-bottom-4">
              <h4 className="font-semibold text-gray-900 text-sm">Detailed Feedback</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <StarRating 
                  label="Service Quality" 
                  value={serviceQuality} 
                  onChange={setServiceQuality}
                  size="sm"
                />
                <StarRating 
                  label="Punctuality" 
                  value={punctuality} 
                  onChange={setPunctuality}
                  size="sm"
                />
                <StarRating 
                  label="Cleanliness" 
                  value={cleanliness} 
                  onChange={setCleanliness}
                  size="sm"
                />
                <StarRating 
                  label="Value for Money" 
                  value={valueForMoney} 
                  onChange={setValueForMoney}
                  size="sm"
                />
              </div>
            </div>
          )}

          {/* Review Text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Share your experience (optional)
            </label>
            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Tell us what you liked or didn't like..."
              rows={4}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-[#FF8C42] focus:border-[#FF8C42] resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Add photos (optional)
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Up to {MAX_REVIEW_PHOTOS} images — e.g. your pet after the visit.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
              multiple
              className="hidden"
              onChange={handleReviewPhotoFiles}
            />
            <div className="flex flex-wrap gap-2">
              {reviewPhotos.map((entry, idx) => (
                <div
                  key={entry.storageKey}
                  className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
                >
                  <img src={entry.previewUrl} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeReviewPhoto(idx)}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white hover:bg-black/80"
                    aria-label="Remove photo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {reviewPhotos.length < MAX_REVIEW_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhotos}
                  className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-gray-500 transition-colors hover:border-[#FF8C42] hover:text-[#FF8C42] disabled:opacity-50"
                >
                  {uploadingPhotos ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <ImagePlus className="h-6 w-6" />
                      <span className="text-[10px] font-medium">Add</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Recommendation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Would you recommend this vendor?
            </label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setWouldRecommend(true)}
                className={`flex-1 py-3 rounded-xl border-2 flex items-center justify-center gap-2 transition-colors ${
                  wouldRecommend === true
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-green-200'
                }`}
              >
                <ThumbsUp className="w-5 h-5" />
                Yes
              </button>
              <button
                type="button"
                onClick={() => setWouldRecommend(false)}
                className={`flex-1 py-3 rounded-xl border-2 flex items-center justify-center gap-2 transition-colors ${
                  wouldRecommend === false
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 hover:border-red-200'
                }`}
              >
                <ThumbsDown className="w-5 h-5" />
                No
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={submitting || rating === 0 || uploadingPhotos}
            className="w-full bg-[#FF8C42] hover:bg-[#FF7A2F] text-white py-6 rounded-xl text-lg font-semibold"
          >
            {submitting ? 'Submitting...' : 'Submit Review'}
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}