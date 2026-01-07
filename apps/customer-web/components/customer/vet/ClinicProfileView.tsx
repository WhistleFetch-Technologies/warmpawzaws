'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Star, MapPin, Phone, Clock, Award, Heart, Share2, Navigation, Users, Calendar, ChevronRight, CheckCircle2, TrendingUp, Building2 } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface ClinicProfileViewProps {
  phone: string;
  clinicId: string;
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

export function ClinicProfileView({ phone, clinicId, onBack, onNavigate }: ClinicProfileViewProps) {
  const [loading, setLoading] = useState(true);
  const [clinic, setClinic] = useState<any>(null);
  const [facility, setFacility] = useState<any>(null);
  const [services, setServices] = useState<ServiceData[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [rating, setRating] = useState<any>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'doctors' | 'services' | 'reviews'>('overview');
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [doctorSearchQuery, setDoctorSearchQuery] = useState('');

  useEffect(() => {
    loadClinicData();
  }, [clinicId]);

  const loadClinicData = async () => {
    try {
      setLoading(true);
      
      const [facilityRes, servicesRes, doctorsRes] = await Promise.all([
        apiClient.get<any>(`/customer/facility/${clinicId}`),
        apiClient.get<any>(`/customer/clinic/${clinicId}/services`),
        apiClient.get<any>(`/customer/doctors/search?roleId=veterinarian`)
      ]);

      if (facilityRes.success) {
        setClinic(facilityRes.vendor);
        setFacility(facilityRes.facility);
        setRating(facilityRes.rating);
        setReviews(facilityRes.recentReviews || []);
      }

      if (servicesRes.success && servicesRes.services) {
        const clinicServices = servicesRes.services.map((service: any) => ({
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
      }

      if (doctorsRes.success && doctorsRes.doctors) {
        const clinicDoctors = doctorsRes.doctors
          .filter((doctor: any) => doctor.clinicId === clinicId)
          .map((doctor: any) => ({
            id: doctor.id,
            name: doctor.fullName,
            fullName: doctor.fullName,
            specialization: doctor.specialization,
            experience: doctor.yearsOfExperience || doctor.experience,
            photo: doctor.photo,
            serviceCount: doctor.serviceCount
          }));
        setDoctors(clinicDoctors);
      }
    } catch (error) {
      console.error('Error loading clinic data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-[430px] mx-auto">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading clinic details...</p>
        </div>
      </div>
    );
  }

  if (!clinic || !facility) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-[430px] mx-auto">
        <div className="text-center">
          <p className="text-gray-600">Clinic not found</p>
          <button onClick={onBack} className="mt-4 px-4 py-0 bg-primary text-white rounded-lg">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const clinicName = clinic.businessName || clinic.fullName;
  const photos = facility.photos || [];
  const hasPhotos = photos.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[430px] mx-auto bg-white min-h-screen pb-20">
        {/* Photo Gallery */}
        <div className="relative">
          {hasPhotos ? (
            <div className="relative h-64 bg-gray-200">
              <img
                src={photos[selectedPhotoIndex]}
                alt={clinicName}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-0 right-3 bg-black/70 backdrop-blur-sm text-white px-0 py-0 rounded-full text-sm">
                {selectedPhotoIndex + 1} / {photos.length}
              </div>
            </div>
          ) : (
            <div className="h-64 bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center">
              <Building2 className="w-20 h-20 text-gray-300" />
            </div>
          )}

          <button
            onClick={onBack}
            className="absolute top-4 left-4 w-10 h-10 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>

          <div className="absolute top-4 right-4 flex gap-0">
            <button
              onClick={() => setIsFavorite(!isFavorite)}
              className="w-10 h-10 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg"
            >
              <Heart className={`w-5 h-5 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-700'}`} />
            </button>
            <button className="w-10 h-10 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg">
              <Share2 className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>

        {/* Clinic Info Header */}
        <div className="px-4 pt-12 pb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-0">{clinicName}</h1>
          
          <div className="flex items-center gap-0 mb-0">
            <div className="flex items-center gap-0 bg-green-600 text-white px-0 py-0 rounded">
              <Star className="w-4 h-4 fill-white" />
              <span className="font-semibold">{rating?.average?.toFixed(1) || '4.5'}</span>
            </div>
            <span className="text-sm text-gray-600">
              {rating?.total || 0} ratings • {reviews.length} reviews
            </span>
          </div>

          <div className="flex items-start gap-0 text-gray-600 mb-0">
            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
            <span className="text-sm">{facility.address}</span>
          </div>

          <div className="flex gap-0 flex-wrap mb-4">
            <span className="px-0 py-0 bg-orange-50 text-orange-700 rounded-full text-xs flex items-center gap-0">
              <Navigation className="w-3 h-3" />
              2.5 km
            </span>
            <span className="px-0 py-0 bg-green-50 text-green-700 rounded-full text-xs flex items-center gap-0">
              <CheckCircle2 className="w-3 h-3" />
              Open Now
            </span>
          </div>

          <div className="flex gap-0">
            <button className="flex-1 px-4 py-0 border border-gray-300 rounded-lg text-sm font-medium">
              <Phone className="w-4 h-4 inline mr-0" />
              Call
            </button>
            <button className="flex-1 px-4 py-0 border border-gray-300 rounded-lg text-sm font-medium">
              <Navigation className="w-4 h-4 inline mr-0" />
              Direction
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-4 sticky top-0 bg-white z-10">
          <div className="flex gap-0">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'doctors', label: 'Doctors' },
              { id: 'services', label: 'Services' },
              { id: 'reviews', label: 'Reviews' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-0 font-medium text-sm transition-all ${
                  activeTab === tab.id
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-gray-500'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-4">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {facility.description && (
                <div className="bg-white p-4 rounded-xl border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-0">About</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{facility.description}</p>
                </div>
              )}

              <div className="bg-white p-4 rounded-xl border border-gray-200">
                <div className="flex items-center gap-0 mb-0">
                  <Clock className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-gray-900">Timings</h3>
                </div>
                <p className="text-sm text-gray-600">{facility.operatingHours}</p>
              </div>

              {services.length > 0 && (
                <div className="bg-white p-4 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between mb-0">
                    <h3 className="font-semibold text-gray-900">Popular Services</h3>
                    <button
                      onClick={() => setActiveTab('services')}
                      className="text-primary text-sm"
                    >
                      View All
                    </button>
                  </div>
                  <div className="space-y-2">
                    {services.slice(0, 3).map((service) => (
                      <div key={service.id} className="flex items-center justify-between p-0 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{service.name}</div>
                          <div className="text-xs text-gray-500">{service.duration} mins</div>
                        </div>
                        <div className="font-semibold text-primary">₹{service.price}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'doctors' && (
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Search doctors..."
                value={doctorSearchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDoctorSearchQuery(e.target.value)}
                className="w-full p-0 border border-gray-300 rounded-lg mb-0"
              />
              {doctors.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No doctors available</p>
                </div>
              ) : (
                doctors
                  .filter((doctor) => doctor.name.toLowerCase().includes(doctorSearchQuery.toLowerCase()))
                  .map((doctor) => (
                    <div
                      key={doctor.id}
                      onClick={() => onNavigate('doctor-details', { doctorId: doctor.id })}
                      className="bg-white p-4 rounded-xl border-2 border-gray-100 hover:border-primary transition-all cursor-pointer"
                    >
                      <div className="flex items-start gap-0">
                        {doctor.photo ? (
                          <img src={doctor.photo} alt={doctor.name} className="w-16 h-16 rounded-full" />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center">
                            <span className="text-2xl font-bold text-primary">{doctor.name?.charAt(0)}</span>
                          </div>
                        )}
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{doctor.name}</h4>
                          <p className="text-sm text-gray-600">{doctor.specialization}</p>
                          <p className="text-xs text-gray-500 mt-0">{doctor.experience} years experience</p>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}

          {activeTab === 'services' && (
            <div className="space-y-3">
              {services.length > 0 ? (
                services.map((service) => (
                  <div key={service.id} className="bg-white p-4 rounded-xl border border-gray-200">
                    <div className="flex items-start justify-between gap-0">
                      <div className="flex-1">
                        <div className="flex items-center gap-0 mb-0">
                          <h4 className="font-semibold text-gray-900">{service.name}</h4>
                          {service.popular && (
                            <span className="px-0 py-0 bg-orange-100 text-orange-700 rounded-full text-xs">
                              Popular
                            </span>
                          )}
                        </div>
                        {service.description && (
                          <p className="text-sm text-gray-600 mb-0">{service.description}</p>
                        )}
                        <div className="flex items-center gap-0 text-xs text-gray-500">
                          <span className="flex items-center gap-0">
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
                  <p className="text-gray-500">No services available</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-4">
              {reviews.length > 0 ? (
                reviews.map((review) => (
                  <div key={review.id} className="bg-white p-4 rounded-xl border border-gray-200">
                    <div className="flex items-start gap-0 mb-0">
                      <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-dark rounded-full flex items-center justify-center text-white font-semibold">
                        {review.customerName.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-0">
                          <h4 className="font-semibold text-gray-900">{review.customerName}</h4>
                          <span className="text-xs text-gray-500">{new Date(review.date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-0 mb-0">
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
        <div className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto bg-white border-t border-gray-200 p-4">
          <button
            onClick={() => onNavigate('select_service', { clinicId })}
            className="w-full py-1 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors flex items-center justify-center gap-0"
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

