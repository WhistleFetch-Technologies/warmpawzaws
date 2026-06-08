'use client';

import React from 'react';
import {
  Car,
  Snowflake,
  Dog,
  Siren,
  Clock,
  Home,
  Video,
  Wifi,
  CreditCard,
  Accessibility,
  Baby,
  Coffee,
  Droplets,
  Shield,
  Stethoscope,
  Pill,
  Scissors,
  ShowerHead,
  UtensilsCrossed,
  Bed,
  Waves,
  Trees,
  Camera,
  Music,
  Tv,
  Dumbbell,
  Heart,
  Sparkles,
  CheckCircle2,
  LucideIcon
} from 'lucide-react';

// Amenity configuration with icons and categories
export const AMENITY_CONFIG: Record<string, { 
  icon: LucideIcon; 
  label: string; 
  category: string;
  highlight?: boolean;
}> = {
  // Essential - Highlighted
  'parking': { icon: Car, label: 'Parking Available', category: 'essential', highlight: true },
  'ac': { icon: Snowflake, label: 'Air Conditioned', category: 'essential', highlight: true },
  'pet_friendly_waiting': { icon: Dog, label: 'Pet-Friendly Waiting Area', category: 'essential', highlight: true },
  'emergency_services': { icon: Siren, label: 'Emergency Services', category: 'essential', highlight: true },
  '24x7': { icon: Clock, label: '24x7 Availability', category: 'essential', highlight: true },
  'home_visit': { icon: Home, label: 'Home Visit Available', category: 'essential', highlight: true },
  'online_consultation': { icon: Video, label: 'Online Consultation', category: 'essential', highlight: true },
  
  // Payment & Access
  'wifi': { icon: Wifi, label: 'Free WiFi', category: 'convenience' },
  'card_payment': { icon: CreditCard, label: 'Card Payment Accepted', category: 'convenience' },
  'upi_payment': { icon: CreditCard, label: 'UPI Payment Accepted', category: 'convenience' },
  'wheelchair_accessible': { icon: Accessibility, label: 'Wheelchair Accessible', category: 'convenience' },
  'child_friendly': { icon: Baby, label: 'Child Friendly', category: 'convenience' },
  
  // Waiting Area
  'refreshments': { icon: Coffee, label: 'Refreshments Available', category: 'comfort' },
  'drinking_water': { icon: Droplets, label: 'Drinking Water', category: 'comfort' },
  'comfortable_seating': { icon: Bed, label: 'Comfortable Seating', category: 'comfort' },
  'tv': { icon: Tv, label: 'TV in Waiting Area', category: 'comfort' },
  'music': { icon: Music, label: 'Calming Music', category: 'comfort' },
  
  // Medical Facilities
  'pharmacy': { icon: Pill, label: 'In-house Pharmacy', category: 'medical' },
  'lab': { icon: Stethoscope, label: 'Diagnostic Lab', category: 'medical' },
  'surgery': { icon: Heart, label: 'Surgery Facilities', category: 'medical' },
  'xray': { icon: Camera, label: 'X-Ray Available', category: 'medical' },
  'ultrasound': { icon: Waves, label: 'Ultrasound Available', category: 'medical' },
  'icu': { icon: Shield, label: 'ICU Facility', category: 'medical' },
  
  // Grooming & Spa
  'grooming': { icon: Scissors, label: 'Grooming Services', category: 'services' },
  'spa': { icon: Sparkles, label: 'Pet Spa', category: 'services' },
  'bathing': { icon: ShowerHead, label: 'Bathing Facilities', category: 'services' },
  
  // Boarding & Resort
  'outdoor_area': { icon: Trees, label: 'Outdoor Play Area', category: 'boarding' },
  'pool': { icon: Waves, label: 'Swimming Pool', category: 'boarding' },
  'training': { icon: Dumbbell, label: 'Training Facilities', category: 'boarding' },
  'cctv': { icon: Camera, label: 'CCTV Monitoring', category: 'boarding' },
  'camera': { icon: Camera, label: 'CCTV Monitoring', category: 'boarding' },
  'play_area': { icon: Trees, label: 'Outdoor Play Area', category: 'boarding' },
  'medical': { icon: Stethoscope, label: 'Medical Care', category: 'medical' },
  'individual_rooms': { icon: Bed, label: 'Individual Rooms', category: 'boarding' },
  'feeding': { icon: UtensilsCrossed, label: 'Meal Service', category: 'boarding' },
};

// Category labels and order
const CATEGORY_CONFIG: Record<string, { label: string; order: number }> = {
  'essential': { label: 'Key Amenities', order: 1 },
  'medical': { label: 'Medical Facilities', order: 2 },
  'services': { label: 'Additional Services', order: 3 },
  'convenience': { label: 'Convenience', order: 4 },
  'comfort': { label: 'Comfort', order: 5 },
  'boarding': { label: 'Boarding & Stay', order: 6 },
};

