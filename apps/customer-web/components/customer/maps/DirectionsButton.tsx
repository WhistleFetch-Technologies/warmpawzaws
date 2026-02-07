'use client';

/**
 * ============================================================================
 * GOOGLE MAPS DIRECTIONS BUTTON COMPONENT
 * ============================================================================
 * 
 * One-click navigation to vendor/center location
 * - Opens Google Maps with directions
 * - Shows distance and ETA
 * - Supports walking, driving, and transit modes
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { Navigation, MapPin, Clock, Car, PersonStanding, Bus, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';

interface DirectionsButtonProps {
  destinationLat: number;
  destinationLng: number;
  destinationName: string;
  destinationAddress?: string;
  variant?: 'button' | 'icon' | 'card';
  showETA?: boolean;
  userLocation?: { lat: number; lng: number };
  className?: string;
}

interface DirectionsInfo {
  distance: string;
  duration: string;
  durationValue: number; // in seconds
}

const TRAVEL_MODES = {
  driving: { icon: Car, label: 'Drive' },
  walking: { icon: PersonStanding, label: 'Walk' },
  transit: { icon: Bus, label: 'Transit' },
};

export function DirectionsButton({
  destinationLat,
  destinationLng,
  destinationName,
  destinationAddress,
  variant = 'button',
  showETA = false,
  userLocation,
  className = '',
}: DirectionsButtonProps) {
  const [directionsInfo, setDirectionsInfo] = useState<DirectionsInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(userLocation || null);
  const [travelMode, setTravelMode] = useState<'driving' | 'walking' | 'transit'>('driving');

  useEffect(() => {
    if (showETA && !currentLocation) {
      getCurrentLocation();
    }
  }, [showETA, currentLocation]);

  useEffect(() => {
    if (showETA && currentLocation) {
      fetchDirections();
    }
  }, [currentLocation, travelMode, destinationLat, destinationLng]);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Geolocation error:', error);
        }
      );
    }
  };

  const fetchDirections = async () => {
    if (!currentLocation) return;

    setLoading(true);
    try {
      const res = await apiClient.get<any>(
        `/maps/directions?originLat=${currentLocation.lat}&originLng=${currentLocation.lng}&destLat=${destinationLat}&destLng=${destinationLng}&mode=${travelMode}`
      );

      if (res.success && res.route) {
        setDirectionsInfo({
          distance: res.route.distance,
          duration: res.route.duration,
          durationValue: res.route.durationValue,
        });
      }
    } catch (error) {
      console.error('Error fetching directions:', error);
      // Fallback: Calculate rough estimate
      if (currentLocation) {
        const distance = calculateDistance(
          currentLocation.lat, currentLocation.lng,
          destinationLat, destinationLng
        );
        const durationMins = travelMode === 'driving' 
          ? Math.round(distance / 30 * 60)  // 30 km/h avg
          : travelMode === 'walking' 
          ? Math.round(distance / 5 * 60)   // 5 km/h walking
          : Math.round(distance / 20 * 60); // 20 km/h transit

        setDirectionsInfo({
          distance: distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`,
          duration: durationMins < 60 ? `${durationMins} min` : `${Math.floor(durationMins / 60)}h ${durationMins % 60}m`,
          durationValue: durationMins * 60,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const openGoogleMaps = () => {
    const origin = currentLocation 
      ? `${currentLocation.lat},${currentLocation.lng}` 
      : '';
    const destination = `${destinationLat},${destinationLng}`;
    
    // Google Maps directions URL
    const url = origin
      ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=${travelMode}&destination_place_id=${encodeURIComponent(destinationName)}`
      : `https://www.google.com/maps/search/?api=1&query=${destination}`;
    
    window.open(url, '_blank');
  };

  // Icon only variant
  if (variant === 'icon') {
    return (
      <button
        onClick={openGoogleMaps}
        className={`p-2 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 transition ${className}`}
        title={`Get directions to ${destinationName}`}
      >
        <Navigation className="w-5 h-5" />
      </button>
    );
  }

  // Card variant with ETA
  if (variant === 'card') {
    return (
      <div className={`bg-white rounded-xl border border-gray-200 p-4 ${className}`}>
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <MapPin className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-900 truncate">{destinationName}</h4>
            {destinationAddress && (
              <p className="text-sm text-gray-500 truncate">{destinationAddress}</p>
            )}
          </div>
        </div>

        {/* Travel mode selector */}
        {showETA && (
          <div className="flex gap-2 mb-3">
            {(Object.entries(TRAVEL_MODES) as [keyof typeof TRAVEL_MODES, typeof TRAVEL_MODES[keyof typeof TRAVEL_MODES]][]).map(([mode, config]) => {
              const Icon = config.icon;
              return (
                <button
                  key={mode}
                  onClick={() => setTravelMode(mode)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm flex items-center justify-center gap-1 transition ${
                    travelMode === mode
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {config.label}
                </button>
              );
            })}
          </div>
        )}

        {/* ETA info */}
        {directionsInfo && (
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="font-medium text-gray-900">{directionsInfo.duration}</span>
            </div>
            <span className="text-sm text-gray-500">{directionsInfo.distance}</span>
          </div>
        )}

        <Button
          onClick={openGoogleMaps}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          <Navigation className="w-4 h-4 mr-2" />
          Get Directions
          <ExternalLink className="w-3 h-3 ml-2" />
        </Button>
      </div>
    );
  }

  // Default button variant
  return (
    <Button
      onClick={openGoogleMaps}
      variant="outline"
      className={`${className}`}
    >
      <Navigation className="w-4 h-4 mr-2" />
      {directionsInfo ? (
        <>
          Directions
          <span className="ml-2 text-gray-500">({directionsInfo.duration})</span>
        </>
      ) : (
        'Get Directions'
      )}
    </Button>
  );
}

export default DirectionsButton;
