'use client';

import { useState, useEffect } from 'react';
import { MapPin, AlertCircle, Loader } from 'lucide-react';

interface LocationPermissionProps {
  onLocationGranted: (location: { latitude: number; longitude: number; address?: string }) => void;
  onSkip?: () => void;
  title?: string;
  message?: string;
}

export function LocationPermission({ 
  onLocationGranted, 
  onSkip,
  title = "Enable Location Services",
  message = "We need your location to find nearby service providers"
}: LocationPermissionProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied'>('prompt');

  useEffect(() => {
    // Check current permission state
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((result) => {
        setPermissionState(result.state as 'prompt' | 'granted' | 'denied');
        
        // Auto-request if already granted
        if (result.state === 'granted') {
          requestLocation();
        }
      }).catch(() => {
        // Some browsers don't support permission query for geolocation
        console.log('Permission query not supported');
      });
    }
  }, []);

  const requestLocation = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('📍 Requesting location permission...');
      
      if (!('geolocation' in navigator)) {
        throw new Error('Geolocation is not supported by your browser');
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          console.log('✅ Location obtained:', { latitude, longitude });
          
          // Optionally reverse geocode to get address
          try {
            const address = await reverseGeocode(latitude, longitude);
            onLocationGranted({ latitude, longitude, address });
          } catch (geocodeError) {
            // Even if geocoding fails, still provide the coordinates
            onLocationGranted({ latitude, longitude });
          }
        },
        (error) => {
          console.error('❌ Location error:', error);
          setPermissionState('denied');
          
          let errorMessage = 'Unable to access your location';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location permission denied. Please enable location access in your browser settings.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out';
              break;
          }
          
          setError(errorMessage);
          setLoading(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } catch (err) {
      console.error('❌ Error requesting location:', err);
      setError(err instanceof Error ? err.message : 'Failed to get location');
      setLoading(false);
    }
  };

  const reverseGeocode = async (latitude: number, longitude: number): Promise<string> => {
    // Using OpenStreetMap Nominatim for reverse geocoding
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
      );
      
      if (!response.ok) throw new Error('Geocoding failed');
      
      const data = await response.json();
      return data.display_name || 'Unknown location';
    } catch (error) {
      console.warn('Geocoding failed:', error);
      return 'Location coordinates obtained';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-white max-w-[430px] mx-auto flex items-center justify-center p-0">
      <div className="w-full bg-white rounded-3xl shadow-lg p-8 text-center">
        <div className="mb-0">
          <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary-dark rounded-full mx-auto flex items-center justify-center mb-4">
            {loading ? (
              <Loader className="w-10 h-10 text-white animate-spin" />
            ) : (
              <MapPin className="w-10 h-10 text-white" />
            )}
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-0">{title}</h1>
          <p className="text-gray-600">{message}</p>
        </div>

        {error && (
          <div className="mb-0 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-0">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-left">
              <p className="text-sm text-red-800 font-medium mb-0">Location Access Error</p>
              <p className="text-xs text-red-700">{error}</p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={requestLocation}
            disabled={loading}
            className="w-full bg-gradient-to-r from-primary to-primary-dark hover:shadow-lg text-white font-medium py-0 px-0 rounded-xl disabled:opacity-50 transition-all flex items-center justify-center gap-0"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Getting Location...
              </>
            ) : permissionState === 'denied' ? (
              'Try Again'
            ) : (
              'Enable Location'
            )}
          </button>

          {onSkip && (
            <button
              onClick={onSkip}
              className="w-full border-2 border-gray-200 text-gray-700 hover:bg-gray-50 font-medium py-0 px-0 rounded-xl disabled:opacity-50 transition-all"
              disabled={loading}
            >
              Skip for Now
            </button>
          )}
        </div>

        {permissionState === 'denied' && (
          <div className="mt-0 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800 mb-0 font-medium">How to enable location:</p>
            <ol className="text-xs text-blue-700 text-left space-y-1 ml-4">
              <li>1. Click the lock/info icon in your browser&apos;s address bar</li>
              <li>2. Find &quot;Location&quot; or &quot;Permissions&quot;</li>
              <li>3. Allow location access for this site</li>
              <li>4. Refresh this page</li>
            </ol>
          </div>
        )}

        <div className="mt-0 text-xs text-gray-500">
          🔒 Your location is only used to find nearby services and is never shared without your permission
        </div>
      </div>
    </div>
  );
}

