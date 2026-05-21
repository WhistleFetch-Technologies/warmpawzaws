'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { ServiceDescriptionInline } from './shared/ServiceDescriptionInline';
import { formatDistanceDisplay } from '@/lib/distance-display';
import { useDiscoveryCount } from '@/hooks/useDiscoveryCount';
import { formatDiscoveryCountStat } from '@/lib/format-floored-ten-plus';
import { EMPTY_SERVICE_HEADER_STATS } from '@/lib/service-header-stats';
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
  vendorRating?: number | null;
  vendorReviewCount?: number | null;
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
  onNavigate: (screen: string, data?: Record<string, unknown>) => void;
  /** When omitted, phone is read from localStorage after mount. */
  phone?: string;
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

export function CustomerServicesPage({ onBack, onNavigate, phone: phoneProp, initialFilters }: CustomerServicesPageProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [discoveryMeta, setDiscoveryMeta] = useState<DiscoveryMeta | null>(null);
  const [resolvedPhone, setResolvedPhone] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setResolvedPhone(localStorage.getItem('customerPhone') || localStorage.getItem('customer_phone') || '');
  }, []);
  const phone = (phoneProp && phoneProp.trim()) || resolvedPhone;

  // Filters (DB-driven when discovery/meta is available)
  const [category, setCategory] = useState(initialFilters?.category || '');
  const [serviceStyle, setServiceStyle] = useState<'at_home' | 'at_center' | 'tele' | 'all'>(
    initialFilters?.serviceStyle || 'all'
  );
  const [roleId, setRoleId] = useState(initialFilters?.roleId || '');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);

  const isGrooming = category === 'grooming' || roleId === 'pet_groomer';
  const isTraining = category === 'training' || roleId === 'trainer';

  const groomingTeleDiscovery = useDiscoveryCount({
    phone,
    serviceStyle: 'tele',
    category: 'grooming',
    enabled: isGrooming && serviceStyle === 'tele',
  });
  const groomingCenterDiscovery = useDiscoveryCount({
    phone,
    serviceStyle: 'at_center',
    category: 'grooming',
    enabled: isGrooming && (serviceStyle === 'at_center' || serviceStyle === 'all'),
  });
  const groomingHomeDiscovery = useDiscoveryCount({
    phone,
    serviceStyle: 'at_home',
    category: 'grooming',
    enabled: isGrooming && serviceStyle === 'at_home',
  });
  const trainingTeleDiscovery = useDiscoveryCount({
    phone,
    serviceStyle: 'tele',
    category: 'training',
    enabled: isTraining && serviceStyle === 'tele',
  });
  const trainingCenterDiscovery = useDiscoveryCount({
    phone,
    serviceStyle: 'at_center',
    category: 'training',
    enabled: isTraining && (serviceStyle === 'at_center' || serviceStyle === 'all'),
  });
  const trainingHomeDiscovery = useDiscoveryCount({
    phone,
    serviceStyle: 'at_home',
    category: 'training',
    enabled: isTraining && serviceStyle === 'at_home',
  });

  const discoveryQueryState = (q: { isLoading: boolean; isFetching: boolean; isError: boolean }) =>
    q.isLoading || q.isFetching ? ('loading' as const) : q.isError ? ('error' as const) : ('success' as const);

  const serviceConfig = useMemo(() => {
    const isAtCenter = serviceStyle === 'at_center';
    const isAtHome = serviceStyle === 'at_home';

    if (isGrooming) {
      if (serviceStyle === 'tele') {
        const st = discoveryQueryState(groomingTeleDiscovery);
        const v = formatDiscoveryCountStat(groomingTeleDiscovery.data, st);
        return {
          name: 'Grooming Services',
          subtitle: 'Find grooming for your pet',
          icon: Scissors,
          stats: EMPTY_SERVICE_HEADER_STATS,
        };
      }
      if (isAtHome) {
        const st = discoveryQueryState(groomingHomeDiscovery);
        const v = formatDiscoveryCountStat(groomingHomeDiscovery.data, st);
        return {
          name: 'At Home Grooming',
          subtitle: 'Groomer comes to you',
          icon: Scissors,
          stats: [{ value: v, label: 'Pros', icon: <Building2 className="w-4 h-4" /> }],
        };
      }
      const st = discoveryQueryState(groomingCenterDiscovery);
      const v = formatDiscoveryCountStat(groomingCenterDiscovery.data, st);
      return {
        name: isAtCenter ? 'Grooming Center' : 'Grooming',
        subtitle: isAtCenter ? 'Visit our grooming centers' : 'Browse grooming centers',
        icon: Scissors,
        stats: EMPTY_SERVICE_HEADER_STATS,
      };
    }

    if (isTraining) {
      if (serviceStyle === 'tele') {
        const st = discoveryQueryState(trainingTeleDiscovery);
        const v = formatDiscoveryCountStat(trainingTeleDiscovery.data, st);
        return {
          name: 'Training Services',
          subtitle: 'Training options for your pet',
          icon: GraduationCap,
          stats: EMPTY_SERVICE_HEADER_STATS,
        };
      }
      if (isAtHome) {
        const st = discoveryQueryState(trainingHomeDiscovery);
        const v = formatDiscoveryCountStat(trainingHomeDiscovery.data, st);
        return {
          name: 'At Home Training',
          subtitle: 'Trainer comes to you',
          icon: GraduationCap,
          stats: EMPTY_SERVICE_HEADER_STATS,
        };
      }
      const st = discoveryQueryState(trainingCenterDiscovery);
      const v = formatDiscoveryCountStat(trainingCenterDiscovery.data, st);
      return {
        name: isAtCenter ? 'Training Center' : 'Training',
        subtitle: isAtCenter ? 'Visit our training centers' : 'Browse training centers',
        icon: GraduationCap,
        stats: EMPTY_SERVICE_HEADER_STATS,
      };
    }
    return {
      name: 'Browse Services',
      subtitle: 'Find the best services for your pet',
      icon: Building2,
      stats: EMPTY_SERVICE_HEADER_STATS,
    };
  }, [
    services,
    category,
    roleId,
    isGrooming,
    isTraining,
    serviceStyle,
    groomingTeleDiscovery.data,
    groomingTeleDiscovery.isLoading,
    groomingTeleDiscovery.isFetching,
    groomingTeleDiscovery.isError,
    groomingCenterDiscovery.data,
    groomingCenterDiscovery.isLoading,
    groomingCenterDiscovery.isFetching,
    groomingCenterDiscovery.isError,
    groomingHomeDiscovery.data,
    groomingHomeDiscovery.isLoading,
    groomingHomeDiscovery.isFetching,
    groomingHomeDiscovery.isError,
    trainingTeleDiscovery.data,
    trainingTeleDiscovery.isLoading,
    trainingTeleDiscovery.isFetching,
    trainingTeleDiscovery.isError,
    trainingCenterDiscovery.data,
    trainingCenterDiscovery.isLoading,
    trainingCenterDiscovery.isFetching,
    trainingCenterDiscovery.isError,
    trainingHomeDiscovery.data,
    trainingHomeDiscovery.isLoading,
    trainingHomeDiscovery.isFetching,
    trainingHomeDiscovery.isError,
  ]);
  
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
        sheetToneClass="bg-gray-50"
      />

      <div className="container mx-auto -mt-4 px-4 pt-6 pb-6">
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

function formatCardVendorRating(rating: number | null | undefined): string {
  if (typeof rating !== 'number' || !Number.isFinite(rating) || rating <= 0) return '—';
  return rating.toFixed(1);
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
            {formatCardVendorRating(service.vendorRating)}
          </div>
        </div>

        <div className="mb-4 min-h-[2.5rem]" onClick={(e) => e.stopPropagation()}>
          <ServiceDescriptionInline
            description={service.description}
            title={service.serviceName}
            className="m-0 text-sm leading-5 text-gray-600"
          />
        </div>
        
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
             {formatDistanceDisplay(service) && (
                <p className="text-xs text-gray-400 text-right">{formatDistanceDisplay(service)}</p>
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