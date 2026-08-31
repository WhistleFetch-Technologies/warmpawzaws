"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Star, Clock, MapPin, Phone, Globe, Calendar, Users, Image as ImageIcon, ChevronRight, CheckCircle2, Building2, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { mergeCustomerVendorServicesPayload } from '@/lib/customer-vendor-services-merge';
import { resolveCustomerVendorAmenities, resolveVendorProfileHeroGallery } from '@/lib/vendor-display-media';
import { AmenitiesSection } from '../shared/AmenitiesSection';
import { VendorHeroPhotoCarousel } from '../shared/VendorHeroPhotoCarousel';
import { formatAverageForDisplay } from '@/lib/rating-display';
import { INDICATIVE_PRICING_NOTE } from '@/lib/pricing-disclaimer';
import {
  buildWalkerServiceDataForVendorPackagePurchase,
  isVendorServicePackageRow,
} from '@/lib/vendor-package-purchase-nav';
import { VendorProfileDashboardHeader } from '../shared/VendorProfileDashboardHeader';
import { StandardizedFooter } from '../shared/StandardizedFooter';
import { VendorServicePromotions } from '../services/VendorServicePromotions';
import { requestGuestAuthForProfileContinue } from '@/lib/guest-auth-gate';

interface ClinicProfileViewProps {
  phone: string;
  clinicId: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

interface ClinicInfo {
  id: string;
  name: string;
  description: string;
  address: string;
  city: string;
  pincode: string;
  phone: string;
  email?: string;
  website?: string;
  rating: number;
  review_count: number;
  timing: string;
  services: {
    selectionKey: string;
    id: string;
    serviceId?: string;
    vendorServiceId?: string | number;
    name: string;
    price: number;
    duration?: number;
  }[];
  doctors: { id: string; name: string; specialization: string; rating: number }[];
  photos: string[];
  amenities: string[];
  customAmenities: string[];
}

export function ClinicProfileView({ phone, clinicId, onBack, onNavigate }: ClinicProfileViewProps) {
  const [loading, setLoading] = useState(true);
  const [clinic, setClinic] = useState<ClinicInfo | null>(null);
  const [selectedService, setSelectedService] = useState<{
    selectionKey: string;
    id: string;
    name: string;
    price: number;
    duration?: number;
    serviceId?: string;
  } | null>(null);
  
  // User profile data for header
  const [userName, setUserName] = useState('User');
  const [userProfilePhoto, setUserProfilePhoto] = useState<string | undefined>(undefined);
  
  useEffect(() => {
    loadUserProfile();
  }, [phone]);
  
  const loadUserProfile = async () => {
    try {
      const profileResponse = await apiClient.get(`/customer/profile?phone=${encodeURIComponent(phone)}`) as any;
      if (profileResponse?.profile || profileResponse) {
        const profile = profileResponse.profile || profileResponse;
        setUserName(profile.name || profile.fullName || 'User');
        setUserProfilePhoto(profile.profilePhoto || profile.profile_image_url || profile.photo);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  useEffect(() => {
    loadClinicData();
  }, [clinicId]);

  const loadClinicData = async () => {
    try {
      setLoading(true);
      
      // ✅ CRITICAL: Load vendor profile from real API - NO MOCK DATA, NO FALLBACKS
      // ✅ FIX: Include serviceStyle=at_center for clinic profile (clinics offer at_center services)
      const [vendorResponse, servicesResponse, facilityResponse] = await Promise.all([
        apiClient.get(`/customer/vendor/${clinicId}`),
        apiClient.get(`/customer/vendor/${clinicId}/services?serviceStyle=at_center`).catch(() => apiClient.get(`/vendor/${clinicId}/services`)),
        apiClient.get(`/customer/facility/${clinicId}`).catch(() => null),
      ]);
      
      const vendorData = (vendorResponse as any)?.vendor || vendorResponse as any;
      const facilityData =
        facilityResponse && typeof facilityResponse === 'object' && (facilityResponse as any).facility
          ? (facilityResponse as any).facility
          : {};
      const { amenities, customAmenities } = resolveCustomerVendorAmenities({
        ...facilityData,
        ...vendorData,
      });
      
      // Extract services (customer endpoint returns { success, services: [...] }; vendor may return nested by style)
      let services: any[] = [];
      const servicesData = servicesResponse as any;
      if (servicesData?.services && Array.isArray(servicesData.services)) {
        services = mergeCustomerVendorServicesPayload(servicesData);
      } else if (servicesData?.services?.at_home || servicesData?.services?.at_center || servicesData?.services?.tele) {
        services = [
          ...(servicesData.services.at_home?.services || []),
          ...(servicesData.services.at_center?.services || []),
          ...(servicesData.services.tele?.services || [])
        ];
      } else if (servicesData?.allServices) {
        services = servicesData.allServices;
      } else if (Array.isArray(servicesData?.services)) {
        services = servicesData.services;
      } else if (Array.isArray(servicesData)) {
        services = servicesData;
      }
      
      const mappedServices = services.map((s: any, idx: number) => {
        const catalogId = s.serviceId || s.service_id;
        const vendorServiceId = s.id;
        const selectionKey = String(
          catalogId || (vendorServiceId != null ? `vs-${vendorServiceId}` : `row-${idx}`)
        );
        return {
          selectionKey,
          id: catalogId || selectionKey,
          serviceId: catalogId,
          vendorServiceId,
          name: s.serviceName || s.name || s.service_name,
          price: parseFloat(s.price || '0'),
          duration: s.duration || s.duration_minutes || 30,
          category: s.category ?? s.categoryName,
          categoryName: s.categoryName ?? s.category,
          catalogCategoryId: s.catalogCategoryId ?? s.catalog_category_id,
          catalogServiceSlug: s.catalogServiceId ?? s.catalog_service_id,
          isPackage: !!(s.isPackage ?? s.metadata?.isPackage),
          packageDetails: s.packageDetails,
          metadata: s.metadata,
        };
      });
      
      console.log('✅ Loaded clinic data:', {
        vendorId: vendorData.id || clinicId,
        servicesCount: mappedServices.length,
        services: mappedServices
      });
      
      setClinic({
        id: vendorData.id || clinicId,
        name: vendorData.business_name || vendorData.name || 'Veterinary Clinic',
        description: vendorData.description || '',
        address: vendorData.address || '',
        city: vendorData.city || '',
        pincode: vendorData.pincode || '',
        phone: vendorData.phone || '',
        email: vendorData.email,
        website: vendorData.website,
        rating: parseFloat(vendorData.rating || '0'),
        review_count: parseInt(vendorData.review_count || '0', 10),
        timing: vendorData.timing || vendorData.businessHours || '9:00 AM - 8:00 PM',
        services: mappedServices, // ✅ Real services with UUID
        doctors: vendorData.doctors || vendorData.staff || [],
        photos: resolveVendorProfileHeroGallery({
          facility: facilityData,
          vendor: vendorData,
        }),
        amenities,
        customAmenities,
      });
    } catch (error) {
      console.error('❌ Error loading clinic data:', error);
      setClinic(null);
    } finally {
      setLoading(false);
    }
  };

  const handleBookAppointment = () => {
    if (!selectedService) {
      // If no service selected, show error or select first service
      if (clinic?.services && clinic.services.length > 0) {
        setSelectedService(clinic.services[0]);
        return;
      }
      return;
    }

    const svc = selectedService as any;
    const vid = clinic?.id;
    if (
      requestGuestAuthForProfileContinue({
        persona: 'vet',
        category: 'vet',
        vendorId: String(vid || ''),
        resumeScreen: 'vet-booking',
        wapptMode: false,
      })
    ) {
      return;
    }
    if (vid && isVendorServicePackageRow(svc)) {
      const nav = buildWalkerServiceDataForVendorPackagePurchase({
        vendorId: String(vid),
        vendorName: clinic?.name,
        serviceRow: svc as Record<string, unknown>,
        serviceTypeCategory: 'vet',
        serviceStyle: 'at_center',
      });
      if (nav) {
        onNavigate('purchase-package', nav);
        return;
      }
    }

    const serviceId = svc.serviceId || selectedService.id || selectedService.selectionKey;

    onNavigate('appointment', {
      clinicId: clinic?.id,
      vendorId: clinic?.id,
      vendorName: clinic?.name,
      service: selectedService,
      serviceId,
      serviceName: selectedService.name,
      price: selectedService.price,
      duration: selectedService.duration || 20,
      serviceStyle: 'at_center',
      serviceType: 'at_center',
      clinic,
    });
  };

  const handleViewDoctor = (doctorId: string) => {
    onNavigate('doctor-details', { doctorId });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto text-center py-12">
          <p className="text-gray-600">Clinic not found</p>
          <Button onClick={onBack} className="mt-4">Go Back</Button>
        </div>
      </div>
    );
  }

  const clinicHeaderSubtitle = clinic.city?.trim()
    ? `Veterinary care · ${clinic.city.trim()}`
    : 'Veterinary care services';

  return (
    <div className="mx-auto flex min-h-screen min-h-[100dvh] w-full max-w-customer flex-col bg-gray-50">
      {/* ✅ FIX: Use ServiceDashboardHeader for consistent Frame UI */}
      <VendorProfileDashboardHeader
        fullWidth
        serviceName="Veterinary Clinic"
        serviceSubtitle={clinicHeaderSubtitle}
        serviceIcon={Building2}
        iconColor="text-white"
        onBack={onBack}
        showBackButton={true}
        sheetToneClass="bg-white"
      />

      {/* Unified body panel — matches Pet Boarding pattern (one continuous white surface, no gray gaps) */}
      <div className="flex-1 -mt-4 rounded-t-[1.75rem] bg-white px-4 pt-6 pb-40 sm:rounded-t-[2rem]">
        <VendorServicePromotions vendorId={clinic.id} vendorName={clinic.name} className="mb-4" />
        {clinic.photos.length > 0 && (
          <div className="mb-4 overflow-hidden rounded-2xl bg-gray-200">
            <VendorHeroPhotoCarousel
              photos={clinic.photos}
              name={clinic.name}
              frameClassName="relative aspect-[5/4] w-full max-h-[420px] overflow-hidden sm:aspect-auto sm:h-[280px] sm:max-h-none"
            />
          </div>
        )}
        {/* Clinic Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-orange-100 flex items-center justify-center text-2xl">
              🏥
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">{clinic.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span className="font-semibold">{clinic.rating}</span>
                <span className="text-gray-500 text-sm">({clinic.review_count} reviews)</span>
              </div>
            </div>
          </div>

          <p className="text-gray-600 mt-4 text-sm">{clinic.description}</p>

          {/* Quick Info */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">{clinic.address}, {clinic.city} - {clinic.pincode}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">{clinic.timing}</span>
            </div>
          </div>

          {/* Amenities */}
          {(clinic.amenities.length > 0 || clinic.customAmenities.length > 0) && (
            <div className="mt-4">
              <AmenitiesSection
                amenities={clinic.amenities}
                customAmenities={clinic.customAmenities}
                compact
              />
            </div>
          )}
        </div>

        {/* Doctors Section */}
        <div className="bg-white rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900">Our Doctors</h2>
            <span className="text-sm text-gray-500">{clinic.doctors.length} doctors</span>
          </div>
          <div className="space-y-3">
            {clinic.doctors.map((doctor) => (
              <button
                key={doctor.id}
                onClick={() => handleViewDoctor(doctor.id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-xl">
                  {doctor.name.charAt(0)}
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-semibold text-gray-900">{doctor.name}</h3>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  <span className="text-sm font-medium">{doctor.rating}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            ))}
          </div>
        </div>

        {/* Services Section — scrollable list, stable keys, two-column row */}
        <div className="bg-white rounded-xl p-4 mb-4">
          <h2 className="font-bold text-gray-900 mb-3">Services & Prices</h2>
          <div className="max-h-[min(55vh,24rem)] overflow-y-auto space-y-2 pr-1 -mr-1">
            {clinic.services.map((service) => {
              const isSel = selectedService?.selectionKey === service.selectionKey;
              return (
                <button
                  key={service.selectionKey}
                  type="button"
                  onClick={() => setSelectedService(service)}
                  className={`w-full text-left rounded-xl border-2 transition-all px-4 py-3 ${
                    isSel
                      ? 'border-orange-600 bg-orange-50'
                      : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/50'
                  }`}
                >
                  <div className="flex w-full min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className={`font-medium block break-words ${isSel ? 'text-orange-900' : 'text-gray-700'}`}>
                        {service.name}
                      </span>
                    </div>
                    <div className="ml-2 flex shrink-0 flex-col items-end gap-2">
                      <span className={`block font-semibold tabular-nums whitespace-nowrap ${isSel ? 'text-orange-600' : 'text-gray-900'}`}>
                        ₹{service.price}
                      </span>
                      {isSel && <CheckCircle2 className="w-5 h-5 text-orange-600" aria-hidden />}
                    </div>
                  </div>
                  <p className="mt-1 text-right text-[11px] leading-4 font-normal text-gray-500 break-words">{INDICATIVE_PRICING_NOTE}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 mb-20">
          <button 
            onClick={() => {
              if (clinic?.phone) {
                window.location.href = `tel:${clinic.phone}`;
              } else {
                alert('Phone number not available');
              }
            }}
            className="flex items-center justify-center gap-2 p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow"
          >
            <Phone className="w-5 h-5 text-orange-500" />
            <span className="font-medium text-gray-700">Call</span>
          </button>
          <button 
            onClick={() => {
              if (clinic?.address) {
                const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(clinic.address + ', ' + clinic.city)}`;
                window.open(url, '_blank');
              } else {
                alert('Location not available');
              }
            }}
            className="flex items-center justify-center gap-2 p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow"
          >
            <MapPin className="w-5 h-5 text-orange-500" />
            <span className="font-medium text-gray-700">Directions</span>
          </button>
        </div>
      </div>

      {/* Book Appointment Button - Fixed above footer */}
      <div className="fixed left-0 right-0 cw-fixed-above-customer-tabbar bg-white border-t px-5 py-3 sm:px-6 z-40">
        <div className="mx-auto w-full max-w-xs sm:max-w-sm">
        <Button 
          onClick={handleBookAppointment}
          disabled={!selectedService}
          className="w-full whitespace-normal text-center rounded-full bg-orange-500 hover:bg-orange-600 min-h-12 px-3 py-2.5 text-sm font-semibold shadow-md disabled:bg-gray-300 disabled:cursor-not-allowed sm:h-12 sm:px-4 sm:text-base sm:py-0"
        >
          {selectedService ? `Book ${selectedService.name}` : 'Select a Service'}
        </Button>
        </div>
      </div>

      {/* Standardized Footer */}
      <StandardizedFooter
        currentTab="bookings"
        onTabChange={(tab) => {
          if (tab === 'home') onNavigate('home');
          else if (tab === 'bookings') onNavigate('my-bookings');
          else if (tab === 'shop') onNavigate('shop');
          else if (tab === 'profile') onNavigate('profile');
        }}
        maxWidth="max-w-customer"
      />
    </div>
  );
}
