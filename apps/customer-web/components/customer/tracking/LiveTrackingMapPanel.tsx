"use client";

import { useEffect, useRef, useState } from 'react';
import { Clock, Loader2, MapPin } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

declare global {
  interface Window {
    google: any;
    initMealTrackingMap?: () => void;
  }
}

export interface LiveTrackingMapPanelProps {
  deliveryAddress: { lat: number; lng: number; address?: string };
  currentLocation: { lat: number; lng: number } | null;
  etaMinutes?: number | null;
  distanceRemainingKm?: number | null;
  /** meal = teal accent (default), pharmacy = orange */
  variant?: 'meal' | 'pharmacy';
  className?: string;
}

let mapsScriptLoading = false;

async function ensureGoogleMapsLoaded(onReady: () => void) {
  if (typeof window === 'undefined') return;
  if (window.google?.maps) {
    onReady();
    return;
  }

  if (document.querySelector('script[src*="maps.googleapis.com"]')) {
    const timer = setInterval(() => {
      if (window.google?.maps) {
        clearInterval(timer);
        onReady();
      }
    }, 100);
    return;
  }

  if (mapsScriptLoading) {
    window.initMealTrackingMap = onReady;
    return;
  }

  mapsScriptLoading = true;
  try {
    const response = (await apiClient.get('/config/google-maps-key')) as {
      apiKey?: string;
      key?: string;
    };
    const apiKey = response?.apiKey || response?.key;
    if (!apiKey) {
      console.warn('Google Maps API key not available');
      return;
    }

    window.initMealTrackingMap = onReady;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMealTrackingMap`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  } catch (error) {
    console.warn('Failed to load Google Maps:', error);
  }
}

function formatEta(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '--';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`;
}

export function LiveTrackingMapPanel({
  deliveryAddress,
  currentLocation,
  etaMinutes,
  distanceRemainingKm,
  variant = 'meal',
  className = '',
}: LiveTrackingMapPanelProps) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const riderMarkerRef = useRef<any>(null);
  const destinationMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);

  const accent = variant === 'meal' ? 'teal' : 'orange';
  const riderColor = variant === 'meal' ? '#0d9488' : '#f97316';
  const destColor = variant === 'meal' ? '#16a34a' : '#22c55e';

  useEffect(() => {
    ensureGoogleMapsLoaded(() => {
      if (!mapRef.current || googleMapRef.current) return;

      const map = new window.google.maps.Map(mapRef.current, {
        zoom: 15,
        center: { lat: deliveryAddress.lat, lng: deliveryAddress.lng },
        disableDefaultUI: true,
        zoomControl: true,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }],
          },
        ],
      });

      googleMapRef.current = map;
      destinationMarkerRef.current = new window.google.maps.Marker({
        position: { lat: deliveryAddress.lat, lng: deliveryAddress.lng },
        map,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: destColor,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
        title: 'Delivery location',
      });

      setMapLoaded(true);
    });
  }, [deliveryAddress.lat, deliveryAddress.lng, destColor]);

  useEffect(() => {
    if (!mapLoaded || !currentLocation || !googleMapRef.current) return;

    const { lat, lng } = currentLocation;

    if (riderMarkerRef.current) {
      riderMarkerRef.current.setPosition({ lat, lng });
    } else {
      riderMarkerRef.current = new window.google.maps.Marker({
        position: { lat, lng },
        map: googleMapRef.current,
        icon: {
          path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: riderColor,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
        title: 'Delivery partner',
      });
    }

    const path = [
      { lat, lng },
      { lat: deliveryAddress.lat, lng: deliveryAddress.lng },
    ];

    if (polylineRef.current) {
      polylineRef.current.setPath(path);
    } else {
      polylineRef.current = new window.google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: riderColor,
        strokeOpacity: 0.85,
        strokeWeight: 4,
        map: googleMapRef.current,
      });
    }

    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend({ lat, lng });
    bounds.extend({ lat: deliveryAddress.lat, lng: deliveryAddress.lng });
    googleMapRef.current.fitBounds(bounds, { padding: 48 });
  }, [currentLocation, mapLoaded, deliveryAddress.lat, deliveryAddress.lng, riderColor]);

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-100/80 overflow-hidden ${className}`}>
      {(etaMinutes != null && Number.isFinite(Number(etaMinutes))) ||
      (distanceRemainingKm != null && Number.isFinite(Number(distanceRemainingKm))) ? (
        <div
          className={`flex items-center gap-3 px-4 py-3 border-b border-slate-100 ${
            accent === 'teal' ? 'bg-teal-50' : 'bg-orange-50'
          }`}
        >
          {etaMinutes != null && Number.isFinite(Number(etaMinutes)) ? (
            <>
              <Clock className={`w-5 h-5 shrink-0 ${accent === 'teal' ? 'text-teal-600' : 'text-orange-600'}`} />
              <p className={`text-sm font-medium ${accent === 'teal' ? 'text-teal-900' : 'text-orange-900'}`}>
                ETA: {formatEta(Number(etaMinutes))}
              </p>
            </>
          ) : null}
          {distanceRemainingKm != null && Number.isFinite(Number(distanceRemainingKm)) ? (
            <p className="ml-auto text-xs text-slate-600">
              {Number(distanceRemainingKm).toFixed(1)} km away
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="relative">
        <div ref={mapRef} className="h-56 bg-slate-100">
          {!mapLoaded ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className={`w-7 h-7 animate-spin ${accent === 'teal' ? 'text-teal-600' : 'text-orange-500'}`} />
            </div>
          ) : null}
        </div>

        {currentLocation ? (
          <div className="absolute top-3 left-3 bg-white rounded-full px-3 py-1.5 shadow-md flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-semibold text-slate-700">LIVE</span>
          </div>
        ) : null}
      </div>

      {deliveryAddress.address ? (
        <div className="px-4 py-3 flex items-start gap-2 text-sm text-slate-600 border-t border-slate-100">
          <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
          <span>{deliveryAddress.address}</span>
        </div>
      ) : null}
    </div>
  );
}
