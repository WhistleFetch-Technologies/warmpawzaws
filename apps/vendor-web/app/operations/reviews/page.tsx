'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Star, Search, Filter, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { VendorHeader } from '@/components/vendor/VendorHeader';

interface Review {
  id: string;
  customer_id: string;
  vendor_id: string;
  service_id?: string;
  booking_id?: string;
  rating: number;
  comment?: string;
  images?: string[];
  is_approved: boolean;
  created_at: string;
  customer_name?: string;
  vendor_name?: string;
}

export default function ReviewsPage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRating, setFilterRating] = useState<string>('all');
  const [filterApproved, setFilterApproved] = useState<string>('all');

  useEffect(() => {
    const storedVendorId = localStorage.getItem('vendorId');
    if (!storedVendorId) {
      router.push('/onboarding');
      return;
    }
    setVendorId(storedVendorId);
    loadReviews();
  }, [router]);

  const loadReviews = async () => {
    if (!vendorId) return;
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/reviews?vendorId=${vendorId}&limit=100`);
      setReviews(response.reviews || []);
    } catch (err: any) {
      console.error('Error loading reviews:', err);
      toast.error(err.message || 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  const filteredReviews = reviews.filter((review) => {
    if (filterRating !== 'all' && review.rating !== parseInt(filterRating)) {
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

  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  const ratingDistribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: reviews.filter((r) => r.rating === rating).length,
  }));

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
        }`}
      />
    ));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
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
        {/* Summary Stats */}
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

        {/* Filters */}
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

        {/* Rating Distribution */}
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

        {/* Reviews List */}
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
                      <p className="text-sm text-gray-500">{formatDate(review.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {renderStars(review.rating)}
                    </div>
                    {review.is_approved ? (
                      <Badge className="bg-green-100 text-green-700">Approved</Badge>
                    ) : (
                      <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>
                    )}
                  </div>
                </div>

                {review.comment && (
                  <p className="text-gray-700 mb-4 whitespace-pre-wrap">{review.comment}</p>
                )}

                {review.images && review.images.length > 0 && (
                  <div className="flex gap-2 mb-4">
                    {review.images.map((image, index) => (
                      <img
                        key={index}
                        src={image}
                        alt={`Review image ${index + 1}`}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                    ))}
                  </div>
                )}

                {review.booking_id && (
                  <div className="pt-4 border-t border-gray-200">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/bookings/${review.booking_id}`)}
                    >
                      View Booking
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
