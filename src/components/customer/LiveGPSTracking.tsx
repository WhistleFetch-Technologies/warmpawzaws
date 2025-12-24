/**
 * LIVE GPS TRACKING UI - COMPLETE IMPLEMENTATION
 * 
 * Real-time GPS tracking for home service bookings
 * 
 * Features:
 * - Live vendor location on map
 * - ETA calculation
 * - Route visualization
 * - Distance tracking
 * - Arrival notifications
 * - Auto-refresh every 10 seconds
 * 
 * P0 CRITICAL - Final UI Enhancement
 */

import { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Clock, Phone, X, RefreshCw, CheckCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

interface LiveGPSTrackingProps {
  bookingId: string;
  vendorName: string;
  vendorPhone: string;
  customerLocation: {
    latitude: number;
    longitude: number;
    address: string;
  };
  onClose: () => void;
}

interface LocationUpdate {
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
  speed?: number;
}

interface TrackingData {
  currentLocation: LocationUpdate | null;
  status: 'en_route' | 'nearby' | 'arrived';
  distanceKm: number;
  etaMinutes: number;
  route?: Array<{ lat: number; lng: number }>;
}

export function LiveGPSTracking({
  bookingId,
  vendorName,
  vendorPhone,
  customerLocation,
  onClose
}: LiveGPSTrackingProps) {
  const [trackingData, setTrackingData] = useState<TrackingData>({
    currentLocation: null,
    status: 'en_route',
    distanceKm: 0,
    etaMinutes: 0
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const vendorMarkerRef = useRef<any>(null);
  const customerMarkerRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);

  // Fetch tracking data
  const fetchTrackingData = async () => {
    try {
      setIsRefreshing(true);
      
      const response = await fetch(
        `${API_BASE}/tracking/location/${bookingId}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.location) {
          // Calculate distance using Haversine formula
          const distance = calculateDistance(
            customerLocation.latitude,
            customerLocation.longitude,
            data.location.latitude,
            data.location.longitude
          );

          // Estimate ETA (assuming average speed of 30 km/h in city)
          const etaMinutes = Math.ceil((distance / 30) * 60);

          // Determine status based on distance
          let status: 'en_route' | 'nearby' | 'arrived' = 'en_route';
          if (distance < 0.1) {
            status = 'arrived';
          } else if (distance < 0.5) {
            status = 'nearby';
          }

          setTrackingData({
            currentLocation: data.location,
            status,
            distanceKm: distance,
            etaMinutes,
            route: data.route
          });

          setLastUpdated(new Date());
        }
      }
    } catch (error) {
      console.error('Error fetching tracking data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Initialize map
  useEffect(() => {
    fetchTrackingData();

    // Set up auto-refresh every 10 seconds
    refreshIntervalRef.current = setInterval(fetchTrackingData, 10000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [bookingId]);

  // Load Google Maps API
  useEffect(() => {
    let isMounted = true;
    
    async function loadGoogleMaps() {
      try {
        // Check env var first
        const envApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (envApiKey) {
          if (window.google && window.google.maps) {
            if (isMounted) setMapLoaded(true);
            return;
          }
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${envApiKey}&libraries=geometry,directions`;
          script.async = true;
          script.defer = true;
          script.onload = () => { if (isMounted) setMapLoaded(true); };
          script.onerror = () => { if (isMounted) { setError('Failed to load map'); } };
          document.head.appendChild(script);
          return;
        }
        
        // Fetch from backend
        const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/integrations/settings`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          const apiKey = data.settings?.googleMaps?.apiKey;
          
          if (!apiKey) {
            if (isMounted) {
              console.warn('Google Maps API key not configured');
            }
            return;
          }

          if (window.google && window.google.maps) {
            if (isMounted) setMapLoaded(true);
            return;
          }

          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,directions`;
          script.async = true;
          script.defer = true;
          script.onload = () => { if (isMounted) setMapLoaded(true); };
          script.onerror = () => { if (isMounted) { console.error('Failed to load map'); } };
          document.head.appendChild(script);
        }
      } catch (err) {
        console.error('Error loading Google Maps:', err);
      }
    }
    
    loadGoogleMaps();
    return () => { isMounted = false; };
  }, []);

  // Initialize map when loaded
  useEffect(() => {
    if (!mapLoaded || !trackingData.currentLocation || !mapRef.current) return;
    
    if (!mapInstanceRef.current) {
      const vendorLatLng = new window.google.maps.LatLng(
        trackingData.currentLocation.latitude,
        trackingData.currentLocation.longitude
      );
      
      const customerLatLng = new window.google.maps.LatLng(
        customerLocation.latitude,
        customerLocation.longitude
      );

      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(vendorLatLng);
      bounds.extend(customerLatLng);

      const map = new window.google.maps.Map(mapRef.current, {
        zoom: 14,
        center: vendorLatLng,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      });

      mapInstanceRef.current = map;
      map.fitBounds(bounds);

      // Vendor marker
      vendorMarkerRef.current = new window.google.maps.Marker({
        position: vendorLatLng,
        map: map,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="20" fill="#10B981" stroke="white" stroke-width="3"/>
              <path d="M24 14 L30 30 L24 26 L18 30 Z" fill="white"/>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(48, 48),
          anchor: new window.google.maps.Point(24, 24)
        },
        title: vendorName,
        animation: window.google.maps.Animation.DROP
      });

      // Customer marker
      customerMarkerRef.current = new window.google.maps.Marker({
        position: customerLatLng,
        map: map,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
              <path d="M20 5 C15 5 10 9 10 15 C10 23 20 35 20 35 S30 23 30 15 C30 9 25 5 20 5 Z" fill="#EF4444" stroke="white" stroke-width="2"/>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(40, 40),
          anchor: new window.google.maps.Point(20, 40)
        },
        title: 'Your Location'
      });

      // Draw route if available
      if (trackingData.route && trackingData.route.length > 0) {
        const routePath = trackingData.route.map((point: any) => 
          new window.google.maps.LatLng(point.lat, point.lng)
        );
        
        routePolylineRef.current = new window.google.maps.Polyline({
          path: routePath,
          geodesic: true,
          strokeColor: '#3B82F6',
          strokeOpacity: 0.8,
          strokeWeight: 4
        });
        routePolylineRef.current.setMap(map);
      } else {
        // Use Directions Service to get route
        const directionsService = new window.google.maps.DirectionsService();
        const directionsRenderer = new window.google.maps.DirectionsRenderer();
        directionsRenderer.setMap(map);

        directionsService.route({
          origin: vendorLatLng,
          destination: customerLatLng,
          travelMode: window.google.maps.TravelMode.DRIVING
        }, (result, status) => {
          if (status === 'OK' && result) {
            directionsRenderer.setDirections(result);
          }
        });
      }
    } else {
      // Update vendor marker position
      if (vendorMarkerRef.current && trackingData.currentLocation) {
        const newPosition = new window.google.maps.LatLng(
          trackingData.currentLocation.latitude,
          trackingData.currentLocation.longitude
        );
        vendorMarkerRef.current.setPosition(newPosition);
      }
    }
  }, [mapLoaded, trackingData, customerLocation]);

  // Render map
  const renderMap = () => {
    if (!mapLoaded) {
      return (
        <div className="h-full flex items-center justify-center bg-gray-100 rounded-lg">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Loading map...</p>
          </div>
        </div>
      );
    }

    if (!trackingData.currentLocation) {
      return (
        <div className="h-full flex items-center justify-center bg-gray-100 rounded-lg">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Loading location...</p>
          </div>
        </div>
      );
    }

    return (
      <div ref={mapRef} className="h-full w-full rounded-lg" />
    );
  };

  const getStatusBadge = () => {
    switch (trackingData.status) {
      case 'arrived':
        return (
          <div className="flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-full">
            <CheckCircle className="w-5 h-5" />
            <span className="font-semibold">Vendor has arrived!</span>
          </div>
        );
      case 'nearby':
        return (
          <div className="flex items-center gap-2 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full">
            <Navigation className="w-5 h-5 animate-pulse" />
            <span className="font-semibold">Nearby - Arriving soon</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-full">
            <Navigation className="w-5 h-5" />
            <span className="font-semibold">On the way</span>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <div>
            <h2 className="text-xl font-bold">Live Tracking</h2>
            <p className="text-sm opacity-90">{vendorName} is on the way</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Status Badge */}
        <div className="p-4 flex justify-center border-b">
          {getStatusBadge()}
        </div>

        {/* Map */}
        <div ref={mapRef} className="flex-1 min-h-[300px]">
          {renderMap()}
        </div>

        {/* Info Cards */}
        <div className="p-4 grid grid-cols-3 gap-3 border-t bg-gray-50">
          <div className="bg-white p-3 rounded-lg shadow-sm text-center">
            <MapPin className="w-6 h-6 text-blue-600 mx-auto mb-1" />
            <p className="text-xs text-gray-500">Distance</p>
            <p className="text-lg font-bold text-gray-800">
              {trackingData.distanceKm.toFixed(1)} km
            </p>
          </div>

          <div className="bg-white p-3 rounded-lg shadow-sm text-center">
            <Clock className="w-6 h-6 text-green-600 mx-auto mb-1" />
            <p className="text-xs text-gray-500">ETA</p>
            <p className="text-lg font-bold text-gray-800">
              {trackingData.etaMinutes} min
            </p>
          </div>

          <div className="bg-white p-3 rounded-lg shadow-sm text-center">
            <Navigation className="w-6 h-6 text-purple-600 mx-auto mb-1" />
            <p className="text-xs text-gray-500">Status</p>
            <p className="text-sm font-semibold text-gray-800 capitalize">
              {trackingData.status.replace('_', ' ')}
            </p>
          </div>
        </div>

        {/* Last Updated */}
        {lastUpdated && (
          <div className="px-4 py-2 border-t bg-gray-50 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
            <button
              onClick={fetchTrackingData}
              disabled={isRefreshing}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="p-4 border-t flex gap-3">
          <Button
            onClick={() => window.open(`tel:${vendorPhone}`)}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          >
            <Phone className="w-4 h-4 mr-2" />
            Call {vendorName}
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1"
          >
            Close
          </Button>
        </div>
      </Card>
    </div>
  );
}
