'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Star, Clock, Phone, Search } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';
import { formatOperatingHours } from '@/lib/format-utils';
import { DiscoveryProviderAvatar } from '../shared/DiscoveryProviderAvatar';

interface VetCenterListViewProps {
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

export function VetCenterListView({ phone, onBack, onNavigate }: VetCenterListViewProps) {
  const [centers, setCenters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadVetCenters();
  }, []);

  const loadVetCenters = async () => {
    try {
      const response = await apiClient.get<{ vendors: any[] }>('/vendors/by-role/vet');
      if (response.vendors) {
        setCenters(response.vendors);
      }
    } catch (error) {
      console.error('Error loading centers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCenters = centers.filter(center =>
    center.businessName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    center.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
        <div className="px-4 py-0 flex items-center gap-3">
          <button onClick={onBack} className="p-0 -ml-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-semibold">Vet Clinics Near You</h1>
            <p className="text-sm text-gray-600">{filteredCenters.length} clinics available</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-4 pb-0">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-0/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search vet clinics..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              className="w-full pl-0 pr-4 py-0 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Centers List */}
      <div className="p-4 space-y-3">
        {filteredCenters.length === 0 ? (
          <div className="text-center py-0">
            <p className="text-gray-500">No vet clinics found</p>
          </div>
        ) : (
          filteredCenters.map((center) => (
            <div
              key={center.id}
              onClick={() => onNavigate('center-details', center)}
              className="bg-white rounded-xl p-4 border border-gray-200 hover:border-primary transition-colors cursor-pointer"
            >
              <div className="flex gap-3">
                <DiscoveryProviderAvatar
                  name={center.businessName}
                  photo={center.logo}
                  className="w-20 h-20 rounded-lg object-cover"
                  fallbackClassName="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center"
                  fallback={<span className="text-2xl">🏥</span>}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{center.businessName}</h3>
                  
                  {center.rating && (
                    <div className="flex items-center gap-3 mt-0">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium">{center.rating}</span>
                      <span className="text-xs text-gray-500">
                        ({center.reviewCount || 0} reviews)
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3 mt-0 text-gray-600">
                    <MapPin className="w-3 h-3" />
                    <span className="text-xs truncate">{center.address}</span>
                  </div>
                  
                  {center.operatingHours && (
                    <div className="flex items-center gap-3 mt-0 text-gray-600">
                      <Clock className="w-3 h-3" />
                      <span className="text-xs">{formatOperatingHours(center.operatingHours)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Services Preview */}
              {center.services && center.services.length > 0 && (
                <div className="mt-0 pt-0 border-t border-gray-100">
                  <div className="flex flex-wrap gap-3">
                    {center.services.slice(0, 3).map((service: any, idx: number) => (
                      <span
                        key={idx}
                        className="text-xs bg-orange-50 text-primary px-0 py-0 rounded-full"
                      >
                        {service.serviceName || service.name}
                      </span>
                    ))}
                    {center.services.length > 3 && (
                      <span className="text-xs text-gray-500 px-0 py-0">
                        +{center.services.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

