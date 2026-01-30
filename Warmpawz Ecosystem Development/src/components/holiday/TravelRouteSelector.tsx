import { useState, useEffect } from 'react';
import { Plane, Train, Car, Clock, DollarSign, Check, Star } from 'lucide-react';
import { Card } from '../ui/card';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

interface TravelRouteSelectorProps {
  origin?: string;
  destination?: string;
  travelDate?: string;
  onSelectRoute?: (route: any) => void;
}

export function TravelRouteSelector({ origin, destination, travelDate, onSelectRoute }: TravelRouteSelectorProps) {
  const [routes, setRoutes] = useState<any[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const API_BASE = getApiBaseUrl();

  useEffect(() => {
    fetchRoutes();
  }, [origin, destination, travelDate]);

  const fetchRoutes = async () => {
    try {
      const params = new URLSearchParams();
      if (origin) params.append('origin', origin);
      if (destination) params.append('destination', destination);
      if (travelDate) params.append('travelDate', travelDate);

      const response = await fetch(`${API_BASE}/travel/route-options?${params}`, {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setRoutes(data.routes);
        }
      }
    } catch (error) {
      console.error('Failed to fetch routes:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTransportIcon = (type: string) => {
    switch (type) {
      case 'flight': return <Plane className="w-6 h-6" />;
      case 'train': return <Train className="w-6 h-6" />;
      case 'road': return <Car className="w-6 h-6" />;
      default: return <Car className="w-6 h-6" />;
    }
  };

  const handleSelectRoute = (route: any) => {
    setSelectedRoute(route.id);
    if (onSelectRoute) {
      onSelectRoute(route);
    }
  };

  if (loading) {
    return (
      <div className="py-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
        <p className="text-sm text-gray-500">Finding best routes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900">Choose Travel Route</h3>
        <p className="text-sm text-gray-500">{routes.length} options available</p>
      </div>

      {/* Routes */}
      <div className="space-y-3">
        {routes.map((route) => (
          <Card
            key={route.id}
            onClick={() => handleSelectRoute(route)}
            className={`p-4 cursor-pointer transition-all border-2 ${
              selectedRoute === route.id
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 hover:border-orange-200'
            } ${route.recommended ? 'ring-2 ring-orange-200' : ''}`}
          >
            {/* Recommended Badge */}
            {route.recommended && (
              <div className="flex items-center gap-1 mb-2">
                <Star className="w-4 h-4 text-orange-500 fill-orange-500" />
                <span className="text-xs font-bold text-orange-600">RECOMMENDED</span>
              </div>
            )}

            <div className="flex items-start gap-4">
              {/* Transport Icon */}
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                route.type === 'flight' ? 'bg-blue-100 text-blue-600' :
                route.type === 'train' ? 'bg-green-100 text-green-600' :
                'bg-purple-100 text-purple-600'
              }`}>
                {getTransportIcon(route.type)}
              </div>

              {/* Route Details */}
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-bold text-gray-900">{route.name}</h4>
                    <p className="text-sm text-gray-600">{route.carrier}</p>
                  </div>
                  
                  {selectedRoute === route.id && (
                    <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>

                {/* Duration & Price */}
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>{route.duration}</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-bold text-gray-900">
                    <DollarSign className="w-4 h-4" />
                    <span>₹{route.price.toLocaleString()}</span>
                  </div>
                  <div className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    route.petFriendly 
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {route.petFriendly ? '✓ Pet Friendly' : '✗ Not Pet Friendly'}
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-1">
                  {route.features.map((feature: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-gray-700">{feature}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {selectedRoute && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-900">
            ✓ Route selected! Proceed to complete your booking.
          </p>
        </div>
      )}
    </div>
  );
}
