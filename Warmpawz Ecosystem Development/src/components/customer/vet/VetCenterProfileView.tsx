import { useState, useEffect } from 'react';
import { ArrowLeft, Star, Heart, Share2, MapPin, Phone, Clock, Navigation, Award, CheckCircle2, Stethoscope, Calendar, TrendingUp } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { shareContent } from '../../../utils/shareUtils';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'reviews'>('overview');

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadCenterData();
  }, [centerId]);

  const loadCenterData = async () => {
    try {
      setLoading(true);
      
      console.log('📍 [VET-PROFILE] Loading clinic data for:', centerId);
      
      // Fetch facility data
      const facilityResponse = await fetch(`${API_BASE}/customer/facility/${centerId}`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      if (facilityResponse.ok) {
        const facilityData = await facilityResponse.json();
        console.log('🏥 [VET-PROFILE] Facility data:', facilityData);
        
        if (facilityData.success) {
          setCenter(facilityData.vendor);
          setFacility(facilityData.facility);
          setRating(facilityData.rating);
          setReviews(facilityData.recentReviews || []);
        }
      }

      // Fetch services
      const servicesResponse = await fetch(`${API_BASE}/customer/clinic/${centerId}/services`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      if (servicesResponse.ok) {
        const servicesData = await servicesResponse.json();
        console.log('📦 [VET-PROFILE] Clinic services:', servicesData);
        
        if (servicesData.success && servicesData.services) {
          // Services are already filtered by the endpoint (enabled + published)
          // Filter only at_center services for clinic view
          const clinicServices = servicesData.services
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
          
          console.log(`✅ [VET-PROFILE] Found ${clinicServices.length} at_center services for clinic ${centerId}`, clinicServices);
          setServices(clinicServices);
        } else {
          console.warn('⚠️ [VET-PROFILE] No services found in response');
          setServices([]);
        }
      } else {
        console.error('❌ [VET-PROFILE] Failed to fetch services:', servicesResponse.status);
        setServices([]);
      }
    } catch (error) {
      console.error('❌ [VET-PROFILE] Error loading clinic data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      const shareData = {
        title: center?.businessName || 'Vet Clinic',
        text: `Check out ${center?.businessName || 'this vet clinic'} on Warmpawz`,
        url: window.location.href
      };

      await shareContent(shareData);
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-[430px] mx-auto">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading clinic...</p>
        </div>
      </div>
    );
  }

  if (!center || !facility) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-[430px] mx-auto">
        <div className="text-center">
          <p className="text-gray-600">Vet clinic not found</p>
          <Button onClick={onBack} className="mt-4" variant="outline">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const centerName = center.businessName || center.fullName;
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
                alt={centerName}
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
            <div className="h-64 bg-gradient-to-br from-[#FF8C42] to-[#FF7029] flex items-center justify-center">
              <Stethoscope className="w-20 h-20 text-white/30" />
            </div>
          )}

          {/* Back Button */}
          <button
            onClick={onBack}
            className="absolute top-4 left-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>

          {/* Action Buttons */}
          <div className="absolute top-4 right-4 flex gap-2">
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
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{centerName}</h1>
              <p className="text-sm text-gray-600 mb-2">{facility.address || center.address}</p>
              
              {/* Rating */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
                  <span className="font-semibold text-lg">{rating?.averageRating?.toFixed(1) || '4.5'}</span>
                  <span className="text-sm text-gray-500">({rating?.totalReviews || 0} reviews)</span>
                </div>
                {facility.isPremium && (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                    <Award className="w-3 h-3 mr-1" />
                    Premium
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center py-2 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold text-gray-900">{services.length}+</div>
              <div className="text-xs text-gray-500">Services</div>
            </div>
            <div className="text-center py-2 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold text-gray-900">{facility.vets || 2}+</div>
              <div className="text-xs text-gray-500">Vets</div>
            </div>
            <div className="text-center py-2 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold text-gray-900">24/7</div>
              <div className="text-xs text-gray-500">Emergency</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10">
          {['overview', 'services', 'reviews'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'text-[#FF8C42] border-b-2 border-[#FF8C42]'
                  : 'text-gray-500'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-4">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* About */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">About</h3>
                <p className="text-sm text-gray-600">
                  {facility.description || `${centerName} is a professional veterinary clinic offering comprehensive pet healthcare services. Our expert veterinarians ensure your pet receives the best medical care.`}
                </p>
              </div>

              {/* Features */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Features</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Stethoscope, label: 'Advanced Equipment' },
                    { icon: CheckCircle2, label: 'Certified Vets' },
                    { icon: Heart, label: 'Emergency Care' },
                    { icon: Clock, label: 'Quick Service' }
                  ].map((feature, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                      <feature.icon className="w-5 h-5 text-[#FF8C42]" />
                      <span className="text-sm text-gray-700">{feature.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contact Info */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Contact Information</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-700">{center.phone}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-700">{facility.address || center.address}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Clock className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-700">{facility.operatingHours || 'Mon-Sat: 9AM-7PM, 24/7 Emergency'}</span>
                  </div>
                </div>
              </div>

              {/* Directions Button */}
              <Button
                variant="outline"
                className="w-full border-[#FF8C42] text-[#FF8C42] hover:bg-orange-50"
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
              >
                <Navigation className="w-4 h-4 mr-2" />
                Get Directions
              </Button>
              
              {/* Call Button */}
              <Button
                variant="outline"
                className="w-full border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  const phoneNumber = center?.phone || facility?.phone;
                  if (phoneNumber) {
                    window.location.href = `tel:${phoneNumber}`;
                  } else {
                    alert('Phone number not available');
                  }
                }}
              >
                <Phone className="w-4 h-4 mr-2" />
                Call Now
              </Button>
            </div>
          )}

          {/* Services Tab */}
          {activeTab === 'services' && (
            <div className="space-y-3">
              {services.length > 0 ? (
                services.map((service) => (
                  <Card key={service.id} className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-gray-900">{service.name}</h4>
                          {service.popular && (
                            <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">
                              <TrendingUp className="w-3 h-3 mr-1" />
                              Popular
                            </Badge>
                          )}
                        </div>
                        {service.description && (
                          <p className="text-sm text-gray-600 mb-2">{service.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{service.duration} mins</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-[#FF8C42]">₹{service.price}</div>
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <div className="text-center py-12">
                  <Stethoscope className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No services available</p>
                </div>
              )}
            </div>
          )}

          {/* Reviews Tab */}
          {activeTab === 'reviews' && (
            <div className="space-y-4">
              {reviews.length > 0 ? (
                reviews.map((review) => (
                  <Card key={review.id} className="p-4">
                    <div className="flex items-start gap-3 mb-2">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#FF8C42] to-[#FF7029] rounded-full flex items-center justify-center text-white font-semibold">
                        {review.customerName.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-semibold text-gray-900">{review.customerName}</h4>
                          <span className="text-xs text-gray-500">{new Date(review.date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1 mb-2">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < review.rating ? 'fill-amber-500 text-amber-500' : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-sm text-gray-600">{review.comment}</p>
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <div className="text-center py-12">
                  <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No reviews yet</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fixed Bottom CTA */}
        <div className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto bg-white border-t border-gray-200 p-4">
          <Button
            onClick={() => onNavigate('select_service')}
            className="w-full bg-[#FF8C42] hover:bg-[#FF7029] h-12"
            disabled={services.length === 0}
          >
            <Calendar className="w-5 h-5 mr-2" />
            {services.length === 0 ? 'No Services Available' : 'Book Appointment'}
          </Button>
        </div>
      </div>
    </div>
  );
}