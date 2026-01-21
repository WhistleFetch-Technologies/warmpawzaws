'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Star, MapPin, Clock, Video, Home, Building2, ChevronRight, Filter, Loader2, Shield, User, Heart, Share2, Navigation, Phone, Award, Stethoscope, Check, Search, X, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';

interface VetServicesByStyleProps {
  phone: string;
  serviceStyle: string; // 'tele', 'at_home', 'at_center'
  serviceTypeName?: string;
  category?: string;
  vendorId?: string; // Optional: filter to show only this vendor's services (vendor profile mode)
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

// Provider can be vendor (for at_center) or staff/individual (for at_home/tele)
interface Provider {
  providerId: string;
  providerType: 'vendor' | 'staff' | 'individual';
  vendorId?: string;
  vendorName?: string;
  staffId?: string;
  name: string;
  phone?: string;
  photo?: string;
  address?: string;
  city?: string;
  role?: string;
  experienceYears?: number;
  qualifications?: string;
  rating: string;
  reviewCount: number;
  distance?: number | null;
  isVerified?: boolean;
  isIndividualProvider?: boolean;
  services: {
    id: string;
    serviceId: string;
    name: string;
    price: number;
    duration: number;
    description?: string;
    category?: string;
  }[];
}

export function VetServicesByStyle({ 
  phone, 
  serviceStyle, 
  serviceTypeName,
  category = 'vet',
  vendorId,
  onBack, 
  onNavigate 
}: VetServicesByStyleProps) {
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  
  // Profile view state (when vendorId is provided)
  const [vendor, setVendor] = useState<any>(null);
  const [facility, setFacility] = useState<any>(null);
  const [rating, setRating] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'reviews'>('services');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'price' | 'name' | 'popular'>('popular');
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());

  // Check if we're in profile view mode (vendorId provided and single provider)
  const isProfileView = vendorId && providers.length === 1;
  const profileProvider = isProfileView ? providers[0] : null;

  useEffect(() => {
    loadServicesByStyle();
    // If vendorId is provided, also load vendor and facility details for profile view
    if (vendorId) {
      loadVendorProfile();
    }
  }, [serviceStyle, vendorId]);

