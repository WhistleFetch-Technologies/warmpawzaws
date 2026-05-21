'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { MapPin, Clock, Phone, ChevronRight, Tag, Percent, Gift, Calendar, Navigation, Heart, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { trackClick } from '@/lib/analytics';
import { StarRating } from '@/components/customer/shared/StarRating';
import { resolveVendorRatingForCard } from '@/lib/resolve-vendor-rating';

// ✅ FIX: Add promotion type for vendor discounts display
interface VendorPromotion {
  id: string;
  name: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  code?: string;
}

// ✅ ENRICHED: Specialization type
interface Specialization {
  id: string;
  name: string;
  icon?: string;
}

/** Vendor payload for `UniversalVendorCard` (also used by search mappers). */
export interface UniversalVendorCardVendor {
  id: string;
  vendorId: string;
  vendorName: string;
  vendorRating?: number;
  vendorReviewCount?: number;
  vendorLocation?: string;
  price?: number | string;
  duration?: string;
  serviceName?: string;
  description?: string;
  serviceStyle?: string;
  vendorProfileImage?: string;
  // ✅ NEW: Promotion fields from backend
  hasActivePromotions?: boolean;
  promotions?: VendorPromotion[];
  topPromotion?: VendorPromotion | null;
  // ✅ ENRICHED DATA: Next availability, distance, specializations
  nextAvailability?: string; // e.g., "Today 2:30 PM", "Tomorrow 10:00 AM"
  nextAvailableSlot?: {
    date: string;
    time: string;
    formattedDisplay: string;
  };
  distance?: number; // in km
  distanceText?: string; // e.g., "2.3 km away"
  specializations?: Specialization[] | string[];
  experience?: string; // e.g., "5+ years"
  completedBookings?: number;
  languages?: string[];
  isVerified?: boolean;
  isFavorite?: boolean;
  photoUrl?: string; // Alias for vendorProfileImage
  // Phase 2: Gallery, price range, Best for problem, package badge
  photos?: string[]; // 3-5 photos for gallery
  priceMin?: number;
  priceMax?: number;
  bestForProblem?: string; // e.g. "Vaccination", "Full Grooming"
  hasPackages?: boolean;
}

interface UniversalVendorCardProps {
  vendor: UniversalVendorCardVendor;
  icon?: ReactNode;
  colorClass?: string;
  onViewDetails?: (vendorId: string) => void;
  onBook?: (vendorId: string) => void;
  onToggleFavorite?: (vendorId: string) => void;
  showEnrichedData?: boolean; // Enable enriched display mode
  /** When false, hides the bottom action row (e.g. whole-card navigation on /search). */
  showActionButtons?: boolean;
  /** When false, hides the price / package row (listings without a bookable price). */
  showPriceRow?: boolean;
}

