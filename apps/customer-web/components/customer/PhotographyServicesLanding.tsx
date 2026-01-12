"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Camera, Star, MapPin, Clock, Search, ImageIcon, Video, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface PhotographyServicesLandingProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function PhotographyServicesLanding({ phone, onBack, onNavigate }: PhotographyServicesLandingProps) {
  const [loading, setLoading] = useState(true);
  const [photographers, setPhotographers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({ activePhotographers: 85, sessions: '2K+', rating: '4.8' });

  useEffect(() => {
    loadPhotographers();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const timeout = setTimeout(() => loadPhotographers(), 300);
      return () => clearTimeout(timeout);
    } else {
      loadPhotographers();
    }
  }, [searchQuery]);

  const loadPhotographers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        roleId: 'pet_photographer'
      });
      
      if (searchQuery) {
        params.append('query', searchQuery);
      }

      // Append params to URL query string
      const endpoint = `/customer/vendors/search${params.toString() ? `?${params.toString()}` : ''}`;
      const data = await apiClient.get<{ vendors?: any[]; services?: any[] }>(endpoint);
      const photographerList = data.vendors || data.services || [];
      setPhotographers(photographerList);
    } catch (error) {
      console.error('Error loading photographers:', error);
      setPhotographers([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotographerSelect = (photographer: any) => {
    onNavigate?.('create-booking', { vendorId: photographer.id || photographer.vendorId, serviceId: 'pet_photographer' });
  };

  const photographyTypes = [
    { icon: Camera, label: 'Portrait Sessions', color: 'bg-purple-100 text-purple-600' },
    { icon: Video, label: 'Video Shoots', color: 'bg-blue-100 text-blue-600' },
    { icon: Users, label: 'Event Photography', color: 'bg-pink-100 text-pink-600' },
    { icon: ImageIcon, label: 'Pet Showcases', color: 'bg-orange-100 text-orange-600' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-4 sticky top-0 z-50">
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
            <h1 className="text-xl font-bold">Photography Services</h1>
            <p className="text-white/90 text-sm">Capture precious moments</p>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
            <input
              type="text"
              placeholder="Search photographers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/20 backdrop-blur rounded-lg text-white placeholder-white/70 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Hero Banner */}
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Professional Pet Photography</h2>
              <p className="text-gray-700 mb-4">Capture your pet's personality in stunning photos & videos</p>
            </div>
            <div className="text-5xl">📸</div>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.activePhotographers}</div>
            <div className="text-xs text-gray-600 mt-1">Active Photographers</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.sessions}</div>
            <div className="text-xs text-gray-600 mt-1">Sessions Completed</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
              <span className="text-2xl font-bold text-purple-600">{stats.rating}</span>
            </div>
            <div className="text-xs text-gray-600 mt-1">Average Rating</div>
          </Card>
        </div>

        {/* Photography Types */}
        <div>
          <h2 className="font-bold text-gray-900 mb-4">Photography Types</h2>
          <div className="grid grid-cols-2 gap-3">
            {photographyTypes.map((type, idx) => (
              <Card key={idx} className="p-4 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-purple-300">
                <div className="flex flex-col items-center text-center">
                  <div className={`w-12 h-12 ${type.color} rounded-xl flex items-center justify-center mb-3`}>
                    <type.icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-semibold text-sm text-gray-900">{type.label}</h3>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Featured Photographers */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Featured Photographers</h2>
            <span className="text-sm text-purple-600">{photographers.length} available</span>
          </div>
          
          {photographers.length === 0 ? (
            <Card className="p-8 text-center">
              <Camera className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No photographers available at the moment</p>
              <p className="text-sm text-gray-400 mt-2">Check back later or try a different location</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {photographers.slice(0, 10).map((photographer, idx) => (
                <Card 
                  key={photographer.id || photographer.vendorId || idx}
                  className="p-4 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => handlePhotographerSelect(photographer)}
                >
                  <div className="flex gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                      {photographer.vendorProfileImage ? (
                        <img 
                          src={photographer.vendorProfileImage} 
                          alt={photographer.vendorName}
                          className="w-full h-full object-cover rounded-xl"
                        />
                      ) : (
                        '📸'
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">{photographer.vendorName || photographer.businessName || 'Pet Photographer'}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                          <span className="text-sm font-medium">{(photographer.rating || 4.8).toFixed(1)}</span>
                        </div>
                        <span className="text-gray-400">•</span>
                        <span className="text-sm text-gray-600">{(photographer.reviewCount || 0)} reviews</span>
                      </div>
                      {photographer.address && (
                        <div className="flex items-center gap-1 mt-1 text-sm text-gray-600">
                          <MapPin className="w-4 h-4" />
                          <span className="truncate">{photographer.address}</span>
                        </div>
                      )}
                      {photographer.serviceName && (
                        <p className="text-sm text-purple-600 mt-1">{photographer.serviceName}</p>
                      )}
                    </div>
                    <Button
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePhotographerSelect(photographer);
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