  const loadServicesByStyle = async () => {
    // Get customer location from localStorage for distance-based sorting
    let locationParams = '';
    try {
      const customerLat = localStorage.getItem('customer_latitude');
      const customerLng = localStorage.getItem('customer_longitude');
      if (customerLat && customerLng) {
        locationParams = `&latitude=${customerLat}&longitude=${customerLng}`;
      }
    } catch (e) {
      console.log('Could not get customer location');
    }
    
    try {
      setLoading(true);
      
      const response = await apiClient.get(
        `/customer/services/by-style?style=${serviceStyle}&category=${category}${locationParams}`
      ) as any;

      if (response.success) {
        // New API returns 'providers' array, fallback to 'vendors' for backward compatibility
        let providerData = response.providers || response.vendors || [];
        
        // Filter to specific vendor if vendorId is provided (vendor profile mode)
        if (vendorId) {
          providerData = providerData.filter((p: any) => 
            (p.providerId || p.vendorId || p.id) === vendorId
          );
        }
        
        setProviders(providerData);
        console.log(`✅ [Vet] Loaded ${providerData.length} provider${vendorId ? ' (filtered)' : 's'} with ${serviceStyle} services`);
      } else {
        console.warn('⚠️ [Vet] API returned success=false');
        setProviders([]);
      }
    } catch (error) {
      console.error('❌ [Vet] Error loading services by style:', error);
      // Try fallback endpoint
      try {
        const fallbackResponse = await apiClient.get(
          `/customer/discover-services?category=${category}&roleId=veterinarian&serviceStyle=${serviceStyle}${locationParams}`
        ) as any;
        
        const servicesData = fallbackResponse.vendors || fallbackResponse.services || [];
        const vendorMap = new Map();
        
        servicesData.forEach((service: any) => {
          const vendorId = service.vendorId || service.id;
          if (!vendorMap.has(vendorId)) {
            vendorMap.set(vendorId, {
              providerId: vendorId,
              providerType: 'vendor',
              vendorId: vendorId,
              name: service.vendorName || service.businessName || service.name || 'Veterinarian',
              rating: Number(service.vendorRating || service.rating || 4.5),
              reviewCount: service.vendorReviewCount || service.reviewsCount || 0,
              distance: service.distance || null,
              services: []
            });
          }
          
          const provider = vendorMap.get(vendorId);
          if (service.serviceId || service.id) {
            provider.services.push({
              id: service.serviceId || service.id,
              serviceId: service.serviceId || service.id,
              name: service.serviceName || service.name || 'Vet Service',
              price: service.price || 499,
              duration: service.duration || 30,
              description: service.description,
              category: service.category
            });
          }
        });
        
        let providersList = Array.from(vendorMap.values());
        
        // Filter to specific vendor if vendorId is provided (vendor profile mode)
        if (vendorId) {
          providersList = providersList.filter(p => 
            p.providerId === vendorId || 
            p.vendorId === vendorId || 
            p.staffId === vendorId
          );
        }
        
        setProviders(providersList);
        console.log(`✅ [Vet] Loaded ${providersList.length} provider${vendorId ? ' (filtered)' : 's'} from fallback endpoint`);
      } catch (fallbackError) {
        console.error('❌ [Vet] Fallback endpoint also failed:', fallbackError);
        setProviders([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Load vendor and facility details for profile view
  const loadVendorProfile = async () => {
    if (!vendorId) return;
    
    try {
      const [vendorRes, facilityRes] = await Promise.all([
        apiClient.get<any>(`/customer/vendor/${vendorId}`).catch(() => null),
        apiClient.get<any>(`/customer/facility/${vendorId}`).catch(() => null)
      ]);

      if (vendorRes?.success || vendorRes) {
        const vendorData = vendorRes?.vendor || vendorRes;
        setVendor(vendorData);
      }

      if (facilityRes?.success) {
        setFacility(facilityRes.facility);
        setRating(facilityRes.rating);
        setReviews(facilityRes.recentReviews || []);
      }
    } catch (error) {
      console.error('Error loading vendor profile:', error);
    }
  };

  const getStyleIcon = () => {
    switch (serviceStyle) {
      case 'tele': return <Video className="w-5 h-5" />;
      case 'at_home': return <Home className="w-5 h-5" />;
      case 'at_center': return <Building2 className="w-5 h-5" />;
      default: return <Video className="w-5 h-5" />;
    }
  };

  const getStyleColor = () => {
    switch (serviceStyle) {
      case 'tele': return 'from-blue-500 to-blue-600';
      case 'at_home': return 'from-orange-500 to-orange-600';
      case 'at_center': return 'from-green-500 to-green-600';
      default: return 'from-blue-500 to-blue-600';
    }
  };

  const getProviderTypeLabel = (provider: Provider) => {
    if (provider.providerType === 'individual') {
      return 'Independent Provider';
    }
    if (provider.providerType === 'staff') {
      return provider.vendorName ? `From ${provider.vendorName}` : 'Clinic Staff';
    }
    return provider.role || 'Provider';
  };

  const handleSelectService = (provider: Provider, service: any) => {
    // For staff/individual providers, include staffId in booking data
    const bookingData: any = {
      serviceId: service.id,
      serviceName: service.name,
      serviceStyle,
      price: service.price,
      duration: service.duration,
      providerName: provider.name,
    };

    if (provider.providerType === 'vendor') {
      bookingData.vendorId = provider.providerId;
      bookingData.vendorName = provider.name;
    } else {
      // Staff or individual provider
      bookingData.staffId = provider.providerId;
      bookingData.staffName = provider.name;
      bookingData.vendorId = provider.vendorId; // May be null for individual providers
      bookingData.vendorName = provider.vendorName;
      bookingData.isIndividualProvider = provider.isIndividualProvider;
    }

    onNavigate('vet-booking', bookingData);
  };

  // Filter and sort services for profile view
  const filteredServices = profileProvider?.services || [];
  const sortedServices = [...filteredServices].sort((a, b) => {
    if (sortBy === 'popular') return 0;
    if (sortBy === 'price') return a.price - b.price;
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return 0;
  });

  const toggleServiceSelection = (serviceId: string) => {
    const newSelection = new Set(selectedServices);
    if (newSelection.has(serviceId)) {
      newSelection.delete(serviceId);
    } else {
      newSelection.add(serviceId);
    }
    setSelectedServices(newSelection);
  };

  const handleBookServices = () => {
    if (selectedServices.size === 0) {
      if (profileProvider?.services && profileProvider.services.length > 0) {
        handleSelectService(profileProvider, profileProvider.services[0]);
      }
      return;
    }

    const selectedServicesData = Array.from(selectedServices).map(id => 
      profileProvider?.services.find(s => s.id === id || s.serviceId === id)
    ).filter(Boolean);

    if (selectedServicesData.length > 0) {
      handleSelectService(profileProvider!, selectedServicesData[0]);
    }
  };

  const totalPrice = Array.from(selectedServices).reduce((sum, id) => {
    const service = profileProvider?.services.find(s => s.id === id || s.serviceId === id);
    return sum + (service?.price || 0);
  }, 0);

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: profileProvider?.name || 'Vet Provider',
          text: `Check out ${profileProvider?.name || 'this vet provider'} on Warmpawz`,
          url: window.location.href
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#FF8C42] mx-auto mb-3" />
          <p className="text-gray-600">Loading {vendorId ? 'provider profile' : 'available services'}...</p>
        </div>
      </div>
    );
  }

  // Profile View Mode - Zomato-style for vet provider (tele/at_home/at_center)
  if (isProfileView && profileProvider) {
    const providerName = vendor?.business_name || vendor?.name || profileProvider.name;
    const photos = facility?.photos || vendor?.photos || (profileProvider.photo ? [profileProvider.photo] : []);
    const hasPhotos = photos.length > 0;
    const amenities = facility?.amenities || vendor?.amenities || [];
    const address = vendor?.address || facility?.address || profileProvider.address || '';
    const phoneNumber = vendor?.phone || facility?.phone || profileProvider.phone || '';
    const description = vendor?.description || facility?.description || `${providerName} provides professional veterinary services.`;
    const specialization = facility?.specialization || vendor?.specialization || 'General Veterinary Care';

    return (
      <div>
        {/* Header is provided by renderScreenWithLayout wrapper (StandardizedHeader) */}

        {/* Large Hero Photo Gallery - Vet Provider Style */}
        {hasPhotos ? (
          <div className="relative w-full bg-gray-200">
            <div className="relative h-[280px] sm:h-[320px] overflow-hidden">
              <img 
                src={photos[selectedPhotoIndex]} 
                alt={providerName} 
                className="w-full h-full object-cover" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              
              {photos.length > 1 && (
                <>
                  <button
                    onClick={() => setSelectedPhotoIndex(Math.max(0, selectedPhotoIndex - 1))}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-gray-800 shadow-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={selectedPhotoIndex === 0}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setSelectedPhotoIndex(Math.min(photos.length - 1, selectedPhotoIndex + 1))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-gray-800 shadow-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={selectedPhotoIndex === photos.length - 1}
                  >
                    <ArrowLeft className="w-5 h-5 rotate-180" />
                  </button>
                  <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-sm font-medium">
                    {selectedPhotoIndex + 1} / {photos.length}
                  </div>
                </>
              )}
            </div>
            
            {/* Photo thumbnails strip */}
            {photos.length > 1 && photos.length <= 5 && (
              <div className="flex gap-2 p-3 bg-white overflow-x-auto scrollbar-hide">
                {photos.map((photo: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedPhotoIndex(idx)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                      selectedPhotoIndex === idx 
                        ? 'border-[#FF8C42] ring-2 ring-[#FF8C42]/30' 
                        : 'border-gray-200 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img 
                      src={photo} 
                      alt={`${providerName} photo ${idx + 1}`} 
                      className="w-full h-full object-cover" 
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="relative w-full h-[280px] bg-gradient-to-br from-[#FF8C42] to-[#FF7029] flex items-center justify-center">
            <div className="text-center text-white">
              {serviceStyle === 'tele' ? (
                <Video className="w-20 h-20 mx-auto mb-3 opacity-50" />
              ) : serviceStyle === 'at_home' ? (
                <Home className="w-20 h-20 mx-auto mb-3 opacity-50" />
              ) : (
                <Building2 className="w-20 h-20 mx-auto mb-3 opacity-50" />
              )}
              <p className="text-sm opacity-75">No photos available</p>
            </div>
          </div>
        )}

        <div className="px-4 pb-32">
          {/* Provider Header Info - Vet-Focused */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4 -mt-6 relative z-10">
            <div className="mb-4">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{providerName}</h1>
              
              {/* Rating and Reviews */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-1.5 bg-orange-50 px-3 py-1.5 rounded-lg">
                  <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  <span className="font-bold text-lg text-gray-900">
                    {Number(rating?.averageRating || profileProvider.rating || 4.5).toFixed(1)}
                  </span>
                  <span className="text-gray-600 text-sm">
                    ({rating?.totalReviews || profileProvider.reviewCount || 0} reviews)
                  </span>
                </div>
                
                {facility?.isPremium && (
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold flex items-center gap-1">
                    <Award className="w-3.5 h-3.5" />
                    Premium
                  </span>
                )}
                {profileProvider.isVerified && (
                  <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" />
                    Verified
                  </span>
                )}
              </div>

              {/* Service Type Badge */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg">
                  {serviceStyle === 'tele' ? (
                    <Video className="w-4 h-4 text-[#FF8C42]" />
                  ) : serviceStyle === 'at_home' ? (
                    <Home className="w-4 h-4 text-[#FF8C42]" />
                  ) : (
                    <Building2 className="w-4 h-4 text-[#FF8C42]" />
                  )}
                  <span className="text-sm font-medium text-gray-700">
                    {serviceStyle === 'tele' ? 'Tele Consultation' : serviceStyle === 'at_home' ? 'Home Visit' : 'Clinic Visit'}
                  </span>
                </div>
                {specialization && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-lg">
                    <Stethoscope className="w-4 h-4 text-[#FF8C42]" />
                    <span className="text-sm font-medium text-gray-700">{specialization}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-3 gap-2 mb-4 border-t border-gray-100 pt-4">
              <button 
                onClick={() => phoneNumber && window.open(`tel:${phoneNumber}`, '_self')}
                className="flex flex-col items-center justify-center gap-1.5 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
              >
                <Phone className="w-5 h-5 text-[#FF8C42] group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-gray-700">Call</span>
              </button>
              {address && serviceStyle !== 'tele' && (
                <button 
                  onClick={() => {
                    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
                  }}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
                >
                  <Navigation className="w-5 h-5 text-[#FF8C42] group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-medium text-gray-700">Directions</span>
                </button>
              )}
              <button 
                onClick={handleShare}
                className="flex flex-col items-center justify-center gap-1.5 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
              >
                <Share2 className="w-5 h-5 text-[#FF8C42] group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-gray-700">Share</span>
              </button>
            </div>

            {/* Quick Info */}
            <div className="space-y-2.5 border-t border-gray-100 pt-4">
              {address && serviceStyle !== 'tele' && (
                <div className="flex items-start gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 leading-relaxed">{address}</span>
                </div>
              )}
              {phoneNumber && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-700">{phoneNumber}</span>
                </div>
              )}
              {serviceStyle === 'tele' && (
                <div className="flex items-center gap-3 text-sm">
                  <Video className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-700">Video Consultation Available</span>
                </div>
              )}
            </div>

            {/* Amenities/Features */}
            {amenities.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Features</h3>
                <div className="flex flex-wrap gap-2">
                  {amenities.slice(0, 6).map((amenity: string, idx: number) => (
                    <span key={idx} className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-xs font-medium border border-orange-100">
                      {amenity}
                    </span>
                  ))}
                  {amenities.length > 6 && (
                    <span className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium">
                      +{amenities.length - 6} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b-2 border-gray-200 bg-white rounded-t-2xl overflow-hidden sticky top-[56px] z-40 shadow-sm">
            {['overview', 'services', 'reviews'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`flex-1 py-4 text-sm font-semibold capitalize transition-all relative ${
                  activeTab === tab
                    ? 'text-[#FF8C42]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'services' ? `Services (${profileProvider.services.length})` : tab}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF8C42]" />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-b-2xl p-5 mb-4 min-h-[400px]">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Stethoscope className="w-5 h-5 text-[#FF8C42]" />
                    About
                  </h3>
                  <p className="text-sm text-gray-700 leading-relaxed">{description}</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3 bg-gray-50 rounded-xl p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{profileProvider.services.length}</div>
                    <div className="text-xs text-gray-500 mt-1">Services</div>
                  </div>
                  <div className="text-center border-x border-gray-200">
                    <div className="text-2xl font-bold text-gray-900">
                      {profileProvider.experienceYears || '5+'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Years Experience</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {rating?.totalReviews || profileProvider.reviewCount || '10+'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Reviews</div>
                  </div>
                </div>

                {/* Qualifications */}
                {profileProvider.qualifications && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3">Qualifications</h3>
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                      <div className="flex items-start gap-3">
                        <Award className="w-5 h-5 text-blue-500 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-700 font-medium mb-1">Professional Credentials</p>
                          <p className="text-sm text-gray-600">{profileProvider.qualifications}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Full Amenities List */}
                {amenities.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3">All Features</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {amenities.map((amenity: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <span className="text-sm text-gray-700">{amenity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Get Directions CTA (only for at_home/at_center) */}
                {address && serviceStyle !== 'tele' && (
                  <button 
                    onClick={() => {
                      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
                    }}
                    className="w-full px-4 py-3.5 bg-[#FF8C42] text-white rounded-xl font-semibold hover:bg-[#E67A35] transition-colors flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
                  >
                    <Navigation className="w-5 h-5" />
                    Get Directions on Maps
                  </button>
                )}
              </div>
            )}

            {activeTab === 'services' && (
              <div className="space-y-4">
                {/* Search and Filter */}
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search vet services..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                    >
                      <option value="popular">Popular First</option>
                      <option value="price">Price: Low to High</option>
                      <option value="name">Name: A to Z</option>
                    </select>
                  </div>
                </div>

                {/* Services List - Enhanced Cards */}
                {sortedServices.length > 0 ? (
                  <div className="space-y-3">
                    {sortedServices.map((service) => {
                      const isSelected = selectedServices.has(service.id) || selectedServices.has(service.serviceId);
                      return (
                        <div
                          key={service.id}
                          onClick={() => toggleServiceSelection(service.id)}
                          className={`p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-md ${
                            isSelected
                              ? 'border-[#FF8C42] bg-gradient-to-br from-orange-50 to-orange-100 shadow-md'
                              : 'border-gray-200 hover:border-[#FF8C42]/50 bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <h4 className="font-bold text-gray-900 text-base">{service.name}</h4>
                                {isSelected && (
                                  <span className="px-2.5 py-0.5 bg-green-500 text-white rounded-full text-xs font-semibold flex items-center gap-1 flex-shrink-0">
                                    <Check className="w-3 h-3" />
                                    Selected
                                  </span>
                                )}
                              </div>
                              {service.description && (
                                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{service.description}</p>
                              )}
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span className="flex items-center gap-1.5 bg-gray-100 px-2.5 py-1 rounded-lg">
                                  <Clock className="w-3.5 h-3.5 text-gray-600" />
                                  {service.duration} mins
                                </span>
                                {service.category && (
                                  <span className="px-2.5 py-1 bg-gray-100 rounded-lg text-gray-600">{service.category}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-2xl font-bold text-[#FF8C42] mb-1">₹{service.price}</div>
                              {isSelected && (
                                <div className="mt-1 flex justify-end">
                                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                                    <Check className="w-4 h-4 text-white" />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <Stethoscope className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium mb-1">No services available</p>
                    <p className="text-sm text-gray-500">Services will be added soon</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-4">
                {/* Reviews Summary */}
                {reviews.length > 0 && rating && (
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-5 border border-amber-200 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
                          <span className="text-3xl font-bold text-gray-900">
                            {Number(rating?.averageRating || profileProvider.rating || 4.5).toFixed(1)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          Based on {rating.totalReviews || profileProvider.reviewCount || 0} reviews
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="w-10 h-10 mx-auto mb-1 bg-yellow-100 rounded-full flex items-center justify-center">
                          <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                        </div>
                        <p className="text-xs text-gray-500">Overall</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Reviews List */}
                {reviews.length > 0 ? (
                  reviews.map((review) => (
                    <div key={review.id} className="bg-gray-50 rounded-xl p-5 border border-gray-200 hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-4 mb-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-[#FF8C42] to-[#FF7029] rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-md">
                          {review.customerName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-bold text-gray-900">{review.customerName || 'Anonymous'}</h4>
                            <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                              {new Date(review.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mb-3">
                            {[...Array(5)].map((_, i) => (
                              <Star 
                                key={i} 
                                className={`w-4 h-4 ${i < review.rating ? 'fill-amber-500 text-amber-500' : 'text-gray-300'}`} 
                              />
                            ))}
                            <span className="ml-2 text-sm font-medium text-gray-700">{review.rating}/5</span>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed">{review.comment}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <Star className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium mb-1">No reviews yet</p>
                    <p className="text-sm text-gray-500">Be the first to review this provider!</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Fixed Bottom Service Selection Summary & Book Button */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg max-w-md mx-auto">
          {selectedServices.size > 0 && (
            <div className="px-4 py-3 bg-orange-50 border-b border-orange-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {selectedServices.size} service{selectedServices.size > 1 ? 's' : ''} selected
                  </p>
                  <p className="text-lg font-bold text-orange-600">₹{totalPrice}</p>
                </div>
                <button
                  onClick={() => setSelectedServices(new Set())}
                  className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
          <div className="p-4">
            <Button 
              onClick={handleBookServices}
              disabled={profileProvider.services.length === 0}
              className="w-full bg-[#FF8C42] hover:bg-[#E67A35] h-12 text-lg text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {selectedServices.size === 0 
                ? (profileProvider.services.length === 0 ? 'No Services Available' : 'Select Services to Book')
                : `Book ${selectedServices.size} Service${selectedServices.size > 1 ? 's' : ''} (₹${totalPrice})`
              }
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Listing View Mode (when vendorId not provided or multiple providers)
  return (
    <div>
      {/* Header is provided by renderScreenWithLayout wrapper (StandardizedHeader) */}
      
      {/* Info section */}
      <div className="px-6 pt-4 pb-2">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 bg-orange-100 rounded-2xl flex items-center justify-center">
            {getStyleIcon()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{serviceTypeName || 'Services'}</h1>
            <p className="text-gray-600 text-sm">
              {providers.length} provider{providers.length !== 1 ? 's' : ''} available
            </p>
          </div>
        </div>
        
        {/* Info badge for home/tele */}
        {(serviceStyle === 'at_home' || serviceStyle === 'tele') && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm mb-4">
            <div className="flex items-center gap-2 text-blue-900">
              <Shield className="w-4 h-4" />
              <span>All providers are verified and background-checked</span>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 pb-24">
        {providers.length === 0 ? (
          <Card className="p-8 text-center bg-white">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              {getStyleIcon()}
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">No Providers Available</h3>
            <p className="text-gray-500 text-sm mb-4">
              No {serviceStyle === 'at_home' ? 'home visit' : serviceStyle === 'tele' ? 'tele-consultation' : ''} providers are currently available in your area.
            </p>
            <Button 
              onClick={onBack}
              variant="outline"
            >
              Try Other Services
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {providers.map((provider) => (
              <Card key={provider.providerId} className="bg-white overflow-hidden">
                {/* Provider Header */}
                <div 
                  className="p-4 border-b cursor-pointer hover:bg-gray-50"
                  onClick={() => setSelectedProvider(
                    selectedProvider === provider.providerId ? null : provider.providerId
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {/* Provider Photo or Initial */}
                      {provider.photo ? (
                        <img 
                          src={provider.photo} 
                          alt={provider.name}
                          className="w-12 h-12 rounded-full object-cover border-2 border-[#FF8C42]"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-[#FF8C42] rounded-full flex items-center justify-center text-white font-bold text-lg">
                          {provider.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                          {provider.isVerified && (
                            <Shield className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                        <p className="text-gray-500 text-sm">{getProviderTypeLabel(provider)}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <span className="text-sm font-medium">{provider.rating}</span>
                            <span className="text-gray-400 text-sm">({provider.reviewCount})</span>
                          </div>
                          {provider.city && (
                            <div className="flex items-center gap-1 text-gray-500 text-sm">
                              <MapPin className="w-3 h-3" />
                              {provider.city}
                            </div>
                          )}
                          {provider.distance !== null && provider.distance !== undefined && (
                            <span className="text-xs text-blue-600 font-medium">
                              {provider.distance} km away
                            </span>
                          )}
                        </div>
                        {/* Show experience for staff/individual */}
                        {provider.experienceYears && provider.providerType !== 'vendor' && (
                          <div className="text-xs text-gray-500 mt-1">
                            {provider.experienceYears} years experience
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${
                      selectedProvider === provider.providerId ? 'rotate-90' : ''
                    }`} />
                  </div>
                </div>

                {/* Services List - Expanded */}
                {selectedProvider === provider.providerId && (
                  <div className="bg-gray-50 p-4 space-y-3">
                    {/* Provider details for staff/individual */}
                    {provider.qualifications && (
                      <div className="bg-white rounded-lg p-3 mb-3 border border-blue-100">
                        <div className="text-xs text-gray-500 mb-1">Qualifications</div>
                        <div className="text-sm text-gray-700">{provider.qualifications}</div>
                      </div>
                    )}
                    
                    <h4 className="text-sm font-medium text-gray-600 mb-2">
                      Available Services ({provider.services.length})
                    </h4>
                    {provider.services.map((service) => (
                      <div 
                        key={service.id}
                        className="bg-white rounded-lg p-4 shadow-sm border border-gray-100"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h5 className="font-medium text-gray-900">{service.name}</h5>
                            {service.description && (
                              <p className="text-gray-500 text-sm mt-1 line-clamp-2">
                                {service.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              <Badge variant="outline" className="text-xs">
                                <Clock className="w-3 h-3 mr-1" />
                                {service.duration} mins
                              </Badge>
                              {service.category && (
                                <Badge variant="secondary" className="text-xs">
                                  {service.category}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <div className="text-lg font-bold text-gray-900">
                              ₹{service.price}
                            </div>
                            <Button
                              size="sm"
                              className="mt-2 bg-[#FF8C42] hover:bg-[#E67A35] text-white"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectService(provider, service);
                              }}
                            >
                              Book Now
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick Book - when not expanded */}
                {selectedProvider !== provider.providerId && provider.services.length > 0 && (
                  <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      {provider.services.length} service{provider.services.length !== 1 ? 's' : ''} available
                      {provider.services[0] && (
                        <span className="text-gray-900 font-medium"> from ₹{
                          Math.min(...provider.services.map(s => s.price))
                        }</span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[#FF8C42] border-[#FF8C42] hover:bg-[#FF8C42]/10"
                      onClick={() => setSelectedProvider(provider.providerId)}
                    >
                      View Services
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
