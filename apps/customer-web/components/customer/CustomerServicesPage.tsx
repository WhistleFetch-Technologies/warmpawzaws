'use client';

import { useState, useEffect } from 'react';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EnhancedSearchBar } from './EnhancedSearchBar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, MapPin, Clock, ArrowLeft, Scissors, GraduationCap, Building2, Home } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { ServiceDashboardHeader } from './shared/ServiceDashboardHeader';

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
    serviceStyle?: 'at_home' | 'at_center' | 'tele' | 'all';
  };
}

interface DiscoveryMeta {
  roles: { roleId: string; roleName: string; displayName: string; category?: string }[];
  serviceStyles: string[];
  categories: string[];
}

export function CustomerServicesPage({ onBack, onNavigate, initialFilters }: CustomerServicesPageProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [discoveryMeta, setDiscoveryMeta] = useState<DiscoveryMeta | null>(null);

  // Filters (DB-driven when discovery/meta is available)
  const [category, setCategory] = useState(initialFilters?.category || '');
  const [serviceStyle, setServiceStyle] = useState<'at_home' | 'at_center' | 'tele' | 'all'>(
    initialFilters?.serviceStyle || 'all'
  );
  const [roleId, setRoleId] = useState(initialFilters?.roleId || '');
  
  // ✅ FIX: Determine service name and icon based on category and serviceStyle
  const getServiceConfig = () => {
    const isGrooming = category === 'grooming' || roleId === 'pet_groomer';
    const isTraining = category === 'training' || roleId === 'trainer';
    const isAtCenter = serviceStyle === 'at_center';
    const isAtHome = serviceStyle === 'at_home';
    
    if (isGrooming) {
      return {
        name: isAtCenter ? 'Grooming Center' : 'At Home Grooming',
        subtitle: isAtCenter ? 'Visit our grooming centers' : 'Groomer comes to you',
        icon: Scissors,
        stats: [
          { value: '50+', label: 'Centers', icon: <Building2 className="w-4 h-4" /> },
          { value: '1K+', label: 'Bookings' },
          { value: '4.8', label: 'Rating', icon: <Star className="w-4 h-4 fill-white" /> }
        ]
      };
    } else if (isTraining) {
      return {
        name: isAtCenter ? 'Training Center' : 'At Home Training',
        subtitle: isAtCenter ? 'Visit our training centers' : 'Trainer comes to you',
        icon: GraduationCap,
        stats: [
          { value: '45+', label: 'Centers', icon: <Building2 className="w-4 h-4" /> },
          { value: '800+', label: 'Sessions' },
          { value: '4.9', label: 'Rating', icon: <Star className="w-4 h-4 fill-white" /> }
        ]
      };
    }
    return {
      name: 'Browse Services',
      subtitle: 'Find the best services for your pet',
      icon: Building2,
      stats: [
        { value: '100+', label: 'Services' },
        { value: '5K+', label: 'Bookings' },
        { value: '4.7', label: 'Rating', icon: <Star className="w-4 h-4 fill-white" /> }
      ]
    };
  };
  
  const serviceConfig = getServiceConfig();
  
  // Fetch DB-driven discovery meta (roles, service styles, categories)
  useEffect(() => {
    apiClient
      .get<{ success?: boolean; roles?: DiscoveryMeta['roles']; serviceStyles?: string[]; categories?: string[] }>(
        '/customer/discovery/meta'
      )
      .then((res) => {
        if (res.roles && Array.isArray(res.roles)) {
          setDiscoveryMeta({
            roles: res.roles,
            serviceStyles: res.serviceStyles || ['at_center', 'at_home', 'tele'],
            categories: res.categories || [],
          });
        }
      })
      .catch(() => {});
  }, []);

  // Update serviceStyle when initialFilters change
  useEffect(() => {
    if (initialFilters?.serviceStyle) {
      setServiceStyle(initialFilters.serviceStyle);
    }
  }, [initialFilters?.serviceStyle]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);

  const categoriesForFilter = discoveryMeta?.categories?.length
    ? discoveryMeta.categories
    : ['grooming', 'vet', 'training', 'boarding', 'walker', 'nutrition', 'diagnostics'];
  const serviceStylesForFilter = discoveryMeta?.serviceStyles?.length
    ? discoveryMeta.serviceStyles
    : ['at_center', 'at_home', 'tele'];

  useEffect(() => {
    fetchServices();
  }, [category, serviceStyle, roleId, location]);
  
  const fetchServices = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params: Record<string, string> = {};
      if (category && category !== 'all') params.category = category;
      if (serviceStyle && serviceStyle !== 'all') params.serviceStyle = serviceStyle;
      if (roleId && roleId !== 'all') params.roleId = roleId;
      if (location) {
        params.latitude = location.lat.toString();
        params.longitude = location.lng.toString();
      }
      
      const queryString = new URLSearchParams(params).toString();
      
      try {
        const data = await apiClient.get<{ services?: Service[] }>(
          `/customer/services?${queryString}`
        );
        setServices(data.services || []);
      } catch (err) {
        // Fallback to catalog endpoint if first one fails
        try {
          const fallbackData = await apiClient.get<{ services?: Service[] }>(
            `/catalog/services?${queryString}`
          );
          setServices(fallbackData.services || []);
        } catch (fallbackErr) {
          throw new Error('Failed to load services');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load services');
      console.error('Error fetching services:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const getCurrentLocation = () => {
    const { getCurrentPositionSafe } = require('@/lib/geolocation-utils');
    getCurrentPositionSafe((coords: { lat: number; lng: number }) => setLocation(coords));
  };
  
  useEffect(() => {
    const filtered = services.filter(service =>
      service.serviceName.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredServices(filtered);
  }, [searchQuery, services]);
  
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ✅ FIX: Restore Frame UI with ServiceDashboardHeader */}
      <ServiceDashboardHeader
        serviceName={serviceConfig.name}
        serviceSubtitle={serviceConfig.subtitle}
        serviceIcon={serviceConfig.icon}
        iconColor="text-white"
        stats={serviceConfig.stats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-[#FF8C42]"
      />

      <div className="container mx-auto px-4 py-6">
        {/* Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-wrap gap-3">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categoriesForFilter.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat === 'vet' ? 'Veterinary' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={serviceStyle} onValueChange={(v: 'at_home' | 'at_center' | 'tele' | 'all') => setServiceStyle(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Styles</SelectItem>
                {serviceStylesForFilter.map((style) => (
                  <SelectItem key={style} value={style}>
                    {style === 'at_center' ? 'At Center' : style === 'at_home' ? 'At Home' : 'Teleconsultation'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button
              variant={location ? "default" : "outline"}
              onClick={getCurrentLocation}
              className="gap-2"
            >
              <MapPin className="w-4 h-4" />
              {location ? 'Near Me' : 'Location'}
            </Button>
          </div>
        </div>
        
        {/* Content */}
        {loading ? (
          <LoadingState message="Finding services..." />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchServices} />
        ) : filteredServices.length === 0 ? (
          <EmptyState message="No services found matching your filters." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredServices.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onSelect={() => onNavigate('create-booking', { serviceId: service.id, vendorId: service.vendorId })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ServiceCard({ service, onSelect }: { service: Service; onSelect: () => void }) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-5">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-bold text-lg text-gray-900 line-clamp-1">{service.serviceName}</h3>
            <p className="text-sm text-gray-500">{service.vendorName}</p>
          </div>
          <div className="flex items-center bg-yellow-50 px-2 py-1 rounded text-yellow-700 text-xs font-bold">
            <Star className="w-3 h-3 fill-yellow-500 mr-1" />
            {service.vendorRating}
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-4 line-clamp-2 min-h-[2.5rem]">{service.description}</p>
        
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xl font-bold text-blue-600">₹{service.price}</p>
            <div className="flex items-center text-xs text-gray-500 mt-1">
              <Clock className="w-3 h-3 mr-1" />
              {service.duration} mins
            </div>
          </div>
          <div className="text-right">
             <Badge variant="secondary" className="mb-1">
                {service.serviceStyle === 'at_home' ? 'Home Visit' : 
                 service.serviceStyle === 'at_center' ? 'Center Visit' : 
                 'Tele-consult'}
             </Badge>
             {service.distance && (
                <p className="text-xs text-gray-400 text-right">{Number(service.distance || 0).toFixed(1)} km</p>
             )}
          </div>
        </div>
        
        <Button onClick={onSelect} className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E] text-white">
          Book Now
        </Button>
      </div>
    </Card>
  );
}