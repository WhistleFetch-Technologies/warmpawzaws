"use client";

import { useEffect, useRef, useState } from 'react';
import { Clock, Loader2, MapPin } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { isRiderNearDestination } from '@/lib/meal-tracking-utils';

declare global {
  interface Window {
    google: any;
    initMealTrackingMap?: () => void;
  }
}

export interface LiveTrackingMapPanelProps {
  deliveryAddress: { lat: number; lng: number; address?: string } | null;
  currentLocation: { lat: number; lng: number } | null;
  etaMinutes?: number | null;
  distanceRemainingKm?: number | null;
  /** ISO timestamp of last rider GPS write; used for stale-location hint. */
  lastLocationUpdate?: string | null;
  /** meal = teal accent (default), pharmacy = orange */
  variant?: 'meal' | 'pharmacy';
  className?: string;
}

function hasValidCoords(point: { lat: number; lng: number } | null | undefined): boolean {
  if (!point) return false;
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return false;
  return !(point.lat === 0 && point.lng === 0);
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

function clampMapZoom(map: any, minZoom: number, maxZoom: number) {
  const z = map.getZoom();
  if (typeof z !== 'number') return;
  if (z < minZoom) map.setZoom(minZoom);
  if (z > maxZoom) map.setZoom(maxZoom);
}

/** Meal live map: scooter emoji marker instead of the default arrow glyph. */
function createMealRiderMarkerIcon(google: typeof window.google) {
  const size = 44;
  const anchor = size / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${anchor}" cy="${anchor}" r="18" fill="white" fill-opacity="0.95" stroke="#0d9488" stroke-width="2"/>
    <text x="${anchor}" y="${anchor + 1}" text-anchor="middle" dominant-baseline="middle" font-size="22">🛵</text>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(anchor, anchor),
  };
}

function createRiderMarkerIcon(google: typeof window.google, variant: 'meal' | 'pharmacy', riderColor: string) {
  if (variant === 'meal') {
    return createMealRiderMarkerIcon(google);
  }
  return {
    path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
    scale: 6,
    fillColor: riderColor,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    rotation: 0,
  };
}

