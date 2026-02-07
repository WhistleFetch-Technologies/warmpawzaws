import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Star, Heart, Users } from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';
import { ImageWithFallback } from '../../figma/ImageWithFallback';

interface AdoptionCenterProfileViewProps {
  phone: string;
  centerId: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

export function AdoptionCenterProfileView({ phone, centerId, onBack, onNavigate }: AdoptionCenterProfileViewProps) {
  const [center, setCenter] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const API_BASE = getApiBaseUrl();

  useEffect(() => {
    loadCenterDetails();
  }, [centerId]);

  const loadCenterDetails = async () => {
    try {
      const response = await fetch(`${API_BASE}/vendor/${centerId}`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCenter(data.vendor || data);
      }
    } catch (error) {
      console.error('Error loading center:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  if (!center) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <p className="text-gray-500">Adoption center not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto pb-24">
      <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold">Center Details</h1>
        </div>
      </div>

      <div className="bg-white p-4 border-b border-gray-200">
        <div className="flex gap-4">
          <ImageWithFallback
            src={center.logo || '/placeholder-adoption.png'}
            alt={center.businessName}
            className="w-24 h-24 rounded-xl object-cover"
          />
          <div className="flex-1">
            <h2 className="font-semibold">{center.businessName}</h2>
            
            {center.rating && (
              <div className="flex items-center gap-1 mt-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="font-medium">{center.rating}</span>
                <span className="text-sm text-gray-500">({center.reviewCount || 0})</span>
              </div>
            )}
            
            <div className="flex items-center gap-1 mt-2 text-gray-600">
              <MapPin className="w-4 h-4" />
              <span className="text-sm">{center.address}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-pink-50 rounded-lg p-3 text-center">
            <Heart className="w-5 h-5 text-pink-500 mx-auto mb-1" />
            <p className="text-xs text-gray-600">Available</p>
            <p className="font-semibold text-sm">{center.availablePets || '50+'} pets</p>
          </div>
          <div className="bg-pink-50 rounded-lg p-3 text-center">
            <Users className="w-5 h-5 text-pink-500 mx-auto mb-1" />
            <p className="text-xs text-gray-600">Adopted</p>
            <p className="font-semibold text-sm">{center.adoptedPets || '200+'}</p>
          </div>
          <div className="bg-pink-50 rounded-lg p-3 text-center">
            <Star className="w-5 h-5 text-pink-500 mx-auto mb-1" />
            <p className="text-xs text-gray-600">Rating</p>
            <p className="font-semibold text-sm">{center.rating || '4.9'}/5</p>
          </div>
        </div>
      </div>

      {center.description && (
        <div className="bg-white mt-2 p-4 border-b border-gray-200">
          <h3 className="font-semibold mb-2">About</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{center.description}</p>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 max-w-md mx-auto">
        <button
          onClick={() => onNavigate('view_pets')}
          className="w-full bg-gradient-to-r from-pink-500 to-rose-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all"
        >
          View Available Pets
        </button>
      </div>
    </div>
  );
}
