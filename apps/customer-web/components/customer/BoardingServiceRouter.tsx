"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Home, Star, MapPin, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface BoardingServiceRouterProps {
  phone: string;
  onBack: () => void;
  onViewBooking?: (bookingId: string) => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function BoardingServiceRouter({ phone, onBack, onViewBooking, onNavigate }: BoardingServiceRouterProps) {
  const [loading, setLoading] = useState(true);
  const [boardingFacilities, setBoardingFacilities] = useState<any[]>([]);

  useEffect(() => {
    loadBoardingFacilities();
  }, []);

  const loadBoardingFacilities = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        roleId: 'pet_boarding'
      });

      // Append params to URL query string
      const endpoint = `/customer/vendors/search${params.toString() ? `?${params.toString()}` : ''}`;
      const data = await apiClient.get<{ vendors?: any[]; services?: any[] }>(endpoint);
      const facilityList = data.vendors || data.services || [];
      setBoardingFacilities(facilityList);
    } catch (error) {
      console.error('Error loading boarding facilities:', error);
      // No mock fallback - show empty state when API fails
      setBoardingFacilities([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckAvailability = async (facilityId: string) => {
    try {
      const data = await apiClient.get<{ available?: boolean; message?: string }>(`/vendor/${facilityId}/boarding/availability`);
      
      if (data.available !== false) {
        if (onNavigate) {
          onNavigate('create-booking', { vendorId: facilityId, serviceType: 'boarding' });
        } else {
          toast.success('Facility is available! Proceeding to booking...');
        }
      } else {
        toast.error(data.message || 'Facility is currently unavailable');
      }
    } catch (error: any) {
      console.error('Error checking availability:', error);
      // Proceed anyway - optimistic flow
      if (onNavigate) {
        onNavigate('create-booking', { vendorId: facilityId, serviceType: 'boarding' });
      } else {
        toast.info('Proceeding to booking...');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Pet Boarding</h1>
            <p className="text-white/90 text-sm">Safe & comfortable pet stays</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Hero Banner */}
        <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Safe Pet Boarding</h2>
              <p className="text-gray-700 mb-4">Professional care when you're away</p>
              <Button 
                className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-lg"
                onClick={() => {
                  if (onNavigate) onNavigate('create-booking', { serviceType: 'boarding' });
                }}
              >
                Book Boarding
              </Button>
            </div>
            <div className="text-5xl">🏠</div>
          </div>
        </Card>

        {/* Boarding Packages */}
        <div>
          <h2 className="font-bold text-gray-900 mb-4">Boarding Packages</h2>
          <div className="space-y-3">
            {[
              { icon: '🌙', title: 'Overnight Stay', price: '₹999/night', features: ['24/7 care', 'Meals included'] },
              { icon: '📅', title: 'Weekly Boarding', price: '₹5,999/week', features: ['7 days', 'Daily updates', 'Exercise'] },
              { icon: '🏖️', title: 'Extended Stay', price: '₹19,999/month', features: ['Long-term care', 'Regular check-ins'] }
            ].map((pkg, idx) => (
              <Card key={idx} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-xl flex items-center justify-center text-2xl">
                    {pkg.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">{pkg.title}</h3>
                    <p className="text-indigo-600 font-bold mb-2">{pkg.price}</p>
                    {pkg.features.map((f, i) => (
                      <div key={i} className="text-sm text-gray-600">• {f}</div>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Boarding Facilities List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Boarding Facilities</h2>
          </div>

          {boardingFacilities.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="text-4xl mb-3">🏠</div>
              <p className="text-gray-600 mb-2">No boarding facilities available yet</p>
              <p className="text-gray-500 text-sm">Check back soon for boarding options!</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {boardingFacilities.map((facility, index) => (
                <Card key={facility.id || index} className="overflow-hidden hover:shadow-lg transition-shadow">
                  {/* Facility Image */}
                  <div className="h-48 bg-gradient-to-br from-indigo-200 to-blue-200 relative">
                    <div className="absolute inset-0 flex items-center justify-center text-6xl">
                      <Home className="w-16 h-16 text-indigo-600 opacity-30" />
                    </div>
                    <div className="absolute top-3 right-3 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                      <Star className="w-3 h-3 fill-white" />
                      {facility.rating || 4.5}
                    </div>
                  </div>

                  {/* Facility Details */}
                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">{facility.businessName || facility.name || 'Boarding Facility'}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                        <MapPin className="w-4 h-4" />
                        <span>{facility.location?.address || facility.address || 'Location'}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-sm">
                        <span className="text-gray-600">{facility.reviewsCount || 0} reviews</span>
                        <span className="text-indigo-600 font-semibold">{facility.priceRange || '₹999/night'}</span>
                      </div>
                    </div>

                    {/* Check Availability Button */}
                    <Button
                      onClick={() => handleCheckAvailability(facility.id || facility.vendorId)}
                      className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white h-12 text-base font-semibold shadow-lg"
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

        {/* Boarding Features Section */}
        <Card className="p-6 bg-gradient-to-br from-gray-50 to-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">Boarding Features</h3>
          <div className="space-y-3">
            {[
              { icon: '🛏️', title: 'Comfortable Accommodation', desc: 'Spacious kennels & play areas' },
              { icon: '🍽️', title: 'Meal Service', desc: 'Nutritious meals & special diets' },
              { icon: '🏃', title: 'Daily Exercise', desc: 'Regular walks & playtime' },
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
