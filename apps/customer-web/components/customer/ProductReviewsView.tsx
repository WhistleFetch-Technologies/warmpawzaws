"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Star, Filter, TrendingUp, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface ProductReviewsViewProps {
  productId: string;
  productName?: string;
  onBack: () => void;
  onSubmitReview?: (review: any) => void;
}

export function ProductReviewsView({ productId, productName, onBack, onSubmitReview }: ProductReviewsViewProps) {
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<any[]>([]);
  const [ratingStats, setRatingStats] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | '5' | '4' | '3' | '2' | '1'>('all');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 0, comment: '', title: '' });

  useEffect(() => {
    loadReviews();
  }, [productId, filter]);

  const loadReviews = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ productId });
      if (filter !== 'all') {
        params.append('rating', filter);
      }

      // Append params to URL query string
      const endpoint = `/products/${productId}/reviews${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await apiClient.get<any>(endpoint);
      
      if (response.reviews) {
        setReviews(response.reviews);
      }
      
      if (response.ratingStats) {
        setRatingStats(response.ratingStats);
      } else if (response.averageRating) {
        // Calculate stats from reviews
        const total = reviews.length;
        const average = response.averageRating;
        const distribution = [5, 4, 3, 2, 1].map(rating => ({
          rating,
          count: reviews.filter(r => Math.round(r.rating) === rating).length,
          percentage: total > 0 ? (reviews.filter(r => Math.round(r.rating) === rating).length / total) * 100 : 0
        }));
        
        setRatingStats({
          averageRating: average,
          totalReviews: total,
          distribution
        });
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (newReview.rating === 0) {
      toast.error('Please provide a rating');
      return;
    }

    try {
      const response = await apiClient.post<any>('/reviews/create', {
        productId,
        rating: newReview.rating,
        comment: newReview.comment,
        title: newReview.title
      });

      if (response.success || response.reviewId) {
        toast.success('Review submitted successfully!');
        setShowReviewForm(false);
        setNewReview({ rating: 0, comment: '', title: '' });
        loadReviews();
        onSubmitReview?.(response);
      }
    } catch (error: any) {
      console.error('Error submitting review:', error);
      toast.error(error.message || 'Failed to submit review');
    }
  };

  const filteredReviews = filter === 'all' 
    ? reviews 
    : reviews.filter(r => Math.round(r.rating) === parseInt(filter));

  const averageRating = ratingStats?.averageRating || 
    (reviews.length > 0 ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length : 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-24 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-white sticky top-0 z-50 border-b border-gray-200">
        <div className="flex items-center gap-3 px-4 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Product Reviews</h1>
            {productName && (
              <p className="text-sm text-gray-600 truncate">{productName}</p>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Rating Overview */}
        {ratingStats && (
          <Card className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
            <div className="flex items-center justify-between mb-4">
              <div className="text-center flex-1">
                <div className="text-5xl font-bold text-amber-600 mb-1">
                  {averageRating.toFixed(1)}
                </div>
                <div className="flex items-center justify-center gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-5 h-5 ${
                        star <= Math.round(averageRating)
                          ? 'text-amber-500 fill-amber-500'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-sm text-gray-600">
                  {ratingStats.totalReviews || reviews.length} {ratingStats.totalReviews === 1 ? 'review' : 'reviews'}
                </p>
              </div>
              <div className="flex-1 pl-4 border-l border-amber-200">
                {ratingStats.distribution && (
                  <div className="space-y-2">
                    {[5, 4, 3, 2, 1].map((rating) => {
                      const dist = ratingStats.distribution.find((d: any) => d.rating === rating);
                      const percentage = dist?.percentage || 0;
                      return (
                        <div key={rating} className="flex items-center gap-2">
                          <div className="flex items-center gap-1 w-12">
                            <span className="text-sm font-medium">{rating}</span>
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                          </div>
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-amber-500 h-2 rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600 w-8 text-right">
                            {dist?.count || 0}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { value: 'all', label: 'All' },
            { value: '5', label: '5 Stars' },
            { value: '4', label: '4 Stars' },
            { value: '3', label: '3 Stars' },
            { value: '2', label: '2 Stars' },
            { value: '1', label: '1 Star' }
          ].map((f) => (
            <Button
              key={f.value}
              variant={filter === f.value ? 'default' : 'outline'}
              onClick={() => setFilter(f.value as any)}
              size="sm"
              className={`flex-shrink-0 ${
                filter === f.value 
                  ? 'bg-[#FF8C42] text-white hover:bg-[#FF7A29]' 
                  : ''
              }`}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {/* Write Review Button */}
        <Button
          onClick={() => setShowReviewForm(true)}
          className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white"
        >
          Write a Review
        </Button>

        {/* Review Form */}
        {showReviewForm && (
          <Card className="p-4 border-2 border-[#FF8C42]">
            <h3 className="font-semibold text-gray-900 mb-4">Write Your Review</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rating *</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setNewReview({ ...newReview, rating: star })}
                      className="focus:outline-none"
                    >
                      <Star
                        className={`w-8 h-8 ${
                          star <= newReview.rating
                            ? 'text-amber-500 fill-amber-500'
                            : 'text-gray-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title (optional)</label>
                <input
                  type="text"
                  value={newReview.title}
                  onChange={(e) => setNewReview({ ...newReview, title: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42]"
                  placeholder="Summary of your review"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Review *</label>
                <textarea
                  value={newReview.comment}
                  onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                  rows={4}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] resize-none"
                  placeholder="Share your experience..."
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowReviewForm(false);
                    setNewReview({ rating: 0, comment: '', title: '' });
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitReview}
                  className="flex-1 bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white"
                >
                  Submit
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Reviews List */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42] mx-auto"></div>
          </div>
        ) : filteredReviews.length === 0 ? (
          <Card className="p-8 text-center">
            <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No reviews found</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredReviews.map((review) => (
              <Card key={review.id || review.reviewId} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#FF8C42] to-[#FF6B9D] rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                    {(review.customerName || review.customer_name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-gray-900">
                        {review.customerName || review.customer_name || 'Anonymous'}
                      </h4>
                      <span className="text-xs text-gray-500">
                        {new Date(review.createdAt || review.date || review.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {review.title && (
                      <h5 className="font-medium text-gray-800 mb-1">{review.title}</h5>
                    )}
                    <div className="flex items-center gap-1 mb-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= (review.rating || 5)
                              ? 'text-amber-500 fill-amber-500'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    {review.comment || review.review_text && (
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">
                        {review.comment || review.review_text}
                      </p>
                    )}
                    {review.verified && (
                      <div className="flex items-center gap-1 mt-2">
                        <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200 text-xs">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Verified Purchase
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

