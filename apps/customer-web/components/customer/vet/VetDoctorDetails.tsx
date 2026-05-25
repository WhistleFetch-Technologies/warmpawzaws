"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Star, Clock, MapPin, Phone, Video, Home, Building2, Calendar, Award, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { mergeCustomerVendorServicesPayload } from '@/lib/customer-vendor-services-merge';
import { INDICATIVE_PRICING_NOTE } from '@/lib/pricing-disclaimer';
import {
  buildWalkerServiceDataForVendorPackagePurchase,
  isVendorServicePackageRow,
} from '@/lib/vendor-package-purchase-nav';

interface VetDoctorDetailsProps {
  phone: string;
  doctorId: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

interface DoctorInfo {
  id: string;
  name: string;
  specialization: string;
  qualification: string;
  experience_years: number;
  rating: number;
  review_count: number;
  languages: string[];
  services: { id: string; serviceId?: string; service_id?: string; name: string; price: number; duration: number; service_style: string }[];
  clinic_name?: string;
  clinic_address?: string;
  available_slots?: { date: string; slots: string[] }[];
  photo_url?: string;
  is_verified?: boolean;
}

export function VetDoctorDetails({ phone, doctorId, onBack, onNavigate }: VetDoctorDetailsProps) {
  const [loading, setLoading] = useState(true);
  const [doctor, setDoctor] = useState<DoctorInfo | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<string>('');

  useEffect(() => {
    loadDoctorDetails();
  }, [doctorId]);

  const loadDoctorDetails = async () => {
    try {
      setLoading(true);
      
      // ✅ CRITICAL: Load vendor profile and services from real API - NO MOCK DATA, NO FALLBACKS
      const [vendorResponse, servicesResponse] = await Promise.all([
        apiClient.get(`/customer/vendor/${doctorId}`),
        apiClient.get(`/customer/vendor/${doctorId}/services`).catch(() => apiClient.get(`/vendor/${doctorId}/services`))
      ]);
      
      const vendorData = (vendorResponse as any)?.vendor || vendorResponse as any;
      
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
      
      // id = vendor_services row (matches discovery API); serviceId = catalog/service UUID
      const mappedServices = services.map((s: any) => ({
        id: s.id,
        serviceId: s.serviceId || s.service_id,
        vendorServiceId: s.id,
        name: s.serviceName || s.name || s.service_name,
        price: parseFloat(s.price || '0'),
        duration: s.duration || s.duration_minutes || 30,
        service_style: s.serviceStyle || s.service_style || 'at_center',
        isPackage: !!(s.isPackage ?? s.metadata?.isPackage),
        packageDetails: s.packageDetails,
        metadata: s.metadata,
      }));
      
      console.log('✅ Loaded doctor details:', {
        doctorId: vendorData.id || doctorId,
        servicesCount: mappedServices.length,
        services: mappedServices
      });
      
      setDoctor({
        id: vendorData.id || doctorId,
        name: vendorData.business_name || vendorData.name || 'Veterinarian',
        specialization: vendorData.specialization || 'General Veterinarian',
        qualification: vendorData.qualification || '',
        experience_years: parseInt(vendorData.experience_years || '0', 10),
        rating: parseFloat(vendorData.rating || '0'),
        review_count: parseInt(vendorData.review_count || '0', 10),
        languages: vendorData.languages || ['English', 'Hindi'],
        services: mappedServices, // ✅ Real services with UUID
        clinic_name: vendorData.clinic_name,
        clinic_address: vendorData.address,
        photo_url: vendorData.photo_url || vendorData.photo,
        is_verified: vendorData.is_verified || false,
      });
    } catch (error) {
      console.error('❌ Error loading doctor details:', error);
      setDoctor(null);
    } finally {
      setLoading(false);
    }
  };

  const handleBookService = (serviceId: string, serviceStyle: string) => {
    const service = doctor?.services?.find(
      (s: any) =>
        s.id === serviceId ||
        s.serviceId === serviceId ||
        s.vendorServiceId === serviceId ||
        (s.serviceId || s.service_id) === serviceId
    );
    const serviceObj = service as any;
    if (!serviceObj || !doctor?.id) return;

    if (isVendorServicePackageRow(serviceObj)) {
      const nav = buildWalkerServiceDataForVendorPackagePurchase({
        vendorId: String(doctor.id),
        vendorName: doctor.name,
        serviceRow: serviceObj as Record<string, unknown>,
        serviceTypeCategory: 'vet',
        serviceStyle,
      });
      if (nav) {
        onNavigate('purchase-package', nav);
        return;
      }
    }

    const finalServiceId = serviceObj?.serviceId || serviceObj?.service_id || serviceId;

    onNavigate('vet-booking', {
      doctorId: doctor?.id,
      doctor: doctor,
      service: serviceObj,
      serviceId: finalServiceId,
      serviceType: serviceStyle,
      serviceStyle: serviceStyle,
      serviceName: service?.name,
      price: service?.price,
      duration: service?.duration,
    });
  };

  const getServiceIcon = (style: string) => {
    switch (style) {
      case 'tele': return <Video className="w-5 h-5" />;
      case 'at_home': return <Home className="w-5 h-5" />;
      case 'at_center': return <Building2 className="w-5 h-5" />;
      default: return <Calendar className="w-5 h-5" />;
    }
  };

  const getServiceLabel = (style: string) => {
    switch (style) {
      case 'tele': return '24/7 Available';
      case 'at_home': return 'Home Service';
      case 'at_center': return 'Visit Clinic';
      default: return 'Book Now';
    }
  };

  const headerTopPad = 'pt-[max(0.75rem,env(safe-area-inset-top,0px))]';
  const mainTopPad =
    'pt-[calc(3.5rem+max(0.75rem,env(safe-area-inset-top,0px)))]';

  if (loading) {
    return (
      <div className="relative min-h-[100dvh] w-full max-w-customer mx-auto bg-gray-50">
        <header
          className={`fixed inset-x-0 top-0 z-50 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur-md ${headerTopPad}`}
        >
          <div className="mx-auto flex h-14 max-w-customer items-center gap-2 px-3 sm:px-4">
            <button
              type="button"
              onClick={onBack}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-900 transition-colors hover:bg-gray-100 active:bg-gray-200"
              aria-label="Go back"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-gray-900">
                Veterinarian
              </p>
              <p className="truncate text-xs text-gray-500">Loading…</p>
            </div>
          </div>
        </header>
        <div
          className={`flex min-h-[100dvh] items-center justify-center ${mainTopPad}`}
        >
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-orange-500" />
        </div>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="relative min-h-[100dvh] w-full max-w-customer mx-auto bg-gray-50">
        <header
          className={`fixed inset-x-0 top-0 z-50 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur-md ${headerTopPad}`}
        >
          <div className="mx-auto flex h-14 max-w-customer items-center gap-2 px-3 sm:px-4">
            <button
              type="button"
              onClick={onBack}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-900 transition-colors hover:bg-gray-100 active:bg-gray-200"
              aria-label="Go back"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-gray-900">
                Veterinarian
              </p>
              <p className="truncate text-xs text-gray-500">Profile</p>
            </div>
          </div>
        </header>
        <div className={`px-4 ${mainTopPad} pb-24`}>
          <div className="py-12 text-center">
            <p className="text-gray-600">Doctor not found</p>
            <Button onClick={onBack} className="mt-4 bg-[#FF8C42] hover:bg-[#E67A35]">
              Go back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] w-full max-w-customer mx-auto bg-gray-50">
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur-md ${headerTopPad}`}
      >
        <div className="mx-auto flex h-14 max-w-customer items-center gap-2 px-3 sm:px-4">
          <button
            type="button"
            onClick={onBack}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-900 transition-colors hover:bg-gray-100 active:bg-gray-200"
            aria-label="Go back"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-gray-900">
              {doctor.name}
            </p>
            <p className="truncate text-xs text-gray-500">
              Book a consultation
            </p>
          </div>
        </div>
      </header>

      <main className={`px-4 pb-24 ${mainTopPad}`}>
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          {/* Profile Section */}
          <div className="p-6">
            <div className="flex gap-4">
              {/* Avatar */}
              {doctor.photo_url ? (
                <img 
                  src={doctor.photo_url} 
                  alt={doctor.name} 
                  className="w-20 h-20 rounded-xl object-cover border-2 border-[#FF8C42] flex-shrink-0"
                />
              ) : (
                <div className="w-20 h-20 bg-[#FF8C42] rounded-xl flex items-center justify-center text-white font-bold text-3xl flex-shrink-0">
                  {doctor.name.charAt(0)}
                </div>
              )}
              
              {/* Info */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900">{doctor.name}</h1>
                  {doctor.is_verified && (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  )}
                </div>
                {doctor.qualification && (
                  <p className="text-sm text-gray-500">{doctor.qualification}</p>
                )}
                
                {/* Stats Row */}
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span className="font-semibold text-gray-900">{doctor.rating}</span>
                    <span className="text-gray-500 text-sm">({doctor.review_count})</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-500 text-sm">
                    <Award className="w-4 h-4" />
                    <span>{doctor.experience_years}+ years</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Languages */}
            <div className="mt-4 flex flex-wrap gap-2">
              {doctor.languages.map((lang, idx) => (
                <span key={idx} className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-600">
                  {lang}
                </span>
              ))}
            </div>
          </div>

          {/* Clinic Info */}
          {doctor.clinic_name && (
            <div className="px-6 pb-4">
              <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-[#FF8C42] mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900">{doctor.clinic_name}</p>
                    <p className="text-sm text-gray-600">{doctor.clinic_address}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Services Section */}
        <div className="mt-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Book a Consultation</h2>
          <div className="space-y-3">
            {doctor.services.map((service) => (
              <div
                key={service.id}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:border-orange-200 transition-colors"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center ${
                      service.service_style === 'tele' ? 'bg-blue-100 text-blue-600' :
                      service.service_style === 'at_home' ? 'bg-green-100 text-green-600' :
                      'bg-orange-100 text-orange-600'
                    }`}>
                      {getServiceIcon(service.service_style)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-900 leading-snug flex flex-wrap items-center gap-2">
                        {service.name}
                        {(service as any).isPackage && (
                          <span className="rounded-full border border-purple-200 bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
                            Package
                          </span>
                        )}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          {service.duration} mins
                        </span>
                        <span className="text-[#FF8C42] text-xs px-2 py-0.5 bg-orange-50 rounded-full font-medium">
                          {getServiceLabel(service.service_style)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-100 pt-3 sm:border-t-0 sm:pt-0 sm:flex-col sm:items-end sm:justify-center">
                    <div className="text-right">
                      <p className="font-bold text-lg text-gray-900">₹{service.price}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{INDICATIVE_PRICING_NOTE}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleBookService(service.id, service.service_style)}
                      className="bg-[#FF8C42] hover:bg-[#E67A35] text-white"
                    >
                      Book
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-6 mb-8">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="flex items-center justify-center gap-2 p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-orange-200"
            >
              <Phone className="w-5 h-5 text-[#FF8C42]" />
              <span className="font-medium text-gray-700 text-sm">Call Clinic</span>
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-2 p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-orange-200"
            >
              <MapPin className="w-5 h-5 text-[#FF8C42]" />
              <span className="font-medium text-gray-700 text-sm">Directions</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
