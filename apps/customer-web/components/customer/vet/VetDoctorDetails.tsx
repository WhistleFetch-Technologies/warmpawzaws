"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Star, Clock, MapPin, Phone, Video, Home, Building2, Calendar, Award, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';

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
  services: { id: string; name: string; price: number; duration: number; service_style: string }[];
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
      // Try to fetch from API, fallback to mock data
      try {
        const response = await apiClient.get(`/vendors/${doctorId}`);
        const vendorData = response as any;
        setDoctor({
          id: vendorData.id || doctorId,
          name: vendorData.business_name || vendorData.name || 'Dr. Expert Veterinarian',
          specialization: vendorData.specialization || 'General Veterinarian',
          qualification: vendorData.qualification || 'BVSc & AH, MVSc',
          experience_years: vendorData.experience_years || 5,
          rating: vendorData.rating || 4.5,
          review_count: vendorData.review_count || 0,
          languages: vendorData.languages || ['English', 'Hindi'],
          services: vendorData.services || [
            { id: 'tele', name: 'Tele Consultation', price: 299, duration: 15, service_style: 'tele' },
            { id: 'home', name: 'Home Visit', price: 599, duration: 30, service_style: 'at_home' },
            { id: 'clinic', name: 'Clinic Visit', price: 399, duration: 20, service_style: 'at_center' },
          ],
          clinic_name: vendorData.clinic_name,
          clinic_address: vendorData.address,
          photo_url: vendorData.photo_url,
          is_verified: vendorData.is_verified || true,
        });
      } catch (err) {
        // Use mock data for demonstration
        setDoctor({
          id: doctorId,
          name: 'Dr. Priya Sharma',
          specialization: 'General Veterinarian',
          qualification: 'BVSc & AH, MVSc (Surgery)',
          experience_years: 8,
          rating: 4.8,
          review_count: 156,
          languages: ['English', 'Hindi', 'Marathi'],
          services: [
            { id: 'tele', name: 'Tele Consultation', price: 299, duration: 15, service_style: 'tele' },
            { id: 'home', name: 'Home Visit', price: 599, duration: 30, service_style: 'at_home' },
            { id: 'clinic', name: 'Clinic Visit', price: 399, duration: 20, service_style: 'at_center' },
          ],
          clinic_name: 'PetCare Veterinary Clinic',
          clinic_address: 'Shop 12, Ground Floor, Linking Road, Bandra West, Mumbai - 400050',
          is_verified: true,
        });
      }
    } catch (error) {
      console.error('Error loading doctor details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBookService = (serviceId: string, serviceStyle: string) => {
    onNavigate('vet-booking', {
      doctorId: doctor?.id,
      doctor: doctor,
      serviceId,
      serviceType: serviceStyle,
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto text-center py-12">
          <p className="text-gray-600">Doctor not found</p>
          <Button onClick={onBack} className="mt-4">Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with gradient */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 pt-4 pb-20 px-4">
        <div className="max-w-md mx-auto">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-white/90 hover:text-white mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
        </div>
      </div>

      {/* Doctor Card - overlapping header */}
      <div className="max-w-md mx-auto px-4 -mt-16">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Profile Section */}
          <div className="p-6">
            <div className="flex gap-4">
              {/* Avatar */}
              <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center text-3xl font-bold text-orange-600 flex-shrink-0">
                {doctor.photo_url ? (
                  <img src={doctor.photo_url} alt={doctor.name} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  doctor.name.charAt(0)
                )}
              </div>
              
              {/* Info */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900">{doctor.name}</h1>
                  {doctor.is_verified && (
                    <CheckCircle2 className="w-5 h-5 text-blue-500" />
                  )}
                </div>
                <p className="text-orange-600 font-medium">{doctor.specialization}</p>
                <p className="text-sm text-gray-500">{doctor.qualification}</p>
                
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
              <div className="p-4 bg-orange-50 rounded-xl">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-orange-500 mt-0.5" />
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      service.service_style === 'tele' ? 'bg-blue-100 text-blue-600' :
                      service.service_style === 'at_home' ? 'bg-green-100 text-green-600' :
                      'bg-purple-100 text-purple-600'
                    }`}>
                      {getServiceIcon(service.service_style)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{service.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{service.duration} mins</span>
                        <span className="text-orange-500 text-xs px-2 py-0.5 bg-orange-50 rounded-full">
                          {getServiceLabel(service.service_style)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg text-gray-900">₹{service.price}</p>
                    <Button
                      size="sm"
                      onClick={() => handleBookService(service.id, service.service_style)}
                      className="mt-1 bg-orange-500 hover:bg-orange-600 text-white"
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
            <button className="flex items-center justify-center gap-2 p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-orange-200">
              <Phone className="w-5 h-5 text-orange-500" />
              <span className="font-medium text-gray-700">Call Clinic</span>
            </button>
            <button className="flex items-center justify-center gap-2 p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-orange-200">
              <MapPin className="w-5 h-5 text-orange-500" />
              <span className="font-medium text-gray-700">Directions</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
