/**
 * HomeServiceProviderProfile - Full Provider Profile View
 * 
 * Features:
 * - Overview with photo, rating, reviews
 * - Photo gallery
 * - Location with map
 * - Contact information
 * - Services offered with pricing
 * - Amenities
 * - Reviews section
 * - Book Now CTA
 */

"use client";

import { useState, useEffect, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ServiceDescriptionInline } from '../shared/ServiceDescriptionInline';
import { 
  ArrowLeft, 
  Star, 
  MapPin, 
  Phone, 
  Clock, 
  ChevronRight,
  Heart,
  Share2,
  BadgeCheck,
  Calendar,
  MessageCircle,
  Navigation,
  Image as ImageIcon,
  X,
  ExternalLink,
  Award,
  Users,
  Briefcase
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import {
  mergeCustomerFacilityPayload,
  ratingFromFacilityRoot,
  resolveVendorCoverImageUrl,
  resolveVendorProfilePhotoUrl,
} from '@/lib/vendor-display-media';
import { HomeServiceType } from './UniversalHomeServiceRouter';

interface ServiceConfig {
  roleId: string;
  displayName: string;
  icon: string;
  primaryColor: string;
  bgGradient: string;
  problems: Array<{ id: string; name: string; icon: string }>;
  priceUnit: string;
  defaultDuration: number;
  requiresOTP: boolean;
  requiresStartOTP: boolean;
  supportsPackages: boolean;
  showMedicalHistory: boolean;
}

interface ProviderDetails {
  id: string;
  vendorId: string;
  businessName: string;
  fullName: string;
  photo: string;
  logo: string;
  coverImage: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  bio: string;
  description: string;
  rating: number;
  reviewCount: number;
  specializations: string[];
  amenities: string[];
  certifications: string[];
  experience: number;
  serviceCount: number;
  isVerified: boolean;
  operatingHours: { [key: string]: { open: string; close: string } };
  coordinates: { lat: number; lng: number };
  gallery: string[];
  services: Service[];
  reviews: Review[];
}

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  category: string;
}

interface Review {
  id: string;
  customerName: string;
  customerPhoto: string;
  rating: number;
  comment: string;
  date: string;
  petName: string;
}

type TabType = 'overview' | 'services' | 'photos' | 'reviews';

interface HomeServiceProviderProfileProps {
  phone: string;
  vendorId: string;
  serviceType: HomeServiceType;
  config: ServiceConfig;
  onBack: () => void;
  onSelectService: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function HomeServiceProviderProfile({
  phone,
  vendorId,
  serviceType,
  config,
  onBack,
  onSelectService,
  onNavigate
}: HomeServiceProviderProfileProps) {

  const [provider, setProvider] = useState<ProviderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isFavorite, setIsFavorite] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [avatarImageFailed, setAvatarImageFailed] = useState(false);
  const [coverImageFailed, setCoverImageFailed] = useState(false);

  useEffect(() => {
    loadProviderDetails();
  }, [vendorId]);