export function LiveTrackingMapPanel({
  deliveryAddress,
  currentLocation,
  etaMinutes,
  distanceRemainingKm,
  lastLocationUpdate,
  variant = 'meal',
  className = '',
}: LiveTrackingMapPanelProps) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const riderMarkerRef = useRef<any>(null);
  const destinationMarkerRef = useRef<any>(null);
  const directionsRendererRef = useRef<any>(null);
  const directionsServiceRef = useRef<any>(null);

  const accent = variant === 'meal' ? 'teal' : 'orange';
  const riderColor = variant === 'meal' ? '#0d9488' : '#f97316';
  const destColor = variant === 'meal' ? '#16a34a' : '#22c55e';
  const hasDestination = hasValidCoords(deliveryAddress);
  const hasRider = hasValidCoords(currentLocation);
  const showLiveRoute =
    hasRider &&
    hasDestination &&
    deliveryAddress &&
    currentLocation &&
    isRiderNearDestination(currentLocation, deliveryAddress);

  const locationStaleMs = 90_000;
  const locationIsStale =
    showLiveRoute &&
    lastLocationUpdate != null &&
    Number.isFinite(Date.parse(lastLocationUpdate)) &&
    Date.now() - Date.parse(lastLocationUpdate) > locationStaleMs;

  const waitingMessage = !hasDestination
    ? 'Waiting for delivery location…'
    : !hasRider
      ? 'Waiting for rider location…'
      : !showLiveRoute
        ? 'Pinning your address — partner location updating…'
        : null;

  useEffect(() => {
    if (!hasDestination || !deliveryAddress) return;
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
        zIndex: 2,
      });

      directionsServiceRef.current = new window.google.maps.DirectionsService();
      directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
        map,
        suppressMarkers: true,
        preserveViewport: false,
        polylineOptions: {
          strokeColor: riderColor,
          strokeOpacity: 0.9,
          strokeWeight: 5,
        },
      });

      setMapLoaded(true);
    });
  }, [deliveryAddress?.lat, deliveryAddress?.lng, destColor, hasDestination, riderColor]);

  useEffect(() => {
    if (!mapLoaded || !googleMapRef.current || !hasDestination || !deliveryAddress) return;

    const map = googleMapRef.current;
    const dest = { lat: deliveryAddress.lat, lng: deliveryAddress.lng };

    if (!showLiveRoute || !currentLocation) {
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
        directionsRendererRef.current.setMap(map);
      }
      if (riderMarkerRef.current) {
        riderMarkerRef.current.setMap(null);
        riderMarkerRef.current = null;
      }
      map.setCenter(dest);
      map.setZoom(15);
      return;
    }

    const { lat, lng } = currentLocation;

    if (riderMarkerRef.current) {
      riderMarkerRef.current.setPosition({ lat, lng });
    } else {
      riderMarkerRef.current = new window.google.maps.Marker({
        position: { lat, lng },
        map,
        icon: createRiderMarkerIcon(window.google, variant, riderColor),
        title: 'Delivery partner',
        zIndex: 3,
      });
    }

    const directionsService = directionsServiceRef.current;
    const directionsRenderer = directionsRendererRef.current;
    if (directionsService && directionsRenderer) {
      directionsService.route(
        {
          origin: { lat, lng },
          destination: dest,
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result: unknown, status: string) => {
          if (status === 'OK' && result) {
            directionsRenderer.setDirections(result);
            window.google.maps.event.addListenerOnce(map, 'idle', () => {
              clampMapZoom(map, 12, 17);
            });
            return;
          }
          const bounds = new window.google.maps.LatLngBounds();
          bounds.extend({ lat, lng });
          bounds.extend(dest);
          map.fitBounds(bounds, { padding: 56 });
          window.google.maps.event.addListenerOnce(map, 'idle', () => {
            clampMapZoom(map, 12, 17);
          });
        },
      );
    }
  }, [currentLocation, mapLoaded, deliveryAddress, hasDestination, hasRider, riderColor, showLiveRoute, variant]);

  const accentBg = accent === 'teal' ? 'bg-teal-50' : 'bg-orange-50';
  const accentText = accent === 'teal' ? 'text-teal-900' : 'text-orange-900';
  const accentIcon = accent === 'teal' ? 'text-teal-600' : 'text-orange-600';
  const accentSpinner = accent === 'teal' ? 'text-teal-600' : 'text-orange-500';

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-100/80 overflow-hidden ${className}`}>
      {(etaMinutes != null && Number.isFinite(Number(etaMinutes))) ||
      (distanceRemainingKm != null && Number.isFinite(Number(distanceRemainingKm))) ? (
        <div className={`flex items-center gap-3 px-4 py-3 border-b border-slate-100 ${accentBg}`}>
          {etaMinutes != null && Number.isFinite(Number(etaMinutes)) ? (
            <>
              <Clock className={`w-5 h-5 shrink-0 ${accentIcon}`} />
              <p className={`text-sm font-medium ${accentText}`}>
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
        {waitingMessage && !hasDestination ? (
          <div className={`h-64 flex flex-col items-center justify-center px-6 text-center ${accentBg}`}>
            <MapPin className={`w-10 h-10 mb-3 ${accentIcon}`} />
            <p className={`text-sm font-semibold ${accentText}`}>{waitingMessage}</p>
            <p className="text-xs text-slate-600 mt-2">
              Live route map will appear when rider GPS and delivery coordinates are available.
            </p>
          </div>
        ) : (
          <>
            <div className="relative h-64 bg-slate-100">
              <div ref={mapRef} className="h-full w-full" />
              {!mapLoaded ? (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                  <Loader2 className={`w-7 h-7 animate-spin ${accentSpinner}`} />
                </div>
              ) : null}
            </div>

            {showLiveRoute ? (
              <div className="absolute top-3 left-3 bg-white rounded-full px-3 py-1.5 shadow-md flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs font-semibold text-slate-700">
                  {locationIsStale ? 'UPDATING LOCATION' : 'LIVE ROUTE'}
                </span>
              </div>
            ) : waitingMessage ? (
              <div className="absolute inset-x-3 top-3 bg-white/95 backdrop-blur rounded-xl px-3 py-2.5 shadow-md border border-slate-100">
                <p className={`text-xs font-semibold ${accentText}`}>{waitingMessage}</p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Your delivery address is pinned. The driving route appears when partner GPS is nearby.
                </p>
              </div>
            ) : null}
            {locationIsStale ? (
              <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur rounded-xl px-3 py-2 shadow-md border border-slate-100">
                <p className="text-[11px] text-slate-600">Updating rider location…</p>
              </div>
            ) : null}
          </>
        )}
      </div>

      {deliveryAddress?.address ? (
        <div className="px-4 py-3 flex items-start gap-2 text-sm text-slate-600 border-t border-slate-100">
          <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
          <span>{deliveryAddress.address}</span>
        </div>
      ) : null}
    </div>
  );
}
