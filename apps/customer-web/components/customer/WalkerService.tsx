"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Bike, Star, MapPin, Clock, Search, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface WalkerServiceProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function WalkerService({ phone, onBack, onNavigate }: WalkerServiceProps) {
  const [loading, setLoading] = useState(true);
  const [walkers, setWalkers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadWalkers();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const timeout = setTimeout(() => loadWalkers(), 300);
      return () => clearTimeout(timeout);
    }
  }, [searchQuery]);

  const loadWalkers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        roleId: 'pet_walker',
        ...(searchQuery && { query: searchQuery })
      });

      // Append params to URL query string
      const endpoint = `/customer/vendors/search${params.toString() ? `?${params.toString()}` : ''}`;
      const data = await apiClient.get<{ vendors?: any[]; services?: any[]; staff?: any[] }>(endpoint);
      const walkerList = data.vendors || data.services || data.staff || [];
      setWalkers(walkerList);
    } catch (error) {
      console.error('Error loading walkers:', error);
      // No mock fallback - show empty state when API fails
      setWalkers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleWalkerSelect = (walker: any) => {
    onNavigate?.('create-booking', { vendorId: walker.id || walker.vendorId, serviceType: 'walking' });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Pet Walking</h1>
            <p className="text-white/90 text-sm">Professional dog walking services</p>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
            <input
              type="text"
              placeholder="Search walkers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/20 backdrop-blur rounded-lg text-white placeholder-white/70 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Hero Banner */}
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Professional Pet Walking</h2>
              <p className="text-gray-700 mb-4">Exercise, companionship & care</p>
            </div>
            <div className="text-5xl">🚶</div>
          </div>
        </Card>

        {/* Walk Packages */}
        <div>
          <h2 className="font-bold text-gray-900 mb-4">Walk Packages</h2>
          <div className="space-y-3">
            {[
              { icon: '🚶', title: '30 Min Walk', price: '₹199/walk', features: ['Quick exercise', 'Basic walk'] },
              { icon: '🏃', title: '60 Min Walk', price: '₹349/walk', features: ['Extended exercise', 'Playtime'] },
              { icon: '📅', title: 'Weekly Package', price: '₹1,999/week', features: ['5 walks', 'GPS tracking', 'Updates'] }
            ].map((pkg, idx) => (
              <Card key={idx} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl flex items-center justify-center text-2xl">
                    {pkg.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">{pkg.title}</h3>
                    <p className="text-green-600 font-bold mb-2">{pkg.price}</p>
                    {pkg.features.map((f, i) => (
                      <div key={i} className="text-sm text-gray-600">• {f}</div>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Walkers List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Available Walkers</h2>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
            </div>
          ) : walkers.length === 0 ? (
            <Card className="p-8 text-center">
              <Bike className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">No Walkers Found</h3>
              <p className="text-sm text-gray-500">Try adjusting your search or check back later</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {walkers.map((walker, index) => (
                <Card 
                  key={walker.id || walker.vendorId || index} 
                  className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => handleWalkerSelect(walker)}
                >
                  {/* Walker Image */}
                  <div className="h-48 bg-gradient-to-br from-green-200 to-emerald-200 relative">
                    <div className="absolute inset-0 flex items-center justify-center text-6xl">
                      <Bike className="w-16 h-16 text-green-600 opacity-30" />
                    </div>
                    <div className="absolute top-3 right-3 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                      <Star className="w-3 h-3 fill-white" />
                      {walker.rating || 4.5}
                    </div>
                  </div>

                  {/* Walker Details */}
                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">{walker.name || walker.businessName || 'Pet Walker'}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                        <MapPin className="w-4 h-4" />
                        <span>{walker.location?.address || walker.address || walker.city || 'Location'}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-sm">
                        <span className="text-gray-600">{walker.reviewsCount || walker.reviewCount || 0} reviews</span>
                        {walker.priceRange && (
                          <span className="text-green-600 font-semibold">{walker.priceRange}</span>
                        )}
                        {walker.experience && (
                          <span className="text-gray-500">• {walker.experience}</span>
                        )}
                      </div>
                    </div>

                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleWalkerSelect(walker);
                      }}
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white h-12 text-base font-semibold shadow-lg"
                    >
                      <Bike className="w-5 h-5 mr-2" />
                      Book Walker
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Walking Features */}
        <Card className="p-6 bg-gradient-to-br from-gray-50 to-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">Why Choose Us?</h3>
          <div className="space-y-3">
            {[
              { icon: '📍', title: 'GPS Tracking', desc: 'Real-time location tracking' },
              { icon: '⏱️', title: 'Flexible Timing', desc: 'Book walks on your schedule' },
              { icon: '📸', title: 'Walk Reports', desc: 'Photos & activity updates' },
              { icon: '🛡️', title: 'Insured & Bonded', desc: 'Fully insured walkers' }
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
      </div>
    </div>
  );
}
