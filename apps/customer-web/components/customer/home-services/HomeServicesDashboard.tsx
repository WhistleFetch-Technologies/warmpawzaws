"use client";

/**
 * HomeServicesDashboard - Entry point for all home-based pet services
 * 
 * Provides unified access to:
 * - Pet Walking
 * - Home Grooming
 * - Home Training
 * - Home Vet Visit
 * - Pet Sitting
 * - Nutritionist Visit
 * 
 * Features consistent UI matching the clinic flow design
 */

import { useState, useEffect } from 'react';
import { ArrowLeft, Home, MapPin, Clock, Star, Package, ChevronRight, Zap, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { HOME_SERVICE_CONFIGS } from './index';
import { HomeServiceRouter, HomeServiceType } from './HomeServiceRouter';
import { PromotionBanner } from '../shared/PromotionBanner';

interface HomeServicesDashboardProps {
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  initialService?: HomeServiceType;
}

interface ActiveBooking {
  id: string;
  serviceName: string;
  serviceType: string;
  providerName: string;
  providerPhoto?: string;
  status: string;
  scheduledDate: string;
  scheduledTime: string;
  petName: string;
  hasLiveTracking: boolean;
}

interface ActivePackage {
  id: string;
  packageName: string;
  vendorName: string;
  serviceType: string;
  remainingSessions: number | 'unlimited';
  expiresAt: string | null;
}

export function HomeServicesDashboard({
  phone,
  onBack,
  onNavigate,
  initialService
}: HomeServicesDashboardProps) {
  const [selectedService, setSelectedService] = useState<HomeServiceType | null>(initialService || null);
  const [loading, setLoading] = useState(true);
  const [activeBookings, setActiveBookings] = useState<ActiveBooking[]>([]);
  const [activePackages, setActivePackages] = useState<ActivePackage[]>([]);
  const [lastBookedServices, setLastBookedServices] = useState<string[]>([]);

  useEffect(() => {
    if (!selectedService) {
      loadDashboardData();
    }
  }, [phone, selectedService]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Parallel data fetching
      const [bookingsRes, packagesRes, historyRes] = await Promise.allSettled([
        apiClient.get<any>(`/customer/${phone}/bookings?status=active&serviceStyle=at_home`),
        apiClient.get<any>(`/customer/${phone}/packages?serviceStyle=at_home`),
        apiClient.get<any>(`/customer/${phone}/service-history?serviceStyle=at_home&limit=5`)
      ]);

      if (bookingsRes.status === 'fulfilled' && bookingsRes.value.bookings) {
        setActiveBookings(bookingsRes.value.bookings);
      }

      if (packagesRes.status === 'fulfilled' && packagesRes.value.packages) {
        setActivePackages(packagesRes.value.packages);
      }

      if (historyRes.status === 'fulfilled' && historyRes.value.services) {
        setLastBookedServices(historyRes.value.services.map((s: any) => s.serviceType));
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  // Loading state (P3 optional) – standard orange to match vet dashboard theme
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 max-w-md mx-auto flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#FF8C42] border-t-transparent" />
          <p className="text-sm text-gray-500">Loading home services...</p>
        </div>
      </div>
    );
  }

  // If a service is selected, show the booking router
  if (selectedService) {
    const config = HOME_SERVICE_CONFIGS[selectedService];
    return (
      <HomeServiceRouter
        phone={phone}
        serviceType={selectedService}
        serviceName={config.serviceName}
        serviceIcon={config.serviceIcon}
        primaryColor={config.primaryColor}
        onBack={() => setSelectedService(null)}
        onNavigate={onNavigate}
      />
    );
  }

  // Service cards with their configurations
  const serviceCards = Object.entries(HOME_SERVICE_CONFIGS).map(([key, config]) => ({
    id: key as HomeServiceType,
    ...config,
    isLastBooked: lastBookedServices.includes(key)
  }));

  // Separate into recently used and all services
  const recentlyUsed = serviceCards.filter(s => s.isLastBooked);
  const allServices = serviceCards;

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      {/* Header – standard orange to match vet dashboard (forensic theme compliance) */}
      <div className="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] text-white px-4 py-6 pb-8">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Home className="w-6 h-6" />
              Home Services
            </h1>
            <p className="text-white/80 text-sm">Professional pet care at your doorstep</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
          <input
            type="text"
            placeholder="Search home services..."
            className="w-full pl-10 pr-4 py-3 bg-white/20 backdrop-blur rounded-xl text-white placeholder-white/70 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
          />
        </div>
      </div>

      <div className="p-4 -mt-4 space-y-6">
        {/* Active Bookings */}
        {activeBookings.length > 0 && (
          <Card className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-blue-900 flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-600" />
                Active Bookings
              </h2>
              <Badge className="bg-blue-100 text-blue-700">{activeBookings.length}</Badge>
            </div>
            
            <div className="space-y-2">
              {activeBookings.slice(0, 2).map(booking => (
                <div 
                  key={booking.id}
                  onClick={() => onNavigate('booking-tracking', { bookingId: booking.id })}
                  className="flex items-center justify-between bg-white rounded-lg p-3 cursor-pointer hover:shadow-md transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      {HOME_SERVICE_CONFIGS[booking.serviceType as HomeServiceType]?.serviceIcon || '📦'}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{booking.serviceName}</p>
                      <p className="text-xs text-gray-500">
                        {booking.providerName} • {booking.petName}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className={
                      booking.status === 'in_progress' ? 'bg-green-100 text-green-700' :
                      booking.status === 'traveling' ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-700'
                    }>
                      {booking.status === 'in_progress' ? 'Live' : 
                       booking.status === 'traveling' ? 'On Way' : 
                       booking.status}
                    </Badge>
                    {booking.hasLiveTracking && (
                      <p className="text-xs text-blue-600 mt-1">Track →</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Active Packages */}
        {activePackages.length > 0 && (
          <Card className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-purple-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-purple-600" />
                Your Packages
              </h2>
              <button 
                onClick={() => onNavigate('package-tracking')}
                className="text-sm text-purple-600 hover:text-purple-800"
              >
                View All →
              </button>
            </div>
            
            <div className="space-y-2">
              {activePackages.slice(0, 2).map(pkg => (
                <div 
                  key={pkg.id}
                  className="flex items-center justify-between bg-white rounded-lg p-3"
                >
                  <div>
                    <p className="font-medium text-gray-900">{pkg.packageName}</p>
                    <p className="text-xs text-gray-500">{pkg.vendorName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-purple-600">
                      {pkg.remainingSessions === 'unlimited' ? '∞' : pkg.remainingSessions}
                    </p>
                    <p className="text-xs text-gray-500">sessions left</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Promotions */}
        <PromotionBanner service="home_service" />

        {/* Recently Used Services */}
        {recentlyUsed.length > 0 && (
          <div>
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-400" />
              Recently Used
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {recentlyUsed.map(service => (
                <Card
                  key={service.id}
                  onClick={() => setSelectedService(service.id)}
                  className="p-4 cursor-pointer hover:shadow-lg transition-all border-2 border-transparent hover:border-green-200"
                >
                  <div className="text-3xl mb-2">{service.serviceIcon}</div>
                  <h3 className="font-semibold text-gray-900">{service.serviceName}</h3>
                  <p className="text-xs text-gray-500 mt-1">Tap to book again</p>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* All Home Services */}
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">All Home Services</h2>
          <div className="space-y-3">
            {allServices.map(service => (
              <Card
                key={service.id}
                onClick={() => setSelectedService(service.id)}
                className="p-4 cursor-pointer hover:shadow-lg transition-all flex items-center gap-4"
              >
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl ${
                  service.primaryColor === 'green' ? 'bg-green-100' :
                  service.primaryColor === 'purple' ? 'bg-purple-100' :
                  service.primaryColor === 'blue' ? 'bg-blue-100' :
                  'bg-orange-100'
                }`}>
                  {service.serviceIcon}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{service.serviceName}</h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <MapPin className="w-3 h-3" />
                    <span>At your location</span>
                    {service.requiresRouteTracking && (
                      <Badge variant="secondary" className="text-xs">
                        Live Tracking
                      </Badge>
                    )}
                  </div>
                </div>
                <ChevronRight className={`w-5 h-5 ${
                  service.primaryColor === 'green' ? 'text-green-600' :
                  service.primaryColor === 'purple' ? 'text-purple-600' :
                  service.primaryColor === 'blue' ? 'text-blue-600' :
                  'text-orange-600'
                }`} />
              </Card>
            ))}
          </div>
        </div>

        {/* Why Home Services */}
        <Card className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <h3 className="font-semibold text-green-900 mb-3">Why Home Services?</h3>
          <div className="space-y-2">
            {[
              { icon: '🏠', text: 'Comfort of your home for your pet' },
              { icon: '📍', text: 'Real-time tracking of service provider' },
              { icon: '⏱️', text: 'No travel time, service at your convenience' },
              { icon: '🔒', text: 'OTP-verified sessions for safety' }
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="text-lg">{item.icon}</span>
                <span className="text-sm text-green-800">{item.text}</span>
              </div>
            ))}
          </div>
        </Card>

        <div className="pb-8" />
      </div>
    </div>
  );
}

export default HomeServicesDashboard;
