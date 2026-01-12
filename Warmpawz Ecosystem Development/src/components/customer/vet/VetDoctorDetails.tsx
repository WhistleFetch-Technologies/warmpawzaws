import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { ImageWithFallback } from '../../figma/ImageWithFallback';
import {
  ArrowLeft,
  Star,
  Clock,
  MapPin,
  Award,
  Calendar,
  Video,
  Building2,
  Home as HomeIcon,
  ChevronRight,
  Search,
  Check
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

interface VetDoctorDetailsProps {
  phone: string;
  doctor?: any; // Pre-loaded doctor object (optional)
  doctorId?: string; // Doctor ID to load (optional)
  preSelectedService?: any; // Pre-selected service (optional)
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onBookService?: (service: any) => void; // For booking flow
}

export function VetDoctorDetails({ phone, doctor: propsDoctor, doctorId, preSelectedService, onBack, onNavigate, onBookService }: VetDoctorDetailsProps) {
  const [loading, setLoading] = useState(true);
  const [doctor, setDoctor] = useState<any>(propsDoctor || null);
  const [services, setServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (propsDoctor) {
      // If doctor data is provided, use it
      console.log('✅ [VET-DOCTOR-DETAILS] Using provided doctor data:', propsDoctor);
      console.log('✅ [VET-DOCTOR-DETAILS] Services from props:', propsDoctor.services);
      setDoctor(propsDoctor);
      
      // Load services if not provided in props
      if (propsDoctor.services && propsDoctor.services.length > 0) {
        setServices(propsDoctor.services);
        setLoading(false);
      } else {
        console.log('⚠️ [VET-DOCTOR-DETAILS] No services in props, loading from API...');
        loadDoctorServices(propsDoctor.id || doctorId);
      }
    } else if (doctorId) {
      // Load doctor data by ID
      loadDoctorData();
    } else {
      setLoading(false);
    }
  }, [doctorId, propsDoctor]);

  const loadDoctorData = async () => {
    try {
      setLoading(true);
      console.log('🔍 Loading doctor data for ID:', doctorId);
      
      // Fetch doctor details from backend
      const doctorRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/doctors/${doctorId}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );

      if (!doctorRes.ok) {
        console.error('❌ Failed to load doctor details:', doctorRes.status);
        setLoading(false);
        return;
      }

      const doctorData = await doctorRes.json();
      
      if (!doctorData.success || !doctorData.doctor) {
        console.error('❌ Doctor not found in response');
        setLoading(false);
        return;
      }

      const doctorDetails = doctorData.doctor;
      console.log('✅ Doctor loaded:', doctorDetails);

      setDoctor({
        id: doctorDetails.id,
        staffId: doctorDetails.staffId,
        name: doctorDetails.name || doctorDetails.fullName,
        fullName: doctorDetails.fullName,
        photo: doctorDetails.photo,
        rating: doctorDetails.rating || 0,
        reviews: doctorDetails.reviewCount || 0,
        reviewCount: doctorDetails.reviewCount || 0,
        location: doctorDetails.clinicAddress || 'Location not specified',
        experience: doctorDetails.experience || 0,
        specialty: doctorDetails.specialization || 'General Veterinarian',
        specialization: doctorDetails.specialization || 'General Veterinarian',
        education: doctorDetails.degree || 'BVSc & AH',
        degree: doctorDetails.degree || 'BVSc & AH',
        languages: doctorDetails.languages || ['English', 'Hindi'],
        about: doctorDetails.bio || `Experienced veterinarian specialized in pet healthcare and wellness.`,
        bio: doctorDetails.bio,
        consultationFee: doctorDetails.consultationFee || 0,
        clinicId: doctorDetails.clinicId,
        clinicName: doctorDetails.clinicName,
        clinicAddress: doctorDetails.clinicAddress,
        clinicLatitude: doctorDetails.clinicLatitude, // ✅ Add coordinates
        clinicLongitude: doctorDetails.clinicLongitude,
        distance: doctorDetails.distance, // ✅ Add distance
        availability: doctorDetails.availability || [],
        services: doctorDetails.services || []
      });

      // Set services from doctor data
      setServices(doctorDetails.services || []);
      console.log('✅ Loaded services:', doctorDetails.services?.length || 0);
      
    } catch (error) {
      console.error('❌ Error loading doctor data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDoctorServices = async (doctorId: string) => {
    try {
      setLoading(true);
      console.log('🔍 Loading doctor services for ID:', doctorId);
      
      // Fetch doctor details (which includes services) from backend
      const doctorRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/doctors/${doctorId}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );

      if (!doctorRes.ok) {
        console.error('❌ Failed to load doctor details:', doctorRes.status);
        setLoading(false);
        return;
      }

      const doctorData = await doctorRes.json();
      
      if (!doctorData.success || !doctorData.doctor) {
        console.error('❌ Doctor not found in response');
        setLoading(false);
        return;
      }

      const doctorDetails = doctorData.doctor;
      console.log('✅ Doctor services loaded:', doctorDetails.services);

      setServices(doctorDetails.services || []);
      setLoading(false);
      
    } catch (error) {
      console.error('❌ Error loading doctor services:', error);
      setLoading(false);
    }
  };

  // Handle service click - toggle selection
  const handleServiceClick = (service: any) => {
    console.log('🔘 [VET-DOCTOR-DETAILS] Service clicked:', service);
    
    // Normalize service data to ensure consistent structure
    const normalizedService = {
      id: service.id || service.serviceId,
      serviceId: service.serviceId || service.id,
      name: service.name || service.serviceName,
      serviceName: service.serviceName || service.name,
      description: service.description || '',
      price: service.price || 0,
      duration: service.duration || 30,
      serviceStyle: service.serviceStyle || 'at_center',
      category: service.category,
      categoryName: service.categoryName
    };
    
    console.log('✅ [VET-DOCTOR-DETAILS] Selecting service:', normalizedService);
    setSelectedService(normalizedService);
  };

  // Handle Book Service button click
  const handleBookService = () => {
    if (!selectedService) return;
    
    console.log('📅 [VET-DOCTOR-DETAILS] Booking service:', selectedService);
    console.log('📅 [VET-DOCTOR-DETAILS] Doctor:', doctor);
    
    if (onBookService) {
      // If we're in booking flow, call onBookService
      console.log('✅ [VET-DOCTOR-DETAILS] Calling onBookService callback');
      onBookService(selectedService);
    } else if (onNavigate) {
      // Otherwise navigate to booking screen
      const serviceType = selectedService.serviceStyle?.toLowerCase().includes('tele') ? 'tele'
        : selectedService.serviceStyle?.toLowerCase().includes('home') ? 'home'
        : 'clinic';
      
      const navigationData = { 
        serviceType, 
        doctorId: doctor?.id || doctorId,
        vendorId: doctor?.clinicId, // ✅ Pass vendor/clinic ID
        doctor: doctor, // ✅ Pass full doctor object
        serviceId: selectedService.id,
        service: selectedService
      };
      
      console.log('✅ [VET-DOCTOR-DETAILS] Navigating to booking with data:', navigationData);
      onNavigate('vet-booking', navigationData);
    } else {
      console.error('❌ [VET-DOCTOR-DETAILS] No navigation callback provided!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="min-h-screen bg-white max-w-md mx-auto">
        <div className="px-6 py-12 text-center">
          <h3 className="text-xl font-semibold mb-2">Doctor Not Found</h3>
          <p className="text-gray-600 mb-6">Unable to load doctor details.</p>
          <Button onClick={onBack} className="bg-[#FF8C42] hover:bg-[#FF7029]">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Filter services by search query
  const filteredServices = services.filter(s => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      s.name?.toLowerCase().includes(query) ||
      s.serviceName?.toLowerCase().includes(query) ||
      s.description?.toLowerCase().includes(query) ||
      s.categoryName?.toLowerCase().includes(query)
    );
  });

  // Group services by style
  const teleServices = filteredServices.filter(s => 
    s.serviceStyle?.toLowerCase().includes('tele') || 
    s.serviceStyle?.toLowerCase().includes('video')
  );
  const clinicServices = filteredServices.filter(s => 
    s.serviceStyle?.toLowerCase().includes('center') || 
    s.serviceStyle?.toLowerCase().includes('clinic') ||
    s.serviceStyle?.toLowerCase().includes('at_center')
  );
  const homeServices = filteredServices.filter(s => 
    s.serviceStyle?.toLowerCase().includes('home') || 
    s.serviceStyle?.toLowerCase().includes('doorstep') ||
    s.serviceStyle?.toLowerCase().includes('at_home')
  );
  
  console.log('📊 [VET-DOCTOR-DETAILS] Service breakdown (filtered):');
  console.log(`  Total services: ${filteredServices.length} (of ${services.length})`);
  console.log(`  Tele: ${teleServices.length}`);
  console.log(`  Clinic: ${clinicServices.length}`);
  console.log(`  Home: ${homeServices.length}`);

  const renderServiceCard = (service: any) => {
    const isSelected = selectedService?.id === service.id || selectedService?.serviceId === service.serviceId;
    
    return (
      <Card
        key={service.id}
        className={`p-4 bg-white border cursor-pointer transition-all ${
          isSelected 
            ? 'border-[#FF8C42] border-2 shadow-lg' 
            : 'border-gray-100 hover:shadow-md'
        }`}
        onClick={() => handleServiceClick(service)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm">{service.name}</h4>
              {isSelected && (
                <div className="bg-[#FF8C42] rounded-full p-1">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
            <p className="text-xs text-gray-600 mt-1">{service.description}</p>
            {service.duration && (
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
                <Clock className="w-3 h-3" />
                <span>{service.duration} mins</span>
              </div>
            )}
          </div>
          <div className="text-right ml-4">
            <div className="text-lg font-bold text-[#FF8C42]">₹{service.price}</div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto pb-32">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#FF8C42] to-[#FF7029] text-white px-6 pt-8 pb-20 relative">
        <button onClick={onBack} className="mb-4 flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-white" 
             style={{
               borderTopLeftRadius: '50% 100%',
               borderTopRightRadius: '50% 100%',
             }}
        />
      </div>

      <div className="px-6 -mt-12 space-y-6">
        {/* Doctor Card */}
        <Card className="p-6 bg-white border border-gray-100 shadow-md">
          <div className="flex items-start gap-4 mb-4">
            {doctor.photo ? (
              <ImageWithFallback
                src={doctor.photo}
                alt={doctor.name}
                className="w-24 h-24 rounded-2xl object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-24 h-24 bg-gradient-to-br from-[#FF8C42] to-[#FF7029] rounded-2xl flex items-center justify-center text-white text-3xl font-bold flex-shrink-0">
                {doctor.name?.charAt(0) || doctor.fullName?.charAt(0) || 'D'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold mb-1 break-words">Dr. {doctor.name || doctor.fullName}</h1>
              <p className="text-sm text-gray-600 mb-2">{doctor.specialty || doctor.specialization}</p>
              <div className="flex items-center gap-3 text-xs flex-wrap">
                <div className="flex items-center gap-1 text-amber-500">
                  <Star className="w-4 h-4 fill-current" />
                  <span className="font-semibold">{doctor.rating || 4.5}</span>
                  <span className="text-gray-400">({doctor.reviews || doctor.reviewCount || 0} reviews)</span>
                </div>
                {(doctor.experience || doctor.yearsOfExperience) > 0 && (
                  <div className="flex items-center gap-1 text-gray-500">
                    <Clock className="w-4 h-4" />
                    <span>{doctor.experience || doctor.yearsOfExperience}+ years exp</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Info */}
          <div className="grid grid-cols-1 gap-3 pt-4 border-t border-gray-100">
            <div className="flex items-start gap-2">
              <Award className="w-4 h-4 text-[#FF8C42] flex-shrink-0 mt-0.5" />
              <span className="text-sm text-gray-700">{doctor.education || doctor.degree || doctor.qualification || 'BVSc & AH'}</span>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-[#FF8C42] flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700 break-words">{doctor.location || doctor.clinicAddress || 'Location not specified'}</span>
                  {doctor.distance && (
                    <span className="text-sm font-medium text-[#FF8C42] whitespace-nowrap">
                      ({doctor.distance} km)
                    </span>
                  )}
                </div>
                {doctor.clinicName && (
                  <p className="text-xs text-gray-500 mt-1">at {doctor.clinicName}</p>
                )}
                {doctor.clinicLatitude && doctor.clinicLongitude && (
                  <button
                    onClick={() => {
                      const url = `https://www.google.com/maps/dir/?api=1&destination=${doctor.clinicLatitude},${doctor.clinicLongitude}`;
                      window.open(url, '_blank');
                    }}
                    className="flex items-center gap-1 mt-2 text-xs text-blue-600 hover:text-blue-700"
                  >
                    <MapPin className="w-3 h-3" />
                    Get Directions
                  </button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* About */}
        <div>
          <h2 className="text-lg font-semibold mb-3">About</h2>
          <Card className="p-4 bg-white border border-gray-100">
            <p className="text-sm text-gray-700 leading-relaxed">{doctor.about || doctor.bio || `Experienced veterinarian specialized in pet healthcare and wellness.`}</p>
            {doctor.languages && doctor.languages.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Languages</p>
                <div className="flex gap-2 flex-wrap">
                  {doctor.languages.map((lang: string) => (
                    <Badge key={lang} variant="secondary" className="text-xs">
                      {lang}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Services Offered */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Services Offered</h2>
            <span className="text-sm text-gray-500">{filteredServices.length} services</span>
          </div>
          
          {/* Search Bar */}
          {services.length > 5 && (
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search services..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#FF8C42] text-sm"
                />
              </div>
            </div>
          )}
          
          {teleServices.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Video className="w-4 h-4 text-blue-600" />
                Tele Consultation
              </h3>
              <div className="space-y-2">
                {teleServices.map(renderServiceCard)}
              </div>
            </div>
          )}

          {clinicServices.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-green-600" />
                Clinic Visit
              </h3>
              <div className="space-y-2">
                {clinicServices.map(renderServiceCard)}
              </div>
            </div>
          )}

          {homeServices.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <HomeIcon className="w-4 h-4 text-orange-600" />
                Home Visit
              </h3>
              <div className="space-y-2">
                {homeServices.map(renderServiceCard)}
              </div>
            </div>
          )}

          {filteredServices.length === 0 && searchQuery && (
            <Card className="p-6 bg-gray-50 border border-gray-100 text-center">
              <p className="text-sm text-gray-600">No services found matching "{searchQuery}"</p>
            </Card>
          )}

          {services.length === 0 && (
            <Card className="p-6 bg-gray-50 border border-gray-100 text-center">
              <p className="text-sm text-gray-600">No services available at the moment</p>
            </Card>
          )}
        </div>
      </div>

      {/* Fixed Bottom Button - Book Service */}
      {selectedService && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 shadow-lg">
          <div className="max-w-md mx-auto">
            <div className="mb-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Selected Service</p>
                  <p className="font-semibold text-sm">{selectedService.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-[#FF8C42]">₹{selectedService.price}</p>
                  <p className="text-xs text-gray-500">{selectedService.duration} mins</p>
                </div>
              </div>
            </div>
            <Button
              onClick={handleBookService}
              className="w-full bg-[#FF8C42] hover:bg-[#FF7029] text-white h-12"
            >
              <Calendar className="w-5 h-5 mr-2" />
              Book Service
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}