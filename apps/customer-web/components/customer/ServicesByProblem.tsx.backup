'use client';

import React, { useState, useEffect } from 'react';
import { Star, MapPin, Clock, Phone, ChevronRight, ArrowLeft, Filter } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface Service {
  serviceId: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  vendorId: string;
  vendorName: string;
  vendorRating: number;
  vendorReviews: number;
  distance?: number;
  availability?: string;
  imageUrl?: string;
  relevanceScore?: number;
}

interface ServicesByProblemProps {
  problemId: string;
  problemTitle: string;
  onBack: () => void;
  onServiceSelect: (service: Service) => void;
  className?: string;
}

export function ServicesByProblem({ 
  problemId, 
  problemTitle, 
  onBack, 
  onServiceSelect,
  className = '' 
}: ServicesByProblemProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'relevance' | 'price' | 'rating' | 'distance'>('relevance');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log('Location access denied:', error);
        }
      );
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [problemId, userLocation]);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (userLocation) {
        params.append('lat', userLocation.lat.toString());
        params.append('lng', userLocation.lng.toString());
      }

      const response = await apiClient.get<{ services: Service[] }>(
        `/customer/services-by-problem/${problemId}?${params}`
      );
      
      if (response.services) {
        setServices(response.services);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  };

  const sortedServices = [...services].sort((a, b) => {
    switch (sortBy) {
      case 'price':
        return a.price - b.price;
      case 'rating':
        return (b.vendorRating || 0) - (a.vendorRating || 0);
      case 'distance':
        return (a.distance || 999) - (b.distance || 999);
      case 'relevance':
      default:
        return (b.relevanceScore || 0) - (a.relevanceScore || 0);
    }
  });

  if (loading) {
    return (
      <div className={className}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse"></div>
          <div className="flex-1">
            <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex-1">
          <h2 className="text-gray-900 font-bold">{problemTitle}</h2>
          <p className="text-sm text-gray-500">{services.length} services available</p>
        </div>
      </div>

      {/* Sort Options */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
        {[
          { value: 'relevance', label: 'Most Relevant' },
          { value: 'rating', label: 'Top Rated' },
          { value: 'price', label: 'Price: Low to High' },
          { value: 'distance', label: 'Nearest' }
        ].map((option) => (
          <button
            key={option.value}
            onClick={() => setSortBy(option.value as any)}
            className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
              sortBy === option.value
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Services List */}
      {sortedServices.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl">
          <p className="text-gray-600">No services available for this problem</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedServices.map((service) => (
            <div
              key={service.serviceId}
              onClick={() => onServiceSelect(service)}
              className="bg-white rounded-2xl p-4 border border-gray-200 hover:shadow-lg transition-shadow active:scale-[0.98] cursor-pointer"
            >
              <div className="flex gap-4">
                {service.imageUrl && (
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0">
                    <img src={service.imageUrl} alt={service.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 mb-1">{service.name}</h3>
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">{service.description}</p>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-semibold">{service.vendorRating.toFixed(1)}</span>
                      <span className="text-gray-400">({service.vendorReviews})</span>
                    </div>
                    {service.distance && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        <span>{service.distance.toFixed(1)} km</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{service.duration} min</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-primary">₹{service.price}</span>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

