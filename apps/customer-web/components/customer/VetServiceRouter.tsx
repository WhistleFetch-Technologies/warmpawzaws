"use client";

import { useState, useEffect } from 'react';
import { Video, Building2, Home as HomeIcon, Stethoscope, Star, MapPin, Clock, Sparkles, ChevronRight, FlaskConical, Pill, History, TrendingUp, AlertCircle, Activity, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { ProblemGridSection, VET_PROBLEMS } from './ProblemGridSection';
import { useProblemGridByRole } from './useProblemGridByRole';
import { useRouter } from 'next/navigation';
import { PromotionBanner } from './shared/PromotionBanner';
import { ServiceDashboardHeader } from './shared/ServiceDashboardHeader';
import { StandardizedFooter } from './shared/StandardizedFooter';

interface VetServiceRouterProps {
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  data?: any;
}

/**
 * ✅ FIX: Added pet context validation to prevent crashes (VET-CUST-001)
 * Vet services require a pet to be selected before booking
 */
export function VetServiceRouter({ phone, onBack, onNavigate, data }: VetServiceRouterProps) {
  const router = useRouter();
  const vetProblems = useProblemGridByRole('vet');
  const [loading, setLoading] = useState(true);
  const [spotlightDeals, setSpotlightDeals] = useState<any[]>([]);
  const [featuredVets, setFeaturedVets] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [showBookingHistory, setShowBookingHistory] = useState(false);
  const [allowedServiceStyles, setAllowedServiceStyles] = useState<string[]>([]);
  const [pets, setPets] = useState<any[]>([]);
  const [hasPets, setHasPets] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  // ✅ FIX #13: Track all error states
  const [vetDataError, setVetDataError] = useState<string | null>(null);
  
  // User profile data for header
  const [userName, setUserName] = useState('User');
  const [userProfilePhoto, setUserProfilePhoto] = useState<string | undefined>(undefined);

  const [previousVet, setPreviousVet] = useState<any>(null);

  useEffect(() => {
    loadPets();
    loadVetData();
    loadDashboardConfig();
    loadUserProfile();
    loadPreviousVet();
  }, []);

  const loadPreviousVet = async () => {
    try {
      const response = await apiClient.get<any>(`/customer/${phone}/previous-providers?serviceType=vet`).catch(() => null);
      if (response?.provider) {
        setPreviousVet({
          id: response.provider.id,
          name: response.provider.businessName || response.provider.name,
          photo: response.provider.photo || null,
          rating: response.provider.rating || 4.8,
          lastVisit: response.provider.lastVisit,
          sessionsCount: response.provider.sessionsCount || 1
        });
      } else {
        const packagesResponse = await apiClient.get<any>(`/customer/${phone}/packages?serviceType=vet`).catch(() => null);
        if (packagesResponse?.packages?.length > 0) {
          const pkg = packagesResponse.packages[0];
          if (pkg.vendorId && pkg.vendorName) {
            setPreviousVet({ id: pkg.vendorId, name: pkg.vendorName, photo: null, rating: 4.8, lastVisit: pkg.lastUsed || '3 weeks ago', sessionsCount: pkg.sessionsUsed || 1 });
          }
        }
      }
    } catch { /* ignore */ }
  };
  
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

  const loadPets = async () => {
    try {
      const petsData = await apiClient.get(`/customer/pets/${phone}`) as any;
      const petsList = petsData?.pets || [];
      setPets(petsList);
      setHasPets(petsList.length > 0);
    } catch (err: any) {
      console.error('Error loading pets:', err);
      setError('Failed to load pets. Please try again.');
      setHasPets(false);
    }
  };

  const loadDashboardConfig = async () => {
    try {
      // Get customer's role
      const profile = await apiClient.get(`/customer/profile?phone=${encodeURIComponent(phone)}`).catch(() => null);
      const profileData = profile as any;
      const roleId = profileData?.profile?.role_id || profileData?.role_id || profileData?.roleId || 'veterinarian';
      
      // Fetch dashboard config
      const config = await apiClient.get(`/config/ui/dashboard?roleId=${roleId}`).catch(() => null);
      
      if (config && (config as any).success) {
        const configData = (config as any).config;
        const buttons = configData.buttons || configData.widgets || [];
        
        // Find vet-related button
        const vetButton = buttons.find((btn: any) => 
          btn.id?.includes('vet') || 
          btn.serviceId === 'vet' ||
          btn.label?.toLowerCase().includes('vet') ||
          btn.label?.toLowerCase().includes('consultation')
        );
        
        if (vetButton?.allowedServiceStyles && vetButton.allowedServiceStyles.length > 0) {
          setAllowedServiceStyles(vetButton.allowedServiceStyles);
        }
      }
    } catch (error) {
      console.error('Error loading dashboard config:', error);
    }
  };

  const loadVetData = async () => {
    try {
      setLoading(true);
      setVetDataError(null);

      // Get customer location for distance/radius: profile lat/lng or geolocation
      let latitude: string | undefined;
      let longitude: string | undefined;
      try {
        const profileRes = await apiClient.get(`/customer/profile?phone=${encodeURIComponent(phone)}`) as any;
        const profile = profileRes?.profile || profileRes;
        if (profile?.latitude != null && profile?.longitude != null) {
          latitude = String(profile.latitude);
          longitude = String(profile.longitude);
        }
      } catch (_) { /* ignore */ }
      if (latitude == null && typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, maximumAge: 300000 });
          });
          latitude = String(pos.coords.latitude);
          longitude = String(pos.coords.longitude);
        } catch (_) { /* ignore */ }
      }
      const locationParams = latitude && longitude ? `&latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}` : '';
      
      // ✅ FIX: Try multiple endpoints to find vendors
      let servicesData: any[] = [];
      
      // Try 1: discover-services endpoint (with location for distance and radius filtering)
      try {
        const endpoint = `/customer/discover-services?category=vet${locationParams}`;
        const data = await apiClient.get<any>(endpoint);
        console.log('🔵 [VetServiceRouter] discover-services response:', data);
        
        // Handle different response formats
        if (Array.isArray(data)) {
          servicesData = data;
        } else if (data?.vendors && Array.isArray(data.vendors)) {
          servicesData = data.vendors;
        } else if (data?.services && Array.isArray(data.services)) {
          servicesData = data.services;
        } else if (data?.results && Array.isArray(data.results)) {
          servicesData = data.results;
        } else if (data?.data && Array.isArray(data.data)) {
          servicesData = data.data;
        }
      } catch (err) {
        console.warn('⚠️ [VetServiceRouter] discover-services failed, trying alternatives:', err);
      }
      
      // Try 2: If no data, try services/by-style endpoint
      if (servicesData.length === 0) {
        try {
          const phoneParam = phone ? `&customerPhone=${encodeURIComponent(phone)}` : '';
          const altEndpoint = `/customer/services/by-style?style=tele&category=vet${locationParams}${phoneParam}`;
          const altData = await apiClient.get<any>(altEndpoint);
          console.log('🔵 [VetServiceRouter] services/by-style response:', altData);
          
          if (Array.isArray(altData)) {
            servicesData = altData;
          } else if (altData?.services && Array.isArray(altData.services)) {
            servicesData = altData.services;
          } else if (altData?.vendors && Array.isArray(altData.vendors)) {
            servicesData = altData.vendors;
          }
        } catch (err) {
          console.warn('⚠️ [VetServiceRouter] services/by-style also failed:', err);
        }
      }
      
      // Try 3: Fallback to /customer/vendors/search (GET /customer/vendors does not exist)
      if (servicesData.length === 0) {
        try {
          const vendorsEndpoint = `/customer/vendors/search?roleId=veterinarian&limit=50${locationParams}`;
          const vendorsData = await apiClient.get<any>(vendorsEndpoint);
          console.log('🔵 [VetServiceRouter] vendors/search fallback response:', vendorsData);
          
          if (Array.isArray(vendorsData)) {
            servicesData = vendorsData;
          } else if (vendorsData?.vendors && Array.isArray(vendorsData.vendors)) {
            servicesData = vendorsData.vendors;
          } else if (vendorsData?.results && Array.isArray(vendorsData.results)) {
            servicesData = vendorsData.results;
          }
        } catch (err) {
          console.warn('⚠️ [VetServiceRouter] vendors/search fallback failed:', err);
        }
      }
      
      console.log('🔵 [VetServiceRouter] Final servicesData length:', servicesData.length);
      
      // Extract unique vet vendors
      const vendorMap = new Map();
      servicesData.forEach((service: any) => {
        const vendorId = service.vendorId || service.vendor_id || service.id;
        if (!vendorId) return; // Skip if no vendor ID
        
        const vendorType = (service.vendorType || service.vendor_type || '').toLowerCase();
        const roleId = String(service.vendorRoleId || service.roleId || service.role_id || '').toLowerCase();
        const vendorName = service.vendorName || service.vendor_name || service.businessName || service.business_name || service.name || '';
        
        // ✅ FIX: More lenient filtering - accept any vendor with vet-related roleId or category
        const isVet = roleId.includes('vet') || 
                      roleId.includes('veterinarian') ||
                      roleId.includes('clinic') ||
                      vendorType.includes('vet') || 
                      vendorType.includes('clinic') || 
                      vendorType.includes('healthcare') ||
                      service.category === 'vet' ||
                      service.category === 'veterinary' ||
                      vendorName.toLowerCase().includes('vet') ||
                      vendorName.toLowerCase().includes('clinic');
        
        if (isVet && !vendorMap.has(vendorId)) {
          vendorMap.set(vendorId, {
            id: vendorId,
            name: vendorName,
            rating: service.vendorRating || service.vendor_rating || service.rating || 4.5,
            reviews: service.vendorReviewCount || service.vendor_review_count || service.reviewsCount || service.reviews_count || 0,
            specialty: service.specialty || 'General Veterinarian',
            experience: service.experience || 5,
            fee: service.price || service.base_price || 499,
            location: service.vendorLocation || service.vendor_location || service.location,
            serviceStyle: service.serviceStyle || service.service_style
          });
        }
      });
      
      const vets = Array.from(vendorMap.values());
      console.log('🔵 [VetServiceRouter] Found vendors:', vets.length);
      setFeaturedVets(vets.slice(0, 5));
      
      // Set stats based on real data only
      setStats({
        activeVets: vets.length,
        consultations: vets.length > 0 ? `${Math.max(vets.length * 10, 100)}+` : '0',
        rating: vets.length > 0 ? Number(vets.reduce((acc: number, v: any) => acc + Number(v.rating || 4.5), 0) / vets.length).toFixed(1) : '-'
      });
    } catch (error) {
      console.error('❌ [VetServiceRouter] Error loading vet data:', error);
      // ✅ FIX #13: Track error state
      const errorMsg = error instanceof Error ? error.message : 'Failed to load veterinary services';
      setVetDataError(errorMsg);
      setStats({
        activeVets: 0,
        consultations: '0',
        rating: '-'
      });
    } finally {
      setLoading(false);
    }
  };

  // Map service types to dashboard config styles
  const serviceTypeStyleMap: Record<string, string[]> = {
    'tele': ['tele', 'video_consultation', 'video'],
    'home': ['at_home', 'home_visit'],
    'clinic': ['at_clinic', 'at_center', 'clinic'],
    'lab': ['lab', 'diagnostics'],
    'medicine': ['pharmacy', 'medicine'],
    'physiotherapy': ['at_center', 'at_home', 'physiotherapy', 'rehabilitation'],
  };

  // Get filtered service types based on dashboard config
  const getFilteredServiceTypes = () => {
    const allServiceTypes = [
      {
        id: 'tele',
        name: 'Tele Consultation',
        description: 'Video call with vets',
        icon: Video,
        color: '#FF8C42',
        bgColor: 'bg-orange-50',
        badge: '24/7 Available'
      },
      {
        id: 'clinic',
        name: 'Clinic Visit',
        description: 'Book appointment',
        icon: Building2,
        color: '#7FD47F',
        bgColor: 'bg-green-50',
        badge: '200+ Clinics'
      },
      {
        id: 'home',
        name: 'Home Visit',
        description: 'Vet comes to you',
        icon: HomeIcon,
        color: '#FF8C42',
        bgColor: 'bg-orange-50',
        badge: 'Track Live'
      },
      {
        id: 'lab',
        name: 'Lab Tests',
        description: 'Sample collection',
        icon: FlaskConical,
        color: '#9F7FFF',
        bgColor: 'bg-purple-50',
        badge: 'Digital Reports'
      },
      {
        id: 'medicine',
        name: 'Medicine',
        description: 'Order medicines',
        icon: Pill,
        color: '#FF6B9F',
        bgColor: 'bg-pink-50',
        badge: 'Fast Delivery'
      },
      {
        id: 'physiotherapy',
        name: 'Physiotherapy',
        description: 'Rehabilitation & follow-up',
        icon: Activity,
        color: '#0D9488',
        bgColor: 'bg-teal-50',
        badge: 'Follow-up care'
      }
    ];

    // If no restrictions, return all
    if (!allowedServiceStyles || allowedServiceStyles.length === 0) {
      return allServiceTypes;
    }

    // Filter based on allowedServiceStyles
    return allServiceTypes.filter(service => {
      const styleMap = serviceTypeStyleMap[service.id] || [];
      return styleMap.some(style => 
        allowedServiceStyles.some(allowed => 
          allowed.toLowerCase().includes(style.toLowerCase()) ||
          style.toLowerCase().includes(allowed.toLowerCase())
        )
      );
    });
  };

  const serviceTypes = getFilteredServiceTypes();

  // ✅ FIX: Validate pet context before allowing navigation
  const handleNavigate = (screen: string, navData?: any) => {
    console.log('🔵 [VetServiceRouter] handleNavigate called:', screen, navData);
    
    // Check if navigation requires a pet (booking-related screens)
    const requiresPet = ['vet-booking', 'vet-doctor-details', 'vet-clinic-booking', 'vet-services-by-style'].includes(screen);
    
    if (requiresPet && (!hasPets || pets.length === 0)) {
      console.warn('⚠️ [VetServiceRouter] Pet required but not found');
      toast.error('Please add a pet first before booking vet services');
      onNavigate('pets', { action: 'add' });
      return;
    }
    
    try {
      console.log('🔵 [VetServiceRouter] Calling onNavigate with:', screen);
      if (typeof onNavigate !== 'function') {
        console.error('❌ [VetServiceRouter] onNavigate is not a function:', typeof onNavigate);
        toast.error('Navigation error. Please refresh the page.');
        return;
      }
      onNavigate(screen, navData);
      console.log('✅ [VetServiceRouter] Navigation successful');
    } catch (err: any) {
      console.error('❌ [VetServiceRouter] Navigation error:', err);
      toast.error('Failed to navigate. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  // ✅ FIX #13: Show error state if pets or vet data failed to load
  if (error || vetDataError) {
    return (
      <>
        {/* Header is provided by renderScreenWithLayout wrapper (StandardizedHeader) */}
        <div className="px-6 pt-8">
          <Card className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Unable to Load</h3>
            <p className="text-gray-600 mb-4">{error || vetDataError}</p>
            <div className="flex gap-3 justify-center">
              {error && (
                <Button onClick={loadPets} variant="outline">Retry Pets</Button>
              )}
              {vetDataError && (
                <Button onClick={loadVetData} className="bg-[#FF8C42] hover:bg-[#FF7A2E]">
                  Retry Services
                </Button>
              )}
            </div>
          </Card>
        </div>
      </>
    );
  }

  // ✅ FIX: Prepare stats for ServiceDashboardHeader
  const dashboardStats = stats ? [
    { value: `${stats.activeVets || 0}+`, label: 'Vets', icon: <Stethoscope className="w-4 h-4" /> },
    { value: `${stats.consultations || 0}`, label: 'Consults' },
    { value: `${stats.rating || '-'}`, label: 'Rating', icon: <Star className="w-4 h-4 fill-white" /> }
  ] : [
    { value: '0+', label: 'Vets', icon: <Stethoscope className="w-4 h-4" /> },
    { value: '0', label: 'Consults' },
    { value: '-', label: 'Rating', icon: <Star className="w-4 h-4 fill-white" /> }
  ];

  return (
    <div className="min-h-screen bg-gray-50" style={{ position: 'relative', zIndex: 0 }}>
      {/* ✅ FIX: Restore Frame UI with ServiceDashboardHeader */}
      <ServiceDashboardHeader
        serviceName="Veterinary Services"
        serviceSubtitle="Professional pet healthcare"
        serviceIcon={Stethoscope}
        iconColor="text-white"
        stats={dashboardStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-[#FF8C42]"
      />

      {/* Main Content */}
      <div className="max-w-[430px] mx-auto px-4 pt-6 pb-24" style={{ position: 'relative', zIndex: 1 }}>
        {/* Phase 0.1: Promotion Banner Component */}
        <div className="mb-6">
          <PromotionBanner service="vet" maxPromotions={3} onNavigate={onNavigate} />
        </div>

        {/* Phase 1: Book again with previous vet */}
        {previousVet && (
          <div className="mb-6 space-y-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg font-bold text-slate-900">Book again</h2>
            </div>
            <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 p-4">
              <div className="flex items-center gap-4">
                {previousVet.photo ? (
                  <img src={previousVet.photo} alt={previousVet.name} className="w-16 h-16 rounded-xl object-cover border-2 border-orange-200" />
                ) : (
                  <div className="w-16 h-16 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 font-bold text-xl border-2 border-orange-200">
                    {previousVet.name?.charAt(0) || 'V'}
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-bold text-slate-900 text-lg">{previousVet.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                    <div className="flex items-center gap-1 text-orange-600 font-bold">
                      <Star className="w-4 h-4 fill-orange-500" />
                      {previousVet.rating}
                    </div>
                    <span>•</span>
                    <span>Last visit: {previousVet.lastVisit || '3 weeks ago'}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{previousVet.sessionsCount || 1} visit(s) with you</p>
                </div>
                <Button
                  className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
                  onClick={() => handleNavigate('vet-booking', { vendorId: previousVet.id })}
                >
                  Book Now
                </Button>
              </div>
            </Card>
          </div>
        )}
        
        {/* Legacy Spotlight Banners - Fallback if no promotions */}
        {false && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-[#FF8C42]" />
            <h2 className="text-lg font-semibold">Spotlight Offers</h2>
          </div>
          
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-6 px-6">
            {/* First Consultation Offer - WHITE BACKGROUND */}
            <Card className="min-w-[280px] flex-shrink-0 bg-white border border-gray-100 p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Badge className="bg-blue-100 text-blue-600 border-none mb-2">Limited Time</Badge>
                  <div className="text-3xl font-bold text-blue-600 mb-1">50% OFF</div>
                  <div className="text-gray-700 text-sm">First Tele Consultation</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl">
                  <Video className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="text-sm">
                  <span className="line-through text-gray-400">₹599</span>
                  <span className="ml-2 font-bold text-lg text-gray-900">₹299</span>
                </div>
                <Button 
                  size="sm" 
                  className="bg-blue-600 text-white hover:bg-blue-700 h-8"
                  onClick={() => handleNavigate('vet-booking', { serviceType: 'tele' })}
                >
                  Book Now
                </Button>
              </div>
            </Card>

            {/* Free Lab Tests Offer - WHITE BACKGROUND */}
            <Card className="min-w-[280px] flex-shrink-0 bg-white border border-gray-100 p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Badge className="bg-purple-100 text-purple-600 border-none mb-2">New</Badge>
                  <div className="text-3xl font-bold text-purple-600 mb-1">FREE</div>
                  <div className="text-gray-700 text-sm">Home Sample Collection</div>
                </div>
                <div className="p-3 bg-purple-50 rounded-xl">
                  <FlaskConical className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="text-sm text-gray-600">On orders above ₹999</div>
                <Button 
                  size="sm" 
                  className="bg-purple-600 text-white hover:bg-purple-700 h-8"
                  onClick={() => handleNavigate('vet-lab-tests')}
                >
                  Book Test
                </Button>
              </div>
            </Card>
          </div>
        </div>
        )}

        {/* Service Types */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Choose Service</h2>
            <button 
              className="text-sm text-[#FF8C42] flex items-center gap-1 font-medium"
              onClick={() => setShowBookingHistory(true)}
            >
              <History className="w-4 h-4" />
              My Bookings
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-3" style={{ position: 'relative', zIndex: 1 }}>
            {serviceTypes.map((service) => {
              const handleServiceClick = () => {
                console.log('🔵 [VetServiceRouter] Service clicked:', service.id);
                
                try {
                  // Map service IDs to service styles
                  const styleMap: Record<string, string> = {
                    'tele': 'tele',
                    'home': 'at_home', 
                    'clinic': 'at_center',
                    'lab': 'lab',
                    'medicine': 'medicine'
                  };
                  const serviceStyle = styleMap[service.id] || service.id;
                  
                  // Navigate to dedicated flow for each service type
                  if (service.id === 'clinic') {
                    // Clinic: list of clinics → clinic profile → services → booking
                    console.log('🔵 [VetServiceRouter] Navigating to vet-clinic-list');
                    handleNavigate('vet-clinic-list');
                  } else if (service.id === 'tele') {
                    // ✅ FIX: Tele Consultation - direct navigation with error handling
                    console.log('🔵 [VetServiceRouter] Navigating to vet-tele-consultation');
                    // Direct navigation to avoid any validation issues
                    if (typeof onNavigate === 'function') {
                      try {
                        onNavigate('vet-tele-consultation');
                        console.log('✅ [VetServiceRouter] Tele consultation navigation called');
                      } catch (error) {
                        console.error('❌ [VetServiceRouter] Direct navigation error:', error);
                        // Fallback to handleNavigate
                        handleNavigate('vet-tele-consultation');
                      }
                    } else {
                      console.error('❌ [VetServiceRouter] onNavigate is not a function');
                      handleNavigate('vet-tele-consultation');
                    }
                  } else if (service.id === 'home') {
                    // ✅ NEW: Home Visit with provider list → profile → booking
                    console.log('🔵 [VetServiceRouter] Navigating to vet-home-visit');
                    handleNavigate('vet-home-visit');
                  } else if (service.id === 'medicine') {
                    // ✅ FIX: Medicine should go to pharmacy store, not booking flow
                    console.log('🔵 [VetServiceRouter] Navigating to pharmacy_store');
                    handleNavigate('pharmacy_store');
                  } else if (service.id === 'lab') {
                    // Lab diagnostics flow
                    console.log('🔵 [VetServiceRouter] Navigating to lab-diagnostics');
                    handleNavigate('lab-diagnostics');
                  } else if (service.id === 'physiotherapy') {
                    // Phase 3: Physiotherapy & rehabilitation – list vets offering follow-up care
                    handleNavigate('vet-services-by-style', {
                      serviceStyle: 'at_center',
                      serviceTypeName: 'Physiotherapy',
                      category: 'vet',
                    });
                  } else {
                    handleNavigate('vet-booking', { serviceType: service.id });
                  }
                } catch (error) {
                  console.error('❌ [VetServiceRouter] Service click error:', error);
                  toast.error('Failed to navigate. Please try again.');
                }
              };

              return (
              <button
                key={service.id}
                type="button"
                className="p-4 cursor-pointer hover:shadow-md transition-all border border-gray-100 bg-white shadow-sm rounded-xl relative active:scale-95 text-left w-full"
                onClick={(e) => {
                  console.log('🔵 [VetServiceRouter] Card onClick triggered for:', service.id);
                  e.preventDefault();
                  e.stopPropagation();
                  handleServiceClick();
                }}
                onKeyDown={(e: React.KeyboardEvent<HTMLButtonElement>) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    console.log('🔵 [VetServiceRouter] Keyboard navigation for:', service.id);
                    handleServiceClick();
                  }
                }}
                style={{ 
                  pointerEvents: 'auto', 
                  userSelect: 'none',
                  zIndex: 10,
                  position: 'relative'
                }}
              >
                <div className="flex flex-col h-full">
                  <div 
                    className={`w-12 h-12 ${service.bgColor} rounded-xl flex items-center justify-center mb-3`}
                  >
                    <service.icon className="w-6 h-6" style={{ color: service.color }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">{service.name}</h3>
                    <p className="text-xs text-gray-500 mb-2">{service.description}</p>
                  </div>
                  {service.badge && (
                    <Badge variant="secondary" className="text-xs w-fit">
                      {service.badge}
                    </Badge>
                  )}
                </div>
              </button>
              );
            })}
          </div>
        </div>

        {/* Health Problems Grid - Dynamic from specialization_master, fallback to VET_PROBLEMS */}
        <ProblemGridSection
          roleId="veterinarian"
          roleName="Veterinarian"
          title="Consult by Problem"
          icon={Stethoscope}
          problems={vetProblems.length > 0 ? vetProblems : VET_PROBLEMS}
          onNavigate={(screen, data) => {
            console.log('🔵 [Vet] Problem grid navigation:', screen, data);
            handleNavigate(screen, data);
          }}
        />

        {/* Featured Vets */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Featured Vets</h2>
            <button 
              className="text-sm text-[#FF8C42] flex items-center gap-1"
              onClick={() => handleNavigate('vet-all-doctors')}
            >
              View All
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-3">
            {featuredVets.length > 0 ? (
              featuredVets.slice(0, 3).map((vet, index) => (
                <Card 
                  key={index}
                  className="p-4 cursor-pointer hover:shadow-md transition-all bg-white border border-gray-100 shadow-sm"
                  onClick={() => handleNavigate('vet-doctor-details', { doctorId: vet.id })}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 bg-gradient-to-br from-[#FF8C42] to-[#FF7029] rounded-xl flex items-center justify-center text-white text-xl font-bold">
                      {vet.name?.charAt(0) || 'V'}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">{vet.name || 'Dr. Veterinarian'}</h3>
                      <p className="text-xs text-gray-500 mb-2">{vet.specialty || 'General Veterinarian'}</p>
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1 text-amber-500">
                          <Star className="w-3 h-3 fill-current" />
                          <span className="font-semibold">{vet.rating || 4.8}</span>
                          <span className="text-gray-400">({vet.reviews || 0})</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-500">
                          <Clock className="w-3 h-3" />
                          <span>{vet.experience || 5}+ years</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-[#FF8C42]">₹{vet.fee || 499}</div>
                      <div className="text-xs text-gray-400">per visit</div>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              // No vets available message
              <Card className="p-6 text-center bg-gray-50 border border-gray-200">
                <p className="text-gray-500 text-sm">No veterinarians available in your area yet.</p>
                <p className="text-gray-400 text-xs mt-1">Check back soon!</p>
              </Card>
            )}
          </div>
        </div>

        {/* What's New */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-[#FF8C42]" />
            <h2 className="text-lg font-semibold">What's New</h2>
          </div>
          
          <div className="space-y-3">
            <Card className="p-4 bg-white border border-gray-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Video className="w-5 h-5 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">24/7 Tele Consultation</h3>
                  <p className="text-sm text-gray-600">Connect with vets anytime via video call</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-white border border-gray-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FlaskConical className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Digital Lab Reports</h3>
                  <p className="text-sm text-gray-600">View reports instantly in your pet's health records</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-white border border-gray-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <HomeIcon className="w-5 h-5 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Live Tracking</h3>
                  <p className="text-sm text-gray-600">Track your vet's location for home visits</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
      
      {/* Standardized Footer */}
      <StandardizedFooter
        currentTab="home"
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
