"use client";

import { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Phone, X, Clock, Route, RefreshCw, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiClient, getApiBaseUrl } from '@/lib/api-client';

interface LiveTrackingMapProps {
  bookingId: string;
  currentLocation?: { latitude: number; longitude: number };
  route?: Array<{ latitude: number; longitude: number }>;
  walkerName?: string;
  walkerPhone?: string;
  petName?: string;
  onClose?: () => void;
}

interface TrackingData {
  status: 'active' | 'inactive' | 'completed';
  currentLocation: { latitude: number; longitude: number } | null;
  route: Array<{ latitude: number; longitude: number; timestamp: string }>;
  staffName?: string;
  staffPhone?: string;
  eta?: string;
  startTime?: string;
  totalDistance?: number;
  lastUpdate?: string;
}

export function LiveTrackingMap({ 
  bookingId, 
  currentLocation: initialLocation, 
  route: initialRoute, 
  walkerName, 
  walkerPhone, 
  petName, 
  onClose 
}: LiveTrackingMapProps) {
  const [trackingData, setTrackingData] = useState<TrackingData>({
    status: 'inactive',
    currentLocation: initialLocation || null,
    route: initialRoute?.map((p, i) => ({ ...p, timestamp: new Date().toISOString() })) || [],
    staffName: walkerName,
    staffPhone: walkerPhone,
  });
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [lastError, setLastError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttempts = useRef(0);

  // Load tracking from GET /tracking/booking/:bookingId (shared by initial load and polling)
  const loadTrackingFromApi = async () => {
    try {
      const response = await apiClient.get<any>(`/tracking/booking/${bookingId}`);
      if (response.success && response.tracking) {
        const t = response.tracking;
        setTrackingData(prev => ({
          ...prev,
          status: t.status || 'inactive',
          currentLocation: t.currentLocation || t.current_location || null,
          route: t.route || [],
          staffName: t.staffName || t.staff_name || walkerName,
          staffPhone: t.staffPhone || t.staff_phone || walkerPhone,
          eta: t.eta,
          startTime: t.startTime || t.tracking_started_at,
          totalDistance: t.totalDistance ?? (t.distance_traveled_km != null ? t.distance_traveled_km * 1000 : undefined),
        }));
        setLastError(null);
        if (t.status === 'completed' || t.status === 'cancelled') {
          setConnectionStatus('disconnected');
        }
      }
    } catch (error) {
      console.error('[LiveTracking] Failed to load tracking data:', error);
    }
  };

  // Initialize: try SSE (backend may not have stream), then fallback to polling GET /tracking/booking/:bookingId
  useEffect(() => {
    const apiBase = getApiBaseUrl();
    // Backend gps-tracking.ts uses /tracking/* not /gps-tracking/*; stream endpoint may not exist — fallback to polling
    const sseUrl = `${apiBase.replace(/\/+$/, '')}/tracking/booking/${bookingId}/stream`;

    const startPolling = () => {
      if (pollIntervalRef.current) return;
      setConnectionStatus('connected');
      setLastError(null);
      loadTrackingFromApi();
      pollIntervalRef.current = setInterval(loadTrackingFromApi, 5000);
    };

    const connectToSSE = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setConnectionStatus('connecting');
      setLastError(null);
      try {
        const eventSource = new EventSource(sseUrl);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          setConnectionStatus('connected');
          reconnectAttempts.current = 0;
        };

        eventSource.addEventListener('location', (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            const tracking = data.tracking || data;
            const currentLocation = tracking.current_location || {
              latitude: tracking.latitude || data.latitude,
              longitude: tracking.longitude || data.longitude,
            };
            setTrackingData(prev => ({
              ...prev,
              status: tracking.status || 'active',
              currentLocation: currentLocation ? {
                latitude: currentLocation.latitude || currentLocation.lat,
                longitude: currentLocation.longitude || currentLocation.lng,
              } : prev.currentLocation,
              route: tracking.route || (currentLocation ? [...prev.route, {
                latitude: currentLocation.latitude || currentLocation.lat,
                longitude: currentLocation.longitude || currentLocation.lng,
                timestamp: tracking.current_location?.timestamp || data.timestamp || new Date().toISOString(),
              }] : prev.route),
              eta: tracking.eta_minutes ? `${tracking.eta_minutes} min` : tracking.eta || prev.eta,
              staffName: tracking.staff_name || prev.staffName,
              staffPhone: tracking.staff_phone || prev.staffPhone,
              totalDistance: tracking.distance_traveled_km != null ? tracking.distance_traveled_km * 1000 : prev.totalDistance,
              lastUpdate: tracking.current_location?.timestamp || data.timestamp || new Date().toISOString(),
            }));
          } catch (err) {
            console.error('[LiveTracking] Parse location:', err);
          }
        });

        eventSource.addEventListener('status', (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            setTrackingData(prev => ({ ...prev, status: data.status, totalDistance: data.totalDistance }));
            if (data.status === 'completed') {
              eventSource.close();
              setConnectionStatus('disconnected');
            }
          } catch (err) {
            console.error('[LiveTracking] Parse status:', err);
          }
        });

        eventSource.onerror = () => {
          eventSource.close();
          eventSourceRef.current = null;
          if (reconnectAttempts.current < 1) {
            reconnectAttempts.current++;
            setTimeout(connectToSSE, 2000);
          } else {
            // Backend has no SSE stream — use polling (GET /tracking/booking/:bookingId)
            setConnectionStatus('connected');
            setLastError(null);
            startPolling();
          }
        };
      } catch (err) {
        console.warn('[LiveTracking] SSE not available, using polling', err);
        startPolling();
      }
    };

    loadTrackingFromApi();
    connectToSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [bookingId, walkerName, walkerPhone]);

  // Generate map URL with route markers
  const getMapUrl = () => {
    if (!trackingData.currentLocation) return null;

    const { latitude, longitude } = trackingData.currentLocation;
    
    // Basic static map with current position
    let url = `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=16&size=600x400&maptype=roadmap`;
    
    // Add current position marker
    url += `&markers=color:blue%7Clabel:S%7C${latitude},${longitude}`;
    
    // Add route path if available (limited to last 20 points to avoid URL length issues)
    if (trackingData.route.length > 1) {
      const pathPoints = trackingData.route.slice(-20)
        .map(p => `${p.latitude},${p.longitude}`)
        .join('|');
      url += `&path=color:0x4285F4%7Cweight:4%7C${pathPoints}`;
    }

    // Note: In production, add your Google Maps API key
    // url += `&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
    
    return url;
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDistance = (meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${Math.round(meters)} m`;
  };

  const mapUrl = getMapUrl();
  const displayName = trackingData.staffName || walkerName;
  const displayPhone = trackingData.staffPhone || walkerPhone;

  return (
    <Card className="w-full overflow-hidden relative">
      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-md hover:bg-white transition-colors"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>
      )}

      {/* Connection status badge */}
      <div className="absolute top-3 left-3 z-10">
        <Badge 
          variant={
            connectionStatus === 'connected' ? 'default' : 
            connectionStatus === 'connecting' ? 'outline' :
            'destructive'
          }
          className={
            connectionStatus === 'connected' 
              ? 'bg-green-500 text-white' 
              : connectionStatus === 'connecting'
              ? 'bg-yellow-500 text-white'
              : ''
          }
        >
          {connectionStatus === 'connected' && '🟢 Live'}
          {connectionStatus === 'connecting' && '⏳ Connecting...'}
          {connectionStatus === 'disconnected' && '⚪ Offline'}
          {connectionStatus === 'error' && '🔴 Error'}
        </Badge>
      </div>

      {/* Map area */}
      <div className="w-full h-72 bg-gray-200 relative">
        {mapUrl && trackingData.currentLocation ? (
          <img 
            src={mapUrl} 
            alt="Live tracking map" 
            className="w-full h-full object-cover"
            onError={() => {}}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center">
            {trackingData.status === 'inactive' ? (
              <>
                <Clock className="w-12 h-12 text-gray-400 mb-2" />
                <p className="text-gray-500">Waiting for tracking to start...</p>
                <p className="text-xs text-gray-400 mt-1">The provider will start tracking when they're on the way</p>
              </>
            ) : connectionStatus === 'error' ? (
              <>
                <AlertCircle className="w-12 h-12 text-red-400 mb-2" />
                <p className="text-gray-500">{lastError || 'Connection error'}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
              </>
            ) : (
              <>
                <Navigation className="w-12 h-12 text-gray-400 mb-2 animate-pulse" />
                <p className="text-gray-500">Loading tracking data...</p>
              </>
            )}
          </div>
        )}

        {/* Tracking stats overlay */}
        {trackingData.status === 'active' && (
          <div className="absolute top-14 left-3 right-3 flex gap-2">
            {trackingData.eta && (
              <Badge variant="secondary" className="bg-white/90 text-gray-700">
                <Clock className="w-3 h-3 mr-1" />
                ETA: {formatTime(trackingData.eta)}
              </Badge>
            )}
            {trackingData.totalDistance && (
              <Badge variant="secondary" className="bg-white/90 text-gray-700">
                <Route className="w-3 h-3 mr-1" />
                {formatDistance(trackingData.totalDistance)}
              </Badge>
            )}
          </div>
        )}

        {/* Provider info overlay */}
        {displayName && (
          <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#FF8C42] rounded-full flex items-center justify-center text-white font-semibold">
                  {displayName.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{displayName}</p>
                  {petName && (
                    <p className="text-sm text-gray-600">
                      {trackingData.status === 'active' ? 'En route' : 'Assigned'} for {petName}
                    </p>
                  )}
                  {trackingData.lastUpdate && (
                    <p className="text-xs text-gray-400">
                      Updated {formatTime(trackingData.lastUpdate)}
                    </p>
                  )}
                </div>
              </div>
              {displayPhone && (
                <a 
                  href={`tel:${displayPhone}`}
                  className="p-3 bg-[#FF8C42] text-white rounded-full hover:bg-[#FF7A29] transition-colors shadow-md"
                >
                  <Phone className="w-5 h-5" />
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tracking completed state */}
      {trackingData.status === 'completed' && (
        <div className="p-4 bg-green-50 border-t border-green-100">
          <div className="flex items-center gap-2 text-green-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">Tracking completed</span>
          </div>
          {trackingData.totalDistance && (
            <p className="text-sm text-green-600 mt-1">
              Total distance: {formatDistance(trackingData.totalDistance)}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
