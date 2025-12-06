import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Card } from '../../ui/card';
import {
  ArrowLeft,
  Star,
  MapPin,
  Phone,
  Clock,
  Award,
  Heart,
  Share2,
  Navigation,
  Users,
  Calendar,
  ChevronRight,
  CheckCircle2,
  TrendingUp,
  Search,
  Building2 // ✅ ADDED: Missing import
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

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

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadClinicData();
  }, [clinicId]);

  const loadClinicData = async () => {
    try {
      setLoading(true);
      
      console.log('📍 [CLINIC-PROFILE] Loading clinic data for:', clinicId);
      
      // Fetch facility data (includes vendor, facility, reviews)
      const facilityResponse = await fetch(`${API_BASE}/customer/facility/${clinicId}`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      if (facilityResponse.ok) {
        const facilityData = await facilityResponse.json();
        console.log('🏥 [CLINIC-PROFILE] Facility data:', facilityData);
        
        if (facilityData.success) {
          setClinic(facilityData.vendor);
          setFacility(facilityData.facility);
          setRating(facilityData.rating);
          setReviews(facilityData.recentReviews || []);
        }
      }

      // Fetch services from the customer services endpoint and filter by vendorId
      const servicesResponse = await fetch(`${API_BASE}/customer/clinic/${clinicId}/services`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      if (servicesResponse.ok) {
        const servicesData = await servicesResponse.json();
        console.log('📦 [CLINIC-PROFILE] Clinic services:', servicesData);
        
        if (servicesData.success && servicesData.services) {
          // Services are already filtered and formatted by the endpoint
          const clinicServices = servicesData.services.map((service: any) => ({
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
          
          console.log(`✅ [CLINIC-PROFILE] Found ${clinicServices.length} services for clinic ${clinicId}`, clinicServices);
          setServices(clinicServices);
        } else {
          console.warn('⚠️ [CLINIC-PROFILE] No services found in response');
          setServices([]);
        }
      } else {
        console.error('❌ [CLINIC-PROFILE] Failed to fetch services:', servicesResponse.status);
        setServices([]);
      }

      // Fetch doctors from the customer doctors endpoint and filter by vendorId
      const doctorsResponse = await fetch(`${API_BASE}/customer/doctors/search?roleId=veterinarian`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      if (doctorsResponse.ok) {
        const doctorsData = await doctorsResponse.json();
        console.log('👩‍⚕️ [CLINIC-PROFILE] All doctors:', doctorsData);
        
        if (doctorsData.success && doctorsData.doctors) {
          // ✅ FIXED: Filter doctors for this specific clinic using clinicId (not vendorId)
          const clinicDoctors = doctorsData.doctors
            .filter((doctor: any) => {
              const matchesClinic = doctor.clinicId === clinicId;
              console.log(`   🔍 [DOCTOR-FILTER] ${doctor.fullName} - clinicId: ${doctor.clinicId}, matches: ${matchesClinic}`);
              return matchesClinic;
            })
            .map((doctor: any) => ({
              id: doctor.id,
              name: doctor.fullName, // ✅ FIXED: Use fullName instead of just name
              fullName: doctor.fullName,
              specialization: doctor.specialization,
              experience: doctor.yearsOfExperience || doctor.experience, // ✅ FIXED: Use correct field name
              photo: doctor.photo,
              serviceCount: doctor.serviceCount // ✅ Track service count for reference
            }));
          
          console.log(`✅ [CLINIC-PROFILE] Found ${clinicDoctors.length} doctors for clinic ${clinicId}`, clinicDoctors);
          setDoctors(clinicDoctors);
        } else {
          console.warn('⚠️ [CLINIC-PROFILE] No doctors found in response');
          setDoctors([]);
        }
      } else {
        console.error('❌ [CLINIC-PROFILE] Failed to fetch doctors:', doctorsResponse.status);
        setDoctors([]);
      }
    } catch (error) {
      console.error('❌ [CLINIC-PROFILE] Error loading clinic data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-[430px] mx-auto">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
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
          <Button onClick={onBack} className="mt-4" variant="outline">
            Go Back
          </Button>
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
              
              {/* Photo Counter */}
              <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm">
                {selectedPhotoIndex + 1} / {photos.length}
              </div>
              
              {/* Photo Navigation Dots */}
              {photos.length > 1 && (
                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                  {photos.map((_: any, index: number) => (
                    <button
                      key={index}
                      onClick={() => setSelectedPhotoIndex(index)}
                      className={`transition-all ${
                        index === selectedPhotoIndex
                          ? 'w-6 h-1.5 bg-white'
                          : 'w-1.5 h-1.5 bg-white/50'
                      } rounded-full`}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="h-64 bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center">
              <Building2 className="w-20 h-20 text-gray-300" />
            </div>
          )}

          {/* Back Button */}
          <button
            onClick={onBack}
            className="absolute top-4 left-4 w-10 h-10 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>

          {/* Action Buttons */}
          <div className="absolute top-4 right-4 flex gap-2">
            <button
              onClick={() => setIsFavorite(!isFavorite)}
              className="w-10 h-10 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg"
            >
              <Heart
                className={`w-5 h-5 ${
                  isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-700'
                }`}
              />
            </button>
            <button className="w-10 h-10 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg">
              <Share2 className="w-5 h-5 text-gray-700" />
            </button>
          </div>

          {/* Photo Thumbnails */}
          {photos.length > 1 && (
            <div className="absolute -bottom-8 left-4 right-4 flex gap-2 overflow-x-auto pb-2">
              {photos.slice(0, 5).map((photo: string, index: number) => (
                <button
                  key={index}
                  onClick={() => setSelectedPhotoIndex(index)}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    index === selectedPhotoIndex
                      ? 'border-[#FF8C42] scale-105'
                      : 'border-white'
                  }`}
                >
                  <img src={photo} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
              {photos.length > 5 && (
                <button className="flex-shrink-0 w-16 h-16 rounded-lg bg-gray-900/80 text-white flex items-center justify-center text-xs font-medium">
                  +{photos.length - 5}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Clinic Info Header */}
        <div className="px-4 pt-12 pb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{clinicName}</h1>
          
          {/* Rating & Reviews */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-1 bg-green-600 text-white px-2 py-1 rounded">
              <Star className="w-4 h-4 fill-white" />
              <span className="font-semibold">{rating?.average?.toFixed(1) || '4.5'}</span>
            </div>
            <span className="text-sm text-gray-600">
              {rating?.total || 0} ratings • {reviews.length} reviews
            </span>
          </div>

          {/* Address */}
          <div className="flex items-start gap-2 text-gray-600 mb-3">
            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#FF8C42]" />
            <span className="text-sm">{facility.address}</span>
          </div>

          {/* Quick Info Pills */}
          <div className="flex gap-2 flex-wrap mb-4">
            <Badge className="bg-orange-50 text-orange-700 border-0">
              <Navigation className="w-3 h-3 mr-1" />
              2.5 km
            </Badge>
            <Badge className="bg-green-50 text-green-700 border-0">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Open Now
            </Badge>
            <Badge className="bg-blue-50 text-blue-700 border-0">
              <Award className="w-3 h-3 mr-1" />
              Multispecialty
            </Badge>
            <Badge className="bg-purple-50 text-purple-700 border-0">
              <TrendingUp className="w-3 h-3 mr-1" />
              Trending
            </Badge>
          </div>

          {/* Contact Info */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 border-gray-300">
              <Phone className="w-4 h-4 mr-2" />
              Call
            </Button>
            <Button variant="outline" className="flex-1 border-gray-300">
              <Navigation className="w-4 h-4 mr-2" />
              Direction
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-4 sticky top-0 bg-white z-10">
          <div className="flex gap-6">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'doctors', label: 'Doctors' },
              { id: 'services', label: 'Services' },
              { id: 'reviews', label: 'Reviews' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-3 font-medium text-sm transition-all ${
                  activeTab === tab.id
                    ? 'text-[#FF8C42] border-b-2 border-[#FF8C42]'
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
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Description */}
              {facility.description && (
                <Card className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">About</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {facility.description}
                  </p>
                </Card>
              )}

              {/* Timing */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-[#FF8C42]" />
                  <h3 className="font-semibold text-gray-900">Timings</h3>
                </div>
                <p className="text-sm text-gray-600">{facility.operatingHours}</p>
              </Card>

              {/* Amenities */}
              {facility.amenities?.length > 0 && (
                <Card className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Amenities & Facilities</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {facility.amenities.slice(0, 6).map((amenity: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 text-sm text-gray-700"
                      >
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span>{amenity.name || amenity}</span>
                      </div>
                    ))}
                  </div>
                  {facility.amenities.length > 6 && (
                    <Button variant="ghost" className="w-full mt-3 text-[#FF8C42]">
                      View all {facility.amenities.length} amenities
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                </Card>
              )}

              {/* Popular Services Preview */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">Popular Services</h3>
                  <Button
                    onClick={() => setActiveTab('services')}
                    variant="ghost"
                    className="text-[#FF8C42] h-auto p-0"
                  >
                    View All
                  </Button>
                </div>
                <div className="space-y-2">
                  {services.slice(0, 3).map((service) => (
                    <div
                      key={service.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">{service.name}</div>
                        <div className="text-xs text-gray-500">{service.duration} mins</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-[#FF8C42]">₹{service.price}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* Doctors Tab */}
          {activeTab === 'doctors' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">Doctors</h3>
                <input
                  type="text"
                  placeholder="Search doctors..."
                  value={doctorSearchQuery}
                  onChange={(e) => setDoctorSearchQuery(e.target.value)}
                  className="w-32 h-8 px-2 border border-gray-300 rounded focus:outline-none focus:border-[#FF8C42]"
                />
              </div>
              {doctors.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No doctors available</p>
                </div>
              ) : (
                doctors
                  .filter((doctor) =>
                    doctor.name.toLowerCase().includes(doctorSearchQuery.toLowerCase())
                  )
                  .map((doctor) => (
                    <Card
                      key={doctor.id}
                      onClick={() => {
                        console.log('🩺 [CLINIC-PROFILE] Navigating to doctor:', doctor.id);
                        onNavigate('doctor-details', { doctorId: doctor.id });
                      }}
                      className="p-4 hover:shadow-lg hover:border-[#FF8C42] transition-all cursor-pointer border-2 border-gray-100"
                    >
                      <div className="flex items-start gap-3">
                        {doctor.photo ? (
                          <img
                            src={doctor.photo}
                            alt={doctor.name}
                            className="w-16 h-16 object-cover rounded-full flex-shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-2xl font-bold text-[#FF8C42]">
                              {doctor.name?.charAt(0)}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-gray-900">Dr. {doctor.name}</h4>
                            {doctor.specialization && (
                              <Badge className="bg-orange-100 text-orange-700 text-xs">
                                {doctor.specialization}
                              </Badge>
                            )}
                          </div>
                          {doctor.experience && (
                            <p className="text-sm text-gray-600 mb-2">
                              {doctor.experience} years of experience
                            </p>
                          )}
                          <Button
                            size="sm"
                            className="bg-[#FF8C42] hover:bg-[#FF7A2F] text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log('📅 [CLINIC-PROFILE] Book appointment with doctor:', doctor.id);
                              onNavigate('doctor-details', { doctorId: doctor.id });
                            }}
                          >
                            View Profile
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))
              )}
            </div>
          )}

          {/* Services Tab */}
          {activeTab === 'services' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">Services</h3>
                <input
                  type="text"
                  placeholder="Search services..."
                  value={serviceSearchQuery}
                  onChange={(e) => setServiceSearchQuery(e.target.value)}
                  className="w-32 h-8 px-2 border border-gray-300 rounded focus:outline-none focus:border-[#FF8C42]"
                />
              </div>
              {services.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No services available</p>
                </div>
              ) : (
                services
                  .filter((service) =>
                    service.name.toLowerCase().includes(serviceSearchQuery.toLowerCase())
                  )
                  .map((service) => (
                    <Card
                      key={service.id}
                      className="p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-gray-900">{service.name}</h4>
                            {service.popular && (
                              <Badge className="bg-orange-100 text-orange-700 text-xs">
                                Popular
                              </Badge>
                            )}
                          </div>
                          {service.description && (
                            <p className="text-sm text-gray-600 mb-2">{service.description}</p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {service.duration} mins
                            </span>
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="font-bold text-lg text-[#FF8C42]">₹{service.price}</div>
                        </div>
                      </div>
                    </Card>
                  ))
              )}
            </div>
          )}

          {/* Reviews Tab */}
          {activeTab === 'reviews' && (
            <div className="space-y-4">
              {/* Rating Summary */}
              <Card className="p-4">
                <div className="flex items-start gap-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-gray-900 mb-1">
                      {rating?.average?.toFixed(1) || '4.5'}
                    </div>
                    <div className="flex items-center gap-1 mb-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= (rating?.average || 4.5)
                              ? 'text-yellow-500 fill-yellow-500'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="text-xs text-gray-500">{rating?.total || 0} ratings</div>
                  </div>
                  <div className="flex-1 space-y-1">
                    {[5, 4, 3, 2, 1].map((stars) => (
                      <div key={stars} className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 w-8">{stars} ★</span>
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500"
                            style={{ width: `${Math.random() * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Reviews List */}
              {reviews.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No reviews yet</p>
                </div>
              ) : (
                reviews.map((review) => (
                  <Card key={review.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-semibold text-gray-900">{review.customerName}</div>
                        <div className="flex items-center gap-1 mt-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-3 h-3 ${
                                star <= review.rating
                                  ? 'text-yellow-500 fill-yellow-500'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(review.date).toLocaleDateString()}
                      </span>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-gray-600">{review.comment}</p>
                    )}
                    {review.serviceType && (
                      <Badge variant="outline" className="mt-2 text-xs">
                        {review.serviceType}
                      </Badge>
                    )}
                  </Card>
                ))
              )}
            </div>
          )}
        </div>

        {/* Fixed Bottom CTA */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
          <div className="max-w-[430px] mx-auto">
            <Button
              onClick={() => onNavigate('appointment', { clinicId })}
              className="w-full bg-[#FF8C42] hover:bg-[#FF7A2F] text-white h-12 text-base font-semibold"
            >
              <Calendar className="w-5 h-5 mr-2" />
              Book Appointment
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}