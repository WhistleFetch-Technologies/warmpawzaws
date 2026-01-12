"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Scissors, Building2, Home, Star, MapPin, Clock, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface GroomingServiceRouterProps {
  phone: string;
  onBack: () => void;
  onViewBooking?: (bookingId: string) => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function GroomingServiceRouter({ phone, onBack, onViewBooking, onNavigate }: GroomingServiceRouterProps) {
  const [currentView, setCurrentView] = useState<'landing' | 'vendor-list'>('landing');
  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState<any[]>([]);
  const [selectedServiceType, setSelectedServiceType] = useState<'center' | 'home' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (currentView === 'vendor-list' && selectedServiceType) {
      loadVendors();
    }
  }, [currentView, selectedServiceType]);

  const loadVendors = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        roleId: 'pet_groomer',
        ...(selectedServiceType === 'home' && { serviceStyle: 'at_home' }),
        ...(selectedServiceType === 'center' && { serviceStyle: 'at_center' }),
        ...(searchQuery && { query: searchQuery })
      });

      // Append params to URL query string
      const endpoint = `/customer/vendors/search${params.toString() ? `?${params.toString()}` : ''}`;
      const data = await apiClient.get<{ vendors?: any[]; services?: any[] }>(endpoint);
      const vendorList = data.vendors || data.services || [];
      setVendors(vendorList);
    } catch (error) {
      console.error('Error loading grooming vendors:', error);
      // No mock fallback - show empty state when API fails
      setVendors([]);
    } finally {
      setLoading(false);
    }
  };

  const handleServiceTypeSelect = (type: 'center' | 'home') => {
    setSelectedServiceType(type);
    setCurrentView('vendor-list');
  };

  const handleVendorSelect = (vendor: any) => {
    onNavigate?.('create-booking', { vendorId: vendor.id || vendor.vendorId, serviceType: selectedServiceType });
  };

  // Landing Page View
  if (currentView === 'landing') {
    return (
      <div className="min-h-screen bg-gray-50 pb-24 max-w-md mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-pink-500 text-white px-4 py-4 sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="rounded-full text-white hover:bg-white/20"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">Grooming Services</h1>
              <p className="text-white/90 text-sm">Professional pet grooming & styling</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Hero Banner */}
          <Card className="bg-gradient-to-br from-orange-50 to-pink-50 border-orange-200 p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Premium Pet Grooming</h2>
                <p className="text-gray-700 mb-4">Professional styling, baths & spa treatments</p>
              </div>
              <div className="text-5xl">✂️</div>
            </div>
          </Card>

          {/* Service Type Selection */}
          <div>
            <h2 className="font-bold text-gray-900 mb-4">Choose Service Type</h2>
            <div className="space-y-3">
              {/* Center Visit */}
              <Card 
                className="p-4 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-orange-300"
                onClick={() => handleServiceTypeSelect('center')}
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center">
                    <Building2 className="w-7 h-7 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-gray-900">Grooming Center</h3>
                    <p className="text-sm text-gray-600 mt-1">Visit our professional grooming salon</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">Full Service</span>
                      <span className="text-xs text-gray-500">₹499 onwards</span>
                    </div>
                  </div>
                  <div className="text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Card>

              {/* Home Visit */}
              <Card 
                className="p-4 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-orange-300"
                onClick={() => handleServiceTypeSelect('home')}
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-pink-100 rounded-xl flex items-center justify-center">
                    <Home className="w-7 h-7 text-pink-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-gray-900">Home Grooming</h3>
                    <p className="text-sm text-gray-600 mt-1">Groomer comes to your home</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs bg-pink-100 text-pink-700 px-2 py-1 rounded">Convenient</span>
                      <span className="text-xs text-gray-500">₹699 onwards</span>
                    </div>
                  </div>
                  <div className="text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Grooming Features */}
          <Card className="p-6 bg-gradient-to-br from-gray-50 to-gray-100">
            <h3 className="font-bold text-gray-900 mb-4">Our Services</h3>
            <div className="space-y-3">
              {[
                { icon: '✂️', title: 'Haircut & Styling', desc: 'Professional cuts for all breeds' },
                { icon: '🛁', title: 'Bath & Spa', desc: 'Deep cleaning & conditioning' },
                { icon: '💅', title: 'Nail Trimming', desc: 'Safe & gentle nail care' },
                { icon: '👂', title: 'Ear Cleaning', desc: 'Prevent infections & odor' }
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

  // Vendor List View
  return (
    <div className="min-h-screen bg-gray-50 pb-24 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-pink-500 text-white px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentView('landing')}
            className="rounded-full text-white hover:bg-white/20"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Grooming Centers</h1>
            <p className="text-white/90 text-sm">
              {selectedServiceType === 'center' && 'Salon Visits'}
              {selectedServiceType === 'home' && 'Home Grooming'}
            </p>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
            <input
              type="text"
              placeholder="Search groomers..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setTimeout(() => loadVendors(), 300);
              }}
              className="w-full pl-10 pr-4 py-2 bg-white/20 backdrop-blur rounded-lg text-white placeholder-white/70 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
        </div>
      </div>

      {/* Vendors List */}
      <div className="p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          </div>
        ) : vendors.length === 0 ? (
          <Card className="p-8 text-center">
            <Scissors className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-900 mb-2">No Grooming Services Found</h3>
            <p className="text-sm text-gray-500">Try adjusting your search or service type</p>
          </Card>
        ) : (
          vendors.map((vendor, index) => (
            <Card 
              key={vendor.id || vendor.vendorId || index} 
              className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleVendorSelect(vendor)}
            >
              {/* Vendor Image */}
              <div className="h-48 bg-gradient-to-br from-orange-200 to-pink-200 relative">
                <div className="absolute inset-0 flex items-center justify-center text-6xl">
                  <Scissors className="w-16 h-16 text-orange-600 opacity-30" />
                </div>
                <div className="absolute top-3 right-3 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                  <Star className="w-3 h-3 fill-white" />
                  {vendor.rating || 4.5}
                </div>
              </div>

              {/* Vendor Details */}
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="font-bold text-lg text-gray-900">{vendor.businessName || vendor.name || 'Grooming Service'}</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                    <MapPin className="w-4 h-4" />
                    <span>{vendor.location?.address || vendor.address || vendor.city || 'Location'}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-sm">
                    <span className="text-gray-600">{vendor.reviewsCount || vendor.reviewCount || 0} reviews</span>
                    {vendor.priceRange && (
                      <span className="text-orange-600 font-semibold">{vendor.priceRange}</span>
                    )}
                  </div>
                </div>

                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleVendorSelect(vendor);
                  }}
                  className="w-full bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white h-12 text-base font-semibold shadow-lg"
                >
                  <Scissors className="w-5 h-5 mr-2" />
                  Book Grooming
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