export function UniversalVendorCard({ 
  vendor, 
  icon = '🏪', 
  colorClass = 'from-blue-100 to-cyan-100',
  onViewDetails,
  onBook,
  onToggleFavorite,
  showEnrichedData = true,
  showActionButtons = true,
  showPriceRow = true,
}: UniversalVendorCardProps) {
  const vendorId = String(vendor.vendorId || vendor.id || '').trim();
  const ratingResolved = resolveVendorRatingForCard(
    {
      vendorId,
      vendorRating: vendor.vendorRating,
      vendorReviewCount: vendor.vendorReviewCount,
      review_count: vendor.vendorReviewCount,
      rating: vendor.vendorRating,
    },
    vendorId || undefined
  );
  const location = vendor.vendorLocation || 'Location not specified';
  const profileImage = vendor.vendorProfileImage || vendor.photoUrl;
  const [listingImageFailed, setListingImageFailed] = useState(false);
  const singlePhotoUrl = profileImage || vendor.photos?.[0];
  const vendorKey = `${vendor.vendorId || vendor.id}:${singlePhotoUrl || ''}`;

  useEffect(() => {
    setListingImageFailed(false);
  }, [vendorKey]);

  const formatPrice = (price: number | string | undefined) => {
    if (!price) return 'Contact for price';
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return `₹${numPrice.toLocaleString('en-IN')}`;
  };

  // Phase 2: Price range when priceMin/priceMax available
  const getPriceDisplay = () => {
    if (vendor.priceMin != null && vendor.priceMax != null && vendor.priceMin !== vendor.priceMax) {
      return `₹${vendor.priceMin.toLocaleString('en-IN')} – ₹${vendor.priceMax.toLocaleString('en-IN')}`;
    }
    if (vendor.price != null) return formatPrice(vendor.price);
    return null;
  };

  const getServiceStyleBadge = (style?: string) => {
    if (!style) return null;
    
    const badges = {
      'at_home': { label: 'Home Service', color: 'bg-green-100 text-green-700' },
      'at_center': { label: 'Visit Center', color: 'bg-blue-100 text-blue-700' },
      'tele': { label: 'Tele Consult', color: 'bg-purple-100 text-purple-700' }
    };

    const badge = badges[style as keyof typeof badges];
    if (!badge) return null;

    return (
      <span className={`text-xs px-2 py-1 rounded-full ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  // ✅ FIX: Format promotion badge text
  const getPromotionBadge = () => {
    const promo = vendor.topPromotion;
    if (!promo) return null;
    
    const discountText = promo.discountType === 'percentage' 
      ? `${promo.discountValue}% OFF`
      : `₹${promo.discountValue} OFF`;
    
    return (
      <div className="absolute -top-2 -right-2 z-10">
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold rounded-full shadow-lg animate-pulse">
          <Gift className="w-3 h-3" />
          {discountText}
        </span>
      </div>
    );
  };

  // ✅ ENRICHED: Format next availability display
  const getNextAvailability = () => {
    if (vendor.nextAvailableSlot?.formattedDisplay) {
      return vendor.nextAvailableSlot.formattedDisplay;
    }
    if (vendor.nextAvailability) {
      return vendor.nextAvailability;
    }
    return null;
  };

  // Format distance display (integer km, whole metres under 1 km)
  const getDistanceDisplay = () => {
    if (vendor.distanceText) return vendor.distanceText;
    if (vendor.distance !== undefined && vendor.distance !== null) {
      if (vendor.distance < 1) {
        return `${Math.round(vendor.distance * 1000)} m away`;
      }
      return `${Math.round(vendor.distance)} km away`;
    }
    return null;
  };

  // ✅ ENRICHED: Format specializations
  const getSpecializations = () => {
    if (!vendor.specializations || vendor.specializations.length === 0) return null;
    
    return vendor.specializations.slice(0, 3).map((spec, index) => {
      if (typeof spec === 'string') {
        return { id: `spec-${index}`, name: spec };
      }
      return spec;
    });
  };

  // Track card interactions
  const handleViewDetails = () => {
    trackClick(vendor.vendorName, 'vendor_card_details', { vendorId: vendor.vendorId || vendor.id });
    onViewDetails?.(vendor.vendorId || vendor.id);
  };

  const handleBook = () => {
    trackClick(vendor.vendorName, 'vendor_card_book', { vendorId: vendor.vendorId || vendor.id });
    onBook?.(vendor.vendorId || vendor.id);
  };

  const nextAvail = getNextAvailability();
  const distanceDisplay = getDistanceDisplay();
  const specializations = getSpecializations();

  return (
    <Card className="p-4 hover:shadow-lg transition-shadow relative overflow-visible bg-white border border-gray-100">
      {/* ✅ FIX: Vendor Promotion Badge (applied directly on service) */}
      {vendor.hasActivePromotions && getPromotionBadge()}
      
      {/* ✅ ENRICHED: Verified badge */}
      {vendor.isVerified && (
        <div className="absolute top-2 left-2 z-10">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
            <CheckCircle className="w-3 h-3" />
            Verified
          </span>
        </div>
      )}
      
      <div className="flex gap-4">
        {/* Phase 2: Gallery (3-5 photos) or single image */}
        <div className={`w-20 h-20 flex-shrink-0 relative overflow-hidden rounded-xl ${vendor.photos && vendor.photos.length > 1 ? '' : `bg-gradient-to-br ${colorClass}`}`}>
          {vendor.photos && vendor.photos.length > 1 ? (
            <div className="flex gap-1 w-full h-full">
              {vendor.photos.slice(0, 3).map((url, i) => (
                <img key={i} src={url} alt="" className="w-1/3 h-full object-cover flex-1" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
              ))}
            </div>
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${colorClass} flex items-center justify-center text-3xl`}>
              {!listingImageFailed && singlePhotoUrl ? (
                <img 
                  src={singlePhotoUrl} 
                  alt={vendor.vendorName}
                  className="w-full h-full object-cover"
                  onError={() => setListingImageFailed(true)}
                />
              ) : (
                icon
              )}
            </div>
          )}
          {/* Favorite heart overlay */}
          {onToggleFavorite && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(vendor.vendorId || vendor.id);
              }}
              className="absolute top-1 right-1 w-6 h-6 bg-white/80 rounded-full flex items-center justify-center"
            >
              <Heart 
                className={`w-4 h-4 ${vendor.isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} 
              />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Phase 2: Best for [problem] badge */}
          {showEnrichedData && vendor.bestForProblem && (
            <span className="inline-block text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full mb-1.5">
              Best for {vendor.bestForProblem}
            </span>
          )}
          {/* Vendor Name with Experience */}
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-900 truncate">{vendor.vendorName}</h3>
            {showEnrichedData && vendor.experience && (
              <span className="text-xs text-gray-500 flex-shrink-0">({vendor.experience})</span>
            )}
          </div>
          
          {/* Rating, Reviews & Service Style */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {ratingResolved.shouldShowRating ? (
              <StarRating
                rating={ratingResolved.average}
                reviewCount={ratingResolved.reviewCount}
                starsClassName="h-3.5 w-3.5"
                textClassName="text-sm text-gray-600"
              />
            ) : null}
            {showEnrichedData && vendor.completedBookings && vendor.completedBookings > 0 && (
              <>
                <span className="text-gray-400">•</span>
                <span className="text-xs text-gray-500">{vendor.completedBookings}+ bookings</span>
              </>
            )}
            {vendor.serviceStyle && (
              <>
                <span className="text-gray-400">•</span>
                {getServiceStyleBadge(vendor.serviceStyle)}
              </>
            )}
          </div>


          {/* Service Name (if available) */}
          {vendor.serviceName && (
            <p className="text-sm text-gray-700 mt-1 truncate">{vendor.serviceName}</p>
          )}

          {/* Description (if available) */}
          {vendor.description && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{vendor.description}</p>
          )}

          {/* ✅ ENRICHED: Location, Distance & Duration Row */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <div className="flex items-center gap-1 text-sm text-gray-600 min-w-0 flex-1">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{location}</span>
            </div>
            {distanceDisplay && (
              <div className="flex items-center gap-1 text-sm text-green-600 font-medium">
                <Navigation className="w-3.5 h-3.5" />
                <span>{distanceDisplay}</span>
              </div>
            )}
            {vendor.duration && (
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                <span>{vendor.duration}</span>
              </div>
            )}
          </div>

          {/* ✅ ENRICHED: Next Availability - Prominent display */}
          {showEnrichedData && nextAvail && (
            <div className="flex items-center gap-1.5 mt-2 text-sm">
              <Calendar className="w-4 h-4 text-orange-500" />
              <span className="text-orange-600 font-medium">Next: {nextAvail}</span>
            </div>
          )}

          {/* Price Row - Phase 2: price range + package badge */}
          {showPriceRow && (
          <div className="flex items-center justify-between mt-2 flex-wrap gap-1">
            <span className="text-lg font-bold text-blue-600">
              {getPriceDisplay() || formatPrice(vendor.price)}
            </span>
            {vendor.hasPackages && (
              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Package available</span>
            )}
            {/* Languages if available */}
            {showEnrichedData && vendor.languages && vendor.languages.length > 0 && (
              <span className="text-xs text-gray-500">
                {vendor.languages.slice(0, 2).join(', ')}
              </span>
            )}
          </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      {showActionButtons && (onViewDetails || onBook) && (
      <div className="flex gap-2 mt-3">
        {onViewDetails && (
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleViewDetails}
          >
            View Details
          </Button>
        )}
        {onBook && (
          <Button
            className="flex-1 bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] hover:from-[#FF7A35] hover:to-[#FF5A25] text-white"
            onClick={handleBook}
          >
            Book Now
          </Button>
        )}
      </div>
      )}
    </Card>
  );
}
