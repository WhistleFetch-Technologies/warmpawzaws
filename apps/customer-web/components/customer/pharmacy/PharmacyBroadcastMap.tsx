'use client';

/**
 * ============================================================================
 * PHARMACY BROADCAST MAP - Google Maps for Tracking & Broadcasting
 * ============================================================================
 *
 * Features:
 * - Google Map with customer location and broadcast radius circles (5/10/20 km)
 * - Pharmacy markers for notified pharmacies (from API)
 * - Fallback to animated placeholder when no location or API key
 *
 * ============================================================================
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Building2, Search, CheckCircle2, Clock,
  Radio, Loader2
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';

declare global {
  interface Window {
    google: any;
    initPharmacyBroadcastMap: () => void;
  }
}

export interface BroadcastPharmacy {
  id: string;
  pharmacyId?: string;
  pharmacyName?: string;
  latitude?: number | null;
  longitude?: number | null;
  status?: string;
  distance_from_customer?: number;
  distanceFromCustomer?: number;
}

interface PharmacyBroadcastMapProps {
  currentRadius: number; // 5, 10, or 20
  pharmaciesNotified: number;
  pharmaciesAccepted: number;
  pharmaciesPending: number;
  pharmaciesRejected: number;
  acceptedPharmacy?: {
    name: string;
    distance: number;
    address: string;
  };
  isSearching: boolean;
  onRadiusExpand?: () => void;
  customerLocation?: { lat: number; lng: number };
  /** Notified pharmacies with lat/lng for Google Map markers */
  pharmacies?: BroadcastPharmacy[];
}

