"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Plane, Star, MapPin, Search, Package, Truck, Globe, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface RelocationServicesLandingProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function RelocationServicesLanding({ phone, onBack, onNavigate }: RelocationServicesLandingProps) {
  const [loading, setLoading] = useState(true);
  const [relocationServices, setRelocationServices] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({ activeServices: 25, relocations: '500+', rating: '4.7' });

  useEffect(() => {
    loadRelocationServices();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const timeout = setTimeout(() => loadRelocationServices(), 300);
      return () => clearTimeout(timeout);
    } else {
      loadRelocationServices();
    }
  }, [searchQuery]);

  const loadRelocationServices = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        roleId: 'pet_relocation'
      });
      
      if (searchQuery) {
        params.append('query', searchQuery);
      }

      // Append params to URL query string
      const endpoint = `/customer/vendors/search${params.toString() ? `?${params.toString()}` : ''}`;
      const data = await apiClient.get<{ vendors?: any[]; services?: any[] }>(endpoint);
      const serviceList = data.vendors || data.services || [];
      setRelocationServices(serviceList);
    } catch (error) {
      console.error('Error loading relocation services:', error);
      setRelocationServices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleServiceSelect = (service: any) => {
    onNavigate?.('create-booking', { vendorId: service.id || service.vendorId, serviceId: 'pet_relocation' });
  };

  const serviceTypes = [
    { icon: Plane, label: 'Air Transport', color: 'bg-blue-100 text-blue-600', desc: 'Domestic & international' },
    { icon: Truck, label: 'Road Transport', color: 'bg-green-100 text-green-600', desc: 'Long distance moves' },
    { icon: Package, label: 'Packing Service', color: 'bg-orange-100 text-orange-600', desc: 'Safe packaging' },
    { icon: Shield, label: 'Full Service', color: 'bg-purple-100 text-purple-600', desc: 'End-to-end support' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 py-4 sticky top-0 z-50">
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
            <h1 className="text-xl font-bold">Pet Relocation</h1>
            <p className="text-white/90 text-sm">Safe & secure pet transport</p>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
            <input
              type="text"
              placeholder="Search relocation services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/20 backdrop-blur rounded-lg text-white placeholder-white/70 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Hero Banner */}
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Safe Pet Relocation</h2>
              <p className="text-gray-700 mb-4">Professional pet transport services for domestic & international moves</p>
            </div>
            <div className="text-5xl">✈️</div>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.activeServices}</div>
            <div className="text-xs text-gray-600 mt-1">Active Services</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.relocations}</div>
            <div className="text-xs text-gray-600 mt-1">Relocations Done</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
              <span className="text-2xl font-bold text-blue-600">{stats.rating}</span>
            </div>
            <div className="text-xs text-gray-600 mt-1">Average Rating</div>
          </Card>
        </div>

        {/* Service Types */}
        <div>
          <h2 className="font-bold text-gray-900 mb-4">Relocation Options</h2>
          <div className="grid grid-cols-2 gap-3">
            {serviceTypes.map((type, idx) => (
              <Card key={idx} className="p-4 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-blue-300">
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

        {/* Featured Services */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Relocation Services</h2>
            <span className="text-sm text-blue-600">{relocationServices.length} available</span>
          </div>
          
          {relocationServices.length === 0 ? (
            <Card className="p-8 text-center">
              <Plane className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No relocation services available at the moment</p>
              <p className="text-sm text-gray-400 mt-2">Check back later or try a different location</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {relocationServices.slice(0, 10).map((service, idx) => (
                <Card 
                  key={service.id || service.vendorId || idx}
                  className="p-4 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => handleServiceSelect(service)}
                >
                  <div className="flex gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                      {service.vendorProfileImage ? (
                        <img 
                          src={service.vendorProfileImage} 
                          alt={service.vendorName}
                          className="w-full h-full object-cover rounded-xl"
                        />
                      ) : (
                        '✈️'
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">{service.vendorName || service.businessName || 'Pet Relocation Service'}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                          <span className="text-sm font-medium">{(service.rating || 4.7).toFixed(1)}</span>
                        </div>
                        <span className="text-gray-400">•</span>
                        <span className="text-sm text-gray-600">{(service.reviewCount || 0)} reviews</span>
                      </div>
                      {service.address && (
                        <div className="flex items-center gap-1 mt-1 text-sm text-gray-600">
                          <MapPin className="w-4 h-4" />
                          <span className="truncate">{service.address}</span>
                        </div>
                      )}
                      {service.serviceName && (
                        <p className="text-sm text-blue-600 mt-1">{service.serviceName}</p>
                      )}
                    </div>
                    <Button
                      className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleServiceSelect(service);
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
