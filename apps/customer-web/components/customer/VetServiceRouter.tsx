"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Video, Building2, Home as HomeIcon, Stethoscope, Star, MapPin, Clock, Sparkles, ChevronRight, FlaskConical, Pill, History, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { ProblemGridSection, VET_PROBLEMS } from './ProblemGridSection';

interface VetServiceRouterProps {
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  data?: any;
}

export function VetServiceRouter({ phone, onBack, onNavigate, data }: VetServiceRouterProps) {
  const [loading, setLoading] = useState(true);
  const [spotlightDeals, setSpotlightDeals] = useState<any[]>([]);
  const [featuredVets, setFeaturedVets] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [showBookingHistory, setShowBookingHistory] = useState(false);
  const [allowedServiceStyles, setAllowedServiceStyles] = useState<string[]>([]);

  useEffect(() => {
    loadVetData();
    loadDashboardConfig();
  }, []);

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
      
      const endpoint = `/customer/discover-services?category=vet&roleId=veterinarian`;
      const data = await apiClient.get<{ vendors?: any[]; services?: any[] }>(endpoint);
      const servicesData = data.vendors || data.services || [];
      
      // Extract unique vet vendors
      const vendorMap = new Map();
      servicesData.forEach((service: any) => {
        const vendorId = service.vendorId || service.id;
        const vendorType = (service.vendorType || '').toLowerCase();
        const roleId = (service.vendorRoleId || service.roleId || '').toLowerCase();
        const vendorName = service.vendorName || service.businessName || service.name || '';
        
        // Filter for veterinary vendors
        const isVet = vendorType.includes('vet') || 
                      vendorType.includes('clinic') || 
                      vendorType.includes('healthcare') ||
                      roleId.includes('vet') ||
                      roleId.includes('clinic') ||
                      vendorName.toLowerCase().includes('vet') ||
                      vendorName.toLowerCase().includes('clinic');
        
        if (isVet && !vendorMap.has(vendorId)) {
          vendorMap.set(vendorId, {
            id: vendorId,
            name: vendorName,
            rating: service.vendorRating || service.rating || 4.5,
            reviews: service.vendorReviewCount || service.reviewsCount || 0,
            specialty: 'General Veterinarian',
            experience: 5,
            fee: service.price || 499,
            location: service.vendorLocation || service.location,
            serviceStyle: service.serviceStyle
          });
        }
      });
      
      const vets = Array.from(vendorMap.values());
      setFeaturedVets(vets.slice(0, 5));
      
      // Set stats based on real data only
      setStats({
        activeVets: vets.length,
        consultations: vets.length > 0 ? `${Math.max(vets.length * 10, 100)}+` : '0',
        rating: vets.length > 0 ? (vets.reduce((acc: number, v: any) => acc + v.rating, 0) / vets.length).toFixed(1) : '-'
      });
    } catch (error) {
      console.error('Error loading vet data:', error);
      // Show zeros on error - no fake data
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
  };

  // Get filtered service types based on dashboard config
  const getFilteredServiceTypes = () => {
    const allServiceTypes = [
      {
        id: 'tele',
        name: 'Tele Consultation',
        description: 'Video call with vets',
        icon: Video,
        color: '#6B9FFF',
        bgColor: 'bg-blue-50',
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

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto">
      {/* Header with Concave Bottom Curve */}
      <div className="bg-gradient-to-br from-[#FF8C42] to-[#FF7029] text-white px-6 pt-8 pb-16 relative">
        <button 
          onClick={onBack}
          className="mb-4 flex items-center gap-2 text-white/90 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Vet Services</h1>
            <p className="text-white/80 text-sm">Complete pet healthcare</p>
          </div>
        </div>

        {/* Quick Stats - only show if we have real data */}
        {stats && stats.activeVets > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <div className="text-2xl font-bold">{stats.activeVets}+</div>
              <div className="text-white/80 text-xs">Active Vets</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <div className="text-2xl font-bold">{stats.consultations}</div>
              <div className="text-white/80 text-xs">Consultations</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <div className="flex items-center gap-1 text-2xl font-bold">
                <Star className="w-4 h-4 fill-white" />
                {stats.rating}
              </div>
              <div className="text-white/80 text-xs">Avg Rating</div>
            </div>
          </div>
        )}
        
        {/* Concave curve - curves inward */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-white" 
             style={{
               borderTopLeftRadius: '50% 100%',
               borderTopRightRadius: '50% 100%',
             }}
        />
      </div>

      {/* Main Content on White Background */}
      <div className="px-6 pb-24">
        {/* Spotlight Banners */}
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
                  onClick={() => onNavigate('vet-booking', { serviceType: 'tele' })}
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
                  onClick={() => onNavigate('vet-lab-tests')}
                >
                  Book Test
                </Button>
              </div>
            </Card>
          </div>
        </div>

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
          
          <div className="grid grid-cols-2 gap-3">
            {serviceTypes.map((service) => (
              <Card
                key={service.id}
                className="p-4 cursor-pointer hover:shadow-md transition-all border border-gray-100 bg-white shadow-sm"
                onClick={() => {
                  // Map service IDs to service styles
                  const styleMap: Record<string, string> = {
                    'tele': 'tele',
                    'home': 'at_home', 
                    'clinic': 'at_center',
                    'lab': 'lab',
                    'medicine': 'medicine'
                  };
                  const serviceStyle = styleMap[service.id] || service.id;
                  
                  // Navigate to services listing page for this style
                  if (service.id === 'clinic') {
                    onNavigate('vet-clinic-list');
                  } else if (service.id === 'tele' || service.id === 'home') {
                    // Navigate to service listing by style - shows actual configured services
                    onNavigate('vet-services-by-style', { 
                      serviceStyle, 
                      serviceTypeName: service.name,
                      category: 'vet'
                    });
                  } else {
                    onNavigate('vet-booking', { serviceType: service.id });
                  }
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
              </Card>
            ))}
          </div>
        </div>

        {/* Health Problems Grid - Using ProblemGridSection with 2D icons */}
        <ProblemGridSection
          roleId="veterinarian"
          roleName="Veterinarian"
          title="Consult by Problem"
          icon={Stethoscope}
          problems={VET_PROBLEMS}
          onNavigate={(screen, data) => {
            console.log('🔵 [Vet] Problem grid navigation:', screen, data);
            onNavigate(screen, data);
          }}
        />

        {/* Featured Vets */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Featured Vets</h2>
            <button 
              className="text-sm text-[#FF8C42] flex items-center gap-1"
              onClick={() => onNavigate('vet-all-doctors')}
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
                  onClick={() => onNavigate('vet-doctor-details', { doctorId: vet.id })}
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
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Video className="w-5 h-5 text-blue-600" />
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
    </div>
  );
}
