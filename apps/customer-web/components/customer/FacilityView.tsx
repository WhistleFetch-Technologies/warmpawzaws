'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  MapPin,
  Clock,
  Star,
  Phone,
  Mail,
  Calendar,
  Check,
  ChevronRight,
  Image as ImageIcon
} from 'lucide-react';
import { getAmenityById } from '@/lib/master-amenities';
import { getVendorPersonalization } from '@/lib/vendor-personalization';
import { formatOperatingHours } from '@/lib/format-utils';

interface FacilityViewProps {
  vendorId: string;
  onBack?: () => void;
  onClose?: () => void;
  onBookNow?: () => void;
}

export function FacilityView({ vendorId, onBack, onClose, onBookNow }: FacilityViewProps) {
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<any>(null);
  const [facility, setFacility] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [rating, setRating] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  
  // Use whichever callback is provided
  const handleClose = onClose || onBack;

  useEffect(() => {
    const loadFacilityData = async () => {
      try {
        setLoading(true);
        
        // Fetch facility data
        const data = await apiClient.get<{ success?: boolean, vendor?: any, facility?: any, services?: any[], rating?: any, recentReviews?: any[] }>(`/vendor/${vendorId}/facility`);
        if (data.success) {
          setVendor(data.vendor);
          setFacility(data.facility);
          setServices(data.services || []);
          setRating(data.rating);
          setReviews(data.recentReviews || []);
        }
      } catch (error) {
        console.error('Error loading facility data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFacilityData();
  }, [vendorId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ImageIcon className="w-8 h-8 text-[#FF8C42] animate-pulse mx-auto mb-2" />
          <p className="text-gray-600">Loading facility details...</p>
        </div>
      </div>
    );
  }

  if (!vendor || !facility) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Facility information not available</p>
          <Button onClick={onBack} className="mt-4" variant="outline">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const personalization = getVendorPersonalization(vendor.roleId, services);
  const allAmenities = [
    ...facility.amenities.map((id: string) => getAmenityById(id)).filter(Boolean),
    ...facility.customAmenities.map((name: string) => ({ name, custom: true }))
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-customer mx-auto bg-white min-h-screen">
        {/* Photo Gallery */}
        {facility.photos && facility.photos.length > 0 ? (
          <div className="relative">
            <img
              src={facility.photos[selectedPhotoIndex]}
              alt="Facility"
              className="w-full h-64 object-cover"
            />
            <button
              onClick={handleClose}
              className="absolute top-4 left-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            
            {/* Photo indicators */}
            {facility.photos.length > 1 && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                {facility.photos.map((_: any, index: number) => (
                  <button
                    key={index}
                    onClick={() => setSelectedPhotoIndex(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === selectedPhotoIndex
                        ? 'bg-white w-6'
                        : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="relative h-64 bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center">
            <button
              onClick={handleClose}
              className="absolute top-4 left-4 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <ImageIcon className="w-16 h-16 text-gray-300" />
          </div>
        )}

        {/* Facility Info */}
        <div className="p-4">
          {/* Title & Rating */}
          <div className="mb-3">
            <h1 className="text-xl font-bold text-gray-900 mb-1">
              {vendor.businessName || vendor.fullName}
            </h1>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <span className="font-semibold text-gray-900">
                  {rating.average > 0 ? rating.average.toFixed(1) : 'New'}
                </span>
              </div>
              {rating.total > 0 && (
                <span className="text-sm text-gray-500">({rating.total} reviews)</span>
              )}
              <Badge variant="outline" className="ml-auto text-xs">
                {vendor.roleId}
              </Badge>
            </div>
          </div>

          {/* Description */}
          {facility.description && (
            <div className="mb-4">
              <p className="text-sm text-gray-600 leading-relaxed">
                {facility.description}
              </p>
            </div>
          )}

          {/* Address & Hours */}
          <div className="space-y-2 mb-4 bg-gray-50 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-700">{facility.address}</span>
            </div>
            {facility.operatingHours && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-700">{formatOperatingHours(facility.operatingHours)}</span>
              </div>
            )}
          </div>

          {/* Amenities */}
          {allAmenities.length > 0 && (
            <div className="mb-4">
              <h2 className="font-semibold text-gray-900 mb-3">
                Amenities & Facilities
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {allAmenities.map((amenity: any, index: number) => {
                  if (!amenity) return null;
                  
                  if (amenity.custom) {
                    return (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
                      >
                        <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Check className="w-4 h-4 text-gray-600" />
                        </div>
                        <span className="text-xs text-gray-700">{amenity.name}</span>
                      </div>
                    );
                  }

                  const IconComponent = amenity.icon;
                  return (
                    <div
                      key={amenity.id}
                      className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg border border-orange-100"
                    >
                      <div className="w-8 h-8 bg-[#FF8C42] rounded-lg flex items-center justify-center flex-shrink-0">
                        <IconComponent className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-xs text-gray-700">{amenity.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Services Offered */}
          {services.length > 0 && (
            <div className="mb-4">
              <h2 className="font-semibold text-gray-900 mb-3">Services Offered</h2>
              <div className="space-y-2">
                {services.slice(0, 5).map((service: any) => (
                  <div
                    key={service.serviceId}
                    className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-[#FF8C42] transition-colors"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {service.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {service.duration} mins
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-[#FF8C42]">
                        ₹{service.price}
                      </div>
                      {service.serviceType && (
                        <Badge variant="outline" className="text-xs mt-1">
                          {service.serviceType}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Reviews */}
          {reviews.length > 0 && (
            <div className="mb-4">
              <h2 className="font-semibold text-gray-900 mb-3">Recent Reviews</h2>
              <div className="space-y-3">
                {reviews.map((review: any) => (
                  <div
                    key={review.reviewId}
                    className="p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-3 h-3 ${
                              star <= review.rating
                                ? 'text-yellow-500 fill-yellow-500'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-gray-600">{review.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Fixed Bottom CTA */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
          <div className="max-w-customer mx-auto">
            <Button
              onClick={onBookNow}
              className="w-full bg-[#FF8C42] hover:bg-[#FF7A2F] text-white h-12"
            >
              <Calendar className="w-5 h-5 mr-2" />
              Book Now
            </Button>
          </div>
        </div>

        {/* Bottom padding for fixed button */}
        <div className="h-20"></div>
      </div>
    </div>
  );
}