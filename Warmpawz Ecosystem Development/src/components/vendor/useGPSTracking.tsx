/**
 * Real-time GPS Tracking Hook for Vendor App
 * Used by: Pet Walker, Pet Groomer (at_home), Veterinarian (at_home), etc.
 */

import { useState, useEffect, useRef } from 'react';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

const API_BASE = getApiBaseUrl();

interface LocationPoint {
  lat: number;
  lng: number;
  timestamp?: string;
  accuracy?: number;
  speed?: number;
  heading?: number;
}

interface TrackingSession {
  id: string;
  status: 'pending' | 'in_progress' | 'completed';
  startTime?: string;
  endTime?: string;
  currentLocation?: LocationPoint;
  route: LocationPoint[];
  distance: number;
  duration: number;
}

interface UseGPSTrackingOptions {
  bookingId: string;
  vendorId: string;
  autoStart?: boolean;
  updateInterval?: number; // milliseconds, default 5000 (5 seconds)
  highAccuracy?: boolean; // default true
  onLocationUpdate?: (location: LocationPoint) => void;
  onError?: (error: GeolocationPositionError) => void;
}

interface UseGPSTrackingReturn {
  // State
  isTracking: boolean;
  currentLocation: LocationPoint | null;
  session: TrackingSession | null;
  error: string | null;
  permissionGranted: boolean;
  
  // Actions
  startTracking: () => Promise<void>;
  stopTracking: () => Promise<void>;
  requestPermission: () => Promise<boolean>;
  
  // Stats
  distanceTraveled: number;
  elapsedTime: number;
}

export function useGPSTracking(options: UseGPSTrackingOptions): UseGPSTrackingReturn {
  const {
    bookingId,
    vendorId,
    autoStart = false,
    updateInterval = 5000,
    highAccuracy = true,
    onLocationUpdate,
    onError
  } = options;

  // State
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationPoint | null>(null);
  const [session, setSession] = useState<TrackingSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  // Refs
  const watchIdRef = useRef<number | null>(null);
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(0);

  /**
   * Request Geolocation Permission
   */
  const requestPermission = async (): Promise<boolean> => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return false;
    }

    try {
      // Try to get current position to trigger permission prompt
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: highAccuracy,
          timeout: 10000,
          maximumAge: 0
        });
      });

      setPermissionGranted(true);
      setError(null);
      return true;
    } catch (err: any) {
      setPermissionGranted(false);
      const errorMessage = getGeolocationErrorMessage(err);
      setError(errorMessage);
      if (onError) onError(err);
      return false;
    }
  };

  /**
   * Start GPS Tracking
   */
  const startTracking = async () => {
    if (isTracking) {
      console.log('Tracking already started');
      return;
    }

    // Request permission first
    const hasPermission = await requestPermission();
    if (!hasPermission) {
      return;
    }

    try {
      // Get initial location
      const initialPosition = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: highAccuracy,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const initialLocation: LocationPoint = {
        lat: initialPosition.coords.latitude,
        lng: initialPosition.coords.longitude,
        timestamp: new Date().toISOString(),
        accuracy: initialPosition.coords.accuracy,
        speed: initialPosition.coords.speed || undefined,
        heading: initialPosition.coords.heading || undefined
      };

      setCurrentLocation(initialLocation);

      // Start tracking session on server
      const response = await fetch(`${API_BASE}/gps/tracking/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          sessionId: bookingId,
          walkerId: vendorId,
          initialLocation: {
            lat: initialLocation.lat,
            lng: initialLocation.lng
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start tracking session');
      }

      const data = await response.json();
      setSession(data.session);
      setIsTracking(true);
      setError(null);

      // Start watching position
      startWatchingPosition();

      console.log('✅ GPS tracking started:', bookingId);
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to start tracking:', err);
    }
  };

  /**
   * Stop GPS Tracking
   */
  const stopTracking = async () => {
    if (!isTracking) {
      return;
    }

    try {
      // Stop watching position
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }

      // Clear update timer
      if (updateTimerRef.current) {
        clearInterval(updateTimerRef.current);
        updateTimerRef.current = null;
      }

      // Stop tracking session on server
      const response = await fetch(`${API_BASE}/gps/tracking/${bookingId}/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
      });

      if (!response.ok) {
        throw new Error('Failed to stop tracking session');
      }

      const data = await response.json();
      setSession(data.session);
      setIsTracking(false);

      console.log('✅ GPS tracking stopped:', bookingId);
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to stop tracking:', err);
    }
  };

  /**
   * Start watching position continuously
   */
  const startWatchingPosition = () => {
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const location: LocationPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          timestamp: new Date().toISOString(),
          accuracy: position.coords.accuracy,
          speed: position.coords.speed || undefined,
          heading: position.coords.heading || undefined
        };

        setCurrentLocation(location);

        // Throttle server updates
        const now = Date.now();
        if (now - lastUpdateRef.current >= updateInterval) {
          updateLocationOnServer(location);
          lastUpdateRef.current = now;
        }

        // Callback
        if (onLocationUpdate) {
          onLocationUpdate(location);
        }
      },
      (err) => {
        const errorMessage = getGeolocationErrorMessage(err);
        setError(errorMessage);
        console.error('Geolocation error:', err);
        if (onError) onError(err);
      },
      {
        enableHighAccuracy: highAccuracy,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  /**
   * Update location on server
   */
  const updateLocationOnServer = async (location: LocationPoint) => {
    try {
      await fetch(`${API_BASE}/gps/tracking/${bookingId}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          lat: location.lat,
          lng: location.lng,
          speed: location.speed,
          heading: location.heading
        })
      });
    } catch (err) {
      console.error('Failed to update location on server:', err);
    }
  };

  /**
   * Auto-start if enabled
   */
  useEffect(() => {
    if (autoStart) {
      startTracking();
    }

    // Cleanup on unmount
    return () => {
      if (isTracking) {
        stopTracking();
      }
    };
  }, []);

  // Calculate stats
  const distanceTraveled = session?.distance || 0;
  const elapsedTime = session?.duration || 0;

  return {
    // State
    isTracking,
    currentLocation,
    session,
    error,
    permissionGranted,
    
    // Actions
    startTracking,
    stopTracking,
    requestPermission,
    
    // Stats
    distanceTraveled,
    elapsedTime
  };
}

/**
 * Get user-friendly error message
 */
function getGeolocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location permission denied. Please enable location access in your browser settings.';
    case error.POSITION_UNAVAILABLE:
      return 'Location information is unavailable. Please check your device settings.';
    case error.TIMEOUT:
      return 'Location request timed out. Please try again.';
    default:
      return 'An unknown error occurred while accessing location.';
  }
}
