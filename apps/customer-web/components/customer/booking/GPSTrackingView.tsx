'use client';

import { useState, useEffect } from 'react';
import { MapPin, Navigation, Clock, Route } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface GPSTrackingViewProps {
  bookingId: string;
  onClose?: () => void;
}

export function GPSTrackingView({ bookingId, onClose }: GPSTrackingViewProps) {
  const [tracking, setTracking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTrackingStatus();
    // Poll for updates every 5 seconds
    const interval = setInterval(loadTrackingStatus, 5000);
    return () => clearInterval(interval);
  }, [bookingId]);

  const loadTrackingStatus = async () => {
    try {
      const response = await apiClient.get<{
        isTracking: boolean;
        tracking?: any;
        message?: string;
      }>(`/gps-tracking/booking/${bookingId}`);

      if (response.isTracking && response.tracking) {
        // Map the new response format to the old format for compatibility
        setTracking({
          isTracking: true,
          currentLocation: response.tracking.current_location,
          route: [], // Route points can be added if needed
          distanceTraveled: response.tracking.distance_traveled_km || 0,
          duration: response.tracking.duration_seconds || 0,
          eta_minutes: response.tracking.eta_minutes,
          distance_km: response.tracking.distance_km,
        });
        setError(null);
      } else {
        setTracking(null);
        setError(response.message || 'GPS tracking is not active for this booking');
      }
    } catch (err: any) {
      console.error('Error loading GPS tracking:', err);
      setError(err.message || 'Failed to load GPS tracking');
      setTracking(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-0 shadow-sm">
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-0 text-gray-600">Loading tracking...</span>
        </div>
      </div>
    );
  }

  if (error || !tracking) {
    return (
      <div className="bg-white rounded-2xl p-0 shadow-sm">
        <div className="text-center py-8">
          <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">{error || 'GPS tracking not available'}</p>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-0 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-0 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-0">
          <Navigation className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-gray-900">Live Tracking</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ×
          </button>
        )}
      </div>

      {tracking.currentLocation && (
        <div className="space-y-4">
          {/* Current Location */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-0 mb-0">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="font-semibold text-gray-900">Current Location</span>
            </div>
            <p className="text-sm text-gray-600">
              {tracking.currentLocation.latitude?.toFixed(6)}, {tracking.currentLocation.longitude?.toFixed(6)}
            </p>
            <p className="text-xs text-gray-500 mt-0">
              Updated: {new Date(tracking.currentLocation.timestamp).toLocaleTimeString()}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            {tracking.distanceTraveled !== undefined && (
              <div className="bg-gray-50 rounded-lg p-0">
                <div className="flex items-center gap-0 mb-0">
                  <Route className="w-4 h-4 text-primary" />
                  <span className="text-xs text-gray-600">Distance</span>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {tracking.distanceTraveled.toFixed(2)} km
                </p>
              </div>
            )}

            {tracking.duration !== undefined && (
              <div className="bg-gray-50 rounded-lg p-0">
                <div className="flex items-center gap-0 mb-0">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-xs text-gray-600">Duration</span>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {Math.floor(tracking.duration / 60)}m {tracking.duration % 60}s
                </p>
              </div>
            )}
          </div>

          {/* Route Info */}
          {tracking.route && tracking.route.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-semibold text-gray-900 mb-0">
                Route Points: {tracking.route.length}
              </p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {tracking.route.slice(-5).map((point: any, idx: number) => (
                  <div key={idx} className="text-xs text-gray-600">
                    Point {idx + 1}: {point.latitude?.toFixed(4)}, {point.longitude?.toFixed(4)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Map Integration Placeholder */}
          <div className="bg-gray-100 rounded-lg p-8 text-center">
            <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-0" />
            <p className="text-sm text-gray-600">
              Map view will be integrated with Google Maps
            </p>
            {tracking.currentLocation && (
              <a
                href={`https://www.google.com/maps?q=${tracking.currentLocation.latitude},${tracking.currentLocation.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0 inline-block text-primary hover:underline text-sm"
              >
                Open in Google Maps →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

