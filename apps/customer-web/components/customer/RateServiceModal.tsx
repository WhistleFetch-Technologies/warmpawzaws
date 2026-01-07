'use client';

import { useState } from 'react';
import { X, Star } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

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
  
  const [serviceQuality, setServiceQuality] = useState(0);
  const [punctuality, setPunctuality] = useState(0);
  const [cleanliness, setCleanliness] = useState(0);
  const [valueForMoney, setValueForMoney] = useState(0);

  const handleSubmit = async () => {
    if (rating === 0) {
      alert('Please provide a rating');
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
        photos: []
      };

      const response = await apiClient.post<any>('/reviews', payload);

      if (response.success || response.reviewId) {
        alert('Review submitted successfully!');
        onSuccess();
      } else {
        alert(response.error || 'Failed to submit review');
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('Failed to submit review');
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
      <div className="flex flex-col gap-0">
        {label && <span className="text-sm text-gray-600">{label}</span>}
        <div className="flex gap-0">
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
                    ? 'fill-primary text-primary' 
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
        className="bg-white w-full max-w-[430px] rounded-t-[32px] sm:rounded-[32px] max-h-[90vh] overflow-y-auto"
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-0 py-4 flex items-center justify-between rounded-t-[32px] z-10">
          <h2 className="font-bold text-gray-800">Rate Service</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-0 space-y-6">
          {/* Vendor Info */}
          <div className="text-center">
            <h3 className="font-semibold text-lg mb-0">{vendorName}</h3>
            <p className="text-sm text-gray-600">How was your experience?</p>
          </div>

          {/* Overall Rating */}
          <div className="flex flex-col items-center">
            <StarRating
              value={rating}
              onChange={setRating}
              size="lg"
            />
            <p className="text-sm text-gray-600 mt-0">
              {rating === 0 ? 'Tap to rate' :
               rating === 1 ? 'Poor' :
               rating === 2 ? 'Fair' :
               rating === 3 ? 'Good' :
               rating === 4 ? 'Very Good' :
               'Excellent'}
            </p>
          </div>

          {/* Detailed Ratings */}
          <div className="space-y-4">
            <StarRating
              value={serviceQuality}
              onChange={setServiceQuality}
              label="Service Quality"
            />
            <StarRating
              value={punctuality}
              onChange={setPunctuality}
              label="Punctuality"
            />
            <StarRating
              value={cleanliness}
              onChange={setCleanliness}
              label="Cleanliness"
            />
            <StarRating
              value={valueForMoney}
              onChange={setValueForMoney}
              label="Value for Money"
            />
          </div>

          {/* Review Text */}
          <div>
            <label className="block text-sm font-medium mb-0">Write a review (optional)</label>
            <textarea
              value={review}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReview(e.target.value)}
              className="w-full p-0 border border-gray-300 rounded-lg"
              rows={4}
              placeholder="Share your experience..."
            />
          </div>

          {/* Would Recommend */}
          <div>
            <label className="block text-sm font-medium mb-0">Would you recommend this service?</label>
            <div className="flex gap-0">
              <button
                onClick={() => setWouldRecommend(true)}
                className={`flex-1 px-4 py-0 rounded-lg border-2 ${
                  wouldRecommend === true ? 'border-primary bg-orange-50' : 'border-gray-200'
                }`}
              >
                Yes
              </button>
              <button
                onClick={() => setWouldRecommend(false)}
                className={`flex-1 px-4 py-0 rounded-lg border-2 ${
                  wouldRecommend === false ? 'border-red-500 bg-red-50' : 'border-gray-200'
                }`}
              >
                No
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={submitting || rating === 0}
            className="w-full py-4 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  );
}

