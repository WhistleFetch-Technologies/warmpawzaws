"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Palmtree, Star, MapPin, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface ResortServicesLandingProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function ResortServicesLanding({ phone, onBack, onNavigate }: ResortServicesLandingProps) {
  const [loading, setLoading] = useState(true);
  const [resorts, setResorts] = useState<any[]>([]);

  useEffect(() => {
    loadResorts();
  }, []);

  const loadResorts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        roleId: 'pet_resort'
      });

      // Append params to URL query string
      const endpoint = `/customer/vendors/search${params.toString() ? `?${params.toString()}` : ''}`;
      const data = await apiClient.get<{ vendors?: any[]; services?: any[] }>(endpoint);
      const resortList = data.vendors || data.services || [];
      setResorts(resortList);
    } catch (error) {
      console.error('Error loading resorts:', error);
      // No mock fallback - show empty state when API fails
      setResorts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckAvailability = async (resortId: string) => {
    try {
      // Connect to MockAPI/API to check availability
      const data = await apiClient.get<{ available?: boolean; message?: string }>(`/vendor/${resortId}/resort/availability`);
      
      if (data.available !== false) {
        // Navigate to booking flow
        if (onNavigate) {
          onNavigate('resort_booking', { vendorId: resortId });
        } else {
          toast.success('Resort is available! Proceeding to booking...');
        }
      } else {
        toast.error(data.message || 'Resort is currently unavailable');
      }
    } catch (error: any) {
      console.error('Error checking availability:', error);
      // Proceed anyway - optimistic flow
      if (onNavigate) {
        onNavigate('resort_booking', { vendorId: resortId });
      } else {
        toast.info('Proceeding to booking...');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Pet Resorts</h1>
            <p className="text-white/90 text-sm">Luxury vacation for your pets</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Hero Banner */}
        <Card className="bg-gradient-to-br from-teal-50 to-cyan-50 border-teal-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-2">5-Star Pet Experience</h2>
              <p className="text-gray-700 mb-4">Spa, pool, gourmet meals & more</p>
              <Button 
                className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white shadow-lg"
                onClick={() => {
                  if (onNavigate) onNavigate('resort_booking');
                }}
              >
                Explore Resorts
              </Button>
            </div>
            <div className="text-5xl">🏝️</div>
          </div>
        </Card>

        {/* Resort Packages */}
        <div>
          <h2 className="font-bold text-gray-900 mb-4">Resort Packages</h2>
          <div className="space-y-3">
            {[
              { icon: '🌊', title: 'Weekend Getaway', price: '₹3,999/day', features: ['Pool access', 'Spa session'] },
              { icon: '💎', title: 'Luxury Suite', price: '₹7,999/day', features: ['Private suite', 'Gourmet meals', '24/7 care'] },
              { icon: '🎉', title: 'Birthday Package', price: '₹12,999', features: ['Party setup', 'Cake', 'Photoshoot'] }
            ].map((pkg, idx) => (
              <Card key={idx} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-teal-100 to-cyan-100 rounded-xl flex items-center justify-center text-2xl">
                    {pkg.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">{pkg.title}</h3>
                    <p className="text-teal-600 font-bold mb-2">{pkg.price}</p>
                    {pkg.features.map((f, i) => (
                      <div key={i} className="text-sm text-gray-600">• {f}</div>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Luxury Pet Resorts List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Luxury Pet Resorts</h2>
          </div>

          {resorts.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="text-4xl mb-3">🏝️</div>
              <p className="text-gray-600 mb-2">No pet resorts available yet</p>
              <p className="text-gray-500 text-sm">Check back soon for luxury pet resort experiences!</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {resorts.map((resort, index) => (
                <Card key={resort.id || index} className="overflow-hidden hover:shadow-lg transition-shadow">
                  {/* Resort Image */}
                  <div className="h-48 bg-gradient-to-br from-teal-200 to-cyan-200 relative">
                    <div className="absolute inset-0 flex items-center justify-center text-6xl">
                      <Palmtree className="w-16 h-16 text-teal-600 opacity-30" />
                    </div>
                    <div className="absolute top-3 right-3 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                      <Star className="w-3 h-3 fill-white" />
                      {resort.rating || 4.5}
                    </div>
                  </div>

                  {/* Resort Details */}
                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">{resort.businessName || resort.name || 'Pet Resort'}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                        <MapPin className="w-4 h-4" />
                        <span>{resort.location?.address || resort.address || 'Location'}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-sm">
                        <span className="text-gray-600">{resort.reviewsCount || 0} reviews</span>
                        <span className="text-teal-600 font-semibold">{resort.priceRange || '₹3,999/day'}</span>
                      </div>
                    </div>

                    {/* Check Availability Button */}
                    <Button
                      onClick={() => handleCheckAvailability(resort.id || resort.vendorId)}
                      className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white h-12 text-base font-semibold shadow-lg"
                    >
                      <Calendar className="w-5 h-5 mr-2" />
                      Check Availability
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Resort Features Section */}
        <Card className="p-6 bg-gradient-to-br from-gray-50 to-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">Resort Amenities</h3>
          <div className="space-y-3">
            {[
              { icon: '🏊', title: 'Swimming Pools', desc: 'Temperature-controlled pet pools' },
              { icon: '💆', title: 'Spa & Grooming', desc: 'Professional pampering services' },
              { icon: '🍽️', title: 'Gourmet Meals', desc: 'Chef-prepared pet cuisine' },
              { icon: '📸', title: 'Daily Updates', desc: 'Photos & videos of your pet' }
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