interface AmenitiesSectionProps {
  amenities: string[];
  customAmenities?: string[];
  showCategories?: boolean;
  compact?: boolean;
  className?: string;
}

export function AmenitiesSection({ 
  amenities = [], 
  customAmenities = [],
  showCategories = false,
  compact = false,
  className = ''
}: AmenitiesSectionProps) {
  // Combine and normalize amenities
  const allAmenities = [...amenities, ...customAmenities].map(a => 
    typeof a === 'string' ? a.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_') : ''
  ).filter(Boolean);

  // Remove duplicates
  const uniqueAmenities = [...new Set(allAmenities)];

  if (uniqueAmenities.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <Dog className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">No amenities listed</p>
        <p className="text-gray-400 text-xs mt-1">Check with the provider for available facilities</p>
      </div>
    );
  }

  // Get amenity details with fallback for unknown amenities
  const getAmenityDetails = (amenityKey: string) => {
    // Direct match
    if (AMENITY_CONFIG[amenityKey]) {
      return { key: amenityKey, ...AMENITY_CONFIG[amenityKey] };
    }

    // Try common variations
    const variations = [
      amenityKey,
      amenityKey.replace(/_/g, ''),
      amenityKey.replace(/available/gi, '').trim().replace(/\s+/g, '_'),
      amenityKey.replace(/_available$/i, ''),
    ];

    for (const variant of variations) {
      if (AMENITY_CONFIG[variant]) {
        return { key: variant, ...AMENITY_CONFIG[variant] };
      }
    }

    // Fallback for custom amenities
    return {
      key: amenityKey,
      icon: CheckCircle2,
      label: amenityKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      category: 'other',
      highlight: false
    };
  };

  const processedAmenities = uniqueAmenities.map(getAmenityDetails);

  // Group by category if showCategories is true
  if (showCategories) {
    const grouped: Record<string, typeof processedAmenities> = {};
    processedAmenities.forEach(amenity => {
      const cat = amenity.category || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(amenity);
    });

    // Sort categories by order
    const sortedCategories = Object.entries(grouped).sort(([a], [b]) => {
      const orderA = CATEGORY_CONFIG[a]?.order || 99;
      const orderB = CATEGORY_CONFIG[b]?.order || 99;
      return orderA - orderB;
    });

    return (
      <div className={`space-y-6 ${className}`}>
        {sortedCategories.map(([category, items]) => (
          <div key={category}>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              {CATEGORY_CONFIG[category]?.label || 'Other Amenities'}
            </h4>
            <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'} gap-2`}>
              {items.map((amenity) => (
                <AmenityBadge key={amenity.key} amenity={amenity} compact={compact} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Sort: highlighted first, then alphabetically
  const sortedAmenities = [...processedAmenities].sort((a, b) => {
    if (a.highlight && !b.highlight) return -1;
    if (!a.highlight && b.highlight) return 1;
    return a.label.localeCompare(b.label);
  });

  return (
    <div className={className}>
      <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'} gap-2`}>
        {sortedAmenities.map((amenity) => (
          <AmenityBadge key={amenity.key} amenity={amenity} compact={compact} />
        ))}
      </div>
    </div>
  );
}

interface AmenityBadgeProps {
  amenity: {
    key: string;
    icon: LucideIcon;
    label: string;
    category: string;
    highlight?: boolean;
  };
  compact?: boolean;
}

function AmenityBadge({ amenity, compact = false }: AmenityBadgeProps) {
  const Icon = amenity.icon;
  const isHighlighted = amenity.highlight;

  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs ${
          isHighlighted
            ? 'bg-orange-50 text-orange-700 border border-orange-200'
            : 'bg-gray-50 text-gray-700 border border-gray-100'
        }`}
      >
        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isHighlighted ? 'text-orange-500' : 'text-gray-500'}`} />
        <span className="truncate">{amenity.label}</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm ${
        isHighlighted
          ? 'bg-gradient-to-r from-orange-50 to-amber-50 text-orange-800 border border-orange-200 shadow-sm'
          : 'bg-gray-50 text-gray-700 border border-gray-100'
      }`}
    >
      <div className={`p-1.5 rounded-lg ${isHighlighted ? 'bg-orange-100' : 'bg-white'}`}>
        <Icon className={`w-4 h-4 ${isHighlighted ? 'text-orange-600' : 'text-gray-500'}`} />
      </div>
      <span className="font-medium truncate">{amenity.label}</span>
    </div>
  );
}

// Export for use in other components
export default AmenitiesSection;
