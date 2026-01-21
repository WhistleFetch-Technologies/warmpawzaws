'use client';

import { MapPin, Star, Clock, Phone, ChevronRight, Tag, Percent, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// ✅ FIX: Add promotion type for vendor discounts display
interface VendorPromotion {
  id: string;
  name: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  code?: string;
}

interface UniversalVendorCardProps {
  vendor: {
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
  };
  icon?: string;
  colorClass?: string;
  onViewDetails?: (vendorId: string) => void;
  onBook?: (vendorId: string) => void;
}

export function UniversalVendorCard({ 
  vendor, 
  icon = '🏪', 
  colorClass = 'from-blue-100 to-cyan-100',
  onViewDetails,
  onBook
}: UniversalVendorCardProps) {
  const rating = vendor.vendorRating || 4.5;
  const reviewCount = vendor.vendorReviewCount || 0;
  const location = vendor.vendorLocation || 'Location not specified';

  const formatPrice = (price: number | string | undefined) => {
    if (!price) return 'Contact for price';
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return `₹${numPrice.toLocaleString('en-IN')}`;
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

  return (
    <Card className="p-4 hover:shadow-lg transition-shadow relative overflow-visible">
      {/* ✅ FIX: Vendor Promotion Badge (applied directly on service) */}
      {vendor.hasActivePromotions && getPromotionBadge()}
      
      <div className="flex gap-4">
        {/* Icon/Image */}
        <div className={`w-20 h-20 bg-gradient-to-br ${colorClass} rounded-xl flex items-center justify-center text-3xl flex-shrink-0 relative`}>
          {vendor.vendorProfileImage ? (
            <img 
              src={vendor.vendorProfileImage} 
              alt={vendor.vendorName}
              className="w-full h-full object-cover rounded-xl"
            />
          ) : (
            icon
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Vendor Name */}
          <h3 className="font-bold text-gray-900 truncate">{vendor.vendorName}</h3>
          
          {/* Rating & Reviews */}
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <span className="text-sm font-medium">{Number(rating || 0).toFixed(1)}</span>
            </div>
            {reviewCount > 0 && (
              <>
                <span className="text-gray-400">•</span>
                <span className="text-sm text-gray-600">{reviewCount} reviews</span>
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

          {/* Location & Duration */}
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <MapPin className="w-4 h-4" />
              <span className="truncate">{location}</span>
            </div>
            {vendor.duration && (
              <>
                <span className="text-gray-400">•</span>
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>{vendor.duration}</span>
                </div>
              </>
            )}
          </div>

          {/* Price */}
          <div className="mt-2">
            <span className="text-lg font-bold text-blue-600">
              {formatPrice(vendor.price)}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mt-3">
        {onViewDetails && (
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onViewDetails(vendor.vendorId || vendor.id)}
          >
            View Details
          </Button>
        )}
        {onBook && (
          <Button
            className="flex-1"
            onClick={() => onBook(vendor.vendorId || vendor.id)}
          >
            Book Now
          </Button>
        )}
      </div>
    </Card>
  );
}
