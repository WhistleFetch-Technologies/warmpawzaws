/**
 * HomeServiceLanding - Service-specific landing page
 * 
 * Features:
 * - Hero with service branding (matches GroomingServicesLanding design)
 * - Problem-based quick navigation
 * - Quick book with previous providers
 * - Featured packages
 * - Service highlights
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { 
  ArrowLeft, 
  Search, 
  MapPin, 
  Star, 
  Clock, 
  ChevronRight,
  Sparkles,
  Package,
  Repeat,
  ArrowRight,
  TrendingUp,
  Shield,
  Home as HomeIcon
} from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';
import { SERVICE_CONFIGS, HomeServiceType } from './UniversalHomeServiceRouter';

interface ServiceConfig {
  roleId: string;
  displayName: string;
  icon: string;
  primaryColor: string;
  bgGradient: string;
  problems: Array<{ id: string; name: string; icon: string }>;
  priceUnit: string;
  defaultDuration: number;
  requiresOTP: boolean;
  requiresStartOTP: boolean;
  supportsPackages: boolean;
  showMedicalHistory: boolean;
}

interface PreviousProvider {
  id: string;
  name: string;
  photo: string;
  rating: number;
  lastVisit: string;
}

interface FeaturedPackage {
  id: string;
  name: string;
  description: string;
  sessions: number;
  price: number;
  originalPrice: number;
  discount: number;
}

interface HomeServiceLandingProps {
  phone: string;
  serviceType: HomeServiceType;
  config: ServiceConfig;
  customerId: string;
  onBack: () => void;
  onNavigate: (action: string, data?: any) => void;
}

export function HomeServiceLanding({
  phone,
  serviceType,
  config,
  customerId,
  onBack,
  onNavigate
}: HomeServiceLandingProps) {
  const API_BASE = getApiBaseUrl();

  const [previousProviders, setPreviousProviders] = useState<PreviousProvider[]>([]);
  const [featuredPackages, setFeaturedPackages] = useState<FeaturedPackage[]>([]);
  const [featuredProviders, setFeaturedProviders] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLandingData();
  }, [serviceType, customerId, phone]);

  const loadLandingData = async () => {
    try {
      setLoading(true);

      // Load services data to get providers (matches GroomingServicesLanding pattern)
      const servicesResponse = await fetch(
        `${API_BASE}/customer/services?roleId=${config.roleId}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );

      if (servicesResponse.ok) {
        const data = await servicesResponse.json();
        const services = data.services || [];

        // Extract unique vendors
        const vendorMap = new Map();
        services.forEach((service: any) => {
          const vendorId = service.vendorId;
          if (!vendorMap.has(vendorId)) {
            vendorMap.set(vendorId, {
              id: vendorId,
              name: service.vendorName || 'Provider',
              photo: service.vendorPhoto || service.vendorLogo,
              rating: service.vendorRating || 4.5,
              reviewCount: service.vendorReviewCount || 0,
              distance: Math.random() * 5 + 0.5,
              price: service.price || 0
            });
          }
        });

        const allProviders = Array.from(vendorMap.values());
        setFeaturedProviders(allProviders.slice(0, 5));

        setStats({
          activeProviders: allProviders.length || 50,
          sessions: '5K',
          rating: allProviders.length > 0
            ? (allProviders.reduce((acc: number, p: any) => acc + (p.rating || 4.5), 0) / allProviders.length).toFixed(1)
            : '4.7'
        });
      }

      // Load previous providers for this customer
      if (customerId) {
        try {
          const prevResponse = await fetch(
            `${API_BASE}/customer/${customerId}/bookings?serviceType=${serviceType}&limit=5`,
            { headers: { Authorization: `Bearer ${publicAnonKey}` } }
          );

          if (prevResponse.ok) {
            const data = await prevResponse.json();
            const bookings = data.bookings || [];
            
            // Extract unique vendors from previous bookings
            const prevVendorMap = new Map();
            bookings.forEach((booking: any) => {
              if (booking.vendorId && !prevVendorMap.has(booking.vendorId)) {
                prevVendorMap.set(booking.vendorId, {
                  id: booking.vendorId,
                  name: booking.vendorName || 'Provider',
                  photo: booking.vendorPhoto,
                  rating: booking.vendorRating || 4.5,
                  lastVisit: new Date(booking.scheduledDate).toLocaleDateString()
                });
              }
            });
            setPreviousProviders(Array.from(prevVendorMap.values()));
          }
        } catch (e) {
          console.log('No previous bookings found');
        }
      }

      // Load featured packages if service supports it
      if (config.supportsPackages) {
        try {
          const pkgResponse = await fetch(
            `${API_BASE}/packages?roleId=${config.roleId}&featured=true`,
            { headers: { Authorization: `Bearer ${publicAnonKey}` } }
          );

          if (pkgResponse.ok) {
            const data = await pkgResponse.json();
            setFeaturedPackages(data.packages || []);
          }
        } catch (e) {
          console.log('No packages found');
        }
      }
    } catch (error) {
      console.error('Error loading landing data:', error);
      setStats({ activeProviders: 50, sessions: '5K', rating: '4.7' });
    } finally {
      setLoading(false);
    }
  };

  const serviceHighlights = {
    walker: [
      { icon: '🚶', text: 'Trained & Verified Walkers' },
      { icon: '📍', text: 'Live GPS Tracking' },
      { icon: '📸', text: 'Walk Photos & Updates' },
      { icon: '🔒', text: 'OTP Verified Start/End' }
    ],
    grooming: [
      { icon: '✨', text: 'Professional Groomers' },
      { icon: '🏠', text: 'At Your Doorstep' },
      { icon: '🧴', text: 'Premium Products' },
      { icon: '🛡️', text: 'Stress-Free for Pets' }
    ],
    training: [
      { icon: '🎓', text: 'Certified Trainers' },
      { icon: '📋', text: 'Customized Plans' },
      { icon: '🎯', text: 'Goal-Oriented Sessions' },
      { icon: '📈', text: 'Progress Tracking' }
    ],
    veterinary: [
      { icon: '👨‍⚕️', text: 'Licensed Veterinarians' },
      { icon: '🏠', text: 'Home Consultations' },
      { icon: '💊', text: 'Medicines Delivered' },
      { icon: '📄', text: 'Digital Prescriptions' }
    ],
    behaviourist: [
      { icon: '🧠', text: 'Pet Psychologists' },
      { icon: '🔍', text: 'Behavior Assessment' },
      { icon: '📝', text: 'Action Plans' },
      { icon: '🤝', text: 'Follow-up Support' }
    ],
    sitter: [
      { icon: '🏠', text: 'In-Home Care' },
      { icon: '📸', text: 'Photo Updates' },
      { icon: '🔔', text: 'Real-time Notifications' },
      { icon: '❤️', text: 'Loving Environment' }
    ],
    diagnostics: [
      { icon: '🧪', text: 'Home Sample Collection' },
      { icon: '📊', text: 'Quick Results' },
      { icon: '🔬', text: 'Certified Labs' },
      { icon: '📱', text: 'Digital Reports' }
    ]
  };

  // Loading state (matches existing pattern in GroomingServicesLanding)
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FF8C42] flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FF8C42] max-w-md mx-auto pb-24">
      {/* Header - Orange Background (matches GroomingServicesLanding) */}
      <div className="px-6 pt-12 pb-6">
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={onBack}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-2xl font-bold text-white">{config.icon} {config.displayName}</h1>
        </div>

        {/* Stats Bar - Glassmorphism (matches existing pattern) */}
        {stats && (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
              <div className="text-2xl font-bold text-white">{stats.activeProviders}+</div>
              <div className="text-white/80 text-xs">Active Providers</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
              <div className="text-2xl font-bold text-white">{stats.sessions}+</div>
              <div className="text-white/80 text-xs">Sessions Done</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
              <div className="flex items-center gap-1 text-2xl font-bold text-white">
                {stats.rating} <Star className="w-4 h-4 fill-white" />
              </div>
              <div className="text-white/80 text-xs">Avg Rating</div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content - White Background with Rounded Top (matches existing pattern) */}
      <div className="px-6 pt-8 pb-6 bg-white rounded-t-[32px] -mt-4 min-h-[calc(100vh-200px)]">
        {/* Service Highlights */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-[#FF8C42]" />
            <h2 className="text-lg font-semibold">Why Choose Us</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {serviceHighlights[serviceType]?.map((highlight, i) => (
              <Card 
                key={i}
                className="p-3 bg-white border border-gray-100 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{highlight.icon}</span>
                  <span className="text-sm font-medium text-gray-700">{highlight.text}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Problem Selection - What do you need? */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">What do you need?</h2>
          <div className="grid grid-cols-3 gap-3">
            {config.problems.slice(0, 6).map((problem) => (
              <Card
                key={problem.id}
                className="p-4 cursor-pointer hover:shadow-md transition-all border border-gray-100 bg-white shadow-sm text-center"
                onClick={() => onNavigate('problem_selected', { problemId: problem.id })}
              >
                <div className="text-2xl mb-2">{problem.icon}</div>
                <p className="text-xs font-medium text-gray-700 leading-tight">
                  {problem.name}
                </p>
              </Card>
            ))}
          </div>
        </div>

        {/* Featured Providers */}
        {featuredProviders.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Featured Providers</h2>
              <button 
                className="text-sm text-[#FF8C42] flex items-center gap-1"
                onClick={() => onNavigate('browse_providers')}
              >
                View All
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-3">
              {featuredProviders.slice(0, 3).map((provider, index) => (
                <Card 
                  key={index}
                  className="p-4 cursor-pointer hover:shadow-md transition-all bg-white border border-gray-100 shadow-sm"
                  onClick={() => onNavigate('quick_book', { vendorId: provider.id, vendorName: provider.name })}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 bg-gradient-to-br from-[#FF8C42] to-[#FF7029] rounded-xl flex items-center justify-center text-white text-xl font-bold overflow-hidden">
                      {provider.photo ? (
                        <img src={provider.photo} alt={provider.name} className="w-full h-full object-cover" />
                      ) : (
                        provider.name?.charAt(0) || config.icon
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">{provider.name || 'Provider'}</h3>
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1 text-amber-500">
                          <Star className="w-3 h-3 fill-current" />
                          <span className="font-semibold">{provider.rating?.toFixed(1) || '4.5'}</span>
                          <span className="text-gray-400">({provider.reviewCount || 0})</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-500">
                          <MapPin className="w-3 h-3" />
                          <span>{provider.distance?.toFixed(1) || '2.0'} km</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-[#FF8C42]">₹{provider.price || 199}</div>
                      <div className="text-xs text-gray-400">{config.priceUnit}</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Previous Providers - Book Again */}
        {previousProviders.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Repeat className="w-5 h-5 text-[#FF8C42]" />
              <h2 className="text-lg font-semibold">Book Again</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
              {previousProviders.map((provider) => (
                <Card
                  key={provider.id}
                  className="flex-shrink-0 p-4 w-36 cursor-pointer hover:shadow-md transition-all bg-white border border-gray-100 shadow-sm"
                  onClick={() => onNavigate('quick_book', { vendorId: provider.id, vendorName: provider.name })}
                >
                  <div className="w-14 h-14 rounded-full bg-gray-100 mx-auto mb-2 overflow-hidden">
                    {provider.photo ? (
                      <img
                        src={provider.photo}
                        alt={provider.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#FF8C42] to-[#FF7029] flex items-center justify-center text-white text-xl">
                        {config.icon}
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-800 truncate text-center">{provider.name}</p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    <span className="text-xs text-gray-600">{provider.rating?.toFixed(1) || '4.5'}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 text-center">{provider.lastVisit}</p>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Featured Packages */}
        {config.supportsPackages && featuredPackages.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-[#FF8C42]" />
                <h2 className="text-lg font-semibold">Packages</h2>
              </div>
              <Badge className="bg-green-100 text-green-700 border-none">Save more</Badge>
            </div>
            <div className="space-y-3">
              {featuredPackages.slice(0, 3).map((pkg) => (
                <Card
                  key={pkg.id}
                  className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-800">{pkg.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{pkg.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Repeat className="w-4 h-4 text-[#FF8C42]" />
                        <span className="text-sm text-gray-700">{pkg.sessions} sessions</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-[#FF8C42]">₹{pkg.price}</span>
                        {pkg.discount > 0 && (
                          <Badge className="bg-green-500 text-white border-none text-xs">
                            -{pkg.discount}%
                          </Badge>
                        )}
                      </div>
                      {pkg.originalPrice > pkg.price && (
                        <span className="text-sm text-gray-400 line-through">₹{pkg.originalPrice}</span>
                      )}
                    </div>
                  </div>
                  <Button 
                    variant="outline"
                    className="w-full mt-3 border-orange-200 text-[#FF8C42] hover:bg-orange-50"
                  >
                    Buy Package
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Browse All CTA */}
        <Button
          onClick={() => onNavigate('browse_providers')}
          className="w-full py-6 rounded-2xl text-white font-semibold text-lg bg-[#FF8C42] hover:bg-[#e67d3a] shadow-lg"
        >
          <Sparkles className="w-5 h-5 mr-2" />
          Find {config.displayName} Near Me
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}

export default HomeServiceLanding;