  const loadProviderDetails = async () => {
    try {
      setLoading(true);
      setAvatarImageFailed(false);
      setCoverImageFailed(false);
      console.log(`📍 [HOME-SERVICE-PROFILE] Loading vendor details for: ${vendorId}`);

      let facilityRoot: Record<string, unknown> | null = null;
      try {
        facilityRoot = (await apiClient.get(`/customer/facility/${vendorId}`)) as Record<string, unknown>;
      } catch (e) {
        facilityRoot = null;
        console.log('📦 [HOME-SERVICE-PROFILE] Facility request failed, will try /vendor/:id');
      }

      let merged: Record<string, unknown>;
      let ratingMeta: { average?: number; count?: number } = {};

      if (
        facilityRoot &&
        (facilityRoot as { success?: boolean }).success !== false &&
        (facilityRoot.vendor || facilityRoot.facility)
      ) {
        merged = mergeCustomerFacilityPayload(facilityRoot);
        ratingMeta = ratingFromFacilityRoot(facilityRoot);
        console.log('📦 [HOME-SERVICE-PROFILE] Facility merged vendor row:', merged);
      } else {
        try {
          const data = await apiClient.get<{ vendor?: any }>(`/vendor/${vendorId}`);
          merged = (data.vendor || data) as Record<string, unknown>;
          console.log('📦 [HOME-SERVICE-PROFILE] Vendor fallback response:', merged);
        } catch (e2) {
          console.error('❌ [HOME-SERVICE-PROFILE] Could not load vendor');
          setLoading(false);
          return;
        }
      }

      const profilePhotoUrl = resolveVendorProfilePhotoUrl(merged);
      const coverUrl = resolveVendorCoverImageUrl(merged);

      const galleryFromFacility =
        facilityRoot &&
        typeof facilityRoot.facility === 'object' &&
        facilityRoot.facility !== null &&
        Array.isArray((facilityRoot.facility as { photos?: unknown }).photos)
          ? ((facilityRoot.facility as { photos: string[] }).photos)
          : [];

      const galleryFallback = [
        ...(Array.isArray(merged.gallery) ? merged.gallery : []),
        ...(Array.isArray(merged.photos) ? merged.photos : []),
      ].filter((u): u is string => typeof u === 'string' && u.length > 0);

      const gallery = galleryFromFacility.length > 0 ? galleryFromFacility : galleryFallback;

      const latRaw = merged.latitude ?? merged.lat;
      const lngRaw = merged.longitude ?? merged.lng;
      const lat = latRaw != null && latRaw !== '' ? Number(latRaw) : NaN;
      const lng = lngRaw != null && lngRaw !== '' ? Number(lngRaw) : NaN;

      // Load services (prefer customer endpoint so only published + vendor price)
      let services: any[] = [];
      try {
        let servicesData: any;
        try {
          servicesData = await apiClient.get<{ success?: boolean; services?: any[] }>(`/customer/vendor/${vendorId}/services`);
        } catch {
          servicesData = await apiClient.get<{ services: any[] }>(`/vendor/${vendorId}/services`);
        }
        if (servicesData?.services && Array.isArray(servicesData.services)) {
          services = servicesData.services;
        } else if (Array.isArray(servicesData)) {
          services = servicesData;
        }
        console.log(`📦 [HOME-SERVICE-PROFILE] Found ${services.length} services`);
      } catch (e) {
        console.log('No services found');
      }

      // Load reviews
      let reviews: any[] = [];
      try {
        const reviewsData = await apiClient.get<{ reviews: any[] }>(`/vendor/${vendorId}/reviews`);
        reviews = reviewsData.reviews || [];
        console.log(`📦 [HOME-SERVICE-PROFILE] Found ${reviews.length} reviews`);
      } catch (e) {
        console.log('No reviews found');
      }

      const businessName =
        (merged.businessName as string) ||
        (merged.business_name as string) ||
        (merged.name as string) ||
        (merged.fullName as string) ||
        'Provider';
      const fullName = (merged.fullName as string) || (merged.owner_name as string) || (merged.ownerName as string) || '';

      const ratingAvg =
        ratingMeta.average ??
        (typeof merged.rating === 'number' ? merged.rating : parseFloat(String(merged.rating || merged.avgRating || '')) || undefined) ??
        4.5;

      const rcMerge = merged.reviewCount;
      const parsedRc =
        typeof rcMerge === 'number' && !Number.isNaN(rcMerge)
          ? rcMerge
          : rcMerge != null && String(rcMerge).trim() !== ''
            ? parseInt(String(rcMerge), 10)
            : NaN;
      const reviewCount =
        ratingMeta.count != null && Number.isFinite(ratingMeta.count)
          ? ratingMeta.count
          : Number.isFinite(parsedRc)
            ? parsedRc
            : reviews.length;

      const specs = merged.specializations;
      const specFallback = merged.services;
      const specializations: string[] = Array.isArray(specs)
        ? (specs as string[])
        : Array.isArray(specFallback)
          ? (specFallback as string[])
          : [];

      setProvider({
        id: (merged.id as string) || vendorId,
        vendorId: (merged.vendorId as string) || vendorId,
        businessName,
        fullName,
        photo: profilePhotoUrl || '',
        logo: (merged.logo as string) || (merged.logo_url as string) || profilePhotoUrl || '',
        coverImage: coverUrl || '',
        address:
          (merged.address as string) ||
          [merged.city, merged.state].filter(Boolean).join(', ') ||
          'Address not specified',
        phone: (merged.phone as string) || '',
        email: (merged.email as string) || '',
        website: (merged.website as string) || '',
        bio: (merged.bio as string) || (merged.description as string) || '',
        description: (merged.description as string) || (merged.bio as string) || '',
        rating: Number.isFinite(Number(ratingAvg)) ? Number(ratingAvg) : 4.5,
        reviewCount,
        specializations,
        amenities: (Array.isArray(merged.amenities) ? merged.amenities : []) as string[],
        certifications: (Array.isArray(merged.certifications) ? merged.certifications : []) as string[],
        experience: Number(merged.experience ?? merged.yearsOfExperience ?? merged.years_of_experience ?? 0),
        serviceCount: Number(merged.serviceCount ?? merged.completedServices ?? merged.completed_bookings ?? 0),
        isVerified: Boolean(merged.isVerified ?? merged.verified ?? merged.is_verified),
        operatingHours: (merged.operatingHours || merged.operating_hours || merged.hours || {}) as ProviderDetails['operatingHours'],
        coordinates: !Number.isNaN(lat) && !Number.isNaN(lng) ? { lat, lng } : { lat: 0, lng: 0 },
        gallery,
        services: services,
        reviews: reviews
      });
    } catch (error) {
      console.error('❌ [HOME-SERVICE-PROFILE] Exception:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCall = () => {
    if (provider?.phone) {
      window.location.href = `tel:${provider.phone}`;
    }
  };

  const handleDirections = () => {
    if (provider?.coordinates) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${provider.coordinates.lat},${provider.coordinates.lng}`;
      window.open(url, '_blank');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: provider?.businessName || config.displayName,
        text: `Check out ${provider?.businessName} for ${config.displayName}`,
        url: window.location.href
      });
    }
  };

  const toggleFavorite = () => {
    setIsFavorite(!isFavorite);
    // TODO: Save to favorites API
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'services', label: 'Services' },
    { id: 'photos', label: 'Photos' },
    { id: 'reviews', label: 'Reviews' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <div className="text-center">
          <div 
            className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
            style={{ borderColor: config.primaryColor }}
          />
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <div className="text-center p-6">
          <p className="text-gray-600 mb-4">Provider not found</p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const accentSoft: CSSProperties = {
    backgroundColor: `color-mix(in srgb, ${config.primaryColor} 14%, white)`,
  };
  const accentFg: CSSProperties = { color: config.primaryColor };

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto pb-24">
      {/* Cover Image & Header */}
      <div className="relative">
        <div className="h-48 bg-gray-200 overflow-hidden">
          {provider.coverImage && !coverImageFailed ? (
            <img
              src={provider.coverImage}
              alt={provider.businessName}
              className="w-full h-full object-cover"
              onError={() => setCoverImageFailed(true)}
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${config.bgGradient}`} />
          )}
        </div>

