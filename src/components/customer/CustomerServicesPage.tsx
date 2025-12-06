import { useState, useEffect } from 'react';
import { LoadingState, ErrorState, EmptyState } from '../ui/states';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Star, MapPin, Clock, ArrowLeft } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

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
  
  // Filters
  const [category, setCategory] = useState(initialFilters?.category || '');
  const [serviceStyle, setServiceStyle] = useState<'at_home' | 'at_center' | 'tele' | 'all'>('all');
  const [roleId, setRoleId] = useState(initialFilters?.roleId || '');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  
  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    fetchServices();
  }, [category, serviceStyle, roleId, location]);
  
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
      
      const response = await fetch(
        `${API_BASE}/customer/services?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'apikey': publicAnonKey
          }
        }
      );
      
      if (!response.ok) {
        // Fallback to catalog endpoint if first one fails (as per handoff)
        const fallbackResponse = await fetch(
            `${API_BASE}/catalog/services?${params.toString()}`,
            {
              headers: {
                'Authorization': `Bearer ${publicAnonKey}`,
                'apikey': publicAnonKey
              }
            }
        );
        
        if (!fallbackResponse.ok) {
             throw new Error('Failed to load services');
        }
        
        const data = await fallbackResponse.json();
        setServices(data.services || []);
        return;
      }
      
      const data = await response.json();
      setServices(data.services || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load services');
      console.error('Error fetching services:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const getCurrentLocation = () => {
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
  };
  
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-bold">Browse Services</h1>
      </div>

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
                <SelectItem value="grooming">Grooming</SelectItem>
                <SelectItem value="vet">Veterinary</SelectItem>
                <SelectItem value="training">Training</SelectItem>
                <SelectItem value="boarding">Boarding</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={serviceStyle} onValueChange={(v: any) => setServiceStyle(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Styles</SelectItem>
                <SelectItem value="at_home">At Home</SelectItem>
                <SelectItem value="at_center">At Center</SelectItem>
                <SelectItem value="tele">Teleconsultation</SelectItem>
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
        ) : services.length === 0 ? (
          <EmptyState message="No services found matching your filters." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
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
                <p className="text-xs text-gray-400 text-right">{service.distance.toFixed(1)} km</p>
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
