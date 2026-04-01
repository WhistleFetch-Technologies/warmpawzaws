'use client';

import { useState, useEffect } from 'react';
import { MapPin, Navigation, Clock, Route } from 'lucide-react';
import { apiClient, getApiBaseUrl } from '@/lib/api-client';

interface GPSTrackingViewProps {
  bookingId: string;
  onClose?: () => void;
}

export function GPSTrackingView({ bookingId, onClose }: GPSTrackingViewProps) {
  const [tracking, setTracking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState(false);

  // ✅ NEW: SSE (Server-Sent Events) for real-time GPS tracking with polling fallback
  useEffect(() => {
    if (!bookingId) return;

    setLoading(true);
    let eventSource: EventSource | null = null;
    let pollInterval: NodeJS.Timeout | null = null;
    let sseSupported = false;

    // Try to connect via SSE first
    try {
      const apiBaseUrl = getApiBaseUrl();
      const sseUrl = `${apiBaseUrl.replace(/\/+$/, '')}/tracking/booking/${bookingId}/stream`;
      
      // Get auth token for SSE connection
      const token = typeof window !== 'undefined' 
        ? (localStorage.getItem('authToken') || null)
        : null;

      const urlWithAuth = token ? `${sseUrl}?token=${encodeURIComponent(token)}` : sseUrl;
      eventSource = new EventSource(urlWithAuth);
      sseSupported = true;

      eventSource.onopen = () => {
        console.log('✅ [GPS SSE] Connected to real-time tracking stream');
        setSseConnected(true);
        setLoading(false);
        setError(null);
      };

      eventSource.addEventListener('location', (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.tracking) {
            setTracking({
              isTracking: true,
              currentLocation: data.tracking.current_location,
              route: [],
              distanceTraveled: data.tracking.distance_traveled_km || 0,
              duration: data.tracking.duration_seconds || 0,
              eta_minutes: data.tracking.eta_minutes,
              distance_km: data.tracking.distance_km,
              status: data.tracking.status,
            });
            setError(null);
            setLoading(false);
          }
        } catch (err) {
          console.error('Error parsing location event:', err);
        }
      });

      eventSource.addEventListener('status', (event) => {
        try {
          const data = JSON.parse(event.data);
          if (!data.isTracking) {
            setTracking(null);
            setError(data.message || 'GPS tracking is not active for this booking');
          }
        } catch (err) {
          console.error('Error parsing status event:', err);
        }
      });

      eventSource.onerror = () => {
        console.error('❌ [GPS SSE] EventSource error');
        setSseConnected(false);
        if (eventSource && eventSource.readyState === EventSource.CLOSED) {
          eventSource.close();
          eventSource = null;
          sseSupported = false;
        }
      };
    } catch (sseError) {
      console.warn('⚠️ [GPS] SSE not supported, using polling:', sseError);
      sseSupported = false;
    }

    // Fallback to polling if SSE is not supported
    if (!sseSupported) {
      setSseConnected(false);
      
      const loadTrackingStatus = async () => {
        try {
          const response = await apiClient.get<{
            success?: boolean;
            tracking?: any;
            message?: string;
          }>(`/tracking/booking/${bookingId}`);

          if (response.success && response.tracking) {
            const t = response.tracking;
            setTracking({
              isTracking: true,
              currentLocation: t.currentLocation || t.current_location,
              route: [],
              distanceTraveled: t.distanceKm || t.distance_km || 0,
              duration: 0,
              eta_minutes: t.estimatedEtaMinutes ?? t.eta_minutes,
              distance_km: t.distanceKm ?? t.distance_km,
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

      loadTrackingStatus();
      pollInterval = setInterval(loadTrackingStatus, 3000);
    }

    // Cleanup
    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      setSseConnected(false);
    };
  }, [bookingId]);

  const loadTrackingStatus = async () => {
    try {
      const response = await apiClient.get<{
        success?: boolean;
        tracking?: any;
        message?: string;
      }>(`/tracking/booking/${bookingId}`);

      if (response.success && response.tracking) {
        const t = response.tracking;
        setTracking({
          isTracking: true,
          currentLocation: t.currentLocation || t.current_location,
          route: [],
          distanceTraveled: t.distanceKm || t.distance_km || 0,
          duration: 0,
          eta_minutes: t.estimatedEtaMinutes ?? t.eta_minutes,
          distance_km: t.distanceKm ?? t.distance_km,
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
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-3 text-gray-600">Loading tracking...</span>
        </div>
      </div>
    );
  }

  if (error || !tracking) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-600 mb-4 font-medium">{error || 'GPS tracking not available'}</p>
          {onClose && (
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <Navigation className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Live Tracking</h3>
            <p className="text-xs text-green-600 flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Active
            </p>
          </div>
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
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-gray-900">Current Location</span>
            </div>
            <p className="text-sm text-gray-700 font-mono">
              {tracking.currentLocation.latitude?.toFixed(6)}, {tracking.currentLocation.longitude?.toFixed(6)}
            </p>
            <p className="text-xs text-blue-600 mt-2">
              Last updated: {new Date(tracking.currentLocation.timestamp).toLocaleTimeString()}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            {tracking.distanceTraveled !== undefined && (
              <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                <div className="flex items-center gap-2 mb-2">
                  <Route className="w-4 h-4 text-[#FF8C42]" />
                  <span className="text-xs text-gray-600 font-medium">Distance</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {tracking.distanceTraveled.toFixed(2)} <span className="text-sm text-gray-500">km</span>
                </p>
              </div>
            )}

            {tracking.duration !== undefined && (
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-green-600" />
                  <span className="text-xs text-gray-600 font-medium">Duration</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {Math.floor(tracking.duration / 60)}m {tracking.duration % 60}s
                </p>
              </div>
            )}
          </div>

          {/* Route Info */}
          {tracking.route && tracking.route.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <p className="text-sm font-semibold text-gray-900 mb-3">
                Route Points: {tracking.route.length}
              </p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {tracking.route.slice(-5).map((point: any, idx: number) => (
                  <div key={idx} className="text-xs text-gray-600 font-mono bg-white px-2 py-1 rounded">
                    Point {idx + 1}: {point.latitude?.toFixed(4)}, {point.longitude?.toFixed(4)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Map Integration */}
          <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl p-8 text-center border border-slate-300">
            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
              <MapPin className="w-7 h-7 text-[#FF8C42]" />
            </div>
            <p className="text-sm text-gray-700 font-medium mb-4">
              View on Interactive Map
            </p>
            {tracking.currentLocation && (
              <a
                href={`https://www.google.com/maps?q=${tracking.currentLocation.latitude},${tracking.currentLocation.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FF8C42] hover:bg-[#FF7A2E] text-white rounded-xl font-medium transition-colors"
              >
                Open in Google Maps
                <span className="text-lg">→</span>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

