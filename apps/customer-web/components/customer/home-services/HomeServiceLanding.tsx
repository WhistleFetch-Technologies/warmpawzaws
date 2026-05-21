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

"use client";

import { useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { apiClient } from '@/lib/api-client';
import { isEmergencyProblemTileLocked } from '@/lib/problem-grid-emergency-lock';
import { SERVICE_CONFIGS, HomeServiceType } from './UniversalHomeServiceRouter';
import { VendorRatingDisplay } from '../shared/VendorRatingDisplay';

// Map config roleId to roleId used in specialization_master applicable_roles
const ROLE_ID_FOR_PROBLEM_GRID: Record<string, string> = {
  dog_walker: 'walker', pet_walker: 'walker', walker: 'walker',
  pet_groomer: 'groomer', groomer: 'groomer',
  pet_trainer: 'trainer', trainer: 'trainer',
  veterinarian: 'veterinarian', vet_solo: 'veterinarian', vet_clinic: 'veterinarian',
  pet_behaviourist: 'behaviourist', behaviorist: 'behaviourist', behaviourist: 'behaviourist',
  boarding: 'boarding', pet_boarding: 'boarding',
  nutritionist: 'nutritionist', pet_nutritionist: 'nutritionist',
};

function ProblemIcon({ problem }: { problem: { iconName?: string; iconColor?: string; icon?: string } }) {
  if (problem.iconName && (LucideIcons as any)[problem.iconName]) {
    const Icon = (LucideIcons as any)[problem.iconName];
    return <Icon className={`w-6 h-6 ${problem.iconColor || 'text-gray-600'}`} />;
  }
  return <span className="text-2xl">{problem.icon || '•'}</span>;
}

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

  const [previousProviders, setPreviousProviders] = useState<PreviousProvider[]>([]);
  const [featuredPackages, setFeaturedPackages] = useState<FeaturedPackage[]>([]);
  const [featuredProviders, setFeaturedProviders] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [problemsFromApi, setProblemsFromApi] = useState<Array<{ id: string; name: string; icon?: string; iconName?: string; iconColor?: string }> | null>(null);

  useEffect(() => {
    loadLandingData();
  }, [serviceType, customerId, phone]);

  // Load "What do you need?" problems from Catalog (specialization_master) so admin-created specializations appear
  useEffect(() => {
    const apiRoleId = ROLE_ID_FOR_PROBLEM_GRID[config.roleId] || config.roleId;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient.get<{ success?: boolean; problems?: any[] }>(`/public/problem-grid/${apiRoleId}`);
        if (cancelled || !data?.success || !Array.isArray(data.problems)) return;
        const list = data.problems.map((p: any) => ({
          id: p.id,
          name: p.displayName || p.name,
          iconName: p.iconName,
          iconColor: p.iconColor,
        }));
        if (!cancelled && list.length > 0) setProblemsFromApi(list);
      } catch (_) {
        // Keep config.problems as fallback
      }
    })();
    return () => { cancelled = true; };
  }, [config.roleId]);

  const loadLandingData = async () => {
    try {
      setLoading(true);

      // Load services data to get providers using apiClient
      try {
        const data = await apiClient.get<{ services: any[] }>(`/customer/services?roleId=${config.roleId}`);
        const services = data.services || [];

        // Extract unique vendors
        const vendorMap = new Map();
        services.forEach((service: any) => {
          const vendorId = service.vendorId;
          if (!vendorMap.has(vendorId)) {
            const rc = Number(service.vendorReviewCount ?? 0) || 0;
            const rawV = service.vendorRating != null ? Number(service.vendorRating) : NaN;
            const vr = rc > 0 && Number.isFinite(rawV) && rawV > 0 ? rawV : 0;
            vendorMap.set(vendorId, {
              id: vendorId,
              name: service.vendorName || 'Provider',
              photo: service.vendorPhoto || service.vendorLogo,
              rating: vr,
              reviewCount: rc,
              distance: service.distance ?? null,
              price: service.price || 0
            });
          }
        });

        const allProviders = Array.from(vendorMap.values());
        setFeaturedProviders(allProviders.slice(0, 5));

        setStats({
          activeProviders: allProviders.length || 50,
          sessions: '5K',
        });
      } catch (e) {
        setStats({ activeProviders: 50, sessions: '5K' });
      }

      // Load previous providers for this customer
      if (customerId) {
        try {
          const data = await apiClient.get<{ bookings: any[] }>(`/customer/${customerId}/bookings?serviceType=${serviceType}&limit=5`);
          const bookings = data.bookings || [];
          
          // Extract unique vendors from previous bookings
          const prevVendorMap = new Map();
          bookings.forEach((booking: any) => {
            if (booking.vendorId && !prevVendorMap.has(booking.vendorId)) {
              const brc = Number(booking.vendorReviewCount ?? 0) || 0;
              const braw = booking.vendorRating != null ? Number(booking.vendorRating) : NaN;
              const br = brc > 0 && Number.isFinite(braw) && braw > 0 ? braw : 0;
              prevVendorMap.set(booking.vendorId, {
                id: booking.vendorId,
                name: booking.vendorName || 'Provider',
                photo: booking.vendorPhoto,
                rating: br,
                lastVisit: new Date(booking.scheduledDate).toLocaleDateString()
              });
            }
          });
          setPreviousProviders(Array.from(prevVendorMap.values()));
        } catch (e) {
          console.log('No previous bookings found');
        }
      }

      // Load featured packages if service supports it
      if (config.supportsPackages) {
        try {
          const data = await apiClient.get<{ packages: any[] }>(`/packages?roleId=${config.roleId}&featured=true`);
          setFeaturedPackages(data.packages || []);
        } catch (e) {
          console.log('No packages found');
        }
      }
    } catch (error) {
      console.error('Error loading landing data:', error);
      setStats({ activeProviders: 50, sessions: '5K' });
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
      <div className="px-6 cw-header-safe-top pb-6">
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={onBack}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-2xl font-bold text-white">{config.icon} {config.displayName}</h1>
        </div>

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

        {/* Problem Selection - What do you need? (from Catalog when available) */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">What do you need?</h2>
          <div className="grid grid-cols-3 gap-3">
            {(problemsFromApi && problemsFromApi.length > 0 ? problemsFromApi : config.problems).slice(0, 6).map((problem) => {
              const locked = isEmergencyProblemTileLocked({ id: problem.id, name: problem.name });
              return (
              <Card
                key={problem.id}
                className={`p-4 transition-all border border-gray-100 bg-white shadow-sm text-center relative ${
                  locked
                    ? 'cursor-not-allowed opacity-80'
                    : 'cursor-pointer hover:shadow-md'
                }`}
                onClick={
                  locked
                    ? undefined
                    : () => onNavigate('problem_selected', { problemId: problem.id })
                }
              >
                {locked && (
                  <span className="absolute top-2 right-2 text-[8px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-md">
                    Soon
                  </span>
                )}
                <div className="flex justify-center mb-2 min-h-[2rem]">
                  {'iconName' in problem ? <ProblemIcon problem={problem} /> : <span className="text-2xl">{(problem as any).icon}</span>}
                </div>
                <p className={`text-xs font-medium leading-tight ${locked ? 'text-slate-500' : 'text-gray-700'}`}>
                  {problem.name}
                </p>
              </Card>
            );
            })}
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
                        <VendorRatingDisplay
                          row={{
                            vendorId: provider.id,
                            vendorRating: provider.rating,
                            vendorReviewCount: provider.reviewCount,
                          }}
                          vendorId={String(provider.id ?? '')}
                          starsClassName="w-3 h-3"
                          textClassName="text-xs text-gray-500"
                        />
                        <div className="flex items-center gap-1 text-gray-500">
                          <MapPin className="w-3 h-3" />
                          <span>{provider.distance != null
                            ? (provider.distance < 1
                              ? `${Math.round(provider.distance * 1000)} m`
                              : `${Math.round(provider.distance)} km`)
                            : null}</span>
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
                    <VendorRatingDisplay
                      row={{
                        vendorId: provider.id,
                        vendorRating: provider.rating,
                        vendorReviewCount: provider.reviewCount,
                      }}
                      vendorId={String(provider.id ?? '')}
                      starsClassName="w-3 h-3"
                      textClassName="text-xs text-gray-600"
                    />
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
              <Badge className="border-none bg-orange-100 text-orange-800">Save more</Badge>
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
                          <Badge className="border-none bg-[#FF8C42] text-xs text-white">
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
