'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Star, Search, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { VendorHeader } from '@/components/vendor/VendorHeader';
import {
  type VendorReviewItem,
  normalizeVendorReview,
  formatReviewDate,
  vendorReviewsApiPath,
} from '@/lib/vendor-review-utils';
import { navigateToVendorBookingFromReview } from '@/lib/vendor-review-booking-nav';
import { ReviewPhotoGallery } from '@/components/vendor/reviews/ReviewPhotoGallery';

export default function ReviewsPage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<VendorReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRating, setFilterRating] = useState<string>('all');
  const [filterApproved, setFilterApproved] = useState<string>('all');
  const [openingBookingId, setOpeningBookingId] = useState<string | null>(null);

  useEffect(() => {
    const storedVendorId = localStorage.getItem('vendorId');
    if (!storedVendorId) {
      router.push('/onboarding');
      return;
    }
    setVendorId(storedVendorId);
  }, [router]);

  const loadReviews = useCallback(async () => {
    if (!vendorId) return;
    try {
      setLoading(true);
      const response = (await apiClient.get<{ reviews?: Record<string, unknown>[] }>(
        vendorReviewsApiPath(vendorId)
      )) as { reviews?: Record<string, unknown>[] };
      setReviews((response.reviews ?? []).map((row) => normalizeVendorReview(row)));
    } catch (err: unknown) {
      console.error('Error loading reviews:', err);
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Failed to load reviews';
      toast.error(message);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    if (vendorId) {
      loadReviews();
    }
  }, [vendorId, loadReviews]);

  const filteredReviews = reviews.filter((review) => {
    if (filterRating !== 'all' && review.rating !== parseInt(filterRating, 10)) {
      return false;
    }
    if (filterApproved !== 'all') {
      const isApproved = filterApproved === 'approved';
      if (review.is_approved !== isApproved) {
        return false;
      }
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        review.comment?.toLowerCase().includes(query) ||
        review.customer_name?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const averageRating =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  const ratingDistribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: reviews.filter((r) => r.rating === rating).length,
  }));

  const renderStars = (rating: number) =>
    Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
        }`}
      />
    ));

  const handleViewBooking = async (bookingId?: string) => {
    if (!bookingId) {
      toast.error('No booking linked to this review');
      return;
    }
    setOpeningBookingId(bookingId);
    try {
      await navigateToVendorBookingFromReview(router, bookingId);
    } finally {
      setOpeningBookingId(null);
    }
  };

  if (!vendorId || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="vendor-page-shell bg-gray-50">
      <div className="vendor-app-column bg-white min-h-screen">
        <VendorHeader
          title="Reviews"
          subtitle="View and manage customer reviews"
          onBack={() => router.back()}
        />

        <div className="w-full px-4 py-6 sm:px-6">
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">Average Rating</span>
                <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{averageRating.toFixed(1)}</p>
              <p className="text-sm text-gray-500 mt-1">{reviews.length} total reviews</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">Approved Reviews</span>
                <Badge className="bg-green-100 text-green-700">
                  {reviews.filter((r) => r.is_approved).length}
                </Badge>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {reviews.filter((r) => r.is_approved).length}
              </p>
              <p className="text-sm text-gray-500 mt-1">Published</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">Pending Approval</span>
                <Badge className="bg-yellow-100 text-yellow-700">
                  {reviews.filter((r) => !r.is_approved).length}
                </Badge>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {reviews.filter((r) => !r.is_approved).length}
              </p>
              <p className="text-sm text-gray-500 mt-1">Awaiting review</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Search by comment or customer name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="w-full md:w-48">
                <select
                  value={filterRating}
                  onChange={(e) => setFilterRating(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="all">All Ratings</option>
                  <option value="5">5 Stars</option>
                  <option value="4">4 Stars</option>
                  <option value="3">3 Stars</option>
                  <option value="2">2 Stars</option>
                  <option value="1">1 Star</option>
                </select>
              </div>
              <div className="w-full md:w-48">
                <select
                  value={filterApproved}
                  onChange={(e) => setFilterApproved(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="all">All Status</option>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rating Distribution</h3>
            <div className="space-y-2">
              {ratingDistribution.map(({ rating, count }) => (
                <div key={rating} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-20">
                    <span className="text-sm font-medium text-gray-700">{rating}</span>
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  </div>
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-yellow-400 h-2 rounded-full"
                      style={{
                        width: `${reviews.length > 0 ? (count / reviews.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 w-12 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {filteredReviews.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
              <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No reviews found</h3>
              <p className="text-gray-500">
                {searchQuery || filterRating !== 'all' || filterApproved !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Reviews will appear here when customers leave feedback'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReviews.map((review) => (
                <div
                  key={review.id}
                  className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                        <span className="text-orange-600 font-semibold">
                          {review.customer_name?.charAt(0) || 'C'}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {review.customer_name || 'Anonymous Customer'}
                        </h3>
                        <p className="text-sm text-gray-500">{formatReviewDate(review.created_at)}</p>
                        {review.service_name ? (
                          <p className="text-xs text-gray-500 mt-0.5">{review.service_name}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">{renderStars(review.rating)}</div>
                      {review.is_approved ? (
                        <Badge className="bg-green-100 text-green-700">Approved</Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>
                      )}
                    </div>
                  </div>

                  {review.comment ? (
                    <p className="text-gray-700 mb-4 whitespace-pre-wrap">{review.comment}</p>
                  ) : null}

                  <ReviewPhotoGallery photos={review.photos} variant="grid" className="mb-4" />

                  {review.booking_id ? (
                    <div className="pt-4 border-t border-gray-200">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={openingBookingId === review.booking_id}
                        onClick={() => handleViewBooking(review.booking_id)}
                      >
                        {openingBookingId === review.booking_id ? 'Opening…' : 'View Booking'}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