export function PharmacyBroadcastMap({
  currentRadius,
  pharmaciesNotified,
  pharmaciesAccepted,
  pharmaciesPending,
  pharmaciesRejected,
  acceptedPharmacy,
  isSearching,
  onRadiusExpand,
  customerLocation,
  pharmacies = [],
}: PharmacyBroadcastMapProps) {
  const [showExpandMessage, setShowExpandMessage] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const circlesRef = useRef<any[]>([]);
  const markersRef = useRef<any[]>([]);
  const lastRadius = useRef(currentRadius);

  const center = customerLocation ?? { lat: 19.076, lng: 72.8777 };

  // Detect radius expansion
  useEffect(() => {
    if (currentRadius > lastRadius.current) {
      setShowExpandMessage(true);
      setTimeout(() => setShowExpandMessage(false), 3000);
    }
    lastRadius.current = currentRadius;
  }, [currentRadius]);

  const getRadiusLabel = (radius: number) => {
    if (radius <= 5) return '5 km';
    if (radius <= 10) return '10 km';
    return '20 km';
  };

  const getSearchMessage = () => {
    if (acceptedPharmacy) return 'Pharmacy found!';
    if (currentRadius <= 5) return 'Searching nearby pharmacies...';
    if (currentRadius <= 10) return 'Expanding search to 10km...';
    return 'Searching extended area (20km)...';
  };

  // Load Google Maps and init map with customer pin, radius circles, pharmacy markers
  // Always attempt to load map (use default center if no customerLocation) so we never show infinite loader
  useEffect(() => {
    const initMap = () => {
      if (!mapRef.current || !window.google?.maps) return;
      circlesRef.current.forEach((c) => c?.setMap?.(null));
      markersRef.current.forEach((m) => m?.setMap?.(null));
      circlesRef.current = [];
      markersRef.current = [];

      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: center.lat, lng: center.lng },
        zoom: 12,
        disableDefaultUI: true,
        zoomControl: true,
        styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }],
      });
      mapInstanceRef.current = map;

      new window.google.maps.Marker({
        position: { lat: center.lat, lng: center.lng },
        map,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#f97316',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 3,
        },
        title: 'Your location',
      });

      [5, 10, 20].forEach((km) => {
        const circle = new window.google.maps.Circle({
          map,
          center: { lat: center.lat, lng: center.lng },
          radius: km * 1000,
          fillColor: km <= currentRadius ? '#f97316' : '#e5e7eb',
          fillOpacity: km <= currentRadius ? 0.15 : 0.05,
          strokeColor: km <= currentRadius ? '#ea580c' : '#9ca3af',
          strokeOpacity: km <= currentRadius ? 0.8 : 0.3,
          strokeWeight: 2,
        });
        circlesRef.current.push(circle);
      });

      pharmacies.forEach((p) => {
        const lat = p.latitude ?? 0;
        const lng = p.longitude ?? 0;
        if (lat === 0 && lng === 0) return;
        const isAccepted = p.status === 'accepted';
        const m = new window.google.maps.Marker({
          position: { lat, lng },
          map,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: isAccepted ? '#22c55e' : '#3b82f6',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
          },
          title: p.pharmacyName || 'Pharmacy',
        });
        markersRef.current.push(m);
      });

      const withCoords = pharmacies.filter((p) => p.latitude != null && p.longitude != null);
      if (withCoords.length > 0) {
        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend({ lat: center.lat, lng: center.lng });
        withCoords.forEach((p) => bounds.extend({ lat: p.latitude!, lng: p.longitude! }));
        map.fitBounds(bounds, { padding: 40 });
      }
      setMapReady(true);
    };

    if (window.google?.maps) {
      initMap();
      return () => {
        circlesRef.current.forEach((c) => c?.setMap?.(null));
        markersRef.current.forEach((m) => m?.setMap?.(null));
        circlesRef.current = [];
        markersRef.current = [];
      };
    }

    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      const t = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(t);
          initMap();
        }
      }, 100);
      return () => clearInterval(t);
    }

    let cancelled = false;
    window.initPharmacyBroadcastMap = () => {
      if (!cancelled) initMap();
    };
    apiClient.get('/config/google-maps-key').then((res: any) => {
      if (cancelled) return;
      const apiKey = res?.apiKey ?? res?.key;
      if (!apiKey) {
        setMapError('Google Maps key not configured');
        return;
      }
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry&callback=initPharmacyBroadcastMap`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }).catch(() => { if (!cancelled) setMapError('Could not load map'); });

    return () => {
      cancelled = true;
      circlesRef.current.forEach((c) => c?.setMap?.(null));
      markersRef.current.forEach((m) => m?.setMap?.(null));
      circlesRef.current = [];
      markersRef.current = [];
    };
  }, [customerLocation?.lat, customerLocation?.lng, currentRadius, pharmacies]);

  // Update radius circles when currentRadius changes
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    circlesRef.current.forEach((circle, i) => {
      const km = [5, 10, 20][i];
      if (!circle) return;
      circle.setOptions({
        fillColor: km <= currentRadius ? '#f97316' : '#e5e7eb',
        fillOpacity: km <= currentRadius ? 0.15 : 0.05,
        strokeColor: km <= currentRadius ? '#ea580c' : '#9ca3af',
        strokeOpacity: km <= currentRadius ? 0.8 : 0.3,
      });
    });
  }, [currentRadius, mapReady]);

  return (
    <div className="space-y-6">
      {/* Google Map or fallback placeholder */}
      <div className="relative w-full aspect-square max-w-sm mx-auto rounded-3xl overflow-hidden border border-gray-200">
        {mapError && (
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center text-gray-500 text-sm p-4">
            {mapError}
          </div>
        )}
        {!mapError && (
          <>
            <div ref={mapRef} className="absolute inset-0 w-full h-full" />
            {!mapReady && !mapError && (
              <div className="absolute inset-0 bg-gradient-to-b from-gray-100 to-gray-200 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              </div>
            )}
          </>
        )}

        <AnimatePresence>
          {showExpandMessage && (
            <motion.div
              className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium z-10"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 animate-pulse" />
                Expanding to {getRadiusLabel(currentRadius)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Status Message */}
      <motion.div
        className="text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {acceptedPharmacy ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <h3 className="font-bold text-green-800 text-lg">Pharmacy Found!</h3>
            </div>
            <p className="text-green-700 font-medium">{acceptedPharmacy.name}</p>
            <p className="text-green-600 text-sm">{acceptedPharmacy.distance.toFixed(1)} km away</p>
            <p className="text-green-500 text-xs mt-1">{acceptedPharmacy.address}</p>
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              {isSearching ? (
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              ) : (
                <Search className="w-5 h-5 text-blue-600" />
              )}
              <h3 className="font-semibold text-blue-800">{getSearchMessage()}</h3>
            </div>
            <p className="text-blue-600 text-sm">
              Broadcasting to pharmacies within <span className="font-bold">{currentRadius} km</span>
            </p>
          </div>
        )}
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center bg-blue-50 border-blue-100">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Radio className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-blue-700">{pharmaciesNotified}</p>
          <p className="text-xs text-blue-600">Notified</p>
        </Card>
        
        <Card className="p-3 text-center bg-yellow-50 border-yellow-100">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Clock className="w-4 h-4 text-yellow-600" />
          </div>
          <p className="text-2xl font-bold text-yellow-700">{pharmaciesPending}</p>
          <p className="text-xs text-yellow-600">Pending</p>
        </Card>
        
        <Card className="p-3 text-center bg-green-50 border-green-100">
          <div className="flex items-center justify-center gap-1 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-700">{pharmaciesAccepted}</p>
          <p className="text-xs text-green-600">Accepted</p>
        </Card>
      </div>

      {/* Timer/Progress for Radius Expansion */}
      {isSearching && !acceptedPharmacy && currentRadius < 20 && (
        <Card className="p-4 bg-orange-50 border-orange-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-800">
                Expanding search automatically
              </p>
              <p className="text-xs text-orange-600">
                If no pharmacy accepts, we'll expand to {currentRadius < 10 ? '10 km' : '20 km'} in ~2 minutes
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