        {/* Toolbar: safe-area so back/actions clear status bar (iOS / WebView) — matches UniversalProviderProfile */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 cw-header-safe-top cw-header-safe-x pointer-events-none">
          <button
            type="button"
            onClick={onBack}
            className="pointer-events-auto flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full bg-white/90 shadow-md"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </button>
          <div className="flex shrink-0 gap-2 pointer-events-auto">
            <button
              type="button"
              onClick={toggleFavorite}
              className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-white/90 shadow-md"
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Heart
                className={`h-5 w-5 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-700'}`}
              />
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-white/90 shadow-md"
              aria-label="Share"
            >
              <Share2 className="h-5 w-5 text-gray-700" />
            </button>
          </div>
        </div>

        {/* Profile Photo */}
        <div className="absolute -bottom-12 left-[max(1rem,env(safe-area-inset-left,0px))]">
          <div className="w-24 h-24 rounded-2xl border-4 border-white bg-white shadow-lg overflow-hidden">
            {provider.photo && !avatarImageFailed ? (
              <img
                src={provider.photo}
                alt={provider.businessName}
                className="w-full h-full object-cover"
                onError={() => setAvatarImageFailed(true)}
              />
            ) : (
              <div
                className={`w-full h-full bg-gradient-to-br ${config.bgGradient} flex items-center justify-center text-white text-3xl`}
              >
                {config.icon}
              </div>
            )}
          </div>
          {provider.isVerified && (
            <div className="absolute -top-1 -right-1 w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white">
              <BadgeCheck className="w-4 h-4 text-white" />
            </div>
          )}
        </div>
      </div>

      {/* Provider Info */}
      <div className="pt-16 px-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="text-xl font-bold text-gray-800">{provider.businessName}</h1>
            {provider.fullName && provider.fullName !== provider.businessName && (
              <p className="text-sm text-gray-500">{provider.fullName}</p>
            )}
          </div>
        </div>

        {/* Rating & Stats */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-1 rounded-full px-2.5 py-1" style={accentSoft}>
            <Star className="w-4 h-4 fill-current" style={accentFg} />
            <span className="text-sm font-semibold" style={accentFg}>{provider.rating.toFixed(1)}</span>
            <span className="text-xs opacity-90" style={accentFg}>({provider.reviewCount})</span>
          </div>
          {provider.experience > 0 && (
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <Briefcase className="w-4 h-4" />
              <span>{provider.experience} yrs</span>
            </div>
          )}
          {provider.serviceCount > 0 && (
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <Users className="w-4 h-4" />
              <span>{provider.serviceCount}+ served</span>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={handleCall}
            type="button"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium"
            style={{ ...accentSoft, ...accentFg }}
          >
            <Phone className="w-4 h-4" />
            Call
          </button>
          <button
            onClick={handleDirections}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-50 text-blue-600 font-medium"
          >
            <Navigation className="w-4 h-4" />
            Directions
          </button>
          <button
            onClick={() => onNavigate?.('chat', { vendorId: provider.id })}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-50 text-purple-600 font-medium"
          >
            <MessageCircle className="w-4 h-4" />
            Chat
          </button>
        </div>

        {/* Location */}
        <div className="flex items-start gap-2 mb-4 p-3 bg-gray-50 rounded-xl">
          <MapPin className="w-5 h-5 text-gray-500 mt-0.5" />
          <div>
            <p className="text-sm text-gray-700">{provider.address}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-10 bg-white border-b">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Bio */}
            {provider.bio && (
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">About</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{provider.bio}</p>
              </div>
            )}

            {/* Specializations */}
            {provider.specializations.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">Specializations</h3>
                <div className="flex flex-wrap gap-2">
                  {provider.specializations.map((spec, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 bg-orange-50 text-orange-600 rounded-full text-sm"
                    >
                      {spec}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Amenities */}
            {provider.amenities.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">Amenities</h3>
                <div className="grid grid-cols-2 gap-2">
                  {provider.amenities.map((amenity, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="w-2 h-2 shrink-0 rounded-full" style={{ backgroundColor: config.primaryColor }} />
                      {amenity}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Certifications */}
            {provider.certifications.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">Certifications</h3>
                <div className="space-y-2">
                  {provider.certifications.map((cert, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <Award className="w-4 h-4 text-yellow-500" />
                      {cert}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Operating Hours */}
            {Object.keys(provider.operatingHours).length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">Operating Hours</h3>
                <div className="space-y-1">
                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => {
                    const hours = provider.operatingHours[day];
                    return (
                      <div key={day} className="flex justify-between text-sm">
                        <span className="text-gray-600 capitalize">{day}</span>
                        <span className="text-gray-800">
                          {hours ? `${hours.open} - ${hours.close}` : 'Closed'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Services Tab */}
        {activeTab === 'services' && (
          <div className="space-y-3">
            {provider.services.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No services listed</p>
              </div>
            ) : (
              provider.services.map((service) => (
                <div
                  key={service.id}
                  className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-800">{service.name}</h4>
                      {service.description?.trim() && (
                        <div onClick={(e) => e.stopPropagation()} className="mt-1">
                          <ServiceDescriptionInline
                            description={service.description}
                            title={service.name}
                            className="m-0 text-sm leading-5 text-gray-500"
                          />
                        </div>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <span className="text-lg font-bold" style={{ color: config.primaryColor }}>
                        ₹{service.price}
                      </span>
                      {service.duration > 0 && (
                        <p className="text-xs text-gray-500">{service.duration} min</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Photos Tab */}
        {activeTab === 'photos' && (
          <div>
            {provider.gallery.length === 0 ? (
              <div className="text-center py-8">
                <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">No photos available</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {provider.gallery.map((image, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      setSelectedImage(image);
                      setShowGallery(true);
                    }}
                    className="aspect-square rounded-xl overflow-hidden cursor-pointer"
                  >
                    <img
                      src={image}
                      alt={`Gallery ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reviews Tab */}
        {activeTab === 'reviews' && (
          <div className="space-y-4">
            {/* Rating Summary */}
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-4xl font-bold text-gray-800">{provider.rating.toFixed(1)}</div>
                  <div className="flex items-center justify-center gap-0.5 mt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= Math.round(provider.rating)
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{provider.reviewCount} reviews</p>
                </div>
              </div>
            </div>

            {/* Reviews List */}
            {provider.reviews.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No reviews yet</p>
              </div>
            ) : (
              provider.reviews.map((review) => (
                <div
                  key={review.id}
                  className="bg-white rounded-xl p-4 border border-gray-100"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden">
                      {review.customerPhoto ? (
                        <img
                          src={review.customerPhoto}
                          alt={review.customerName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-orange-100 flex items-center justify-center text-orange-600 font-medium">
                          {review.customerName?.[0] || '?'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-800">{review.customerName}</h4>
                        <span className="text-xs text-gray-400">{review.date}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-3 h-3 ${
                              star <= review.rating
                                ? 'text-yellow-400 fill-yellow-400'
                                : 'text-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                      {review.petName && (
                        <p className="text-xs text-gray-500 mt-1">For: {review.petName}</p>
                      )}
                      <p className="text-sm text-gray-600 mt-2">{review.comment}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Fixed Book Now Button – standard orange to match vet dashboard (forensic theme compliance) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] max-w-md mx-auto">
        <button
          onClick={onSelectService}
          className="w-full py-4 rounded-xl text-white font-semibold text-lg bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] shadow-lg"
        >
          Book {config.displayName}
        </button>
      </div>

      {/* Gallery Lightbox */}
      <AnimatePresence>
        {showGallery && selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-50 flex items-center justify-center"
          >
            <div className="absolute right-0 top-0 z-10 flex justify-end cw-header-safe-top cw-header-safe-x">
              <button
                type="button"
                onClick={() => setShowGallery(false)}
                className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-white/20"
                aria-label="Close gallery"
              >
                <X className="h-6 w-6 text-white" />
              </button>
            </div>
            <img
              src={selectedImage}
              alt="Gallery"
              className="max-w-full max-h-full object-contain"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default HomeServiceProviderProfile;
