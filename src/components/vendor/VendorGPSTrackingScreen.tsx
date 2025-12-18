/**
 * Vendor GPS Tracking Screen
 * Used by vendors during at_home service delivery
 */

import { useState, useEffect } from 'react';
import { MapPin, Navigation, Clock, PlayCircle, StopCircle, AlertCircle } from 'lucide-react';
import { useGPSTracking } from './useGPSTracking';
import { Button } from '../ui/button';

interface VendorGPSTrackingScreenProps {
  bookingId: string;
  vendorId: string;
  customerName: string;
  petName: string;
  serviceType: string;
  destination?: { lat: number; lng: number; address: string };
  onTrackingComplete?: () => void;
}

export function VendorGPSTrackingScreen({
  bookingId,
  vendorId,
  customerName,
  petName,
  serviceType,
  destination,
  onTrackingComplete
}: VendorGPSTrackingScreenProps) {
  const [showMap, setShowMap] = useState(false);

  const {
    isTracking,
    currentLocation,
    session,
    error,
    permissionGranted,
    startTracking,
    stopTracking,
    requestPermission,
    distanceTraveled,
    elapsedTime
  } = useGPSTracking({
    bookingId,
    vendorId,
    updateInterval: 5000,
    highAccuracy: true,
    onLocationUpdate: (location) => {
      console.log('Location updated:', location);
    },
    onError: (err) => {
      console.error('GPS error:', err);
    }
  });

  /**
   * Handle start tracking
   */
  const handleStartTracking = async () => {
    await startTracking();
    setShowMap(true);
  };

  /**
   * Handle stop tracking
   */
  const handleStopTracking = async () => {
    await stopTracking();
    if (onTrackingComplete) {
      onTrackingComplete();
    }
  };

  /**
   * Format duration
   */
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  /**
   * Request permission on mount if not granted
   */
  useEffect(() => {
    if (!permissionGranted) {
      requestPermission();
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#FF8C42] gray-50 p-4">
      {/* Header */}
      <div className="bg-[#FF8C42] white rounded-lg shadow-sm p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">GPS Tracking</h2>
        <div className="space-y-1 text-sm text-gray-600">
          <p><span className="font-medium">Customer:</span> {customerName}</p>
          <p><span className="font-medium">Pet:</span> {petName}</p>
          <p><span className="font-medium">Service:</span> {serviceType}</p>
          {destination && (
            <p><span className="font-medium">Destination:</span> {destination.address}</p>
          )}
        </div>
      </div>

      {/* Permission Error */}
      {error && (
        <div className="bg-[#FF8C42] red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="size-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-red-800">Location Access Required</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              <Button onClick={requestPermission}
                className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-[#FF8C42] red-700"
              >
                Request Permission
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tracking Controls */}
      {permissionGranted && !error && (
        <div className="space-y-4">
          {/* Stats */}
          {isTracking && (
            <div className="grid grid-cols-3 gap-4">
              {/* Distance */}
              <div className="bg-[#FF8C42] white rounded-lg shadow-sm p-4 text-center">
                <Navigation className="size-6 mx-auto mb-2 text-blue-600" />
                <p className="text-xs text-gray-600">Distance</p>
                <p className="text-lg font-semibold">{distanceTraveled.toFixed(2)} km</p>
              </div>

              {/* Duration */}
              <div className="bg-[#FF8C42] white rounded-lg shadow-sm p-4 text-center">
                <Clock className="size-6 mx-auto mb-2 text-green-600" />
                <p className="text-xs text-gray-600">Duration</p>
                <p className="text-lg font-semibold">{formatDuration(elapsedTime)}</p>
              </div>

              {/* Location */}
              <div className="bg-[#FF8C42] white rounded-lg shadow-sm p-4 text-center">
                <MapPin className="size-6 mx-auto mb-2 text-purple-600" />
                <p className="text-xs text-gray-600">Status</p>
                <p className="text-lg font-semibold">🟢 Live</p>
              </div>
            </div>
          )}

          {/* Current Location */}
          {currentLocation && (
            <div className="bg-[#FF8C42] white rounded-lg shadow-sm p-4">
              <h3 className="font-medium mb-2">Current Location</h3>
              <p className="text-sm text-gray-600 font-mono">
                {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
              </p>
              {currentLocation.accuracy && (
                <p className="text-xs text-gray-500 mt-1">
                  Accuracy: ±{currentLocation.accuracy.toFixed(0)}m
                </p>
              )}
              {currentLocation.speed && currentLocation.speed > 0 && (
                <p className="text-xs text-gray-500">
                  Speed: {(currentLocation.speed * 3.6).toFixed(1)} km/h
                </p>
              )}
            </div>
          )}

          {/* Control Buttons */}
          <div className="space-y-3">
            {!isTracking ? (
              <Button onClick={handleStartTracking}
                disabled={!permissionGranted}
                className="w-full flex items-center justify-center space-x-2 bg-green-600 text-white rounded-lg py-4 hover:bg-green-700 disabled:bg-[#FF8C42] gray-300 disabled:cursor-not-allowed"
              >
                <PlayCircle className="size-6" />
                <span className="font-medium">Start Tracking</span>
              </Button>
            ) : (
              <Button onClick={handleStopTracking}
                className="w-full flex items-center justify-center space-x-2 bg-red-600 text-white rounded-lg py-4 hover:bg-[#FF8C42] red-700"
              >
                <StopCircle className="size-6" />
                <span className="font-medium">Stop Tracking</span>
              </Button>
            )}
          </div>

          {/* Live Indicator */}
          {isTracking && (
            <div className="bg-[#FF8C42] green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-center space-x-2">
                <div className="size-3 rounded-full bg-[#FF8C42] green-500 animate-pulse" />
                <span className="text-sm text-green-800 font-medium">
                  Live tracking active • Customer can see your location
                </span>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-[#FF8C42] blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">📍 Tracking Instructions</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Keep this screen open during service</li>
              <li>• Your location updates every 5 seconds</li>
              <li>• Customer can track you in real-time</li>
              <li>• Ensure GPS is enabled on your device</li>
              <li>• Keep your phone charged</li>
            </ul>
          </div>

          {/* Session Info */}
          {session && (
            <div className="bg-[#FF8C42] gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium mb-2">Session Details</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p><span className="font-medium">Session ID:</span> {session.id}</p>
                <p><span className="font-medium">Status:</span> {session.status}</p>
                {session.startTime && (
                  <p><span className="font-medium">Started:</span> {new Date(session.startTime).toLocaleTimeString()}</p>
                )}
                {session.route.length > 0 && (
                  <p><span className="font-medium">Route Points:</span> {session.route.length}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Permission Not Granted */}
      {!permissionGranted && !error && (
        <div className="bg-[#FF8C42] yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <MapPin className="size-12 mx-auto mb-4 text-yellow-600" />
          <h3 className="font-medium text-yellow-900 mb-2">Location Permission Required</h3>
          <p className="text-sm text-yellow-800 mb-4">
            This service requires GPS tracking to ensure customer safety and service quality.
          </p>
          <Button onClick={requestPermission}
            className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-[#FF8C42] yellow-700"
          >
            Enable Location Access
          </Button>
        </div>
      )}
    </div>
  );
}
