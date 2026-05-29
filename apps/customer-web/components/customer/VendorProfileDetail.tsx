"use client";

import React, { useState, useEffect } from 'react';
import { Star, MapPin, Phone, Mail, Clock, Award, CheckCircle2, Package, TrendingUp, Sparkles } from 'lucide-react';
import { AmenitiesSection } from './shared/AmenitiesSection';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { formatAverageForDisplay } from '@/lib/rating-display';
import { toast } from 'sonner';
import { VendorRatingDisplay } from './shared/VendorRatingDisplay';

interface VendorProfileDetailProps {
  vendorId: string;
  phone?: string;
  onBack: () => void;
  onBook?: (vendorId: string) => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function VendorProfileDetail({ vendorId, phone, onBack, onBook, onNavigate }: VendorProfileDetailProps) {
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [rating, setRating] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'amenities' | 'products' | 'reviews'>('overview');

  const loadVendorData = async () => {
    try {
      setLoading(true);
      
      const [vendorRes, productsRes, reviewsRes] = await Promise.all([
        apiClient.get<any>(`/vendor/${vendorId}`),
        apiClient.get<any>(`/vendor/${vendorId}/products`),
        apiClient.get<any>(`/vendor/${vendorId}/reviews`)
      ]);

      if (vendorRes.vendor || vendorRes.success) {
        const v = vendorRes.vendor || vendorRes;
        setVendor(v);
        const tr =
          Number(
            v.reviewCount ??
              v.totalReviews ??
              vendorRes.reviewCount ??
              vendorRes.totalReviews ??
              0
          ) || 0;
        const arRaw =
          (typeof vendorRes.rating === 'object' && vendorRes.rating != null
            ? (vendorRes.rating as { averageRating?: number }).averageRating
            : undefined) ??
          v.averageRating ??
          v.rating ??
          vendorRes.averageRating ??
          (typeof vendorRes.rating === 'number' ? vendorRes.rating : undefined);
        const ar =
          arRaw != null && arRaw !== '' ? Number(arRaw) : NaN;
        setRating({
          averageRating: tr > 0 && Number.isFinite(ar) && ar > 0 ? ar : 0,
          totalReviews: tr,
        });
      }

      if (productsRes.products) {
        setProducts(productsRes.products.slice(0, 10));
      }

      if (reviewsRes.reviews || reviewsRes.recentReviews) {
        setReviews(reviewsRes.reviews || reviewsRes.recentReviews || []);
      }
    } catch (error) {
      console.error('Error loading vendor data:', error);
      toast.error('Failed to load vendor information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVendorData();
  }, [vendorId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Card className="p-8 text-center">
          <p className="text-gray-600 mb-4">Vendor information not available</p>
          <Button onClick={onBack} variant="outline">Go Back</Button>
        </Card>
      </div>
    );
  }

  const vendorName = vendor.businessName || vendor.vendorName || vendor.name || 'Vendor';
  const vendorImage = vendor.vendorProfileImage || vendor.image;
  const totalReviews =
    Number(
      rating?.totalReviews ??
        vendor.reviewCount ??
        vendor.totalReviews ??
        0
    ) || 0;
  const rawAvg =
    rating?.averageRating ?? vendor.rating ?? vendor.avgRating;
  const parsedAvg =
    rawAvg != null && rawAvg !== '' ? Number(rawAvg) : NaN;
  const averageRating =
    totalReviews > 0 && Number.isFinite(parsedAvg) && parsedAvg > 0
      ? parsedAvg
      : 0;
  
  return (
    <div>
      {/* Header is provided by renderScreenWithLayout wrapper (StandardizedHeader) */}
      
      {/* Vendor Info Header */}
      <div className="px-4 pb-4 bg-white">
          <div className="flex gap-4">
            <div className="w-20 h-20 bg-gradient-to-br from-[#FF8C42] to-[#FF6B9D] rounded-xl flex items-center justify-center text-3xl flex-shrink-0 overflow-hidden">
              {vendorImage ? (
                <img src={vendorImage} alt={vendorName} className="w-full h-full object-cover" />
              ) : (
                <span>{vendorName.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-gray-900 mb-1">{vendorName}</h2>
              <VendorRatingDisplay
                row={{
                  vendorId,
                  vendorRating: averageRating,
                  vendorReviewCount: totalReviews,
                  averageRating,
                  reviewCount: totalReviews,
                }}
                vendorId={vendorId}
                className="mb-2"
              />
              {vendor.address && (
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <MapPin className="w-4 h-4" />
                  <span className="truncate">{vendor.address}</span>
                </div>
              )}
              {vendor.isVerified && (
                <div className="flex items-center gap-1 mt-2">
                  <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-[#FF8C42] text-[#FF8C42]'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('amenities')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'amenities'
                ? 'border-[#FF8C42] text-[#FF8C42]'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Amenities
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'products'
                ? 'border-[#FF8C42] text-[#FF8C42]'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Products ({products.length})
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'reviews'
                ? 'border-[#FF8C42] text-[#FF8C42]'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Reviews ({totalReviews})
          </button>
        </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {activeTab === 'overview' && (
          <>
            {vendor.description && (
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-2">About</h3>
                <p className="text-sm text-gray-600">{vendor.description}</p>
              </Card>
            )}

            {/* Contact Info */}
            <Card className="p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Contact Information</h3>
              <div className="space-y-3">
                {vendor.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-700">{vendor.email}</span>
                  </div>
                )}
                {vendor.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                    <span className="text-sm text-gray-700">{vendor.address}</span>
                  </div>
                )}
              </div>
            </Card>

            {/* Business Hours */}
            {vendor.businessHours && (
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Business Hours</h3>
                <div className="space-y-2 text-sm">
                  {Object.entries(vendor.businessHours).map(([day, hours]: [string, any]) => (
                    <div key={day} className="flex justify-between">
                      <span className="text-gray-600 capitalize">{day}</span>
                      <span className="text-gray-900">{hours || 'Closed'}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}

        {activeTab === 'amenities' && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-[#FF8C42]" />
              <h3 className="font-semibold text-gray-900">Facilities & Amenities</h3>
            </div>
            <AmenitiesSection
              amenities={vendor?.amenities || []}
              customAmenities={vendor?.customAmenities || []}
              showCategories={true}
            />
          </Card>
        )}

        {activeTab === 'products' && (
          <div className="space-y-3">
            {products.length === 0 ? (
              <Card className="p-8 text-center">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No products available</p>
              </Card>
            ) : (
              products.map((product) => (
                <Card 
                  key={product.id} 
                  className="p-4 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => onNavigate?.('product_detail', { product })}
                >
                  <div className="flex gap-4">
                    {product.image && (
                      <img 
                        src={product.image} 
                        alt={product.name}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                    )}
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">{product.name}</h4>
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">{product.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#FF8C42]">₹{product.price?.toFixed(2) || '0.00'}</span>
                        {product.rating && (
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                            <span className="text-sm text-gray-600">{Number(product.rating || 0).toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="space-y-3">
            {reviews.length === 0 ? (
              <Card className="p-8 text-center">
                <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No reviews yet</p>
              </Card>
            ) : (
              reviews.map((review) => (
                <Card key={review.id || review.reviewId} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#FF8C42] to-[#FF6B9D] rounded-full flex items-center justify-center text-white font-semibold">
                      {(review.customerName || review.customer_name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-semibold text-gray-900">{review.customerName || review.customer_name || 'Anonymous'}</h4>
                        <span className="text-xs text-gray-500">
                          {new Date(review.createdAt || review.date || review.created_at).toLocaleDateString()}
                        </span>
                      </div>
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
                        <p className="text-sm text-gray-600">{review.comment || review.review_text}</p>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      {/* Fixed Bottom CTA */}
      {onBook && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 max-w-md mx-auto shadow-lg">
          <Button
            onClick={() => onBook(vendorId)}
            className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white h-12 shadow-lg"
          >
            View Products
          </Button>
        </div>
      )}
    </div>
  );
}

