"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Video, Building2, Home, Stethoscope, Star, MapPin, Clock, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface VetServiceRouterProps {
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  data?: any;
}

export function VetServiceRouter({ phone, onBack, onNavigate, data }: VetServiceRouterProps) {
  const [currentView, setCurrentView] = useState<'landing' | 'doctor-list'>('landing');
  const [loading, setLoading] = useState(false);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedServiceType, setSelectedServiceType] = useState<'tele' | 'clinic' | 'home' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (currentView === 'doctor-list' && selectedServiceType) {
      loadDoctors();
    }
  }, [currentView, selectedServiceType]);

  const loadDoctors = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        roleId: 'veterinarian',
        ...(selectedServiceType === 'tele' && { serviceStyle: 'tele_consultation' }),
        ...(selectedServiceType === 'clinic' && { serviceStyle: 'at_center' }),
        ...(selectedServiceType === 'home' && { serviceStyle: 'home_visit' }),
        ...(searchQuery && { query: searchQuery })
      });

      // Append params to URL query string
      const endpoint = `/customer/doctors/search${params.toString() ? `?${params.toString()}` : ''}`;
      const data = await apiClient.get<{ doctors?: any[]; staff?: any[]; success?: boolean }>(endpoint);
      const doctorList = data.doctors || data.staff || [];
      setDoctors(doctorList);
    } catch (error) {
      console.error('Error loading doctors:', error);
      // No mock fallback - show empty state when API fails
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  };

  const handleServiceTypeSelect = (type: 'tele' | 'clinic' | 'home') => {
    setSelectedServiceType(type);
    setCurrentView('doctor-list');
  };

  const handleDoctorSelect = (doctor: any) => {
    onNavigate('vet-doctor-details', { doctorId: doctor.id, doctor, serviceType: selectedServiceType });
  };

  // Landing Page View
  if (currentView === 'landing') {
    return (
      <div className="min-h-screen bg-gray-50 pb-24 max-w-md mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-blue-600 text-white px-4 py-4 sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="rounded-full text-white hover:bg-white/20"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">Veterinary Services</h1>
              <p className="text-white/90 text-sm">Expert care for your pets</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Hero Banner */}
          <Card className="bg-gradient-to-br from-teal-50 to-blue-50 border-teal-200 p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Expert Pet Care</h2>
                <p className="text-gray-700 mb-4">Consult with licensed veterinarians</p>
              </div>
              <div className="text-5xl">🐾</div>
            </div>
          </Card>

          {/* Service Type Selection */}
          <div>
            <h2 className="font-bold text-gray-900 mb-4">Choose Consultation Type</h2>
            <div className="space-y-3">
              {/* Tele Consultation */}
              <Card 
                className="p-4 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-teal-300"
                onClick={() => handleServiceTypeSelect('tele')}
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Video className="w-7 h-7 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-gray-900">Video Consultation</h3>
                    <p className="text-sm text-gray-600 mt-1">Consult from home via video call</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Quick</span>
                      <span className="text-xs text-gray-500">₹299 onwards</span>
                    </div>
                  </div>
                  <div className="text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Card>

              {/* Clinic Visit */}
              <Card 
                className="p-4 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-teal-300"
                onClick={() => handleServiceTypeSelect('clinic')}
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-teal-100 rounded-xl flex items-center justify-center">
                    <Building2 className="w-7 h-7 text-teal-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-gray-900">Clinic Visit</h3>
                    <p className="text-sm text-gray-600 mt-1">Visit nearby veterinary clinic</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded">In-person</span>
                      <span className="text-xs text-gray-500">₹399 onwards</span>
                    </div>
                  </div>
                  <div className="text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Card>

              {/* Home Visit */}
              <Card 
                className="p-4 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-teal-300"
                onClick={() => handleServiceTypeSelect('home')}
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center">
                    <Home className="w-7 h-7 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-gray-900">Home Visit</h3>
                    <p className="text-sm text-gray-600 mt-1">Doctor visits your home</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Convenient</span>
                      <span className="text-xs text-gray-500">₹599 onwards</span>
                    </div>
                  </div>
                  <div className="text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Doctor List View
  return (
    <div className="min-h-screen bg-gray-50 pb-24 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-blue-600 text-white px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentView('landing')}
            className="rounded-full text-white hover:bg-white/20"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Available Doctors</h1>
            <p className="text-white/90 text-sm">
              {selectedServiceType === 'tele' && 'Video Consultation'}
              {selectedServiceType === 'clinic' && 'Clinic Visit'}
              {selectedServiceType === 'home' && 'Home Visit'}
            </p>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
            <input
              type="text"
              placeholder="Search doctors..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                // Debounce search
                setTimeout(() => loadDoctors(), 300);
              }}
              className="w-full pl-10 pr-4 py-2 bg-white/20 backdrop-blur rounded-lg text-white placeholder-white/70 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
        </div>
      </div>

      {/* Doctors List */}
      <div className="p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
          </div>
        ) : doctors.length === 0 ? (
          <Card className="p-8 text-center">
            <Stethoscope className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-900 mb-2">No Doctors Found</h3>
            <p className="text-sm text-gray-500">Try adjusting your search or service type</p>
          </Card>
        ) : (
          doctors.map((doctor) => (
            <Card
              key={doctor.id}
              className="p-4 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-teal-300"
              onClick={() => handleDoctorSelect(doctor)}
            >
              <div className="flex gap-4">
                {/* Doctor Avatar */}
                <div className="w-16 h-16 bg-gradient-to-br from-teal-100 to-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Stethoscope className="w-8 h-8 text-teal-600" />
                </div>

                {/* Doctor Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-900">{doctor.name || doctor.staffName}</h3>
                      <p className="text-sm text-gray-600">{doctor.specialization || doctor.roleName || 'Veterinarian'}</p>
                      {doctor.experience && (
                        <p className="text-xs text-gray-500 mt-1">{doctor.experience} experience</p>
                      )}
                    </div>
                    {doctor.availableToday && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                        Available
                      </span>
                    )}
                  </div>

                  {/* Rating & Reviews */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-semibold text-gray-900">{doctor.rating || 4.5}</span>
                    </div>
                    <span className="text-sm text-gray-500">({doctor.reviewsCount || 0} reviews)</span>
                  </div>

                  {/* Clinic & Location */}
                  {(doctor.clinicName || doctor.location?.address) && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4" />
                      <span className="truncate">
                        {doctor.clinicName || doctor.location?.address || 'Location'}
                      </span>
                    </div>
                  )}

                  {/* Price & Action */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                    <div>
                      <span className="text-lg font-bold text-teal-600">
                        {selectedServiceType === 'tele' && '₹299'}
                        {selectedServiceType === 'clinic' && '₹399'}
                        {selectedServiceType === 'home' && '₹599'}
                      </span>
                      <span className="text-sm text-gray-500 ml-1">onwards</span>
                    </div>
                    <Button
                      size="sm"
                      className="bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDoctorSelect(doctor);
                      }}
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}