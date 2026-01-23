"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Star, Clock, MapPin, Phone, Globe, Calendar, Users, Image as ImageIcon, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { StandardizedHeader } from '../shared/StandardizedHeader';
import { StandardizedFooter } from '../shared/StandardizedFooter';

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
  services: { id: string; name: string; price: number; duration?: number }[];
  doctors: { id: string; name: string; specialization: string; rating: number }[];
  photos: string[];
  amenities: string[];
}

export function ClinicProfileView({ phone, clinicId, onBack, onNavigate }: ClinicProfileViewProps) {
  const [loading, setLoading] = useState(true);
  const [clinic, setClinic] = useState<ClinicInfo | null>(null);
  const [selectedService, setSelectedService] = useState<{ id: string; name: string; price: number; duration?: number } | null>(null);
  
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
      const [vendorResponse, servicesResponse] = await Promise.all([
        apiClient.get(`/customer/vendor/${clinicId}`),
        apiClient.get(`/vendor/${clinicId}/services`)
      ]);
      
      const vendorData = (vendorResponse as any)?.vendor || vendorResponse as any;
      
      // ✅ CRITICAL: Load services from real API - extract from different response formats
      let services: any[] = [];
      if (servicesResponse) {
        const servicesData = servicesResponse as any;
        if (servicesData.services) {
          // Handle servicesByStyle format
          if (servicesData.services.at_home || servicesData.services.at_center || servicesData.services.tele) {
            services = [
              ...(servicesData.services.at_home?.services || []),
              ...(servicesData.services.at_center?.services || []),
              ...(servicesData.services.tele?.services || [])
            ];
          } else if (Array.isArray(servicesData.services)) {
            services = servicesData.services;
          }
        } else if (servicesData.allServices) {
          services = servicesData.allServices;
        } else if (Array.isArray(servicesData)) {
          services = servicesData;
        }
      }
      
      // ✅ CRITICAL: Map services to use service_id (UUID) as id, not numeric vendor_services.id
      const mappedServices = services.map((s: any) => ({
        id: s.serviceId || s.service_id, // ✅ UUID from services table
        serviceId: s.serviceId || s.service_id, // ✅ UUID
        vendorServiceId: s.id, // Numeric vendor_services.id (for reference)
        name: s.serviceName || s.name || s.service_name,
        price: parseFloat(s.price || '0'),
        duration: s.duration || s.duration_minutes || 30,
      }));
      
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
        photos: vendorData.photos || vendorData.gallery || [],
        amenities: vendorData.amenities || [],
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
    
    // ✅ CRITICAL: Use service_id (UUID) not numeric id
    const serviceId = (selectedService as any).serviceId || selectedService.id;
    
    // Navigate with service data - use 'appointment' to match CustomerHomeWrapper expectation
    onNavigate('appointment', { 
      clinicId: clinic?.id, 
      vendorId: clinic?.id,
      service: selectedService,
      serviceId: serviceId, // ✅ UUID from services table
      serviceName: selectedService.name,
      price: selectedService.price,
      duration: selectedService.duration || 20,
      serviceStyle: 'at_center', // Clinic visits are at_center type
      serviceType: 'at_center',
      clinic 
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Standardized Header */}
      <StandardizedHeader
        userName={userName}
        userProfilePhoto={userProfilePhoto}
        title={clinic.name}
        subtitle="Clinic Profile"
        showBackButton={true}
        showPets={false}
        onBack={onBack}
        onNavigate={onNavigate}
        onProfileClick={() => onNavigate('profile')}
        customerPhone={phone}
      />

      <div className="max-w-[430px] mx-auto px-4 pt-4 pb-32">
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
            <div className="flex items-center gap-3 text-sm">
              <Phone className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">{clinic.phone}</span>
            </div>
          </div>

          {/* Amenities */}
          <div className="mt-4 flex flex-wrap gap-2">
            {clinic.amenities.map((amenity, idx) => (
              <span key={idx} className="px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-xs font-medium">
                {amenity}
              </span>
            ))}
          </div>
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
                  <p className="text-sm text-gray-500">{doctor.specialization}</p>
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

        {/* Services Section */}
        <div className="bg-white rounded-xl p-4 mb-4">
          <h2 className="font-bold text-gray-900 mb-3">Services & Prices</h2>
          <div className="space-y-2">
            {clinic.services.map((service) => (
              <button
                key={service.id}
                onClick={() => setSelectedService(service)}
                className={`w-full flex items-center justify-between py-3 px-3 rounded-lg border-2 transition-all ${
                  selectedService?.id === service.id
                    ? 'border-orange-600 bg-orange-50'
                    : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/50'
                }`}
              >
                <span className={`font-medium ${selectedService?.id === service.id ? 'text-orange-900' : 'text-gray-700'}`}>
                  {service.name}
                </span>
                <span className={`font-semibold ${selectedService?.id === service.id ? 'text-orange-600' : 'text-gray-900'}`}>
                  ₹{service.price}
                </span>
                {selectedService?.id === service.id && (
                  <CheckCircle2 className="w-5 h-5 text-orange-600 ml-2" />
                )}
              </button>
            ))}
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
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t p-4 z-40 max-w-[430px] mx-auto">
        <Button 
          onClick={handleBookAppointment}
          disabled={!selectedService}
          className="w-full bg-orange-500 hover:bg-orange-600 h-12 text-base font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {selectedService ? `Book ${selectedService.name}` : 'Select a Service'}
        </Button>
      </div>

      {/* Standardized Footer */}
      <StandardizedFooter
        currentTab="bookings"
        onTabChange={(tab) => {
          if (tab === 'home') onBack();
          else if (tab === 'bookings') onNavigate('my-bookings');
          else if (tab === 'cart') onNavigate('cart');
          else if (tab === 'profile') onNavigate('profile');
        }}
        maxWidth="max-w-[430px]"
      />
    </div>
  );
}
