import React, { useState, useEffect } from 'react';
import { GoogleMap, LoadScript, Marker, Polyline, InfoWindow } from '@react-google-maps/api';
import { Ambulance, MapPin, Navigation } from 'lucide-react';
// Brand color: #FF8C42

interface GoogleMapsTrackingProps {
  currentLocation: { lat: number; lng: number } | null;
  pickupLocation: { lat: number; lng: number; address: string };
  dropLocation: { lat: number; lng: number; address: string };
  route: Array<{ lat: number; lng: number }>;
  status: string;
  driverName?: string;
  vehicleNumber?: string;
  eta?: number;
}

const mapContainerStyle = {
  width: '100%',
  height: '400px'
};

const defaultCenter = {
  lat: 28.6139,
  lng: 77.2090
};

export function GoogleMapsTracking({
  currentLocation,
  pickupLocation,
  dropLocation,
  route,
  status,
  driverName,
  vehicleNumber,
  eta
}: GoogleMapsTrackingProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [showAmbulanceInfo, setShowAmbulanceInfo] = useState(false);
  const [showPickupInfo, setShowPickupInfo] = useState(false);
  const [showDropInfo, setShowDropInfo] = useState(false);

  // Get API key from environment
  const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 
    (typeof window !== 'undefined' ? (window as any).GOOGLE_MAPS_API_KEY : '');

  // Auto-fit bounds when locations change
  useEffect(() => {
    if (map && currentLocation) {
      const bounds = new google.maps.LatLngBounds();
      
      if (currentLocation) bounds.extend(currentLocation);
      bounds.extend(pickupLocation);
      bounds.extend(dropLocation);
      
      map.fitBounds(bounds);
    }
  }, [map, currentLocation, pickupLocation, dropLocation]);

  const onLoad = React.useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = React.useCallback(() => {
    setMap(null);
  }, []);

  // Polyline options for route
  const polylineOptions = {
    strokeColor: '#FF6B35',
    strokeOpacity: 0.8,
    strokeWeight: 4,
    geodesic: true
  };

  // Completed route options (different color)
  const completedRouteOptions = {
    strokeColor: '#4CAF50',
    strokeOpacity: 0.6,
    strokeWeight: 3,
    geodesic: true
  };

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <p className="text-yellow-800 font-medium mb-2">
          ⚠️ Google Maps API Key Required
        </p>
        <p className="text-sm text-yellow-700">
          Set VITE_GOOGLE_MAPS_API_KEY in your environment variables to enable map tracking.
        </p>
        <p className="text-xs text-yellow-600 mt-2">
          Get your API key from: <a href="https://console.cloud.google.com/" target="_blank" className="underline">Google Cloud Console</a>
        </p>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg overflow-hidden border-2 border-gray-200">
      <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={currentLocation || pickupLocation || defaultCenter}
          zoom={13}
          onLoad={onLoad}
          onUnmount={onUnmount}
          options={{
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true
          }}
        >
          {/* Ambulance Current Location */}
          {currentLocation && (
            <>
              <Marker
                position={currentLocation}
                icon={{
                  url: 'data:image/svg+xml;base64,' + btoa(`
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
                      <circle cx="24" cy="24" r="20" fill="#FF6B35" stroke="white" stroke-width="3"/>
                      <path d="M24 12 L24 18 M18 24 L30 24 M24 30 L24 36 M18 18 L30 30 M30 18 L18 30" stroke="white" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                  `),
                  scaledSize: new google.maps.Size(48, 48),
                  anchor: new google.maps.Point(24, 24)
                }}
                onClick={() => setShowAmbulanceInfo(true)}
              />
              
              {showAmbulanceInfo && (
                <InfoWindow
                  position={currentLocation}
                  onCloseClick={() => setShowAmbulanceInfo(false)}
                >
                  <div className="p-2">
                    <h3 className="font-bold text-gray-900 mb-1">
                      🚑 Ambulance
                    </h3>
                    {vehicleNumber && (
                      <p className="text-sm text-gray-600">{vehicleNumber}</p>
                    )}
                    {driverName && (
                      <p className="text-sm text-gray-600">{driverName}</p>
                    )}
                    {eta && (
                      <p className="text-sm font-medium text-orange-600 mt-1">
                        ETA: {eta} min
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1 capitalize">
                      Status: {status.replace('_', ' ')}
                    </p>
                  </div>
                </InfoWindow>
              )}

              {/* Pulsing circle animation around ambulance */}
              <Marker
                position={currentLocation}
                icon={{
                  url: 'data:image/svg+xml;base64,' + btoa(`
                    <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
                      <circle cx="30" cy="30" r="25" fill="rgba(255,107,53,0.2)" stroke="rgba(255,107,53,0.4)" stroke-width="2">
                        <animate attributeName="r" from="25" to="35" dur="1.5s" repeatCount="indefinite"/>
                        <animate attributeName="opacity" from="0.4" to="0" dur="1.5s" repeatCount="indefinite"/>
                      </circle>
                    </svg>
                  `),
                  scaledSize: new google.maps.Size(60, 60),
                  anchor: new google.maps.Point(30, 30)
                }}
              />
            </>
          )}

          {/* Pickup Location */}
          <Marker
            position={pickupLocation}
            icon={{
              url: 'data:image/svg+xml;base64,' + btoa(`
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
                  <circle cx="20" cy="20" r="16" fill="#4CAF50" stroke="white" stroke-width="3"/>
                  <text x="20" y="26" text-anchor="middle" font-size="20" fill="white" font-weight="bold">A</text>
                </svg>
              `),
              scaledSize: new google.maps.Size(40, 40),
              anchor: new google.maps.Point(20, 20)
            }}
            onClick={() => setShowPickupInfo(true)}
          />

          {showPickupInfo && (
            <InfoWindow
              position={pickupLocation}
              onCloseClick={() => setShowPickupInfo(false)}
            >
              <div className="p-2">
                <h3 className="font-bold text-green-600 mb-1">
                  📍 Pickup Location
                </h3>
                <p className="text-sm text-gray-700">{pickupLocation.address}</p>
              </div>
            </InfoWindow>
          )}

          {/* Drop Location */}
          <Marker
            position={dropLocation}
            icon={{
              url: 'data:image/svg+xml;base64,' + btoa(`
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
                  <circle cx="20" cy="20" r="16" fill="#2196F3" stroke="white" stroke-width="3"/>
                  <text x="20" y="26" text-anchor="middle" font-size="20" fill="white" font-weight="bold">B</text>
                </svg>
              `),
              scaledSize: new google.maps.Size(40, 40),
              anchor: new google.maps.Point(20, 20)
            }}
            onClick={() => setShowDropInfo(true)}
          />

          {showDropInfo && (
            <InfoWindow
              position={dropLocation}
              onCloseClick={() => setShowDropInfo(false)}
            >
              <div className="p-2">
                <h3 className="font-bold text-blue-600 mb-1">
                  🏥 Drop Location
                </h3>
                <p className="text-sm text-gray-700">{dropLocation.address}</p>
              </div>
            </InfoWindow>
          )}

          {/* Route Polyline */}
          {route.length > 0 && (
            <Polyline
              path={route}
              options={status === 'completed' ? completedRouteOptions : polylineOptions}
            />
          )}

          {/* Direct line from current location to pickup (if not yet picked up) */}
          {currentLocation && (status === 'assigned' || status === 'en_route') && (
            <Polyline
              path={[currentLocation, pickupLocation]}
              options={{
                strokeColor: '#FFA726',
                strokeOpacity: 0.5,
                strokeWeight: 2,
                geodesic: true,
                icons: [{
                  icon: {
                    path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                    scale: 3,
                    strokeColor: '#FFA726'
                  },
                  offset: '100%',
                  repeat: '100px'
                }]
              }}
            />
          )}

          {/* Direct line from current location to drop (if transporting) */}
          {currentLocation && status === 'transporting' && (
            <Polyline
              path={[currentLocation, dropLocation]}
              options={{
                strokeColor: '#FFA726',
                strokeOpacity: 0.5,
                strokeWeight: 2,
                geodesic: true,
                icons: [{
                  icon: {
                    path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                    scale: 3,
                    strokeColor: '#FFA726'
                  },
                  offset: '100%',
                  repeat: '100px'
                }]
              }}
            />
          )}
        </GoogleMap>
      </LoadScript>

      {/* Live Indicator */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 border border-gray-200">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-3 h-3 bg-green-500 rounded-full" />
            <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping" />
          </div>
          <span className="text-sm font-medium text-gray-900">Live Tracking</span>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-3 border border-gray-200">
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-500 rounded-full border-2 border-white" />
            <span className="text-gray-700">Ambulance</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
            <span className="text-gray-700">Pickup (A)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white" />
            <span className="text-gray-700">Drop (B)</span>
          </div>
          {route.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-orange-500" />
              <span className="text-gray-700">Route</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
