import React, { useState, useEffect } from 'react';
import { Ambulance, Pill, Activity, Search, MapPin, Clock, Star } from 'lucide-react';

/**
 * 🏥 INTEGRATED SERVICES HUB
 * 
 * Phase 7C: Rule 6 - Integrated Services Complete
 * 
 * Features:
 * - Unified view of ambulance, medicine, diagnostics
 * - Service discovery with filters
 * - Quick access to all integrated services
 */

interface Service {
  serviceId: string;
  serviceType: 'ambulance' | 'medicine' | 'diagnostics';
  vendorId: string;
  vendorName: string;
  location: { lat: number; lng: number; address: string };
  distance?: number;
  isAvailable: boolean;
  estimatedResponseTime?: number;
  rating: number;
  services: string[];
}

interface IntegratedServicesHubProps {
  userLocation?: { lat: number; lng: number };
  onServiceSelect?: (service: Service) => void;
  apiUrl?: string;
}

export function IntegratedServicesHub({
  userLocation,
  onServiceSelect,
  apiUrl = `${import.meta.env.VITE_API_URL}/make-server-3dd53475`,
}: IntegratedServicesHubProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'ambulance' | 'medicine' | 'diagnostics'>('all');
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const serviceTypes = [
    {
      type: 'all' as const,
      label: 'All Services',
      icon: <Activity className="w-5 h-5" />,
      color: 'bg-gray-600',
    },
    {
      type: 'ambulance' as const,
      label: 'Ambulance',
      icon: <Ambulance className="w-5 h-5" />,
      color: 'bg-red-600',
    },
    {
      type: 'medicine' as const,
      label: 'Pharmacy',
      icon: <Pill className="w-5 h-5" />,
      color: 'bg-green-600',
    },
    {
      type: 'diagnostics' as const,
      label: 'Diagnostics',
      icon: <Activity className="w-5 h-5" />,
      color: 'bg-blue-600',
    },
  ];

  useEffect(() => {
    loadServices();
  }, [activeTab]);

  const loadServices = async () => {
    try {
      setLoading(true);

      let url = `${apiUrl}/integrated-services/discover?type=${activeTab}`;

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to load services');
      }

      const data = await response.json();
      setServices(data.data?.services || []);
    } catch (err) {
      console.error('Error loading services:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredServices = services.filter(service =>
    service.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    service.location.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getServiceTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      ambulance: 'bg-red-100 text-red-800',
      medicine: 'bg-green-100 text-green-800',
      diagnostics: 'bg-blue-100 text-blue-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="mb-2">Integrated Pet Healthcare Services</h1>
        <p className="text-gray-600">
          Emergency ambulance, medicine delivery, and diagnostic services
        </p>
      </div>

      {/* Service Type Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {serviceTypes.map(type => (
          <button
            key={type.type}
            onClick={() => setActiveTab(type.type)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
              activeTab === type.type
                ? `${type.color} text-white`
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {type.icon}
            <span>{type.label}</span>
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name or location..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Ambulance className="w-5 h-5 text-red-600" />
            <span className="text-sm text-gray-600">Ambulances</span>
          </div>
          <div className="text-2xl text-red-600">
            {services.filter(s => s.serviceType === 'ambulance').length}
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Pill className="w-5 h-5 text-green-600" />
            <span className="text-sm text-gray-600">Pharmacies</span>
          </div>
          <div className="text-2xl text-green-600">
            {services.filter(s => s.serviceType === 'medicine').length}
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-gray-600">Diagnostics</span>
          </div>
          <div className="text-2xl text-blue-600">
            {services.filter(s => s.serviceType === 'diagnostics').length}
          </div>
        </div>
      </div>

      {/* Services List */}
      {loading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-gray-100 rounded-lg p-6 animate-pulse" style={{ height: '120px' }} />
          ))}
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center text-gray-600">
          {searchQuery ? (
            <>No services found matching "{searchQuery}"</>
          ) : (
            <>No {activeTab === 'all' ? 'integrated' : activeTab} services available</>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredServices.map(service => (
            <button
              key={service.serviceId}
              onClick={() => onServiceSelect?.(service)}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:border-blue-500 hover:shadow-md transition-all text-left"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg">{service.vendorName}</h3>
                    <span className={`px-2 py-0.5 text-xs rounded-full capitalize ${getServiceTypeColor(service.serviceType)}`}>
                      {service.serviceType === 'medicine' ? 'Pharmacy' : service.serviceType}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {service.location.address}
                    </span>
                    {service.distance && (
                      <span>{service.distance.toFixed(1)}km away</span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <span className={`flex items-center gap-1 px-2 py-1 rounded ${
                      service.isAvailable
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {service.isAvailable ? '✓ Available' : '⊗ Unavailable'}
                    </span>
                    {service.estimatedResponseTime && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        ~{service.estimatedResponseTime} min
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 stroke-yellow-400" />
                      {service.rating.toFixed(1)}
                    </span>
                  </div>
                </div>

                <div className="ml-4">
                  <div className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                    Book Now
                  </div>
                </div>
              </div>

              {service.services.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-3 border-t border-gray-100">
                  {service.services.slice(0, 4).map((s, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-gray-100 text-xs rounded">
                      {s}
                    </span>
                  ))}
                  {service.services.length > 4 && (
                    <span className="px-2 py-0.5 text-xs text-gray-500">
                      +{service.services.length - 4} more
                    </span>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
