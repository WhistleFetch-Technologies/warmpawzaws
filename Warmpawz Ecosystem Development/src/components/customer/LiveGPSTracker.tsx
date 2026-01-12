/**
 * Live GPS Tracker Component for Customer App
 * Shows real-time location of vendor during at_home services
 */

import { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Clock, Circle } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

interface LocationPoint {
  lat: number;
  lng: number;
}

interface TrackingData {
  id: string;
  status: 'pending' | 'in_progress' | 'completed';
  walkerName?: string;
  petName?: string;
  currentLocation: LocationPoint;
  petLocation?: LocationPoint;
  route: LocationPoint[];
  distance: number;
  duration: number;
  speed?: number;
  heading?: number;
  lastUpdate?: string;
}

interface LiveGPSTrackerProps {
  bookingId: string;
  vendorName?: string;
  petName?: string;
  destinationLocation?: LocationPoint;
  onTrackingEnd?: () => void;
}

export function LiveGPSTracker({
  bookingId,
  vendorName,
  petName,
  destinationLocation,
  onTrackingEnd
}: LiveGPSTrackerProps) {
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const vendorMarkerRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetch tracking data
   */
  const fetchTrackingData = async () => {
    try {
      const response = await fetch(`${API_BASE}/session/${bookingId}/tracking`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tracking data');
      }

      const data = await response.json();
      
      if (data.session) {
        setTrackingData(data.session);
        setError(null);
        
        // Update map if loaded
        if (mapLoaded && mapInstanceRef.current) {
          updateMap(data.session);
        }

        // Check if tracking ended
        if (data.session.status === 'completed' && onTrackingEnd) {
          onTrackingEnd();
        }
      }
      
      setIsLoading(false);
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  /**
   * Initialize map
   */
  const initializeMap = () => {
    if (!mapRef.current || !window.google) return;

    const center = trackingData?.currentLocation || { lat: 12.9716, lng: 77.5946 };

    const map = new window.google.maps.Map(mapRef.current, {
      center,
      zoom: 15,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true
    });

    mapInstanceRef.current = map;
    setMapLoaded(true);

    // Add markers
    if (trackingData) {
      updateMap(trackingData);
    }
  };

  /**
   * Update map with latest tracking data
   */
  const updateMap = (data: TrackingData) => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Update vendor marker
    if (vendorMarkerRef.current) {
      vendorMarkerRef.current.setPosition(data.currentLocation);
    } else {
      vendorMarkerRef.current = new window.google.maps.Marker({
        position: data.currentLocation,
        map,
        title: data.walkerName || vendorName || 'Service Provider',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#4F46E5',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3
        }
      });
    }

    // Update route polyline
    if (data.route.length > 1) {
      if (routePolylineRef.current) {
        routePolylineRef.current.setPath(data.route);
      } else {
        routePolylineRef.current = new window.google.maps.Polyline({
          path: data.route,
          geodesic: true,
          strokeColor: '#4F46E5',
          strokeOpacity: 0.8,
          strokeWeight: 4,
          map
        });
      }
    }

    // Add destination marker if provided
    if (destinationLocation && !map.destinationMarker) {
      map.destinationMarker = new window.google.maps.Marker({
        position: destinationLocation,
        map,
        title: 'Destination',
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#10B981"/>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(32, 32)
        }
      });
    }

    // Center map on current location
    map.setCenter(data.currentLocation);
  };

  /**
   * Start polling for updates
   */
  useEffect(() => {
    fetchTrackingData();

    // Poll every 3 seconds
    pollIntervalRef.current = setInterval(() => {
      fetchTrackingData();
    }, 3000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [bookingId]);

  /**
   * Initialize Google Maps
   */
  useEffect(() => {
    if (trackingData && !mapLoaded) {
      // Check if Google Maps is already loaded
      if (window.google && window.google.maps) {
        initializeMap();
      } else {
        // Wait for Google Maps to load
        const checkGoogleMaps = setInterval(() => {
          if (window.google && window.google.maps) {
            clearInterval(checkGoogleMaps);
            initializeMap();
          }
        }, 100);

        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkGoogleMaps);
          if (!window.google) {
            setError('Failed to load Google Maps');
          }
        }, 10000);
      }
    }
  }, [trackingData, mapLoaded]);

  /**
   * Format duration
   */
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  if (isLoading && !trackingData) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Circle className="size-8 animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-600">Loading tracking data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">❌ {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Map Container */}
      <div 
        ref={mapRef} 
        className="w-full h-80 rounded-lg border border-gray-200"
        style={{ minHeight: '320px' }}
      />

      {/* Tracking Stats */}
      {trackingData && (
        <div className="grid grid-cols-3 gap-4">
          {/* Distance */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <Navigation className="size-6 mx-auto mb-2 text-blue-600" />
            <p className="text-sm text-gray-600">Distance</p>
            <p className="text-lg">{trackingData.distance.toFixed(2)} km</p>
          </div>

          {/* Duration */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <Clock className="size-6 mx-auto mb-2 text-green-600" />
            <p className="text-sm text-gray-600">Duration</p>
            <p className="text-lg">{formatDuration(trackingData.duration)}</p>
          </div>

          {/* Status */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <MapPin className="size-6 mx-auto mb-2 text-purple-600" />
            <p className="text-sm text-gray-600">Status</p>
            <p className="text-lg capitalize">
              {trackingData.status === 'in_progress' ? '🟢 Live' : 
               trackingData.status === 'completed' ? '✅ Completed' : '⏳ Pending'}
            </p>
          </div>
        </div>
      )}

      {/* Live Indicator */}
      {trackingData?.status === 'in_progress' && (
        <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
          <div className="size-2 rounded-full bg-green-500 animate-pulse" />
          <span>Live tracking • Updates every 3s</span>
        </div>
      )}

      {/* Vendor Info */}
      {trackingData && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Service Provider</p>
              <p className="font-medium">{trackingData.walkerName || vendorName || 'Unknown'}</p>
            </div>
            {trackingData.petName && (
              <div className="text-right">
                <p className="text-sm text-gray-600">Pet</p>
                <p className="font-medium">{trackingData.petName}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
