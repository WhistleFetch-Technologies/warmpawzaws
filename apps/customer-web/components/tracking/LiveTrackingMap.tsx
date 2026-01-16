"use client";

import { useState, useEffect } from 'react';
import { MapPin, Navigation, Phone } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface LiveTrackingMapProps {
  bookingId: string;
  currentLocation?: { latitude: number; longitude: number };
  route?: Array<{ latitude: number; longitude: number }>;
  walkerName?: string;
  walkerPhone?: string;
  petName?: string;
  onClose?: () => void;
}

export function LiveTrackingMap({ bookingId, currentLocation, route, walkerName, walkerPhone, petName, onClose }: LiveTrackingMapProps) {
  const [mapUrl, setMapUrl] = useState<string>('');

  useEffect(() => {
    if (currentLocation) {
      // Generate Google Maps static image URL
      const url = `https://maps.googleapis.com/maps/api/staticmap?center=${currentLocation.latitude},${currentLocation.longitude}&zoom=15&size=600x400&markers=color:red%7C${currentLocation.latitude},${currentLocation.longitude}`;
      setMapUrl(url);
    }
  }, [currentLocation]);

  return (
    <Card className="w-full overflow-hidden">
      <div className="w-full h-64 bg-gray-200 rounded-lg flex flex-col items-center justify-center relative">
        {mapUrl ? (
          <img 
            src={mapUrl} 
            alt="Live tracking map" 
            className="w-full h-full object-cover"
            onError={() => setMapUrl('')}
          />
        ) : (
          <>
            <Navigation className="w-12 h-12 text-gray-400 mb-2" />
            <p className="text-gray-500 text-sm">Live tracking map</p>
            {currentLocation && (
              <p className="text-xs text-gray-400 mt-1">
                {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
              </p>
            )}
          </>
        )}
        {walkerName && (
          <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{walkerName}</p>
                {petName && <p className="text-sm text-gray-600">Walking {petName}</p>}
              </div>
              {walkerPhone && (
                <a 
                  href={`tel:${walkerPhone}`}
                  className="p-2 bg-[#FF8C42] text-white rounded-full hover:bg-[#FF7A29] transition-colors"
                >
                  <Phone className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

