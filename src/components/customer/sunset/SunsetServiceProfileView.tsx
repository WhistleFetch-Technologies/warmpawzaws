import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Star, Heart, Shield, Clock } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { ImageWithFallback } from '../../figma/ImageWithFallback';

interface SunsetServiceProfileViewProps {
  phone: string;
  vendorId: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

export function SunsetServiceProfileView({ phone, vendorId, onBack, onNavigate }: SunsetServiceProfileViewProps) {
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadVendorDetails();
  }, [vendorId]);

  const loadVendorDetails = async () => {
    try {
      const response = await fetch(`${API_BASE}/vendor/${vendorId}`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` }
      });
      if (response.ok) {
        const data = await response.json();
        setVendor(data.vendor || data);
      }
    } catch (error) {
      console.error('Error loading vendor:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <p className="text-gray-500">Provider not found</p>
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
          <h1 className="font-semibold">Provider Details</h1>
        </div>
      </div>

      <div className="bg-white p-4 border-b border-gray-200">
        <div className="flex gap-4">
          <ImageWithFallback
            src={vendor.logo || '/placeholder-sunset.png'}
            alt={vendor.businessName}
            className="w-24 h-24 rounded-xl object-cover"
          />
          <div className="flex-1">
            <h2 className="font-semibold">{vendor.businessName}</h2>
            
            {vendor.rating && (
              <div className="flex items-center gap-1 mt-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="font-medium">{vendor.rating}</span>
                <span className="text-sm text-gray-500">({vendor.reviewCount || 0})</span>
              </div>
            )}
            
            <div className="flex items-center gap-1 mt-2 text-gray-600">
              <MapPin className="w-4 h-4" />
              <span className="text-sm">{vendor.address}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <Heart className="w-5 h-5 text-purple-600 mx-auto mb-1" />
            <p className="text-xs text-gray-600">Care</p>
            <p className="font-semibold text-sm">24/7</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <Shield className="w-5 h-5 text-purple-600 mx-auto mb-1" />
            <p className="text-xs text-gray-600">Licensed</p>
            <p className="font-semibold text-sm">Verified</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <Star className="w-5 h-5 text-purple-600 mx-auto mb-1" />
            <p className="text-xs text-gray-600">Rating</p>
            <p className="font-semibold text-sm">{vendor.rating || '5.0'}/5</p>
          </div>
        </div>
      </div>

      {vendor.description && (
        <div className="bg-white mt-2 p-4 border-b border-gray-200">
          <h3 className="font-semibold mb-2">About</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{vendor.description}</p>
        </div>
      )}

      {vendor.services && vendor.services.length > 0 && (
        <div className="bg-white mt-2 p-4">
          <h3 className="font-semibold mb-3">Services Offered</h3>
          <div className="space-y-2">
            {vendor.services.map((service: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-sm">{service.serviceName || service.name}</p>
                  {service.description && (
                    <p className="text-xs text-gray-500 mt-1">{service.description}</p>
                  )}
                </div>
                {service.price && (
                  <p className="font-semibold text-purple-600">₹{service.price}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 max-w-md mx-auto">
        <button
          onClick={() => onNavigate('select_service')}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-700 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all"
        >
          Request Service
        </button>
      </div>
    </div>
  );
}
