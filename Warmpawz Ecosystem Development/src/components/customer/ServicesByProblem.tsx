import React, { useState, useEffect } from 'react';
import { Star, MapPin, Clock, Phone, ChevronRight, ArrowLeft, Filter } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

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
    // Get user location
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

      const response = await fetch(
        `${getApiBaseUrl()}/customer/services-by-problem/${problemId}?${params}`,
        {
          headers: getAuthHeaders()
        }
      );

      if (response.ok) {
        const data = await response.json();
        setServices(data.data?.services || data.services || []);
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
      <div className={`${className}`}>
        {/* Header Skeleton */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse"></div>
          <div className="flex-1">
            <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
          </div>
        </div>

        {/* Services Skeleton */}
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex-1">
          <h2 className="text-gray-900">{problemTitle}</h2>
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
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all ${
              sortBy === option.value
                ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Services List */}
      <div className="space-y-4">
        {sortedServices.map((service) => (
          <Card
            key={service.serviceId}
            className="rounded-xl hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onServiceSelect(service)}
          >
            <CardContent className="p-4">
              <div className="flex gap-4">
                {/* Service Image */}
                {service.imageUrl && (
                  <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                    <img 
                      src={service.imageUrl} 
                      alt={service.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Service Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-gray-900 line-clamp-1">{service.name}</h3>
                    {sortBy === 'relevance' && service.relevanceScore && service.relevanceScore > 80 && (
                      <Badge className="bg-green-100 text-green-700 text-xs">
                        Best Match
                      </Badge>
                    )}
                  </div>

                  <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                    {service.description}
                  </p>

                  {/* Vendor Info */}
                  <div className="flex items-center gap-4 mb-2 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      {service.vendorRating?.toFixed(1) || 'N/A'}
                      <span className="text-xs">({service.vendorReviews || 0})</span>
                    </span>

                    {service.distance !== undefined && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {service.distance.toFixed(1)} km
                      </span>
                    )}

                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {service.duration} min
                    </span>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-gray-900">₹{service.price}</span>
                      {service.availability && (
                        <span className="ml-2 text-xs text-green-600">
                          {service.availability}
                        </span>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {sortedServices.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Filter className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-gray-900 mb-2">No services found</h3>
          <p className="text-sm text-gray-500 mb-4">
            We couldn't find any services for this problem in your area.
          </p>
          <Button
            variant="outline"
            onClick={onBack}
            className="border-orange-500 text-orange-500 hover:bg-orange-50"
          >
            Try Another Problem
          </Button>
        </div>
      )}
    </div>
  );
}
