import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Star, Clock, Search, Home, CalendarDays, ShoppingBag, User } from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';
import { ImageWithFallback } from '../../figma/ImageWithFallback';

interface TrainingCenterListViewProps {
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

export function TrainingCenterListView({ phone, onBack, onNavigate }: TrainingCenterListViewProps) {
  const [centers, setCenters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const API_BASE = getApiBaseUrl();

  useEffect(() => {
    loadTrainingCenters();
  }, []);

  const loadTrainingCenters = async () => {
    try {
      const response = await fetch(`${API_BASE}/vendors/by-role/training`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCenters(data.vendors || []);
      }
    } catch (error) {
      console.error('Error loading training centers:', error);
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
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
            <h1 className="font-semibold">Training Centers Near You</h1>
            <p className="text-sm text-gray-600">{filteredCenters.length} centers available</p>
          </div>
        </div>

        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search training centers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {filteredCenters.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No training centers found</p>
          </div>
        ) : (
          filteredCenters.map((center) => (
            <div
              key={center.id}
              onClick={() => onNavigate('center-details', center)}
              className="bg-white rounded-xl p-4 border border-gray-200 hover:border-[#FF8C42] transition-colors cursor-pointer"
            >
              <div className="flex gap-3">
                <ImageWithFallback
                  src={center.logo || '/placeholder-training.png'}
                  alt={center.businessName}
                  className="w-20 h-20 rounded-lg object-cover"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{center.businessName}</h3>
                  
                  {center.rating && (
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium">{center.rating}</span>
                      <span className="text-xs text-gray-500">
                        ({center.reviewCount || 0} reviews)
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-1 mt-1 text-gray-600">
                    <MapPin className="w-3 h-3" />
                    <span className="text-xs truncate">{center.address}</span>
                  </div>
                  
                  {center.operatingHours && (
                    <div className="flex items-center gap-1 mt-1 text-gray-600">
                      <Clock className="w-3 h-3" />
                      <span className="text-xs">{center.operatingHours}</span>
                    </div>
                  )}
                </div>
              </div>

              {center.services && center.services.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex flex-wrap gap-2">
                    {center.services.slice(0, 3).map((service: any, idx: number) => (
                      <span
                        key={idx}
                        className="text-xs bg-orange-50 text-[#FF8C42] px-2 py-1 rounded-full"
                      >
                        {service.serviceName || service.name}
                      </span>
                    ))}
                    {center.services.length > 3 && (
                      <span className="text-xs text-gray-500 px-2 py-1">
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

      {/* ✅ Fixed Bottom Navigation - Design Consistency */}
      <div className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto">
        <div className="bg-white border-t border-gray-100 shadow-lg px-2 py-2">
          <div className="flex items-center justify-around">
            <button
              onClick={() => onNavigate('home')}
              className="flex flex-col items-center gap-1 p-2 text-gray-400 hover:text-[#FF8C42] transition-colors"
            >
              <Home className="w-5 h-5" />
              <span className="text-[10px]">Home</span>
            </button>
            
            <button
              className="flex flex-col items-center gap-1 p-2 text-[#FF8C42]"
            >
              <Search className="w-5 h-5" />
              <span className="text-[10px] font-medium">Search</span>
            </button>
            
            <button
              onClick={() => onNavigate('my-bookings')}
              className="flex flex-col items-center gap-1 p-2 text-gray-400 hover:text-[#FF8C42] transition-colors"
            >
              <CalendarDays className="w-5 h-5" />
              <span className="text-[10px]">Bookings</span>
            </button>
            
            <button
              onClick={() => onNavigate('shop')}
              className="flex flex-col items-center gap-1 p-2 text-gray-400 hover:text-[#FF8C42] transition-colors"
            >
              <ShoppingBag className="w-5 h-5" />
              <span className="text-[10px]">Shop</span>
            </button>
            
            <button
              onClick={() => onNavigate('customer-profile')}
              className="flex flex-col items-center gap-1 p-2 text-gray-400 hover:text-[#FF8C42] transition-colors"
            >
              <User className="w-5 h-5" />
              <span className="text-[10px]">Profile</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
