'use client';

import { useState, useEffect } from 'react';
import { Star, MapPin, Clock, ArrowLeft, Filter } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface Service {
  id: string;
  serviceName: string;
  description: string;
  price: number;
  duration: number;
  categoryName: string;
  serviceStyle: 'at_home' | 'at_center' | 'tele';
  vendorId: string;
  vendorName: string;
  vendorRating: number;
  vendorLocation?: {
    lat: number;
    lng: number;
    address: string;
    city: string;
  };
  distance?: number;
}

interface CustomerServicesPageProps {
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  initialFilters?: {
    category?: string;
    roleId?: string;
  };
}

export function CustomerServicesPage({ onBack, onNavigate, initialFilters }: CustomerServicesPageProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [category, setCategory] = useState(initialFilters?.category || '');
  const [serviceStyle, setServiceStyle] = useState<'at_home' | 'at_center' | 'tele' | 'all'>('all');
  const [roleId, setRoleId] = useState(initialFilters?.roleId || '');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [category, serviceStyle, roleId, location]);

  useEffect(() => {
    const filtered = services.filter(service =>
      service.serviceName.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredServices(filtered);
  }, [searchQuery, services]);

  const fetchServices = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (category && category !== 'all') params.append('category', category);
      if (serviceStyle && serviceStyle !== 'all') params.append('serviceStyle', serviceStyle);
      if (roleId && roleId !== 'all') params.append('roleId', roleId);
      if (location) {
        params.append('location', `${location.lat},${location.lng}`);
        params.append('radius', '10');
      }
      
      const response = await apiClient.get<{ services: Service[] }>(
        `/customer/services?${params}`
      );
      
      if (response.services) {
        setServices(response.services);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load services');
      console.error('Error fetching services:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-4 flex items-center gap-0">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">Browse Services</h1>
      </div>

      <div className="px-4 py-0">
        {/* Filters */}
        <div className="mb-0 space-y-4">
          <div className="flex flex-wrap gap-0">
            <select
              value={category}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCategory(e.target.value)}
              className="px-4 py-0 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="vet">Veterinary</option>
              <option value="grooming">Grooming</option>
              <option value="training">Training</option>
            </select>

            <select
              value={serviceStyle}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setServiceStyle(e.target.value as any)}
              className="px-4 py-0 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="at_home">At Home</option>
              <option value="at_center">At Center</option>
              <option value="tele">Teleconsultation</option>
            </select>
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              className="w-full pl-0 pr-4 py-0 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
            />
            <Filter className="absolute left-3 top-0/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          </div>
        </div>

        {/* Services List */}
        {loading ? (
          <div className="flex items-center justify-center py-02">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-red-700">{error}</p>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <p className="text-gray-600">No services found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredServices.map((service) => (
              <div
                key={service.id}
                onClick={() => onNavigate('service_details', { serviceId: service.id })}
                className="bg-white rounded-2xl p-4 border border-gray-200 hover:shadow-lg transition-shadow active:scale-[0.98] cursor-pointer"
              >
                <div className="flex gap-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 mb-0">{service.serviceName}</h3>
                    <p className="text-sm text-gray-600 mb-0 line-clamp-0">{service.description}</p>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-0">
                      <div className="flex items-center gap-0">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-semibold">{service.vendorRating.toFixed(1)}</span>
                      </div>
                      {service.distance && (
                        <div className="flex items-center gap-0">
                          <MapPin className="w-4 h-4" />
                          <span>{service.distance.toFixed(1)} km</span>
                        </div>
                      )}
                      <div className="flex items-center gap-0">
                        <Clock className="w-4 h-4" />
                        <span>{service.duration} min</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-primary">₹{service.price}</span>
                      <span className="text-xs px-0 py-1 bg-gray-100 text-gray-700 rounded-full">
                        {service.serviceStyle.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

