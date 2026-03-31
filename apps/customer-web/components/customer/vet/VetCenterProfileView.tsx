'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Star, Heart, Share2, MapPin, Phone, Clock, Navigation, Award, CheckCircle2, Stethoscope, Calendar, TrendingUp, Sparkles } from 'lucide-react';
import { AmenitiesSection } from '../shared/AmenitiesSection';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';
import { formatOperatingHours } from '@/lib/format-utils';

interface VetCenterProfileViewProps {
  phone: string;
  centerId: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

interface ServiceData {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  popular?: boolean;
  categoryName: string;
  subCategoryName: string;
  serviceStyle: string;
}

interface ReviewData {
  id: string;
  customerName: string;
  rating: number;
  comment: string;
  date: string;
  serviceType?: string;
}

export function VetCenterProfileView({ phone, centerId, onBack, onNavigate }: VetCenterProfileViewProps) {
  const [loading, setLoading] = useState(true);
  const [center, setCenter] = useState<any>(null);
  const [facility, setFacility] = useState<any>(null);
  const [services, setServices] = useState<ServiceData[]>([]);
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [rating, setRating] = useState<any>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'amenities' | 'services' | 'reviews'>('overview');

  useEffect(() => {
    loadCenterData();
  }, [centerId]);

  const loadCenterData = async () => {
    try {
      setLoading(true);
      
      const [facilityRes, servicesRes] = await Promise.all([
        apiClient.get<any>(`/customer/facility/${centerId}`),
        apiClient.get<any>(`/customer/clinic/${centerId}/services`)
      ]);

      if (facilityRes.success) {
        setCenter(facilityRes.vendor);
        setFacility(facilityRes.facility);
        setRating(facilityRes.rating);
        setReviews(facilityRes.recentReviews || []);
      }

      if (servicesRes.success && servicesRes.services) {
        const clinicServices = servicesRes.services
          .filter((service: any) => service.serviceStyle === 'at_center')
          .map((service: any) => ({
            id: service.id || service.serviceId,
            name: service.serviceName || service.name || 'Unnamed Service',
            description: service.description || '',
            price: service.price || 0,
            duration: service.duration || 30,
            popular: service.isPopular || false,
            categoryName: service.categoryName,
            subCategoryName: service.subCategoryName,
            serviceStyle: service.serviceStyle
          }));
        setServices(clinicServices);
      } else if (servicesRes && !servicesRes.success) {
        // ✅ Handle gracefully - services not loading is fine, just set empty array
        console.log('Clinic services not available or not loaded yet');
        setServices([]);
      }
    } catch (error) {
      // ✅ Handle gracefully - services not loading is fine, just set empty array
      console.log('Clinic services not available:', error);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: center?.businessName || 'Vet Clinic',
          text: `Check out ${center?.businessName || 'this vet clinic'} on Warmpawz`,
          url: window.location.href
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-customer mx-auto">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading clinic...</p>
        </div>
      </div>
    );
  }

  if (!center || !facility) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-customer mx-auto">
        <div className="text-center">
          <p className="text-gray-600">Vet clinic not found</p>
          <button onClick={onBack} className="mt-4 px-4 py-0 bg-primary text-white rounded-lg">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const centerName = center.businessName || center.fullName;
  const photos = facility.photos || [];
  const hasPhotos = photos.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-customer mx-auto bg-white min-h-screen pb-20">
        {/* Photo Gallery */}
        <div className="relative">
          {hasPhotos ? (
            <div className="relative h-64 bg-gray-200">
              <img src={photos[selectedPhotoIndex]} alt={centerName} className="w-full h-full object-cover" />
              <div className="absolute bottom-0 right-3 bg-black/70 backdrop-blur-sm text-white px-0 py-0 rounded-full text-sm">
                {selectedPhotoIndex + 1} / {photos.length}
              </div>
            </div>
          ) : (
            <div className="h-64 bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center">
              <Stethoscope className="w-20 h-20 text-white/30" />
            </div>
          )}

          <button
            onClick={onBack}
            className="absolute top-4 left-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>

          <div className="absolute top-4 right-4 flex gap-3">
            <button
              onClick={() => setIsFavorite(!isFavorite)}
              className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg"
            >
              <Heart className={`w-5 h-5 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-700'}`} />
            </button>
            <button
              onClick={handleShare}
              className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg"
            >
              <Share2 className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>

        {/* Clinic Info Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-start justify-between mb-0">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-0">{centerName}</h1>
              <p className="text-sm text-gray-600 mb-0">{facility.address || center.address}</p>
              
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-3">
                  <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
                  <span className="font-semibold text-lg">{rating?.averageRating?.toFixed(1) || '4.5'}</span>
                  <span className="text-sm text-gray-500">({rating?.totalReviews || 0} reviews)</span>
                </div>
                {facility.isPremium && (
                  <span className="px-0 py-0 bg-amber-100 text-amber-700 rounded-full text-xs flex items-center gap-3">
                    <Award className="w-3 h-3" />
                    Premium
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="text-center py-0 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold text-gray-900">{services.length}+</div>
              <div className="text-xs text-gray-500">Services</div>
            </div>
            <div className="text-center py-0 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold text-gray-900">{facility.vets || 2}+</div>
              <div className="text-xs text-gray-500">Vets</div>
            </div>
            <div className="text-center py-0 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold text-gray-900">24/7</div>
              <div className="text-xs text-gray-500">Emergency</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10">
          {['overview', 'amenities', 'services', 'reviews'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-gray-500'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-4">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-0">About</h3>
                <p className="text-sm text-gray-600">
                  {facility.description || `${centerName} is a professional veterinary clinic offering comprehensive pet healthcare services.`}
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-0">Features</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Stethoscope, label: 'Advanced Equipment' },
                    { icon: CheckCircle2, label: 'Certified Vets' },
                    { icon: Heart, label: 'Emergency Care' },
                    { icon: Clock, label: 'Quick Service' }
                  ].map((feature, index) => (
                    <div key={index} className="flex items-center gap-3 p-0 bg-gray-50 rounded-lg">
                      <feature.icon className="w-5 h-5 text-primary" />
                      <span className="text-sm text-gray-700">{feature.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-0">Contact Information</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-700">{facility.address || center.address}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Clock className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-700">{facility.operatingHours ? formatOperatingHours(facility.operatingHours) : 'Mon-Sat: 9AM-7PM, 24/7 Emergency'}</span>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => {
                  if (facility?.latitude && facility?.longitude) {
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${facility.latitude},${facility.longitude}`;
                    window.open(url, '_blank');
                  } else if (facility?.address || center?.address) {
                    const address = facility?.address || center?.address;
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
                    window.open(url, '_blank');
                  } else {
                    alert('Location not available');
                  }
                }}
                className="w-full px-4 py-3 border-2 border-primary text-primary rounded-lg font-semibold hover:bg-orange-50 transition-colors flex items-center justify-center gap-3"
              >
                <Navigation className="w-4 h-4" />
                Get Directions
              </button>
              
              {/* Call Button */}
              <button
                onClick={() => {
                  const phoneNumber = center?.phone || facility?.phone;
                  if (phoneNumber) {
                    window.location.href = `tel:${phoneNumber}`;
                  } else {
                    alert('Phone number not available');
                  }
                }}
                className="w-full px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-3"
              >
                <Phone className="w-4 h-4" />
                Call Now
              </button>
            </div>
          )}

          {activeTab === 'amenities' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-gray-900">Facilities & Amenities</h3>
              </div>
              <AmenitiesSection
                amenities={facility?.amenities || []}
                customAmenities={facility?.customAmenities || []}
                showCategories={true}
              />
            </div>
          )}

          {activeTab === 'services' && (
            <div className="space-y-3">
              {services.length > 0 ? (
                services.map((service) => (
                  <div key={service.id} className="bg-white p-4 rounded-xl border border-gray-200">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-0">
                          <h4 className="font-semibold text-gray-900">{service.name}</h4>
                          {service.popular && (
                            <span className="px-0 py-0 bg-orange-100 text-orange-700 rounded-full text-xs flex items-center gap-3">
                              <TrendingUp className="w-3 h-3" />
                              Popular
                            </span>
                          )}
                        </div>
                        {service.description && (
                          <p className="text-sm text-gray-600 mb-0">{service.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-3">
                            <Clock className="w-3.5 h-3.5" />
                            {service.duration} mins
                          </span>
                        </div>
                      </div>
                      <div className="text-lg font-bold text-primary">₹{service.price}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-02">
                  <Stethoscope className="w-12 h-12 text-gray-300 mx-auto mb-0" />
                  <p className="text-gray-500">Services will be available soon</p>
                  <p className="text-xs text-gray-400 mt-1">Please check back later or contact the clinic directly</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-4">
              {reviews.length > 0 ? (
                reviews.map((review) => (
                  <div key={review.id} className="bg-white p-4 rounded-xl border border-gray-200">
                    <div className="flex items-start gap-3 mb-0">
                      <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-dark rounded-full flex items-center justify-center text-white font-semibold">
                        {review.customerName.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-0">
                          <h4 className="font-semibold text-gray-900">{review.customerName}</h4>
                          <span className="text-xs text-gray-500">{new Date(review.date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-3 mb-0">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'fill-amber-500 text-amber-500' : 'text-gray-300'}`} />
                          ))}
                        </div>
                        <p className="text-sm text-gray-600">{review.comment}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <Star className="w-12 h-12 text-gray-300 mx-auto mb-0" />
                  <p className="text-gray-500">No reviews yet</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fixed Bottom CTA */}
        <div className="fixed bottom-0 left-0 right-0 max-w-customer mx-auto bg-white border-t border-gray-200 p-4">
          <button
            onClick={() => onNavigate('select_service', { centerId })}
            className="w-full py-1 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors flex items-center justify-center gap-3"
            disabled={services.length === 0}
          >
            <Calendar className="w-5 h-5" />
            {services.length === 0 ? 'No Services Available' : 'Book Appointment'}
          </button>
        </div>
      </div>
    </div>
  );
}

