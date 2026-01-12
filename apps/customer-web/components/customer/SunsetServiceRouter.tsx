"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Heart, Flower, Star, MapPin, Search, Clock, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface SunsetServiceRouterProps {
  phone: string;
  onBack: () => void;
  onViewBooking?: (bookingId: string) => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function SunsetServiceRouter({ phone, onBack, onViewBooking, onNavigate }: SunsetServiceRouterProps) {
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadProviders();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const timeout = setTimeout(() => loadProviders(), 300);
      return () => clearTimeout(timeout);
    }
  }, [searchQuery]);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        roleId: 'pet_sunset_services'
      });
      
      if (searchQuery) {
        params.append('query', searchQuery);
      }

      // Append params to URL query string
      const endpoint = `/customer/vendors/search${params.toString() ? `?${params.toString()}` : ''}`;
      const data = await apiClient.get<{ vendors?: any[]; services?: any[] }>(endpoint);
      const providerList = data.vendors || data.services || [];
      setProviders(providerList);
    } catch (error) {
      console.error('Error loading sunset service providers:', error);
      // No mock fallback - show empty state when API fails
      setProviders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderSelect = (provider: any) => {
    onNavigate?.('create-booking', { vendorId: provider.id || provider.vendorId, serviceType: 'sunset' });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-700 to-indigo-700 text-white px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Sunset Services</h1>
            <p className="text-white/90 text-sm">Compassionate end-of-life care</p>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
            <input
              type="text"
              placeholder="Search providers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/20 backdrop-blur rounded-lg text-white placeholder-white/70 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Hero Banner */}
        <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Compassionate Care</h2>
              <p className="text-gray-700 mb-4">Dignified end-of-life services for your beloved pet</p>
            </div>
            <div className="text-5xl">🌸</div>
          </div>
        </Card>

        {/* Service Types */}
        <div>
          <h2 className="font-bold text-gray-900 mb-4">Services Available</h2>
          <div className="space-y-3">
            {[
              { icon: '💐', title: 'Cremation Services', desc: 'Respectful and dignified cremation', price: '₹2,999 onwards' },
              { icon: '🕊️', title: 'Memorial Services', desc: 'Honoring your pet\'s memory', price: '₹999 onwards' },
              { icon: '📿', title: 'Grief Counseling', desc: 'Support during difficult times', price: '₹499 onwards' },
              { icon: '🌺', title: 'Memorial Products', desc: 'Keepsakes and remembrance items', price: '₹299 onwards' }
            ].map((service, idx) => (
              <Card key={idx} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-xl flex items-center justify-center text-2xl">
                    {service.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">{service.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{service.desc}</p>
                    <p className="text-purple-600 font-semibold mt-2">{service.price}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Information Section */}
        <Card className="p-6 bg-gradient-to-br from-gray-50 to-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">Our Promise</h3>
          <div className="space-y-3">
            {[
              { icon: '❤️', title: 'Compassionate Care', desc: 'Sensitive and respectful service' },
              { icon: '🤝', title: '24/7 Support', desc: 'Available when you need us most' },
              { icon: '🌹', title: 'Dignified Process', desc: 'Honoring your pet\'s memory' },
              { icon: '💝', title: 'Memorial Options', desc: 'Various ways to remember your pet' }
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm">
                  {item.icon}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{item.title}</h4>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Service Providers List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Service Providers</h2>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
          ) : providers.length === 0 ? (
            <Card className="p-8 text-center">
              <Flower className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">No Service Providers Found</h3>
              <p className="text-sm text-gray-500">Try adjusting your search or check back later</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {providers.map((provider, index) => (
                <Card 
                  key={provider.id || provider.vendorId || index} 
                  className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => handleProviderSelect(provider)}
                >
                  {/* Provider Image */}
                  <div className="h-48 bg-gradient-to-br from-purple-200 to-indigo-200 relative">
                    <div className="absolute inset-0 flex items-center justify-center text-6xl">
                      <Flower className="w-16 h-16 text-purple-600 opacity-30" />
                    </div>
                    <div className="absolute top-3 right-3 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                      <Star className="w-3 h-3 fill-white" />
                      {provider.rating || 4.8}
                    </div>
                  </div>

                  {/* Provider Details */}
                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">{provider.businessName || provider.name || 'Sunset Services'}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                        <MapPin className="w-4 h-4" />
                        <span>{provider.location?.address || provider.address || 'Location'}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-sm">
                        <span className="text-gray-600">{provider.reviewsCount || 0} reviews</span>
                        {provider.priceRange && (
                          <span className="text-purple-600 font-semibold">{provider.priceRange}</span>
                        )}
                      </div>
                    </div>

                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleProviderSelect(provider);
                      }}
                      className="w-full bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white h-12 text-base font-semibold shadow-lg"
                    >
                      <Heart className="w-5 h-5 mr-2" />
                      Contact Provider
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Help & Support */}
        <Card className="p-6 bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-2xl">
              💙
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-gray-900 mb-1">Need Immediate Assistance?</h4>
              <p className="text-sm text-gray-600 mb-3">Our compassionate team is available 24/7 to help during this difficult time.</p>
              <Button 
                variant="outline" 
                className="border-purple-300 text-purple-700 hover:bg-purple-50"
                onClick={() => {
                  if (onNavigate) onNavigate('create-booking', { serviceType: 'sunset', urgent: true });
                }}
              >
                Get Help Now
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
