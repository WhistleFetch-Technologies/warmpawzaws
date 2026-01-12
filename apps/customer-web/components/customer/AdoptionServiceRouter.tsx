"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Heart, Search, Star, MapPin, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface AdoptionServiceRouterProps {
  phone: string;
  onBack: () => void;
  onViewBooking?: (bookingId: string) => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function AdoptionServiceRouter({ phone, onBack, onViewBooking, onNavigate }: AdoptionServiceRouterProps) {
  const [loading, setLoading] = useState(true);
  const [shelters, setShelters] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPetType, setSelectedPetType] = useState<string>('all');

  useEffect(() => {
    loadShelters();
  }, []);

  useEffect(() => {
    if (searchQuery || selectedPetType !== 'all') {
      const timeout = setTimeout(() => loadShelters(), 300);
      return () => clearTimeout(timeout);
    }
  }, [searchQuery, selectedPetType]);

  const loadShelters = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        roleId: 'ngo'
      });
      
      if (searchQuery) {
        params.append('query', searchQuery);
      }

      // Append params to URL query string
      const endpoint = `/customer/vendors/search${params.toString() ? `?${params.toString()}` : ''}`;
      const data = await apiClient.get<{ vendors?: any[]; services?: any[] }>(endpoint);
      const shelterList = data.vendors || data.services || [];
      setShelters(shelterList);
    } catch (error) {
      console.error('Error loading shelters:', error);
      // No mock fallback - show empty state when API fails
      setShelters([]);
    } finally {
      setLoading(false);
    }
  };

  const handleShelterSelect = (shelter: any) => {
    onNavigate?.('adoption_questionnaire', { shelterId: shelter.id || shelter.vendorId });
  };

  const petTypes = [
    { id: 'all', label: 'All Pets', icon: '🐾' },
    { id: 'dog', label: 'Dogs', icon: '🐕' },
    { id: 'cat', label: 'Cats', icon: '🐈' },
    { id: 'other', label: 'Others', icon: '🐾' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-24 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-pink-600 text-white px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Pet Adoption</h1>
            <p className="text-white/90 text-sm">Find your forever friend</p>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
            <input
              type="text"
              placeholder="Search shelters, locations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/20 backdrop-blur rounded-lg text-white placeholder-white/70 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Hero Banner */}
        <Card className="bg-gradient-to-br from-red-50 to-pink-50 border-red-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Adopt a Pet</h2>
              <p className="text-gray-700 mb-4">Give a loving home to a pet in need</p>
              <Button 
                className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white shadow-lg"
                onClick={() => {
                  if (onNavigate) onNavigate('adoption_questionnaire');
                }}
              >
                Start Adoption Process
              </Button>
            </div>
            <div className="text-5xl">❤️</div>
          </div>
        </Card>

        {/* Pet Type Filter */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Filter by Pet Type</h2>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {petTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedPetType(type.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedPetType === type.id
                    ? 'bg-gradient-to-r from-red-600 to-pink-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:shadow-sm'
                }`}
              >
                <span className="mr-1">{type.icon}</span>
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Adoption Info */}
        <Card className="p-6 bg-gradient-to-br from-gray-50 to-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">Adoption Process</h3>
          <div className="space-y-3">
            {[
              { step: '1', title: 'Fill Questionnaire', desc: 'Tell us about your home & preferences' },
              { step: '2', title: 'Browse Available Pets', desc: 'View pets matching your criteria' },
              { step: '3', title: 'Meet & Greet', desc: 'Schedule a visit with the pet' },
              { step: '4', title: 'Finalize Adoption', desc: 'Complete paperwork & bring home' }
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-lg font-bold text-red-600 shadow-sm">
                  {item.step}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{item.title}</h4>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Shelters List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Adoption Centers</h2>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
            </div>
          ) : shelters.length === 0 ? (
            <Card className="p-8 text-center">
              <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">No Adoption Centers Found</h3>
              <p className="text-sm text-gray-500">Try adjusting your search or check back later</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {shelters.map((shelter, index) => (
                <Card 
                  key={shelter.id || shelter.vendorId || index} 
                  className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => handleShelterSelect(shelter)}
                >
                  {/* Shelter Image */}
                  <div className="h-48 bg-gradient-to-br from-red-200 to-pink-200 relative">
                    <div className="absolute inset-0 flex items-center justify-center text-6xl">
                      <Heart className="w-16 h-16 text-red-600 opacity-30" />
                    </div>
                    <div className="absolute top-3 right-3 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                      <Star className="w-3 h-3 fill-white" />
                      {shelter.rating || 4.5}
                    </div>
                  </div>

                  {/* Shelter Details */}
                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">{shelter.businessName || shelter.name || 'Adoption Center'}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                        <MapPin className="w-4 h-4" />
                        <span>{shelter.location?.address || shelter.address || 'Location'}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-sm">
                        <span className="text-gray-600">{shelter.reviewsCount || 0} reviews</span>
                        {shelter.availablePets && (
                          <span className="text-red-600 font-semibold">{shelter.availablePets} pets available</span>
                        )}
                      </div>
                    </div>

                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShelterSelect(shelter);
                      }}
                      className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white h-12 text-base font-semibold shadow-lg"
                    >
                      <Heart className="w-5 h-5 mr-2" />
                      View Available Pets
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
