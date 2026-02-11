'use client';

/**
 * ============================================================================
 * LIVE TRACKING WIDGET - CUSTOMER FACING
 * ============================================================================
 * 
 * Real-time GPS tracking widget for home services
 * - Shows vendor/staff location on map
 * - Calculates and displays ETA
 * - Real-time updates via SSE
 * - Status indicators (on way, arriving, arrived)
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Navigation, Phone, MessageSquare, Clock, MapPin, 
  User, RefreshCw, X, ChevronUp, ChevronDown,
  AlertCircle, CheckCircle2, Car, Loader2
} from 'lucide-react';
import { apiClient, getApiBaseUrl } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface TrackingData {
  booking_id: string;
  booking_status: string;
  staff_name: string;
  staff_phone: string | null;
  staff_photo_url: string | null;
  service_name: string;
  current_location: {
    latitude: number;
    longitude: number;
    timestamp: string;
    accuracy?: number;
  };
  destination: {
    latitude: number;
    longitude: number;
    address: string;
  };
  eta_minutes: number | null;
  distance_km: number | null;
  status: 'on_way' | 'arriving' | 'arrived' | 'in_progress' | 'completed';
  eta_calculation_method?: string;
}

interface LiveTrackingWidgetProps {
  bookingId: string;
  onClose?: () => void;
  onCallProvider?: () => void;
  onChatProvider?: () => void;
  minimizable?: boolean;
  className?: string;
}

type TrackingStatus = 'loading' | 'inactive' | 'active' | 'error';

export function LiveTrackingWidget({
  bookingId,
  onClose,
  onCallProvider,
  onChatProvider,
  minimizable = true,
  className = '',
}: LiveTrackingWidgetProps) {
  // State
  const [status, setStatus] = useState<TrackingStatus>('loading');
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // Refs
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const providerMarkerRef = useRef<any>(null);
  const destinationMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  useEffect(() => {
    initializeTracking();
    
    return () => {
      cleanup();
    };
  }, [bookingId]);

  const cleanup = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const initializeTracking = async () => {
    try {
      setStatus('loading');
      setError(null);

      // First, check if tracking is active
      // ✅ CRITICAL FIX: Use correct endpoint path
      const response = await apiClient.get<any>(`/tracking/booking/${bookingId}`);
      
      // ✅ CRITICAL FIX: Check response format - endpoint returns { success, tracking }
      if (!response.success || !response.tracking) {
        setStatus('inactive');
        return;
      }

      // ✅ CRITICAL FIX: Map backend TrackingSession format to frontend TrackingData format
      const trackingData: TrackingData = {
        booking_id: response.tracking.bookingId || bookingId,
        booking_status: response.tracking.status || 'in_transit',
        staff_name: response.tracking.providerName || 'Service Provider',
        staff_phone: null,
        staff_photo_url: null,
        service_name: 'Service',
        current_location: response.tracking.currentLocation ? {
          latitude: response.tracking.currentLocation.latitude,
          longitude: response.tracking.currentLocation.longitude,
          timestamp: response.tracking.currentLocation.timestamp || new Date().toISOString(),
          accuracy: response.tracking.currentLocation.accuracy,
        } : {
          latitude: response.tracking.startLocation?.latitude || 0,
          longitude: response.tracking.startLocation?.longitude || 0,
          timestamp: new Date().toISOString(),
        },
        destination: {
          latitude: response.tracking.destinationLocation.latitude,
          longitude: response.tracking.destinationLocation.longitude,
          address: '',
        },
        eta_minutes: response.tracking.estimatedEtaMinutes || null,
        distance_km: response.tracking.distanceKm || null,
        status: response.tracking.status === 'in_transit' ? 'on_way' : 
                response.tracking.status === 'arrived' ? 'arrived' : 
                response.tracking.status === 'completed' ? 'completed' : 'on_way',
      };
      
      setTracking(trackingData);
      setLastUpdate(new Date());
      setStatus('active');
      
      // Initialize map
      await initializeMap(trackingData);
      
      // Start real-time updates
      startRealtimeUpdates();
    } catch (err: any) {
      console.error('Error initializing tracking:', err);
      setError(err.message || 'Failed to load tracking');
      setStatus('error');
    }
  };

  const startRealtimeUpdates = () => {
    const apiBaseUrl = getApiBaseUrl().replace(/\/+$/, '');
    
    // Try SSE first (if endpoint exists)
    try {
      // ✅ Use runtime API base; SSE stream may not exist, fallback to polling on error
      const eventSource = new EventSource(`${apiBaseUrl}/tracking/booking/${bookingId}/stream`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('SSE connection opened');
      };

      eventSource.addEventListener('location', (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.tracking) {
            // ✅ CRITICAL FIX: Map backend format to frontend format
            const trackingData: TrackingData = {
              booking_id: data.tracking.bookingId || bookingId,
              booking_status: data.tracking.status || 'in_transit',
              staff_name: data.tracking.providerName || 'Service Provider',
              staff_phone: null,
              staff_photo_url: null,
              service_name: 'Service',
              current_location: data.tracking.currentLocation ? {
                latitude: data.tracking.currentLocation.latitude,
                longitude: data.tracking.currentLocation.longitude,
                timestamp: data.tracking.currentLocation.timestamp || new Date().toISOString(),
              } : {
                latitude: 0,
                longitude: 0,
                timestamp: new Date().toISOString(),
              },
              destination: {
                latitude: data.tracking.destinationLocation?.latitude || 0,
                longitude: data.tracking.destinationLocation?.longitude || 0,
                address: '',
              },
              eta_minutes: data.tracking.estimatedEtaMinutes || null,
              distance_km: data.tracking.distanceKm || null,
              status: data.tracking.status === 'in_transit' ? 'on_way' : 
                      data.tracking.status === 'arrived' ? 'arrived' : 'on_way',
            };
            updateTracking(trackingData);
          }
        } catch (e) {
          console.error('Error parsing SSE location:', e);
        }
      });

      eventSource.addEventListener('status', (event) => {
        try {
          const data = JSON.parse(event.data);
          if (!data.isTracking) {
            setStatus('inactive');
            cleanup();
          }
        } catch (e) {
          console.error('Error parsing SSE status:', e);
        }
      });

      eventSource.onerror = (err) => {
        console.warn('SSE connection failed (endpoint might not exist), falling back to polling:', err);
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        startPolling();
      };
    } catch (err) {
      console.warn('SSE not supported, using polling:', err);
      startPolling();
    }
  };

  const startPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        // ✅ CRITICAL FIX: Use correct endpoint path
        const response = await apiClient.get<any>(`/tracking/booking/${bookingId}`);
        
        // ✅ CRITICAL FIX: Check response format - endpoint returns { success, tracking }
        if (!response.tracking) {
          setStatus('inactive');
          cleanup();
          return;
        }

        // ✅ CRITICAL FIX: Map backend response to frontend format
        if (response.tracking) {
          const trackingData: TrackingData = {
            booking_id: response.tracking.bookingId || bookingId,
            booking_status: response.tracking.status || 'in_transit',
            staff_name: response.tracking.providerName || 'Service Provider',
            staff_phone: null,
            staff_photo_url: null,
            service_name: 'Service',
            current_location: response.tracking.currentLocation ? {
              latitude: response.tracking.currentLocation.latitude,
              longitude: response.tracking.currentLocation.longitude,
              timestamp: response.tracking.currentLocation.timestamp || new Date().toISOString(),
              accuracy: response.tracking.currentLocation.accuracy,
            } : {
              latitude: response.tracking.startLocation?.latitude || 0,
              longitude: response.tracking.startLocation?.longitude || 0,
              timestamp: new Date().toISOString(),
            },
            destination: {
              latitude: response.tracking.destinationLocation.latitude,
              longitude: response.tracking.destinationLocation.longitude,
              address: '',
            },
            eta_minutes: response.tracking.estimatedEtaMinutes || null,
            distance_km: response.tracking.distanceKm || null,
            status: response.tracking.status === 'in_transit' ? 'on_way' : 
                    response.tracking.status === 'arrived' ? 'arrived' : 
                    response.tracking.status === 'completed' ? 'completed' : 'on_way',
          };
          updateTracking(trackingData);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 5000); // Poll every 5 seconds
  };

  const updateTracking = (newTracking: TrackingData) => {
    setTracking(newTracking);
    setLastUpdate(new Date());
    setStatus('active');
    
    // Update map marker
    updateMapMarker(newTracking.current_location);

    // Check if completed
    if (newTracking.status === 'completed') {
      toast.success('Service completed!');
      cleanup();
    } else if (newTracking.status === 'arrived') {
      toast.success('Your service provider has arrived!');
    }
  };

  // ============================================================================
  // MAP FUNCTIONS
  // ============================================================================

  const initializeMap = async (trackingData: TrackingData) => {
    if (!mapRef.current || !window.google?.maps) {
      // Load Google Maps if not available
      await loadGoogleMaps();
    }

    if (!mapRef.current || !window.google?.maps) {
      console.error('Google Maps not available');
      return;
    }

    const { current_location, destination } = trackingData;

    // Calculate center and bounds
    const center = {
      lat: (current_location.latitude + destination.latitude) / 2,
      lng: (current_location.longitude + destination.longitude) / 2,
    };

    // Create map
    const map = new window.google.maps.Map(mapRef.current, {
      center,
      zoom: 14,
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false,
      zoomControl: true,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }],
        },
      ],
    });

    mapInstanceRef.current = map;

    // Create provider marker (custom icon)
    const providerMarker = new window.google.maps.Marker({
      position: { lat: current_location.latitude, lng: current_location.longitude },
      map,
      icon: {
        url: 'data:image/svg+xml,' + encodeURIComponent(`
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="24" cy="24" r="20" fill="#FF8C42" stroke="white" stroke-width="4"/>
            <path d="M24 16C20.7 16 18 18.7 18 22C18 26.25 24 32 24 32S30 26.25 30 22C30 18.7 27.3 16 24 16ZM24 24C22.9 24 22 23.1 22 22C22 20.9 22.9 20 24 20C25.1 20 26 20.9 26 22C26 23.1 25.1 24 24 24Z" fill="white"/>
          </svg>
        `),
        scaledSize: new window.google.maps.Size(48, 48),
        anchor: new window.google.maps.Point(24, 24),
      },
      title: trackingData.staff_name,
      zIndex: 100,
    });

    providerMarkerRef.current = providerMarker;

    // Create destination marker
    const destinationMarker = new window.google.maps.Marker({
      position: { lat: destination.latitude, lng: destination.longitude },
      map,
      icon: {
        url: 'data:image/svg+xml,' + encodeURIComponent(`
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="20" r="16" fill="#10B981" stroke="white" stroke-width="4"/>
            <path d="M20 12L26 28H14L20 12Z" fill="white"/>
          </svg>
        `),
        scaledSize: new window.google.maps.Size(40, 40),
        anchor: new window.google.maps.Point(20, 40),
      },
      title: 'Your Location',
      zIndex: 99,
    });

    destinationMarkerRef.current = destinationMarker;

    // Draw route line
    const routePath = new window.google.maps.Polyline({
      path: [
        { lat: current_location.latitude, lng: current_location.longitude },
        { lat: destination.latitude, lng: destination.longitude },
      ],
      geodesic: true,
      strokeColor: '#FF8C42',
      strokeOpacity: 0.8,
      strokeWeight: 4,
    });

    routePath.setMap(map);
    polylineRef.current = routePath;

    // Fit bounds to show both markers
    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend({ lat: current_location.latitude, lng: current_location.longitude });
    bounds.extend({ lat: destination.latitude, lng: destination.longitude });
    map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
  };

  const updateMapMarker = (location: { latitude: number; longitude: number }) => {
    if (!providerMarkerRef.current) return;

    const newPosition = { lat: location.latitude, lng: location.longitude };
    
    // Animate marker movement
    providerMarkerRef.current.setPosition(newPosition);

    // Update route line
    if (polylineRef.current && destinationMarkerRef.current) {
      const destPosition = destinationMarkerRef.current.getPosition();
      if (destPosition) {
        polylineRef.current.setPath([
          newPosition,
          { lat: destPosition.lat(), lng: destPosition.lng() },
        ]);
      }
    }

    // Optionally recenter map
    if (mapInstanceRef.current) {
      const bounds = mapInstanceRef.current.getBounds();
      if (bounds && !bounds.contains(newPosition)) {
        mapInstanceRef.current.panTo(newPosition);
      }
    }
  };

  const loadGoogleMaps = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.google?.maps) {
        resolve();
        return;
      }

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        reject(new Error('Google Maps API key not configured'));
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Maps'));
      
      document.head.appendChild(script);
    });
  };

  // ============================================================================
  // HELPERS
  // ============================================================================

  const formatETA = (minutes: number | null) => {
    if (minutes === null) return 'Calculating...';
    if (minutes < 1) return 'Less than 1 min';
    if (minutes === 1) return '1 min';
    if (minutes < 60) return `${Math.round(minutes)} mins`;
    // ✅ FIX: Show hours when >= 60 minutes
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (mins === 0) {
      return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    } else {
      return `${hours}h ${mins}m`;
    }
  };

  const getStatusInfo = (trackingStatus: TrackingData['status']) => {
    switch (trackingStatus) {
      case 'on_way':
        return { 
          label: 'On the way', 
          color: 'bg-blue-500', 
          textColor: 'text-blue-600',
          bgColor: 'bg-blue-50',
          icon: Car 
        };
      case 'arriving':
        return { 
          label: 'Arriving soon', 
          color: 'bg-yellow-500', 
          textColor: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          icon: Navigation 
        };
      case 'arrived':
        return { 
          label: 'Arrived!', 
          color: 'bg-green-500', 
          textColor: 'text-green-600',
          bgColor: 'bg-green-50',
          icon: CheckCircle2 
        };
      case 'in_progress':
        return { 
          label: 'Service in progress', 
          color: 'bg-purple-500', 
          textColor: 'text-purple-600',
          bgColor: 'bg-purple-50',
          icon: User 
        };
      case 'completed':
        return { 
          label: 'Completed', 
          color: 'bg-gray-500', 
          textColor: 'text-gray-600',
          bgColor: 'bg-gray-50',
          icon: CheckCircle2 
        };
      default:
        return { 
          label: 'Tracking', 
          color: 'bg-gray-500', 
          textColor: 'text-gray-600',
          bgColor: 'bg-gray-50',
          icon: Navigation 
        };
    }
  };

  const refreshTracking = async () => {
    setStatus('loading');
    await initializeTracking();
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  // Loading state
  if (status === 'loading') {
    return (
      <div className={`bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden ${className}`}>
        <div className="p-6 flex flex-col items-center justify-center min-h-[200px]">
          <Loader2 className="w-10 h-10 animate-spin text-[#FF8C42] mb-3" />
          <p className="text-gray-600 text-sm">Loading tracking...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className={`bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden ${className}`}>
        <div className="p-6 flex flex-col items-center justify-center min-h-[200px]">
          <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
          <p className="text-gray-900 font-medium mb-1">Unable to load tracking</p>
          <p className="text-gray-500 text-sm mb-4">{error}</p>
          <Button onClick={refreshTracking} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Inactive state
  if (status === 'inactive') {
    return (
      <div className={`bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden ${className}`}>
        <div className="p-6 flex flex-col items-center justify-center min-h-[200px]">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Navigation className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-900 font-medium mb-1">Tracking not active</p>
          <p className="text-gray-500 text-sm text-center">
            Live tracking will be available when your service provider starts their journey
          </p>
          <Button onClick={refreshTracking} variant="outline" size="sm" className="mt-4">
            <RefreshCw className="w-4 h-4 mr-2" />
            Check Again
          </Button>
        </div>
      </div>
    );
  }

  // Active tracking
  if (!tracking) return null;

  const statusInfo = getStatusInfo(tracking.status);
  const StatusIcon = statusInfo.icon;

  // Minimized view
  if (isMinimized && minimizable) {
    return (
      <div className={`bg-gradient-to-r from-[#FF8C42] to-[#FF7029] rounded-2xl shadow-lg overflow-hidden ${className}`}>
        <button 
          onClick={() => setIsMinimized(false)}
          className="w-full p-4 flex items-center justify-between text-white"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <StatusIcon className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="font-semibold">{tracking.staff_name}</p>
              <p className="text-sm text-white/80">{statusInfo.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {tracking.eta_minutes !== null && (
              <div className="text-right">
                <p className="font-bold">{formatETA(tracking.eta_minutes)}</p>
                <p className="text-xs text-white/70">ETA</p>
              </div>
            )}
            <ChevronUp className="w-5 h-5" />
          </div>
        </button>
      </div>
    );
  }

  // Full view
  return (
    <div className={`bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF7029] p-4 text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center overflow-hidden">
              {tracking.staff_photo_url ? (
                <img 
                  src={tracking.staff_photo_url} 
                  alt={tracking.staff_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-6 h-6" />
              )}
            </div>
            <div>
              <p className="font-semibold text-lg">{tracking.staff_name}</p>
              <p className="text-sm text-white/80">{tracking.service_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {minimizable && (
              <button 
                onClick={() => setIsMinimized(true)}
                className="p-2 hover:bg-white/20 rounded-full transition"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            )}
            {onClose && (
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Status & ETA */}
        <div className="flex items-center justify-between bg-white/20 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${statusInfo.color} animate-pulse`} />
            <span className="font-medium">{statusInfo.label}</span>
          </div>
          {tracking.eta_minutes !== null && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span className="font-bold">{formatETA(tracking.eta_minutes)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div 
        ref={mapRef} 
        className="w-full h-48 bg-gray-100"
        style={{ minHeight: '192px' }}
      />

      {/* Info & Actions */}
      <div className="p-4">
        {/* Distance & Last Update */}
        <div className="flex items-center justify-between mb-4 text-sm">
          {tracking.distance_km !== null && (
            <div className="flex items-center gap-1 text-gray-600">
              <Navigation className="w-4 h-4" />
              <span>{tracking.distance_km.toFixed(1)} km away</span>
            </div>
          )}
          {lastUpdate && (
            <div className="text-gray-400 text-xs">
              Updated {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>

        {/* Destination */}
        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl mb-4">
          <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-gray-500">Delivering to</p>
            <p className="text-sm font-medium text-gray-900 line-clamp-2">
              {tracking.destination.address}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          {tracking.staff_phone && (
            <Button
              onClick={() => {
                if (tracking.staff_phone) {
                  window.location.href = `tel:${tracking.staff_phone}`;
                }
                onCallProvider?.();
              }}
              variant="outline"
              className="flex-1"
            >
              <Phone className="w-4 h-4 mr-2" />
              Call
            </Button>
          )}
          <Button
            onClick={onChatProvider}
            className="flex-1 bg-[#FF8C42] hover:bg-[#E67A35]"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Chat
          </Button>
        </div>
      </div>
    </div>
  );
}

export default LiveTrackingWidget;
