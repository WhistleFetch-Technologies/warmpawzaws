"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Apple, Star, MapPin, Search, UtensilsCrossed, Calendar, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface NutritionistServicesLandingProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function NutritionistServicesLanding({ phone, onBack, onNavigate }: NutritionistServicesLandingProps) {
  const [loading, setLoading] = useState(true);
  const [nutritionists, setNutritionists] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({ activeNutritionists: 45, consultations: '1.5K+', rating: '4.9' });

  useEffect(() => {
    loadNutritionists();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const timeout = setTimeout(() => loadNutritionists(), 300);
      return () => clearTimeout(timeout);
    } else {
      loadNutritionists();
    }
  }, [searchQuery]);

  const loadNutritionists = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        roleId: 'pet_nutritionist'
      });
      
      if (searchQuery) {
        params.append('query', searchQuery);
      }

      // Append params to URL query string
      const endpoint = `/customer/vendors/search${params.toString() ? `?${params.toString()}` : ''}`;
      const data = await apiClient.get<{ vendors?: any[]; services?: any[] }>(endpoint);
      const nutritionistList = data.vendors || data.services || [];
      setNutritionists(nutritionistList);
    } catch (error) {
      console.error('Error loading nutritionists:', error);
      setNutritionists([]);
    } finally {
      setLoading(false);
    }
  };

  const handleNutritionistSelect = (nutritionist: any) => {
    onNavigate?.('create-booking', { vendorId: nutritionist.id || nutritionist.vendorId, serviceId: 'pet_nutritionist' });
  };

  const serviceTypes = [
    { icon: UtensilsCrossed, label: 'Diet Consultation', color: 'bg-green-100 text-green-600', desc: 'Personalized meal plans' },
    { icon: Calendar, label: 'Meal Plans', color: 'bg-yellow-100 text-yellow-600', desc: 'Monthly subscriptions' },
    { icon: Heart, label: 'Weight Management', color: 'bg-pink-100 text-pink-600', desc: 'Healthy weight goals' },
    { icon: Apple, label: 'Allergy Management', color: 'bg-orange-100 text-orange-600', desc: 'Specialized diets' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-yellow-600 text-white px-4 py-4 sticky top-0 z-50">
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
            <h1 className="text-xl font-bold">Nutrition Services</h1>
            <p className="text-white/90 text-sm">Expert dietary guidance</p>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
            <input
              type="text"
              placeholder="Search nutritionists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/20 backdrop-blur rounded-lg text-white placeholder-white/70 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Hero Banner */}
        <Card className="bg-gradient-to-br from-green-50 to-yellow-50 border-green-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Pet Nutrition Expertise</h2>
              <p className="text-gray-700 mb-4">Personalized diet plans & meal subscriptions for optimal pet health</p>
            </div>
            <div className="text-5xl">🥗</div>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.activeNutritionists}</div>
            <div className="text-xs text-gray-600 mt-1">Active Nutritionists</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.consultations}</div>
            <div className="text-xs text-gray-600 mt-1">Consultations</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
              <span className="text-2xl font-bold text-green-600">{stats.rating}</span>
            </div>
            <div className="text-xs text-gray-600 mt-1">Average Rating</div>
          </Card>
        </div>

        {/* Service Types */}
        <div>
          <h2 className="font-bold text-gray-900 mb-4">Our Services</h2>
          <div className="grid grid-cols-2 gap-3">
            {serviceTypes.map((type, idx) => (
              <Card key={idx} className="p-4 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-green-300">
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

        {/* Featured Nutritionists */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Featured Nutritionists</h2>
            <span className="text-sm text-green-600">{nutritionists.length} available</span>
          </div>
          
          {nutritionists.length === 0 ? (
            <Card className="p-8 text-center">
              <Apple className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No nutritionists available at the moment</p>
              <p className="text-sm text-gray-400 mt-2">Check back later or try a different location</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {nutritionists.slice(0, 10).map((nutritionist, idx) => (
                <Card 
                  key={nutritionist.id || nutritionist.vendorId || idx}
                  className="p-4 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => handleNutritionistSelect(nutritionist)}
                >
                  <div className="flex gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-yellow-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                      {nutritionist.vendorProfileImage ? (
                        <img 
                          src={nutritionist.vendorProfileImage} 
                          alt={nutritionist.vendorName}
                          className="w-full h-full object-cover rounded-xl"
                        />
                      ) : (
                        '🥗'
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">{nutritionist.vendorName || nutritionist.businessName || 'Pet Nutritionist'}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                          <span className="text-sm font-medium">{(nutritionist.rating || 4.9).toFixed(1)}</span>
                        </div>
                        <span className="text-gray-400">•</span>
                        <span className="text-sm text-gray-600">{(nutritionist.reviewCount || 0)} reviews</span>
                      </div>
                      {nutritionist.address && (
                        <div className="flex items-center gap-1 mt-1 text-sm text-gray-600">
                          <MapPin className="w-4 h-4" />
                          <span className="truncate">{nutritionist.address}</span>
                        </div>
                      )}
                      {nutritionist.serviceName && (
                        <p className="text-sm text-green-600 mt-1">{nutritionist.serviceName}</p>
                      )}
                    </div>
                    <Button
                      className="bg-gradient-to-r from-green-600 to-yellow-600 hover:from-green-700 hover:to-yellow-700 text-white shadow-lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNutritionistSelect(nutritionist);
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
