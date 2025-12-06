import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Star, Search, Heart } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { ImageWithFallback } from '../../figma/ImageWithFallback';

interface SunsetServiceListViewProps {
  phone: string;
  serviceType: 'at_home' | 'at_center' | null;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

export function SunsetServiceListView({ phone, serviceType, onBack, onNavigate }: SunsetServiceListViewProps) {
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      const response = await fetch(`${API_BASE}/vendors/by-role/sunset`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` }
      });
      if (response.ok) {
        const data = await response.json();
        setProviders(data.vendors || []);
      }
    } catch (error) {
      console.error('Error loading providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProviders = providers.filter(provider =>
    provider.businessName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    provider.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-semibold">Care Providers</h1>
            <p className="text-sm text-gray-600">
              {serviceType === 'at_home' ? 'At-Home Services' : 'Facility Services'}
            </p>
          </div>
        </div>

        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search providers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {filteredProviders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No providers found</p>
          </div>
        ) : (
          filteredProviders.map((provider) => (
            <div
              key={provider.id}
              onClick={() => onNavigate('service-details', provider)}
              className="bg-white rounded-xl p-4 border border-gray-200 hover:border-purple-500 transition-colors cursor-pointer"
            >
              <div className="flex gap-3">
                <ImageWithFallback
                  src={provider.logo || '/placeholder-sunset.png'}
                  alt={provider.businessName}
                  className="w-20 h-20 rounded-lg object-cover"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{provider.businessName}</h3>
                  
                  {provider.rating && (
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium">{provider.rating}</span>
                      <span className="text-xs text-gray-500">({provider.reviewCount || 0})</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-1 mt-1 text-gray-600">
                    <MapPin className="w-3 h-3" />
                    <span className="text-xs truncate">{provider.address}</span>
                  </div>
                  
                  <div className="flex items-center gap-1 mt-1 text-purple-600">
                    <Heart className="w-3 h-3" />
                    <span className="text-xs">Compassionate Care Available 24/7</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
