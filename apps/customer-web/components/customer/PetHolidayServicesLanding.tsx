"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Palmtree, Star, MapPin, Search, Plane, Hotel, Camera, Utensils } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface PetHolidayServicesLandingProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function PetHolidayServicesLanding({ phone, onBack, onNavigate }: PetHolidayServicesLandingProps) {
  const [loading, setLoading] = useState(true);
  const [holidayPackages, setHolidayPackages] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({ activePackages: 30, bookings: '800+', rating: '4.8' });

  useEffect(() => {
    loadHolidayPackages();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const timeout = setTimeout(() => loadHolidayPackages(), 300);
      return () => clearTimeout(timeout);
    } else {
      loadHolidayPackages();
    }
  }, [searchQuery]);

  const loadHolidayPackages = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        roleId: 'pet_holiday'
      });
      
      if (searchQuery) {
        params.append('query', searchQuery);
      }

      // Append params to URL query string
      const endpoint = `/customer/vendors/search${params.toString() ? `?${params.toString()}` : ''}`;
      const data = await apiClient.get<{ vendors?: any[]; services?: any[]; packages?: any[] }>(endpoint);
      const packageList = data.vendors || data.services || data.packages || [];
      setHolidayPackages(packageList);
    } catch (error) {
      console.error('Error loading holiday packages:', error);
      setHolidayPackages([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePackageSelect = (pkg: any) => {
    onNavigate?.('create-booking', { vendorId: pkg.id || pkg.vendorId, serviceId: 'pet_holiday' });
  };

  const packageTypes = [
    { icon: Palmtree, label: 'Beach Vacations', color: 'bg-cyan-100 text-cyan-600', desc: 'Sunny beach getaways' },
    { icon: Hotel, label: 'Hill Stations', color: 'bg-green-100 text-green-600', desc: 'Mountain retreats' },
    { icon: Camera, label: 'Adventure Tours', color: 'bg-orange-100 text-orange-600', desc: 'Activity-packed trips' },
    { icon: Utensils, label: 'Luxury Stays', color: 'bg-purple-100 text-purple-600', desc: 'Premium experiences' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-600 to-teal-600 text-white px-4 py-4 sticky top-0 z-50">
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
            <h1 className="text-xl font-bold">Pet Holidays</h1>
            <p className="text-white/90 text-sm">Unforgettable pet vacations</p>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
            <input
              type="text"
              placeholder="Search holiday packages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/20 backdrop-blur rounded-lg text-white placeholder-white/70 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Hero Banner */}
        <Card className="bg-gradient-to-br from-cyan-50 to-teal-50 border-cyan-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Pet Holiday Packages</h2>
              <p className="text-gray-700 mb-4">Curated vacation packages designed for pets & their families</p>
            </div>
            <div className="text-5xl">🏖️</div>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-cyan-600">{stats.activePackages}</div>
            <div className="text-xs text-gray-600 mt-1">Active Packages</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-cyan-600">{stats.bookings}</div>
            <div className="text-xs text-gray-600 mt-1">Bookings</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
              <span className="text-2xl font-bold text-cyan-600">{stats.rating}</span>
            </div>
            <div className="text-xs text-gray-600 mt-1">Average Rating</div>
          </Card>
        </div>

        {/* Package Types */}
        <div>
          <h2 className="font-bold text-gray-900 mb-4">Holiday Types</h2>
          <div className="grid grid-cols-2 gap-3">
            {packageTypes.map((type, idx) => (
              <Card key={idx} className="p-4 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-cyan-300">
                <div className="flex flex-col">
                  <div className={`w-12 h-12 ${type.color} rounded-xl flex items-center justify-center mb-3`}>
                    <type.icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-semibold text-sm text-gray-900 mb-1">{type.label}</h3>
                  <p className="text-xs text-gray-600">{type.desc}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Featured Packages */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Featured Holiday Packages</h2>
            <span className="text-sm text-cyan-600">{holidayPackages.length} available</span>
          </div>
          
          {holidayPackages.length === 0 ? (
            <Card className="p-8 text-center">
              <Palmtree className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No holiday packages available at the moment</p>
              <p className="text-sm text-gray-400 mt-2">Check back later or try a different location</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {holidayPackages.slice(0, 10).map((pkg, idx) => (
                <Card 
                  key={pkg.id || pkg.vendorId || idx}
                  className="p-4 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => handlePackageSelect(pkg)}
                >
                  <div className="flex gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-cyan-100 to-teal-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                      {pkg.vendorProfileImage || pkg.packageImage ? (
                        <img 
                          src={pkg.vendorProfileImage || pkg.packageImage} 
                          alt={pkg.vendorName || pkg.packageName}
                          className="w-full h-full object-cover rounded-xl"
                        />
                      ) : (
                        '🏖️'
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">{pkg.vendorName || pkg.packageName || pkg.businessName || 'Pet Holiday Package'}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                          <span className="text-sm font-medium">{(pkg.rating || 4.8).toFixed(1)}</span>
                        </div>
                        <span className="text-gray-400">•</span>
                        <span className="text-sm text-gray-600">{(pkg.reviewCount || 0)} reviews</span>
                      </div>
                      {pkg.address && (
                        <div className="flex items-center gap-1 mt-1 text-sm text-gray-600">
                          <MapPin className="w-4 h-4" />
                          <span className="truncate">{pkg.address}</span>
                        </div>
                      )}
                      {pkg.price && (
                        <p className="text-sm font-semibold text-cyan-600 mt-1">From ₹{pkg.price.toLocaleString()}</p>
                      )}
                    </div>
                    <Button
                      className="bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white shadow-lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePackageSelect(pkg);
                      }}
                    >
                      Book
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
